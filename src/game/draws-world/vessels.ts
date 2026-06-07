import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VESSEL } from '../../shared/types';
import { applyParts } from '../def-utils';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SALVAGE_TUG_DEF from '../models/supply_vessel.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';

export const createVesselsDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW } = dwCtx;

    const _drawBowWave = (
        x: number, y: number, angle: number, speed: number,
        cx: number, cy: number, hullOffset = 0, nCrests = 5,
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
            const s = isoFn(cX + Math.cos(perpDir) * halfW, cY + Math.sin(perpDir) * halfW, G.waterLevel, cx, cy);
            const e = isoFn(cX - Math.cos(perpDir) * halfW, cY - Math.sin(perpDir) * halfW, G.waterLevel, cx, cy);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    };

    const _drawBoatModel = (b: any) => {
        if (b.objectType === VESSEL.PILOT_BOAT) {
            const radarAngle = (Date.now() * 0.002) % (Math.PI * 2);
            SceneRenderer.add(applyParts(PILOT_BOAT_DEF as any, { radarAngle }), { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        } else if (b.objectType === VESSEL.SAR_BOAT) {
            const radarAngle = (Date.now() * 0.002) % (Math.PI * 2);
            SceneRenderer.add(applyParts(SAR_BOAT_DEF as any, { radarAngle }), { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        } else {
            const def = b.objectType === VESSEL.SALVAGE_TUG ? SALVAGE_TUG_DEF : SAILBOAT_DEF;
            SceneRenderer.add(def, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        }
    };

    const _drawSubmarine = (sX: number, sY: number, angle: number) => {
        SceneRenderer.add(SUBMARINE_DEF, { x: sX, y: sY, z: G.waterLevel, angle });
    };

    const _drawResearchPlatform = (rX: number, rY: number) => {
        SceneRenderer.add(RESEARCH_PLATFORM_DEF, { x: rX, y: rY, z: G.waterLevel, angle: 0 });
    };

    return { _drawBowWave, _drawBoatModel, _drawSubmarine, _drawResearchPlatform };
};
