import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { setLightningActive } from '../lightning-state';
import { renderNodes } from '../def-utils';
import { testTrainState } from '../sim/test-train';
import { getRailSamples, WATER_FLOAT_Z, WAGON_DECK_Z } from '../sim/test-train-path';
import FREIGHT_LOCOMOTIVE_DEF from '../models/objects/freight_locomotive.zdef';
import FREIGHT_WAGON_DEF from '../models/objects/freight_wagon.zdef';
import FREIGHT_CONTAINER_DEF from '../models/objects/freight_container.zdef';
import FREIGHT_BOGIE_DEF from '../models/objects/freight_bogie.zdef';

const _railSamples = getRailSamples();

export const createMiscDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, tileW, isVisible, isMissionRain, SceneRenderer } = dwCtx;

    const drawTestTrain = () => {
        if (!testTrainState.active) return;
        for (const car of testTrainState.cars) {
            // Bogies first (fully independent objects, each at its own track pose)
            // — body renders on top of them, not as their rotating parent.
            renderNodes(
                FREIGHT_BOGIE_DEF as any, {},
                { x: car.pose.rearBogie.x, y: car.pose.rearBogie.y, z: car.rearBogieZ, angle: car.pose.rearBogie.angle },
                SceneRenderer,
            );
            renderNodes(
                FREIGHT_BOGIE_DEF as any, {},
                { x: car.pose.frontBogie.x, y: car.pose.frontBogie.y, z: car.frontBogieZ, angle: car.pose.frontBogie.angle },
                SceneRenderer,
            );

            const instanceProps = { x: car.pose.bodyX, y: car.pose.bodyY, z: car.z, angle: car.pose.bodyAngle };
            if (car.kind === 'locomotive') {
                renderNodes(FREIGHT_LOCOMOTIVE_DEF as any, {}, instanceProps, SceneRenderer);
            } else {
                renderNodes(FREIGHT_WAGON_DEF as any, {}, instanceProps, SceneRenderer);
                const color = car.containerColor!;
                renderNodes(
                    FREIGHT_CONTAINER_DEF as any, {},
                    {
                        ...instanceProps, z: car.z + WAGON_DECK_Z,
                        colors: { ctop: color, cfront: color, cback: color, cleft: color, cright: color },
                    },
                    SceneRenderer,
                );
            }
        }
    };

    const _drawRail = (camX: number, camY: number, points: { x: number; y: number }[]) => {
        ctx.beginPath();
        points.forEach((p, i) => {
            const s = isoFn(p.x, p.y, WATER_FLOAT_Z, camX, camY);
            if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
    };

    const drawTestTrack = (camX: number, camY: number) => {
        if (!testTrainState.active) return;
        ctx.lineWidth = Math.max(1, tileW / 32);
        ctx.strokeStyle = '#4a3a2a';
        _drawRail(camX, camY, _railSamples.left);
        _drawRail(camX, camY, _railSamples.right);

        // sleepers — cross-ties between the two rails, one batched path
        ctx.strokeStyle = '#6b5a3a';
        ctx.lineWidth = Math.max(1, tileW / 40);
        ctx.beginPath();
        for (let i = 0; i < _railSamples.left.length; i++) {
            const a = isoFn(_railSamples.left[i].x, _railSamples.left[i].y, WATER_FLOAT_Z, camX, camY);
            const b = isoFn(_railSamples.right[i].x, _railSamples.right[i].y, WATER_FLOAT_Z, camX, camY);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
    };

    const drawBirds = (camX: number, camY: number) => {
        G.flocks.forEach((flock: any) => {
            flock.birds.forEach((bird: any) => {
                if (!isVisible(bird.x, bird.y, 20)) return;
                const pos = isoFn(bird.x, bird.y, bird.z, camX, camY);
                const wing = Math.sin(bird.wingPhase) * 3;
                const s = flock.fleeing ? 2.5 : 2.0;
                ctx.strokeStyle = flock.fleeing ? '#ccc' : '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x - s * 2, pos.y - wing * 0.4);
                ctx.lineTo(pos.x - s, pos.y + wing);
                ctx.lineTo(pos.x, pos.y);
                ctx.lineTo(pos.x + s, pos.y + wing);
                ctx.lineTo(pos.x + s * 2, pos.y - wing * 0.4);
                ctx.stroke();
            });
        });
    };

    const drawDebris = (debris: any[], camX: number, camY: number) => {
        debris.forEach(d => {
            const pos = isoFn(d.x, d.y, d.z, camX, camY);
            const cosA = Math.cos(d.angle), sinA = Math.sin(d.angle);
            const hw = (d.w * tileW) / 2, hh = (d.h * tileW) / 2;
            const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => ({
                x: pos.x + lx * cosA - ly * sinA,
                y: pos.y + lx * sinA * 0.5 + ly * cosA * 0.5,
            }));
            ctx.globalAlpha = Math.min(1.0, d.life * 0.5);
            ctx.fillStyle = d.color;
            ctx.strokeStyle = d.stroke;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            corners.slice(1).forEach(c => ctx.lineTo(c.x, c.y));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });
    };

    const renderSnow = (camX: number, camY: number) => {
        if (!G.snowFlakes.length) return;
        ctx.fillStyle = '#e8f0ff';
        for (const f of G.snowFlakes) {
            const pos = isoFn(f.wx, f.wy, f.wz, camX, camY);
            ctx.globalAlpha = f.alpha;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    };

    const renderRain = () => {
        if (!isMissionRain()) return;
        if (Math.random() < 0.005) {
            setLightningActive();
            const el = document.getElementById('flash-overlay')!;
            el.style.opacity = '0.8';
            setTimeout(() => (el.style.opacity = '0'), 100);
        }
    };

    return { drawBirds, drawDebris, renderRain, renderSnow, drawTestTrain, drawTestTrack };
};
