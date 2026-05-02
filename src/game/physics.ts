import { campaignHandler } from './main';
import { G, zstate } from './state';
import { getHeliType } from './heli-types';
import { I18N } from './i18n';
import { hapticImpact, hapticNotification, ImpactStyle, NotificationType } from './haptics';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

export interface PhysicsCtx {
    windStr: number;
    windDir: number;
    windVar: boolean;
    hasPad: boolean;
    hasCarrier: boolean;
    partyMode?: boolean;
    partyPalette?: readonly string[];
    showMsg: (txt: string) => void;
    missionComplete: () => void;
    triggerCrash: (reason: string) => void;
}

// ─── object helpers (private) ─────────────────────────────────────────────────
function getObjects() {
    return campaignHandler.getCurrentMissionData().objects || [];
}
function getObjectByType(type: string) {
    return getObjects().find((o: any) => o.type === type) || null;
}
function getObjectsByType(type: string) {
    return getObjects().filter((o: any) => o.type === type);
}

// ─── grid / terrain ──────────────────────────────────────────────────────────
export function initGrid(size: number, points: number[][]) {
    for (let x = 0; x <= size; x++) {
        points[x] = [];
        for (let y = 0; y <= size; y++) points[x][y] = 0;
    }
}

export function generateTerrain(
    points: number[][],
    PAD: { xMin: number; xMax: number; yMin: number; yMax: number; z: number } | null
) {
    const { terrain, gridSize } = campaignHandler.getTerrain();
    for (let x = 0; x <= gridSize; x++) {
        for (let y = 0; y <= gridSize; y++) {
            if (PAD && x >= PAD.xMin && x <= PAD.xMax + 1 && y >= PAD.yMin && y <= PAD.yMax + 1) points[x][y] = PAD.z;
            else points[x][y] = terrain[x][y];
        }
    }
}

export function getGround(fx: number, fy: number, points = G.points, CARRIER = G.CARRIER) {
    if (CARRIER && CARRIER.x !== undefined) {
        let local = getCarrierLocal(fx, fy, CARRIER);
        if (local.x >= -CARRIER.w && local.x <= CARRIER.w && local.y >= -CARRIER.l && local.y <= CARRIER.l) {
            if (local.x > -5.5 && local.x < -1.0 && local.y > 2.6 && local.y < 4.1) return CARRIER.zDeck + 1.2;
            return CARRIER.zDeck;
        }
    }
    for (const s of G.SUBMARINES) {
        const dx = fx - s.x, dy = fy - s.y;
        const cosA = Math.cos(-s.angle), sinA = Math.sin(-s.angle);
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        if (Math.abs(lx) <= s.w && Math.abs(ly) <= s.l) return s.zDeck;
    }
    const { gridSize } = campaignHandler.getTerrain();
    let x1 = Math.floor(fx),
        y1 = Math.floor(fy);
    if (x1 < 0 || y1 < 0 || x1 >= gridSize - 1 || y1 >= gridSize - 1) return -1.0;
    if (!points[x1] || !points[x1 + 1]) return -1.0;
    let tX = fx - x1,
        tY = fy - y1;
    if (x1 + 1 < gridSize && y1 + 1 < gridSize) {
        return (
            points[x1][y1] * (1 - tX) * (1 - tY) +
            points[x1 + 1][y1] * tX * (1 - tY) +
            points[x1 + 1][y1 + 1] * tX * tY +
            points[x1][y1 + 1] * (1 - tX) * tY
        );
    }
    return 0;
}

function getCarrierLocal(globX: number, globY: number, CARRIER = G.CARRIER) {
    let dx = globX - CARRIER.x,
        dy = globY - CARRIER.y;
    let ang = -CARRIER.angle;
    return {
        x: dx * Math.cos(ang) - dy * Math.sin(ang),
        y: dx * Math.sin(ang) + dy * Math.cos(ang),
    };
}

// ─── vessel local-offset helper ──────────────────────────────────────────────
const _applyVesselOffset = (vessel: any, localX: number, localY: number) => {
    const c = Math.cos(vessel.angle), s = Math.sin(vessel.angle);
    return { x: vessel.x + localX * c - localY * s, y: vessel.y + localX * s + localY * c };
};

// ─── deliver-mode helpers ────────────────────────────────────────────────────
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

const _inDropzone = (wx: number, wy: number): boolean => {
    if (G.CARRIER?.rescueZones?.length) {
        for (const z of G.CARRIER.rescueZones) {
            if (z.role === 'pickup') continue;
            if (_pointInVesselZone(wx, wy, G.CARRIER, z)) return true;
        }
    }
    for (const boat of G.BOATS) {
        if (!boat.rescueZones?.length) continue;
        for (const z of boat.rescueZones) {
            if (z.role === 'pickup') continue;
            if (_pointInVesselZone(wx, wy, boat, z)) return true;
        }
    }
    for (const sub of G.SUBMARINES) {
        if (!sub.rescueZones?.length) continue;
        for (const z of sub.rescueZones) {
            if (z.role === 'pickup') continue;
            if (_pointInVesselZone(wx, wy, sub, z)) return true;
        }
    }
    return false;
};

// ─── carrier ────────────────────────────────────────────────────────────────
export function updateCarrierPos(CARRIER: any, seaTimeRef: any, forceUpdate = false, dt = 1) {
    if (!CARRIER || CARRIER.x === undefined) return;
    if (CARRIER.path === 'static') return;

    if (CARRIER.path === 'straight') {
        if (!forceUpdate) {
            CARRIER.lineProgress += CARRIER.speed * dt;
            const nx = CARRIER.lineStartX + CARRIER.lineDirX * CARRIER.lineProgress;
            const ny = CARRIER.lineStartY + CARRIER.lineDirY * CARRIER.lineProgress;
            const dx = nx - CARRIER.x,
                dy = ny - CARRIER.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) CARRIER.angle = Math.atan2(dy, dx);
            CARRIER.x = nx;
            CARRIER.y = ny;
        }
    } else {
        if (!forceUpdate) seaTimeRef.t += CARRIER.speed * dt;
        const nx = CARRIER.centerX + Math.cos(seaTimeRef.t) * CARRIER.radiusX;
        const ny = CARRIER.centerY + Math.sin(seaTimeRef.t) * CARRIER.radiusY;
        if (forceUpdate) {
            // tangent direction: dx/dt = -radiusX*sin(t), dy/dt = radiusY*cos(t)
            CARRIER.angle = Math.atan2(
                CARRIER.radiusY * Math.cos(seaTimeRef.t),
                -CARRIER.radiusX * Math.sin(seaTimeRef.t)
            );
        } else {
            const dx = nx - CARRIER.x,
                dy = ny - CARRIER.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) CARRIER.angle = Math.atan2(dy, dx);
        }
        CARRIER.x = nx;
        CARRIER.y = ny;
    }
}

