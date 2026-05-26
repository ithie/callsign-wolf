import type { IsoFn, SceneRenderer as SceneRendererType } from './scene-renderer';
import type { createDrawObjects } from './draw-objects';
import { getGround } from './sim/terrain';
import { G, zstate } from './state';
import { VEHICLE_STATE, VESSEL, PAYLOAD } from '../shared/types';
import { applyParts } from './def-utils';
import { getHeliType } from './heli-types';

import SAILBOAT_DEF from './models/sailboat.zdef';
import PILOT_BOAT_DEF from './models/pilot_boat.zdef';
import SALVAGE_TUG_DEF from './models/supply_vessel.zdef';
import RESEARCH_PLATFORM_DEF from './models/research_platform.zdef';
import WIND_TURBINE_DEF from './models/wind_turbine.zdef';
import PLANE_WRECK_DEF from './models/plane_wreck.zdef';
import ORNI_WRECK_CARRY_DEF from './models/ornithopter_wreck_carry.zdef';
import ORNI_WRECK_RESIDUE_DEF from './models/ornithopter_wreck_residue.zdef';
import SAILBOAT_BROKEN_DEF from './models/sailboat_broken.zdef';
import CARRIER_DEF from './models/carrier.zdef';
import SUBMARINE_DEF from './models/submarine.zdef';
import HANGAR_DEF from './models/hangar.zdef';
import TOWER_DEF from './models/tower.zdef';
import LIGHTHOUSE_DEF from './models/lighthouse.zdef';

export interface DrawWorldCtx {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    isoFn: IsoFn;
    SceneRenderer: SceneRendererType;
    tileW: number;
    tileH: number;
    stepH: number;
    drawFns: ReturnType<typeof createDrawObjects>;
    hasCarrier: () => boolean;
    hasPad: () => boolean;
    isVisible: (x: number, y: number, margin?: number) => boolean;
    getLighthouse: () => { x: number; y: number } | null;
    getWindStr: () => number;
    isNight: () => boolean;
    isApp: boolean;
    isMissionRain: () => boolean;
    getShowCollisionBoxes: () => boolean;
    triggerCrash: () => void;
}

