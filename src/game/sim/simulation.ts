import { campaignHandler } from '../main';
import { G, zstate } from '../state';
import { PAYLOAD_DEFS } from '../payload-defs';
import { I18N } from '../i18n';
import { hapticImpact, hapticNotification, ImpactStyle, NotificationType } from '../haptics';
import { PhysicsCtx } from './ctx';
import { getGround, getCarrierLocal, isFlatTerrain } from './terrain';
import { updateBoats, updateSubmarines, updateCarrierPos, resolveAttachTo } from './world-init';
import { carrierCar } from './vehicles/carrier-car';
import { fuelTruck } from './vehicles/fuel-truck';
import { handleParticles } from './particles';

export type { PhysicsCtx };

let _prevKeyR = false;

const _pointInVesselZone = (wx: number, wy: number, vessel: any, zone: any): boolean => {
    const c = Math.cos(-vessel.angle), s = Math.sin(-vessel.angle);
    const dx = wx - vessel.x, dy = wy - vessel.y;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx - zone.x) <= zone.w && Math.abs(ly - zone.y) <= zone.h;
};

const _vesselPickupAllowed = (wx: number, wy: number, vessel: any): boolean => {
    if (!vessel.rescueZones?.length) return true;
    const pickupZones = vessel.rescueZones.filter((z: any) => z.role === 'pickup' || z.role === 'both');
    if (!pickupZones.length) return true;
    return pickupZones.some((z: any) => _pointInVesselZone(wx, wy, vessel, z));
};

// All droppable vessel collections with their specific deliverTo type (null = accepts any)
const _dropzoneVessels = (): Array<{ vessel: any; type: string | null }> => [
    { vessel: G.CARRIER, type: 'carrier' },
    ...G.BOATS.map(v => ({ vessel: v, type: 'boat' as string | null })),
    ...G.SUBMARINES.map(v => ({ vessel: v, type: 'submarine' as string | null })),
    ...G.RESEARCH_PLATFORMS.map(v => ({ vessel: v, type: null })),
    ...G.WIND_TURBINES.map(v => ({ vessel: v, type: null })),
];

const _inDropzone = (wx: number, wy: number, deliverTo?: string): boolean =>
    _dropzoneVessels().some(({ vessel, type }) => {
        if (!vessel?.rescueZones?.length) return false;
        const want = !deliverTo || (type !== null && deliverTo === type);
        return want && vessel.rescueZones.some((z: any) => z.role !== 'pickup' && _pointInVesselZone(wx, wy, vessel, z));
    });

const _computeLandingState = (ctx: PhysicsCtx, groundH: number) => {
    let onCarrierDeck = false, onPadSurface = false;
    if (ctx.hasCarrier) {
        const local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
        if (local.x >= -G.CARRIER.w && local.x <= G.CARRIER.w && local.y >= -G.CARRIER.l && local.y <= G.CARRIER.l)
            onCarrierDeck = true;
    }
    if (ctx.hasPad && G.heli.x >= G.PAD.xMin && G.heli.x <= G.PAD.xMax && G.heli.y >= G.PAD.yMin && G.heli.y <= G.PAD.yMax)
        onPadSurface = true;
    const onPad = onCarrierDeck || onPadSurface;
    const effectiveGroundH = onPadSurface && G.PAD ? G.PAD.z : onCarrierDeck ? G.CARRIER.zDeck : groundH;
    return { onCarrierDeck, onPadSurface, onPad, effectiveGroundH };
};

// ─── deposit/winch-in handlers ────────────────────────────────────────────────

interface _DepositState { ctx: PhysicsCtx; onCarrierDeck: boolean; onPadSurface: boolean; }

const _deliveryDeposit = (p: any, { ctx }: _DepositState) => {
    const inZone = ctx.isTutorialMode || _inDropzone(p.x, p.y);
    G.payloads.splice(G.payloads.indexOf(p), 1);
    p.hanging = false; p.rescued = true; G.activePayload = null;
    if (inZone) {
        G.totalRescued++;
        ctx.showMsg(I18N.DELIVERED_TO_ZONE);
        if (G.totalRescued >= G.goalCount) ctx.missionComplete();
    } else {
        G.heli.onboard++;
        ctx.showMsg(I18N.DELIVER_NO_ZONE);
        G.heli.winch = 0.6;
    }
    if (G.heli.onboard === 0) G.deliverMode = false;
};