function initVessel(obj: any, vessel: any, seaTimeRef: { t: number }) {
    const angleRad = (obj.angle ?? 0) * (Math.PI / 180);
    vessel.w = obj.type === 'carrier' ? 8.0 : 1.5;
    vessel.l = obj.type === 'carrier' ? 3.5 : 3.0;
    vessel.zDeck = obj.type === 'carrier' ? 4.2 : 0.35;
    vessel.zHull = obj.type === 'carrier' ? 3.8 : 0.15;
    vessel.path = obj.path ?? 'static';
    const knotsToUnits = 0.001663;
    if (obj.path === 'straight') {
        vessel.speed = (obj.speed ?? 0) * knotsToUnits;
    } else {
        const r = obj.radius ?? 45;
        vessel.speed = ((obj.speed ?? 0) * knotsToUnits) / r;
    }
    if (obj.path === 'circle') {
        const r = obj.radius ?? 45;
        vessel.radiusX = r;
        vessel.radiusY = r * 0.8;
        const t0 = Math.atan2(-Math.sin(angleRad) / vessel.radiusX, -Math.cos(angleRad) / vessel.radiusY) + Math.PI / 2;
        vessel.centerX = obj.x - Math.cos(t0) * vessel.radiusX;
        vessel.centerY = obj.y - Math.sin(t0) * vessel.radiusY;
        seaTimeRef.t = t0;
        vessel.x = vessel.centerX + Math.cos(t0) * vessel.radiusX;
        vessel.y = vessel.centerY + Math.sin(t0) * vessel.radiusY;
        // tangent at t0: dx/dt = -radiusX*sin(t0), dy/dt = radiusY*cos(t0)
        vessel.angle = Math.atan2(vessel.radiusY * Math.cos(t0), -vessel.radiusX * Math.sin(t0));
    } else if (obj.path === 'straight') {
        vessel.x = obj.x;
        vessel.y = obj.y;
        vessel.angle = angleRad;
        vessel.lineStartX = obj.x;
        vessel.lineStartY = obj.y;
        vessel.lineDirX = Math.cos(angleRad);
        vessel.lineDirY = Math.sin(angleRad);
        vessel.lineProgress = 0;
        console.log(
            'initVessel straight:',
            obj.type,
            'angle:',
            obj.angle,
            'angleRad:',
            angleRad,
            'lineDirX:',
            vessel.lineDirX,
            'lineDirY:',
            vessel.lineDirY
        );
    } else {
        vessel.x = obj.x;
        vessel.y = obj.y;
        vessel.angle = angleRad;
    }
}

export function initCarrierFromMission() {
    const carrierObj = getObjectByType('carrier');
    if (!carrierObj) return;
    const seaTimeRef = {
        get t() {
            return G.seaTime;
        },
        set t(v) {
            G.seaTime = v;
        },
    };
    initVessel(carrierObj, G.CARRIER, seaTimeRef);
    updateCarrierPos(G.CARRIER, seaTimeRef, true);
}

export function initSubmarinesFromMission() {
    const allObjects = getObjects();
    G.SUBMARINES = getObjectsByType('submarine').map((obj: any) => {
        const objIdx = allObjects.indexOf(obj);
        const s = {
            x: obj.x,
            y: obj.y,
            angle: 0,
            path: 'static',
            speed: 0,
            w: 0.7,
            l: 5.4,
            zDeck: 0.25,
            zHull: 0,
            rescueZones: (obj as any).rescueZones || [],
            radiusX: 0,
            radiusY: 0,
            centerX: 0,
            centerY: 0,
            lineStartX: 0,
            lineStartY: 0,
            lineDirX: 0,
            lineDirY: 0,
            lineProgress: 0,
            _seaTime: 0,
            _objIdx: objIdx,
        };
        const st = {
            get t() { return s._seaTime; },
            set t(v) { s._seaTime = v; },
        };
        initVessel(obj, s, st);
        return s;
    });
}

export function updateSubmarines(SUBMARINES: any[], dt: number) {
    SUBMARINES.forEach(s => {
        if (s.path === 'straight') {
            s.lineProgress += s.speed * dt;
            const nx = s.lineStartX + s.lineDirX * s.lineProgress;
            const ny = s.lineStartY + s.lineDirY * s.lineProgress;
            const dx = nx - s.x, dy = ny - s.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) s.angle = Math.atan2(dy, dx);
            s.x = nx;
            s.y = ny;
        } else if (s.path === 'circle') {
            s._seaTime += s.speed * dt;
            const nx = s.centerX + Math.cos(s._seaTime) * s.radiusX;
            const ny = s.centerY + Math.sin(s._seaTime) * s.radiusY;
            const dx = nx - s.x, dy = ny - s.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) s.angle = Math.atan2(dy, dx);
            s.x = nx;
            s.y = ny;
        }
    });
}

export function initBoatsFromMission() {
    const allObjects = getObjects();
    G.BOATS = getObjectsByType('boat').map((obj: any) => {
        const objIdx = allObjects.indexOf(obj);
        const b = {
            x: obj.x,
            y: obj.y,
            angle: 0,
            path: 'static',
            speed: 0,
            w: 1.5,
            l: 3.0,
            zDeck: 0.35,
            zHull: 0.15,
            radiusX: 0,
            radiusY: 0,
            centerX: 0,
            centerY: 0,
            lineStartX: 0,
            lineStartY: 0,
            lineDirX: 0,
            lineDirY: 0,
            lineProgress: 0,
            _seaTime: 0,
            _objIdx: objIdx,
        };
        const st = {
            get t() {
                return b._seaTime;
            },
            set t(v) {
                b._seaTime = v;
            },
        };
        initVessel(obj, b, st);
        return b;
    });
}

export function updateBoats(BOATS: any[], dt: number) {
    BOATS.forEach(b => {
        if (b.path === 'straight') {
            b.lineProgress += b.speed * dt;
            const nx = b.lineStartX + b.lineDirX * b.lineProgress;
            const ny = b.lineStartY + b.lineDirY * b.lineProgress;
            const dx = nx - b.x,
                dy = ny - b.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) b.angle = Math.atan2(dy, dx);
            b.x = nx;
            b.y = ny;
        } else if (b.path === 'circle') {
            b._seaTime += b.speed * dt;
            const nx = b.centerX + Math.cos(b._seaTime) * b.radiusX;
            const ny = b.centerY + Math.sin(b._seaTime) * b.radiusY;
            const dx = nx - b.x,
                dy = ny - b.y;
            if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) b.angle = Math.atan2(dy, dx);
            b.x = nx;
            b.y = ny;
        }
    });
}