export const createDrawWorld = (dwCtx: DrawWorldCtx) => {
    const {
        ctx, isoFn, SceneRenderer, tileW, tileH,
        drawFns: { drawPerson, drawTractor, drawFuelTruck, drawHeli },
        hasCarrier, hasPad, isVisible,
        getLighthouse, getWindStr, isNight,
        isMissionRain, getShowCollisionBoxes, triggerCrash,
    } = dwCtx;

    // ─── internal helpers ──────────────────────────────────────────────────────

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

    const _drawBowWave = (
        x: number, y: number, angle: number, speed: number,
        cx: number, cy: number, hullOffset = 0, nCrests = 5
    ) => {
        const wakeLen = Math.min(14, speed * 1.1);
        if (wakeLen < 1) return;
        const wakeDir = angle + Math.PI;
        const perpDir = angle + Math.PI / 2;
        const KELVIN_HALF = 0.34;
        const spacing = wakeLen / nCrests;
        const phase = (performance.now() * speed * 0.0002) % spacing;
        ctx.lineWidth = Math.max(1.5, tileW / 22);
        for (let i = 0; i < nCrests; i++) {
            const d = hullOffset + phase + i * spacing;
            const wakeProgress = (d - hullOffset) / wakeLen;
            if (wakeProgress >= 1) continue;
            const fade = Math.pow(1 - wakeProgress, 0.5);
            ctx.globalAlpha = fade * 0.72;
            ctx.strokeStyle = '#cce8f4';
            const cX = x + Math.cos(wakeDir) * d;
            const cY = y + Math.sin(wakeDir) * d;
            const halfW = d * Math.tan(KELVIN_HALF) * 1.2;
            const s = isoFn(cX + Math.cos(perpDir) * halfW, cY + Math.sin(perpDir) * halfW, G.waterLevel, cx, cy);
            const e = isoFn(cX - Math.cos(perpDir) * halfW, cY - Math.sin(perpDir) * halfW, G.waterLevel, cx, cy);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    };

    const _drawBoatModel = (b: any) => {
        if (b.objectType === VESSEL.PILOT_BOAT) {
            const radarAngle = (Date.now() * 0.002) % (Math.PI * 2);
            SceneRenderer.add(applyParts(PILOT_BOAT_DEF as any, { radarAngle }), { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        } else {
            const def = b.objectType === VESSEL.SALVAGE_TUG ? SALVAGE_TUG_DEF : SAILBOAT_DEF;
            SceneRenderer.add(def, { x: b.x, y: b.y, z: G.waterLevel, angle: b.angle });
        }
    };

    const _drawSubmarine = (sX: number, sY: number, angle: number) => {
        SceneRenderer.add(SUBMARINE_DEF, { x: sX, y: sY, z: G.waterLevel, angle });
    };

    const _drawResearchPlatform = (rX: number, rY: number) => {
        SceneRenderer.add(RESEARCH_PLATFORM_DEF, { x: rX, y: rY, z: G.waterLevel, angle: 0 });
    };

    const _drawWindTurbine = (tX: number, tY: number, spinning: boolean) => {
        const gz = getGround(tX, tY);
        const rotorAngle = spinning ? (Date.now() * 0.002) % (Math.PI * 2) : 0;
        SceneRenderer.add(applyParts(WIND_TURBINE_DEF as any, { rotorAngle }), { x: tX, y: tY, z: gz, angle: 0 });
    };

    const _drawPlaneWreck = (wx: number, wy: number, angle: number) => {
        const gz = getGround(wx, wy);
        SceneRenderer.add(PLANE_WRECK_DEF as any, { x: wx, y: wy, z: gz, angle });
    };

    const _drawBrokenSailboat = (bx: number, by: number, angle: number) => {
        const gz = getGround(bx, by);
        SceneRenderer.add(SAILBOAT_BROKEN_DEF as any, { x: bx, y: by, z: gz, angle: angle - Math.PI / 2 });
    };

    const _drawHangar = () => {
        SceneRenderer.add(HANGAR_DEF, { x: G.PAD.xMax - 3, y: G.PAD.yMin - 1, z: G.PAD.z, angle: Math.PI / 2 });
        SceneRenderer.add(TOWER_DEF, { x: G.PAD.xMax - 0.5, y: G.PAD.yMin - 1, z: G.PAD.z, angle: 0 });
    };

    const _drawWindsock = (cx: number, cy: number) => {
        const wx = G.PAD.xMin, wy = G.PAD.yMin + 8.8;
        const base = isoFn(wx, wy, getGround(wx, wy), cx, cy);
        const top = isoFn(wx, wy, getGround(wx, wy) + 1.2, cx, cy);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        const windStrNorm = Math.min(1, getWindStr() / 10);
        let wIsoX: number, wIsoY: number;
        if (windStrNorm < 0.01) {
            wIsoX = 0;
            wIsoY = 4;
        } else {
            const windAngle = G.wind.angle ?? Math.PI * 0.75;
            const rawX = (Math.cos(windAngle) - Math.sin(windAngle)) * (tileW / 2);
            const rawY = (Math.cos(windAngle) + Math.sin(windAngle)) * (tileH / 2);
            const len = Math.hypot(rawX, rawY);
            wIsoX = (rawX / len) * 5 * windStrNorm;
            wIsoY = (rawY / len) * 5 * windStrNorm;
        }
        const perpX = -wIsoY, perpY = wIsoX;
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

    const _drawLighthouse = (_cx: number, _cy: number) => {
        const lh = getLighthouse();
        if (!lh) return;
        const lhZ = getGround(lh.x, lh.y);
        SceneRenderer.add(LIGHTHOUSE_DEF, { x: lh.x, y: lh.y, z: lhZ });
        SceneRenderer.add(null, { x: 0, y: 0, depth: lh.x + lh.y + 0.001, drawFn: (camX, camY) => {
            const p = isoFn(lh.x, lh.y, lhZ + 8.1, camX, camY);
            ctx.fillStyle = '#333';
            ctx.fillRect(p.x - 2, p.y - 10, 4, 10);
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
        }});
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
            { tx: 0.2,  ty: 2.7, ta: Math.PI / 2, bc: '#9a7a00', bs: '#c8a000', bd: '#8a6c00', cc: '#b09000', cs: '#e0b800', ct: '#caa800' },
            { tx: 1.4,  ty: 2.7, ta: Math.PI / 2, bc: '#9a7a00', bs: '#c8a000', bd: '#8a6c00', cc: '#b09000', cs: '#e0b800', ct: '#caa800' },
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
            { x: objX, y: objY, z: G.waterLevel, angle, depth: towerWX + towerWY + 0.01 }
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

    const _drawNpcHelis = (cx: number, cy: number, visMargin: number) => {
        for (const npc of G.npcHelis) {
            const visible = npc.state === VEHICLE_STATE.PARKED
                ? isVisible(G.CARRIER.x, G.CARRIER.y, visMargin)
                : isVisible(npc.x, npc.y, visMargin);
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

    // ─── public ────────────────────────────────────────────────────────────────

    const drawWorldObjects = (camX: number, camY: number, visMargin: number, heliAt?: { x: number; y: number; fn: (camX: number, camY: number) => void }, queueFoliage?: (camX: number, camY: number) => void) => {
        if (hasCarrier() && isVisible(G.CARRIER.x, G.CARRIER.y, visMargin) && G.CARRIER.path !== 'static')
            _drawBowWave(G.CARRIER.x, G.CARRIER.y, G.CARRIER.angle, G.CARRIER.speedKnots, camX, camY, 9, 3);
        G.BOATS.forEach((b: any) => {
            if (isVisible(b.x, b.y, visMargin) && b.path !== 'static')
                _drawBowWave(b.x, b.y, b.angle, b.speedKnots, camX, camY, 2, 5);
        });
        G.SUBMARINES.forEach((s: any) => {
            if (isVisible(s.x, s.y, visMargin) && s.path !== 'static')
                _drawBowWave(s.x, s.y, s.angle, s.speedKnots, camX, camY, 3, 4);
        });

        if (hasCarrier() && isVisible(G.CARRIER.x, G.CARRIER.y, visMargin)) _drawVectorCarrier(camX, camY);
        _drawNpcHelis(camX, camY, visMargin);
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
        const lh = getLighthouse();
        if (lh && isVisible(lh.x, lh.y, visMargin)) _drawLighthouse(camX, camY);

        if (hasPad() && isVisible(G.PAD.xMin + 3, G.PAD.yMin + 3)) _drawHangar();
        if (hasPad() && G.fuelTruck && isVisible(G.fuelTruck.x, G.fuelTruck.y))
            drawFuelTruck(G.fuelTruck.x, G.fuelTruck.y, G.fuelTruck.angle, {
                z: G.PAD ? G.PAD.z : 0,
                armExtend: G.fuelTruck.arm,
                armTarget: { x: G.heli.x, y: G.heli.y },
                getFuelingState: () => G.fuelTruck.state === VEHICLE_STATE.FUELING,
            });
        if (hasPad()) _drawPadLights(G.PAD.z, false);
        if (queueFoliage) queueFoliage(camX, camY);
        if (heliAt) SceneRenderer.add(null, { x: 0, y: 0, depth: heliAt.x + heliAt.y, drawFn: (cx, cy) => heliAt.fn(cx, cy) });
        SceneRenderer.flush(camX, camY);
        if (hasPad() && isVisible(G.PAD.xMin, G.PAD.yMin)) _drawWindsock(camX, camY);
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

    const drawPayloadObjects = (hangingOnly = false, ropeOnly = false) => {
        const night = isNight();
        const { cam } = zstate;
        G.payloads.forEach((payload: any) => {
            if (payload.rescued && !payload.hanging) return;
            if (hangingOnly && !payload.hanging) return;
            if (!hangingOnly && payload.hanging) return;
            if (payload.type === PAYLOAD.ORNI_WRECK && !payload.hanging) return;
            if (!payload.hanging && !isVisible(payload.x, payload.y)) return;

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

            const p = isoFn(payload.x, payload.y, payload.z, cam.x, cam.y);
            if (payload.type === PAYLOAD.ORNI_WRECK) {
                SceneRenderer.add(ORNI_WRECK_CARRY_DEF as any, {
                    x: payload.x, y: payload.y, z: payload.z, angle: payload.angle ?? 0,
                });
                SceneRenderer.flush(cam.x, cam.y);
                return;
            } else if (payload.type === PAYLOAD.CRATE) {
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
                drawPerson(
                    payload.x, payload.y, payload.z, 0, !payload.hanging,
                    cam.x, cam.y,
                    payload.type === PAYLOAD.RESCUER ? PAYLOAD.RESCUER : undefined,
                    payload.outfitColors,
                    inWater
                );
                if (payload.z < 0) {
                    ctx.strokeStyle = '#aaf';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 6, 0, 7);
                    ctx.stroke();
                }
            }
        });
    };

    const renderRain = () => {
        if (!isMissionRain()) return;
        if (Math.random() < 0.005) {
            const el = document.getElementById('flash-overlay')!;
            el.style.opacity = '0.8';
            setTimeout(() => (el.style.opacity = '0'), 100);
        }
    };

    const drawCollisionBox = (wX: number, wY: number, angle: number, oxMin: number, oxMax: number, oyMin: number, oyMax: number, ozMin: number, ozMax: number, color: string) =>
        SceneRenderer.drawCollisionBox(zstate.cam.x, zstate.cam.y, wX, wY, angle, oxMin, oxMax, oyMin, oyMax, ozMin, ozMax, color);

    const checkCollisionBox = (
        px: number, py: number, pz: number,
        wX: number, wY: number, angle: number,
        oxMin: number, oxMax: number,
        oyMin: number, oyMax: number,
        ozMin: number, ozMax: number
    ) => {
        const dx = px - wX, dy = py - wY;
        const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        return lx >= oxMin && lx <= oxMax && ly >= oyMin && ly <= oyMax && pz >= ozMin && pz <= ozMax;
    };

    const drawDebugOverlay = (camX: number, camY: number) => {
        const isoP = (wx: number, wy: number, wz = 0) => isoFn(wx, wy, wz, camX, camY);

        const hx = G.heli.x, hy = G.heli.y;
        const gMin = -30, gMax = 30, gStep = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let x = Math.floor((hx + gMin) / gStep) * gStep; x <= hx + gMax; x += gStep) {
            const a = isoP(x, hy + gMin), b = isoP(x, hy + gMax);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        for (let y = Math.floor((hy + gMin) / gStep) * gStep; y <= hy + gMax; y += gStep) {
            const a = isoP(hx + gMin, y), b = isoP(hx + gMax, y);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let x = Math.floor((hx + gMin) / 10) * 10; x <= hx + gMax; x += 10) {
            for (let y = Math.floor((hy + gMin) / 10) * 10; y <= hy + gMax; y += 10) {
                const p = isoP(x, y);
                ctx.fillText(`${x},${y}`, p.x + 2, p.y - 2);
            }
        }

        const drawArrow = (fromP: { x: number; y: number }, toP: { x: number; y: number }, color: string, label: string) => {
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(fromP.x, fromP.y); ctx.lineTo(toP.x, toP.y); ctx.stroke();
            ctx.fillStyle = color; ctx.font = 'bold 10px monospace';
            ctx.fillText(label, toP.x + 3, toP.y - 3);
        };
        const orig = isoP(hx, hy, G.heli.z);
        drawArrow(orig, isoP(hx + 3, hy, G.heli.z), '#f44', '+X');
        drawArrow(orig, isoP(hx, hy + 3, G.heli.z), '#4f4', '+Y');
        drawArrow(orig, { x: orig.x, y: orig.y - 30 }, '#44f', '+Z');

        if (hasPad()) {
            const p = G.PAD;
            const corners = [isoP(p.xMin, p.yMin, p.z), isoP(p.xMax, p.yMin, p.z), isoP(p.xMax, p.yMax, p.z), isoP(p.xMin, p.yMax, p.z)];
            ctx.strokeStyle = 'rgba(0,255,200,0.7)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
            corners.forEach(c => ctx.lineTo(c.x, c.y)); ctx.closePath(); ctx.stroke();
            ctx.font = '10px monospace'; ctx.fillStyle = '#0fc';
            const lbl = isoP(p.xMin, p.yMin, p.z);
            ctx.fillText(`PAD xMin=${p.xMin} xMax=${p.xMax}`, lbl.x, lbl.y - 6);
            ctx.fillText(`yMin=${p.yMin} yMax=${p.yMax} z=${p.z}`, lbl.x, lbl.y + 6);

            const hX = p.xMax - 5, hY = p.yMin - 2;
            const hc = [isoP(hX, hY, p.z), isoP(hX + 4, hY, p.z), isoP(hX + 4, hY + 2, p.z), isoP(hX, hY + 2, p.z)];
            ctx.strokeStyle = 'rgba(255,80,0,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(hc[0].x, hc[0].y);
            hc.forEach(c => ctx.lineTo(c.x, c.y)); ctx.closePath(); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#f50'; ctx.font = '10px monospace';
            ctx.fillText('HANGAR', hc[0].x, hc[0].y - 5);

            const ft = G.fuelTruck;
            const ftP = isoP(ft.x, ft.y, p.z + 0.5);
            ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(ftP.x, ftP.y, 5, 0, Math.PI * 2); ctx.fill();
            const ftFwd = isoP(ft.x + Math.cos(ft.angle) * 2.5, ft.y + Math.sin(ft.angle) * 2.5, p.z + 0.5);
            ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(ftP.x, ftP.y); ctx.lineTo(ftFwd.x, ftFwd.y); ctx.stroke();
            const ftBack = isoP(ft.x - Math.cos(ft.angle) * 1.1, ft.y - Math.sin(ft.angle) * 1.1, p.z + 0.5);
            ctx.fillStyle = 'rgba(255,200,0,0.5)'; ctx.beginPath(); ctx.arc(ftBack.x, ftBack.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff0'; ctx.font = 'bold 10px monospace';
            ctx.fillText(`TRUCK: ${ft.state}`, ftP.x + 7, ftP.y - 8);
            ctx.fillText(`ang=${((ft.angle * 180) / Math.PI).toFixed(0)}°`, ftP.x + 7, ftP.y + 4);
            ctx.fillText(`x=${ft.x.toFixed(1)} y=${ft.y.toFixed(1)}`, ftP.x + 7, ftP.y + 16);
            const parkP = isoP(ft.localParkX, ft.localParkY, p.z);
            ctx.strokeStyle = 'rgba(255,200,0,0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(parkP.x, parkP.y, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,200,0,0.6)'; ctx.font = '9px monospace';
            ctx.fillText('PARK', parkP.x - 12, parkP.y + 14);
        }

        const zoneColor = (role: string) =>
            role === 'pickup' ? 'rgba(0,255,80,0.55)' : role === 'dropoff' ? 'rgba(255,140,0,0.55)' : 'rgba(255,255,0,0.55)';
        const drawZones = (vessel: any) => {
            for (const z of vessel.rescueZones ?? []) {
                drawCollisionBox(vessel.x, vessel.y, vessel.angle ?? 0, z.x - z.w, z.x + z.w, z.y - z.h, z.y + z.h, vessel.zDeck ?? 0, (vessel.zDeck ?? 0) + 0.25, zoneColor(z.role));
            }
        };
        if (hasCarrier()) drawZones(G.CARRIER);
        G.BOATS.forEach(drawZones);
        G.SUBMARINES.forEach(drawZones);
        G.RESEARCH_PLATFORMS.forEach(drawZones);

        const heliP = isoP(hx, hy, G.heli.z);
        ctx.fillStyle = '#f88'; ctx.font = 'bold 10px monospace';
        ctx.fillText(`HELI x=${hx.toFixed(1)} y=${hy.toFixed(1)} z=${G.heli.z.toFixed(2)}`, heliP.x - 40, heliP.y - 50);
        ctx.fillText(`inAir=${G.heli.inAir} RPM=${G.heli.rotorRPM.toFixed(2)}`, heliP.x - 40, heliP.y - 38);
        ctx.fillText(`ang=${((G.heli.angle * 180) / Math.PI).toFixed(0)}°`, heliP.x - 40, heliP.y - 26);
    };

    const handleCollisionBoxes = () => {
        const showCB = getShowCollisionBoxes();

        // ── Carrier ───────────────────────────────────────────────────────────────
        if (hasCarrier()) {
            const cx = G.CARRIER.x, cy = G.CARRIER.y, ca = G.CARRIER.angle;
            const deckZ = G.CARRIER.zDeck;
            if (showCB) drawCollisionBox(cx, cy, ca, -8.7, 8.7, -4.2, 4.2, 0, deckZ, 'rgba(0,200,255,0.8)');
            if (showCB) drawCollisionBox(cx, cy, ca, -5.5, -1.0, 2.6, 4.1, deckZ, deckZ + 2.5, 'rgba(255,80,0,0.9)');
            if (!zstate.crashed && G.heli.inAir) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, cx, cy, ca, -5.5, -1.0, 2.6, 4.1, deckZ, deckZ + 2.5))
                    triggerCrash();
            }
            G.npcHelis.filter(h => h.state === VEHICLE_STATE.PARKED).forEach(h => {
                const _hcb = getHeliType(h.type).collisionBox;
                const hb = { x1: _hcb.xMin, x2: _hcb.xMax, y1: _hcb.yMin, y2: _hcb.yMax, z2: _hcb.zMax };
                if (showCB) drawCollisionBox(h.x, h.y, h.angle, hb.x1, hb.x2, hb.y1, hb.y2, deckZ + 0.1, deckZ + 0.1 + hb.z2, 'rgba(0,255,100,0.8)');
                if (!zstate.crashed && G.heli.inAir) {
                    if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, h.x, h.y, h.angle, hb.x1, hb.x2, hb.y1, hb.y2, deckZ + 0.1, deckZ + 0.1 + hb.z2))
                        triggerCrash();
                }
            });
        }

        // ── Hangar + Tower ────────────────────────────────────────────────────────
        if (hasPad()) {
            const hX = G.PAD.xMax - 5, hY = G.PAD.yMin - 2, hZ = G.PAD.z;
            const hmx = hX + 2, hmy = hY + 1;
            if (showCB) drawCollisionBox(hmx, hmy, 0, -2, 2, -1, 1, hZ, hZ + 1.8, 'rgba(255,80,0,0.9)');
            if (!zstate.crashed && G.heli.inAir) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, hmx, hmy, 0, -2, 2, -1, 1, hZ, hZ + 1.8))
                    triggerCrash();
            }
            const tmx = G.PAD.xMax - 0.5, tmy = G.PAD.yMin - 1, tZ = G.PAD.z;
            if (showCB) drawCollisionBox(tmx, tmy, 0, -0.5, 0.5, -0.5, 0.5, tZ, tZ + 5, 'rgba(255,200,0,0.9)');
            if (!zstate.crashed && G.heli.inAir) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, tmx, tmy, 0, -0.5, 0.5, -0.5, 0.5, tZ, tZ + 5))
                    triggerCrash();
            }
        }

        // ── Fuel Truck ────────────────────────────────────────────────────────────
        if (hasPad() && G.fuelTruck.state !== VEHICLE_STATE.PARKED) {
            const ft = G.fuelTruck, fZ = G.PAD.z;
            if (showCB) drawCollisionBox(ft.x, ft.y, ft.angle, 0, 2.2, -0.45, 0.45, fZ, fZ + 0.9, 'rgba(255,200,0,0.8)');
            if (!zstate.crashed && G.heli.inAir) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, ft.x, ft.y, ft.angle, 0, 2.2, -0.45, 0.45, fZ, fZ + 0.9))
                    triggerCrash();
            }
        }

        // ── Lighthouse ────────────────────────────────────────────────────────────
        const lhPos = getLighthouse();
        if (lhPos) {
            if (showCB) {
                drawCollisionBox(lhPos.x, lhPos.y, 0, -4.0, 4.0, -4.0, 4.0, 0, 0.4, 'rgba(255,220,0,0.6)');
                drawCollisionBox(lhPos.x, lhPos.y, 0, -1.0, 1.0, -1.0, 1.0, 0.4, 8.0, 'rgba(255,80,0,0.9)');
            }
            if (!zstate.crashed) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, lhPos.x, lhPos.y, 0, -1.0, 1.0, -1.0, 1.0, 0.4, 8.5))
                    triggerCrash();
            }
        }

        // ── Boats ─────────────────────────────────────────────────────────────────
        G.BOATS.forEach((b: any) => {
            if (b.objectType === VESSEL.PILOT_BOAT) {
                if (showCB) {
                    drawCollisionBox(b.x, b.y, b.angle, -1.0, 1.0, -0.4, 0.4, 0, 0.3, 'rgba(0,255,100,0.8)');
                    drawCollisionBox(b.x, b.y, b.angle, -0.3, 0.5, -0.3, 0.3, 0.3, 0.9, 'rgba(255,80,0,0.9)');
                }
                if (!zstate.crashed) {
                    if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -1.0, 1.0, -0.4, 0.4, 0, 0.3) ||
                        checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -0.3, 0.5, -0.3, 0.3, 0.3, 0.9))
                        triggerCrash();
                }
            } else if (b.objectType === VESSEL.SALVAGE_TUG) {
                if (showCB) {
                    drawCollisionBox(b.x, b.y, b.angle, -2.5, 3.2, -1.2, 1.2, 0, 1.2, 'rgba(0,255,100,0.8)');
                    drawCollisionBox(b.x, b.y, b.angle, 1.0, 2.2, -0.8, 0.8, 1.2, 3.2, 'rgba(255,80,0,0.9)');
                }
                if (!zstate.crashed) {
                    if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -2.5, 3.2, -1.2, 1.2, 0, 1.2) ||
                        checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, 1.0, 2.2, -0.8, 0.8, 1.2, 3.2))
                        triggerCrash();
                }
            } else {
                if (showCB) {
                    drawCollisionBox(b.x, b.y, b.angle, -1.1, 1.3, -0.45, 0.45, 0, 0.35, 'rgba(0,255,100,0.8)');
                    drawCollisionBox(b.x, b.y, b.angle, -0.4, -0.2, -0.1, 0.1, 0.35, 3.2, 'rgba(255,80,0,0.9)');
                }
                if (!zstate.crashed) {
                    if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -1.1, 1.3, -0.45, 0.45, 0, 0.35) ||
                        checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -0.4, -0.2, -0.1, 0.1, 0.35, 3.2))
                        triggerCrash();
                }
            }
        });

        // ── Submarines ────────────────────────────────────────────────────────────
        G.SUBMARINES.forEach((s: any) => {
            if (showCB) {
                drawCollisionBox(s.x, s.y, s.angle, -5.2, 5.6, -0.7, 0.7, 0, 0.3, 'rgba(0,180,255,0.8)');
                drawCollisionBox(s.x, s.y, s.angle, 0.8, 2.3, -0.32, 0.32, 0.3, 2.4, 'rgba(255,80,0,0.9)');
            }
            if (!zstate.crashed) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, s.x, s.y, s.angle, -5.2, 5.6, -0.7, 0.7, 0, 0.3) ||
                    checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, s.x, s.y, s.angle, 0.8, 2.3, -0.32, 0.32, 0.3, 2.4))
                    triggerCrash();
            }
        });

        // ── Research platforms ────────────────────────────────────────────────────
        G.RESEARCH_PLATFORMS.forEach((rp: any) => {
            const wl = G.waterLevel;
            if (showCB) {
                drawCollisionBox(rp.x, rp.y, 0, -0.4, 0.4, -0.4, 0.4, wl, wl + 6.0, 'rgba(0,255,100,0.8)');
                drawCollisionBox(rp.x, rp.y, 0, -1.5, 1.5, -1.5, 1.5, wl + 6.0, wl + 6.5, 'rgba(0,255,100,0.8)');
                drawCollisionBox(rp.x, rp.y, 0, 0.8, 1.2, -0.2, 0.2, wl + 6.5, wl + 15.0, 'rgba(255,80,0,0.9)');
            }
            if (!zstate.crashed) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, rp.x, rp.y, 0, -0.4, 0.4, -0.4, 0.4, wl, wl + 6.0) ||
                    checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, rp.x, rp.y, 0, -1.5, 1.5, -1.5, 1.5, wl + 6.0, wl + 6.5) ||
                    checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, rp.x, rp.y, 0, 0.8, 1.2, -0.2, 0.2, wl + 6.5, wl + 15.0))
                    triggerCrash();
            }
        });

        // ── Wind turbines ─────────────────────────────────────────────────────────
        G.WIND_TURBINES.forEach((wt: any) => {
            if (showCB) {
                drawCollisionBox(wt.x, wt.y, 0, -0.3, 0.3, -0.3, 0.3, 0, 7.5, 'rgba(0,255,200,0.8)');
                drawCollisionBox(wt.x, wt.y, 0, -0.6, 1.2, -0.6, 0.6, 7.5, 8.5, 'rgba(255,80,0,0.9)');
            }
            if (!zstate.crashed) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, wt.x, wt.y, 0, -0.3, 0.3, -0.3, 0.3, 0, 7.5) ||
                    checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, wt.x, wt.y, 0, -0.6, 1.2, -0.6, 0.6, 7.5, 8.5))
                    triggerCrash();
            }
        });

        // ── Trees ─────────────────────────────────────────────────────────────────
        if (showCB) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0,255,100,0.75)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            const camX2 = zstate.cam.x, camY2 = zstate.cam.y;
            G.TREES_MAP.forEach((t: any) => {
                if (!isVisible(t.x, t.y)) return;
                const r = 0.35 * t.s, h = 2.3 * t.s;
                const corners = [
                    { x: t.x - r, y: t.y - r, z: t.gz }, { x: t.x + r, y: t.y - r, z: t.gz },
                    { x: t.x + r, y: t.y + r, z: t.gz }, { x: t.x - r, y: t.y + r, z: t.gz },
                    { x: t.x - r, y: t.y - r, z: t.gz + h }, { x: t.x + r, y: t.y - r, z: t.gz + h },
                    { x: t.x + r, y: t.y + r, z: t.gz + h }, { x: t.x - r, y: t.y + r, z: t.gz + h },
                ].map(p => isoFn(p.x, p.y, p.z, camX2, camY2));
                [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
                    .forEach(([a, b]) => {
                        ctx.beginPath();
                        ctx.moveTo(corners[a].x, corners[a].y);
                        ctx.lineTo(corners[b].x, corners[b].y);
                        ctx.stroke();
                    });
            });
            ctx.setLineDash([]);
            ctx.restore();
        }
        if (!zstate.crashed) {
            G.TREES_MAP.forEach((t: any) => {
                if (!isVisible(t.x, t.y)) return;
                const r = 0.35 * t.s, h = 2.3 * t.s;
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, t.x, t.y, 0, -r, r, -r, r, t.gz, t.gz + h))
                    triggerCrash();
            });
        }

        // ── Player heli box (debug only) ──────────────────────────────────────────
        if (showCB) {
            const _phcb = getHeliType(G.heli.type).collisionBox;
            const hb = { x1: _phcb.xMin, x2: _phcb.xMax, y1: _phcb.yMin, y2: _phcb.yMax, z2: _phcb.zMax };
            drawCollisionBox(G.heli.x, G.heli.y, G.heli.angle, hb.x1, hb.x2, hb.y1, hb.y2, G.heli.z, G.heli.z + hb.z2, 'rgba(255,255,0,0.9)');
        }
    };

    return { drawWorldObjects, drawBirds, drawDebris, drawPayloadObjects, renderRain, drawDebugOverlay, handleCollisionBoxes };
};
