import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VESSEL } from '../../shared/types';
import { renderNodes } from '../def-utils';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SALVAGE_TUG_DEF from '../models/supply_vessel.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import FRIGATE_DEF from '../models/frigate.zdef';

// ─── Wake crest emitter ───────────────────────────────────────────────────────
// Each crest is emitted at the ship's stern every EMIT_DIST wu. After emission
// it has no connection to the ship: it drifts slowly in its emission direction,
// arms grow, and alpha fades — all driven by its own age (ms since birth).
// Time-based aging means no index-shuffle jumps when new crests are added.
type _Crest = { x: number; y: number; a: number; born: number };
const _emitters = new WeakMap<object, { crests: _Crest[]; lastX: number; lastY: number }>();
const EMIT_DIST  = 1.6;   // world-units between emissions
const EMIT_MAX   = 7;     // max simultaneous crests
const CREST_LIFE = 2800;  // ms until fully faded

const _emit = (v: any, hullOffset: number): _Crest[] => {
    let e = _emitters.get(v);
    const wd = v.angle + Math.PI;
    const sx = v.x + Math.cos(wd) * hullOffset;
    const sy = v.y + Math.sin(wd) * hullOffset;
    if (!e) { _emitters.set(v, (e = { crests: [], lastX: sx, lastY: sy })); }
    const now = performance.now();
    const dsq = (sx - e.lastX) ** 2 + (sy - e.lastY) ** 2;
    if (dsq >= EMIT_DIST * EMIT_DIST) {
        e.crests.push({ x: sx, y: sy, a: v.angle, born: now });
        if (e.crests.length > EMIT_MAX) e.crests.shift();
        e.lastX = sx; e.lastY = sy;
    }
    const cutoff = now - CREST_LIFE;
    while (e.crests.length > 0 && e.crests[0].born < cutoff) e.crests.shift();
    return e.crests;
};

export const createVesselsDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW } = dwCtx;

    const _drawBowWave = (
        vessel: any,
        camX: number, camY: number,
        hullOffset = 0,
    ) => {
        const speed: number = vessel.speedKnots;
        if (speed < 0.5) return;

        const crests = _emit(vessel, hullOffset);
        if (crests.length === 0) return;

        const now = performance.now();

        // scUnit: pixels per world-unit in the current wake direction
        const wd0    = vessel.angle + Math.PI;
        const _sBase = isoFn(vessel.x, vessel.y, G.waterLevel, camX, camY);
        const _sAhd  = isoFn(vessel.x + Math.cos(wd0), vessel.y + Math.sin(wd0), G.waterLevel, camX, camY);
        const scUnit = Math.sqrt((_sAhd.x - _sBase.x) ** 2 + (_sAhd.y - _sBase.y) ** 2);

        // Speed-dependent cap: show only the newest N crests
        const nCap  = Math.max(1, Math.ceil(speed * 0.5));
        const start = Math.max(0, crests.length - nCap);

        const lw     = Math.max(1.2, tileW / 26);
        // V opening scales with ship size: small boat ≈27°, carrier ≈43°
        const V_HALF = 0.40 + hullOffset * 0.035;
        const minArm = scUnit * 1.0;
        const maxArm = scUnit * 7.0;
        const DRIFT  = 3.5; // wu — max world-space drift over a crest's lifetime

        ctx.save();
        ctx.lineCap = 'round';

        for (let i = start; i < crests.length; i++) {
            const c   = crests[i];
            const age = Math.min(1, (now - c.born) / CREST_LIFE); // 0=fresh, 1=dead

            // Smooth fade: ramp in over first 15%, then decay
            const fadeIn  = Math.min(1, age / 0.15);
            const fadeOut = Math.pow(1 - age, 1.5);
            const fade    = fadeIn * fadeOut * 0.9;
            if (fade < 0.04) continue;

            // Drift slowly in emission direction (wake rolls away from ship)
            const cWD  = c.a + Math.PI;
            const drift = age * DRIFT;
            const px = c.x + Math.cos(cWD) * drift;
            const py = c.y + Math.sin(cWD) * drift;

            // Arms grow from small (fresh) to large (old)
            const armPx = minArm + age * (maxArm - minArm);

            // Project emission angle to screen-space → symmetric V at any heading
            const tip   = isoFn(px, py, G.waterLevel, camX, camY);
            const ahead = isoFn(px + Math.cos(cWD), py + Math.sin(cWD), G.waterLevel, camX, camY);
            const scDir = Math.atan2(ahead.y - tip.y, ahead.x - tip.x);

            ctx.lineWidth   = lw * (1 - age * 0.35);
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#cde8f8';
            ctx.beginPath();
            ctx.moveTo(tip.x + Math.cos(scDir + V_HALF) * armPx,
                       tip.y + Math.sin(scDir + V_HALF) * armPx);
            ctx.lineTo(tip.x, tip.y);
            ctx.lineTo(tip.x + Math.cos(scDir - V_HALF) * armPx,
                       tip.y + Math.sin(scDir - V_HALF) * armPx);
            ctx.stroke();
        }

        ctx.restore();
    };

    const _drawBoatModel = (b: any, cx: number, cy: number) => {
        if (b.objectType === VESSEL.PILOT_BOAT) {
            renderNodes(PILOT_BOAT_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else if (b.objectType === VESSEL.SAR_BOAT) {
            renderNodes(SAR_BOAT_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else if (b.objectType === VESSEL.FRIGATE) {
            renderNodes(FRIGATE_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else if (b.objectType === VESSEL.SALVAGE_TUG) {
            renderNodes(SALVAGE_TUG_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else {
            SceneRenderer.add(SAILBOAT_DEF, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        }
    };

    const _drawSubmarine = (s: any) => {
        const depth = s.x + s.y - 5.6 * (Math.cos(s.angle) + Math.sin(s.angle));
        SceneRenderer.add(SUBMARINE_DEF, { x: s.x, y: s.y, z: G.waterLevel, angle: s.angle, depth });
    };

    const _drawResearchPlatform = (rX: number, rY: number) => {
        SceneRenderer.add(RESEARCH_PLATFORM_DEF as any, { x: rX, y: rY, z: G.waterLevel, angle: 0, depth: rX + rY - 4 });
    };

    return { _drawBowWave, _drawBoatModel, _drawSubmarine, _drawResearchPlatform };
};