// ─── payloads ─────────────────────────────────────────────────────────────────
export function initPayloadsFromMission() {
    const missionData = campaignHandler.getCurrentMissionData();
    G.objectives = missionData.objectives || [];
    const { payloads: missionPayloads } = missionData;
    if (!missionPayloads || !missionPayloads.length) {
        G.payloads = [];
        G.goalCount = 0;
        return;
    }
    G.payloads = missionPayloads.map((p: any) => {
        let px = p.x,
            py = p.y;
        if (p.attachTo) {
            const lx = p.attachTo.localX ?? 0, ly = p.attachTo.localY ?? 0;
            if (p.attachTo.objectType === 'carrier' && G.CARRIER && G.CARRIER.x !== undefined) {
                const wp = _applyVesselOffset(G.CARRIER, lx, ly);
                px = wp.x; py = wp.y;
            } else if (p.attachTo.objectType === 'boat') {
                const attachedBoat = G.BOATS.find((b: any) => b._objIdx === p.attachTo!.objectIdx);
                if (attachedBoat) {
                    const wp = _applyVesselOffset(attachedBoat, lx, ly);
                    px = wp.x; py = wp.y;
                }
            } else if (p.attachTo.objectType === 'submarine') {
                const attachedSub = G.SUBMARINES.find((s: any) => s._objIdx === p.attachTo!.objectIdx);
                if (attachedSub) {
                    const wp = _applyVesselOffset(attachedSub, lx, ly);
                    px = wp.x; py = wp.y;
                }
            }
        }
        const SURVIVOR_OUTFITS = [
            { shirt: '#e74c3c', pants: '#2c3e50' },
            { shirt: '#3498db', pants: '#1a252f' },
            { shirt: '#2ecc71', pants: '#2c3e50' },
            { shirt: '#f39c12', pants: '#2c3e50' },
            { shirt: '#9b59b6', pants: '#2c3e50' },
            { shirt: '#e8e8e8', pants: '#555555' },
            { shirt: '#e67e22', pants: '#1a5276' },
            { shirt: '#c0392b', pants: '#17202a' },
        ];
        return {
            x: px,
            y: py,
            z: getGround(px, py, G.points, G.CARRIER),
            vx: 0,
            vy: 0,
            type: p.type,
            rescued: false,
            hanging: false,
            attachTo: p.attachTo || null,
            npcTarget: p.npcTarget ?? false,
            outfitColors:
                p.type === 'person' ? SURVIVOR_OUTFITS[Math.floor(Math.random() * SURVIVOR_OUTFITS.length)] : null,
        };
    });
    G.goalCount = G.payloads.filter((p: any) => !p.npcTarget).length;
    G.totalRescued = 0;
    G.activePayload = null;
}

// ─── wind ─────────────────────────────────────────────────────────────────────
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

    // Terrain shelter: sample terrain 3 tiles upwind from the heli.
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

// ─── debris ───────────────────────────────────────────────────────────────────
export function spawnExplosion(heli: any, particles: any[], debris: any[], points: number[][], CARRIER: any) {
    const impactSpeed = Math.hypot(heli.vx, heli.vy, heli.vz || 0);
    const intensity = Math.min(1.0, impactSpeed / 0.25);
    const count = Math.floor(30 + intensity * 80);
    const x = heli.x,
        y = heli.y,
        z = Math.max(heli.z, getGround(heli.x, heli.y, points, CARRIER) + 0.1);
    const fwdX = impactSpeed > 0.01 ? heli.vx / impactSpeed : 0;
    const fwdY = impactSpeed > 0.01 ? heli.vy / impactSpeed : 0;

    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = (Math.random() - 0.3) * Math.PI;
        const spd = (0.04 + Math.random() * 0.12) * (0.5 + intensity * 0.5);
        const isFire = Math.random() < 0.6;
        const biasFwd = 0.5 + Math.random() * 0.5;
        particles.push({
            x,
            y,
            z: z + Math.random() * 0.3,
            vx: Math.cos(a) * Math.cos(el) * spd + fwdX * impactSpeed * biasFwd,
            vy: Math.sin(a) * Math.cos(el) * spd + fwdY * impactSpeed * biasFwd,
            vz: Math.sin(el) * spd * 0.5 + 0.05,
            gravity: -0.004,
            size: isFire ? 4 + Math.random() * 6 : 3 + Math.random() * 8,
            life: 0.6 + Math.random() * 0.8,
            maxLife: 1.0,
            color: isFire
                ? `${220 + Math.floor(Math.random() * 35)}, ${Math.floor(Math.random() * 120)}, 0`
                : `${80 + Math.floor(Math.random() * 60)}, ${70 + Math.floor(Math.random() * 40)}, ${60 + Math.floor(Math.random() * 40)}`,
            isSmoke: !isFire,
        });
    }

    const shrapnel = Math.floor(15 + intensity * 30);
    for (let i = 0; i < shrapnel; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 0.05 + Math.random() * 0.2 * intensity;
        const biasFwd = 0.3 + Math.random() * 0.7;
        particles.push({
            x,
            y,
            z: z + Math.random() * 0.2,
            vx: Math.cos(a) * spd + fwdX * impactSpeed * biasFwd * 1.2,
            vy: Math.sin(a) * spd + fwdY * impactSpeed * biasFwd * 1.2,
            vz: 0.02 + Math.random() * 0.1,
            gravity: -0.008,
            size: 2,
            life: 1.0 + Math.random() * 1.5,
            maxLife: 2.0,
            color: `${180 + Math.floor(Math.random() * 60)}, ${160 + Math.floor(Math.random() * 40)}, ${100 + Math.floor(Math.random() * 50)}`,
            isMetal: true,
        });
    }

    const _ht = getHeliType(heli.type);
    const scale = _ht.scale;
    const parts = [
        { name: 'fuselage', color: '#ff6600', stroke: '#dd3300', w: 1.5 * scale, h: 0.4 * scale },
        { name: 'tail', color: '#ff6600', stroke: '#dd3300', w: 1.0 * scale, h: 0.2 * scale },
        { name: 'rotor1', color: '#333', stroke: '#555', w: 1.8 * scale, h: 0.08 * scale },
        { name: 'rotor2', color: '#333', stroke: '#555', w: 1.8 * scale, h: 0.08 * scale },
        { name: 'door', color: '#cc4400', stroke: '#aa2200', w: 0.5 * scale, h: 0.4 * scale },
    ];
    if (_ht.extraRotorDebris) parts.push({ name: 'rotor3', color: '#333', stroke: '#555', w: 1.8, h: 0.08 });

    parts.forEach(part => {
        const a = Math.random() * Math.PI * 2;
        const spd = (0.03 + Math.random() * 0.1) * (0.4 + intensity * 0.6);
        const biasFwd = 0.4 + Math.random() * 0.6;
        debris.push({
            x,
            y,
            z: z + 0.1 + Math.random() * 0.4,
            vx: Math.cos(a) * spd * 0.4 + fwdX * impactSpeed * biasFwd,
            vy: Math.sin(a) * spd * 0.4 + fwdY * impactSpeed * biasFwd,
            vz: 0.03 + Math.random() * 0.08 * intensity,
            angle: heli.angle + (Math.random() - 0.5),
            av: (Math.random() - 0.5) * 0.15 * (0.5 + intensity),
            w: part.w,
            h: part.h,
            color: part.color,
            stroke: part.stroke,
            life: 3.0 + Math.random() * 2.0,
            bounced: false,
        });
    });

    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            for (let j = 0; j < 3; j++) {
                const a = Math.random() * Math.PI * 2;
                particles.push({
                    x: x + Math.cos(a) * 0.3,
                    y: y + Math.sin(a) * 0.3,
                    z: z + Math.random() * 0.5,
                    vx: (Math.random() - 0.5) * 0.01,
                    vy: (Math.random() - 0.5) * 0.01,
                    vz: 0.01 + Math.random() * 0.02,
                    gravity: 0,
                    size: 6 + Math.random() * 10,
                    life: 0.4 + Math.random() * 0.4,
                    maxLife: 0.8,
                    color: `${60 + Math.floor(Math.random() * 40)}, ${55 + Math.floor(Math.random() * 30)}, ${50 + Math.floor(Math.random() * 30)}`,
                    isSmoke: true,
                });
            }
        }, i * 120);
    }
}

