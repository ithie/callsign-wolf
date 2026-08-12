import { G } from '../state';
import type { DrawWorldCtx } from './types';

const RALLY_MS    = 3600;   // 4 exchanges × 900 ms
const N_EX        = 4;
const BALL_PEAK_H = 2.5;    // world units, peak height of arc
const ARM_H       = 1.3;    // world units, ball height at hit / receive

const _SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71'];
const _SKIN   = '#f2c27d';

type Court = { x: number; y: number; gz: number; angle: number };

const _lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// court-local (lx,ly,lz) → world → screen
const _iso3 = (
    isoFn: DrawWorldCtx['isoFn'],
    court: Court,
    lx: number, ly: number, lz: number,
    cx: number, cy: number
) => {
    const c = Math.cos(court.angle), s = Math.sin(court.angle);
    return isoFn(court.x + lx * c - ly * s, court.y + lx * s + ly * c, court.gz + lz, cx, cy);
};

// 4 players: base positions in court-local space + team
const _PL = [
    { lx: -2.6, ly: -0.85, team: 0 },   // 0 left-back
    { lx: -1.9, ly:  0.85, team: 0 },   // 1 left-front
    { lx:  2.6, ly:  0.85, team: 1 },   // 2 right-back
    { lx:  1.9, ly: -0.85, team: 1 },   // 3 right-front
] as const;

// 4 scripted exchanges: [hitterIdx, receiverIdx]
const _EX = [[0, 2], [2, 1], [1, 3], [3, 0]] as const;

