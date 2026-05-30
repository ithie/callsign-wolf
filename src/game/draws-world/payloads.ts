import type { DrawWorldCtx } from './types';
import { G, zstate } from '../state';
import { PAYLOAD } from '../../shared/types';
import { getGround } from '../sim/terrain';
import ORNI_WRECK_CARRY_DEF from '../models/ornithopter_wreck_carry.zdef';

export const createPayloadsDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, drawFns: { drawPerson }, isVisible, isNight } = dwCtx;

    const drawPayloadObjects = (hangingOnly = false, ropeOnly = false) => {
        const night = isNight();
        const { cam } = zstate;
        G.payloads.forEach((payload: any) => {
            if (payload.rescued && !payload.hanging) return;
            if (hangingOnly && !payload.hanging) return;
            if (!hangingOnly && payload.hanging) return;
            if (payload.type === PAYLOAD.ORNI_WRECK && !payload.hanging) return;
            if (!payload.hanging && !isVisible(payload.x, payload.y)) return;

            if (night && !payload.hanging && !payload.attachTo) {
                const dx = payload.x - G.heli.x, dy = payload.y - G.heli.y;
                const alt = G.heli.z - getGround(G.heli.x, G.heli.y);
                if (Math.hypot(dx, dy) > 10 + alt * 2.0) return;
                let diff = Math.atan2(dy, dx) - G.heli.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                if (Math.abs(diff) > 0.3 + alt * 0.05) return;
            }

            if (ropeOnly) {
                if (!payload.hanging || G.heli.winch < 0.4) return;
                if (Math.hypot(payload.x - G.heli.x, payload.y - G.heli.y, payload.z - G.heli.z) > G.heli.winch + 3) return;
                const hPos = isoFn(G.heli.x, G.heli.y, G.heli.z, cam.x, cam.y);
                const pp = isoFn(payload.x, payload.y, payload.z, cam.x, cam.y);
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(hPos.x, hPos.y);
                ctx.lineTo(pp.x, pp.y - (payload.type === PAYLOAD.PERSON || payload.type === PAYLOAD.RESCUER ? 5 : 0));
                ctx.stroke();
                return;
            }

            if (payload.hanging && G.heli.winch < 0.4) return;

            const p = isoFn(payload.x, payload.y, payload.z, cam.x, cam.y);
            if (payload.type === PAYLOAD.ORNI_WRECK) {
                SceneRenderer.add(ORNI_WRECK_CARRY_DEF as any, {
                    x: payload.x, y: payload.y, z: payload.z, angle: payload.angle ?? 0,
                });
                SceneRenderer.flush(cam.x, cam.y);
                return;
            } else if (payload.type === PAYLOAD.CRATE) {
                ctx.fillStyle = '#d84';
                ctx.strokeStyle = '#530';
                ctx.lineWidth = Math.max(0.5, tileW / 64);
                const s = tileW * 0.22;
                ctx.fillRect(p.x - s / 2, p.y - s, s, s);
                ctx.strokeRect(p.x - s / 2, p.y - s, s, s);
            } else {
                const inWater =
                    !payload.hanging &&
                    G.waterLevel > 0 &&
                    getGround(payload.x, payload.y) < G.waterLevel;
                drawPerson(
                    payload.x, payload.y, payload.z, 0, !payload.hanging,
                    cam.x, cam.y,
                    payload.type === PAYLOAD.RESCUER ? PAYLOAD.RESCUER : undefined,
                    payload.outfitColors,
                    inWater,
                );
                if (payload.z < 0) {
                    ctx.strokeStyle = '#aaf';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6, 0, 7);
                    ctx.stroke();
                }
            }
        });
    };

    return { drawPayloadObjects };
};