export function updateDebris() {
    G.debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.z += d.vz;
        d.vz += d.gravity !== undefined ? d.gravity : -0.006;
        d.angle += d.av;
        d.av *= 0.98;
        d.life -= 0.016;
        const gz = getGround(d.x, d.y, G.points, G.CARRIER);
        if (d.z <= gz) {
            d.z = gz;
            d.vz = Math.abs(d.vz) * 0.25;
            d.vx *= 0.6;
            d.vy *= 0.6;
            d.av *= 0.4;
            if (!d.bounced) {
                G.particles.push({
                    x: d.x,
                    y: d.y,
                    z: gz + 0.05,
                    vx: (Math.random() - 0.5) * 0.03,
                    vy: (Math.random() - 0.5) * 0.03,
                    vz: 0.015,
                    gravity: 0,
                    size: 4,
                    life: 0.3,
                    maxLife: 0.3,
                    color: '150,130,100',
                    isSmoke: true,
                });
                d.bounced = true;
            }
        }
    });
    G.debris = G.debris.filter(d => d.life > 0);
}

// ─── birds ────────────────────────────────────────────────────────────────────
export function initBirds() {
    G.flocks = [];
    const { gridSize } = campaignHandler.getTerrain();
    const numFlocks = 2 + Math.floor(Math.random() * 2);
    const spawnCx = G.START_POS ? G.START_POS.x : gridSize / 2;
    const spawnCy = G.START_POS ? G.START_POS.y : gridSize / 2;
    for (let f = 0; f < numFlocks; f++) {
        let fx = 0,
            fy = 0;
        let found = false;
        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 5 + Math.random() * 18;
            fx = spawnCx + Math.cos(angle) * dist;
            fy = spawnCy + Math.sin(angle) * dist;
            fx = Math.max(3, Math.min(gridSize - 3, fx));
            fy = Math.max(3, Math.min(gridSize - 3, fy));
            if (getGround(fx, fy, G.points, G.CARRIER) > 0.2) {
                found = true;
                break;
            }
        }
        if (!found) {
            fx = 5 + Math.random() * (gridSize - 10);
            fy = 5 + Math.random() * (gridSize - 10);
        }
        const fz = 3 + Math.random() * 5;
        const baseAngle = Math.random() * Math.PI * 2;
        const spd = 0.012 + Math.random() * 0.008;
        const count = 4 + Math.floor(Math.random() * 6);
        const birds = [];
        for (let i = 0; i < count; i++) {
            birds.push({
                x: fx + (Math.random() - 0.5) * 3,
                y: fy + (Math.random() - 0.5) * 3,
                z: fz + (Math.random() - 0.5) * 0.8,
                vx: Math.cos(baseAngle) * spd,
                vy: Math.sin(baseAngle) * spd,
                vz: 0,
                wingPhase: Math.random() * Math.PI * 2,
            });
        }
        G.flocks.push({ birds, fleeing: false, fleeTimer: 0 });
    }
}

export function updateBirds() {
    const { gridSize } = campaignHandler.getTerrain();
    G.flocks.forEach((flock: any) => {
        const cx = flock.birds.reduce((s: number, b: any) => s + b.x, 0) / flock.birds.length;
        const cy = flock.birds.reduce((s: number, b: any) => s + b.y, 0) / flock.birds.length;
        const distToHeli = Math.hypot(G.heli.x - cx, G.heli.y - cy);
        const heliLoud = G.heli.rotorRPM > 0.3;
        if (heliLoud && distToHeli < 8) {
            flock.fleeing = true;
            flock.fleeTimer = 180;
        }
        if (flock.fleeTimer > 0) flock.fleeTimer--;
        else flock.fleeing = false;

        const flockAngle = Math.atan2(
            flock.birds.reduce((s: number, b: any) => s + b.vy, 0),
            flock.birds.reduce((s: number, b: any) => s + b.vx, 0)
        );
        const baseSpd = flock.fleeing ? 0.035 : 0.014;

        flock.birds.forEach((bird: any) => {
            let targetAngle = flockAngle;
            if (flock.fleeing) {
                const awayAngle = Math.atan2(bird.y - G.heli.y, bird.x - G.heli.x);
                targetAngle = awayAngle + (Math.random() - 0.5) * 0.5;
            } else {
                targetAngle += (Math.random() - 0.5) * 0.04 + G.wind.x * 0.08;
            }

            const toCx = cx - bird.x,
                toCy = cy - bird.y;
            const cohesion = 0.0003;
            bird.vx += toCx * cohesion + Math.cos(targetAngle) * 0.001;
            bird.vy += toCy * cohesion + Math.sin(targetAngle) * 0.001;

            const spd = Math.hypot(bird.vx, bird.vy);
            if (spd > 0.001) {
                bird.vx = (bird.vx / spd) * baseSpd;
                bird.vy = (bird.vy / spd) * baseSpd;
            }

            const gz = getGround(bird.x, bird.y, G.points, G.CARRIER);
            const targetZ = gz + 4 + Math.sin(bird.wingPhase * 0.3) * 0.5;
            bird.vz += (targetZ - bird.z) * 0.05;
            bird.vz *= 0.85;

            bird.x += bird.vx;
            bird.y += bird.vy;
            bird.z += bird.vz;
            bird.wingPhase += flock.fleeing ? 0.4 : 0.2;

            if (bird.x < 3) bird.vx += 0.005;
            if (bird.x > gridSize - 3) bird.vx -= 0.005;
            if (bird.y < 3) bird.vy += 0.005;
            if (bird.y > gridSize - 3) bird.vy -= 0.005;
        });
    });
}

