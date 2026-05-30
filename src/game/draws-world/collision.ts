import type { DrawWorldCtx } from './types';
import { G, zstate } from '../state';
import { VESSEL, VEHICLE_STATE } from '../../shared/types';
import { getHeliType } from '../heli-types';

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
