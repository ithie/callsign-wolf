import type { DrawWorldCtx } from './types';
import { G, zstate } from '../state';
import { VESSEL, VEHICLE_STATE } from '../../shared/types';
import { getHeliType } from '../heli-types';
import SAILBOAT_DEF from '../models/sailboat.zdef';
import PILOT_BOAT_DEF from '../models/pilot_boat.zdef';
import SAR_BOAT_DEF from '../models/sar_boat.zdef';
import SALVAGE_TUG_DEF from '../models/supply_vessel.zdef';
import SUBMARINE_DEF from '../models/submarine.zdef';
import RESEARCH_PLATFORM_DEF from '../models/research_platform.zdef';
import WIND_TURBINE_DEF from '../models/wind_turbine.zdef';
import LIGHTHOUSE_DEF from '../models/lighthouse.zdef';
import BAYWATCH_CAR_DEF from '../models/baywatch_car.zdef';
import BAYWATCH_HQ_DEF from '../models/baywatch_hq.zdef';
import BAYWATCH_TOWER_DEF from '../models/baywatch_tower.zdef';
import CONCERT_STAGE_DEF from '../models/concert_stage.zdef';
import FESTIVAL_TENT_DEF from '../models/festival_tent.zdef';
import FESTIVAL_TENT_RED_DEF from '../models/festival_tent_red.zdef';
import FESTIVAL_TENT_GREEN_DEF from '../models/festival_tent_green.zdef';
import FESTIVAL_TENT_BROKEN_DEF from '../models/festival_tent_broken.zdef';
import FESTIVAL_TENT_BROKEN_RED_DEF from '../models/festival_tent_broken_red.zdef';
import FESTIVAL_TENT_BROKEN_GREEN_DEF from '../models/festival_tent_broken_green.zdef';
import FESTIVAL_CAR_RED_DEF from '../models/festival_car_red.zdef';
import FESTIVAL_CAR_BLUE_DEF from '../models/festival_car_blue.zdef';
import FESTIVAL_CAR_SILVER_DEF from '../models/festival_car_silver.zdef';
import FESTIVAL_CAR_BLACK_DEF from '../models/festival_car_black.zdef';
import FESTIVAL_CAR_YELLOW_DEF from '../models/festival_car_yellow.zdef';