// ─── particles ────────────────────────────────────────────────────────────────
function getRotorPositions() {
    const cosA = Math.cos(G.heli.angle),
        sinA = Math.sin(G.heli.angle);
    return getHeliType(G.heli.type).rotorOffsets.map((ox: number) => ({
        x: G.heli.x + cosA * ox,
        y: G.heli.y + sinA * ox,
    }));
}

export function handleParticles(dt: number, ctx: PhysicsCtx) {
    const gH = getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
    const rotors = getRotorPositions();
    if (G.heli.rotorRPM > 0.8) {
        if (!_IS_APP && ctx.partyMode) {
            rotors.forEach((rotor: any) => {
                for (let i = 0; i < 3; i++) {
                    const a = Math.random() * Math.PI * 2;
                    const col = ctx.partyPalette![Math.floor(Math.random() * ctx.partyPalette!.length)];
                    const r = parseInt(col.slice(1, 3), 16),
                        g2 = parseInt(col.slice(3, 5), 16),
                        b = parseInt(col.slice(5, 7), 16);
                    G.particles.push({
                        x: rotor.x + Math.cos(a) * 0.5,
                        y: rotor.y + Math.sin(a) * 0.5,
                        z: G.heli.z - 0.3 + Math.random() * 0.6,
                        vx: Math.cos(a) * 0.12,
                        vy: Math.sin(a) * 0.12,
                        vz: 0.02 + Math.random() * 0.06,
                        gravity: -0.003,
                        size: 2,
                        life: 0.8 + Math.random() * 0.4,
                        color: `${r}, ${g2}, ${b}`,
                        isConfetti: true,
                    });
                }
            });
        } else if (G.heli.z < 2.5 && gH > 0.1) {
            rotors.forEach((rotor: any) => {
                const a = Math.random() * Math.PI * 2;
                G.particles.push({
                    x: rotor.x + Math.cos(a) * 0.6,
                    y: rotor.y + Math.sin(a) * 0.6,
                    z: gH + 0.1,
                    vx: Math.cos(a) * 0.06,
                    vy: Math.sin(a) * 0.06,
                    life: 0.5,
                    color: '150, 140, 120',
                });
            });
        } else if (G.heli.z < 2.0 && gH < 0.1) {
            rotors.forEach((rotor: any) => {
                for (let i = 0; i < 2; i++) {
                    const a = Math.random() * Math.PI * 2;
                    G.particles.push({
                        x: rotor.x + Math.cos(a) * 0.6,
                        y: rotor.y + Math.sin(a) * 0.6,
                        z: 0,
                        vx: Math.cos(a) * 0.08,
                        vy: Math.sin(a) * 0.08,
                        life: 0.4,
                        color: '200, 230, 255',
                    });
                }
            });
        }
    }
    if (!_IS_APP && ctx.partyMode && G.TREES_MAP && G.TREES_MAP.length > 0) {
        const emit = Math.min(4, Math.ceil(G.TREES_MAP.length / 8));
        for (let i = 0; i < emit; i++) {
            const t = G.TREES_MAP[Math.floor(Math.random() * G.TREES_MAP.length)];
            const topZ = (t.gz ?? 0) + (t.s ?? 1) * 2.2;
            const col = ctx.partyPalette![Math.floor(Math.random() * ctx.partyPalette!.length)];
            const [pr, pg, pb] = [
                parseInt(col.slice(1, 3), 16),
                parseInt(col.slice(3, 5), 16),
                parseInt(col.slice(5, 7), 16),
            ];
            G.particles.push({
                x: t.x + (Math.random() - 0.5) * 0.4,
                y: t.y + (Math.random() - 0.5) * 0.4,
                z: topZ,
                vx: G.wind.x * 0.4 + (Math.random() - 0.5) * 0.03,
                vy: G.wind.y * 0.4 + (Math.random() - 0.5) * 0.03,
                vz: 0.04 + Math.random() * 0.05,
                gravity: -0.004,
                size: 2,
                life: 1.0 + Math.random() * 0.5,
                color: `${pr}, ${pg}, ${pb}`,
                isConfetti: true,
            });
        }
    }

    G.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.02 * dt;
    });
    G.particles = G.particles.filter(p => p.life > 0);
}

// ─── Fuel Truck ───────────────────────────────────────────────────────────────
export function initFuelTruck() {
    if (!G.PAD) return;
    const ft = G.fuelTruck;
    ft.parkX = G.PAD.xMax - 5.2;
    ft.parkY = G.PAD.yMin + 0.1;
    ft.parkAngle = Math.PI * 0.5;
    ft.x = ft.parkX;
    ft.y = ft.parkY;
    ft.angle = ft.parkAngle;
    ft.state = 'PARKED';
    ft.arm = 0;
    ft.t = 0;
    ft.wps = null;
    ft.wpI = 0;
}

