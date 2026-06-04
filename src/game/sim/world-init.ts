import { campaignHandler } from '../main';
import { G } from '../state';
import { getGround } from './terrain';
import { VESSEL, PAYLOAD, VESSEL_PATH } from '../../shared/types';

const getObjects = () => campaignHandler.getCurrentMissionData().objects || [];
const getObjectByType = (type: string) => getObjects().find((o: any) => o.type === type) || null;
const getObjectsByType = (type: string) => getObjects().filter((o: any) => o.type === type);

export const applyVesselOffset = (vessel: any, localX: number, localY: number) => {
    const c = Math.cos(vessel.angle),
        s = Math.sin(vessel.angle);
    return { x: vessel.x + localX * c - localY * s, y: vessel.y + localX * s + localY * c };
};

export const resolveAttachTo = (attachTo: any): { x: number; y: number; z: number } | null => {
    const lx = attachTo.localX ?? 0,
        ly = attachTo.localY ?? 0;
    switch (attachTo.objectType) {
        case VESSEL.CARRIER:
            if (!G.CARRIER || G.CARRIER.x === undefined) return null;
            return { ...applyVesselOffset(G.CARRIER, lx, ly), z: G.CARRIER.zDeck };
        case VESSEL.BOAT: {
            const b = G.BOATS.find((b: any) => b._objIdx === attachTo.objectIdx);
            return b ? { ...applyVesselOffset(b, lx, ly), z: b.zDeck } : null;
        }
        case VESSEL.SUBMARINE: {
            const s = G.SUBMARINES.find((s: any) => s._objIdx === attachTo.objectIdx);
            return s ? { ...applyVesselOffset(s, lx, ly), z: s.zDeck } : null;
        }
        case VESSEL.SAILBOAT_BROKEN: {
            const sb = G.BROKEN_SAILBOATS.find((s: any) => s._objIdx === attachTo.objectIdx);
            return sb ? { x: sb.x, y: sb.y, z: G.waterLevel + 0.35 } : null;
        }
    }
    return null;
};

// ─── carrier ─────────────────────────────────────────────────────────────────

const initVessel = (obj: any, vessel: any, seaTimeRef: { t: number }) => {
    const angleRad = (obj.angle ?? 0) * (Math.PI / 180);
    vessel.w = obj.type === VESSEL.CARRIER ? 8.0 : 1.5;
    vessel.l = obj.type === VESSEL.CARRIER ? 3.5 : 3.0;
    vessel.zDeck = obj.type === VESSEL.CARRIER ? G.waterLevel + 4.2 : G.waterLevel + 0.35;
    vessel.zHull = obj.type === VESSEL.CARRIER ? G.waterLevel + 3.8 : G.waterLevel + 0.15;
    vessel.path = obj.path ?? VESSEL_PATH.STATIC;
    vessel.speedKnots = obj.speed ?? 0;
    const knotsToUnits = 0.001663;
    if (obj.path === VESSEL_PATH.STRAIGHT) {
        vessel.speed = (obj.speed ?? 0) * knotsToUnits;
    } else {
        const r = obj.radius ?? 45;
        vessel.speed = ((obj.speed ?? 0) * knotsToUnits) / r;
    }
    if (obj.path === VESSEL_PATH.CIRCLE) {
        const r = obj.radius ?? 45;
        vessel.radiusX = r;
        vessel.radiusY = r * 0.8;
        const t0 = Math.atan2(-Math.sin(angleRad) / vessel.radiusX, -Math.cos(angleRad) / vessel.radiusY) + Math.PI / 2;
        vessel.centerX = obj.x - Math.cos(t0) * vessel.radiusX;
        vessel.centerY = obj.y - Math.sin(t0) * vessel.radiusY;
        seaTimeRef.t = t0;
        vessel.x = vessel.centerX + Math.cos(t0) * vessel.radiusX;
        vessel.y = vessel.centerY + Math.sin(t0) * vessel.radiusY;
        vessel.angle = Math.atan2(vessel.radiusY * Math.cos(t0), -vessel.radiusX * Math.sin(t0));
    } else if (obj.path === VESSEL_PATH.STRAIGHT) {
        vessel.x = obj.x;
        vessel.y = obj.y;
        vessel.angle = angleRad;
        vessel.lineStartX = obj.x;
        vessel.lineStartY = obj.y;
        vessel.lineDirX = Math.cos(angleRad);
        vessel.lineDirY = Math.sin(angleRad);
        vessel.lineProgress = 0;
    } else {
        vessel.x = obj.x;
        vessel.y = obj.y;
        vessel.angle = angleRad;
    }
};