const _personDeposit = (p: any, { ctx }: _DepositState) => {
    if (G.heli.onboard < G.heli.maxLoad) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        G.heli.onboard++;
        hapticNotification(NotificationType.Success);
        ctx.showMsg(I18N.ONBOARD(G.heli.onboard, G.heli.maxLoad));
    } else ctx.showMsg(I18N.CABIN_FULL);
};

const _orniWreckDeposit = (p: any, { ctx, onPadSurface }: _DepositState) => {
    if (onPadSurface && G.heli.z < 3.0) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        ctx.orniWreckDelivered();
    } else {
        ctx.showMsg(I18N.DROP_AT_PAD);
        G.heli.winch = 0.6;
    }
};

const _genericDeposit = (p: any, { ctx, onCarrierDeck, onPadSurface }: _DepositState) => {
    const deliverTo = (p as any).deliverTo as string | undefined;
    const onCarrierOk = (!deliverTo || deliverTo === 'carrier') && onCarrierDeck && G.heli.z < 3.0;
    const onPadOk     = (!deliverTo || deliverTo === 'pad')     && onPadSurface  && G.heli.z < 3.0;
    const inZone = _inDropzone(p.x, p.y, deliverTo) || _inDropzone(G.heli.x, G.heli.y, deliverTo);
    if (onCarrierOk || onPadOk || inZone) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        G.totalRescued++;
        ctx.showMsg(I18N.DELIVERED);
        if (G.totalRescued >= G.goalCount) ctx.missionComplete();
    } else {
        ctx.showMsg(I18N.DROP_AT_PAD);
        G.heli.winch = 0.6;
    }
};

const _depositHandlers: Record<string, (p: any, state: _DepositState) => void> = {
    delivery:   _deliveryDeposit,
    person:     _personDeposit,
    rescuer:    _personDeposit,
    orni_wreck: _orniWreckDeposit,
};

// ─── main physics update ──────────────────────────────────────────────────────

export function updateWind(wind: any, dt: number, ctx: PhysicsCtx) {
    const baseAngle = (ctx.windDir ?? 0) * (Math.PI / 180);
    const baseStrength = ((ctx.windStr ?? 1) / 10) * 0.0002;
    wind.phase += 0.01 * dt;
    const gust = 1 + Math.sin(wind.phase) * 0.8;
    let currentAngle = baseAngle;
    if (ctx.windVar) {
        wind.varOffset = (wind.varOffset ?? 0) + (Math.random() - 0.5) * 0.008 * dt;
        wind.varOffset = Math.max(-0.5, Math.min(0.5, wind.varOffset));
        currentAngle = baseAngle + wind.varOffset;
    }
    const upwindX = G.heli.x - Math.cos(currentAngle) * 3;
    const upwindY = G.heli.y - Math.sin(currentAngle) * 3;
    const upwindH = getGround(upwindX, upwindY, G.points, null);
    const shelter = Math.max(0, upwindH - G.heli.z) / 5;
    const shelterFactor = Math.max(0.08, 1 - shelter * 0.85);
    wind.x = Math.cos(currentAngle) * baseStrength * gust * shelterFactor;
    wind.y = Math.sin(currentAngle) * baseStrength * gust * shelterFactor;
    wind.angle = currentAngle;
    wind.shelterFactor = shelterFactor;
}

