import { createDrawObjects } from '../../draw-objects';
import { iso } from '../../render';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { render as renderImprint } from '../imprint-page/imprint-page';

const mount = (): void => {
    document.head.insertAdjacentHTML('beforeend', `<style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#050505;color:#5f5;font-family:monospace;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;}
        #pw{display:flex;flex-direction:column;align-items:center;text-align:center;gap:24px;max-width:560px;width:100%;}
        #ph{width:min(460px,88vw);height:auto;aspect-ratio:460/340;image-rendering:pixelated;margin:60px 0;}
        h1{font-size:clamp(26px,5.5vw,52px);color:#ff6600;text-shadow:0 0 20px #ff6600,0 0 50px rgba(255,102,0,.35);letter-spacing:5px;font-weight:bold;line-height:1.15;}
        .cs{font-size:clamp(13px,2.5vw,18px);letter-spacing:8px;color:#5f5;animation:pulse 2.5s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .il{font-size:10px;letter-spacing:3px;color:#2a2a2a;text-decoration:none;transition:color .2s;margin-top:8px;cursor:pointer;}
        .il:hover{color:#555;}
    </style>`);

    document.body.innerHTML = `<div id="pw">
        <h1>SAR:<br/>Callsign WOLF</h1>
        <canvas id="ph"></canvas>
        <div class="cs">COMING SOON</div>
        <span class="il">IMPRESSUM · DATENSCHUTZ · LEGAL</span>
    </div>`;

    const c = document.getElementById('ph') as HTMLCanvasElement;
    const cx = c.getContext('2d')!;

    const isoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });

    const stub = { add: () => {}, flush: () => {}, debugAltitude: false } as unknown as Parameters<typeof createDrawObjects>[4];
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
        const hY = Math.cos(t * 0.31) * 0.28 + Math.cos(t * 0.43) * 0.10;
        const tilt = (Math.cos(t * 0.23) * 0.23 * 0.35 + Math.cos(t * 0.51) * 0.51 * 0.12) * 0.18;
        const roll = (-Math.sin(t * 0.31) * 0.31 * 0.28 - Math.sin(t * 0.43) * 0.43 * 0.10) * 0.18;

        drawHeli('dolphin', hX, hY, 0, Math.PI / 2, tilt, roll, t * 10, 0, 0, {
            targetCtx: cx,
            targetIso: isoFn,
            scaleOverride: 2,
        });
        requestAnimationFrame(loop);
    };
    loop();

    document.querySelector('.il')!.addEventListener('click', renderImprint);
};

if (new URLSearchParams(location.search).has('imprint')) {
    renderImprint();
} else {
    mount();
}
