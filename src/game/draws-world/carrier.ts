import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VEHICLE_STATE } from '../../shared/types';
import { applyParts, renderNodes } from '../def-utils';
import { getGround } from '../sim/terrain';
import CARRIER_DEF from '../models/carrier.zdef';
import CARRIER_CAR_DEF from '../models/carrier_car.zdef';
import CARRIER_DECK_TRACTOR_DEF from '../models/carrier_deck_tractor.zdef';
import CARRIER_DECK_CRATE_DEF from '../models/carrier_deck_crate.zdef';

export const createCarrierDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, drawFns: { drawHeli }, isVisible } = dwCtx;

    const _drawPadLights = (z: number, isCarrier = false) => {
        if (isCarrier) return; // handled by carrier.zdef lights
        const lz = z + 0.05;
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        const s = tileW / 64;
        [
            { x: G.PAD.xMin + 0.5, y: G.PAD.yMin + 0.5 },
            { x: G.PAD.xMax + 0.5, y: G.PAD.yMin + 0.5 },
            { x: G.PAD.xMax + 0.5, y: G.PAD.yMax + 0.5 },
            { x: G.PAD.xMin + 0.5, y: G.PAD.yMax + 0.5 },
        ].forEach(l => {
            SceneRenderer.add(null, {
                x: l.x, y: l.y, z: lz,
                drawFn: (cx: number, cy: number) => {
                    const p = isoFn(l.x, l.y, lz, cx, cy);
                    ctx.fillStyle = blink ? '#f00' : '#500';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, blink ? Math.max(1.5, 3 * s) : Math.max(1.2, 2.5 * s), 0, 7);
                    ctx.fill();
                },
            });
        });
    };

    const _drawVectorCarrier = (cx: number, cy: number, inCone: (x: number, y: number) => boolean) => {
        renderNodes(CARRIER_DEF as any, {}, { x: G.CARRIER.x, y: G.CARRIER.y, z: G.waterLevel, angle: G.CARRIER.angle }, SceneRenderer, cx, cy, { ctx, isoFn, tileW },
            (ni) => { if (ni === 1) _queueCarrierDeckObjects(inCone); },
        );
    };

    const _drawNpcHelis = (cx: number, cy: number, visMargin: number, showCarrier: boolean, inCone: (x: number, y: number) => boolean) => {
        for (const npc of G.npcHelis) {
            const visible = npc.state === VEHICLE_STATE.PARKED ? showCarrier : isVisible(npc.x, npc.y, visMargin);
            if (!visible) continue;
            if (!inCone(npc.x, npc.y)) continue;
            const groundBelow = npc.state === VEHICLE_STATE.PARKED ? npc.z : getGround(npc.x, npc.y);
            drawHeli(npc.type, npc.x, npc.y, npc.z, npc.angle, npc.tilt, npc.roll, npc.rotationPos, cx, cy, {
                isShadow: true, scaleOverride: 1, fillColor: '#556b2f', strokeColor: '#3a4a1f',
                shadowGetGround: () => groundBelow,
            });
            drawHeli(npc.type, npc.x, npc.y, npc.z, npc.angle, npc.tilt, npc.roll, npc.rotationPos, cx, cy, {
                scaleOverride: 1, fillColor: '#556b2f', strokeColor: '#3a4a1f',
            });
        }
    };

    const _queueCarrierDeckObjects = (inCone: (x: number, y: number) => boolean) => {
        const objX = G.CARRIER.x, objY = G.CARRIER.y;
        const deckZ = G.CARRIER.zDeck;
        const angle = G.CARRIER.angle;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const tractorAngle = Math.PI / 2 + angle;
        ([{ tx: 0.2, ty: 2.7 }, { tx: 1.4, ty: 2.7 }] as const).forEach(({ tx, ty }) => {
            const wx = objX + (tx - 0.36) * cosA - (ty + 0.5) * sinA;
            const wy = objY + (tx - 0.36) * sinA + (ty + 0.5) * cosA;
            if (!inCone(wx, wy)) return;
            SceneRenderer.add(CARRIER_DECK_TRACTOR_DEF as any, { x: wx, y: wy, z: deckZ + 0.01, angle: tractorAngle });
        });
        ([{ lx: 6.5, ly: 0.4 }, { lx: 6.0, ly: -0.2 }, { lx: 7.0, ly: -0.1 }] as const).forEach(({ lx, ly }) => {
            const wx = objX + lx * cosA - ly * sinA;
            const wy = objY + lx * sinA + ly * cosA;
            if (!inCone(wx, wy)) return;
            SceneRenderer.add(CARRIER_DECK_CRATE_DEF as any, { x: wx, y: wy, z: deckZ + 0.01, angle });
        });
        const car = G.carrierFuelCar;
        if (inCone(car.x, car.y))
            SceneRenderer.add(applyParts(CARRIER_CAR_DEF as any, { steerAngle: -(car.steerAngle ?? 0) }), {
                x: car.x, y: car.y, z: deckZ + 0.01, angle: car.angle + Math.PI,
            });
    };

    return { _drawPadLights, _drawVectorCarrier, _drawNpcHelis, _queueCarrierDeckObjects };
};
