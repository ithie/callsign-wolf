import { campaignHandler } from '../main';
import { G, zstate } from '../state';
import { VESSEL, PAYLOAD, VEHICLE_STATE, RESCUE_ZONE_ROLE, OBJECTIVE_TYPE, VESSEL_PATH, type RescueZone } from '../../shared/types';
import CARRIER_DEF from '../models/carrier.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import { PAYLOAD_DEFS } from '../payload-defs';
import { hapticImpact, hapticNotification, ImpactStyle, NotificationType } from '../haptics';
import { PhysicsCtx } from './ctx';
import { getGround, getCarrierLocal, isFlatTerrain } from './terrain';
import { updateBoats, updateSubmarines, updateCarrierPos, resolveAttachTo } from './world-init';
import { carrierCar } from './vehicles/carrier-car';
import { fuelTruck } from './vehicles/fuel-truck';
import { updateParticles } from './particles';
import { getHeliType } from '../heli-types';
import { voiceEvents } from '../voice-events';

export type { PhysicsCtx };

let _prevKeyR = false;
let _prevKeyQ = false;

const _objectiveDone = (type: string, ctx: PhysicsCtx) => {
    if (!G.objectives.some((o: any) => o.type === type)) return;
    G.completedObjectives.add(type);
    if (G.objectives.every((o: any) => G.completedObjectives.has(o.type))) ctx.missionComplete();
};
let _prevKeyE = false;
let _prevEngineOn = false;
let _prevFuelLow = false;
let _prevCarrierNear = false;
let _prevFrigateNear = false;

const DEF_RESCUE_ZONES: Partial<Record<string, RescueZone[]>> = {
    [VESSEL.CARRIER]:           (CARRIER_DEF.rescueZones           ?? []) as RescueZone[],
    [VESSEL.SUBMARINE]:         (SUBMARINE_DEF.rescueZones         ?? []) as RescueZone[],
    [VESSEL.RESEARCH_PLATFORM]: (RESEARCH_PLATFORM_DEF.rescueZones ?? []) as RescueZone[],
};

const _zonesFor = (vessel: any, type: string | null): RescueZone[] =>
    vessel.rescueZones?.length ? vessel.rescueZones as RescueZone[] :
    (type ? DEF_RESCUE_ZONES[type] ?? [] : []);

const _pointInZone = (wx: number, wy: number, vessel: any, zone: any, wz?: number): boolean => {
    const c = Math.cos(-vessel.angle), s = Math.sin(-vessel.angle);
    const dx = wx - vessel.x, dy = wy - vessel.y;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    if (!( Math.abs(lx - zone.x) <= zone.w && Math.abs(ly - zone.y) <= zone.h)) return false;
    if (zone.z != null && wz != null) {
        const zCenter = G.waterLevel + zone.z;
        return Math.abs(wz - zCenter) <= (zone.dz ?? 0.5);
    }
    return true;
};

const _vesselPickupAllowed = (wx: number, wy: number, vessel: any, type: string): boolean => {
    const zones = _zonesFor(vessel, type);
    if (!zones.length) return true;
    const pickupZones = zones.filter(z => z.role === RESCUE_ZONE_ROLE.PICKUP || z.role === RESCUE_ZONE_ROLE.BOTH);
    if (!pickupZones.length) return true;
    return pickupZones.some(z => _pointInZone(wx, wy, vessel, z));
};

// All droppable vessel collections with their specific deliverTo type (null = accepts any)
const _dropzoneVessels = (): Array<{ vessel: any; type: string | null }> => [
    { vessel: G.CARRIER, type: VESSEL.CARRIER },
    ...G.BOATS.map(v => ({ vessel: v, type: VESSEL.BOAT as string | null })),
    ...G.SUBMARINES.map(v => ({ vessel: v, type: VESSEL.SUBMARINE as string | null })),
    ...G.RESEARCH_PLATFORMS.map(v => ({ vessel: v, type: VESSEL.RESEARCH_PLATFORM as string | null })),
    ...G.WIND_TURBINES.map(v => ({ vessel: v, type: null })),
];

