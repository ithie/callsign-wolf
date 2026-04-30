import './heli-select.css';
import { iso } from '../../render';
import { HELI_TYPES, type HeliType } from '../../heli-types';
import { RANKS } from '../../session';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { zstate } from '../../state';
import { I18N } from '../../i18n';

let _G: any;
let _drawHeli: (...args: any[]) => void;

export const initHeliSelect = (G: any, drawHeli: (...args: any[]) => void) => {
    _G = G;
    _drawHeli = drawHeli;
};

export const animMainMenuBg = () => {
    if (document.getElementById('main-menu')!.style.display === 'none') return;
    const c = document.getElementById('main-menu-bg-canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const cx = c.getContext('2d')!;
    c.width = Math.round(900 * CANVAS_SCALE); c.height = Math.round(500 * CANVAS_SCALE);
    cx.clearRect(0, 0, c.width, c.height);
    const t = Date.now() * 0.001;
    const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    _drawHeli('dolphin', 0, 0, 0, t * 0.25, Math.sin(t * 0.4) * 0.07, Math.cos(t * 0.35) * 0.07, t * 8, 0, 0, {
        targetCtx: cx, targetIso: offIso, scaleOverride: 5,
    });
    requestAnimationFrame(animMainMenuBg);
};

export const drawMenuHeli = () => {
    if (zstate.gameStarted) return;
    const c = document.getElementById('menu-heli-big') as HTMLCanvasElement | null;
    if (!c) return;
    const cx = c.getContext('2d')!;
    c.width = Math.round(800 * CANVAS_SCALE);
    c.height = Math.round(300 * CANVAS_SCALE);
    cx.clearRect(0, 0, c.width, c.height);
    const t = Date.now() * 0.001;
    const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    _drawHeli('dolphin', 1.5, 1.5, 0.8, t * 0.5, Math.sin(t) * 0.1, Math.cos(t) * 0.1, t * 12, 0, 0, {
        targetCtx: cx, targetIso: offIso, scaleOverride: 3,
    });
    const splashVisible = document.getElementById('splash')!.style.display !== 'none';
    if (splashVisible) requestAnimationFrame(drawMenuHeli);
};

let _previewAnimRunning = false;

const _heliPreviewLoop = () => {
    if (document.getElementById('heli-select')!.style.display === 'none') {
        _previewAnimRunning = false;
        return;
    }
    HELI_TYPES.forEach(ht => {
        if (_G.menuHover[ht.id]) {
            _G.menuAngles[ht.id] += 0.012;
        } else {
            const diff = -0.075 - _G.menuAngles[ht.id];
            _G.menuAngles[ht.id] += Math.abs(diff) > 0.01 ? diff * 0.1 : 0;
        }
        const c = document.getElementById('icon-' + ht.id) as HTMLCanvasElement | null;
        if (c) {
            const cx = c.getContext('2d')!;
            c.width = Math.round(300 * CANVAS_SCALE);
            c.height = Math.round(200 * CANVAS_SCALE);
            cx.clearRect(0, 0, c.width, c.height);
            const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
                iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
            _drawHeli(ht.id, 0, 0, 0, _G.menuAngles[ht.id], 0, 0, 0, 0, 0, {
                targetCtx: cx, targetIso: offIso, scaleOverride: ht.previewScale,
            });
        }
    });
    requestAnimationFrame(_heliPreviewLoop);
};

export const animateHeliPreviews = () => {
    if (_previewAnimRunning) return;
    _previewAnimRunning = true;
    _heliPreviewLoop();
};

export const buildHeliSelect = (_campaignType: string, rankIndex: number) => {
    const container = document.getElementById('heli-options');
    if (!container) return;
    container.innerHTML = '';
    const types = HELI_TYPES;
    (document.querySelector('#heli-select .subtitle') as HTMLElement)!.textContent = 'HUBSCHRAUBER WÄHLEN';
    const visibleTypes = types.filter((ht: HeliType) => !(ht.hideWhenLocked && ht.minRankIndex > rankIndex));
    const cols = visibleTypes.length <= 1 ? 1 : visibleTypes.length === 4 ? 2 : 3;
    container.style.gridTemplateColumns = Array(cols).fill('1fr').join(' ');
    container.style.width = cols === 1 ? '350px' : cols === 2 ? '600px' : '900px';
    visibleTypes.forEach((ht: HeliType) => {
        const locked = ht.minRankIndex > rankIndex;
        const div = document.createElement('div');
        div.className = 'grid-box' + (locked ? ' locked' : '');
        if (!locked) {
            div.setAttribute('onclick', `startGame('${ht.id}')`);
            div.setAttribute('onmouseenter', `setHover('${ht.id}', true)`);
            div.setAttribute('onmouseleave', `setHover('${ht.id}', false)`);
        }
        const lockLabel = locked
            ? `<div class="box-sub" style="color:#333">${I18N.HELI_LOCKED_FROM(RANKS[ht.minRankIndex].name.toUpperCase())}</div>`
            : `<div class="box-sub" style="color: #aaa">${ht.selectCap}</div>`;
        div.innerHTML = `<canvas id="icon-${ht.id}" class="mini-canvas" width="300" height="200"></canvas>
            <div class="box-label">${ht.selectLabel}</div>
            <div class="box-sub">${ht.selectSub}</div>
            ${lockLabel}`;
        container.appendChild(div);
    });
};
