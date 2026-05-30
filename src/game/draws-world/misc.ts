import type { DrawWorldCtx } from './types';
import { G } from '../state';

export const createMiscDraw = (dwCtx: DrawWorldCtx) => {
    const { ctx, isoFn, tileW, isVisible, isMissionRain } = dwCtx;

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

    const renderRain = () => {
        if (!isMissionRain()) return;
        if (Math.random() < 0.005) {
            const el = document.getElementById('flash-overlay')!;
            el.style.opacity = '0.8';
            setTimeout(() => (el.style.opacity = '0'), 100);
        }
    };

    return { drawBirds, drawDebris, renderRain };
};