const _inDropzone = (wx: number, wy: number, deliverTo?: string, wz?: number): boolean =>
    _dropzoneVessels().some(({ vessel, type }) => {
        const zones = _zonesFor(vessel, type);
        if (!zones.length) return false;
        const want = !deliverTo || (type !== null && deliverTo === type);
        return want && zones.some(z => z.role !== RESCUE_ZONE_ROLE.PICKUP && _pointInZone(wx, wy, vessel, z, wz));
    });

const _computeLandingState = (ctx: PhysicsCtx, groundH: number) => {
    let onCarrierDeck = false, onPadSurface = false, onFrigateDeck = false;
    let frigateDeckZ = 0;
    if (ctx.hasCarrier) {
        const local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
        if (local.x >= -G.CARRIER.w && local.x <= G.CARRIER.w && local.y >= -G.CARRIER.l && local.y <= G.CARRIER.l)
            onCarrierDeck = true;
    }
    if (ctx.hasPad && G.heli.x >= G.PAD.xMin && G.heli.x <= G.PAD.xMax && G.heli.y >= G.PAD.yMin && G.heli.y <= G.PAD.yMax)
        onPadSurface = true;
    for (const b of G.BOATS) {
        if (b.objectType !== VESSEL.FRIGATE) continue;
        const local = getCarrierLocal(G.heli.x, G.heli.y, b);
        if (Math.abs(local.x) <= 11.0 && Math.abs(local.y) <= 3.0) {
            onFrigateDeck = true;
            frigateDeckZ = b.zDeck;
            break;
        }
    }
    const landingZone = G.LANDING_ZONES.find(lz =>
        G.heli.x >= lz.xMin && G.heli.x <= lz.xMax &&
        G.heli.y >= lz.yMin && G.heli.y <= lz.yMax
    ) ?? null;
    const onPad = onCarrierDeck || onPadSurface || onFrigateDeck || landingZone !== null;
    const effectiveGroundH = landingZone ? landingZone.z
        : onPadSurface && G.PAD ? G.PAD.z
        : onCarrierDeck ? G.CARRIER.zDeck
        : onFrigateDeck ? frigateDeckZ
        : groundH;
    return { onCarrierDeck, onPadSurface, onFrigateDeck, onPad, effectiveGroundH };
};

// Returns the single delivery-target type if exactly one type has dropoff zones; else undefined.
const _singleDropzoneType = (): string | undefined => {
    const types = new Set<string>();
    for (const { vessel, type } of _dropzoneVessels()) {
        if (type && _zonesFor(vessel, type).some(z => z.role !== RESCUE_ZONE_ROLE.PICKUP))
            types.add(type);
    }
    return types.size === 1 ? [...types][0] : undefined;
};

// ─── deposit/winch-in handlers ────────────────────────────────────────────────

interface _DepositState { ctx: PhysicsCtx; onCarrierDeck: boolean; onPadSurface: boolean; onFrigateDeck: boolean; }

const _deliveryDeposit = (p: any, { ctx, onCarrierDeck, onPadSurface, onFrigateDeck }: _DepositState) => {
    const deliverTo = (p as any).deliverTo as string | undefined;
    const effectiveDeliverTo = deliverTo ?? _singleDropzoneType();
    const onCarrierOk  = (!deliverTo || deliverTo === VESSEL.CARRIER)  && onCarrierDeck  && G.heli.z < 3.0;
    const onPadOk      = (!deliverTo || deliverTo === VESSEL.PAD)      && onPadSurface   && G.heli.z < 3.0;
    const onFrigateOk  = (!deliverTo || deliverTo === VESSEL.FRIGATE)  && onFrigateDeck  && G.heli.z < 3.0;
    const inZone = onCarrierOk || onPadOk || onFrigateOk || _inDropzone(p.x, p.y, effectiveDeliverTo, p.z);
    G.payloads.splice(G.payloads.indexOf(p), 1);
    p.hanging = false; p.rescued = true; G.activePayload = null;
    if (inZone) {
        G.totalRescued++;
        voiceEvents.emit('delivered');
        if (G.totalRescued >= G.goalCount) _objectiveDone(OBJECTIVE_TYPE.RESCUE_ALL, ctx);
    } else {
        G.heli.onboard++;
        voiceEvents.emit('no-zone');
        G.heli.winch = 0.6;
    }
    if (G.heli.onboard === 0) G.deliverMode = false;
};

