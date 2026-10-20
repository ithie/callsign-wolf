import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { renderNodes } from '../def-utils';
import { getGround } from '../sim/terrain';
import { getObjectDef } from '../def-registry';
import HANGAR_DEF from '../models/objects/hangar.zdef';
import JET_BUNKER_DEF from '../models/objects/jet_bunker.zdef';
import TOWER_DEF from '../models/objects/tower.zdef';
import HANGAR_TOWER_DEF from '../models/objects/hangar_tower.zdef';
import { VESSEL } from '../../shared/types';
import { resolvePalette } from '../defs';
import type { DEFInstanceOptions } from '../scene-renderer';
import { collapseParams, type Collapsible } from '../sim/collapse';

export const createStructuresDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, tileH, getLighthouse, getWindStr } = dwCtx;

    const _drawWindTurbine = (wt: any, heliAboveNacelle = false) => {
        const _def = getObjectDef(VESSEL.WIND_TURBINE);
        if (!_def) return;
        // wt.gz is precomputed in world-init.ts (clamped to never sink below the water
        // surface) — must match collision.ts's checkDef/drawDef and the delivery-zone
        // check in simulation.ts exactly, so don't recompute it here from raw terrain.
        const gz = wt.gz ?? getGround(wt.x, wt.y);
        const rotorAngle = wt.spinning ? (Date.now() * 0.002) % (Math.PI * 2) : 0;
        // Per node (mast, nacelle + rotor) so each part sorts with its own box.
        renderNodes(_def as any, { rotorAngle, ...collapseParams(wt) }, {
            x: wt.x, y: wt.y, z: gz, angle: 0,
            ...(heliAboveNacelle ? { colors: { n_top: '#707070' } } : {}),
        }, SceneRenderer);
    };

    interface _DefLight {
        pos: [number, number, number];
        color?: string;
        glowColor?: string;
        radius?: number;
        glowRadius?: number;
        blinkHz?: number;
        phase?: number;
        dutyCycle?: number;
    }

    const _drawDefLights = (x: number, y: number, def: { lights?: _DefLight[] }, entity?: Collapsible) => {
        const lights = def.lights as _DefLight[] | undefined;
        if (!lights?.length || entity?.destroyed) return;
        const gz = getGround(x, y);
        const lx = lights.map(l => x + l.pos[0]), ly = lights.map(l => y + l.pos[1]), lz = lights.map(l => gz + l.pos[2]);
        SceneRenderer.add(null, {
            x, y, z: gz,
            // Lights sit on the model's surface: same spot, drawn just after it on a tie.
            depth: x + y + 0.001,
            bounds: {
                x0: Math.min(...lx), x1: Math.max(...lx), y0: Math.min(...ly), y1: Math.max(...ly),
                z0: Math.min(...lz), z1: Math.max(...lz),
            },
            drawFn: (camX, camY) => {
                ctx.shadowBlur = 0;
                lights.forEach(l => {
                    let on = true;
                    if (l.blinkHz) {
                        const period = 1000 / l.blinkHz;
                        const t = (Date.now() + (l.phase ?? 0) * period) % period;
                        on = t < period * (l.dutyCycle ?? 0.5);
                    }
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

    const _drawPlaneWreck = (pw: any) => {
        const _def = getObjectDef(VESSEL.PLANE_WRECK);
        if (!_def) return;
        const gz = getGround(pw.x, pw.y);
        _addObjectDef(_def, { x: pw.x, y: pw.y, z: gz, angle: pw.angle }, pw);
    };

    const _drawBrokenSailboat = (bs: any) => {
        const _def = getObjectDef(VESSEL.SAILBOAT_BROKEN);
        if (!_def) return;
        const gz = getGround(bs.x, bs.y);
        _addObjectDef(_def, { x: bs.x, y: bs.y, z: gz, angle: bs.angle - Math.PI / 2 }, bs);
    };

    const _drawHangar = () => {
        const hangarDef = G.PAD.hangarVariant === 'bunker' ? JET_BUNKER_DEF : HANGAR_DEF;
        _addObjectDef(hangarDef, { x: G.PAD.xMax - 3, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
        const towerDef = G.PAD.towerVariant === 'new' ? HANGAR_TOWER_DEF : TOWER_DEF;
        const towerX = G.PAD.towerVariant === 'new' ? G.PAD.xMax : G.PAD.xMax - 0.5;
        _addObjectDef(towerDef, { x: towerX, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
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

    // Queued like everything else, so the heli and buildings sort against it.
    const _drawWindsock = () => {
        const wx = G.PAD.xMin,
            wy = G.PAD.yMin + 8.8;
        const gz = getGround(wx, wy);
        SceneRenderer.add(null, {
            x: wx, y: wy, z: gz,
            bounds: { x0: wx - 0.5, x1: wx + 0.5, y0: wy - 0.5, y1: wy + 0.5, z0: gz, z1: gz + 1.2 },
            drawFn: (cx, cy) => _renderWindsock(cx, cy, wx, wy, gz, G.wind.angle ?? Math.PI * 0.75, getWindStr()),
        });
    };

    const _drawLighthouse = () => {
        const lh = getLighthouse();
        if (!lh) return;
        const _lhDef = getObjectDef(VESSEL.LIGHTHOUSE);
        if (!_lhDef) return;
        const lhZ = getGround(lh.x, lh.y);
        _addObjectDef(_lhDef, { x: lh.x, y: lh.y, z: lhZ, angle: 0 });
        SceneRenderer.add(null, {
            x: lh.x, y: lh.y, z: lhZ + 8.1,
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

    // ZDEF2/D3F defs are node-based (no top-level .faces) and can't go through
    // SceneRenderer.add() directly. renderNodes() is the exact same function the
    // model editor's preview uses, so editor and game always agree.
    // `entity` (the placed object) feeds its collapse state into the model params.
    const _addObjectDef = (def: unknown, instanceProps: DEFInstanceOptions, entity?: Collapsible) => {
        if (!def) return;
        const version = (def as { version?: number }).version;
        if (version && version >= 2) renderNodes(def as any, collapseParams(entity), instanceProps, SceneRenderer as any);
        else SceneRenderer.add(def as any, instanceProps);
    };

    // Flat shadow rectangle at the vehicle's real footprint (from collisionBoxes),
    // rotated with the vehicle's own angle — not an ellipse or generic shape.
    const _drawVehicleShadow = (x: number, y: number, angle: number, def: unknown) => {
        const boxes = (def as { collisionBoxes?: Array<{ xMin: number; xMax: number; yMin: number; yMax: number }> })
            ?.collisionBoxes;
        if (!boxes?.length) return;
        const xMin = Math.min(...boxes.map(b => b.xMin));
        const xMax = Math.max(...boxes.map(b => b.xMax));
        const yMin = Math.min(...boxes.map(b => b.yMin));
        const yMax = Math.max(...boxes.map(b => b.yMax));
        const gz = getGround(x, y);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const corners: [number, number][] = [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];
        const wc = corners.map(([lx, ly]) => [x + lx * cosA - ly * sinA, y + lx * sinA + ly * cosA]);
        SceneRenderer.add(null, {
            x, y, z: gz, depth: x + y - 0.001,
            // Flat on the ground, so it sorts below the vehicle standing on it.
            bounds: {
                x0: Math.min(...wc.map(c => c[0])), x1: Math.max(...wc.map(c => c[0])),
                y0: Math.min(...wc.map(c => c[1])), y1: Math.max(...wc.map(c => c[1])), z0: gz, z1: gz,
            },
            drawFn: (camX: number, camY: number) => {
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                corners.forEach(([lx, ly], i) => {
                    const wx = x + lx * cosA - ly * sinA;
                    const wy = y + lx * sinA + ly * cosA;
                    const p = isoFn(wx, wy, gz, camX, camY);
                    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.fill();
            },
        });
    };

    const _drawBaywatchObjects = (inCone: (x: number, y: number) => boolean) => {
        const _carDef = getObjectDef(VESSEL.BAYWATCH_CAR);
        G.BAYWATCH_CARS.forEach((car: any) => {
            if (!inCone(car.x, car.y) || !_carDef) return;
            const gz = getGround(car.x, car.y);
            _drawVehicleShadow(car.x, car.y, car.angle, _carDef);
            _addObjectDef(_carDef, { x: car.x, y: car.y, z: gz, angle: car.angle }, car);
        });
        G.BAYWATCH_BUILDINGS.forEach((b: any) => {
            if (!inCone(b.x, b.y)) return;
            const _def = getObjectDef(b.type);
            if (!_def) return;
            const gz = getGround(b.x, b.y);
            _addObjectDef(_def, { x: b.x, y: b.y, z: gz, angle: b.angle }, b);
        });
    };

    const _drawBuoys = (inCone: (x: number, y: number) => boolean) => {
        const _def = getObjectDef(VESSEL.BUOY);
        const t = Date.now() * 0.0018;
        G.BUOYS.forEach((b: any) => {
            if (!inCone(b.x, b.y) || !_def) return;
            const gz = getGround(b.x, b.y);
            const bob = Math.sin(t + b.x * 0.61 + b.y * 0.37) * 0.07;
            _addObjectDef(_def, { x: b.x, y: b.y, z: gz + bob, angle: 0 }, b);
        });
    };

    const _drawFestivalObjects = (inCone: (x: number, y: number) => boolean) => {
        const _stageDef = getObjectDef(VESSEL.CONCERT_STAGE);
        G.CONCERT_STAGES.forEach((s: any) => {
            if (!inCone(s.x, s.y) || !_stageDef) return;
            _addObjectDef(_stageDef, { x: s.x, y: s.y, z: s.gz, angle: s.angle }, s);
        });
        G.FESTIVAL_TENTS.forEach((t: any) => {
            if (!inCone(t.x, t.y)) return;
            const _def = getObjectDef(t.type);
            if (!_def) return;
            const colors = resolvePalette(_def as any, t.colorVariant);
            _addObjectDef(_def, { x: t.x, y: t.y, z: t.gz, angle: t.angle, ...(colors ? { colors } : {}) }, t);
        });
        const _carDef = getObjectDef(VESSEL.FESTIVAL_CAR);
        G.FESTIVAL_CARS.forEach((c: any) => {
            if (!inCone(c.x, c.y) || !_carDef) return;
            const colors = resolvePalette(_carDef as any, c.colorVariant);
            _drawVehicleShadow(c.x, c.y, c.angle, _carDef);
            _addObjectDef(_carDef, { x: c.x, y: c.y, z: c.gz, angle: c.angle, ...(colors ? { colors } : {}) }, c);
        });
    };

    const _drawXmasObjects = (inCone: (x: number, y: number) => boolean) => {
        G.XMAS_HOUSES.forEach((h: any) => {
            if (!inCone(h.x, h.y)) return;
            const _def = getObjectDef(h.type) ?? getObjectDef(VESSEL.XMAS_HOUSE_A);
            if (!_def) return;
            const colors = resolvePalette(_def as any, h.colorVariant);
            _addObjectDef(_def, { x: h.x, y: h.y, z: h.gz, angle: h.angle ?? 0, ...(colors ? { colors } : {}) }, h);
            _drawDefLights(h.x, h.y, _def as any, h);
        });
        const _lanternDef = getObjectDef(VESSEL.XMAS_LANTERN);
        G.XMAS_LANTERNS.forEach((l: any) => {
            if (!inCone(l.x, l.y) || !_lanternDef) return;
            _addObjectDef(_lanternDef, { x: l.x, y: l.y, z: l.gz, angle: l.angle ?? 0 }, l);
            _drawDefLights(l.x, l.y, _lanternDef as any, l);
        });
        const _sleighDef = getObjectDef(VESSEL.SLEIGH);
        G.SLEIGHS.forEach((s: any) => {
            if (!inCone(s.x, s.y) || !_sleighDef) return;
            _addObjectDef(_sleighDef, { x: s.x, y: s.y, z: s.gz, angle: s.angle ?? 0 }, s);
        });
        const _reindeerDef = getObjectDef(VESSEL.REINDEER);
        G.REINDEER_OBJECTS.forEach((r: any) => {
            if (!inCone(r.x, r.y) || !_reindeerDef) return;
            _addObjectDef(_reindeerDef, { x: r.x, y: r.y, z: r.gz, angle: r.angle ?? 0 }, r);
        });
    };

    const _RING_SEGS = 24; // must be divisible by 3 for clean stripe groups

    const _drawRings = (inCone: (x: number, y: number) => boolean) => {
        G.RINGS.forEach(ring => {
            if (!inCone(ring.x, ring.y)) return;
            const r = ring.radius;
            const cosA = Math.cos(ring.angle), sinA = Math.sin(ring.angle);
            // The ring stands upright in the plane through its centre (normal = angle).
            const rx = r * Math.abs(sinA), ry = r * Math.abs(cosA);
            SceneRenderer.add(null, {
                x: ring.x, y: ring.y, z: ring.z, depth: ring.x + ring.y,
                bounds: { x0: ring.x - rx, x1: ring.x + rx, y0: ring.y - ry, y1: ring.y + ry, z0: ring.z - r, z1: ring.z + r },
                drawFn: (cx: number, cy: number) => {
                    const _rDist = Math.hypot(G.heli.x - ring.x, G.heli.y - ring.y, G.heli.z - ring.z);
                    const _rProx = ring.flown ? 0 : Math.max(0, 1 - _rDist / 12);
                    ctx.lineWidth = Math.max(2, 3 * tileW / 64) * (1 + _rProx * 0.6);
                    ctx.lineCap = 'butt';
                    // Ground shadow: projected outline of the tilted ring onto z=0
                    ctx.beginPath();
                    for (let si = 0; si <= 24; si++) {
                        const st = (si / 24) * Math.PI * 2;
                        const sp = isoFn(ring.x + r * Math.cos(st) * (-sinA), ring.y + r * Math.cos(st) * cosA, 0, cx, cy);
                        if (si === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                    ctx.lineWidth = Math.max(1, 1.5 * tileW / 64);
                    ctx.stroke();
                    if (ring.flown) {
                        ctx.strokeStyle = '#44ee44';
                        ctx.globalAlpha = 0.55;
                        ctx.beginPath();
                        for (let i = 0; i <= _RING_SEGS; i++) {
                            const t = (i / _RING_SEGS) * Math.PI * 2;
                            const p = isoFn(
                                ring.x + r * Math.cos(t) * (-sinA),
                                ring.y + r * Math.cos(t) * cosA,
                                ring.z + r * Math.sin(t),
                                cx, cy
                            );
                            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                        }
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    } else {
                        const now = performance.now() / 1000;
                        const rotOff = now * 0.9;
                        const rAnim = r * (1 + 0.055 * Math.sin(now * 2.4));
                        // yellow/black stripes: 3 segments per stripe group, 8 groups
                        for (let g = 0; g < _RING_SEGS / 3; g++) {
                            ctx.strokeStyle = g % 2 === 0 ? '#FFD700' : '#2a2a2a';
                            ctx.beginPath();
                            for (let s = 0; s < 3; s++) {
                                const i = g * 3 + s;
                                const t0 = (i / _RING_SEGS) * Math.PI * 2 + rotOff;
                                const t1 = ((i + 1) / _RING_SEGS) * Math.PI * 2 + rotOff;
                                const p0 = isoFn(
                                    ring.x + rAnim * Math.cos(t0) * (-sinA),
                                    ring.y + rAnim * Math.cos(t0) * cosA,
                                    ring.z + rAnim * Math.sin(t0),
                                    cx, cy
                                );
                                const p1 = isoFn(
                                    ring.x + rAnim * Math.cos(t1) * (-sinA),
                                    ring.y + rAnim * Math.cos(t1) * cosA,
                                    ring.z + rAnim * Math.sin(t1),
                                    cx, cy
                                );
                                if (s === 0) ctx.moveTo(p0.x, p0.y);
                                ctx.lineTo(p1.x, p1.y);
                            }
                            ctx.stroke();
                        }
                    }
                },
            });
        });
    };

    const _drawScenarioProps = (inCone: (x: number, y: number) => boolean) => {
        G.SCENARIO_PROPS.forEach((p: any) => {
            if (!inCone(p.x, p.y)) return;
            const _def = getObjectDef(p.type);
            if (!_def) return;
            _addObjectDef(_def, { x: p.x, y: p.y, z: p.gz, angle: p.angle ?? 0 }, p);
            _drawDefLights(p.x, p.y, _def as any, p);
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
        _drawXmasObjects,
        _drawRings,
        _drawScenarioProps,
    };
};