// Shared straight/circle path update — used by both boats and submarines
const updateVesselPath = (v: any, dt: number) => {
    if (v.path === VESSEL_PATH.STRAIGHT) {
        v.lineProgress += v.speed * dt;
        const nx = v.lineStartX + v.lineDirX * v.lineProgress;
        const ny = v.lineStartY + v.lineDirY * v.lineProgress;
        const dx = nx - v.x,
            dy = ny - v.y;
        if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) v.angle = Math.atan2(dy, dx);
        v.x = nx;
        v.y = ny;
    } else if (v.path === VESSEL_PATH.CIRCLE) {
        v._seaTime += v.speed * dt;
        const nx = v.centerX + Math.cos(v._seaTime) * v.radiusX;
        const ny = v.centerY + Math.sin(v._seaTime) * v.radiusY;
        const dx = nx - v.x,
            dy = ny - v.y;
        if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) v.angle = Math.atan2(dy, dx);
        v.x = nx;
        v.y = ny;
    }
};

export const updateCarrierPos = (CARRIER: any, seaTimeRef: any, forceUpdate = false, dt = 1) => {
    if (!CARRIER || CARRIER.x === undefined) return;
    if (CARRIER.path === VESSEL_PATH.STATIC) return;

    if (CARRIER.path === VESSEL_PATH.STRAIGHT) {
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
};

export const initCarrierFromMission = () => {
    const carrierObj = getObjectByType(VESSEL.CARRIER);
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
};

export const initSubmarinesFromMission = () => {
    const allObjects = getObjects();
    G.SUBMARINES = getObjectsByType(VESSEL.SUBMARINE).map((obj: any) => {
        const s = {
            x: obj.x,
            y: obj.y,
            angle: 0,
            path: VESSEL_PATH.STATIC,
            speed: 0,
            w: 0.7,
            l: 5.4,
            zDeck: 0.25,
            zHull: 0,
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
            _objIdx: allObjects.indexOf(obj),
        };
        const st = {
            get t() {
                return s._seaTime;
            },
            set t(v) {
                s._seaTime = v;
            },
        };
        initVessel(obj, s, st);
        // initVessel overwrites w/l/zDeck with generic boat values — restore submarine-specific ones
        s.w = 0.7;
        s.l = 5.4;
        s.zDeck = G.waterLevel + 0.25;
        return s;
    });
};

export const updateSubmarines = (SUBMARINES: any[], dt: number) => SUBMARINES.forEach(s => updateVesselPath(s, dt));

const BOAT_CFG: Record<string, { w: number; l: number; zDeck: number }> = {
    boat: { w: 1.5, l: 3.0, zDeck: 0.35 },
    pilot_boat: { w: 0.8, l: 2.0, zDeck: 0.3 },
    salvage_tug: { w: 1.2, l: 3.5, zDeck: 1.2 },
};

export const initBoatsFromMission = () => {
    const allObjects = getObjects();
    const boatTypes = [VESSEL.BOAT, VESSEL.PILOT_BOAT, VESSEL.SALVAGE_TUG];
    G.BOATS = boatTypes
        .flatMap(type => getObjectsByType(type))
        .map((obj: any) => {
            const cfg = BOAT_CFG[obj.type] ?? BOAT_CFG.boat;
            const b = {
                x: obj.x,
                y: obj.y,
                objectType: obj.type as string,
                angle: 0,
                path: VESSEL_PATH.STATIC,
                speed: 0,
                w: cfg.w,
                l: cfg.l,
                zDeck: cfg.zDeck,
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
                _objIdx: allObjects.indexOf(obj),
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
            // initVessel overwrites w/l/zDeck with generic values — restore per-type dimensions
            b.w = cfg.w;
            b.l = cfg.l;
            b.zDeck = G.waterLevel + cfg.zDeck;
            b.zHull = G.waterLevel + 0.15;
            return b;
        });
};

export const updateBoats = (BOATS: any[], dt: number) => BOATS.forEach(b => updateVesselPath(b, dt));

export const initStaticObjectsFromMission = () => {
    const allObjects = getObjects();
    G.RESEARCH_PLATFORMS = getObjectsByType(VESSEL.RESEARCH_PLATFORM).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: 0,
        zDeck: G.waterLevel + 6.51,
    }));
    G.WIND_TURBINES = getObjectsByType(VESSEL.WIND_TURBINE).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: 0,
        spinning: obj.spinning ?? false,
        rescueZones: (obj.rescueZones || []) as any[],
    }));
    G.PLANE_WRECKS = getObjectsByType(VESSEL.PLANE_WRECK).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: obj.angle ?? 0,
    }));
    getObjectsByType(VESSEL.ORNITHOPTER_WRECK).forEach((obj: any) => {
        const gz = getGround(obj.x, obj.y, G.points, G.CARRIER);
        G.payloads.push({
            type: PAYLOAD.ORNI_WRECK,
            x: obj.x,
            y: obj.y,
            z: gz,
            angle: obj.angle ?? 0,
            hanging: false,
            rescued: false,
            deliverTo: VESSEL.PAD,
        });
    });
    G.BROKEN_SAILBOATS = getObjectsByType(VESSEL.SAILBOAT_BROKEN).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: obj.angle ?? 0,
        _objIdx: allObjects.indexOf(obj),
    }));
};

