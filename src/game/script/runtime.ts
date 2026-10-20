// Runs the optional campaign script (src/game/campaigns/<key>.script.ts) for the
// current mission: resolves named map objects to script handles, drives timers,
// conditions and contact checks once per physics tick, and forwards game events.

import { G } from '../state';
import { VESSEL, VESSEL_PATH } from '../../shared/types';
import { getObjectDef } from '../def-registry';
import { localize } from '../i18n';
import { showScriptMessage } from '../ui/voice-line/voice-line';
import { getGround } from '../sim/terrain';
import { startCollapse } from '../sim/collapse';
import { setTurbineEmitters } from '../sim/world-init';
import { setScriptHooks } from './hooks';
import { worldBoxes, boxesOverlap, bearingDeg, type ContactBox } from './contact';
import CARRIER_DEF from '../models/carrier.zdef';
import FRIGATE_DEF from '../models/frigate.zdef';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SUPPLY_VESSEL_DEF from '../models/supply_vessel.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import type {
    CampaignScript, MissionContext, MissionObjects, Text, RescueTarget, PayloadState, Positioned,
} from './index';

// ─── Script registry ──────────────────────────────────────────────────────────

type _ScriptModule = { default: CampaignScript<Record<string, MissionObjects>> };

// Bundled with the game (no code loading at runtime) — optional per campaign.
const _modules = import.meta.glob<_ScriptModule>('../campaigns/*.script.ts', { eager: true });
const _scripts = new Map<string, CampaignScript<Record<string, MissionObjects>>>(
    Object.entries(_modules).map(([path, m]) => [path.replace(/^.*\/(.+)\.script\.ts$/, '$1'), m.default]),
);

export const hasCampaignScript = (key: string): boolean => _scripts.has(key);

// ─── Environment (provided by game-flow) ──────────────────────────────────────

export type ScriptEnv = {
    campaignKey: string;
    missionId: string | undefined;
    endless: boolean;
    /** Raw mission objects — names and indices for resolving runtime entities. */
    objects: ReadonlyArray<{ type: string; name?: string }>;
    win: () => void;
    fail: (reason?: string) => void;
    setWind: (bft: number) => void;
    onError: (message: string) => void;
};

// ─── Runtime entity lookup ────────────────────────────────────────────────────

const KNOTS_TO_UNITS = 0.001663;

const _VESSEL_TYPES = new Set<string>([
    VESSEL.CARRIER, VESSEL.BOAT, VESSEL.PILOT_BOAT, VESSEL.SAR_BOAT, VESSEL.SALVAGE_TUG,
    VESSEL.SUPPLY_VESSEL, VESSEL.FRIGATE, VESSEL.SUBMARINE,
]);
const _PROP_TYPES = new Set<string>([
    VESSEL.BUOY, VESSEL.REINDEER, VESSEL.SLEIGH, VESSEL.XMAS_CANDY_CANE, VESSEL.XMAS_TREE,
]);

// Every runtime array whose entries carry `_objIdx` (index into the mission's objects).
const _entityLists = (): any[][] => [
    G.BOATS, G.SUBMARINES, G.RESEARCH_PLATFORMS, G.WIND_TURBINES, G.BUOYS, G.PLANE_WRECKS,
    G.BROKEN_SAILBOATS, G.BAYWATCH_CARS, G.BAYWATCH_BUILDINGS, G.CONCERT_STAGES, G.FESTIVAL_TENTS,
    G.FESTIVAL_CARS, G.XMAS_HOUSES, G.XMAS_LANTERNS, G.SLEIGHS, G.REINDEER_OBJECTS, G.SCENARIO_PROPS,
];

// Read at call time — production .zdefs are only filled after decompressMissionAssets().
const _defFor = (type: string): any => {
    switch (type) {
        case VESSEL.CARRIER:           return CARRIER_DEF;
        case VESSEL.FRIGATE:           return FRIGATE_DEF;
        case VESSEL.PILOT_BOAT:        return PILOT_BOAT_DEF;
        case VESSEL.SAR_BOAT:          return SAR_BOAT_DEF;
        case VESSEL.SALVAGE_TUG:
        case VESSEL.SUPPLY_VESSEL:     return SUPPLY_VESSEL_DEF;
        case VESSEL.BOAT:              return SAILBOAT_DEF;
        case VESSEL.SUBMARINE:         return SUBMARINE_DEF;
        case VESSEL.RESEARCH_PLATFORM: return RESEARCH_PLATFORM_DEF;
        default:                       return getObjectDef(type);
    }
};

const _onWater = (type: string): boolean => _VESSEL_TYPES.has(type) || type === VESSEL.RESEARCH_PLATFORM;

const _baseZ = (e: any, type: string): number =>
    _onWater(type) ? G.waterLevel : (e.gz ?? getGround(e.x, e.y));

