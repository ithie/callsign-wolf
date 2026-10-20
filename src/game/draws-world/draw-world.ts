import { G, zstate } from '../state';
import { PAYLOAD, VESSEL } from '../../shared/types';
import { getGround } from '../sim/terrain';
import { isLightningActive } from '../lightning-state';
import { isNightLit } from '../night-light';
import { applyNodes, renderNodes } from '../def-utils';
import ORNI_WRECK_CARRY_DEF from '../models/ornithopter_wreck_carry.zdef';
import ORNI_WRECK_RESIDUE_DEF from '../models/ornithopter_wreck_residue.zdef';
import WIND_TURBINE_DEF from '../models/objects/wind_turbine.zdef';
import { heliShadowBounds } from './heli-bounds';
import type { Box3, DrawFn } from '../scene-renderer';

import { createCarrierDraw } from './carrier';
import { createVesselsDraw } from './vessels';
import { createStructuresDraw } from './structures';
import { createPayloadsDraw } from './payloads';
import { createCollisionDraw } from './collision';
import { createMiscDraw } from './misc';
import { createVolleyballDraw } from './volleyball';

export type { DrawWorldCtx } from './types';

// The player heli as queued by game.ts: the heli itself and, separately, what
// hangs below it (rope + rescuer/payload) — each with its own bounds.
export type HeliDraw = { bounds: Box3; fn: DrawFn; winch?: { bounds: Box3; fn: DrawFn } };
export type { DrawWorldCtx as DrawWorldCtxType } from './types';
import type { DrawWorldCtx } from './types';

