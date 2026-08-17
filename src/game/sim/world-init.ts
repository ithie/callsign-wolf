import { campaignHandler } from '../main';
import { G } from '../state';
import { getGround } from './terrain';
import { VESSEL, PAYLOAD, VESSEL_PATH } from '../../shared/types';
import FRIGATE_DEF from '../models/frigate.zdef';
import CARRIER_DEF from '../models/carrier.zdef';
import SUPPLY_VESSEL_DEF from '../models/supply_vessel.zdef';
import WIND_TURBINE_DEF from '../models/objects/wind_turbine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import XMAS_HOUSE_A_DEF from '../models/objects/xmas_house_a.zdef';
import XMAS_HOUSE_B_DEF from '../models/objects/xmas_house_b.zdef';

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
        case VESSEL.SUBMARINE: {
            const s = G.SUBMARINES.find((s: any) => s._objIdx === attachTo.objectIdx);
            return s ? { ...applyVesselOffset(s, lx, ly), z: s.zDeck } : null;
        }
        case VESSEL.SAILBOAT_BROKEN: {
            const sb = G.BROKEN_SAILBOATS.find((s: any) => s._objIdx === attachTo.objectIdx);
            return sb ? { x: sb.x, y: sb.y, z: G.waterLevel + 0.35 } : null;
        }
        case VESSEL.WIND_TURBINE: {
            const wt = G.WIND_TURBINES.find((w: any) => w._objIdx === attachTo.objectIdx);
            if (!wt) return null;
            const rzZ = (WIND_TURBINE_DEF as any).rescueZones?.[0]?.z ?? 12.15;
            return { x: wt.x + lx, y: wt.y + ly, z: wt.gz + rzZ };
        }
        case VESSEL.SUPPLY_VESSEL:
        case VESSEL.BOAT: {
            const b = G.BOATS.find((b: any) => b._objIdx === attachTo.objectIdx);
            return b ? { ...applyVesselOffset(b, lx, ly), z: b.zDeck } : null;
        }
        case VESSEL.RESEARCH_PLATFORM: {
            const rp = G.RESEARCH_PLATFORMS.find((r: any) => r._objIdx === attachTo.objectIdx);
            if (!rp) return null;
            const lz = (RESEARCH_PLATFORM_DEF as any).landingZone;
            return { x: rp.x + lx, y: rp.y + ly, z: G.waterLevel + (lz?.z ?? 6.65) };
        }
    }
    return null;
};

// ─── carrier ─────────────────────────────────────────────────────────────────

