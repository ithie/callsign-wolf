import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VESSEL } from '../../shared/types';
import { renderNodes } from '../def-utils';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SALVAGE_TUG_DEF from '../models/supply_vessel.zdef';
import SUPPLY_VESSEL_WRECK_DEF from '../models/supply_vessel_wreck.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import FRIGATE_DEF from '../models/frigate.zdef';


export const createVesselsDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW } = dwCtx;

    const _drawBowWave = (
        x: number, y: number, angle: number, speed: number,
        camX: number, camY: number, hullOffset = 0, nCrests = 5,
    ) => {
        const wakeLen = Math.min(14, speed * 1.1);
        if (wakeLen < 1) return;
        const wakeDir = angle + Math.PI;
        const perpDir = angle + Math.PI / 2;
        const KELVIN_HALF = 0.34;
        const spacing = wakeLen / nCrests;
        const phase = (performance.now() * speed * 0.0002) % spacing;
        ctx.lineWidth = Math.max(1.5, tileW / 22);
        for (let i = 0; i < nCrests; i++) {
            const d = hullOffset + phase + i * spacing;
            const wakeProgress = (d - hullOffset) / wakeLen;
            if (wakeProgress >= 1) continue;
            const fade = Math.pow(1 - wakeProgress, 0.5);
            ctx.globalAlpha = fade * 0.72;
            ctx.strokeStyle = '#cce8f4';
            const cX = x + Math.cos(wakeDir) * d;
            const cY = y + Math.sin(wakeDir) * d;
            const halfW = d * Math.tan(KELVIN_HALF) * 1.2;
            const s = isoFn(cX + Math.cos(perpDir) * halfW, cY + Math.sin(perpDir) * halfW, G.waterLevel, camX, camY);
            const e = isoFn(cX - Math.cos(perpDir) * halfW, cY - Math.sin(perpDir) * halfW, G.waterLevel, camX, camY);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    };

    const _drawBoatModel = (b: any, cx: number, cy: number, onBeforeFlush?: (ni: number) => void) => {
        if (b.objectType === VESSEL.PILOT_BOAT) {
            renderNodes(PILOT_BOAT_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else if (b.objectType === VESSEL.SAR_BOAT) {
            renderNodes(SAR_BOAT_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy);
        } else if (b.objectType === VESSEL.FRIGATE) {
            renderNodes(FRIGATE_DEF as any, {}, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer, cx, cy, undefined, onBeforeFlush);
        } else if (b.objectType === VESSEL.SALVAGE_TUG || b.objectType === VESSEL.SUPPLY_VESSEL) {
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

    const _drawBoatWreck = (w: { x: number; y: number; angle: number }, cx: number, cy: number) => {
        renderNodes(SUPPLY_VESSEL_WRECK_DEF as any, {}, { x: w.x, y: w.y, z: G.waterLevel, angle: w.angle }, SceneRenderer, cx, cy);
    };

    return { _drawBowWave, _drawBoatModel, _drawBoatWreck, _drawSubmarine, _drawResearchPlatform };
};
