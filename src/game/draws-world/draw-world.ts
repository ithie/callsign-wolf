import { G, zstate } from '../state';
import { PAYLOAD } from '../../shared/types';
import { getGround } from '../sim/terrain';
import ORNI_WRECK_CARRY_DEF from '../models/ornithopter_wreck_carry.zdef';
import ORNI_WRECK_RESIDUE_DEF from '../models/ornithopter_wreck_residue.zdef';

import { createCarrierDraw } from './carrier';
import { createVesselsDraw } from './vessels';
import { createStructuresDraw } from './structures';
import { createPayloadsDraw } from './payloads';
import { createCollisionDraw } from './collision';
import { createMiscDraw } from './misc';

export type { DrawWorldCtx } from './types';
export type { DrawWorldCtx as DrawWorldCtxType } from './types';
import type { DrawWorldCtx } from './types';

export const createDrawWorld = (dwCtx: DrawWorldCtx) => {
    const { SceneRenderer, isVisible, hasCarrier, hasPad, getWindStr } = dwCtx;

    const { _drawPadLights, _drawVectorCarrier, _drawNpcHelis } = createCarrierDraw(dwCtx);
    const { _drawBowWave, _drawBoatModel, _drawSubmarine, _drawResearchPlatform } = createVesselsDraw(dwCtx);
    const { _drawWindTurbine, _drawPlaneWreck, _drawBrokenSailboat, _drawHangar, _drawLighthouse, _renderWindsock, _drawWindsock } = createStructuresDraw(dwCtx);
    const { drawPayloadObjects, queueAttachedPayloads } = createPayloadsDraw(dwCtx);
    const { handleCollisionBoxes, drawDebugOverlay } = createCollisionDraw(dwCtx);
    const { drawBirds, drawDebris, renderRain } = createMiscDraw(dwCtx);

    const drawWorldObjects = (
        camX: number, camY: number, visMargin: number,
        heliAt?: { x: number; y: number; fn: (camX: number, camY: number) => void },
        queueFoliage?: (camX: number, camY: number) => void,
    ) => {
        const showCarrier = hasCarrier() && isVisible(G.CARRIER.x, G.CARRIER.y, visMargin + 9);
        const showPad = hasPad() && isVisible(G.PAD.xMin + 3, G.PAD.yMin + 3, visMargin);
        if (showCarrier && G.CARRIER.path !== 'static')
            _drawBowWave(G.CARRIER.x, G.CARRIER.y, G.CARRIER.angle, G.CARRIER.speedKnots, camX, camY, 9, 3);
        G.BOATS.forEach((b: any) => {
            if (isVisible(b.x, b.y, visMargin) && b.path !== 'static')
                _drawBowWave(b.x, b.y, b.angle, b.speedKnots, camX, camY, 2, 5);
        });
        G.SUBMARINES.forEach((s: any) => {
            if (isVisible(s.x, s.y, visMargin) && s.path !== 'static')
                _drawBowWave(s.x, s.y, s.angle, s.speedKnots, camX, camY, 3, 4);
        });

        if (showCarrier) _drawVectorCarrier(camX, camY);
        _drawNpcHelis(camX, camY, visMargin, showCarrier);
        if (showCarrier && heliAt && !zstate.crashed) {
            const c = G.CARRIER;
            const cosA = Math.cos(c.angle), sinA = Math.sin(c.angle);
            const dx = G.heli.x - c.x, dy = G.heli.y - c.y;
            const lx = dx * cosA + dy * sinA;
            const ly = -dx * sinA + dy * cosA;
            if (Math.abs(lx) <= c.w + 1 && Math.abs(ly) <= c.l + 1)
                dwCtx.drawFns.drawHeli(G.heli.type, G.heli.x, G.heli.y, G.heli.z, G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos, camX, camY,
                    { isShadow: true, shadowGetGround: () => c.zDeck });
        }
        if (heliAt && !zstate.crashed) {
            G.RESEARCH_PLATFORMS.forEach((rp: any) => {
                if (!isVisible(rp.x, rp.y, visMargin)) return;
                if (Math.abs(G.heli.x - rp.x) > 3 || Math.abs(G.heli.y - rp.y) > 3) return;
                dwCtx.drawFns.drawHeli(G.heli.type, G.heli.x, G.heli.y, G.heli.z, G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos, camX, camY,
                    { isShadow: true, shadowGetGround: () => G.waterLevel + 6.5 });
            });
        }
        G.payloads.forEach((p: any) => {
            if (p.type !== PAYLOAD.ORNI_WRECK || !isVisible(p.x, p.y, visMargin)) return;
            const gz = getGround(p.x, p.y);
            SceneRenderer.add(ORNI_WRECK_RESIDUE_DEF as any, { x: p.x, y: p.y, z: gz, angle: p.angle ?? 0 });
            if (!p.hanging && !p.rescued)
                SceneRenderer.add(ORNI_WRECK_CARRY_DEF as any, { x: p.x, y: p.y, z: gz, angle: p.angle ?? 0 });
            SceneRenderer.flush(camX, camY);
        });

        // all remaining objects go into the shared final batch (depth-sorted with heli)
        G.BOATS.forEach((b: any) => { if (isVisible(b.x, b.y, visMargin)) _drawBoatModel(b); });
        G.SUBMARINES.forEach((s: any) => { if (isVisible(s.x, s.y, visMargin)) _drawSubmarine(s.x, s.y, s.angle); });
        G.RESEARCH_PLATFORMS.forEach((rp: any) => { if (isVisible(rp.x, rp.y, visMargin)) _drawResearchPlatform(rp.x, rp.y); });
        G.WIND_TURBINES.forEach((wt: any) => { if (isVisible(wt.x, wt.y, visMargin)) _drawWindTurbine(wt.x, wt.y, wt.spinning); });
        G.PLANE_WRECKS.forEach((pw: any) => { if (isVisible(pw.x, pw.y, visMargin)) _drawPlaneWreck(pw.x, pw.y, pw.angle); });
        G.BROKEN_SAILBOATS.forEach((bs: any) => { if (isVisible(bs.x, bs.y, visMargin)) _drawBrokenSailboat(bs.x, bs.y, bs.angle); });
        const lh = dwCtx.getLighthouse();
        if (lh && isVisible(lh.x, lh.y, visMargin)) _drawLighthouse(camX, camY);

        if (showPad) _drawHangar();
        if (showPad && G.fuelTruck)
            dwCtx.drawFns.drawFuelTruck(G.fuelTruck.x, G.fuelTruck.y, G.fuelTruck.angle, {
                z: G.PAD.z,
                armExtend: G.fuelTruck.arm,
                armTarget: { x: G.heli.x, y: G.heli.y },
                getFuelingState: () => G.fuelTruck.state === 'FUELING',
            });
        if (showPad) _drawPadLights(G.PAD.z, false);
        if (queueFoliage) queueFoliage(camX, camY);
        // Vessel-deck payloads enqueued BEFORE the heli so that on an equal depth value
        // the heli wins via JS stable-sort insertion order (heli inserted after = drawn later = on top).
        if (!zstate.crashed) queueAttachedPayloads();
        if (heliAt) SceneRenderer.add(null, { x: 0, y: 0, depth: heliAt.x + heliAt.y, drawFn: (cx, cy) => heliAt.fn(cx, cy) });
        // Carrier windsock: queued before flush so it depth-sorts with the ship.
        if (showCarrier) {
            const c = G.CARRIER;
            const cosA = Math.cos(c.angle), sinA = Math.sin(c.angle);
            const wsWX = c.x + (-8.3) * cosA - (-3.7) * sinA;
            const wsWY = c.y + (-8.3) * sinA + (-3.7) * cosA;
            const realWX = Math.cos(G.wind.angle ?? 0) * getWindStr();
            const realWY = Math.sin(G.wind.angle ?? 0) * getWindStr();
            const cVx = c.speed * cosA * 200;
            const cVy = c.speed * sinA * 200;
            const wsAngle = Math.atan2(realWY - cVy, realWX - cVx);
            const wsStr   = Math.hypot(realWX - cVx, realWY - cVy);
            SceneRenderer.add(null, { x: 0, y: 0, depth: wsWX + wsWY,
                drawFn: (cx, cy) => _renderWindsock(cx, cy, wsWX, wsWY, c.zDeck, wsAngle, wsStr) });
        }
        SceneRenderer.flush(camX, camY);
        if (showPad) _drawWindsock(camX, camY);
    };

    return { drawWorldObjects, drawBirds, drawDebris, drawPayloadObjects, renderRain, drawDebugOverlay, handleCollisionBoxes };
};