const _personDeposit = (p: any, _state: _DepositState) => {
    if (G.heli.onboard < G.heli.maxLoad) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        G.heli.onboardDeliverQueue.push((p as any).deliverTo as string | undefined);
        G.heli.onboard++;
        hapticNotification(NotificationType.Success);
    } else hapticNotification(NotificationType.Error);
};

const _orniWreckDeposit = (p: any, { ctx, onPadSurface }: _DepositState) => {
    if (onPadSurface && G.heli.z < 3.0) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        ctx.orniWreckDelivered();
    } else {
        voiceEvents.emit('drop-at-pad');
        G.heli.winch = 0.6;
    }
};

const _genericDeposit = (p: any, { ctx, onCarrierDeck, onPadSurface, onFrigateDeck }: _DepositState) => {
    const deliverTo = (p as any).deliverTo as string | undefined;
    const onCarrierOk = (!deliverTo || deliverTo === VESSEL.CARRIER) && onCarrierDeck && G.heli.z < 3.0;
    const onPadOk     = (!deliverTo || deliverTo === VESSEL.PAD)     && onPadSurface  && G.heli.z < 3.0;
    const onFrigateOk = (!deliverTo || deliverTo === VESSEL.FRIGATE) && onFrigateDeck && G.heli.z < 3.0;
    const inZone = _inDropzone(p.x, p.y, deliverTo, p.z) || _inDropzone(G.heli.x, G.heli.y, deliverTo);
    if (onCarrierOk || onPadOk || onFrigateOk || inZone) {
        p.hanging = false; p.rescued = true; G.activePayload = null;
        G.totalRescued++;
        voiceEvents.emit('delivered');
        if (G.totalRescued >= G.goalCount) _objectiveDone(OBJECTIVE_TYPE.RESCUE_ALL, ctx);
    } else {
        voiceEvents.emit('drop-at-pad');
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

export const updateWind = (wind: any, dt: number, ctx: PhysicsCtx) => {
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
    // Unsheltered strength — used by stationary emitters that aren't behind terrain
    wind.rawStr = baseStrength * gust;
}

const _ticksToVesselExit = (v: any, seaTime: number, gridSize: number): number => {
    if (v.path === VESSEL_PATH.STATIC || v.speed === 0) return Infinity;
    const STEP = 60;
    const MAX = 4200;
    if (v.path === VESSEL_PATH.STRAIGHT) {
        for (let t = STEP; t <= MAX; t += STEP) {
            const prog = v.lineProgress + v.speed * t;
            const fx = v.lineStartX + v.lineDirX * prog;
            const fy = v.lineStartY + v.lineDirY * prog;
            if (fx < 0 || fx > gridSize || fy < 0 || fy > gridSize) return t;
        }
    } else {
        for (let t = STEP; t <= MAX; t += STEP) {
            const st = seaTime + v.speed * t;
            const fx = v.centerX + Math.cos(st) * v.radiusX;
            const fy = v.centerY + Math.sin(st) * v.radiusY;
            if (fx < 0 || fx > gridSize || fy < 0 || fy > gridSize) return t;
        }
    }
    return Infinity;
};

const _checkVesselExitWarning = (v: any, seaTime: number, gridSize: number) => {
    if (!v.exitWarning) return;
    const isOutside = v.x < 0 || v.x > gridSize || v.y < 0 || v.y > gridSize;
    if (isOutside) {
        v._wasOutside = true;
    } else if (v._wasOutside) {
        v._wasOutside = false;
        v.exitWarn60 = false;
        v.exitWarn30 = false;
    }
    const ticks = _ticksToVesselExit(v, seaTime, gridSize);
    const name = (v.vesselName || 'VESSEL') as string;
    if (!v.exitWarn30 && ticks <= 1800) {
        v.exitWarn30 = true;
        v.exitWarn60 = true;
        voiceEvents.emit('vessel-leaving-30', name);
    } else if (!v.exitWarn60 && ticks <= 3600) {
        v.exitWarn60 = true;
        voiceEvents.emit('vessel-leaving-60', name);
    }
};

export const updatePhysics = (dt: number, ctx: PhysicsCtx) => {
    const { crashed } = zstate;
    const { gridSize } = campaignHandler.getTerrain();

    updateWind(G.wind, dt, ctx);
    const _frigateSnap = G.BOATS
        .filter((b: any) => b.objectType === VESSEL.FRIGATE)
        .map((b: any) => ({ b, x: b.x, y: b.y, angle: b.angle }));
    updateBoats(G.BOATS, dt);
    if (!crashed) {
        for (const { b, x: oldX, y: oldY, angle: oldAng } of _frigateSnap) {
            const local = getCarrierLocal(G.heli.x, G.heli.y, b);
            if (Math.abs(local.x) <= 11.0 && Math.abs(local.y) <= 3.0 && !G.heli.inAir) {
                const vX = b.x - oldX, vY = b.y - oldY, rot = b.angle - oldAng;
                G.heli.x += vX; G.heli.y += vY;
                const dx = G.heli.x - b.x, dy = G.heli.y - b.y;
                G.heli.x += dx * Math.cos(rot) - dy * Math.sin(rot) - dx;
                G.heli.y += dx * Math.sin(rot) + dy * Math.cos(rot) - dy;
                G.heli.angle += rot;
                G.heli.vx *= Math.pow(0.8, dt); G.heli.vy *= Math.pow(0.8, dt);
            }
        }
    }
    updateSubmarines(G.SUBMARINES, dt);

    if (ctx.hasPad && G.fuelTruck.state !== VEHICLE_STATE.PARKED) fuelTruck.update(dt, ctx);
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

    if (ctx.hasCarrier) _checkVesselExitWarning(G.CARRIER, G.seaTime, gridSize);
    G.SUBMARINES.forEach((s: any) => _checkVesselExitWarning(s, s._seaTime, gridSize));
    G.BOATS.forEach((b: any) => _checkVesselExitWarning(b, b._seaTime, gridSize));

    const groundH = getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
    const { onCarrierDeck, onPadSurface, onFrigateDeck, onPad, effectiveGroundH } = _computeLandingState(ctx, groundH);

    // engine
    const onFlatTerrain = groundH > G.waterLevel + 0.1 && isFlatTerrain(G.heli.x, G.heli.y);
    const _engineWas = G.heli.engineOn;
    if (G.keys['KeyW'] && !G.heli.engineOn && G.heli.fuel > 0 && (onPad || (!G.heli.inAir && onFlatTerrain))) G.heli.engineOn = true;
    if (G.heli.engineOn && !_engineWas && !_prevEngineOn) voiceEvents.emit('liftoff');
    _prevEngineOn = G.heli.engineOn;
    if (G.keys['KeyS'] && !G.heli.inAir && G.heli.engineOn) {
        G.heli.engineOn = false;
        const landObj = G.objectives.find((o: any) => o.type === OBJECTIVE_TYPE.LAND_AT);
        if (landObj) {
            const onTarget =
                (landObj.target === VESSEL.CARRIER && onCarrierDeck) ||
                (landObj.target === VESSEL.PAD && onPadSurface) ||
                (landObj.target === VESSEL.FRIGATE && onFrigateDeck);
            if (onTarget) _objectiveDone(OBJECTIVE_TYPE.LAND_AT, ctx);
        }
    }
    if (ctx.hasPad && onPadSurface && !G.heli.engineOn && !G.heli.inAir && G.heli.rotorRPM < 0.05
        && G.fuelTruck.state === VEHICLE_STATE.PARKED && G.heli.fuel < 99) {
        G.fuelTruck.state = VEHICLE_STATE.DRIVING; G.fuelTruck.t = 0;
    }
    if (ctx.hasCarrier && onCarrierDeck && !G.heli.engineOn && !G.heli.inAir && G.heli.rotorRPM < 0.05
        && G.carrierFuelCar.state === VEHICLE_STATE.PARKED && G.heli.fuel < 99) {
        G.carrierFuelCar.state = VEHICLE_STATE.DRIVING; G.carrierFuelCar.wps = null;
    }
    G.heli.rotorRPM =
        G.heli.engineOn && G.heli.fuel > 0
            ? Math.min(1, G.heli.rotorRPM + 0.005 * dt)
            : Math.max(0, G.heli.rotorRPM - 0.004 * dt);
    G.heli.rotationPos += G.heli.rotorRPM * 0.75 * dt;

    updateParticles({
        ctx: {
            particles: G.particles, debris: G.debris, flocks: G.flocks,
            emitters: G.PARTICLE_EMITTERS, heli: G.heli, wind: G.wind,
            waterLevel: G.waterLevel, gridSize: campaignHandler.getTerrain().gridSize,
            getGround: (x, y) => getGround(x, y, G.points, G.CARRIER),
            getHeliType,
        },
        dt,
    });

    // payload physics
    if (G.activePayload) {
        const p = G.activePayload;
        const isPersonLike = p.type === PAYLOAD.PERSON || p.type === PAYLOAD.RESCUER;
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
        } else {
            G.rescuerSwing.x = G.heli.x; G.rescuerSwing.y = G.heli.y;
            G.rescuerSwing.vx = 0; G.rescuerSwing.vy = 0;
        }
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

    // flight
    const lift = G.heli.rotorRPM > 0.9 ? 1.0 : 0.0;
    const inAir = G.heli.z > effectiveGroundH + 0.15;
    if (!inAir && G.heli.inAir) {
        hapticImpact(ImpactStyle.Medium);
        const _landFrigate = onFrigateDeck ? G.BOATS.find((b: any) => b.objectType === VESSEL.FRIGATE) : null;
        const _deckVoice = (onCarrierDeck && !G.CARRIER.radioSilent) || (onFrigateDeck && !_landFrigate?.radioSilent);
        voiceEvents.emit(_deckVoice ? 'on-the-deck' : 'touchdown');
    }
    G.heli.inAir = inAir;

    // carrier proximity — "deck cleared" on approach
    if (ctx.hasCarrier) {
        const _nearNow = inAir && Math.hypot(G.heli.x - G.CARRIER.x, G.heli.y - G.CARRIER.y) < 25;
        if (_nearNow && !_prevCarrierNear && !G.CARRIER.radioSilent) voiceEvents.emit('deck-cleared');
        _prevCarrierNear = _nearNow;
    } else {
        _prevCarrierNear = false;
    }
    const _frigateNearNow = inAir && G.BOATS.some((b: any) =>
        b.objectType === VESSEL.FRIGATE && Math.hypot(G.heli.x - b.x, G.heli.y - b.y) < 20);
    if (_frigateNearNow && !_prevFrigateNear) {
        const _nearFrigate = G.BOATS.find((b: any) => b.objectType === VESSEL.FRIGATE && Math.hypot(G.heli.x - b.x, G.heli.y - b.y) < 20);
        if (!_nearFrigate?.radioSilent) voiceEvents.emit('deck-cleared');
    }
    _prevFrigateNear = _frigateNearNow;

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
                G.heli.vAngle = -0.045 * mod * aero;
                G.heli.roll = Math.min(G.heli.roll + 0.012 * dt, 0.4); turning = true;
            }
            if (G.keys['ArrowRight']) {
                G.heli.vAngle = 0.045 * mod * aero;
                G.heli.roll = Math.max(G.heli.roll - 0.012 * dt, -0.4); turning = true;
            }
            if (!turning) {
                G.heli.vAngle *= Math.pow(0.9025, dt);
                G.heli.roll *= Math.pow(0.96, dt);
            }
            G.heli.angle += G.heli.vAngle * dt;

            if (G.keys['KeyW']) G.heli.vz += G.heli.liftPower * mod * dt;
            else if (G.keys['KeyS']) G.heli.vz -= 0.002 * dt;
            else G.heli.vz *= Math.pow(0.96, dt);

            if (!ctx.isTutorialFuelLocked) G.heli.fuel -= G.heli.fuelRate * mod * dt;
        } else {
            G.heli.tilt *= Math.pow(0.98, dt);
            G.heli.roll = Math.sin(Date.now() * 0.01) * 0.1;
        }
    }

    if (G.heli.fuel >= 50) _prevFuelLow = false;
    if (G.heli.fuel > 0 && G.heli.fuel < 20 && !_prevFuelLow && inAir && G.heli.engineOn) {
        voiceEvents.emit('bingo-fuel');
        _prevFuelLow = true;
    }

    if (G.heli.fuel <= 0 && inAir) {
        if (G.heli.fuel > -1) G.heli.fuel = -1;
        G.heli.engineOn = false;
        G.heli.vz -= 0.018 * dt;
    }

    G.heli.vx *= Math.pow(G.heli.friction, dt); G.heli.vy *= Math.pow(G.heli.friction, dt);
    if (!inAir) {
        G.heli.vx = 0; G.heli.vy = 0;
    } else {
        G.heli.vx += G.wind.x * 3 * dt; G.heli.vy += G.wind.y * 3 * dt;
    }
    // Guard against NaN propagating into position (pre-existing physics bug: vx/vy can go NaN under certain cargo/wind conditions)
    if (!isFinite(G.heli.vx)) G.heli.vx = 0;
    if (!isFinite(G.heli.vy)) G.heli.vy = 0;
    if (!isFinite(G.heli.vz)) G.heli.vz = 0;
    G.heli.x += G.heli.vx * dt; G.heli.y += G.heli.vy * dt; G.heli.z += G.heli.vz * dt;
    const margin = 2;
    if (G.heli.x < margin) { G.heli.x = margin; G.heli.vx = 0; }
    if (G.heli.x > gridSize - margin) { G.heli.x = gridSize - margin; G.heli.vx = 0; }
    if (G.heli.y < margin) { G.heli.y = margin; G.heli.vy = 0; }
    if (G.heli.y > gridSize - margin) { G.heli.y = gridSize - margin; G.heli.vy = 0; }
    const zMax = 20.0;
    if (G.heli.z > zMax) {
        G.heli.z = zMax; G.heli.vz = 0;
    }
    const vzAtImpact = G.heli.vz;
    if (G.heli.z < effectiveGroundH + 0.1) { G.heli.z = effectiveGroundH + 0.1; G.heli.vz = 0; }

    // winch
    const _keyQ = !!G.keys['KeyQ'];
    const _keyE = !!G.keys['KeyE'];
    if (_keyQ) G.heli.winch = Math.max(0, G.heli.winch - 0.02 * dt);
    if (_keyE) G.heli.winch = Math.min(5.0, G.heli.winch + 0.02 * dt);

    if (_keyE && !_prevKeyE && G.heli.winch < 0.1) voiceEvents.emit('winch-down');
    if (_keyQ && !_prevKeyQ && G.activePayload)     voiceEvents.emit('haul-up');
    _prevKeyE = _keyE;
    _prevKeyQ = _keyQ;
    if (!G.heli.inAir && !G.activePayload) {
        G.heli.winch = 0;
        G.rescuerSwing.x = G.heli.x; G.rescuerSwing.y = G.heli.y;
        G.rescuerSwing.vx = 0;       G.rescuerSwing.vy = 0;
    }
    // clamp: rope can't have slack when payload rests on a surface — only when payload is near ground
    // floor at 0.6 so physics clamping never crosses the deposit threshold involuntarily
    if (G.activePayload?.hanging) {
        const _groundZp = getGround(G.activePayload.x, G.activePayload.y);
        if (G.activePayload.z <= _groundZp + 0.5)
            G.heli.winch = Math.min(G.heli.winch, Math.max(0.6, G.heli.z - G.activePayload.z) + 0.05);
    }

    // deliver-mode toggle (R key — rising edge only)
    const keyR = !!G.keys['KeyR'];
    if (keyR && !_prevKeyR) {
        const ap = G.activePayload as any;
        if ((ap?.type === PAYLOAD.CRATE || ap?.type === PAYLOAD.ORNI_WRECK) && ap.hanging) {
            const loadZ = G.heli.z - G.heli.winch;
            const groundZ = getGround(G.rescuerSwing.x, G.rescuerSwing.y);
            if (loadZ <= groundZ + 0.4) {
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
            vx: 0, vy: 0, type: PAYLOAD.PERSON, rescued: false, hanging: true, isDelivery: true,
            attachTo: null, npcTarget: false, outfitColors: { shirt: '#4488cc', pants: '#223355' },
            deliverTo: G.heli.onboardDeliverQueue.shift(),
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
                    if (p.attachTo.objectType === VESSEL.CARRIER) vessel = G.CARRIER;
                    else if (p.attachTo.objectType === VESSEL.BOAT) vessel = G.BOATS.find((b: any) => b._objIdx === p.attachTo.objectIdx);
                    else if (p.attachTo.objectType === VESSEL.SUBMARINE) vessel = G.SUBMARINES.find((s: any) => s._objIdx === p.attachTo.objectIdx);
                    if (vessel && !_vesselPickupAllowed(G.heli.x, G.heli.y, vessel, p.attachTo.objectType)) continue;
                }
                p.hanging = true; G.activePayload = p;
                G.rescuerSwing.x = p.x; G.rescuerSwing.y = p.y;
                G.rescuerSwing.vx = 0; G.rescuerSwing.vy = 0;
                voiceEvents.emit('package-secured');
                G.heli.winch = Math.max(0.6, G.heli.winch - 0.5);
                break;
            }
        }
    }

    // orni wreck touchdown delivery (low-altitude, no winch)
    if (G.activePayload?.type === PAYLOAD.ORNI_WRECK && onPad && !onCarrierDeck) {
        const crateZ = G.activePayload.z;
        if (crateZ <= (G.PAD?.z ?? 0) + 0.4) {
            G.activePayload.hanging = false; G.activePayload.rescued = true; G.activePayload = null;
            ctx.orniWreckDelivered();
        }
    }

    // crate touchdown delivery
    if (G.activePayload?.type === PAYLOAD.CRATE) {
        const p = G.activePayload;
        const deliverTo = (p as any).deliverTo as string | undefined;
        const padSurfaceZ = onCarrierDeck ? G.CARRIER.zDeck : onFrigateDeck ? (G.BOATS.find((b: any) => b.objectType === VESSEL.FRIGATE)?.zDeck ?? 0) : G.PAD?.z ?? 0;
        const padTypeOk = onPad && (!deliverTo || (onCarrierDeck ? deliverTo === VESSEL.CARRIER : onFrigateDeck ? deliverTo === VESSEL.FRIGATE : deliverTo === VESSEL.PAD));
        const atPad = padTypeOk && (p as any).z <= padSurfaceZ + 0.4;
        const inZone = _inDropzone(p.x, p.y, deliverTo, (p as any).z);
        if (atPad || inZone) {
            p.hanging = false; p.rescued = true; G.activePayload = null;
            G.totalRescued++;
            voiceEvents.emit('delivered');
            if (G.totalRescued >= G.goalCount) _objectiveDone(OBJECTIVE_TYPE.RESCUE_ALL, ctx);
        }
    }

    // landing deposit: persons onboard are offloaded when heli touches down in a valid delivery zone
    if (!G.heli.inAir && G.heli.onboard > 0) {
        const undelivered: (string | undefined)[] = [];
        let countedNow = 0;
        for (const dt of G.heli.onboardDeliverQueue) {
            const eff = dt ?? _singleDropzoneType();
            const valid =
                ((!dt || dt === VESSEL.CARRIER) && onCarrierDeck)  ||
                ((!dt || dt === VESSEL.PAD)     && onPadSurface)   ||
                ((!dt || dt === VESSEL.FRIGATE) && onFrigateDeck)  ||
                _inDropzone(G.heli.x, G.heli.y, eff, G.heli.z);
            if (valid) countedNow++;
            else undelivered.push(dt);
        }
        if (countedNow > 0) {
            G.heli.onboardDeliverQueue = undelivered;
            G.heli.onboard -= countedNow;
            G.totalRescued += countedNow;
            if (G.totalRescued >= G.goalCount) _objectiveDone(OBJECTIVE_TYPE.RESCUE_ALL, ctx);
            else voiceEvents.emit('delivered');
        }
    }

    // deposit / winch-in
    if (G.activePayload && G.heli.winch < 0.5) {
        const p = G.activePayload;
        const key = (p as any).isDelivery ? 'delivery' : p.type;
        const handler = _depositHandlers[key] ?? _genericDeposit;
        handler(p, { ctx, onCarrierDeck, onPadSurface, onFrigateDeck });
    }

    // crash detection
    if (!onPad && G.heli.z <= G.waterLevel + 0.1 && getGround(G.heli.x, G.heli.y, G.points, G.CARRIER) <= G.waterLevel + 0.01)
        ctx.triggerCrash();
    if (G.heli.z < groundH + 0.25) {
        if (!onPad && !onFlatTerrain && groundH > G.waterLevel + 0.1) ctx.triggerCrash();
        else if (Math.hypot(G.heli.vx, G.heli.vy) > 0.12) ctx.triggerCrash();
        else if (vzAtImpact < -0.15) ctx.triggerCrash();
        else if (G.heli.fuel < 0) ctx.triggerCrash();
    }

}