export function updateFuelTruck(dt: number, ctx: PhysicsCtx) {
    if (!G.PAD) return;
    const ft = G.fuelTruck;
    const heli = G.heli;

    const SPEED = 0.045;
    const SPEED_REV = 0.028;
    const MAX_STEER = 0.025;
    const STOP_DIST = 3.5;

    const HB = {
        x0: G.PAD.xMax - 4.5,
        x1: G.PAD.xMax + 0.5,
        y0: G.PAD.yMin - 0.5,
        y1: G.PAD.yMin + 2.5,
    };

    function hangarForce() {
        const cx = Math.max(HB.x0, Math.min(HB.x1, ft.x));
        const cy = Math.max(HB.y0, Math.min(HB.y1, ft.y));
        const dx = ft.x - cx,
            dy = ft.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01 || dist > 3.0) return [0, 0];
        const s = Math.min(4.0, 1.5 / dist);
        return [(dx / dist) * s, (dy / dist) * s];
    }

    function navigate(tx: number, ty: number) {
        const dx = tx - ft.x,
            dy = ty - ft.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01) return 0;
        const [fx, fy] = hangarForce();
        const ax = dx / dist + fx;
        const ay = dy / dist + fy;
        const desired = Math.atan2(ay, ax);
        const diff = ((desired - ft.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        ft.angle += Math.max(-MAX_STEER * dt, Math.min(MAX_STEER * dt, diff));
        ft.x += Math.cos(ft.angle) * SPEED * dt;
        ft.y += Math.sin(ft.angle) * SPEED * dt;
        return dist;
    }

    // Reverse: front points away from target so rear tracks toward it; moves backward.
    const reverseNavigate = (tx: number, ty: number): number => {
        const dx = tx - ft.x, dy = ty - ft.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01) return 0;
        const desired = Math.atan2(dy, dx) + Math.PI;
        const diff = ((desired - ft.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        ft.angle += Math.max(-MAX_STEER * dt, Math.min(MAX_STEER * dt, diff));
        ft.x -= Math.cos(ft.angle) * SPEED_REV * dt;
        ft.y -= Math.sin(ft.angle) * SPEED_REV * dt;
        return dist;
    };

    if (ft.state === 'DRIVING') {
        if (!ft.wps) ft.wps = [];
        const lastWp = ft.wps[ft.wps.length - 1];
        if (!lastWp || Math.hypot(ft.x - lastWp.x, ft.y - lastWp.y) >= 1.5) {
            ft.wps.push({ x: ft.x, y: ft.y });
        }
        if (navigate(heli.x, heli.y) <= STOP_DIST) {
            ft.state = 'ARM_OUT';
            ft.t = 0;
        }
    } else if (ft.state === 'ARM_OUT') {
        ft.t = Math.min(1, ft.t + 0.016 * dt);
        ft.arm = ft.t;
        if (ft.t >= 1) {
            ft.state = 'FUELING';
            ft.t = 0;
        }
    } else if (ft.state === 'FUELING') {
        if (heli.fuel < 100) {
            heli.fuel = Math.min(100, heli.fuel + 0.25 * dt);
        } else {
            ft.state = 'ARM_IN';
            ft.t = 0;
        }
        if (heli.onboard > 0) {
            G.totalRescued += heli.onboard;
            heli.onboard = 0;
            if (G.totalRescued >= G.goalCount) ctx.missionComplete();
            else ctx.showMsg(I18N.SECURED(G.totalRescued, G.goalCount));
        }
    } else if (ft.state === 'ARM_IN') {
        ft.t = Math.min(1, ft.t + 0.016 * dt);
        ft.arm = 1 - ft.t;
        if (ft.t >= 1) {
            ft.state = 'RETURNING';
            ft.t = 0;
            ft.wpI = 0;
            if (ft.wps) ft.wps.reverse();
        }
    } else if (ft.state === 'RETURNING') {
        const wps = ft.wps;
        if (wps && ft.wpI < wps.length) {
            const wp = wps[ft.wpI];
            if (reverseNavigate(wp.x, wp.y) < 1.5) ft.wpI++;
        } else {
            if (reverseNavigate(ft.parkX, ft.parkY) < 1.2) {
                ft.wps = null;
                ft.state = 'PARKED';
                ft.t = 0;
            }
        }
    }
}

// ─── main physics update ──────────────────────────────────────────────────────
export function updatePhysics(dt: number, ctx: PhysicsCtx) {
    const { crashed } = zstate;
    const { gridSize } = campaignHandler.getTerrain();

    updateWind(G.wind, dt, ctx);

    updateBoats(G.BOATS, dt);
    updateSubmarines(G.SUBMARINES, dt);
    if (ctx.hasPad && G.fuelTruck.state !== 'PARKED') updateFuelTruck(dt, ctx);
    if (ctx.hasCarrier && !crashed) {
        let oldX = G.CARRIER.x,
            oldY = G.CARRIER.y,
            oldAng = G.CARRIER.angle;
        updateCarrierPos(
            G.CARRIER,
            {
                get t() {
                    return G.seaTime;
                },
                set t(v) {
                    G.seaTime = v;
                },
            },
            false,
            dt
        );
        let carrierVX = G.CARRIER.x - oldX;
        let carrierVY = G.CARRIER.y - oldY;
        let carrierRot = G.CARRIER.angle - oldAng;

        let local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
        let onDeck =
            local.x >= -G.CARRIER.w && local.x <= G.CARRIER.w && local.y >= -G.CARRIER.l && local.y <= G.CARRIER.l;

        if (onDeck && !G.heli.inAir) {
            G.heli.x += carrierVX;
            G.heli.y += carrierVY;
            let dx = G.heli.x - G.CARRIER.x,
                dy = G.heli.y - G.CARRIER.y;
            G.heli.x += dx * Math.cos(carrierRot) - dy * Math.sin(carrierRot) - dx;
            G.heli.y += dx * Math.sin(carrierRot) + dy * Math.cos(carrierRot) - dy;
            G.heli.angle += carrierRot;
            G.heli.vx *= Math.pow(0.8, dt);
            G.heli.vy *= Math.pow(0.8, dt);
        }
    }

    let groundH = getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);

    let onCarrierDeck = false,
        onPadSurface = false;
    if (ctx.hasCarrier) {
        let local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
        if (local.x >= -G.CARRIER.w && local.x <= G.CARRIER.w && local.y >= -G.CARRIER.l && local.y <= G.CARRIER.l)
            onCarrierDeck = true;
    }
    if (
        ctx.hasPad &&
        G.heli.x >= G.PAD.xMin &&
        G.heli.x <= G.PAD.xMax &&
        G.heli.y >= G.PAD.yMin &&
        G.heli.y <= G.PAD.yMax
    )
        onPadSurface = true;
    const onPad = onCarrierDeck || onPadSurface;

    const effectiveGroundH =
        onPad && ctx.hasPad && G.PAD ? G.PAD.z : onPad && ctx.hasCarrier ? G.CARRIER.zDeck : groundH;

    // engine
    if (G.keys['KeyW'] && !G.heli.engineOn && G.heli.fuel > 0 && onPad) G.heli.engineOn = true;
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
    if (
        ctx.hasPad &&
        onPad &&
        !G.heli.engineOn &&
        !G.heli.inAir &&
        G.heli.rotorRPM < 0.05 &&
        G.fuelTruck.state === 'PARKED' &&
        G.heli.fuel < 99
    ) {
        G.fuelTruck.state = 'DRIVING';
        G.fuelTruck.t = 0;
    }
    G.heli.rotorRPM =
        G.heli.engineOn && G.heli.fuel > 0
            ? Math.min(1, G.heli.rotorRPM + 0.005 * dt)
            : Math.max(0, G.heli.rotorRPM - 0.004 * dt);
    G.heli.rotationPos += G.heli.rotorRPM * 0.75 * dt;

    handleParticles(dt, ctx);

    // payload physics
    if (G.activePayload) {
        let p = G.activePayload;
        let hookZ = G.heli.z - G.heli.winch;
        const damping = p.type === 'person' ? 0.88 : 0.95;
        const tension = p.type === 'person' ? 0.018 : 0.005;
        let ax = (G.heli.x - p.x) * tension + G.wind.x * 2.0;
        let ay = (G.heli.y - p.y) * tension + G.wind.y * 2.0;
        p.vx += ax * dt;
        p.vy += ay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z = hookZ;
        p.vx *= Math.pow(damping, dt);
        p.vy *= Math.pow(damping, dt);
        let baseMass = p.type === 'crate' ? 0.8 : 0.2;
        G.heli.vx -= ax * baseMass * G.heli.cargoResist * dt;
        G.heli.vy -= ay * baseMass * G.heli.cargoResist * dt;
        G.rescuerSwing.x = G.activePayload.x;
        G.rescuerSwing.y = G.activePayload.y;
    } else {
        if (G.heli.winch > 0.3) {
            const rs = G.rescuerSwing;
            const tension = 0.018,
                damping = 0.88;
            const ax = (G.heli.x - rs.x) * tension + G.wind.x * 2.0;
            const ay = (G.heli.y - rs.y) * tension + G.wind.y * 2.0;
            rs.vx += ax * dt;
            rs.vy += ay * dt;
            rs.x += rs.vx * dt;
            rs.y += rs.vy * dt;
            rs.vx *= Math.pow(damping, dt);
            rs.vy *= Math.pow(damping, dt);
        } else if (G.heli.winch <= 0.1) {
            G.rescuerSwing.x = G.heli.x;
            G.rescuerSwing.y = G.heli.y;
            G.rescuerSwing.vx = 0;
            G.rescuerSwing.vy = 0;
        }

        G.payloads.forEach((p: any) => {
            if (p.rescued || p.hanging) return;
            if (p.attachTo) {
                const lx = p.attachTo.localX ?? 0, ly = p.attachTo.localY ?? 0;
                if (p.attachTo.objectType === 'carrier' && ctx.hasCarrier) {
                    const wp = _applyVesselOffset(G.CARRIER, lx, ly);
                    p.x = wp.x; p.y = wp.y; p.z = G.CARRIER.zDeck;
                } else if (p.attachTo.objectType === 'boat') {
                    const b = G.BOATS.find((b: any) => b._objIdx === p.attachTo.objectIdx);
                    if (b) {
                        const wp = _applyVesselOffset(b, lx, ly);
                        p.x = wp.x; p.y = wp.y; p.z = b.zDeck;
                    }
                } else if (p.attachTo.objectType === 'submarine') {
                    const sub = G.SUBMARINES.find((s: any) => s._objIdx === p.attachTo.objectIdx);
                    if (sub) {
                        const wp = _applyVesselOffset(sub, lx, ly);
                        p.x = wp.x; p.y = wp.y; p.z = sub.zDeck;
                    }
                }
            } else if (getGround(p.x, p.y, G.points, G.CARRIER) < 0) {
                p.z = -0.3 + Math.sin(Date.now() * 0.002) * 0.1;
            }
        });
    }

    // flight
    let lift = G.heli.rotorRPM > 0.9 ? 1.0 : 0.0;
    let inAir = G.heli.z > effectiveGroundH + 0.15;
    if (!inAir && G.heli.inAir) hapticImpact(ImpactStyle.Medium);
    G.heli.inAir = inAir;

    if (inAir || (G.heli.engineOn && lift > 0)) {
        let spd = Math.hypot(G.heli.vx, G.heli.vy);
        let aero = Math.max(0.3, 1.0 - spd * 8.0);
        let mod = G.heli.rotorRPM * (1.0 - G.heli.onboard * 0.03);

        if (G.heli.fuel > 0 && lift > 0) {
            let dX = Math.cos(G.heli.angle),
                dY = Math.sin(G.heli.angle);
            let sX = Math.cos(G.heli.angle + Math.PI / 2),
                sY = Math.sin(G.heli.angle + Math.PI / 2);

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
                G.heli.vx -= sX * 0.001 * mod * dt;
                G.heli.vy -= sY * 0.001 * mod * dt;
                G.heli.roll = Math.min(G.heli.roll + 0.02 * dt, 0.4);
                turning = true;
            } else if (G.keys['KeyD']) {
                G.heli.vx += sX * 0.001 * mod * dt;
                G.heli.vy += sY * 0.001 * mod * dt;
                G.heli.roll = Math.max(G.heli.roll - 0.02 * dt, -0.4);
                turning = true;
            }
            if (G.keys['ArrowLeft']) {
                G.heli.angle -= 0.045 * mod * aero * dt;
                G.heli.roll = Math.min(G.heli.roll + 0.012 * dt, 0.4);
                turning = true;
            }
            if (G.keys['ArrowRight']) {
                G.heli.angle += 0.045 * mod * aero * dt;
                G.heli.roll = Math.max(G.heli.roll - 0.012 * dt, -0.4);
                turning = true;
            }
            if (!turning) G.heli.roll *= Math.pow(0.96, dt);

            if (G.keys['KeyW']) G.heli.vz += G.heli.liftPower * mod * dt;
            else if (G.keys['KeyS']) G.heli.vz -= 0.002 * dt;
            else G.heli.vz *= Math.pow(0.9, dt);

            G.heli.fuel -= G.heli.fuelRate * mod * dt;
        } else {
            G.heli.tilt *= Math.pow(0.98, dt);
            G.heli.roll = Math.sin(Date.now() * 0.01) * 0.1;
        }
    }

    if (G.heli.fuel <= 0 && inAir) {
        if (G.heli.fuel > -1) {
            ctx.showMsg(I18N.OUT_OF_FUEL);
            G.heli.fuel = -1;
        }
        G.heli.engineOn = false;
        G.heli.vz -= 0.002 * dt;
    }

    G.heli.vx *= Math.pow(G.heli.friction, dt);
    G.heli.vy *= Math.pow(G.heli.friction, dt);
    if (!inAir) {
        G.heli.vx = 0;
        G.heli.vy = 0;
    } else {
        G.heli.vx += G.wind.x * 5 * dt;
        G.heli.vy += G.wind.y * 5 * dt;
    }
    G.heli.x += G.heli.vx * dt;
    G.heli.y += G.heli.vy * dt;
    G.heli.z += G.heli.vz * dt;
    const margin = 2;
    if (G.heli.x < margin) {
        G.heli.x = margin;
        G.heli.vx = 0;
    }
    if (G.heli.x > gridSize - margin) {
        G.heli.x = gridSize - margin;
        G.heli.vx = 0;
    }
    if (G.heli.y < margin) {
        G.heli.y = margin;
        G.heli.vy = 0;
    }
    if (G.heli.y > gridSize - margin) {
        G.heli.y = gridSize - margin;
        G.heli.vy = 0;
    }
    const zMax = 20.0;
    if (G.heli.z > zMax) {
        G.heli.z = zMax;
        G.heli.vz = 0;
        if (Math.random() < 0.05) ctx.showMsg(I18N.MAX_ALTITUDE);
    }
    if (G.heli.z < groundH + 0.1) {
        G.heli.z = groundH + 0.1;
        G.heli.vz = 0;
    }

    // winch
    if (G.keys['KeyQ']) G.heli.winch = Math.max(0, G.heli.winch - 0.02 * dt);
    if (G.keys['KeyE']) G.heli.winch = Math.min(5.0, G.heli.winch + 0.02 * dt);

    // deliver-mode toggle (R key — rising edge only)
    const keyR = !!G.keys['KeyR'];
    if (keyR && !_prevKeyR) {
        if (G.deliverMode) {
            G.deliverMode = false;
        } else if (G.heli.onboard > 0 && !G.activePayload) {
            G.deliverMode = true;
        }
    }
    _prevKeyR = keyR;

    // deliver-mode: lower a person from onboard when winch extends
    if (G.deliverMode && !G.activePayload && G.heli.onboard > 0 && G.heli.winch > 0.3) {
        const dp: any = {
            x: G.rescuerSwing.x, y: G.rescuerSwing.y,
            z: G.heli.z - G.heli.winch,
            vx: 0, vy: 0,
            type: 'person',
            rescued: false,
            hanging: true,
            isDelivery: true,
            attachTo: null,
            npcTarget: false,
            outfitColors: { shirt: '#4488cc', pants: '#223355' },
        };
        G.activePayload = dp;
        G.payloads.push(dp);
        G.heli.onboard--;
    }

    // pickup
    if (!G.activePayload && !G.deliverMode) {
        for (let p of G.payloads) {
            if (p.rescued || p.hanging || p.npcTarget || p.isDelivery) continue;
            let dist = Math.hypot(G.rescuerSwing.x - p.x, G.rescuerSwing.y - p.y);
            let hZ = Math.max(G.heli.z - G.heli.winch, getGround(G.rescuerSwing.x, G.rescuerSwing.y));
            if (dist < 1.8 && Math.abs(hZ - getGround(p.x, p.y)) < 1.0) {
                // check pickup zone if the payload's vessel defines one
                if (p.attachTo) {
                    let vessel: any = null;
                    if (p.attachTo.objectType === 'carrier') vessel = G.CARRIER;
                    else if (p.attachTo.objectType === 'boat') vessel = G.BOATS.find((b: any) => b._objIdx === p.attachTo.objectIdx);
                    else if (p.attachTo.objectType === 'submarine') vessel = G.SUBMARINES.find((s: any) => s._objIdx === p.attachTo.objectIdx);
                    if (vessel && !_vesselPickupAllowed(G.heli.x, G.heli.y, vessel)) continue;
                }
                p.hanging = true;
                G.activePayload = p;
                G.rescuerSwing.x = p.x;
                G.rescuerSwing.y = p.y;
                G.rescuerSwing.vx = 0;
                G.rescuerSwing.vy = 0;
                ctx.showMsg(p.type === 'crate' ? I18N.CARGO_SECURED : I18N.PATIENT_SECURED);
                G.heli.winch = Math.max(0, G.heli.winch - 0.5);
                break;
            }
        }
    }

    // crate touchdown delivery
    if (G.activePayload?.type === 'crate' && onPad) {
        const padSurfaceZ = onCarrierDeck ? G.CARRIER.zDeck : G.PAD.z;
        const crateZ = G.heli.z - G.heli.winch;
        if (crateZ <= padSurfaceZ + 0.4) {
            const p = G.activePayload;
            p.hanging = false;
            p.rescued = true;
            G.activePayload = null;
            G.totalRescued++;
            ctx.showMsg(I18N.DELIVERED);
            if (G.totalRescued >= G.goalCount) ctx.missionComplete();
        }
    }

    // deposit / winch-in
    if (G.activePayload && G.heli.winch < 0.5) {
        let p = G.activePayload;
        if (p.isDelivery) {
            // deliver-mode payload winched back in
            const inZone = _inDropzone(p.x, p.y);
            G.payloads.splice(G.payloads.indexOf(p), 1);
            p.hanging = false;
            p.rescued = true;
            G.activePayload = null;
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
        } else if (p.type === 'person') {
            if (G.heli.onboard < G.heli.maxLoad) {
                p.hanging = false;
                p.rescued = true;
                G.activePayload = null;
                G.heli.onboard++;
                hapticNotification(NotificationType.Success);
                ctx.showMsg(I18N.ONBOARD(G.heli.onboard, G.heli.maxLoad));
            } else ctx.showMsg(I18N.CABIN_FULL);
        } else {
            if (onPad && G.heli.z < 3.0) {
                p.hanging = false;
                p.rescued = true;
                G.activePayload = null;
                G.totalRescued++;
                ctx.showMsg(I18N.DELIVERED);
                if (G.totalRescued >= G.goalCount) ctx.missionComplete();
            } else {
                ctx.showMsg(I18N.DROP_AT_PAD);
                G.heli.winch = 0.6;
            }
        }
    }

    // landing on pad: carrier refuel/offload instant
    if (!inAir && onPad) {
        if (ctx.hasCarrier) {
            let local = getCarrierLocal(G.heli.x, G.heli.y, G.CARRIER);
            if (
                local.x >= -G.CARRIER.w &&
                local.x <= G.CARRIER.w &&
                local.y >= -G.CARRIER.l &&
                local.y <= G.CARRIER.l
            ) {
                if (G.heli.fuel < 100) G.heli.fuel = Math.min(100, G.heli.fuel + 0.5);
                if (G.heli.onboard > 0) {
                    G.totalRescued += G.heli.onboard;
                    G.heli.onboard = 0;
                    if (G.totalRescued >= G.goalCount) ctx.missionComplete();
                    else ctx.showMsg(I18N.SECURED(G.totalRescued, G.goalCount));
                }
            }
        }
    }

    // crash detection
    if (!onPad && G.heli.z < 0.1 && getGround(G.heli.x, G.heli.y, G.points, G.CARRIER) < -0.2)
        ctx.triggerCrash(I18N.CRASH_WATER);
    if (G.heli.z < groundH + 0.25) {
        if (!onPad && groundH > 0.1) ctx.triggerCrash(I18N.CRASH_BAD_ZONE);
        else if (Math.hypot(G.heli.vx, G.heli.vy) > 0.12) ctx.triggerCrash(I18N.CRASH_TOO_FAST);
        else if (G.heli.vz < -0.15) ctx.triggerCrash(I18N.CRASH_HARD_IMPACT);
    }
    // lighthouse collision – handled by handleCollisionBoxes() in game.ts

    // ── Heli-Heli collision (Multiplayer) ────────────────────────────────────
    if (G.remoteHeli) {
        const dx = G.heli.x - G.remoteHeli.x;
        const dy = G.heli.y - G.remoteHeli.y;
        // Flatten z contribution so altitude offset doesn't entirely mask XY proximity
        const dz = (G.heli.z - G.remoteHeli.z) * 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const COLLISION_RADIUS = 1.4;
        if (dist < COLLISION_RADIUS && dist > 0.001) {
            const relVx = G.heli.vx - G.remoteHeli.vx;
            const relVy = G.heli.vy - G.remoteHeli.vy;
            const closingSpeed = Math.hypot(relVx, relVy);
            if (closingSpeed > 0.08) {
                ctx.triggerCrash(I18N.CRASH_REMOTE_HELI!);
            } else {
                // Soft nudge apart
                const nx = dx / dist, ny = dy / dist;
                G.heli.vx += nx * 0.04 * dt;
                G.heli.vy += ny * 0.04 * dt;
            }
        }
    }
}
