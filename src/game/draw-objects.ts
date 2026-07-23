// ─── Draw Objects ─────────────────────────────────────────────────────────────
// Shared draw functions for all game objects.
// Factory pattern mirrors createSceneRenderer: call once with rendering context,
// get back a bundle of draw functions that close over ctx, iso, tileW, tileH.
//
// Rules:
//   - draw* functions call iso() and draw directly to ctx (or targetCtx for
//     drawHeli with off-screen override).
//   - No SceneRenderer.flush() inside — caller is responsible.
//   - No global state (G, window.*) — pass what you need as arguments.
// ─────────────────────────────────────────────────────────────────────────────

import type { IsoFn, SceneRenderer } from './scene-renderer';
import { getHeliType } from './heli-types';
import { applyParts, applyNodes } from './def-utils';

import FUEL_TRUCK_CHASSIS_DEF from './models/fuel_truck_chassis.zdef';
import FUEL_TRUCK_TANK_DEF from './models/fuel_truck_tank.zdef';
import FUEL_TRUCK_CAB_DEF from './models/fuel_truck_cab.zdef';

export interface WindState {
    x: number;
    y: number;
    phase: number;
}

export interface DrawHeliOpts {
    /** Override rendering context (e.g. off-screen canvas). Defaults to factory ctx. */
    targetCtx?: CanvasRenderingContext2D;
    /** Override iso function (must match targetCtx canvas). Defaults to factory iso. */
    targetIso?: IsoFn;
    isShadow?: boolean;
    /** Multiply heli type's base scale. */
    scaleOverride?: number;
    fillColor?: string;
    strokeColor?: string;
    /** Called per shadow vertex to get ground z. If omitted, shadow uses hZ. */
    shadowGetGround?: (x: number, y: number) => number;
    /** Ornithopter only: flap frequency multiplier (1.0 = hover, >1 = ascending). */
    flapRate?: number;
    /** Tail rotor speed multiplier (1.0 = normal, >1 = yawing). */
    tailRotorRate?: number;
    /** Player color variant: 'blue' | undefined (= default orange). */
    colorVariant?: string;
}

export interface DrawFuelTruckOpts {
    /** Base z-offset (e.g. pad height). Defaults to 0. */
    z?: number;
    /** 0–1 extension. 0 = arm hidden. */
    armExtend?: number;
    /** If set, arm points toward this world position. If null, arm extends backward. */
    armTarget?: { x: number; y: number } | null;
    /** Returns true when fueling active (triggers nozzle blink). */
    getFuelingState?: () => boolean;
    /** Front-wheel steer angle in radians. */
    steerAngle?: number;
}