export const createCollisionDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, hasCarrier, hasPad, isVisible, getShowCollisionBoxes, triggerCrash } = dwCtx;

    const drawCollisionBox = (
        wX: number, wY: number, angle: number,
        oxMin: number, oxMax: number,
        oyMin: number, oyMax: number,
        ozMin: number, ozMax: number,
        color: string,
    ) => SceneRenderer.drawCollisionBox(zstate.cam.x, zstate.cam.y, wX, wY, angle, oxMin, oxMax, oyMin, oyMax, ozMin, ozMax, color);

    const checkCollisionBox = (
        px: number, py: number, pz: number,
        wX: number, wY: number, angle: number,
        oxMin: number, oxMax: number,
        oyMin: number, oyMax: number,
        ozMin: number, ozMax: number,
    ) => {
        const dx = px - wX, dy = py - wY;
        const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        return lx >= oxMin && lx <= oxMax && ly >= oyMin && ly <= oyMax && pz >= ozMin && pz <= ozMax;
    };

    const checkDef = (def: any, wx: number, wy: number, wangle: number, gz: number) =>
        (def.collisionBoxes ?? []).some((cb: any) =>
            checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, wx, wy, wangle,
                cb.xMin, cb.xMax, cb.yMin, cb.yMax, gz + cb.zMin, gz + cb.zMax));

    const drawDef = (def: any, wx: number, wy: number, wangle: number, gz: number, color: string) =>
        (def.collisionBoxes ?? []).forEach((cb: any) =>
            drawCollisionBox(wx, wy, wangle, cb.xMin, cb.xMax, cb.yMin, cb.yMax,
                gz + cb.zMin, gz + cb.zMax, color));

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
            G.npcHelis.filter((h: any) => h.state === VEHICLE_STATE.PARKED).forEach((h: any) => {
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
        const lhPos = dwCtx.getLighthouse();
        if (lhPos) {
            if (showCB) drawDef(LIGHTHOUSE_DEF, lhPos.x, lhPos.y, 0, 0, 'rgba(255,220,0,0.8)');
            if (!zstate.crashed && checkDef(LIGHTHOUSE_DEF, lhPos.x, lhPos.y, 0, 0)) triggerCrash();
        }

        // ── Boats ─────────────────────────────────────────────────────────────────
        G.BOATS.forEach((b: any) => {
            const wl = G.waterLevel;
            const def =
                b.objectType === VESSEL.PILOT_BOAT  ? PILOT_BOAT_DEF  :
                b.objectType === VESSEL.SAR_BOAT     ? SAR_BOAT_DEF    :
                b.objectType === VESSEL.SALVAGE_TUG  ? SALVAGE_TUG_DEF :
                SAILBOAT_DEF;
            if (showCB) drawDef(def, b.x, b.y, b.angle, wl, 'rgba(0,200,255,0.8)');
            if (!zstate.crashed && checkDef(def, b.x, b.y, b.angle, wl)) triggerCrash();
        });

        // ── Submarines ────────────────────────────────────────────────────────────
        G.SUBMARINES.forEach((s: any) => {
            if (showCB) drawDef(SUBMARINE_DEF, s.x, s.y, s.angle, G.waterLevel, 'rgba(0,200,255,0.8)');
            if (!zstate.crashed && checkDef(SUBMARINE_DEF, s.x, s.y, s.angle, G.waterLevel)) triggerCrash();
        });

        // ── Research platforms ────────────────────────────────────────────────────
        G.RESEARCH_PLATFORMS.forEach((rp: any) => {
            if (showCB) drawDef(RESEARCH_PLATFORM_DEF, rp.x, rp.y, 0, G.waterLevel, 'rgba(0,200,255,0.8)');
            if (!zstate.crashed && checkDef(RESEARCH_PLATFORM_DEF, rp.x, rp.y, 0, G.waterLevel)) triggerCrash();
        });

        // ── Wind turbines ─────────────────────────────────────────────────────────
        G.WIND_TURBINES.forEach((wt: any) => {
            if (showCB) drawDef(WIND_TURBINE_DEF, wt.x, wt.y, 0, 0, 'rgba(0,200,255,0.8)');
            if (!zstate.crashed && checkDef(WIND_TURBINE_DEF, wt.x, wt.y, 0, 0)) triggerCrash();
        });

        // ── Baywatch objects ──────────────────────────────────────────────────────
        G.BAYWATCH_CARS.forEach((c: any) => {
            const gz = c.gz ?? 0;
            if (showCB) drawDef(BAYWATCH_CAR_DEF, c.x, c.y, c.angle, gz, 'rgba(255,200,0,0.8)');
            if (!zstate.crashed && checkDef(BAYWATCH_CAR_DEF, c.x, c.y, c.angle, gz)) triggerCrash();
        });
        G.BAYWATCH_BUILDINGS.forEach((b: any) => {
            const gz = b.gz ?? 0;
            const def = b.type === VESSEL.BAYWATCH_HQ ? BAYWATCH_HQ_DEF : BAYWATCH_TOWER_DEF;
            if (showCB) drawDef(def, b.x, b.y, b.angle, gz, 'rgba(255,80,0,0.9)');
            if (!zstate.crashed && checkDef(def, b.x, b.y, b.angle, gz)) triggerCrash();
        });

        // ── Festival objects ──────────────────────────────────────────────────────
        const _FESTIVAL_CAR_DEFS: Record<string, unknown> = {
            [VESSEL.FESTIVAL_CAR_RED]:    FESTIVAL_CAR_RED_DEF,
            [VESSEL.FESTIVAL_CAR_BLUE]:   FESTIVAL_CAR_BLUE_DEF,
            [VESSEL.FESTIVAL_CAR_SILVER]: FESTIVAL_CAR_SILVER_DEF,
            [VESSEL.FESTIVAL_CAR_BLACK]:  FESTIVAL_CAR_BLACK_DEF,
            [VESSEL.FESTIVAL_CAR_YELLOW]: FESTIVAL_CAR_YELLOW_DEF,
        };
        G.CONCERT_STAGES.forEach((s: any) => {
            const gz = s.gz ?? 0;
            if (showCB) drawDef(CONCERT_STAGE_DEF, s.x, s.y, s.angle, gz, 'rgba(180,0,255,0.8)');
            if (!zstate.crashed && checkDef(CONCERT_STAGE_DEF, s.x, s.y, s.angle, gz)) triggerCrash();
        });
        const _TENT_DEFS: Record<string, unknown> = {
            [VESSEL.FESTIVAL_TENT]:             FESTIVAL_TENT_DEF,
            [VESSEL.FESTIVAL_TENT_RED]:         FESTIVAL_TENT_RED_DEF,
            [VESSEL.FESTIVAL_TENT_GREEN]:       FESTIVAL_TENT_GREEN_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN]:      FESTIVAL_TENT_BROKEN_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN_RED]:  FESTIVAL_TENT_BROKEN_RED_DEF,
            [VESSEL.FESTIVAL_TENT_BROKEN_GREEN]:FESTIVAL_TENT_BROKEN_GREEN_DEF,
        };
        G.FESTIVAL_TENTS.forEach((t: any) => {
            const gz = t.gz ?? 0;
            const def = (_TENT_DEFS[t.type] ?? FESTIVAL_TENT_DEF) as any;
            if (showCB) drawDef(def, t.x, t.y, t.angle, gz, 'rgba(0,200,255,0.8)');
            if (!zstate.crashed && checkDef(def, t.x, t.y, t.angle, gz)) triggerCrash();
        });
        G.FESTIVAL_CARS.forEach((c: any) => {
            const gz = c.gz ?? 0;
            const def = (_FESTIVAL_CAR_DEFS[c.type] ?? FESTIVAL_CAR_SILVER_DEF) as any;
            if (showCB) drawDef(def, c.x, c.y, c.angle, gz, 'rgba(255,200,0,0.8)');
            if (!zstate.crashed && checkDef(def, c.x, c.y, c.angle, gz)) triggerCrash();
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
                [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
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

    return { handleCollisionBoxes, drawDebugOverlay };
};
