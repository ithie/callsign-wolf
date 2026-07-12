import { G, zstate } from '../state';
import { PAYLOAD, VESSEL } from '../../shared/types';
import { getGround } from '../sim/terrain';
import { isLightningActive } from '../lightning-state';
import ORNI_WRECK_CARRY_DEF from '../models/ornithopter_wreck_carry.zdef';
import ORNI_WRECK_RESIDUE_DEF from '../models/ornithopter_wreck_residue.zdef';
import WIND_TURBINE_DEF from '../models/objects/wind_turbine.zdef';

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
    const { _drawBowWave, _drawBoatModel, _drawBoatWreck, _drawSubmarine, _drawResearchPlatform } = createVesselsDraw(dwCtx);
    const {
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
        _drawXmasObjects,
        _drawRings,
    } = createStructuresDraw(dwCtx);
    const { drawPayloadObjects, queueAttachedPayloads } = createPayloadsDraw(dwCtx);
    const { handleCollisionBoxes, drawDebugOverlay } = createCollisionDraw(dwCtx);
    const { drawBirds, drawDebris, renderRain } = createMiscDraw(dwCtx);

    const drawWorldObjects = (
        camX: number,
        camY: number,
        visMargin: number,
        heliAt?: { x: number; y: number; fn: (camX: number, camY: number) => void },
        queueFoliage?: (camX: number, camY: number) => void
    ) => {
        const _night = dwCtx.isNight();
        const _lightning = _night && isLightningActive();
        let _coneWidth = 0,
            _range2 = 0,
            _haX = 0,
            _haY = 0,
            _haA = 0;
        if (_night && !_lightning) {
            const _alt = G.heli.z - getGround(G.heli.x, G.heli.y);
            _coneWidth = 0.3 + _alt * 0.05;
            _range2 = (10 + _alt * 2.0) ** 2;
            _haX = G.heli.x;
            _haY = G.heli.y;
            _haA = G.heli.angle;
        }
        const _inNightCone = (ox: number, oy: number): boolean => {
            if (!_night || _lightning) return true;
            let diff = Math.atan2(oy - _haY, ox - _haX) - _haA;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const dx = ox - _haX,
                dy = oy - _haY;
            return Math.abs(diff) < _coneWidth && dx * dx + dy * dy < _range2;
        };
        const _inNightConeRect = (x: number, y: number, w: number, l: number, angle: number): boolean => {
            if (!_night || _lightning) return true;
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const dx = _haX - x, dy = _haY - y;
            if (Math.abs(dx * cosA + dy * sinA) <= w && Math.abs(-dx * sinA + dy * cosA) <= l) return true;
            const pt = (rx: number, ry: number) =>
                _inNightCone(x + rx * cosA - ry * sinA, y + rx * sinA + ry * cosA);
            // 4 corners + 4 edge midpoints + center — covers long objects where no corner
            // is in the cone but a middle section or near end is.
            return pt(w, l) || pt(w, -l) || pt(-w, l) || pt(-w, -l)
                || pt(w, 0) || pt(-w, 0) || pt(0, l) || pt(0, -l)
                || pt(0, 0);
        };
        const showCarrier = hasCarrier() && isVisible(G.CARRIER.x, G.CARRIER.y, visMargin + 9);
        const showPad = hasPad() && isVisible(G.PAD.xMin + 3, G.PAD.yMin + 3, visMargin);
        if (showCarrier && G.CARRIER.path !== 'static' && _inNightConeRect(G.CARRIER.x, G.CARRIER.y, G.CARRIER.w, G.CARRIER.l, G.CARRIER.angle))
            _drawBowWave(G.CARRIER.x, G.CARRIER.y, G.CARRIER.angle, G.CARRIER.speedKnots, camX, camY, 9, 3);
        G.BOATS.forEach((b: any) => {
            if (isVisible(b.x, b.y, visMargin) && b.path !== 'static' && _inNightConeRect(b.x, b.y, b.w, b.l, b.angle)) {
                const hullOff = b.objectType === 'frigate' ? 10 : 2;
                _drawBowWave(b.x, b.y, b.angle, b.speedKnots, camX, camY, hullOff);
            }
        });
        G.SUBMARINES.forEach((s: any) => {
            if (isVisible(s.x, s.y, visMargin) && s.path !== 'static' && _inNightConeRect(s.x, s.y, s.w, s.l, s.angle))
                _drawBowWave(s.x, s.y, s.angle, s.speedKnots, camX, camY, 3, 4);
        });

        if (showCarrier && _inNightConeRect(G.CARRIER.x, G.CARRIER.y, G.CARRIER.w, G.CARRIER.l, G.CARRIER.angle)) _drawVectorCarrier(camX, camY, _inNightCone);
        _drawNpcHelis(camX, camY, visMargin, showCarrier, _inNightCone);
        if (showCarrier && heliAt && !zstate.crashed && _inNightConeRect(G.CARRIER.x, G.CARRIER.y, G.CARRIER.w, G.CARRIER.l, G.CARRIER.angle)) {
            const c = G.CARRIER;
            const cosA = Math.cos(c.angle),
                sinA = Math.sin(c.angle);
            const dx = G.heli.x - c.x,
                dy = G.heli.y - c.y;
            const lx = dx * cosA + dy * sinA;
            const ly = -dx * sinA + dy * cosA;
            if (Math.abs(lx) <= c.w + 1 && Math.abs(ly) <= c.l + 1)
                dwCtx.drawFns.drawHeli(
                    G.heli.type,
                    G.heli.x,
                    G.heli.y,
                    G.heli.z,
                    G.heli.angle,
                    G.heli.tilt,
                    G.heli.roll,
                    G.heli.rotationPos,
                    camX,
                    camY,
                    { isShadow: true, shadowGetGround: () => c.zDeck }
                );
        }
        if (heliAt && !zstate.crashed) {
            G.BOATS.forEach((b: any) => {
                if (b.objectType !== VESSEL.FRIGATE) return;
                if (!isVisible(b.x, b.y, visMargin)) return;
                const cosA = Math.cos(b.angle), sinA = Math.sin(b.angle);
                const dx = G.heli.x - b.x, dy = G.heli.y - b.y;
                const lx = dx * cosA + dy * sinA, ly = -dx * sinA + dy * cosA;
                if (Math.abs(lx) > 14 || Math.abs(ly) > 5) return;
                dwCtx.drawFns.drawHeli(
                    G.heli.type, G.heli.x, G.heli.y, G.heli.z,
                    G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos,
                    camX, camY,
                    { isShadow: true, shadowGetGround: () => b.zDeck },
                );
            });
        }
        if (heliAt && !zstate.crashed) {
            G.RESEARCH_PLATFORMS.forEach((rp: any) => {
                if (!isVisible(rp.x, rp.y, visMargin)) return;
                if (Math.abs(G.heli.x - rp.x) > 3 || Math.abs(G.heli.y - rp.y) > 3) return;
                dwCtx.drawFns.drawHeli(
                    G.heli.type,
                    G.heli.x,
                    G.heli.y,
                    G.heli.z,
                    G.heli.angle,
                    G.heli.tilt,
                    G.heli.roll,
                    G.heli.rotationPos,
                    camX,
                    camY,
                    { isShadow: true, shadowGetGround: () => G.waterLevel + 6.5 }
                );
            });
        }
        G.ORNI_RESIDUES.forEach((r: any) => {
            if (!isVisible(r.x, r.y, visMargin)) return;
            SceneRenderer.add(ORNI_WRECK_RESIDUE_DEF as any, { x: r.x, y: r.y, z: getGround(r.x, r.y), angle: r.angle });
            SceneRenderer.flush(camX, camY);
        });
        G.payloads.forEach((p: any) => {
            if (p.type !== PAYLOAD.ORNI_WRECK || p.hanging || p.rescued) return;
            if (!isVisible(p.x, p.y, visMargin)) return;
            SceneRenderer.add(ORNI_WRECK_CARRY_DEF as any, { x: p.x, y: p.y, z: getGround(p.x, p.y), angle: p.angle ?? 0 });
            SceneRenderer.flush(camX, camY);
        });

        // all remaining objects go into the shared final batch (depth-sorted with heli)
        let _heliQueuedInFrigate = false;
        G.BOATS.forEach((b: any) => {
            if (!isVisible(b.x, b.y, visMargin) || !_inNightConeRect(b.x, b.y, b.w, b.l, b.angle)) return;
            if (heliAt && !zstate.crashed && b.objectType === VESSEL.FRIGATE) {
                const cosA = Math.cos(b.angle), sinA = Math.sin(b.angle);
                const dx = G.heli.x - b.x, dy = G.heli.y - b.y;
                const lx = dx * cosA + dy * sinA, ly = -dx * sinA + dy * cosA;
                if (Math.abs(lx) <= 14 && Math.abs(ly) <= 5) {
                    _heliQueuedInFrigate = true;
                    _drawBoatModel(b, camX, camY, (ni) => {
                        if (ni === 0) {
                            // Flush hull immediately, then heli alone — superstructure (node 1) renders last
                            SceneRenderer.flush(camX, camY);
                            SceneRenderer.add(null, { x: 0, y: 0, depth: heliAt.x + heliAt.y, drawFn: (cx, cy) => heliAt.fn(cx, cy) });
                            SceneRenderer.flush(camX, camY);
                        }
                    });
                    return;
                }
            }
            _drawBoatModel(b, camX, camY);
        });
        G.SUBMARINES.forEach((s: any) => {
            if (isVisible(s.x, s.y, visMargin) && _inNightConeRect(s.x, s.y, s.w, s.l, s.angle)) _drawSubmarine(s);
        });
        G.RESEARCH_PLATFORMS.forEach((rp: any) => {
            if (isVisible(rp.x, rp.y, visMargin) && _inNightCone(rp.x, rp.y)) _drawResearchPlatform(rp.x, rp.y);
        });
        G.WIND_TURBINES.forEach((wt: any) => {
            if (isVisible(wt.x, wt.y, visMargin) && _inNightCone(wt.x, wt.y)) _drawWindTurbine(wt);
            if (!wt.collapsing && _inNightCone(wt.x, wt.y)) _drawDefLights(wt.x, wt.y, WIND_TURBINE_DEF);
        });
        G.BOAT_WRECKS.forEach((w: any) => {
            if (isVisible(w.x, w.y, visMargin) && _inNightCone(w.x, w.y)) _drawBoatWreck(w, camX, camY);
        });
        G.PLANE_WRECKS.forEach((pw: any) => {
            if (isVisible(pw.x, pw.y, visMargin) && _inNightCone(pw.x, pw.y)) _drawPlaneWreck(pw.x, pw.y, pw.angle);
        });
        G.BROKEN_SAILBOATS.forEach((bs: any) => {
            if (isVisible(bs.x, bs.y, visMargin) && _inNightCone(bs.x, bs.y)) _drawBrokenSailboat(bs.x, bs.y, bs.angle);
        });
        _drawBaywatchObjects(_inNightCone);
        _drawBuoys(_inNightCone);
        _drawFestivalObjects(_inNightCone);
        _drawXmasObjects(_inNightCone);
        _drawRings(_inNightCone);
        const lh = dwCtx.getLighthouse();
        if (lh && isVisible(lh.x, lh.y, visMargin) && _inNightCone(lh.x, lh.y)) _drawLighthouse(camX, camY);

        if (showPad && _inNightCone(G.PAD.xMin + 3, G.PAD.yMin + 3)) _drawHangar();
        if (showPad && G.fuelTruck && _inNightCone(G.fuelTruck.x, G.fuelTruck.y))
            dwCtx.drawFns.drawFuelTruck(G.fuelTruck.x, G.fuelTruck.y, G.fuelTruck.angle, {
                z: G.PAD.z,
                armExtend: G.fuelTruck.arm,
                armTarget: { x: G.heli.x, y: G.heli.y },
                getFuelingState: () => G.fuelTruck.state === 'FUELING',
                steerAngle: G.fuelTruck.steerAngle ?? 0,
            });
        if (showPad && _inNightCone(G.PAD.xMin + 3, G.PAD.yMin + 3)) _drawPadLights(G.PAD.z, false);
        if (queueFoliage) queueFoliage(camX, camY);
        // Particle emitters — depth-sorted with world objects and heli
        G.PARTICLE_EMITTERS.forEach((e: any) => {
            if (!isVisible(e.x, e.y, visMargin) || !_inNightCone(e.x, e.y) || e.particles.length === 0) return;
            const _ctx = dwCtx.ctx;
            const _iso = dwCtx.isoFn;
            const _eParticles = e.particles.slice();
            SceneRenderer.add(null, {
                x: 0, y: 0, depth: e.x + e.y,
                drawFn: (cx: number, cy: number) => {
                    // Two-pass batch: fire first (below smoke), then smoke.
                    // Within each pass, group by rounded alpha to minimise fill() calls.
                    const ALPHA_STEP = 0.05;
                    const _drawPass = (filter: (p: any) => boolean, defaultColor: string) => {
                        const buckets = new Map<number, { color: string; arcs: { x: number; y: number; r: number }[] }>();
                        _eParticles.forEach((p: any) => {
                            if (!filter(p)) return;
                            const lifeRatio = Math.min(1, p.life / (p.maxLife ?? 2.0));
                            const alpha = p.isSmoke
                                ? Math.min(0.55, lifeRatio * 0.7)
                                : Math.min(0.85, lifeRatio * 2.0);
                            if (alpha <= 0.01) return;
                            const key = Math.round(alpha / ALPHA_STEP) * ALPHA_STEP;
                            const pos = _iso(p.x, p.y, Math.max(p.z, 0), cx, cy);
                            const ageRatio = 1 - lifeRatio;
                            const base = p.size ?? 5;
                            const r = p.isSmoke
                                ? base * (0.5 + ageRatio * 0.8)
                                : base * Math.max(0.2, 1 - ageRatio * 0.8);
                            if (!buckets.has(key)) buckets.set(key, { color: p.color ?? defaultColor, arcs: [] });
                            buckets.get(key)!.arcs.push({ x: pos.x, y: pos.y, r: Math.max(1, r) });
                        });
                        buckets.forEach(({ color, arcs }, alpha) => {
                            _ctx.globalAlpha = alpha;
                            _ctx.fillStyle = `rgb(${color})`;
                            _ctx.beginPath();
                            arcs.forEach(({ x, y, r }) => _ctx.arc(x, y, r, 0, Math.PI * 2));
                            _ctx.fill();
                        });
                    };
                    _drawPass(p => p.isFire, '240,100,0');
                    _drawPass(p => p.isSmoke, '130,125,120');
                    _ctx.globalAlpha = 1.0;
                },
            });
        });
        // Carrier deck objects are queued inside _drawVectorCarrier between hull and tower passes.
        // Vessel-deck payloads enqueued BEFORE the heli so that on an equal depth value
        // the heli wins via JS stable-sort insertion order (heli inserted after = drawn later = on top).
        if (!zstate.crashed) queueAttachedPayloads(_inNightCone);
        // Hanging ORNI_WRECK queued before heliAt so it renders behind the heli (same depth → stable-sort order wins).
        G.payloads.forEach((p: any) => {
            if (p.type !== PAYLOAD.ORNI_WRECK || !p.hanging || p.rescued) return;
            SceneRenderer.add(ORNI_WRECK_CARRY_DEF as any, { x: p.x, y: p.y, z: p.z, angle: p.angle ?? 0 });
        });
        if (heliAt && !_heliQueuedInFrigate)
            SceneRenderer.add(null, { x: 0, y: 0, depth: heliAt.x + heliAt.y, drawFn: (cx, cy) => heliAt.fn(cx, cy) });
        // Carrier windsock: queued before flush so it depth-sorts with the ship.
        if (showCarrier && _inNightConeRect(G.CARRIER.x, G.CARRIER.y, G.CARRIER.w, G.CARRIER.l, G.CARRIER.angle)) {
            const c = G.CARRIER;
            const cosA = Math.cos(c.angle),
                sinA = Math.sin(c.angle);
            const wsWX = c.x + -8.3 * cosA - -3.7 * sinA;
            const wsWY = c.y + -8.3 * sinA + -3.7 * cosA;
            const realWX = Math.cos(G.wind.angle ?? 0) * getWindStr();
            const realWY = Math.sin(G.wind.angle ?? 0) * getWindStr();
            const cVx = c.speed * cosA * 200;
            const cVy = c.speed * sinA * 200;
            const wsAngle = Math.atan2(realWY - cVy, realWX - cVx);
            const wsStr = Math.hypot(realWX - cVx, realWY - cVy);
            SceneRenderer.add(null, {
                x: 0,
                y: 0,
                depth: wsWX + wsWY,
                drawFn: (cx, cy) => _renderWindsock(cx, cy, wsWX, wsWY, c.zDeck, wsAngle, wsStr),
            });
        }
        SceneRenderer.flush(camX, camY);
        if (showPad && _inNightCone(G.PAD.xMin + 3, G.PAD.yMin + 3)) _drawWindsock(camX, camY);
    };

    return {
        drawWorldObjects,
        drawBirds,
        drawDebris,
        drawPayloadObjects,
        renderRain,
        drawDebugOverlay,
        handleCollisionBoxes,
    };
};
