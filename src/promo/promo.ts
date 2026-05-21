import { createDrawObjects } from '../game/draw-objects';
import { iso } from '../game/render';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../game/render-config';

const c = document.getElementById('promo-heli') as HTMLCanvasElement;
if (!c) throw new Error('promo-heli canvas not found');
const cx = c.getContext('2d')!;

const isoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
    iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });

const stub = { add: () => {}, flush: () => {}, debugAltitude: false } as any;
const { drawHeli } = createDrawObjects(cx, isoFn, tileW, tileH, stub);

const W = Math.round(460 * CANVAS_SCALE);
const H = Math.round(340 * CANVAS_SCALE);

const loop = () => {
    if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
    } else cx.clearRect(0, 0, W, H);

    const t = Date.now() * 0.001;

    // Slow drift — overlapping sines so it never repeats cleanly
    const hX = Math.sin(t * 0.23) * 0.35 + Math.sin(t * 0.51) * 0.12;
    const hY = Math.cos(t * 0.31) * 0.28 + Math.cos(t * 0.43) * 0.10;

    // Tilt derived from velocity (visual feedback of movement direction)
    const tilt  = (Math.cos(t * 0.23) * 0.23 * 0.35 + Math.cos(t * 0.51) * 0.51 * 0.12) * 0.18;
    const roll  = (-Math.sin(t * 0.31) * 0.31 * 0.28 - Math.sin(t * 0.43) * 0.43 * 0.10) * 0.18;

    drawHeli('dolphin', hX, hY, 0, Math.PI / 2, tilt, roll, t * 10, 0, 0, {
        targetCtx: cx,
        targetIso: isoFn,
        scaleOverride: 2,
    });
    requestAnimationFrame(loop);
};
loop();
