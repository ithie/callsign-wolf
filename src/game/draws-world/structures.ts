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
import BAYWATCH_CAR_DEF from '../models/baywatch_car.zdef';
import BAYWATCH_HQ_DEF from '../models/baywatch_hq.zdef';
import BAYWATCH_TOWER_DEF from '../models/baywatch_tower.zdef';
import BUOY_DEF from '../models/buoy.zdef';
import CONCERT_STAGE_DEF from '../models/concert_stage.zdef';
import FESTIVAL_TENT_DEF from '../models/festival_tent.zdef';
import FESTIVAL_TENT_RED_DEF from '../models/festival_tent_red.zdef';
import FESTIVAL_TENT_GREEN_DEF from '../models/festival_tent_green.zdef';
import FESTIVAL_TENT_BROKEN_DEF from '../models/festival_tent_broken.zdef';
import FESTIVAL_TENT_BROKEN_RED_DEF from '../models/festival_tent_broken_red.zdef';
import FESTIVAL_TENT_BROKEN_GREEN_DEF from '../models/festival_tent_broken_green.zdef';
import FESTIVAL_CAR_RED_DEF from '../models/festival_car_red.zdef';
import FESTIVAL_CAR_BLUE_DEF from '../models/festival_car_blue.zdef';
import FESTIVAL_CAR_SILVER_DEF from '../models/festival_car_silver.zdef';
import FESTIVAL_CAR_BLACK_DEF from '../models/festival_car_black.zdef';
import FESTIVAL_CAR_YELLOW_DEF from '../models/festival_car_yellow.zdef';
import { VESSEL } from '../../shared/types';

