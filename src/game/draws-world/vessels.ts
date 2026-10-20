import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VESSEL } from '../../shared/types';
import { renderNodes } from '../def-utils';
import { collapseParams } from '../sim/collapse';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SALVAGE_TUG_DEF from '../models/supply_vessel.zdef';
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

    const _drawBoatModel = (b: any) => {
        const p = collapseParams(b);
        if (b.objectType === VESSEL.PILOT_BOAT) {
            renderNodes(PILOT_BOAT_DEF as any, p, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer);
        } else if (b.objectType === VESSEL.SAR_BOAT) {
            renderNodes(SAR_BOAT_DEF as any, p, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer);
        } else if (b.objectType === VESSEL.FRIGATE) {
            renderNodes(FRIGATE_DEF as any, p, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer);
        } else if (b.objectType === VESSEL.SALVAGE_TUG || b.objectType === VESSEL.SUPPLY_VESSEL) {
            renderNodes(SALVAGE_TUG_DEF as any, p, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer);
        } else {
            renderNodes(SAILBOAT_DEF as any, p, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle }, SceneRenderer);
        }
    };

    const _drawSubmarine = (s: any) => {
        renderNodes(SUBMARINE_DEF as any, collapseParams(s), { x: s.x, y: s.y, z: G.waterLevel, angle: s.angle }, SceneRenderer);
    };

    const _drawResearchPlatform = (rp: any) => {
        renderNodes(RESEARCH_PLATFORM_DEF as any, collapseParams(rp), { x: rp.x, y: rp.y, z: G.waterLevel, angle: 0 }, SceneRenderer);
    };

    return { _drawBowWave, _drawBoatModel, _drawSubmarine, _drawResearchPlatform };
};