const initVessel = (obj: any, vessel: any, seaTimeRef: { t: number }) => {
    const angleRad = (obj.angle ?? 0) * (Math.PI / 180);
    if (obj.type === VESSEL.CARRIER) {
        const lz = (CARRIER_DEF as any).landingZone;
        vessel.lzX  = lz?.x  ?? 0;
        vessel.lzY  = lz?.y  ?? 0;
        vessel.lzHW = lz ? lz.w / 2 : 8.0;
        vessel.lzHH = lz ? lz.h / 2 : 3.5;
        vessel.w    = vessel.lzHW;
        vessel.l    = vessel.lzHH;
        vessel.zDeck = G.waterLevel + (lz?.z ?? 4.2);
        vessel.zHull = G.waterLevel + 3.8;
    } else if (obj.type === VESSEL.FRIGATE) {
        const lz = (FRIGATE_DEF as any).landingZone;
        vessel.lzX  = lz?.x  ?? -8.0;
        vessel.lzY  = lz?.y  ?? 0;
        vessel.lzHW = lz ? lz.w / 2 : 2.25;
        vessel.lzHH = lz ? lz.h / 2 : 2.75;
        vessel.w    = 3.5;
        vessel.l    = 12.0;
        vessel.zDeck = G.waterLevel + (lz?.z ?? 2.0);
        vessel.zHull = G.waterLevel + 1.5;
    } else {
        vessel.lzX = 0; vessel.lzY = 0;
        vessel.lzHW = 1.5; vessel.lzHH = 3.0;
        vessel.w = 1.5; vessel.l = 3.0;
        vessel.zDeck = G.waterLevel + 0.35;
        vessel.zHull = G.waterLevel + 0.15;
    }
    vessel.path = obj.path ?? VESSEL_PATH.STATIC;
    vessel.speedKnots = obj.speed ?? 0;
    vessel.exitWarning = obj.exitWarning ?? false;
    vessel.vesselName = (obj.vesselName as string) ?? '';
    vessel.exitWarn60 = false;
    vessel.exitWarn30 = false;
    vessel._wasOutside = false;
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
    G.CARRIER.radioSilent = (carrierObj as any).radioSilent ?? false;
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

const _frigateLZ = (FRIGATE_DEF as any).landingZone;
const BOAT_CFG: Record<string, { w: number; l: number; zDeck: number; lzX: number; lzY: number; lzHW: number; lzHH: number }> = {
    boat:        { w: 1.5, l:  3.0, zDeck: 0.35, lzX: 0, lzY: 0, lzHW:  3.0, lzHH: 1.5 },
    pilot_boat:  { w: 0.8, l:  2.0, zDeck: 0.3,  lzX: 0, lzY: 0, lzHW:  2.0, lzHH: 0.8 },
    sar_boat:    { w: 0.8, l:  2.0, zDeck: 0.3,  lzX: 0, lzY: 0, lzHW:  2.0, lzHH: 0.8 },
    salvage_tug:    { w: 1.2, l:  3.5, zDeck: 1.2,  lzX: 0, lzY: 0, lzHW:  3.5, lzHH: 1.2 },
    supply_vessel:  { w: 1.2, l:  5.7, zDeck: 1.2,  lzX: -0.7, lzY: 0, lzHW: 1.8, lzHH: 1.0 },
    frigate:     { w: 3.0, l: 11.0, zDeck: _frigateLZ?.z ?? 2.0, lzX: _frigateLZ?.x ?? -8.0, lzY: _frigateLZ?.y ?? 0, lzHW: _frigateLZ ? _frigateLZ.w / 2 : 2.25, lzHH: _frigateLZ ? _frigateLZ.h / 2 : 2.75 },
};

export const initBoatsFromMission = () => {
    const allObjects = getObjects();
    const boatTypes = [VESSEL.BOAT, VESSEL.PILOT_BOAT, VESSEL.SAR_BOAT, VESSEL.SALVAGE_TUG, VESSEL.SUPPLY_VESSEL, VESSEL.FRIGATE];
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
                lzX: cfg.lzX,
                lzY: cfg.lzY,
                lzHW: cfg.lzHW,
                lzHH: cfg.lzHH,
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
                radioSilent: (obj as any).radioSilent ?? false,
                _def: obj.type === VESSEL.SUPPLY_VESSEL ? SUPPLY_VESSEL_DEF
                    : obj.type === VESSEL.FRIGATE ? FRIGATE_DEF
                    : null,
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
        _objIdx: allObjects.indexOf(obj),
    }));
    G.WIND_TURBINES = getObjectsByType(VESSEL.WIND_TURBINE).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: 0,
        spinning: obj.spinning ?? false,
        onFire: obj.onFire ?? false,
        onSmoke: obj.onSmoke ?? false,
        rescueZones: (obj.rescueZones || []) as any[],
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
        _objIdx: allObjects.indexOf(obj),
        _def: WIND_TURBINE_DEF,
    }));
    G.BUOYS = getObjectsByType(VESSEL.BUOY).map((obj: any) => ({ x: obj.x, y: obj.y }));
    G.PLANE_WRECKS = getObjectsByType(VESSEL.PLANE_WRECK).map((obj: any) => ({
        x: obj.x,
        y: obj.y,
        angle: obj.angle ?? 0,
    }));
    G.BOAT_WRECKS = [];
    G.FRAGMENTS = [];
    G.ORNI_RESIDUES = [];
    getObjectsByType(VESSEL.ORNITHOPTER_WRECK).forEach((obj: any) => {
        const gz = getGround(obj.x, obj.y, G.points, G.CARRIER);
        G.ORNI_RESIDUES.push({ x: obj.x, y: obj.y, angle: obj.angle ?? 0 });
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
    G.BAYWATCH_CARS = getObjectsByType(VESSEL.BAYWATCH_CAR).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.BAYWATCH_BUILDINGS = [
        ...getObjectsByType(VESSEL.BAYWATCH_HQ).map((obj: any) => ({
            type: VESSEL.BAYWATCH_HQ, x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
        })),
        ...getObjectsByType(VESSEL.BAYWATCH_TOWER).map((obj: any) => ({
            type: VESSEL.BAYWATCH_TOWER, x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
        })),
    ];
    G.CONCERT_STAGES = getObjectsByType(VESSEL.CONCERT_STAGE).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.FESTIVAL_TENTS = [
        ...getObjectsByType(VESSEL.FESTIVAL_TENT).map((obj: any) => ({
            type: VESSEL.FESTIVAL_TENT, colorVariant: obj.colorVariant as string | undefined,
            x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
        })),
        ...getObjectsByType(VESSEL.FESTIVAL_TENT_BROKEN).map((obj: any) => ({
            type: VESSEL.FESTIVAL_TENT_BROKEN, colorVariant: obj.colorVariant as string | undefined,
            x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
        })),
    ];
    G.FESTIVAL_CARS = getObjectsByType(VESSEL.FESTIVAL_CAR).map((obj: any) => ({
        type: VESSEL.FESTIVAL_CAR, colorVariant: obj.colorVariant as string | undefined,
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.XMAS_HOUSES = [
        ...getObjectsByType(VESSEL.XMAS_HOUSE_A).map((obj: any) => ({
            type: VESSEL.XMAS_HOUSE_A, x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
            chimneyPos: (XMAS_HOUSE_A_DEF as any).chimneyPos,
            rescueZones: (XMAS_HOUSE_A_DEF as any).rescueZones,
        })),
        ...getObjectsByType(VESSEL.XMAS_HOUSE_B).map((obj: any) => ({
            type: VESSEL.XMAS_HOUSE_B, x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
            gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
            chimneyPos: (XMAS_HOUSE_B_DEF as any).chimneyPos,
            rescueZones: (XMAS_HOUSE_B_DEF as any).rescueZones,
        })),
    ];
    G.XMAS_LANTERNS = getObjectsByType(VESSEL.XMAS_LANTERN).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.SLEIGHS = getObjectsByType(VESSEL.SLEIGH).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.REINDEER_OBJECTS = getObjectsByType(VESSEL.REINDEER).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    G.VOLLEYBALL_COURTS = getObjectsByType(VESSEL.VOLLEYBALL_COURT).map((obj: any) => ({
        x: obj.x, y: obj.y, angle: (obj.angle ?? 0) * Math.PI / 180,
        gz: getGround(obj.x, obj.y, G.points, G.CARRIER),
    }));
    const missionData = campaignHandler.getCurrentMissionData() as any;
    const _startOnboard = Math.max(0, Math.min(6, missionData?.startOnboard ?? 0));
    const _spawnOnboardPersons = (missionData?.payloads ?? []).filter(
        (p: any) => p.type === PAYLOAD.PERSON && p.spawnOnboard
    ) as any[];
    G.heli.onboard = _startOnboard + _spawnOnboardPersons.length;
    const _padded: (string | undefined)[] = Array(_startOnboard).fill(undefined);
    G.heli.onboardDeliverQueue = [
        ..._padded,
        ..._spawnOnboardPersons.map((p: any) => p.deliverTo as string | undefined),
    ];
    G.PARTICLE_EMITTERS = (missionData?.particleEmitters || []).map((e: any) => ({
        type: e.type,
        x: e.x,
        y: e.y,
        gz: getGround(e.x, e.y, G.points, G.CARRIER) + (e.zOffset ?? 0),
        radius: e.radius as number | undefined,
        particles: [] as any[],
        spawnTimer: 0,
    }));
    const _gondolaLzZ = (WIND_TURBINE_DEF as any).rescueZones?.[0]?.z ?? 12.15;
    G.WIND_TURBINES.forEach((wt: any) => {
        if (wt.onFire) G.PARTICLE_EMITTERS.push({ type: 'fire',  x: wt.x + 0.1, y: wt.y, gz: wt.gz + _gondolaLzZ, particles: [], spawnTimer: 0 });
        if (wt.onFire || wt.onSmoke) G.PARTICLE_EMITTERS.push({ type: 'smoke', x: wt.x + 0.1, y: wt.y, gz: wt.gz + _gondolaLzZ, particles: [], spawnTimer: 0 });
    });
    G.XMAS_HOUSES.forEach((h: any) => {
        if (!h.chimneyPos) return;
        const c = Math.cos(h.angle ?? 0), s = Math.sin(h.angle ?? 0);
        const cx = h.x + h.chimneyPos.x * c - h.chimneyPos.y * s;
        const cy = h.y + h.chimneyPos.x * s + h.chimneyPos.y * c;
        G.PARTICLE_EMITTERS.push({ type: 'chimney', x: cx, y: cy, gz: h.gz + h.chimneyPos.z, particles: [], spawnTimer: 0 });
    });
    G.PLANE_WRECKS.forEach((pw: any) => {
        G.PARTICLE_EMITTERS.push({
            type: 'wreck_smoke',
            x: pw.x, y: pw.y,
            gz: getGround(pw.x, pw.y, G.points, G.CARRIER) + 0.4,
            radius: 0.14,
            particles: [],
            spawnTimer: Math.random() * 9,
        });
    });
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

const _SKIN = '#f2d0a4';
const _BEACH_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e91e63', '#ff6600', '#00bcd4'];
// Badehose: skin shirt + coloured pants. Badeanzug: same colour for both.
const _BEACH_OUTFITS = [
    ..._BEACH_COLORS.map(c => ({ shirt: _SKIN, pants: c })),
    ..._BEACH_COLORS.map(c => ({ shirt: c, pants: c })),
];

const _pickOutfit = (swimwear: boolean) => {
    const pool = swimwear ? _BEACH_OUTFITS : _SURVIVOR_OUTFITS;
    return pool[Math.floor(Math.random() * pool.length)];
};

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
                ? (p.outfitColors ?? _pickOutfit(p.swimwear === true))
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
    G.completedObjectives = new Set<string>();
    const { payloads: missionPayloads } = missionData;
    if (!missionPayloads || !missionPayloads.length) {
        G.payloads = [];
        G.goalCount = 0;
        return;
    }
    const _onboardPersons = missionPayloads.filter((p: any) => p.type === PAYLOAD.PERSON && p.spawnOnboard);
    G.payloads = missionPayloads
        .filter((p: any) => !(p.type === PAYLOAD.PERSON && p.spawnOnboard))
        .map((p: any) => initPayloadEntry(p));
    G.goalCount = G.payloads.filter((p: any) => !p.npcTarget).length + _onboardPersons.length;
    G.totalRescued = 0;
    G.activePayload = null;
};

export const initRingsFromMission = () => {
    const objs = campaignHandler.getCurrentMissionData().objects || [];
    G.RINGS = (objs as any[])
        .filter(o => o.type === 'ring')
        .map(o => {
            const x = o.x as number;
            const y = o.y as number;
            const radius = (o.radius ?? 2.5) as number;
            const groundZ = getGround(x, y, G.points, G.CARRIER);
            const z = Math.max((o.z ?? 3) as number, groundZ + radius + 0.5);
            return { x, y, z, radius, angle: (o.angle ?? 0) as number, flown: false, _lastD: 0 };
        });
};