export const createStructuresDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, tileH, getLighthouse, getWindStr } = dwCtx;

    const _drawWindTurbine = (tX: number, tY: number, spinning: boolean) => {
        const gz = getGround(tX, tY);
        const rotorAngle = spinning ? (Date.now() * 0.002) % (Math.PI * 2) : 0;
        SceneRenderer.add(applyParts(WIND_TURBINE_DEF as any, { rotorAngle }), { x: tX, y: tY, z: gz, angle: 0 });
    };

    const _drawDefLights = (x: number, y: number, def: { lights?: (typeof WIND_TURBINE_DEF)['lights'] }) => {
        const lights = def.lights;
        if (!lights?.length) return;
        const gz = getGround(x, y);
        SceneRenderer.add(null, {
            x: 0,
            y: 0,
            depth: x + y + 0.001,
            drawFn: (camX, camY) => {
                ctx.shadowBlur = 0;
                lights.forEach(l => {
                    const on = Math.floor(Date.now() / (500 / (l.blinkHz ?? 1))) % 2 === 0;
                    if (!on) return;
                    const p = isoFn(x + l.pos[0], y + l.pos[1], gz + l.pos[2], camX, camY);
                    ctx.fillStyle = l.glowColor ?? 'rgba(255,60,0,0.25)';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, l.glowRadius ?? 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = l.color ?? '#ff2200';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, l.radius ?? 1.5, 0, Math.PI * 2);
                    ctx.fill();
                });
            },
        });
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

    const _renderWindsock = (
        cx: number,
        cy: number,
        wx: number,
        wy: number,
        gz: number,
        windAngle: number,
        windStr: number
    ) => {
        const base = isoFn(wx, wy, gz, cx, cy);
        const top = isoFn(wx, wy, gz + 1.2, cx, cy);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        const windStrNorm = Math.min(1, Math.pow(windStr / 3.0, 0.55));
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
        const perpX = -wIsoY,
            perpY = wIsoX;
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
        const wx = G.PAD.xMin,
            wy = G.PAD.yMin + 8.8;
        _renderWindsock(cx, cy, wx, wy, getGround(wx, wy), G.wind.angle ?? Math.PI * 0.75, getWindStr());
    };

    const _drawLighthouse = (_cx: number, _cy: number) => {
        const lh = getLighthouse();
        if (!lh) return;
        const lhZ = getGround(lh.x, lh.y);
        SceneRenderer.add(LIGHTHOUSE_DEF, { x: lh.x, y: lh.y, z: lhZ });
        SceneRenderer.add(null, {
            x: 0,
            y: 0,
            depth: lh.x + lh.y + 0.001,
            drawFn: (camX, camY) => {
                const p = isoFn(lh.x, lh.y, lhZ + 8.1, camX, camY);
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
            },
        });
    };

    const _drawBaywatchObjects = (inCone: (x: number, y: number) => boolean) => {
        G.BAYWATCH_CARS.forEach((car: any) => {
            if (!inCone(car.x, car.y)) return;
            const gz = getGround(car.x, car.y);
            SceneRenderer.add(BAYWATCH_CAR_DEF as any, { x: car.x, y: car.y, z: gz, angle: car.angle });
        });
        G.BAYWATCH_BUILDINGS.forEach((b: any) => {
            if (!inCone(b.x, b.y)) return;
            const gz = getGround(b.x, b.y);
            const def = b.type === 'baywatch_hq' ? BAYWATCH_HQ_DEF : BAYWATCH_TOWER_DEF;
            SceneRenderer.add(def as any, { x: b.x, y: b.y, z: gz, angle: b.angle });
        });
    };

    const _drawBuoys = (inCone: (x: number, y: number) => boolean) => {
        const t = Date.now() * 0.0018;
        G.BUOYS.forEach((b: any) => {
            if (!inCone(b.x, b.y)) return;
            const gz = getGround(b.x, b.y);
            const bob = Math.sin(t + b.x * 0.61 + b.y * 0.37) * 0.07;
            SceneRenderer.add(BUOY_DEF as any, { x: b.x, y: b.y, z: gz + bob });
        });
    };

    const _FESTIVAL_CAR_DEFS: Record<string, unknown> = {
        [VESSEL.FESTIVAL_CAR_RED]:    FESTIVAL_CAR_RED_DEF,
        [VESSEL.FESTIVAL_CAR_BLUE]:   FESTIVAL_CAR_BLUE_DEF,
        [VESSEL.FESTIVAL_CAR_SILVER]: FESTIVAL_CAR_SILVER_DEF,
        [VESSEL.FESTIVAL_CAR_BLACK]:  FESTIVAL_CAR_BLACK_DEF,
        [VESSEL.FESTIVAL_CAR_YELLOW]: FESTIVAL_CAR_YELLOW_DEF,
    };

    const _drawFestivalObjects = (inCone: (x: number, y: number) => boolean) => {
        G.CONCERT_STAGES.forEach((s: any) => {
            if (!inCone(s.x, s.y)) return;
            SceneRenderer.add(CONCERT_STAGE_DEF as any, { x: s.x, y: s.y, z: s.gz, angle: s.angle });
        });
        const _TENT_DEFS: Record<string, unknown> = {
            [VESSEL.FESTIVAL_TENT]:             FESTIVAL_TENT_DEF,
            [VESSEL.FESTIVAL_TENT_RED]:         FESTIVAL_TENT_RED_DEF,
            [VESSEL.FESTIVAL_TENT_GREEN]:       FESTIVAL_TENT_GREEN_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN]:      FESTIVAL_TENT_BROKEN_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN_RED]:  FESTIVAL_TENT_BROKEN_RED_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN_GREEN]:FESTIVAL_TENT_BROKEN_GREEN_DEF,
        };
        G.FESTIVAL_TENTS.forEach((t: any) => {
            if (!inCone(t.x, t.y)) return;
            const def = _TENT_DEFS[t.type] ?? FESTIVAL_TENT_DEF;
            SceneRenderer.add(def as any, { x: t.x, y: t.y, z: t.gz, angle: t.angle });
        });
        G.FESTIVAL_CARS.forEach((c: any) => {
            if (!inCone(c.x, c.y)) return;
            const def = _FESTIVAL_CAR_DEFS[c.type] ?? FESTIVAL_CAR_SILVER_DEF;
            SceneRenderer.add(def as any, { x: c.x, y: c.y, z: c.gz, angle: c.angle });
        });
    };

    return {
        _drawWindTurbine,
        _drawDefLights,
        _drawPlaneWreck,
        _drawBrokenSailboat,
        _drawHangar,
        _drawLighthouse,
        _renderWindsock,
        _drawWindsock,
        _drawBaywatchObjects,
        _drawBuoys,
        _drawFestivalObjects,
    };
};