export const createDrawObjects = (
    ctx: CanvasRenderingContext2D,
    iso: IsoFn,
    tileW: number,
    tileH: number,
    SceneRenderer: SceneRenderer
) => {
    // ── internal helper ────────────────────────────────────────────────────────
    const _drawFace = (
        drawCtx: CanvasRenderingContext2D,
        isoFn: IsoFn,
        points: { x: number; y: number; z: number }[],
        color: string,
        strokeColor: string | null,
        zOffset: number,
        cX: number,
        cY: number
    ) => {
        drawCtx.fillStyle = color;
        drawCtx.beginPath();
        const first = isoFn(points[0].x, points[0].y, points[0].z + zOffset, cX, cY);
        drawCtx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
            const p = isoFn(points[i].x, points[i].y, points[i].z + zOffset, cX, cY);
            drawCtx.lineTo(p.x, p.y);
        }
        drawCtx.closePath();
        drawCtx.fill();
        if (strokeColor) {
            drawCtx.strokeStyle = strokeColor;
            drawCtx.lineWidth = 1;
            drawCtx.stroke();
        }
    }

    // Public drawFace — uses factory ctx/iso. Used by drawTractor.
    const drawFace = (
        points: { x: number; y: number; z: number }[],
        color: string,
        strokeColor: string | null,
        zOffset: number,
        cX: number,
        cY: number
    ) => {
        _drawFace(ctx, iso, points, color, strokeColor, zOffset, cX, cY);
    }

    // ── drawTree ───────────────────────────────────────────────────────────────
    const drawTree = (
        tX: number,
        tY: number,
        cx: number,
        cy: number,
        scale = 1.0,
        gz = 0,
        type = 'pine',
        wind: WindState = { x: 0, y: 0, phase: 0 }
    ) => {
        if (gz < 0.05) gz = 0.05;
        const z0 = gz;
        const trunkH = 0.5 * scale;
        const trunkR = 0.08 * scale;
        const windStrength = Math.hypot(wind.x, wind.y);
        const swayPhase = wind.phase + tX * 0.3 + tY * 0.17;
        const swayX = Math.cos(swayPhase) * windStrength * 18 * scale;
        const swayY = Math.sin(swayPhase) * windStrength * 10 * scale;

        if (type !== 'bush') {
            ctx.fillStyle = type === 'dead' ? '#7a5a3a' : '#5a3a1a';
            for (let i = 0; i <= 6; i++) {
                const cz = z0 + i * (trunkH / 6);
                const p = iso(tX, tY, cz, cx, cy);
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, (trunkR * tileW) / 2, (trunkR * tileH) / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (type === 'pine') {
            const layers = [
                {
                    zBase: z0 + trunkH * 0.3,
                    zTop: z0 + trunkH * 0.3 + 1.4 * scale,
                    rBase: 0.9 * scale,
                    color: '#1a4a1a',
                    shadow: '#0f2f0f',
                    sway: 0.3,
                },
                {
                    zBase: z0 + trunkH * 0.3 + 0.7 * scale,
                    zTop: z0 + trunkH * 0.3 + 1.9 * scale,
                    rBase: 0.65 * scale,
                    color: '#1e5a1e',
                    shadow: '#133513',
                    sway: 0.65,
                },
                {
                    zBase: z0 + trunkH * 0.3 + 1.3 * scale,
                    zTop: z0 + trunkH * 0.3 + 2.3 * scale,
                    rBase: 0.4 * scale,
                    color: '#246024',
                    shadow: '#163a16',
                    sway: 1.0,
                },
            ];
            layers.forEach(l => {
                for (let i = 10; i >= 0; i--) {
                    const t = i / 10;
                    const cz = l.zBase + t * (l.zTop - l.zBase);
                    const r = l.rBase * (1 - t);
                    if (r <= 0) continue;
                    const p = iso(tX, tY, cz, cx, cy);
                    const ox = swayX * l.sway * (1 - t * 0.5);
                    const oy = swayY * l.sway * (1 - t * 0.5);
                    ctx.fillStyle = l.shadow;
                    ctx.beginPath();
                    ctx.ellipse(p.x + ox + 2, p.y + oy + 1, (r * tileW) / 2, (r * tileH) / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = l.color;
                    ctx.beginPath();
                    ctx.ellipse(p.x + ox, p.y + oy, (r * tileW) / 2, (r * tileH) / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        } else if (type === 'oak') {
            const crownZ = z0 + trunkH + 0.5 * scale;
            const crownR = 0.75 * scale;
            const sw = swayX * 0.8,
                sh = swayY * 0.8;
            [
                { dx: 0, dz: 0, r: crownR, col: '#2a5a10', scol: '#1a3a08' },
                { dx: -0.25 * scale, dz: 0.3 * scale, r: crownR * 0.75, col: '#336614', scol: '#1e4a0a' },
                { dx: 0.3 * scale, dz: 0.2 * scale, r: crownR * 0.7, col: '#2e6012', scol: '#1c4208' },
                { dx: -0.1 * scale, dz: 0.6 * scale, r: crownR * 0.55, col: '#3a7018', scol: '#234a0e' },
                { dx: 0.15 * scale, dz: 0.55 * scale, r: crownR * 0.5, col: '#4a8020', scol: '#2a5010' },
            ].forEach(blob => {
                const p = iso(tX + blob.dx * 0.3, tY, crownZ + blob.dz, cx, cy);
                const ox = sw + blob.dx * 10,
                    oy = sh;
                ctx.fillStyle = blob.scol;
                ctx.beginPath();
                ctx.ellipse(p.x + ox + 3, p.y + oy + 2, (blob.r * tileW) / 2, (blob.r * tileH) / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = blob.col;
                ctx.beginPath();
                ctx.ellipse(p.x + ox, p.y + oy, (blob.r * tileW) / 2, (blob.r * tileH) / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (type === 'bush') {
            const bz = z0 + 0.15 * scale;
            [
                { dx: 0, r: 0.65 * scale, col: '#1a4a0a', dz: 0 },
                { dx: -0.2 * scale, r: 0.5 * scale, col: '#2a6014', dz: 0.1 },
                { dx: 0.25 * scale, r: 0.45 * scale, col: '#266010', dz: 0.08 },
                { dx: 0, r: 0.38 * scale, col: '#347018', dz: 0.2 },
            ].forEach(blob => {
                const p = iso(tX + blob.dx * 0.4, tY, bz + blob.dz * scale, cx, cy);
                const ox = swayX * 0.4,
                    oy = swayY * 0.4;
                ctx.fillStyle = blob.col;
                ctx.beginPath();
                ctx.ellipse(p.x + ox, p.y + oy, ((blob.r * tileW) / 2) * 1.3, (blob.r * tileH) / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (type === 'dead') {
            const topZ = z0 + trunkH + 0.9 * scale;
            const ptop = iso(tX, tY, topZ, cx, cy);
            const pbase = iso(tX, tY, z0 + trunkH, cx, cy);
            ctx.strokeStyle = '#8a6a4a';
            ctx.lineWidth = Math.max(1.5, tileW * 0.06 * scale);
            ctx.beginPath();
            ctx.moveTo(pbase.x, pbase.y);
            ctx.lineTo(ptop.x, ptop.y);
            ctx.stroke();
            ctx.lineWidth = Math.max(0.8, tileW * 0.03 * scale);
            ctx.strokeStyle = '#7a5a3a';
            [
                { ax: -0.35, az: 0.45, bx: -0.6, bz: 0.65 },
                { ax: 0.3, az: 0.5, bx: 0.55, bz: 0.68 },
                { ax: -0.2, az: 0.72, bx: -0.38, bz: 0.88 },
                { ax: 0.22, az: 0.75, bx: 0.4, bz: 0.9 },
                { ax: 0, az: 0.85, bx: -0.15, bz: 1.0 },
            ].forEach(br => {
                const pa = iso(tX + br.ax * 0.3 * scale, tY, z0 + trunkH + br.az * scale, cx, cy);
                const pb = iso(tX + br.bx * 0.35 * scale, tY, z0 + trunkH + br.bz * scale, cx, cy);
                const sw2 = swayX * 0.5 * (br.bz - 0.3);
                ctx.beginPath();
                ctx.moveTo(pa.x, pa.y);
                ctx.lineTo(pb.x + sw2, pb.y);
                ctx.stroke();
            });
        } else if (type === 'beach_umbrella') {
            const poleTop = iso(tX, tY, z0 + 1.0 * scale, cx, cy);
            const poleBase = iso(tX, tY, z0, cx, cy);
            ctx.strokeStyle = '#d8d0b8';
            ctx.lineWidth = Math.max(1, tileW * 0.04 * scale);
            ctx.beginPath();
            ctx.moveTo(poleBase.x, poleBase.y);
            ctx.lineTo(poleTop.x, poleTop.y);
            ctx.stroke();
            const rw = 0.50 * scale * tileW / 2;
            const rh = 0.50 * scale * tileH / 2;
            ctx.fillStyle = '#881500';
            ctx.beginPath();
            ctx.ellipse(poleTop.x + 2, poleTop.y + 1, rw, rh, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cc2200';
            ctx.beginPath();
            ctx.ellipse(poleTop.x, poleTop.y, rw, rh, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(240,240,240,0.9)';
            ctx.beginPath();
            ctx.ellipse(poleTop.x, poleTop.y, rw, rh * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'beach_lounger') {
            const s1 = iso(tX - 0.38 * scale, tY - 0.18 * scale, z0 + 0.08 * scale, cx, cy);
            const s2 = iso(tX + 0.22 * scale, tY - 0.18 * scale, z0 + 0.10 * scale, cx, cy);
            const s3 = iso(tX + 0.22 * scale, tY + 0.18 * scale, z0 + 0.10 * scale, cx, cy);
            const s4 = iso(tX - 0.38 * scale, tY + 0.18 * scale, z0 + 0.08 * scale, cx, cy);
            ctx.fillStyle = '#d8cc90';
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
            ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e8dcc0';
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y); ctx.lineTo(s4.x, s4.y);
            ctx.lineTo(s4.x, s4.y - Math.abs(s1.y - iso(tX - 0.38 * scale, tY - 0.18 * scale, z0 + 0.44 * scale, cx, cy).y));
            ctx.lineTo(s1.x, s1.y - Math.abs(s1.y - iso(tX - 0.38 * scale, tY - 0.18 * scale, z0 + 0.44 * scale, cx, cy).y));
            ctx.closePath(); ctx.fill();
        } else if (type === 'beach_cooler') {
            const p = iso(tX, tY, z0 + 0.13 * scale, cx, cy);
            const ptop = iso(tX, tY, z0 + 0.27 * scale, cx, cy);
            const w = Math.max(3, 0.22 * scale * tileW / 2);
            const h = Math.max(2, 0.14 * scale * tileH / 2);
            ctx.fillStyle = '#ccd8e4';
            ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
            ctx.fillStyle = '#3366aa';
            ctx.fillRect(ptop.x - w - 1, ptop.y - 2, w * 2 + 2, 4);
        } else if (type === 'beach_umbrella_tilted') {
            // +x lean: pole base at (tX,tY), top offset toward +x
            const poleBase = iso(tX, tY, z0, cx, cy);
            const poleTop  = iso(tX + 0.20 * scale, tY, z0 + 0.80 * scale, cx, cy);
            ctx.strokeStyle = '#d8d0b8';
            ctx.lineWidth = Math.max(1, tileW * 0.04 * scale);
            ctx.beginPath(); ctx.moveTo(poleBase.x, poleBase.y); ctx.lineTo(poleTop.x, poleTop.y); ctx.stroke();
            // Canopy: rotated ellipse — +x lean ≈ 30° screen rotation, squished depth
            const canCtr = iso(tX + 0.18 * scale, tY, z0 + 0.80 * scale, cx, cy);
            const rMaj = 0.50 * scale * tileW / 2;
            const rMin = rMaj * 0.55;
            const lean = Math.atan2(tileH / 2, tileW / 2); // iso +x direction ≈26°
            ctx.save();
            ctx.translate(canCtr.x, canCtr.y);
            ctx.rotate(lean);
            ctx.fillStyle = '#881400';
            ctx.beginPath(); ctx.ellipse(1, 1, rMaj, rMin, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#cc2200';
            ctx.beginPath(); ctx.ellipse(0, 0, rMaj, rMin, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(240,240,240,0.88)';
            ctx.lineWidth = Math.max(1.5, rMin * 0.45);
            ctx.beginPath(); ctx.moveTo(-rMaj * 0.9, 0); ctx.lineTo(rMaj * 0.9, 0); ctx.stroke();
            ctx.restore();
        } else if (type === 'beach_person') {
            const variant = Math.abs(Math.round(tX * 7 + tY * 3)) % 4;
            const swimColors = ['#cc2200', '#1166cc', '#cc8800', '#118833'];
            const swimColor = swimColors[variant];
            const base = iso(tX, tY, z0, cx, cy);
            const s = (tileW / 64) * scale;
            const skin = '#e8b070';
            const headR = Math.max(1.5, 3 * s);
            const bw = Math.max(2, 5 * s);
            const sw = Math.max(1.5, 4.5 * s);  // swimwear height
            const legH = Math.max(2, 9 * s);
            const torsoH = Math.max(1.5, sw * 2.5); // skin above swimwear
            const bx = base.x, by = base.y;
            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(bx, by, tileW * 0.15 * scale, tileH * 0.10 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
            // Legs (skin)
            ctx.fillStyle = skin;
            ctx.fillRect(bx - bw / 2, by - legH, bw * 0.38, legH);
            ctx.fillRect(bx + bw / 2 - bw * 0.38, by - legH, bw * 0.38, legH);
            // Swimwear / trunk
            ctx.fillStyle = swimColor;
            ctx.fillRect(bx - bw / 2, by - legH - sw, bw, sw);
            // Torso (skin — above swimwear, bikini/open chest)
            ctx.fillStyle = skin;
            ctx.fillRect(bx - bw / 2, by - legH - sw - torsoH, bw, torsoH);
            // Arms (skin — short stubs out to sides)
            ctx.fillRect(bx - bw, by - legH - sw - torsoH * 0.7, bw * 0.5, Math.max(1, 2 * s));
            ctx.fillRect(bx + bw / 2, by - legH - sw - torsoH * 0.7, bw * 0.5, Math.max(1, 2 * s));
            // Head
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.arc(bx, by - legH - sw - torsoH - headR + s * 0.5, headR, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'swimmer') {
            // Draw at water surface (gz may be negative — clamp to 0)
            const wz = Math.max(gz, 0);
            const pHead = iso(tX, tY, wz + 0.22 * scale, cx, cy);
            // Arms
            const pArmL = iso(tX - 0.30 * scale, tY, wz + 0.10 * scale, cx, cy);
            const pArmR = iso(tX + 0.30 * scale, tY, wz + 0.10 * scale, cx, cy);
            ctx.strokeStyle = '#e0b878';
            ctx.lineWidth = Math.max(1.5, tileW * 0.05 * scale);
            ctx.beginPath(); ctx.moveTo(pArmL.x, pArmL.y); ctx.lineTo(pArmR.x, pArmR.y); ctx.stroke();
            // Small splash circle
            ctx.strokeStyle = 'rgba(120,180,255,0.6)';
            ctx.lineWidth = Math.max(1, tileW * 0.04 * scale);
            ctx.beginPath();
            ctx.ellipse(pHead.x, pHead.y + tileH * 0.08 * scale,
                tileW * 0.22 * scale, tileH * 0.14 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Head
            const hw = tileW * 0.09 * scale;
            ctx.fillStyle = '#e0b878';
            ctx.beginPath();
            ctx.ellipse(pHead.x, pHead.y, hw, hw * 0.75, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── drawPerson ─────────────────────────────────────────────────────────────
    const drawPerson = (
        pX: number,
        pY: number,
        pZ: number,
        _angle: number,
        isWaving: boolean,
        cx: number,
        cy: number,
        outfit?: string,
        colors?: { shirt: string; pants: string },
        submerged = false
    ) => {
        const base = iso(pX, pY, pZ, cx, cy);
        const s = tileW / 64;
        const headR = Math.max(1, 2.5 * s),
            torsoW = Math.max(1.5, 5 * s),
            torsoH = Math.max(1.5, 7.5 * s),
            legW = Math.max(1, 2 * s),
            legH = Math.max(1.5, 7 * s);
        const isRescuer = outfit === 'rescuer';
        const colorShirt = colors?.shirt ?? (isRescuer ? '#ff6600' : '#5a786e');
        const colorPants = colors?.pants ?? (isRescuer ? '#ff6600' : '#3b4a6b');
        const colorArm = isRescuer ? '#ff6600' : '#f2d0a4';
        const drawX = base.x,
            drawY = base.y;

        if (submerged) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, ctx.canvas.width, drawY - legH);
            ctx.clip();
        }

        ctx.fillStyle = colorPants;
        ctx.fillRect(drawX - torsoW / 2, drawY - legH, legW, legH);
        ctx.fillRect(drawX + torsoW / 2 - legW, drawY - legH, legW, legH);
        const torsoY = drawY - legH - torsoH;
        ctx.fillStyle = colorShirt;
        ctx.fillRect(drawX - torsoW / 2, torsoY, torsoW, torsoH);
        const headY = torsoY - headR + s;
        ctx.fillStyle = isRescuer ? '#ffffff' : '#f2d0a4';
        ctx.beginPath();
        ctx.arc(drawX, headY, headR, 0, Math.PI * 2);
        ctx.fill();
        if (isRescuer) {
            const isTravolta = colorShirt === '#ffffff';
            if (isTravolta) {
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.moveTo(drawX, torsoY + s);
                ctx.lineTo(drawX - 2 * s, torsoY + 4 * s);
                ctx.lineTo(drawX, torsoY + 3 * s);
                ctx.lineTo(drawX + 2 * s, torsoY + 4 * s);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.strokeStyle = '#111';
                ctx.lineWidth = Math.max(0.8, 1.2 * s);
                ctx.beginPath();
                ctx.arc(drawX, headY, headR, Math.PI * 0.9, Math.PI * 0.1, false);
                ctx.stroke();
            }
        }
        if (isWaving) {
            const waveOffset = Math.sin(Date.now() * 0.015) * 3 * s;
            const shoulderX = drawX + torsoW / 2,
                shoulderY = torsoY + 2 * s;
            ctx.strokeStyle = colorArm;
            ctx.lineWidth = Math.max(1, 1.5 * s);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(shoulderX + 4 * s + waveOffset, shoulderY - 5 * s);
            ctx.stroke();
        }
        if (submerged) ctx.restore();
    }

    // ── drawTractor ────────────────────────────────────────────────────────────
    // objX/objY: carrier or platform origin in world space
    // objAngle: orientation of the carrier/platform
    // deckZ: z of the deck surface
    // tx/ty: tractor position relative to platform origin (in platform-local space)
    // tAngle: tractor heading relative to platform (added to objAngle)
    // bc/bs/bd/cc/cs/ct: body/cab color variants (top, side, dark, cab top/side/top)
    const drawTractor = (
        objX: number,
        objY: number,
        objAngle: number,
        deckZ: number,
        cx: number,
        cy: number,
        tx: number,
        ty: number,
        tAngle: number,
        bc: string,
        bs: string,
        bd: string,
        cc: string,
        cs: string,
        ct: string
    ) => {
        const cosA = Math.cos(objAngle),
            sinA = Math.sin(objAngle);
        const bodyL = 1.0,
            bodyW = 0.72,
            bodyH = 0.15;
        const isFireTractor = ct === '#eeeeee';
        const cabH = isFireTractor ? 0.22 : bodyH + 0.22;
        const cabL = isFireTractor ? bodyL * 0.75 : bodyL;
        const dZ = deckZ + 0.01,
            wW = 0.15,
            wH = 0.25;
        const cosT = Math.cos(tAngle + objAngle),
            sinT = Math.sin(tAngle + objAngle);
        const vt = (lx: number, ly: number) => {
            return lx * cosT - ly * sinT + (lx * sinT + ly * cosT) > 0;
        }
        const ox = objX + tx * cosA - ty * sinA;
        const oy = objY + tx * sinA + ty * cosA;
        const rr = (rx: number, ry: number) => {
            return { x: ox + rx * cosT - ry * sinT, y: oy + rx * sinT + ry * cosT };
        }
        const H = (p: { x: number; y: number }, z: number) => {
            return { x: p.x, y: p.y, z };
        }
        const face = (pts: { x: number; y: number; z: number }[], col: string, stroke?: string) => {
            drawFace(pts, col, stroke ?? null, 0, cx, cy);
        }

        if (isFireTractor) {
            const b1 = rr(0, 0),
                b2 = rr(bodyL, 0),
                b3 = rr(bodyL, bodyW),
                b4 = rr(0, bodyW);
            face([H(b1, dZ), H(b2, dZ), H(b3, dZ), H(b4, dZ)], bc);
            if (vt(0, -1)) face([H(b1, dZ), H(b2, dZ), H(b2, dZ + bodyH), H(b1, dZ + bodyH)], bs);
            if (vt(1, 0)) face([H(b2, dZ), H(b3, dZ), H(b3, dZ + bodyH), H(b2, dZ + bodyH)], bd);
            if (vt(0, 1)) face([H(b3, dZ), H(b4, dZ), H(b4, dZ + bodyH), H(b3, dZ + bodyH)], bs);
            if (vt(-1, 0)) face([H(b4, dZ), H(b1, dZ), H(b1, dZ + bodyH), H(b4, dZ + bodyH)], bd);
            face([H(b1, dZ + bodyH), H(b2, dZ + bodyH), H(b3, dZ + bodyH), H(b4, dZ + bodyH)], bs);
            const eqZ = dZ + bodyH,
                eqW = 0.2,
                eqL = 0.25,
                eqH = 0.18,
                eqX = bodyL - eqW - 0.02;
            const eq1 = rr(eqX, bodyW * 0.1),
                eq2 = rr(eqX + eqW, bodyW * 0.1);
            const eq3 = rr(eqX + eqW, bodyW * 0.1 + eqL),
                eq4 = rr(eqX, bodyW * 0.1 + eqL);
            face([H(eq1, eqZ), H(eq2, eqZ), H(eq3, eqZ), H(eq4, eqZ)], '#aa0000');
            if (vt(0, -1)) face([H(eq1, eqZ), H(eq2, eqZ), H(eq2, eqZ + eqH), H(eq1, eqZ + eqH)], '#ee0000');
            if (vt(1, 0)) face([H(eq2, eqZ), H(eq3, eqZ), H(eq3, eqZ + eqH), H(eq2, eqZ + eqH)], '#880000');
            if (vt(0, 1)) face([H(eq3, eqZ), H(eq4, eqZ), H(eq4, eqZ + eqH), H(eq3, eqZ + eqH)], '#aa0000');
            if (vt(-1, 0)) face([H(eq4, eqZ), H(eq1, eqZ), H(eq1, eqZ + eqH), H(eq4, eqZ + eqH)], '#880000');
            face([H(eq1, eqZ + eqH), H(eq2, eqZ + eqH), H(eq3, eqZ + eqH), H(eq4, eqZ + eqH)], '#cc0000');
        }
        const cZ = isFireTractor ? dZ + bodyH : dZ;
        const cc1 = rr(0, 0),
            cc2 = rr(cabL, 0),
            cc3 = rr(cabL, bodyW),
            cc4 = rr(0, bodyW);
        face([H(cc1, cZ), H(cc2, cZ), H(cc3, cZ), H(cc4, cZ)], cc);
        if (vt(0, -1)) face([H(cc1, cZ), H(cc2, cZ), H(cc2, cZ + cabH), H(cc1, cZ + cabH)], cs);
        if (vt(1, 0)) face([H(cc2, cZ), H(cc3, cZ), H(cc3, cZ + cabH), H(cc2, cZ + cabH)], bd);
        if (vt(0, 1)) face([H(cc3, cZ), H(cc4, cZ), H(cc4, cZ + cabH), H(cc3, cZ + cabH)], cc);
        if (vt(-1, 0)) face([H(cc4, cZ), H(cc1, cZ), H(cc1, cZ + cabH), H(cc4, cZ + cabH)], bd);
        face([H(cc1, cZ + cabH), H(cc2, cZ + cabH), H(cc3, cZ + cabH), H(cc4, cZ + cabH)], ct);
        [0.15, bodyL - 0.15].forEach(ax => {
            if (vt(0, -1)) {
                const w1 = rr(ax - wW * 0.5, 0),
                    w2 = rr(ax + wW * 0.5, 0);
                face([H(w1, dZ), H(w2, dZ), H(w2, dZ + wH), H(w1, dZ + wH)], '#222');
            }
            if (vt(0, 1)) {
                const w1 = rr(ax - wW * 0.5, bodyW),
                    w2 = rr(ax + wW * 0.5, bodyW);
                face([H(w1, dZ), H(w2, dZ), H(w2, dZ + wH), H(w1, dZ + wH)], '#222');
            }
        });
    }

    // ── drawFuelTruck ──────────────────────────────────────────────────────────
    // Does NOT call SceneRenderer.flush() — caller is responsible.
    const drawFuelTruck = (tX: number, tY: number, angle: number, opts: DrawFuelTruckOpts = {}) => {
        const { z = 0, armExtend = 0, armTarget = null, getFuelingState, steerAngle = 0 } = opts;
        const cosA = Math.cos(angle),
            sinA = Math.sin(angle);
        const tkDepth = tX + tY + 0.825 * (cosA + sinA);
        const cabDepth = tX + tY + 1.85 * (cosA + sinA);
        const chDepth = Math.min(tkDepth, cabDepth) - 0.01;
        const pivotWX = tX + 0.3 * cosA;
        const pivotWY = tY + 0.3 * sinA;

        SceneRenderer.add(applyParts(FUEL_TRUCK_CHASSIS_DEF as any, { steerAngle }), { x: tX, y: tY, z, angle, depth: chDepth });
        SceneRenderer.add(FUEL_TRUCK_TANK_DEF, { x: tX, y: tY, z, angle, depth: tkDepth });
        SceneRenderer.add(FUEL_TRUCK_CAB_DEF, {
            x: tX,
            y: tY,
            z,
            angle,
            depth: cabDepth,
            drawFn: (camX, camY) => {
                if (armExtend <= 0) return;
                const pivotZ = z + 0.98;
                const pivotIso = iso(pivotWX, pivotWY, pivotZ, camX, camY);

                let elbowWX: number, elbowWY: number;
                if (armTarget) {
                    const dx = armTarget.x - pivotWX,
                        dy = armTarget.y - pivotWY;
                    const dist = Math.hypot(dx, dy) || 1;
                    elbowWX = pivotWX + (dx / dist) * 0.65 * armExtend;
                    elbowWY = pivotWY + (dy / dist) * 0.65 * armExtend;
                } else {
                    elbowWX = pivotWX - cosA * 0.65 * armExtend;
                    elbowWY = pivotWY - sinA * 0.65 * armExtend;
                }
                const elbowZ = pivotZ + 0.25 * Math.sin(armExtend * Math.PI * 0.7);
                const elbowIso = iso(elbowWX, elbowWY, elbowZ, camX, camY);

                let nozzleWX: number, nozzleWY: number;
                if (armTarget) {
                    const dx = armTarget.x - pivotWX,
                        dy = armTarget.y - pivotWY;
                    const dist = Math.hypot(dx, dy) || 1;
                    nozzleWX = elbowWX + (dx / dist) * 0.5 * armExtend;
                    nozzleWY = elbowWY + (dy / dist) * 0.5 * armExtend;
                } else {
                    nozzleWX = elbowWX - cosA * 0.5 * armExtend;
                    nozzleWY = elbowWY - sinA * 0.5 * armExtend;
                }
                const nozzleZ = elbowZ - 0.7 * armExtend;
                const nozzleIso = iso(nozzleWX, nozzleWY, nozzleZ, camX, camY);

                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#777';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(pivotIso.x, pivotIso.y);
                ctx.lineTo(elbowIso.x, elbowIso.y);
                ctx.stroke();
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(elbowIso.x, elbowIso.y);
                ctx.lineTo(nozzleIso.x, nozzleIso.y);
                ctx.stroke();
                const as = tileW / 64;
                ctx.fillStyle = '#555';
                ctx.beginPath();
                ctx.arc(elbowIso.x, elbowIso.y, Math.max(1.2, 3 * as), 0, Math.PI * 2);
                ctx.fill();
                const fueling = getFuelingState ? getFuelingState() : false;
                ctx.fillStyle = fueling && Math.floor(Date.now() / 200) % 2 ? '#ff8800' : '#444';
                ctx.beginPath();
                ctx.arc(nozzleIso.x, nozzleIso.y, Math.max(1.5, 4 * as), 0, Math.PI * 2);
                ctx.fill();
            },
        });
    }

    // ── drawHeli ───────────────────────────────────────────────────────────────
    const drawHeli = (
        type: string,
        hX: number,
        hY: number,
        hZ: number,
        hAngle: number,
        hTilt: number,
        hRoll: number,
        hRotor: number,
        camX: number,
        camY: number,
        opts: DrawHeliOpts = {}
    ) => {
        const {
            targetCtx: tCtx,
            targetIso: tIso,
            isShadow = false,
            scaleOverride = 0,
            fillColor: _rawFill = '#ff6600',
            strokeColor: _rawStroke = '#dd3300',
            shadowGetGround,
            flapRate = 1.0,
            tailRotorRate = 1.0,
            colorVariant,
        } = opts;

        const fillColor = colorVariant === 'blue' ? '#55aadd' : colorVariant === 'sand' ? '#c8a45a' : colorVariant === 'green' ? '#4e8c38' : _rawFill;
        const strokeColor = colorVariant === 'blue' ? '#3388bb' : colorVariant === 'sand' ? '#a07838' : colorVariant === 'green' ? '#336025' : _rawStroke;

        const actualCtx = tCtx ?? ctx;
        const actualIso = tIso ?? iso;

        const cosA = Math.cos(hAngle),
            sinA = Math.sin(hAngle);
        const _baseScale = getHeliType(type).scale;
        let s = _baseScale;
        if (scaleOverride > 0) s = scaleOverride * _baseScale;
        const lineScale = tileW / 64; // normalises lineWidth across canvas scales

        const p = (lx: number, ly: number, lz: number) => {
            lx *= s;
            ly *= s;
            lz *= s;
            lz += ly * hRoll * 0.5 + lx * hTilt * 0.5;
            const rx = lx * cosA - ly * sinA + hX;
            const ry = lx * sinA + ly * cosA + hY;
            let rz = hZ + lz;
            if (isShadow) {
                if (shadowGetGround) {
                    const g = shadowGetGround(rx, ry);
                    rz = g > -5 ? g : 0;
                } else {
                    rz = hZ;
                }
            }
            return actualIso(rx, ry, rz, camX, camY);
        }

        const faceFn = (
            pts: { x: number; y: number; z: number }[],
            color: string,
            stroke: string | null,
            zOffset: number,
            cX: number,
            cY: number
        ) => {
            _drawFace(actualCtx, actualIso, pts, color, stroke, zOffset, cX, cY);
        }

        actualCtx.lineJoin = 'round';
        actualCtx.lineCap = 'round';


        if (type === 'dolphin') {
            if (isShadow) {
                const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
                actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.04)})`;
                const sN = p(1.2, 0, 0),
                    sT = p(-1.8, 0, 0),
                    sL = p(0, 0.4, 0),
                    sR = p(0, -0.4, 0);
                actualCtx.beginPath();
                actualCtx.moveTo(sN.x, sN.y);
                actualCtx.lineTo(sR.x, sR.y);
                actualCtx.lineTo(sT.x, sT.y);
                actualCtx.lineTo(sL.x, sL.y);
                actualCtx.fill();
                return;
            }
            actualCtx.strokeStyle = strokeColor;
            actualCtx.lineWidth = 1;
            const nose = p(1.4, 0, 0.2),
                tailBase = p(-0.8, 0, 0.5);
            const lSide = p(0, 0.4, 0.4),
                rSide = p(0, -0.4, 0.4);
            actualCtx.fillStyle = fillColor;
            actualCtx.beginPath();
            actualCtx.moveTo(nose.x, nose.y);
            actualCtx.lineTo(rSide.x, rSide.y);
            actualCtx.lineTo(tailBase.x, tailBase.y);
            actualCtx.lineTo(lSide.x, lSide.y);
            actualCtx.closePath();
            actualCtx.fill();
            actualCtx.fillStyle = '#112';
            actualCtx.beginPath();
            actualCtx.moveTo(p(1.2, 0, 0.25).x, p(1.2, 0, 0.25).y);
            actualCtx.lineTo(p(0.3, -0.3, 0.6).x, p(0.3, -0.3, 0.6).y);
            actualCtx.lineTo(p(0.3, 0.3, 0.6).x, p(0.3, 0.3, 0.6).y);
            actualCtx.fill();
            const tTop = p(-1.8, 0, 1.2),
                tBack = p(-2.0, 0, 0.4);
            actualCtx.fillStyle = fillColor;
            actualCtx.beginPath();
            actualCtx.moveTo(tailBase.x, tailBase.y);
            actualCtx.lineTo(tTop.x, tTop.y);
            actualCtx.lineTo(tBack.x, tBack.y);
            actualCtx.fill();
            // Fenestron — perspective-correct ellipse by projecting world-space axes.
            // Disc plane is local XZ (perpendicular to heli's Y axis).
            // ax = forward axis (foreshortens with view angle), bx = up axis (stable).
            const fenCen = p(-1.6, 0.01, 0.72);
            const fenE1 = p(-1.6 + 0.24, 0.01, 0.72);
            const fenE2 = p(-1.6, 0.01, 0.72 + 0.24);
            const fax = fenE1.x - fenCen.x,
                fay = fenE1.y - fenCen.y;
            const fbx = fenE2.x - fenCen.x,
                fby = fenE2.y - fenCen.y;
            const fenEllipse = (fill: string | null, stroke: string | null, lw: number, scale: number) => {
                actualCtx.beginPath();
                for (let i = 0; i <= 24; i++) {
                    const a = (i / 24) * Math.PI * 2;
                    const ex = fenCen.x + fax * Math.cos(a) * scale + fbx * Math.sin(a) * scale;
                    const ey = fenCen.y + fay * Math.cos(a) * scale + fby * Math.sin(a) * scale;
                    i === 0 ? actualCtx.moveTo(ex, ey) : actualCtx.lineTo(ex, ey);
                }
                actualCtx.closePath();
                if (fill) {
                    actualCtx.fillStyle = fill;
                    actualCtx.fill();
                }
                if (stroke) {
                    actualCtx.strokeStyle = stroke;
                    actualCtx.lineWidth = lw;
                    actualCtx.stroke();
                }
            };
            fenEllipse('#1a1a1a', null, 0, 1.0);
            actualCtx.strokeStyle = 'rgba(210,235,255,0.7)';
            actualCtx.lineWidth = 1.2 * s * lineScale;
            actualCtx.lineCap = 'round';
            for (let i = 0; i < 8; i++) {
                const a = hRotor * 2.0 * tailRotorRate + i * (Math.PI / 4);
                const ca = Math.cos(a),
                    sa = Math.sin(a);
                actualCtx.beginPath();
                actualCtx.moveTo(
                    fenCen.x + fax * ca * 0.25 + fbx * sa * 0.25,
                    fenCen.y + fay * ca * 0.25 + fby * sa * 0.25
                );
                actualCtx.lineTo(
                    fenCen.x + fax * ca * 0.88 + fbx * sa * 0.88,
                    fenCen.y + fay * ca * 0.88 + fby * sa * 0.88
                );
                actualCtx.stroke();
            }
            fenEllipse('#444', null, 0, 0.33);
            fenEllipse(null, strokeColor, 1.5 * s * lineScale, 1.0);
            // Main rotor
            actualCtx.strokeStyle = 'rgba(220,245,255,0.5)';
            actualCtx.lineWidth = 2 * lineScale;
            const hub = p(0, 0, 0.7);
            for (let i = 0; i < 4; i++) {
                const a = hRotor + i * (Math.PI / 2);
                const end = p(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0.8);
                actualCtx.beginPath();
                actualCtx.moveTo(hub.x, hub.y);
                actualCtx.lineTo(end.x, end.y);
                actualCtx.stroke();
            }
        } else if (type === 'coasthawk') {
            if (isShadow) {
                const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
                actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.04)})`;
                const sN = p(1.3, 0, 0),
                    sT = p(-2.8, 0, 0),
                    sL = p(0, 0.5, 0),
                    sR = p(0, -0.5, 0);
                actualCtx.beginPath();
                actualCtx.moveTo(sN.x, sN.y);
                actualCtx.lineTo(sR.x, sR.y);
                actualCtx.lineTo(sT.x, sT.y);
                actualCtx.lineTo(sL.x, sL.y);
                actualCtx.fill();
                return;
            }
            // Horizontal stabilizer
            const stabL = p(-2.4, 0.6, 0.3),
                stabR = p(-2.4, -0.6, 0.3);
            actualCtx.fillStyle = '#111';
            actualCtx.lineWidth = 4 * s * lineScale;
            actualCtx.strokeStyle = '#222';
            actualCtx.beginPath();
            actualCtx.moveTo(stabL.x, stabL.y);
            actualCtx.lineTo(stabR.x, stabR.y);
            actualCtx.stroke();
            const n = p(1.3, 0, 0.3),
                tailBoomStart = p(-1.1, 0, 0.6);
            const bodyFL = p(0.4, 0.45, 0.4),
                bodyFR = p(0.4, -0.45, 0.4);
            const bodyBL = p(-1.0, 0.45, 0.4),
                bodyBR = p(-1.0, -0.45, 0.4);
            actualCtx.strokeStyle = strokeColor;
            actualCtx.lineWidth = 1;
            actualCtx.fillStyle = fillColor;
            actualCtx.beginPath();
            actualCtx.moveTo(n.x, n.y);
            actualCtx.lineTo(bodyFR.x, bodyFR.y);
            actualCtx.lineTo(bodyBR.x, bodyBR.y);
            actualCtx.lineTo(tailBoomStart.x, tailBoomStart.y);
            actualCtx.lineTo(bodyBL.x, bodyBL.y);
            actualCtx.lineTo(bodyFL.x, bodyFL.y);
            actualCtx.fill();
            actualCtx.stroke();
            // Windows
            actualCtx.fillStyle = '#111';
            actualCtx.beginPath();
            actualCtx.moveTo(p(0.3, 0.47, 0.35).x, p(0.3, 0.47, 0.35).y);
            actualCtx.lineTo(p(-0.6, 0.47, 0.35).x, p(-0.6, 0.47, 0.35).y);
            actualCtx.lineTo(p(-0.6, 0.3, 0.6).x, p(-0.6, 0.3, 0.6).y);
            actualCtx.lineTo(p(0.3, 0.3, 0.6).x, p(0.3, 0.3, 0.6).y);
            actualCtx.fill();
            actualCtx.beginPath();
            actualCtx.moveTo(p(0.3, -0.47, 0.35).x, p(0.3, -0.47, 0.35).y);
            actualCtx.lineTo(p(-0.6, -0.47, 0.35).x, p(-0.6, -0.47, 0.35).y);
            actualCtx.lineTo(p(-0.6, -0.3, 0.6).x, p(-0.6, -0.3, 0.6).y);
            actualCtx.lineTo(p(0.3, -0.3, 0.6).x, p(0.3, -0.3, 0.6).y);
            actualCtx.fill();
            // Nose intake + roof sensor pod
            actualCtx.fillStyle = '#111';
            actualCtx.beginPath();
            actualCtx.moveTo(n.x, n.y);
            actualCtx.lineTo(p(0.6, 0.4, 0.6).x, p(0.6, 0.4, 0.6).y);
            actualCtx.lineTo(p(0.6, -0.4, 0.6).x, p(0.6, -0.4, 0.6).y);
            actualCtx.fill();
            actualCtx.fillStyle = '#eee';
            actualCtx.beginPath();
            actualCtx.moveTo(p(0.6, 0, 0.7).x, p(0.6, 0, 0.7).y);
            actualCtx.lineTo(p(-0.8, 0.35, 0.7).x, p(-0.8, 0.35, 0.7).y);
            actualCtx.lineTo(p(-0.8, -0.35, 0.7).x, p(-0.8, -0.35, 0.7).y);
            actualCtx.fill();
            // Tail boom + vertical fin
            actualCtx.fillStyle = fillColor;
            const finBase = p(-2.4, 0, 0.6),
                finTop = p(-2.9, 0, 1.3),
                finBack = p(-3.0, 0, 0.6);
            actualCtx.lineWidth = 6 * s * lineScale;
            actualCtx.strokeStyle = strokeColor;
            actualCtx.beginPath();
            actualCtx.moveTo(tailBoomStart.x, tailBoomStart.y);
            actualCtx.lineTo(finBase.x, finBase.y);
            actualCtx.stroke();
            actualCtx.lineWidth = 1;
            actualCtx.beginPath();
            actualCtx.moveTo(finBase.x, finBase.y);
            actualCtx.lineTo(finTop.x, finTop.y);
            actualCtx.lineTo(finBack.x, finBack.y);
            actualCtx.fill();
            // Tail rotor
            actualCtx.strokeStyle = 'rgba(220,245,255,0.55)';
            actualCtx.lineWidth = 2 * s * lineScale;
            actualCtx.lineCap = 'round';
            const trHub = p(-2.95, 0.08, 0.95);
            for (let i = 0; i < 4; i++) {
                const a = hRotor * 1.5 * tailRotorRate + i * (Math.PI / 2);
                const trEnd = p(-2.95 + Math.sin(a) * 0.55, 0.08, 0.95 + Math.cos(a) * 0.55);
                actualCtx.beginPath();
                actualCtx.moveTo(trHub.x, trHub.y);
                actualCtx.lineTo(trEnd.x, trEnd.y);
                actualCtx.stroke();
            }
            // Main rotor
            actualCtx.strokeStyle = 'rgba(220,245,255,0.5)';
            actualCtx.lineWidth = 3 * s * lineScale;
            const hub = p(0, 0, 0.8);
            for (let i = 0; i < 4; i++) {
                const a = hRotor + i * (Math.PI / 2);
                const end = p(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0.85);
                actualCtx.beginPath();
                actualCtx.moveTo(hub.x, hub.y);
                actualCtx.lineTo(end.x, end.y);
                actualCtx.stroke();
            }
        } else if (type === 'atlas') {
            if (isShadow) {
                const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
                actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.04)})`;
                const sN = p(2.5, 0, 0),
                    sT = p(-2.8, 0, 0),
                    sL = p(0, 0.8, 0),
                    sR = p(0, -0.8, 0);
                actualCtx.beginPath();
                actualCtx.moveTo(sN.x, sN.y);
                actualCtx.lineTo(sR.x, sR.y);
                actualCtx.lineTo(sT.x, sT.y);
                actualCtx.lineTo(sL.x, sL.y);
                actualCtx.fill();
                return;
            }
            const wf = (lx: number, ly: number, lz: number) => ({
                x: lx * s * cosA - ly * s * sinA + hX,
                y: lx * s * sinA + ly * s * cosA + hY,
                z: hZ + (lz * s + ly * s * hRoll * 0.5 + lx * s * hTilt * 0.5),
            });
            const rB1 = wf(1.8, 0.3, 0.15),
                rB2 = wf(1.8, -0.3, 0.15);
            const rB3 = wf(-2.0, -0.3, 0.15),
                rB4 = wf(-2.0, 0.3, 0.15);
            const rM1 = wf(1.8, 0.6, 0.5),
                rM2 = wf(1.8, -0.6, 0.5);
            const rM3 = wf(-2.0, -0.6, 0.5),
                rM4 = wf(-2.0, 0.6, 0.5);
            const rT1 = wf(1.8, 0.3, 0.85),
                rT2 = wf(1.8, -0.3, 0.85);
            const rT3 = wf(-2.0, -0.3, 0.85),
                rT4 = wf(-2.0, 0.3, 0.85);
            const tailTop = wf(-2.6, 0, 1.1),
                tailLow = wf(-2.6, 0, 0.4);
            // nearLeft: local +Y side is closer to camera (iso depth = vx+vy; larger = nearer)
            const nearLeft = sinA < cosA;
            const _cBody  = fillColor;
            const _cTop   = fillColor;
            const _cTail  = fillColor;
            const _cNose  = fillColor;
            const _cPylF  = fillColor;
            const _cPylR  = fillColor;
            // Body — far side first, near side + its window, then top
            if (nearLeft) {
                faceFn([rB2, rM2, rM3, rB3], _cBody, null, 0, camX, camY);
                faceFn([rM2, rT2, rT3, rM3], _cBody, null, 0, camX, camY);
                faceFn([rB1, rM1, rM4, rB4], _cBody, null, 0, camX, camY);
                faceFn([rM1, rT1, rT4, rM4], _cBody, null, 0, camX, camY);
                faceFn([wf(1.5, 0.31, 0.6), wf(1.0, 0.31, 0.6), wf(1.0, 0.31, 0.75), wf(1.5, 0.31, 0.75)], '#111', null, 0, camX, camY);
            } else {
                faceFn([rB1, rM1, rM4, rB4], _cBody, null, 0, camX, camY);
                faceFn([rM1, rT1, rT4, rM4], _cBody, null, 0, camX, camY);
                faceFn([rB2, rM2, rM3, rB3], _cBody, null, 0, camX, camY);
                faceFn([rM2, rT2, rT3, rM3], _cBody, null, 0, camX, camY);
                faceFn([wf(1.5, -0.31, 0.6), wf(1.0, -0.31, 0.6), wf(1.0, -0.31, 0.75), wf(1.5, -0.31, 0.75)], '#111', null, 0, camX, camY);
            }
            faceFn([rT1, rT2, rT3, rT4], _cTop, null, 0, camX, camY);
            // Tail — far side first, near side second, top last
            if (nearLeft) {
                faceFn([rM3, rT3, tailTop, tailLow], _cTail, null, 0, camX, camY);
                faceFn([rM4, rT4, tailTop, tailLow], _cTail, null, 0, camX, camY);
            } else {
                faceFn([rM4, rT4, tailTop, tailLow], _cTail, null, 0, camX, camY);
                faceFn([rM3, rT3, tailTop, tailLow], _cTail, null, 0, camX, camY);
            }
            faceFn([rT4, rT3, tailTop], _cTail, null, 0, camX, camY);
            // Nose face + cockpit window — always draw
            const nTip = wf(2.8, 0, 0.45);
            faceFn([nTip, rM2, rT2, rT1, rM1], _cNose, null, 0, camX, camY);
            faceFn([wf(2.6, 0, 0.5), wf(2.2, -0.35, 0.6), wf(2.2, 0.35, 0.6)], '#111', null, 0, camX, camY);
            // Forward pylon
            const vT = wf(1.5, 0, 1.15);
            faceFn([wf(1.8, 0.3, 0.85), wf(1.8, -0.3, 0.85), vT], _cPylF, null, 0, camX, camY);
            faceFn([wf(1.8, -0.3, 0.85), wf(1.2, -0.3, 0.85), vT], _cPylF, null, 0, camX, camY);
            faceFn([wf(1.2, -0.3, 0.85), wf(1.2, 0.3, 0.85), vT], _cPylF, null, 0, camX, camY);
            faceFn([wf(1.2, 0.3, 0.85), wf(1.8, 0.3, 0.85), vT], _cPylF, null, 0, camX, camY);
            // Rear pylon
            const hTop = wf(-2.3, 0, 1.8);
            faceFn([wf(-1.9, 0.3, 1.0), wf(-1.9, -0.3, 1.0), hTop], _cPylR, null, 0, camX, camY);
            faceFn([wf(-1.9, -0.3, 1.0), wf(-2.5, -0.15, 1.1), hTop], _cPylR, null, 0, camX, camY);
            faceFn([wf(-2.5, -0.15, 1.1), wf(-2.5, 0.15, 1.1), hTop], _cPylR, null, 0, camX, camY);
            faceFn([wf(-2.5, 0.15, 1.1), wf(-1.9, 0.3, 1.0), hTop], _cPylR, null, 0, camX, camY);
            // Rotors
            actualCtx.strokeStyle = 'rgba(220,245,255,0.6)';
            actualCtx.lineWidth = 3 * s * lineScale;
            const rF = p(1.5, 0, 1.15);
            for (let i = 0; i < 3; i++) {
                const a = hRotor + i * ((Math.PI * 2) / 3);
                const end = p(1.5 + Math.cos(a) * 3.4, Math.sin(a) * 3.4, 1.15);
                actualCtx.beginPath();
                actualCtx.moveTo(rF.x, rF.y);
                actualCtx.lineTo(end.x, end.y);
                actualCtx.stroke();
            }
            const rR = p(-2.3, 0, 1.8);
            for (let i = 0; i < 3; i++) {
                const a = -hRotor + i * ((Math.PI * 2) / 3);
                const end = p(-2.3 + Math.cos(a) * 3.4, Math.sin(a) * 3.4, 1.8);
                actualCtx.beginPath();
                actualCtx.moveTo(rR.x, rR.y);
                actualCtx.lineTo(end.x, end.y);
                actualCtx.stroke();
            }
        } else if (type === 'ornithopter') {
            const flapPhase = hRotor * 0.22 * flapRate;
            const wingAngle = Math.sin(flapPhase) * 0.32;
            const wingTipAngle = Math.sin(flapPhase + 1.0) * 0.14;
            if (isShadow) {
                const groundZ = shadowGetGround ? shadowGetGround(hX, hY) : hZ;
                actualCtx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.4 - (hZ - groundZ) * 0.04)})`;
                // Boxy fuselage silhouette
                actualCtx.beginPath();
                actualCtx.moveTo(p(0.9, 0.35, 0).x, p(0.9, 0.35, 0).y);
                actualCtx.lineTo(p(0.9, -0.35, 0).x, p(0.9, -0.35, 0).y);
                actualCtx.lineTo(p(-1.6, -0.15, 0).x, p(-1.6, -0.15, 0).y);
                actualCtx.lineTo(p(-1.6, 0.15, 0).x, p(-1.6, 0.15, 0).y);
                actualCtx.closePath();
                actualCtx.fill();
                // Wing shadows — reach scales with cos(wingAngle): up = small, down = large
                const wingReach = 3.5 * Math.max(0.25, Math.cos(wingAngle));
                actualCtx.beginPath();
                actualCtx.moveTo(p(0.2, 0.25, 0).x, p(0.2, 0.25, 0).y);
                actualCtx.lineTo(p(-0.7, 0.22, 0).x, p(-0.7, 0.22, 0).y);
                actualCtx.lineTo(p(-0.6, wingReach, 0).x, p(-0.6, wingReach, 0).y);
                actualCtx.lineTo(p(0.1, wingReach, 0).x, p(0.1, wingReach, 0).y);
                actualCtx.closePath();
                actualCtx.fill();
                actualCtx.beginPath();
                actualCtx.moveTo(p(0.2, -0.25, 0).x, p(0.2, -0.25, 0).y);
                actualCtx.lineTo(p(0.1, -wingReach, 0).x, p(0.1, -wingReach, 0).y);
                actualCtx.lineTo(p(-0.6, -wingReach, 0).x, p(-0.6, -wingReach, 0).y);
                actualCtx.lineTo(p(-0.7, -0.22, 0).x, p(-0.7, -0.22, 0).y);
                actualCtx.closePath();
                actualCtx.fill();
                return;
            }
            const wf = (lx: number, ly: number, lz: number) => ({
                x: lx * s * cosA - ly * s * sinA + hX,
                y: lx * s * sinA + ly * s * cosA + hY,
                z: hZ + (lz * s + ly * s * hRoll * 1.0 + lx * s * hTilt * 1.0),
            });
            const rollBias = hRoll * 0.15;
            const baked = applyNodes(getHeliType(type).def as any, {
                wingAngle: wingAngle + rollBias,
                wingAngleInv: -(wingAngle - rollBias),
                wingTipAngle: wingTipAngle + rollBias * 0.5,
                wingTipAngleInv: -(wingTipAngle - rollBias * 0.5),
            });
            const sorted = [...baked.faces]
                .map(face => {
                    const pts = face.verts.map(([lx, ly, lz]: number[]) => wf(lx, ly, lz));
                    const depth = pts.reduce((sum, pt) => sum + pt.x + pt.y, 0) / pts.length;
                    return { pts, color: face.color, stroke: face.stroke ?? null, depth };
                })
                .sort((a, b) => a.depth - b.depth);
            sorted.forEach(f => {
                faceFn(f.pts, f.color, f.stroke, 0, camX, camY);
            });
        }


    }

    return { drawFace, drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli };
}
