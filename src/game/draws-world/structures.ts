import type { DrawWorldCtx } from './types';
import { G } from '../state';
import { applyParts } from '../def-utils';
import { getGround } from '../sim/terrain';
import { getObjectDef } from '../def-registry';
import HANGAR_DEF from '../models/objects/hangar.zdef';
import TOWER_DEF from '../models/objects/tower.zdef';
import HANGAR_TOWER_DEF from '../models/objects/hangar_tower.zdef';
import { VESSEL } from '../../shared/types';
import { resolvePalette } from '../defs';

export const createStructuresDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, tileW, tileH, getLighthouse, getWindStr } = dwCtx;

    const _drawWindTurbine = (wt: any) => {
        const _def = getObjectDef(VESSEL.WIND_TURBINE);
        if (!_def) return;
        const gz = getGround(wt.x, wt.y);
        const t = wt.collapseT ?? 0;
        const rotorAngle = wt.spinning && !wt.collapsing ? (Date.now() * 0.002) % (Math.PI * 2) : 0;
        const nacelleAngle = t > 0 ? Math.min(1, t / 0.55) * 2.5 : 0;
        const poleAngle    = t > 0 ? Math.max(0, (t - 0.2) / 0.8) * 1.5 : 0;
        SceneRenderer.add(applyParts(_def as any, { rotorAngle, nacelleAngle, poleAngle }), { x: wt.x, y: wt.y, z: gz, angle: 0 });
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

    const _drawDefLights = (x: number, y: number, def: { lights?: _DefLight[] }) => {
        const lights = def.lights as _DefLight[] | undefined;
        if (!lights?.length) return;
        const gz = getGround(x, y);
        SceneRenderer.add(null, {
            x: 0,
            y: 0,
            depth: x + y + 0.001,
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

    const _drawPlaneWreck = (wx: number, wy: number, angle: number) => {
        const _def = getObjectDef(VESSEL.PLANE_WRECK);
        if (!_def) return;
        const gz = getGround(wx, wy);
        SceneRenderer.add(_def as any, { x: wx, y: wy, z: gz, angle });
    };

    const _drawBrokenSailboat = (bx: number, by: number, angle: number) => {
        const _def = getObjectDef(VESSEL.SAILBOAT_BROKEN);
        if (!_def) return;
        const gz = getGround(bx, by);
        SceneRenderer.add(_def as any, { x: bx, y: by, z: gz, angle: angle - Math.PI / 2 });
    };

    const _drawHangar = () => {
        SceneRenderer.add(HANGAR_DEF, { x: G.PAD.xMax - 3, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
        const towerDef = G.PAD.towerVariant === 'new' ? HANGAR_TOWER_DEF : TOWER_DEF;
        const towerX = G.PAD.towerVariant === 'new' ? G.PAD.xMax : G.PAD.xMax - 0.5;
        SceneRenderer.add(towerDef, { x: towerX, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
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

    const _drawWindsock = (cx: number, cy: number) => {
        const wx = G.PAD.xMin,
            wy = G.PAD.yMin + 8.8;
        _renderWindsock(cx, cy, wx, wy, getGround(wx, wy), G.wind.angle ?? Math.PI * 0.75, getWindStr());
    };

    const _drawLighthouse = (_cx: number, _cy: number) => {
        const lh = getLighthouse();
        if (!lh) return;
        const _lhDef = getObjectDef(VESSEL.LIGHTHOUSE);
        if (!_lhDef) return;
        const lhZ = getGround(lh.x, lh.y);
        SceneRenderer.add(_lhDef as any, { x: lh.x, y: lh.y, z: lhZ });
        SceneRenderer.add(null, {
            x: 0,
            y: 0,
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

    const _drawBaywatchObjects = (inCone: (x: number, y: number) => boolean) => {
        const _carDef = getObjectDef(VESSEL.BAYWATCH_CAR);
        G.BAYWATCH_CARS.forEach((car: any) => {
            if (!inCone(car.x, car.y) || !_carDef) return;
            const gz = getGround(car.x, car.y);
            SceneRenderer.add(_carDef as any, { x: car.x, y: car.y, z: gz, angle: car.angle });
        });
        G.BAYWATCH_BUILDINGS.forEach((b: any) => {
            if (!inCone(b.x, b.y)) return;
            const _def = getObjectDef(b.type);
            if (!_def) return;
            const gz = getGround(b.x, b.y);
            SceneRenderer.add(_def as any, { x: b.x, y: b.y, z: gz, angle: b.angle });
        });
    };

    const _drawBuoys = (inCone: (x: number, y: number) => boolean) => {
        const _def = getObjectDef(VESSEL.BUOY);
        const t = Date.now() * 0.0018;
        G.BUOYS.forEach((b: any) => {
            if (!inCone(b.x, b.y) || !_def) return;
            const gz = getGround(b.x, b.y);
            const bob = Math.sin(t + b.x * 0.61 + b.y * 0.37) * 0.07;
            SceneRenderer.add(_def as any, { x: b.x, y: b.y, z: gz + bob });
        });
    };

    const _drawFestivalObjects = (inCone: (x: number, y: number) => boolean) => {
        const _stageDef = getObjectDef(VESSEL.CONCERT_STAGE);
        G.CONCERT_STAGES.forEach((s: any) => {
            if (!inCone(s.x, s.y) || !_stageDef) return;
            SceneRenderer.add(_stageDef as any, { x: s.x, y: s.y, z: s.gz, angle: s.angle });
        });
        G.FESTIVAL_TENTS.forEach((t: any) => {
            if (!inCone(t.x, t.y)) return;
            const _def = getObjectDef(t.type);
            if (!_def) return;
            const colors = resolvePalette(_def as any, t.colorVariant);
            SceneRenderer.add(_def as any, { x: t.x, y: t.y, z: t.gz, angle: t.angle, ...(colors ? { colors } : {}) });
        });
        const _carDef = getObjectDef(VESSEL.FESTIVAL_CAR);
        G.FESTIVAL_CARS.forEach((c: any) => {
            if (!inCone(c.x, c.y) || !_carDef) return;
            const colors = resolvePalette(_carDef as any, c.colorVariant);
            SceneRenderer.add(_carDef as any, { x: c.x, y: c.y, z: c.gz, angle: c.angle, ...(colors ? { colors } : {}) });
        });
    };

    const _drawXmasObjects = (inCone: (x: number, y: number) => boolean) => {
        G.XMAS_HOUSES.forEach((h: any) => {
            if (!inCone(h.x, h.y)) return;
            const _def = getObjectDef(h.type) ?? getObjectDef(VESSEL.XMAS_HOUSE_A);
            if (!_def) return;
            const colors = resolvePalette(_def as any, h.colorVariant);
            SceneRenderer.add(_def as any, { x: h.x, y: h.y, z: h.gz, angle: h.angle ?? 0, ...(colors ? { colors } : {}) });
            _drawDefLights(h.x, h.y, _def as any);
        });
        const _lanternDef = getObjectDef(VESSEL.XMAS_LANTERN);
        G.XMAS_LANTERNS.forEach((l: any) => {
            if (!inCone(l.x, l.y) || !_lanternDef) return;
            SceneRenderer.add(_lanternDef as any, { x: l.x, y: l.y, z: l.gz, angle: l.angle ?? 0 });
            _drawDefLights(l.x, l.y, _lanternDef as any);
        });
        const _sleighDef = getObjectDef(VESSEL.SLEIGH);
        G.SLEIGHS.forEach((s: any) => {
            if (!inCone(s.x, s.y) || !_sleighDef) return;
            SceneRenderer.add(_sleighDef as any, { x: s.x, y: s.y, z: s.gz, angle: s.angle ?? 0 });
        });
        const _reindeerDef = getObjectDef(VESSEL.REINDEER);
        G.REINDEER_OBJECTS.forEach((r: any) => {
            if (!inCone(r.x, r.y) || !_reindeerDef) return;
            SceneRenderer.add(_reindeerDef as any, { x: r.x, y: r.y, z: r.gz, angle: r.angle ?? 0 });
        });
    };

    const _RING_SEGS = 24; // must be divisible by 3 for clean stripe groups

    const _drawRings = (inCone: (x: number, y: number) => boolean) => {
        G.RINGS.forEach(ring => {
            if (!inCone(ring.x, ring.y)) return;
            const r = ring.radius;
            const cosA = Math.cos(ring.angle), sinA = Math.sin(ring.angle);
            SceneRenderer.add(null, {
                x: 0, y: 0, depth: ring.x + ring.y,
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
            SceneRenderer.add(_def as any, { x: p.x, y: p.y, z: p.gz, angle: p.angle ?? 0 });
            _drawDefLights(p.x, p.y, _def as any);
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
