import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { VEHICLE_STATE } from '../../shared/types';
import { applyParts } from '../def-utils';
import { getGround } from '../sim/terrain';
import CARRIER_DEF from '../models/carrier.zdef';

export const createCarrierDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, drawFns: { drawTractor, drawHeli }, isVisible } = dwCtx;

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
        const tractorData = [
            { tx: 0.2, ty: 2.7, ta: Math.PI / 2, bc: '#9a7a00', bs: '#c8a000', bd: '#8a6c00', cc: '#b09000', cs: '#e0b800', ct: '#caa800' },
            { tx: 1.4, ty: 2.7, ta: Math.PI / 2, bc: '#9a7a00', bs: '#c8a000', bd: '#8a6c00', cc: '#b09000', cs: '#e0b800', ct: '#caa800' },
        ];
        tractorData.forEach(t => {
            const wx = objX + (t.tx + 0.5) * cosA - (t.ty + 0.35) * sinA;
            const wy = objY + (t.tx + 0.5) * sinA + (t.ty + 0.35) * cosA;
            SceneRenderer.add(null, {
                x: wx, y: wy, z: deckZ,
                drawFn: (dcx: number, dcy: number) =>
                    drawTractor(objX, objY, angle, deckZ, dcx, dcy, t.tx, t.ty, t.ta, t.bc, t.bs, t.bd, t.cc, t.cs, t.ct),
            });
        });
        const car = G.carrierFuelCar;
        SceneRenderer.add(null, {
            x: car.x, y: car.y, z: deckZ,
            drawFn: (dcx: number, dcy: number) =>
                drawTractor(car.x, car.y, 0, deckZ, dcx, dcy, 0, 0, car.angle + Math.PI,
                    '#888888', '#dddddd', '#666666', '#aaaaaa', '#ffffff', '#eeeeee'),
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

    const _drawNpcHelis = (cx: number, cy: number, visMargin: number, showCarrier: boolean) => {
        for (const npc of G.npcHelis) {
            const visible = npc.state === VEHICLE_STATE.PARKED ? showCarrier : isVisible(npc.x, npc.y, visMargin);
            if (!visible) continue;
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