// ─── 3D contact (rotated collision boxes) ─────────────────────────────────────

const _worldBoxes = (e: any, type: string): ContactBox[] =>
    worldBoxes(_defFor(type)?.collisionBoxes ?? [], e.x, e.y, e.angle ?? 0, _baseZ(e, type));

const _touching = (a: any, aType: string, b: any, bType: string): boolean => {
    const ba = _worldBoxes(a, aType), bb = _worldBoxes(b, bType);
    return ba.some(x => bb.some(y => boxesOverlap(x, y)));
};

// ─── Running state ────────────────────────────────────────────────────────────

type _Cond = { check: () => boolean; action: () => void };
type _Every = { interval: number; next: number; action: () => void };

let _env: ScriptEnv | null = null;
let _gen = 0;
let _time = 0;
let _ended = false;
let _waits: { until: number; resolve: () => void }[] = [];
let _conds: _Cond[] = [];
let _everys: _Every[] = [];
let _ticks: ((dt: number) => void)[] = [];
// Vessels the script has taken over (heading/course/speed set): moved here each tick.
let _steered: any[] = [];
let _handleOf = new Map<object, any>();       // runtime entity / payload record → handle
let _entityOf = new WeakMap<object, { e: any; type: string }>(); // handle → entity
let _boardListeners = new Map<object, (() => void)[]>();
let _rescueListeners = new Map<object, ((where: RescueTarget) => void)[]>();

const _PAD_TARGET: RescueTarget = Object.freeze({ type: 'pad' as const });

const _report = (err: unknown): void => {
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    _env?.onError(`Campaign script error:\n${msg}`);
};

// Runs script code; a throw goes to the red debug screen instead of killing the tick.
const _safe = (fn: () => void): void => {
    try { fn(); } catch (err) { _report(err); }
};

const _say = (text: Text, sender?: string): void => {
    const t = localize(text);
    showScriptMessage(sender ? `${sender}: ${t}` : t);
};

// ─── Handles ──────────────────────────────────────────────────────────────────

const _base = (e: any, type: string, name: string | undefined, gen: number) => ({
    type,
    name,
    get x(): number { return e.x; },
    get y(): number { return e.y; },
    get z(): number { return _baseZ(e, type); },
    get destroyed(): boolean { return !!e.destroyed; },
    minimap: {
        get hidden(): boolean { return !!e.minimapHidden; },
        set hidden(v: boolean) { e.minimapHidden = v; },
    },
    distanceTo: (o: Positioned): number => Math.hypot(o.x - e.x, o.y - e.y),
    bearingTo: (o: Positioned): number => bearingDeg(e.x, e.y, o.x, o.y),
    onHeliNear: (distance: number, action: () => void): void => {
        if (gen !== _gen) return;
        _conds.push({ check: () => Math.hypot(G.heli.x - e.x, G.heli.y - e.y) < distance, action });
    },
});

const _destroy = (e: any, type: string): void => {
    if (e.destroyed) return;
    _steered = _steered.filter(d => d !== e);
    if ('speed' in e) e.speed = 0;
    if ('path' in e) e.path = VESSEL_PATH.STATIC;
    startCollapse(e, { baseZ: _baseZ(e, type), angle: e.angle ?? 0, burst: _VESSEL_TYPES.has(type) });
};

const _objectHandle = (e: any, type: string, name: string | undefined): any => {
    const known = _handleOf.get(e);
    if (known) return known;
    const gen = _gen;
    const h: any = _base(e, type, name, gen);
    h.destroy = (): void => { if (gen === _gen) _destroy(e, type); };
    if (!_PROP_TYPES.has(type)) {
        h.onTouch = (other: object, action: () => void): void => {
            if (gen !== _gen) return;
            const o = _entityOf.get(other);
            if (!o) throw new Error('onTouch: target is not a map object');
            _conds.push({
                check: () => !e.destroyed && !o.e.destroyed && _touching(e, type, o.e, o.type),
                action,
            });
        };
    }
    if (_VESSEL_TYPES.has(type)) {
        // Start values come from the .zcampaign (angle, speed, route). The first write
        // takes the vessel over from its route; course follows heading until set.
        const _deg = (rad: number): number => (((rad * 180) / Math.PI) % 360 + 360) % 360;
        const _takeOver = (): any => {
            if (!e._steer) {
                const kn = e.path === VESSEL_PATH.STATIC ? 0 : (e.speedKnots ?? 0);
                e._steer = { speedKn: kn, courseDeg: null as number | null };
                e.path = VESSEL_PATH.STATIC;
                e.speed = 0;
                _steered.push(e);
            }
            return e._steer;
        };
        Object.defineProperties(h, {
            heading: {
                get: (): number => _deg(e.angle ?? 0),
                set: (v: number) => { if (gen === _gen && !e.destroyed) { _takeOver(); e.angle = (v * Math.PI) / 180; } },
            },
            course: {
                get: (): number => e._steer?.courseDeg ?? _deg(e.angle ?? 0),
                set: (v: number) => { if (gen === _gen && !e.destroyed) _takeOver().courseDeg = ((v % 360) + 360) % 360; },
            },
            speed: {
                get: (): number => e._steer ? e._steer.speedKn : (e.path === VESSEL_PATH.STATIC ? 0 : (e.speedKnots ?? 0)),
                set: (v: number) => { if (gen === _gen && !e.destroyed) _takeOver().speedKn = Math.max(0, v); },
            },
        });
        h.radio = (text: Text): void => { if (gen === _gen) _say(text, e.vesselName || undefined); };
    }
    if (type === VESSEL.WIND_TURBINE) {
        h.setOnFire = (on = true): void => { if (gen === _gen) setTurbineEmitters(e, on, !!e.onSmoke); };
        h.setOnSmoke = (on = true): void => { if (gen === _gen) setTurbineEmitters(e, !!e.onFire && on, on); };
        h.spin = (on: boolean): void => { if (gen === _gen && !e.destroyed) e.spinning = on; };
    }
    _handleOf.set(e, h);
    _entityOf.set(h, { e, type });
    return h;
};

