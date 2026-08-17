import { G, zstate } from '../state';
import { campaignHandler } from '../main';
import { VESSEL_PATH, type MissionEvent, type EventTrigger, type EventAction } from '../../shared/types';
import { initAt as _explosionAt } from './particles/explosion';
import { spawnFragments } from './fragments';
import { localize } from '../i18n';

let _events: MissionEvent[] = [];
const _fired = new Set<number>();
let _startTime = 0;
let _onMissionFail: (() => void) | null = null;
let _onShowMessage: ((text: string) => void) | null = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export const initEventSystem = (onFail?: () => void, onMessage?: (text: string) => void): void => {
    _fired.clear();
    _startTime = 0;
    _onMissionFail = onFail ?? null;
    _onShowMessage = onMessage ?? null;
    _events = ((campaignHandler.getCurrentMissionData() as any).events ?? []) as MissionEvent[];
};

export const markEventSystemStarted = (): void => {
    _startTime = Date.now();
};

// ── Object lookup ─────────────────────────────────────────────────────────────

const _byIdx = (idx: number): { x: number; y: number } | null => {
    if ((G.CARRIER as any)?._objIdx === idx) return G.CARRIER as any;
    return (
        G.BOATS.find((o: any) => o._objIdx === idx) ??
        G.SUBMARINES.find((o: any) => o._objIdx === idx) ??
        G.WIND_TURBINES.find((o: any) => o._objIdx === idx) ??
        G.RESEARCH_PLATFORMS.find((o: any) => o._objIdx === idx) ??
        null
    );
};

// ── Trigger evaluation ────────────────────────────────────────────────────────

const _checkTrigger = (t: EventTrigger): boolean => {
    switch (t.type) {
        case 'time':
            return _startTime > 0 && (Date.now() - _startTime) / 1000 >= t.seconds;
        case 'rescued':
            return G.totalRescued >= t.count;
        case 'objectReaches': {
            const a = _byIdx(t.objectIdx);
            const b = _byIdx(t.nearObjectIdx);
            return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) <= t.distance;
        }
        case 'objectDestroyed':
            return !_byIdx(t.objectIdx);
        case 'heliNear': {
            const obj = _byIdx(t.objectIdx);
            return !!obj && Math.hypot(G.heli.x - obj.x, G.heli.y - obj.y) <= t.distance;
        }
    }
};

// ── Action execution ──────────────────────────────────────────────────────────

const _executeAction = (a: EventAction): void => {
    switch (a.type) {
        case 'destroy': {
            const boatIdx = G.BOATS.findIndex((b: any) => b._objIdx === a.objectIdx);
            if (boatIdx >= 0) {
                const b = G.BOATS[boatIdx];
                if ((b as any)._def) spawnFragments((b as any)._def, b.x, b.y, G.waterLevel, b.angle);
                G.BOATS.splice(boatIdx, 1);
                G.BOAT_WRECKS.push({ x: b.x, y: b.y, angle: b.angle });
                G.PARTICLE_EMITTERS.push({ type: 'smoke', x: b.x, y: b.y, gz: G.waterLevel, particles: [], spawnTimer: 0 });
                _explosionAt({ particles: G.particles, debris: G.debris } as any, b.x, b.y, G.waterLevel + 0.5);
                return;
            }
            const wt = G.WIND_TURBINES.find((w: any) => w._objIdx === a.objectIdx);
            if (wt) {
                if ((wt as any)._def) spawnFragments((wt as any)._def, wt.x, wt.y, wt.gz, 0);
                wt.collapsing = true;
                wt.collapseT  = 0;
                wt.spinning   = false;
                G.PARTICLE_EMITTERS.push({ type: 'fire',  x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
                G.PARTICLE_EMITTERS.push({ type: 'smoke', x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
            }
            break;
        }
        case 'killAttachedPayloads': {
            G.payloads.forEach((p: any) => {
                if (p.rescued || p.hanging) return;
                if (p.attachTo?.objectIdx === a.objectIdx) p.rescued = true;
            });
            break;
        }
        case 'failMission': {
            const hasVictims = a.objectIdx !== undefined
                ? G.payloads.some((p: any) => !p.rescued && !p.hanging && p.attachTo?.objectIdx === a.objectIdx)
                : true;
            if (hasVictims && !zstate.crashed) _onMissionFail?.();
            break;
        }
        case 'setOnFire': {
            const wt = G.WIND_TURBINES.find((w: any) => w._objIdx === a.objectIdx);
            if (wt && !wt.onFire) {
                wt.onFire = true;
                G.PARTICLE_EMITTERS.push({ type: 'fire',  x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
                G.PARTICLE_EMITTERS.push({ type: 'smoke', x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
            }
            break;
        }
        case 'setOnSmoke': {
            const wt = G.WIND_TURBINES.find((w: any) => w._objIdx === a.objectIdx);
            if (wt && !wt.onSmoke) {
                wt.onSmoke = true;
                G.PARTICLE_EMITTERS.push({ type: 'smoke', x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
            }
            break;
        }
        case 'startMoving': {
            const b = G.BOATS.find((b: any) => b._objIdx === a.objectIdx);
            if (b) b.path = (b as any)._savedPath ?? VESSEL_PATH.STRAIGHT;
            const s = G.SUBMARINES.find((s: any) => s._objIdx === a.objectIdx);
            if (s) s.path = (s as any)._savedPath ?? VESSEL_PATH.STRAIGHT;
            break;
        }
        case 'stopMoving': {
            const b = G.BOATS.find((b: any) => b._objIdx === a.objectIdx);
            if (b) { (b as any)._savedPath = b.path; b.path = VESSEL_PATH.STATIC; }
            const s = G.SUBMARINES.find((s: any) => s._objIdx === a.objectIdx);
            if (s) { (s as any)._savedPath = s.path; s.path = VESSEL_PATH.STATIC; }
            break;
        }
        case 'setWindStr': {
            G.wind.rawStr = a.value;
            break;
        }
        case 'showMessage':
            _onShowMessage?.(localize(a.text));
            break;
    }
};

// ── Update (called each physics tick) ────────────────────────────────────────

export const updateEventSystem = (): void => {
    if (zstate.crashed || _events.length === 0) return;
    _events.forEach((ev, i) => {
        if (_fired.has(i)) return;
        if (_checkTrigger(ev.trigger)) {
            _fired.add(i);
            ev.actions.forEach(_executeAction);
        }
    });
};
