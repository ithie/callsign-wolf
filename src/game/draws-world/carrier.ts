import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VEHICLE_STATE } from '../../shared/types';
import { applyParts } from '../def-utils';
import { getGround } from '../sim/terrain';
import CARRIER_DEF from '../models/carrier.zdef';
import CARRIER_CAR_DEF from '../models/carrier_car.zdef';
import CARRIER_DECK_TRACTOR_DEF from '../models/carrier_deck_tractor.zdef';
import CARRIER_DECK_CRATE_DEF from '../models/carrier_deck_crate.zdef';

export const createCarrierDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, drawFns: { drawHeli }, isVisible } = dwCtx;

    const _setLightsOnDeck = (lights: Array<{ x: number; y: number }>, blink: boolean, z: number) => {
        const lz = z + 0.05;
        lights.forEach(l => {
            SceneRenderer.add(null, {
                x: l.x, y: l.y, z: lz,
                drawFn: (cx: number, cy: number) => {
                    const p = isoFn(l.x, l.y, lz, cx, cy);
                    ctx.fillStyle = blink ? '#f00' : '#500';
                    ctx.beginPath();
                    const s = tileW / 64;
                    ctx.arc(p.x, p.y, blink ? Math.max(1.5, 3 * s) : Math.max(1.2, 2.5 * s), 0, 7);
                    ctx.fill();
                },
            });
        });
    };

    const _drawPadLights = (z: number, isCarrier = false) => {
        const blink = Math.floor(Date.now() / 500) % 2 === 0;
        if (isCarrier) {
            const cw = 8.7, cl = 4.2, ang = G.CARRIER.angle;
            const r = (rx: number, ry: number) => ({
                x: G.CARRIER.x + rx * Math.cos(ang) - ry * Math.sin(ang),
                y: G.CARRIER.y + rx * Math.sin(ang) + ry * Math.cos(ang),
            });
            _setLightsOnDeck([r(-cw, -cl), r(cw, -cl), r(cw, cl), r(-cw, cl)], blink, z);
        } else {
            _setLightsOnDeck([
                { x: G.PAD.xMin + 0.5, y: G.PAD.yMin + 0.5 },
                { x: G.PAD.xMax + 0.5, y: G.PAD.yMin + 0.5 },
                { x: G.PAD.xMax + 0.5, y: G.PAD.yMax + 0.5 },
                { x: G.PAD.xMin + 0.5, y: G.PAD.yMax + 0.5 },
            ], blink, z);
        }
    };

    const _drawVectorCarrier = (cx: number, cy: number) => {
        const objX = G.CARRIER.x, objY = G.CARRIER.y;
        const deckZ = G.CARRIER.zDeck;
        const angle = G.CARRIER.angle;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const r = (rx: number, ry: number) => ({
            x: objX + rx * cosA - ry * sinA,
            y: objY + rx * sinA + ry * cosA,
        });
        SceneRenderer.add(applyParts(CARRIER_DEF, {}, { only: ['hull'] }), { x: objX, y: objY, z: G.waterLevel, angle });
        SceneRenderer.flush(cx, cy);

        const ix = -5.5, iy = 2.6, iw = 4.5, il = 1.5, ih = 2.5;
        const tractorAngle = Math.PI / 2 + angle;
        ([{ tx: 0.2, ty: 2.7 }, { tx: 1.4, ty: 2.7 }] as const).forEach(({ tx, ty }) => {
            const cx = objX + (tx - 0.36) * cosA - (ty + 0.5) * sinA;
            const cy = objY + (tx - 0.36) * sinA + (ty + 0.5) * cosA;
            SceneRenderer.add(CARRIER_DECK_TRACTOR_DEF as any, { x: cx, y: cy, z: deckZ + 0.01, angle: tractorAngle });
        });
        ([{ lx: 6.5, ly: 0.4 }, { lx: 6.0, ly: -0.2 }, { lx: 7.0, ly: -0.1 }] as const).forEach(({ lx, ly }) => {
            const cx = objX + lx * cosA - ly * sinA;
            const cy = objY + lx * sinA + ly * cosA;
            SceneRenderer.add(CARRIER_DECK_CRATE_DEF as any, { x: cx, y: cy, z: deckZ + 0.01, angle });
        });
        const car = G.carrierFuelCar;
        SceneRenderer.add(applyParts(CARRIER_CAR_DEF as any, { steerAngle: -(car.steerAngle ?? 0) }), {
            x: car.x, y: car.y, z: deckZ + 0.01, angle: car.angle + Math.PI,
        });
        const towerWX = objX + (ix + iw / 2) * cosA - (iy + il / 2) * sinA;
        const towerWY = objY + (ix + iw / 2) * sinA + (iy + il / 2) * cosA;
        SceneRenderer.add(applyParts(CARRIER_DEF, {}, { only: ['tower'] }), {
            x: objX, y: objY, z: G.waterLevel, angle, depth: towerWX + towerWY,
        });
        SceneRenderer.add(
            applyParts(CARRIER_DEF, { radarAngle: Date.now() * 0.002 }, { only: ['radar_mast', 'radar_arm'] }),
            { x: objX, y: objY, z: G.waterLevel, angle, depth: towerWX + towerWY + 0.01 },
        );
        _drawPadLights(G.CARRIER.zDeck, true);
        SceneRenderer.flush(cx, cy);

        const antB = r(ix + iw * 0.5, iy + il * 0.25);
        const a0 = isoFn(antB.x, antB.y, deckZ + ih, cx, cy);
        const a1 = isoFn(antB.x, antB.y, deckZ + ih + 0.6, cx, cy);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
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

    return { _drawPadLights, _drawVectorCarrier, _drawNpcHelis };
};