// A payload record (G.payloads entry or the record carried in the onboard queue).
const _payloadPos = (p: any): Positioned => {
    const active: any = G.activePayload;
    if (active && (active === p || active.src === p)) return active;
    if (p._scriptState === 'onBoard') return G.heli;
    return p;
};

const _payloadHandle = (p: any): any => {
    const known = _handleOf.get(p);
    if (known) return known;
    const gen = _gen;
    const h = {
        type: p.type as string,
        name: p.name as string | undefined,
        get x(): number { return _payloadPos(p).x; },
        get y(): number { return _payloadPos(p).y; },
        get z(): number { return (_payloadPos(p) as any).z ?? 0; },
        destroyed: false,
        minimap: {
            get hidden(): boolean { return !!p.minimapHidden; },
            set hidden(v: boolean) { p.minimapHidden = v; },
        },
        get state(): PayloadState {
            const active: any = G.activePayload;
            if (p._scriptState === 'rescued') return 'rescued';
            if (active && (active === p || active.src === p)) return 'hanging';
            return p._scriptState === 'onBoard' ? 'onBoard' : 'waiting';
        },
        distanceTo: (o: Positioned): number => { const q = _payloadPos(p); return Math.hypot(o.x - q.x, o.y - q.y); },
        bearingTo: (o: Positioned): number => { const q = _payloadPos(p); return bearingDeg(q.x, q.y, o.x, o.y); },
        onHeliNear: (distance: number, action: () => void): void => {
            if (gen !== _gen) return;
            _conds.push({ check: () => { const q = _payloadPos(p); return Math.hypot(G.heli.x - q.x, G.heli.y - q.y) < distance; }, action });
        },
        onBoard: (action: () => void): void => {
            if (gen !== _gen) return;
            _boardListeners.set(p, [...(_boardListeners.get(p) ?? []), action]);
        },
        onRescued: (action: (where: RescueTarget) => void): void => {
            if (gen !== _gen) return;
            _rescueListeners.set(p, [...(_rescueListeners.get(p) ?? []), action]);
        },
        radio: (text: Text): void => { if (gen === _gen) _say(text); },
    };
    _handleOf.set(p, h);
    return h;
};