export function updatePhysics(dt: number, ctx: PhysicsCtx) {
    const { crashed } = zstate;
    const { gridSize } = campaignHandler.getTerrain();

    updateWind(G.wind, dt, ctx);
    updateBoats(G.BOATS, dt);
    updateSubmarines(G.SUBMARINES, dt);

    if (ctx.hasPad && G.fuelTruck.state !== 'PARKED') fuelTruck.update(dt, ctx);
    if (ctx.hasCarrier && !crashed) {
        const oldX = G.CARRIER.x, oldY = G.CARRIER.y, oldAng = G.CARRIER.angle;
        updateCarrierPos(
            G.CARRIER,
            { get t() { return G.seaTime; }, set t(v) { G.seaTime = v; } },
            false, dt
        );
        const carrierVX = G.CARRIER.x - oldX;
        const carrierVY = G.CARRIER.y - oldY;
        const carrierRot = G.CARRIER.angle - oldAng;
        const local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
        const onDeck =
            local.x >= -G.CARRIER.w && local.x <= G.CARRIER.w && local.y >= -G.CARRIER.l && local.y <= G.CARRIER.l;
        if (onDeck && !G.heli.inAir) {
            G.heli.x += carrierVX; G.heli.y += carrierVY;
            const dx = G.heli.x - G.CARRIER.x, dy = G.heli.y - G.CARRIER.y;
            G.heli.x += dx * Math.cos(carrierRot) - dy * Math.sin(carrierRot) - dx;
            G.heli.y += dx * Math.sin(carrierRot) + dy * Math.cos(carrierRot) - dy;
            G.heli.angle += carrierRot;
            G.heli.vx *= Math.pow(0.8, dt); G.heli.vy *= Math.pow(0.8, dt);
        }
    }
    // Updated after carrier moves so car snaps to current-frame carrier position (no 1-frame lag)
    if (ctx.hasCarrier) carrierCar.update(dt, ctx);

    const groundH = getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
    const { onCarrierDeck, onPadSurface, onPad, effectiveGroundH } = _computeLandingState(ctx, groundH);

    // engine
    const onFlatTerrain = !G.heli.inAir && groundH > G.waterLevel + 0.1 && isFlatTerrain(G.heli.x, G.heli.y);
    if (G.keys['KeyW'] && !G.heli.engineOn && G.heli.fuel > 0 && (onPad || onFlatTerrain)) G.heli.engineOn = true;
    if (G.keys['KeyS'] && !G.heli.inAir && G.heli.engineOn) {
        G.heli.engineOn = false;
        const landObj = G.objectives.find((o: any) => o.type === 'land_at');
        if (landObj) {
            const onTarget =
                (landObj.target === 'carrier' && onCarrierDeck) ||
                (landObj.target === 'pad' && onPadSurface) ||
                (landObj.target === 'boat' && onPadSurface);
            if (onTarget) ctx.missionComplete();
        }
    }
    if (ctx.hasPad && onPad && !G.heli.engineOn && !G.heli.inAir && G.heli.rotorRPM < 0.05
        && G.fuelTruck.state === 'PARKED' && G.heli.fuel < 99) {
        G.fuelTruck.state = 'DRIVING'; G.fuelTruck.t = 0;
    }
    if (ctx.hasCarrier && onCarrierDeck && !G.heli.engineOn && !G.heli.inAir && G.heli.rotorRPM < 0.05
        && G.carrierFuelCar.state === 'PARKED' && (G.heli.fuel < 99 || G.heli.onboard > 0)) {
        G.carrierFuelCar.state = 'DRIVING'; G.carrierFuelCar.wps = null;
    }
    G.heli.rotorRPM =
        G.heli.engineOn && G.heli.fuel > 0
            ? Math.min(1, G.heli.rotorRPM + 0.005 * dt)
            : Math.max(0, G.heli.rotorRPM - 0.004 * dt);
    G.heli.rotationPos += G.heli.rotorRPM * 0.75 * dt;

    handleParticles(dt, ctx);

    // payload physics
    if (G.activePayload) {
        const p = G.activePayload;
        const isPersonLike = p.type === 'person' || p.type === 'rescuer';
        const damping = isPersonLike ? 0.88 : 0.95;
        const tension = isPersonLike ? 0.018 : 0.005;

        // Rope slack: clamp payload z to ground, compute available horizontal rope
        const groundZp = getGround(p.x, p.y);
        const clampedZ = Math.max(groundZp, G.heli.z - G.heli.winch);
        p.z = clampedZ;
        const verticalDrop = G.heli.z - clampedZ;
        const horizRopeAvail = Math.sqrt(Math.max(0, G.heli.winch * G.heli.winch - verticalDrop * verticalDrop));
        const horizDist = Math.hypot(G.heli.x - p.x, G.heli.y - p.y);
        const ropeIsTaut = horizDist > horizRopeAvail;

        // Only apply horizontal tension when rope is taut (or for person-like payloads always)
        let ax = G.wind.x * 2.0, ay = G.wind.y * 2.0;
        if (ropeIsTaut || isPersonLike) {
            ax += (G.heli.x - p.x) * tension;
            ay += (G.heli.y - p.y) * tension;
        }
        p.vx += ax * dt; p.vy += ay * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(damping, dt); p.vy *= Math.pow(damping, dt);
        const baseMass = PAYLOAD_DEFS[p.type]?.baseMass ?? 0.2;
        G.heli.vx -= ax * baseMass * G.heli.cargoResist * dt;
        G.heli.vy -= ay * baseMass * G.heli.cargoResist * dt;
        G.rescuerSwing.x = G.activePayload.x;
        G.rescuerSwing.y = G.activePayload.y;
    } else {
        if (G.heli.winch > 0.3) {
            const rs = G.rescuerSwing;
            const tension = 0.018, damping = 0.88;
            const ax = (G.heli.x - rs.x) * tension + G.wind.x * 2.0;
            const ay = (G.heli.y - rs.y) * tension + G.wind.y * 2.0;
            rs.vx += ax * dt; rs.vy += ay * dt;
            rs.x += rs.vx * dt; rs.y += rs.vy * dt;
            rs.vx *= Math.pow(damping, dt); rs.vy *= Math.pow(damping, dt);
        } else if (G.heli.winch <= 0.1) {
            G.rescuerSwing.x = G.heli.x; G.rescuerSwing.y = G.heli.y;
            G.rescuerSwing.vx = 0; G.rescuerSwing.vy = 0;
        }

        G.payloads.forEach((p: any) => {
            if (p.rescued || p.hanging) return;
            if (p.attachTo) {
                const pos = resolveAttachTo(p.attachTo);
                if (pos) { p.x = pos.x; p.y = pos.y; p.z = pos.z; }
            } else if (getGround(p.x, p.y, G.points, G.CARRIER) < G.waterLevel) {
                p.z = -0.3 + Math.sin(Date.now() * 0.002) * 0.1;
            }
        });
    }

    // flight
    const lift = G.heli.rotorRPM > 0.9 ? 1.0 : 0.0;
    const inAir = G.heli.z > effectiveGroundH + 0.15;
    if (!inAir && G.heli.inAir) hapticImpact(ImpactStyle.Medium);
    G.heli.inAir = inAir;

    if (inAir || (G.heli.engineOn && lift > 0)) {
        const spd = Math.hypot(G.heli.vx, G.heli.vy);
        const aero = Math.max(0.3, 1.0 - spd * 8.0);
        const mod = G.heli.rotorRPM * (1.0 - G.heli.onboard * 0.03);

        if (G.heli.fuel > 0 && lift > 0) {
            const dX = Math.cos(G.heli.angle), dY = Math.sin(G.heli.angle);
            const sX = Math.cos(G.heli.angle + Math.PI / 2), sY = Math.sin(G.heli.angle + Math.PI / 2);

            if (G.keys['ArrowUp']) {
                G.heli.vx += dX * G.heli.accel * mod * dt;
                G.heli.vy += dY * G.heli.accel * mod * dt;
                G.heli.tilt = Math.max(G.heli.tilt - G.heli.tiltSpeed * dt, -0.4);
            } else if (G.keys['ArrowDown']) {
                G.heli.vx -= dX * G.heli.accel * mod * dt;
                G.heli.vy -= dY * G.heli.accel * mod * dt;
                G.heli.tilt = Math.min(G.heli.tilt + G.heli.tiltSpeed * dt, 0.2);
            } else G.heli.tilt *= Math.pow(0.96, dt);

            let turning = false;
            if (G.keys['KeyA']) {
                G.heli.vx -= sX * 0.001 * mod * dt; G.heli.vy -= sY * 0.001 * mod * dt;
                G.heli.roll = Math.min(G.heli.roll + 0.02 * dt, 0.4); turning = true;
            } else if (G.keys['KeyD']) {
                G.heli.vx += sX * 0.001 * mod * dt; G.heli.vy += sY * 0.001 * mod * dt;
                G.heli.roll = Math.max(G.heli.roll - 0.02 * dt, -0.4); turning = true;
            }
            if (G.keys['ArrowLeft']) {
                G.heli.angle -= 0.045 * mod * aero * dt;
                G.heli.roll = Math.min(G.heli.roll + 0.012 * dt, 0.4); turning = true;
            }
            if (G.keys['ArrowRight']) {
                G.heli.angle += 0.045 * mod * aero * dt;
                G.heli.roll = Math.max(G.heli.roll - 0.012 * dt, -0.4); turning = true;
            }
            if (!turning) G.heli.roll *= Math.pow(0.96, dt);

            if (G.keys['KeyW']) G.heli.vz += G.heli.liftPower * mod * dt;
            else if (G.keys['KeyS']) G.heli.vz -= 0.002 * dt;
            else G.heli.vz *= Math.pow(0.9, dt);

            if (!ctx.isTutorialMode) G.heli.fuel -= G.heli.fuelRate * mod * dt;
        } else {
            G.heli.tilt *= Math.pow(0.98, dt);
            G.heli.roll = Math.sin(Date.now() * 0.01) * 0.1;
        }
    }

    if (G.heli.fuel <= 0 && inAir) {
        if (G.heli.fuel > -1) { ctx.showMsg(I18N.OUT_OF_FUEL); G.heli.fuel = -1; }
        G.heli.engineOn = false; G.heli.vz -= 0.002 * dt;
    }

    G.heli.vx *= Math.pow(G.heli.friction, dt); G.heli.vy *= Math.pow(G.heli.friction, dt);
    if (!inAir) {
        G.heli.vx = 0; G.heli.vy = 0;
    } else {
        G.heli.vx += G.wind.x * 5 * dt; G.heli.vy += G.wind.y * 5 * dt;
    }
    G.heli.x += G.heli.vx * dt; G.heli.y += G.heli.vy * dt; G.heli.z += G.heli.vz * dt;
    const margin = 2;
    if (G.heli.x < margin) { G.heli.x = margin; G.heli.vx = 0; }
    if (G.heli.x > gridSize - margin) { G.heli.x = gridSize - margin; G.heli.vx = 0; }
    if (G.heli.y < margin) { G.heli.y = margin; G.heli.vy = 0; }
    if (G.heli.y > gridSize - margin) { G.heli.y = gridSize - margin; G.heli.vy = 0; }
    const zMax = 20.0;
    if (G.heli.z > zMax) {
        G.heli.z = zMax; G.heli.vz = 0;
        if (Math.random() < 0.05) ctx.showMsg(I18N.MAX_ALTITUDE);
    }
    if (G.heli.z < groundH + 0.1) { G.heli.z = groundH + 0.1; G.heli.vz = 0; }

    // winch
    if (G.keys['KeyQ']) G.heli.winch = Math.max(0, G.heli.winch - 0.02 * dt);
    if (G.keys['KeyE']) G.heli.winch = Math.min(5.0, G.heli.winch + 0.02 * dt);

    // deliver-mode toggle (R key — rising edge only)
    const keyR = !!G.keys['KeyR'];
    if (keyR && !_prevKeyR) {
        const ap = G.activePayload as any;
        if (ap?.type === 'crate' && ap.hanging) {
            const crateZ = G.heli.z - G.heli.winch;
            const groundZ = getGround(G.rescuerSwing.x, G.rescuerSwing.y);
            if (crateZ <= groundZ + 0.4) {
                ap.hanging = false;
                ap.x = G.rescuerSwing.x; ap.y = G.rescuerSwing.y; ap.z = groundZ;
                ap.dropCooldown = 180;
                G.activePayload = null;
            }
        } else if (G.deliverMode) {
            G.deliverMode = false;
        } else if (G.heli.onboard > 0 && !G.activePayload) {
            G.deliverMode = true;
        }
    }
    _prevKeyR = keyR;

    // deliver-mode: lower a person from onboard when winch extends
    if (G.deliverMode && !G.activePayload && G.heli.onboard > 0 && G.heli.winch > 0.3) {
        const dp: any = {
            x: G.rescuerSwing.x, y: G.rescuerSwing.y, z: G.heli.z - G.heli.winch,
            vx: 0, vy: 0, type: 'person', rescued: false, hanging: true, isDelivery: true,
            attachTo: null, npcTarget: false, outfitColors: { shirt: '#4488cc', pants: '#223355' },
        };
        G.activePayload = dp; G.payloads.push(dp); G.heli.onboard--;
    }

    // pickup
    if (!G.activePayload && !G.deliverMode) {
        for (const p of G.payloads) {
            if (p.rescued || p.hanging || p.npcTarget || p.isDelivery) continue;
            if ((p as any).dropCooldown > 0) { (p as any).dropCooldown -= dt; continue; }
            const dist = Math.hypot(G.rescuerSwing.x - p.x, G.rescuerSwing.y - p.y);
            const hZ = Math.max(G.heli.z - G.heli.winch, getGround(G.rescuerSwing.x, G.rescuerSwing.y));
            if (dist < 1.8 && Math.abs(hZ - getGround(p.x, p.y)) < 1.0) {
                if (p.attachTo) {
                    let vessel: any = null;
                    if (p.attachTo.objectType === 'carrier') vessel = G.CARRIER;
                    else if (p.attachTo.objectType === 'boat') vessel = G.BOATS.find((b: any) => b._objIdx === p.attachTo.objectIdx);
                    else if (p.attachTo.objectType === 'submarine') vessel = G.SUBMARINES.find((s: any) => s._objIdx === p.attachTo.objectIdx);
                    if (vessel && !_vesselPickupAllowed(G.heli.x, G.heli.y, vessel)) continue;
                }
                p.hanging = true; G.activePayload = p;
                G.rescuerSwing.x = p.x; G.rescuerSwing.y = p.y;
                G.rescuerSwing.vx = 0; G.rescuerSwing.vy = 0;
                ctx.showMsg(p.type === 'orni_wreck' || p.type === 'crate' ? I18N.CARGO_SECURED : I18N.PATIENT_SECURED);
                G.heli.winch = Math.max(0, G.heli.winch - 0.5);
                break;
            }
        }
    }

    // orni wreck touchdown delivery (low-altitude, no winch)
    if (G.activePayload?.type === 'orni_wreck' && onPad && !onCarrierDeck) {
        const crateZ = G.activePayload.z;
        if (crateZ <= (G.PAD?.z ?? 0) + 0.4) {
            G.activePayload.hanging = false; G.activePayload.rescued = true; G.activePayload = null;
            ctx.orniWreckDelivered();
        }
    }

    // crate touchdown delivery
    if (G.activePayload?.type === 'crate' && onPad) {
        const p = G.activePayload;
        const deliverTo = (p as any).deliverTo as string | undefined;
        const padTypeOk = !deliverTo || (onCarrierDeck ? deliverTo === 'carrier' : deliverTo === 'pad');
        if (padTypeOk) {
            const padSurfaceZ = onCarrierDeck ? G.CARRIER.zDeck : G.PAD.z;
            if ((G.activePayload as any).z <= padSurfaceZ + 0.4) {
                p.hanging = false; p.rescued = true; G.activePayload = null;
                G.totalRescued++;
                ctx.showMsg(I18N.DELIVERED);
                if (G.totalRescued >= G.goalCount) ctx.missionComplete();
            }
        }
    }

    // deposit / winch-in
    if (G.activePayload && G.heli.winch < 0.5) {
        const p = G.activePayload;
        const key = (p as any).isDelivery ? 'delivery' : p.type;
        const handler = _depositHandlers[key] ?? _genericDeposit;
        handler(p, { ctx, onCarrierDeck, onPadSurface });
    }

    // crash detection
    if (!onPad && G.heli.z < G.waterLevel + 0.1 && getGround(G.heli.x, G.heli.y, G.points, G.CARRIER) <= G.waterLevel + 0.01)
        ctx.triggerCrash(I18N.CRASH_WATER);
    if (G.heli.z < groundH + 0.25) {
        if (!onPad && !onFlatTerrain && groundH > G.waterLevel + 0.1) ctx.triggerCrash(I18N.CRASH_BAD_ZONE);
        else if (Math.hypot(G.heli.vx, G.heli.vy) > 0.12) ctx.triggerCrash(I18N.CRASH_TOO_FAST);
        else if (G.heli.vz < -0.15) ctx.triggerCrash(I18N.CRASH_HARD_IMPACT);
    }

    // ── Heli-Heli collision (Multiplayer) ────────────────────────────────────
    if (G.remoteHeli) {
        const dx = G.heli.x - G.remoteHeli.x;
        const dy = G.heli.y - G.remoteHeli.y;
        const dist = Math.sqrt(dx * dx + dy * dy + Math.pow((G.heli.z - G.remoteHeli.z) * 0.5, 2));
        const COLLISION_RADIUS = 1.4;
        if (dist < COLLISION_RADIUS && dist > 0.001) {
            const closingSpeed = Math.hypot(G.heli.vx - G.remoteHeli.vx, G.heli.vy - G.remoteHeli.vy);
            if (closingSpeed > 0.08) {
                ctx.triggerCrash(I18N.CRASH_REMOTE_HELI!);
            } else {
                G.heli.vx += (dx / dist) * 0.04 * dt;
                G.heli.vy += (dy / dist) * 0.04 * dt;
            }
        }
    }
}