const _SURVIVOR_OUTFITS = [
    { shirt: '#e74c3c', pants: '#2c3e50' },
    { shirt: '#3498db', pants: '#1a252f' },
    { shirt: '#2ecc71', pants: '#2c3e50' },
    { shirt: '#f39c12', pants: '#2c3e50' },
    { shirt: '#9b59b6', pants: '#2c3e50' },
    { shirt: '#e8e8e8', pants: '#555555' },
    { shirt: '#e67e22', pants: '#1a5276' },
    { shirt: '#c0392b', pants: '#17202a' },
];

export const initPayloadEntry = (p: any): any => {
    let px = p.x,
        py = p.y,
        pz: number | null = null;
    if (p.attachTo) {
        const resolved = resolveAttachTo(p.attachTo);
        if (resolved) {
            px = resolved.x;
            py = resolved.y;
            pz = resolved.z;
        }
    }
    return {
        ...p,
        x: px,
        y: py,
        z: pz ?? getGround(px, py, G.points, G.CARRIER),
        vx: 0,
        vy: 0,
        rescued: false,
        hanging: false,
        attachTo: p.attachTo || null,
        npcTarget: p.npcTarget ?? false,
        outfitColors:
            p.type === PAYLOAD.PERSON
                ? (p.outfitColors ?? _SURVIVOR_OUTFITS[Math.floor(Math.random() * _SURVIVOR_OUTFITS.length)])
                : null,
    };
};

// Spawns a payload at runtime and pushes it to G.payloads.
// addToGoal: pass false if the payload is already counted in G.goalCount (e.g. was in mission JSON).
export const spawnPayload = (p: any, addToGoal = true): any => {
    const entry = initPayloadEntry(p);
    G.payloads.push(entry);
    if (addToGoal && !entry.npcTarget) G.goalCount++;
    return entry;
};

export const initPayloadsFromMission = () => {
    const missionData = campaignHandler.getCurrentMissionData();
    G.objectives = missionData.objectives || [];
    const { payloads: missionPayloads } = missionData;
    if (!missionPayloads || !missionPayloads.length) {
        G.payloads = [];
        G.goalCount = 0;
        return;
    }
    G.payloads = missionPayloads.map((p: any) => initPayloadEntry(p));
    G.goalCount = G.payloads.filter((p: any) => !p.npcTarget).length;
    G.totalRescued = 0;
    G.activePayload = null;
};
