import type { DrawWorldCtx } from './types';
import { G, zstate } from '../state';
import { PAYLOAD } from '../../shared/types';
import { getGround } from '../sim/terrain';

export const createPayloadsDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, drawFns: { drawPerson }, isVisible, isNight } = dwCtx;

    // Draws one non-hanging, non-orni payload. cx/cy are the camera coords for this frame.
    const _drawSinglePayload = (payload: any, cx: number, cy: number) => {
        const p = isoFn(payload.x, payload.y, payload.z, cx, cy);
        if (payload.type === PAYLOAD.REINDEER) {
            const s = tileW * 0.18;
            ctx.fillStyle = '#8b5228';
            ctx.fillRect(p.x - s * 1.1, p.y - s * 0.55, s * 2.2, s * 0.65);
            ctx.fillStyle = '#7a4520';
            ctx.fillRect(p.x + s * 0.75, p.y - s * 1.0, s * 0.65, s * 0.45);
            ctx.fillStyle = '#dd2020';
            ctx.beginPath();
            ctx.arc(p.x + s * 1.25, p.y - s * 0.82, s * 0.14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5a3010';
            ctx.lineWidth = Math.max(0.8, tileW / 90);
            ctx.beginPath();
            ctx.moveTo(p.x + s * 0.9, p.y - s * 0.95);
            ctx.lineTo(p.x + s * 0.85, p.y - s * 1.55);
            ctx.lineTo(p.x + s * 1.2, p.y - s * 1.25);
            ctx.moveTo(p.x + s * 0.85, p.y - s * 1.55);
            ctx.lineTo(p.x + s * 0.55, p.y - s * 1.25);
            ctx.moveTo(p.x + s * 1.2, p.y - s * 0.95);
            ctx.lineTo(p.x + s * 1.3, p.y - s * 1.55);
            ctx.lineTo(p.x + s * 1.6, p.y - s * 1.25);
            ctx.moveTo(p.x + s * 1.3, p.y - s * 1.55);
            ctx.lineTo(p.x + s * 1.05, p.y - s * 1.25);
            ctx.stroke();
            return;
        }
        if (payload.type === PAYLOAD.CRATE) {
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
            const _rescuerColors = payload.type === PAYLOAD.RESCUER && G.heli.type === 'spinner'
                ? { shirt: '#0044cc', pants: '#001f80' }
                : payload.outfitColors;
            drawPerson(
                payload.x, payload.y, payload.z, 0, !payload.hanging,
                cx, cy,
                payload.type === PAYLOAD.RESCUER ? PAYLOAD.RESCUER : undefined,
                _rescuerColors,
                inWater,
            );
            if (inWater && payload.type === PAYLOAD.PERSON) {
                const pulse = 0.5 + 0.45 * Math.abs(Math.sin(Date.now() / 380));
                const br = Math.max(1.5, tileW * 0.045);
                ctx.globalAlpha = pulse;
                ctx.fillStyle = '#ff8800';
                ctx.beginPath();
                ctx.arc(p.x, p.y - tileW * 0.28, br, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            if (payload.z < 0) {
                ctx.strokeStyle = '#aaf';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, 7);
                ctx.stroke();
            }
        }
    };

    const drawPayloadObjects = (hangingOnly = false, ropeOnly = false) => {
        const night = isNight();
        const { cam } = zstate;
        G.payloads.forEach((payload: any) => {
            if (payload.rescued && !payload.hanging) return;
            if (hangingOnly && !payload.hanging) return;
            if (!hangingOnly && payload.hanging) return;
            // Vessel-deck payloads are queued into the final SceneRenderer flush via
            // queueAttachedPayloads() so they render correctly on top of their vessel.
            if (!hangingOnly && payload.attachTo) return;
            if (!payload.hanging && !isVisible(payload.x, payload.y)) return;

            // ORNI_WRECK visual rendering is handled in draw-world.ts — skip here,
            // except for rope drawing which falls through to the shared ropeOnly block below.
            if (payload.type === PAYLOAD.ORNI_WRECK && !ropeOnly) return;

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

            _drawSinglePayload(payload, cam.x, cam.y);
        });
    };

    // Enqueues vessel-deck payloads into the shared SceneRenderer batch.
    // Must be called AFTER vessels are added (lines 76-83 draw-world.ts) and
    // BEFORE the heli is added (line 95) so that on a depth tie the heli wins
    // via JS stable sort insertion order.
    const queueAttachedPayloads = (inCone: (x: number, y: number) => boolean) => {
        G.payloads.forEach((payload: any) => {
            if (payload.rescued && !payload.hanging) return;
            if (payload.hanging || !payload.attachTo) return;
            if (payload.type === PAYLOAD.ORNI_WRECK) return;
            if (!isVisible(payload.x, payload.y)) return;
            if (!inCone(payload.x, payload.y)) return;
            SceneRenderer.add(null, {
                x: 0, y: 0,
                depth: payload.x + payload.y,
                drawFn: (cx: number, cy: number) => _drawSinglePayload(payload, cx, cy),
            });
        });
    };

    return { drawPayloadObjects, queueAttachedPayloads };
};
