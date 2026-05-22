import './promo.css';
import { createDrawObjects } from '../../draw-objects';
import { iso } from '../../render';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { ensureEl } from '../dom-helpers';

let _rafId = 0;

export const mount = (): void => {
    const el = ensureEl('promo');
    el.innerHTML = `<div id="pw">
        <h1>SAR:<br/>Callsign WOLF</h1>
        <canvas id="ph"></canvas>
        <div class="cs">COMING SOON</div>
        <a class="il" href="?imprint">IMPRESSUM · DATENSCHUTZ · LEGAL</a>
    </div>`;

    const c = document.getElementById('ph') as HTMLCanvasElement;
    const cx = c.getContext('2d')!;

    const isoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });

    const stub = { add: () => {}, flush: () => {}, debugAltitude: false } as unknown as Parameters<
        typeof createDrawObjects
    >[4];
    const { drawHeli } = createDrawObjects(cx, isoFn, tileW, tileH, stub);

    const W = Math.round(460 * CANVAS_SCALE);
    const H = Math.round(340 * CANVAS_SCALE);

    const loop = (): void => {
        if (c.width !== W || c.height !== H) {
            c.width = W;
            c.height = H;
        } else {
            cx.clearRect(0, 0, W, H);
        }

        const t = Date.now() * 0.001;
        const hX = Math.sin(t * 0.23) * 0.35 + Math.sin(t * 0.51) * 0.12;
        const hY = Math.cos(t * 0.31) * 0.28 + Math.cos(t * 0.43) * 0.1;
        const tilt = (Math.cos(t * 0.23) * 0.23 * 0.35 + Math.cos(t * 0.51) * 0.51 * 0.12) * 0.18;
        const roll = (-Math.sin(t * 0.31) * 0.31 * 0.28 - Math.sin(t * 0.43) * 0.43 * 0.1) * 0.18;

        drawHeli('dolphin', hX, hY, 0, Math.PI / 2, tilt, roll, t * 10, 0, 0, {
            targetCtx: cx,
            targetIso: isoFn,
            scaleOverride: 2,
        });
        _rafId = requestAnimationFrame(loop);
    };
    loop();
};

export const show = (): void => {
    ensureEl('promo').style.display = 'flex';
};

export const hide = (): void => {
    cancelAnimationFrame(_rafId);
    const el = document.getElementById('promo');
    if (el) el.style.display = 'none';
};