export const createDrawWorld = (dwCtx: DrawWorldCtx) => {
    const { SceneRenderer, isVisible, hasCarrier, hasPad, getWindStr } = dwCtx;

    const { _drawPadLights, _drawVectorCarrier, _drawNpcHelis } = createCarrierDraw(dwCtx);
    const { _drawBowWave, _drawBoatModel, _drawSubmarine, _drawResearchPlatform } = createVesselsDraw(dwCtx);
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
        _drawScenarioProps,
    } = createStructuresDraw(dwCtx);
    const { drawPayloadObjects, queueAttachedPayloads } = createPayloadsDraw(dwCtx);
    const { handleCollisionBoxes, drawDebugOverlay } = createCollisionDraw(dwCtx);
    const { drawBirds, drawDebris, renderRain, renderSnow, drawTestTrain, drawTestTrack } = createMiscDraw(dwCtx);
    const { _drawVolleyballCourts } = createVolleyballDraw(dwCtx);

    // Particles of one emitter as a single sort item; bounds = where they currently are.
    const _queueEmitterPass = (e: any, particles: any[], smoke: boolean) => {
        const _ctx = dwCtx.ctx;
        const _iso = dwCtx.isoFn;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const p of particles) {
            const pz = Math.max(p.z, 0);
            if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
            if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
        }
        if (x0 === Infinity) return;
        SceneRenderer.add(null, {
            x: e.x, y: e.y, z: e.gz,
            // Smoke at +0.5 so it wins ties against the heli when overhead.
            depth: e.x + e.y + (smoke ? 0.5 : 0),
            bounds: { x0, x1, y0, y1, z0, z1 },
            drawFn: (cx: number, cy: number) => {
                // Group by rounded alpha to minimise fill() calls.
                const ALPHA_STEP = 0.05;
                const buckets = new Map<number, { color: string; arcs: { x: number; y: number; r: number }[] }>();
                for (const p of particles) {
                    const lifeRatio = Math.min(1, p.life / (p.maxLife ?? 2.0));
                    const alpha = p.isSmoke
                        ? Math.min(0.55, lifeRatio * 0.7)
                        : p.isSpark
                            ? Math.min(0.95, lifeRatio * 1.5)
                            : Math.min(0.85, lifeRatio * 2.0);
                    if (alpha <= 0.01) continue;
                    const key = Math.round(alpha / ALPHA_STEP) * ALPHA_STEP;
                    const pos = _iso(p.x, p.y, Math.max(p.z, 0), cx, cy);
                    const ageRatio = 1 - lifeRatio;
                    const base = p.size ?? 5;
                    const r = p.isSmoke
                        ? base * (0.5 + ageRatio * 0.8)
                        : p.isSpark
                            ? base
                            : ageRatio < 0.28
                                ? base * (0.5 + ageRatio * 1.79)
                                : base * Math.max(0.05, 1.0 - (ageRatio - 0.28) / 0.72);
                    if (!buckets.has(key)) buckets.set(key, { color: p.color ?? '240,100,0', arcs: [] });
                    buckets.get(key)!.arcs.push({ x: pos.x, y: pos.y, r: Math.max(1, r) });
                }
                buckets.forEach(({ color, arcs }, alpha) => {
                    _ctx.globalAlpha = alpha;
                    _ctx.fillStyle = `rgb(${color})`;
                    _ctx.beginPath();
                    arcs.forEach(({ x, y, r }) => { _ctx.moveTo(x + r, y); _ctx.arc(x, y, r, 0, Math.PI * 2); });
                    _ctx.fill();
                });
                _ctx.globalAlpha = 1.0;
            },
        });
    };

    // Everything below is queued into ONE batch and flushed once at the end: the
    // renderer sorts all items by their 3D bounding boxes (see scene-renderer.ts), so
    // the queueing order here does not matter for what ends up in front.
    const drawWorldObjects = (
        camX: number,
        camY: number,
        visMargin: number,
        heliAt?: HeliDraw,
        queueFoliage?: (camX: number, camY: number) => void
    ) => {
        const _night = dwCtx.isNight();
        const _lightning = _night && isLightningActive();
        const _haX = G.heli.x,
            _haY = G.heli.y;
        const _inNightCone = (ox: number, oy: number): boolean => {
            if (!_night || _lightning) return true;
            return isNightLit(ox, oy);
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
        const carrierLit = showCarrier && _inNightConeRect(G.CARRIER.x, G.CARRIER.y, G.CARRIER.w, G.CARRIER.l, G.CARRIER.angle);

        // Bow waves are painted straight onto the water, below everything queued.
        if (showCarrier && G.CARRIER.path !== 'static' && carrierLit)
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

        if (carrierLit) _drawVectorCarrier(_inNightCone);
        _drawNpcHelis(visMargin, showCarrier, _inNightCone);

        // Heli shadow on a deck it hovers over (the ground shadow is painted by game.ts).
        const _queueDeckShadow = (deckZ: number) => {
            if (!heliAt || zstate.crashed) return;
            SceneRenderer.add(null, {
                x: G.heli.x, y: G.heli.y, z: deckZ,
                bounds: heliShadowBounds(G.heli.type, G.heli.x, G.heli.y, deckZ, G.heli.angle),
                drawFn: (cx, cy) => dwCtx.drawFns.drawHeli(
                    G.heli.type, G.heli.x, G.heli.y, G.heli.z,
                    G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos,
                    cx, cy,
                    { isShadow: true, shadowGetGround: () => deckZ },
                ),
            });
        };
        const _heliOver = (o: any, angle: number, halfX: number, halfY: number): boolean => {
            const cosA = Math.cos(angle), sinA = Math.sin(angle);
            const dx = G.heli.x - o.x, dy = G.heli.y - o.y;
            return Math.abs(dx * cosA + dy * sinA) <= halfX && Math.abs(-dx * sinA + dy * cosA) <= halfY;
        };
        if (carrierLit && _heliOver(G.CARRIER, G.CARRIER.angle, G.CARRIER.w + 1, G.CARRIER.l + 1)) _queueDeckShadow(G.CARRIER.zDeck);
        G.BOATS.forEach((b: any) => {
            if (b.objectType === VESSEL.FRIGATE && isVisible(b.x, b.y, visMargin) && _heliOver(b, b.angle, 14, 5)) _queueDeckShadow(b.zDeck);
        });
        G.RESEARCH_PLATFORMS.forEach((rp: any) => {
            if (isVisible(rp.x, rp.y, visMargin) && _heliOver(rp, 0, 3, 3)) _queueDeckShadow(G.waterLevel + 6.5);
        });

        G.ORNI_RESIDUES.forEach((r: any) => {
            if (!isVisible(r.x, r.y, visMargin)) return;
            renderNodes(ORNI_WRECK_RESIDUE_DEF as any, {}, { x: r.x, y: r.y, z: getGround(r.x, r.y), angle: r.angle }, SceneRenderer);
        });
        G.payloads.forEach((p: any) => {
            if (p.type !== PAYLOAD.ORNI_WRECK || p.rescued) return;
            if (p.hanging) {
                SceneRenderer.add(applyNodes(ORNI_WRECK_CARRY_DEF as any, {}), { x: p.x, y: p.y, z: p.z, angle: p.angle ?? 0 });
                return;
            }
            if (!isVisible(p.x, p.y, visMargin)) return;
            renderNodes(ORNI_WRECK_CARRY_DEF as any, {}, { x: p.x, y: p.y, z: getGround(p.x, p.y), angle: p.angle ?? 0 }, SceneRenderer);
        });

        G.BOATS.forEach((b: any) => {
            if (isVisible(b.x, b.y, visMargin) && _inNightConeRect(b.x, b.y, b.w, b.l, b.angle)) _drawBoatModel(b);
        });
        G.SUBMARINES.forEach((s: any) => {
            if (isVisible(s.x, s.y, visMargin) && _inNightConeRect(s.x, s.y, s.w, s.l, s.angle)) _drawSubmarine(s);
        });
        G.RESEARCH_PLATFORMS.forEach((rp: any) => {
            if (isVisible(rp.x, rp.y, visMargin) && _inNightCone(rp.x, rp.y)) _drawResearchPlatform(rp);
        });
        G.PLANE_WRECKS.forEach((pw: any) => {
            if (isVisible(pw.x, pw.y, visMargin) && _inNightCone(pw.x, pw.y)) _drawPlaneWreck(pw);
        });
        G.BROKEN_SAILBOATS.forEach((bs: any) => {
            if (isVisible(bs.x, bs.y, visMargin) && _inNightCone(bs.x, bs.y)) _drawBrokenSailboat(bs);
        });
        _drawBaywatchObjects(_inNightCone);
        _drawBuoys(_inNightCone);
        _drawVolleyballCourts(_inNightCone);
        _drawFestivalObjects(_inNightCone);
        _drawXmasObjects(_inNightCone);
        _drawScenarioProps(_inNightCone);
        _drawRings(_inNightCone);
        const lh = dwCtx.getLighthouse();
        if (lh && isVisible(lh.x, lh.y, visMargin) && _inNightCone(lh.x, lh.y)) _drawLighthouse();

        if (showPad && _inNightCone(G.PAD.xMin + 3, G.PAD.yMin + 3)) {
            _drawPadLights(G.PAD.z, false);
            _drawHangar();
            _drawWindsock();
        }
        if (showPad && G.fuelTruck && _inNightCone(G.fuelTruck.x, G.fuelTruck.y))
            dwCtx.drawFns.drawFuelTruck(G.fuelTruck.x, G.fuelTruck.y, G.fuelTruck.angle, {
                z: G.PAD.z,
                armExtend: G.fuelTruck.arm,
                armTarget: { x: G.heli.x, y: G.heli.y },
                getFuelingState: () => G.fuelTruck.state === 'FUELING',
                steerAngle: G.fuelTruck.steerAngle ?? 0,
            });

        // Read at draw time (production .zdefs are only populated after decompression).
        const _nz = (WIND_TURBINE_DEF as any).rescueZones?.[0];
        G.WIND_TURBINES.forEach((wt: any) => {
            if (isVisible(wt.x, wt.y, visMargin) && _inNightCone(wt.x, wt.y)) {
                // Nacelle roof darkens as a placement aid while the heli hovers above the
                // nacelle's rescue zone — same extents simulation.ts delivers in.
                const heliAboveNacelle = !!heliAt && !zstate.crashed && !!_nz && !wt.destroyed
                    && Math.abs(G.heli.x - (wt.x + _nz.x)) <= _nz.w && Math.abs(G.heli.y - (wt.y + _nz.y)) <= _nz.h
                    && G.heli.z >= wt.gz + _nz.z - 0.5;
                _drawWindTurbine(wt, heliAboveNacelle);
            }
            if (_inNightCone(wt.x, wt.y)) _drawDefLights(wt.x, wt.y, WIND_TURBINE_DEF, wt);
        });
        if (queueFoliage) queueFoliage(camX, camY);

        G.PARTICLE_EMITTERS.forEach((e: any) => {
            if (!isVisible(e.x, e.y, visMargin) || !_inNightCone(e.x, e.y) || e.particles.length === 0) return;
            _queueEmitterPass(e, e.particles.filter((p: any) => !!p.isFire || !!p.isSpark), false);
            _queueEmitterPass(e, e.particles.filter((p: any) => !!p.isSmoke), true);
        });

        if (!zstate.crashed) queueAttachedPayloads(_inNightCone);
        if (heliAt) {
            SceneRenderer.add(null, { x: G.heli.x, y: G.heli.y, z: G.heli.z, bounds: heliAt.bounds, drawFn: heliAt.fn });
            if (heliAt.winch) SceneRenderer.add(null, { x: G.heli.x, y: G.heli.y, z: G.heli.z, bounds: heliAt.winch.bounds, drawFn: heliAt.winch.fn });
        }
        // Carrier windsock on the deck.
        if (carrierLit) {
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
                x: wsWX, y: wsWY, z: c.zDeck,
                bounds: { x0: wsWX - 0.5, x1: wsWX + 0.5, y0: wsWY - 0.5, y1: wsWY + 0.5, z0: c.zDeck, z1: c.zDeck + 1.2 },
                drawFn: (cx, cy) => _renderWindsock(cx, cy, wsWX, wsWY, c.zDeck, wsAngle, wsStr),
            });
        }
        SceneRenderer.flush(camX, camY);
    };

    return {
        drawWorldObjects,
        drawBirds,
        drawDebris,
        drawPayloadObjects,
        renderRain,
        renderSnow,
        drawDebugOverlay,
        handleCollisionBoxes,
        drawTestTrain,
        drawTestTrack,
    };
};
