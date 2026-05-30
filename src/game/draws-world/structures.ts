import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { applyParts } from '../def-utils';
import { getGround } from '../sim/terrain';
import WIND_TURBINE_DEF from '../models/wind_turbine.zdef';
import PLANE_WRECK_DEF from '../models/plane_wreck.zdef';
import SAILBOAT_BROKEN_DEF from '../models/sailboat_broken.zdef';
import HANGAR_DEF from '../models/hangar.zdef';
import TOWER_DEF from '../models/tower.zdef';
import LIGHTHOUSE_DEF from '../models/lighthouse.zdef';

export const createStructuresDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, tileH, getLighthouse, getWindStr } = dwCtx;

    const _drawWindTurbine = (tX: number, tY: number, spinning: boolean) => {
        const gz = getGround(tX, tY);
        const rotorAngle = spinning ? (Date.now() * 0.002) % (Math.PI * 2) : 0;
        SceneRenderer.add(applyParts(WIND_TURBINE_DEF as any, { rotorAngle }), { x: tX, y: tY, z: gz, angle: 0 });
    };

    const _drawPlaneWreck = (wx: number, wy: number, angle: number) => {
        const gz = getGround(wx, wy);
        SceneRenderer.add(PLANE_WRECK_DEF as any, { x: wx, y: wy, z: gz, angle });
    };

    const _drawBrokenSailboat = (bx: number, by: number, angle: number) => {
        const gz = getGround(bx, by);
        SceneRenderer.add(SAILBOAT_BROKEN_DEF as any, { x: bx, y: by, z: gz, angle: angle - Math.PI / 2 });
    };

    const _drawHangar = () => {
        SceneRenderer.add(HANGAR_DEF, { x: G.PAD.xMax - 3, y: G.PAD.yMin - 1, z: G.PAD.z, angle: Math.PI / 2 });
        SceneRenderer.add(TOWER_DEF, { x: G.PAD.xMax - 0.5, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
    };

    const _renderWindsock = (cx: number, cy: number, wx: number, wy: number, gz: number, windAngle: number, windStr: number) => {
        const base = isoFn(wx, wy, gz, cx, cy);
        const top = isoFn(wx, wy, gz + 1.2, cx, cy);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        const windStrNorm = Math.min(1, windStr / 5);
        let wIsoX: number, wIsoY: number;
        if (windStrNorm < 0.01) {
            wIsoX = 0;
            wIsoY = 4;
        } else {
            const rawX = (Math.cos(windAngle) - Math.sin(windAngle)) * (tileW / 2);
            const rawY = (Math.cos(windAngle) + Math.sin(windAngle)) * (tileH / 2);
            const len = Math.hypot(rawX, rawY);
            wIsoX = (rawX / len) * 5 * windStrNorm;
            wIsoY = (rawY / len) * 5 * windStrNorm;
        }
        const perpX = -wIsoY, perpY = wIsoX;
        const phase = Date.now() * 0.005;
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(top.x - perpX * 0.5, top.y - perpY * 0.5);
        ctx.lineTo(top.x + perpX * 0.5, top.y + perpY * 0.5);
        for (let i = 1; i <= 4; i++) {
            const t = i / 4;
            const bend = Math.sin(phase + i * 0.5) * 1.5 * t * windStrNorm;
            const px = top.x + wIsoX * i * 0.6 + perpX * (0.5 - t * 0.5) + bend * perpX * 0.2;
            const py = top.y + wIsoY * i * 0.6 + perpY * (0.5 - t * 0.5) + bend * perpY * 0.2;
            ctx.lineTo(px, py);
        }
        for (let i = 3; i >= 1; i--) {
            const t = i / 4;
            const bend = Math.sin(phase + i * 0.5) * 1.5 * t * windStrNorm;
            const px = top.x + wIsoX * i * 1.5 - perpX * (0.5 - t * 0.5) + bend * perpX * 0.2;
            const py = top.y + wIsoY * i * 1.5 - perpY * (0.5 - t * 0.5) + bend * perpY * 0.2;
            ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    };

    const _drawWindsock = (cx: number, cy: number) => {
        const wx = G.PAD.xMin, wy = G.PAD.yMin + 8.8;
        _renderWindsock(cx, cy, wx, wy, getGround(wx, wy), G.wind.angle ?? Math.PI * 0.75, getWindStr());
    };

    const _drawLighthouse = (_cx: number, _cy: number) => {
        const lh = getLighthouse();
        if (!lh) return;
        const lhZ = getGround(lh.x, lh.y);
        SceneRenderer.add(LIGHTHOUSE_DEF, { x: lh.x, y: lh.y, z: lhZ });
        SceneRenderer.add(null, { x: 0, y: 0, depth: lh.x + lh.y + 0.001, drawFn: (camX, camY) => {
            const p = isoFn(lh.x, lh.y, lhZ + 8.1, camX, camY);
            ctx.fillStyle = '#333';
            ctx.fillRect(p.x - 2, p.y - 10, 4, 10);
            if (Math.floor(Date.now() / 300) % 2 === 0) {
                ctx.fillStyle = 'rgba(255,255,200,0.8)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, 25, 12, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }});
    };

    return { _drawWindTurbine, _drawPlaneWreck, _drawBrokenSailboat, _drawHangar, _drawLighthouse, _renderWindsock, _drawWindsock };
};