const _targetHandle = (where: object): RescueTarget => {
    if (where === G.PAD) return _PAD_TARGET;
    const known = _handleOf.get(where);
    if (known) return known;
    const w: any = where;
    return _objectHandle(w, (w.objectType ?? w.type ?? VESSEL.CARRIER) as string, undefined);
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export const stopMissionScript = (): void => {
    _gen++;
    _env = null;
    _ended = false;
    _time = 0;
    _waits = []; _conds = []; _everys = []; _ticks = []; _steered = [];
    _handleOf = new Map(); _entityOf = new WeakMap();
    _boardListeners = new Map(); _rescueListeners = new Map();
    setScriptHooks(null);
};

export const startMissionScript = (env: ScriptEnv): void => {
    stopMissionScript();
    const missionFn = env.missionId ? _scripts.get(env.campaignKey)?.[env.missionId] : undefined;
    if (!missionFn) return; // scripts are optional
    _env = env;
    const gen = _gen;

    // Named objects → runtime entities (via _objIdx).
    const byIdx = new Map<number, any>();
    for (const list of _entityLists()) for (const e of list ?? []) if (e._objIdx !== undefined) byIdx.set(e._objIdx, e);
    env.objects.forEach((o, i) => { if (o.type === VESSEL.CARRIER) byIdx.set(i, G.CARRIER); });
    const all: { h: any; type: string }[] = [];
    const named = new Map<string, any>();
    env.objects.forEach((o, i) => {
        const e = byIdx.get(i);
        if (!e) return;
        const h = _objectHandle(e, o.type, o.name);
        all.push({ h, type: o.type });
        if (o.name) named.set(o.name, h);
    });
    // Payloads: on the map plus those starting on board.
    const records = [...G.payloads, ...G.heli.onboardDeliverQueue.map(q => q.payload).filter(Boolean)];
    for (const p of records) {
        if (p._scriptState === undefined && G.heli.onboardDeliverQueue.some(q => q.payload === p)) p._scriptState = 'onBoard';
        const h = _payloadHandle(p);
        all.push({ h, type: p.type });
        if (p.name) named.set(p.name, h);
    }

    setScriptHooks({
        onBoard: p => {
            if (gen !== _gen) return;
            (p as any)._scriptState = 'onBoard';
            for (const fn of _boardListeners.get(p) ?? []) _safe(fn);
        },
        rescued: (p, where) => {
            if (gen !== _gen || !p) return;
            (p as any)._scriptState = 'rescued';
            const target = where ? _targetHandle(where) : _PAD_TARGET;
            for (const fn of _rescueListeners.get(p) ?? []) _safe(() => fn(target));
        },
    });

    const alive = (): boolean => gen === _gen;
    const ctx: MissionContext<MissionObjects> = {
        object: name => {
            const h = named.get(name);
            if (!h) throw new Error(`object('${name}'): no object with this name in mission '${env.missionId}'`);
            return h;
        },
        all: type => all.filter(x => x.type === type).map(x => x.h),
        heli: {
            get x() { return G.heli.x; },
            get y() { return G.heli.y; },
            get z() { return G.heli.z; },
            get speedKmh() { return Math.hypot(G.heli.vx, G.heli.vy) * 1115; },
            get onBoard() { return G.heli.onboard; },
            distanceTo: o => Math.hypot(o.x - G.heli.x, o.y - G.heli.y),
            bearingTo: o => bearingDeg(G.heli.x, G.heli.y, o.x, o.y),
        },
        mission: {
            win: () => { if (alive() && !_ended) { _ended = true; env.win(); } },
            fail: reason => { if (alive() && !_ended) { _ended = true; env.fail(reason ? localize(reason) : undefined); } },
            get rescued() { return G.totalRescued; },
            get onBoard() { return G.heli.onboard; },
            get remaining() { return Math.max(0, G.goalCount - G.totalRescued); },
            endless: env.endless,
            message: text => { if (alive()) _say(text); },
            setWind: bft => { if (alive()) env.setWind(bft); },
        },
        wait: seconds => new Promise<void>(resolve => {
            if (alive()) _waits.push({ until: _time + seconds, resolve });
        }),
        when: (check, action) => { if (alive()) _conds.push({ check, action }); },
        every: (seconds, action) => { if (alive()) _everys.push({ interval: seconds, next: _time + seconds, action }); },
        onTick: action => { if (alive()) _ticks.push(action); },
    };

    try {
        const result = missionFn(ctx);
        if (result instanceof Promise) result.catch(err => { if (alive()) _report(err); });
    } catch (err) {
        _report(err);
    }
};

// Once per physics tick (dt: 1 ≈ 1/60 s), only while a script runs.
export const updateMissionScript = (dt: number): void => {
    if (!_env) return;
    const gen = _gen;
    const sec = dt / 60;
    _time += sec;

    for (const e of _steered) {
        const { speedKn, courseDeg } = e._steer;
        if (speedKn <= 0) continue;
        const rad = courseDeg !== null ? (courseDeg * Math.PI) / 180 : (e.angle ?? 0);
        e.x += Math.cos(rad) * speedKn * KNOTS_TO_UNITS * dt;
        e.y += Math.sin(rad) * speedKn * KNOTS_TO_UNITS * dt;
    }

    if (_waits.length) {
        const due = _waits.filter(w => w.until <= _time);
        if (due.length) {
            _waits = _waits.filter(w => w.until > _time);
            due.forEach(w => w.resolve());
        }
    }
    // Conditions fire once; removed before running so an action can add new ones.
    for (const c of [..._conds]) {
        if (gen !== _gen) return;
        let hit = false;
        _safe(() => { hit = c.check(); });
        if (!hit) continue;
        _conds = _conds.filter(x => x !== c);
        _safe(c.action);
    }
    for (const ev of [..._everys]) {
        if (gen !== _gen) return;
        if (_time < ev.next) continue;
        ev.next += ev.interval;
        _safe(ev.action);
    }
    for (const fn of [..._ticks]) {
        if (gen !== _gen) return;
        _safe(() => fn(sec));
    }
};