const _drawCourt = (
    ctx: CanvasRenderingContext2D,
    isoFn: DrawWorldCtx['isoFn'],
    court: Court,
    camX: number, camY: number
) => {
    // ── Derive tileW → person scale (matches drawPerson exactly) ─────────────
    const ptA = isoFn(court.x,     court.y, court.gz, camX, camY);
    const ptB = isoFn(court.x + 1, court.y, court.gz, camX, camY);
    const derivedTileW = Math.abs(ptB.x - ptA.x) * 2;
    const s = Math.max(0.35, derivedTileW / 64); // same as drawPerson

    const headR = Math.max(1, 2.5 * s);    // same as drawPerson
    const legH  = Math.max(1.5, 7 * s);
    const torsoH = Math.max(1.5, 7.5 * s);
    const bodyH = legH + torsoH;           // same total as drawPerson
    const bodyW = Math.max(1.5, 5 * s);   // same as torsoW in drawPerson

    // ── Rally state ───────────────────────────────────────────────────────────
    const globalT = (Date.now() % RALLY_MS) / RALLY_MS;
    const exchIdx = Math.floor(globalT * N_EX) as 0 | 1 | 2 | 3;
    const subT    = (globalT * N_EX) % 1;          // 0→1 within current exchange

    const [hIdx, rIdx] = _EX[exchIdx];
    const hitter   = _PL[hIdx];
    const receiver = _PL[rIdx];

    const CHL   = 3.0;   // court half-length (world units)
    const CHW   = 1.5;   // court half-width
    const NET_H = 1.6;

    // ── Sand court ────────────────────────────────────────────────────────────
    const corners: [number, number][] = [[-CHL, -CHW], [CHL, -CHW], [CHL, CHW], [-CHL, CHW]];
    const pts = corners.map(([lx, ly]) => _iso3(isoFn, court, lx, ly, 0, camX, camY));

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#d4b483';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    // center line
    const cl0 = _iso3(isoFn, court, 0, -CHW, 0, camX, camY);
    const cl1 = _iso3(isoFn, court, 0,  CHW, 0, camX, camY);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cl0.x, cl0.y); ctx.lineTo(cl1.x, cl1.y); ctx.stroke();

    // ── Net ───────────────────────────────────────────────────────────────────
    const np0 = _iso3(isoFn, court, 0, -CHW - 0.2, 0,     camX, camY);
    const np1 = _iso3(isoFn, court, 0,  CHW + 0.2, 0,     camX, camY);
    const nt0 = _iso3(isoFn, court, 0, -CHW - 0.2, NET_H, camX, camY);
    const nt1 = _iso3(isoFn, court, 0,  CHW + 0.2, NET_H, camX, camY);

    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(np0.x, np0.y); ctx.lineTo(nt0.x, nt0.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(np1.x, np1.y); ctx.lineTo(nt1.x, nt1.y); ctx.stroke();

    for (let b = 0; b <= 3; b++) {
        const f = b / 3;
        const b0 = _iso3(isoFn, court, 0, -CHW - 0.2, NET_H * f, camX, camY);
        const b1 = _iso3(isoFn, court, 0,  CHW + 0.2, NET_H * f, camX, camY);
        ctx.strokeStyle = b === 3 ? '#ddd' : 'rgba(180,180,180,0.4)';
        ctx.lineWidth = b === 3 ? 1.2 : 0.7;
        ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    }

    // ── Players ───────────────────────────────────────────────────────────────
    _PL.forEach((p: { lx: number; ly: number; team: 0 | 1 }, pi) => {
        let curLX = p.lx;
        let curLY = p.ly;
        let armRaised = false;

        if (pi === hIdx) {
            // Hitter: steps forward toward net immediately
            const t = Math.min(1, subT * 6);
            curLX = _lerp(p.lx, p.lx * 0.45, t);
            curLY = _lerp(p.ly, p.ly * 0.5,  t);
            armRaised = subT < 0.10;
        } else if (pi === rIdx) {
            // Receiver: moves to intercept as ball approaches
            const t = Math.max(0, Math.min(1, (subT - 0.25) * 3.0));
            curLX = _lerp(p.lx, p.lx * 0.55, t);
            curLY = _lerp(p.ly, p.ly * 0.55, t);
            armRaised = subT > 0.87;
        }

        // Foot position via iso projection
        const feet = _iso3(isoFn, court, curLX, curLY, 0, camX, camY);

        // Draw in pure screen-space — matches drawPerson scale
        const fY     = feet.y;
        const waistY = fY - legH;
        const torsoT = fY - bodyH;
        const headY  = torsoT - headR;

        ctx.globalAlpha = 0.9;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(feet.x, fY, bodyW * 0.85, bodyW * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pants
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(feet.x - bodyW * 0.5, waistY, bodyW, fY - waistY);

        // Shirt
        ctx.fillStyle = _SHIRTS[pi];
        ctx.fillRect(feet.x - bodyW * 0.55, torsoT, bodyW * 1.1, waistY - torsoT);

        // Head
        ctx.fillStyle = _SKIN;
        ctx.beginPath();
        ctx.arc(feet.x, headY, headR, 0, Math.PI * 2);
        ctx.fill();

        // Raised arm
        if (armRaised) {
            ctx.strokeStyle = _SKIN;
            ctx.lineWidth = Math.max(0.7, headR * 0.55);
            ctx.beginPath();
            ctx.moveTo(feet.x + bodyW * 0.3, torsoT + (waistY - torsoT) * 0.2);
            ctx.lineTo(feet.x + bodyW * 0.6, headY - headR * 0.5);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    });

    // ── Ball ──────────────────────────────────────────────────────────────────
    const ballLX = _lerp(hitter.lx, receiver.lx, subT);
    const ballLY = _lerp(hitter.ly, receiver.ly, subT);
    const ballLZ = ARM_H + (BALL_PEAK_H - ARM_H) * Math.sin(subT * Math.PI);

    const ballPos   = _iso3(isoFn, court, ballLX, ballLY, ballLZ, camX, camY);
    const shadowPos = _iso3(isoFn, court, ballLX, ballLY, 0,      camX, camY);
    const ballR = Math.max(1.2, headR * 0.78);

    // Shadow fades toward peak
    ctx.globalAlpha = 0.22 * (1 - (ballLZ - ARM_H) / (BALL_PEAK_H - ARM_H) * 0.7);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(shadowPos.x, shadowPos.y, ballR * 1.1, ballR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f0e0a0';
    ctx.beginPath();
    ctx.arc(ballPos.x, ballPos.y, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8a040';
    ctx.lineWidth = 0.6;
    ctx.stroke();
};

export const createVolleyballDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, SceneRenderer, isVisible } = dwCtx;

    const _drawVolleyballCourts = (inNightCone: (x: number, y: number) => boolean) => {
        G.VOLLEYBALL_COURTS.forEach(court => {
            if (!isVisible(court.x, court.y)) return;
            if (!inNightCone(court.x, court.y)) return;
            SceneRenderer.add(null, {
                x: 0, y: 0,
                depth: court.x + court.y,
                drawFn: (cx: number, cy: number) => _drawCourt(ctx, isoFn, court, cx, cy),
            });
        });
    };

    return { _drawVolleyballCourts };
};
