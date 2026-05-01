import './heli-select.css';
import { iso } from '../../render';
import { HELI_TYPES, type HeliType } from '../../heli-types';
import { RANKS } from '../../session';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { zstate } from '../../state';
import { I18N } from '../../i18n';
import { ensureEl } from '../dom-helpers';
import { showScreen } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';
import { createSwipeCarousel } from '../swipe-carousel/swipe-carousel';

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
let _activeHeliId: string | null = null;
let _rotorPos = 0;

const _heliPreviewLoop = () => {
    if (document.getElementById('heli-select')!.style.display === 'none') {
        _previewAnimRunning = false;
        return;
    }
    _rotorPos += 0.18;
    HELI_TYPES.forEach(ht => {
        const isActive = ht.id === _activeHeliId;
        if (isActive) {
            _G.menuAngles[ht.id] += 0.009;
        } else {
            const diff = -0.075 - _G.menuAngles[ht.id];
            if (Math.abs(diff) > 0.001) _G.menuAngles[ht.id] += diff * 0.1;
        }
        const c = document.getElementById('icon-' + ht.id) as HTMLCanvasElement | null;
        if (!c) return;
        const cx = c.getContext('2d')!;
        const tW = Math.round(260 * CANVAS_SCALE);
        const tH = Math.round(160 * CANVAS_SCALE);
        if (c.width !== tW || c.height !== tH) { c.width = tW; c.height = tH; }
        else cx.clearRect(0, 0, c.width, c.height);
        const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
            iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
        _drawHeli(ht.id, 0, 0, 0, _G.menuAngles[ht.id], 0, 0, isActive ? _rotorPos : 0, 0, 0, {
            targetCtx: cx, targetIso: offIso, scaleOverride: ht.previewScale,
        });
    });
    requestAnimationFrame(_heliPreviewLoop);
};

export const animateHeliPreviews = () => {
    if (_previewAnimRunning) return;
    _previewAnimRunning = true;
    _rotorPos = 0;
    _activeHeliId = null;
    _heliPreviewLoop();
};

export const mountHeliSelect = () => {
    ensureEl('heli-select');
};

type HeliSelectDeps = {
    rankIndex: number;
    onSelect: (heliId: string) => void;
    onBack: () => void;
};

const _statBar = (label: string, pct: number): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'heli-stat-row';
    row.innerHTML = `
        <span class="heli-stat-label">${label}</span>
        <div class="heli-stat-bar"><div class="heli-stat-fill" style="width:0%" data-pct="${pct}"></div></div>`;
    return row;
};

const _buildHeliDetail = (ht: HeliType, onSelect: (heliId: string) => void): HTMLElement => {
    const spd = Math.min(100, Math.round(ht.accel / 0.00117 * 100));
    const agi = Math.min(100, Math.round(ht.tiltSpeed / 0.05 * 100));
    const cap = Math.min(100, Math.round(ht.maxLoad / 20 * 100));
    const end = Math.min(100, Math.max(0, Math.round((0.012 - ht.fuelRate) / 0.012 * 90 + 10)));

    const wrap = document.createElement('div');
    wrap.className = 'heli-detail-wrap';

    const header = document.createElement('div');
    header.innerHTML = `
        <div class="heli-detail-name">${ht.selectLabel}</div>
        <div class="heli-detail-sub">${ht.selectSub}</div>
        ${ht.description ? `<div class="heli-detail-fluff">${ht.description}</div>` : ''}
        ${ht.canCarryCargo ? `<div class="heli-cargo-badge">✦ CARGOFÄHIG</div>` : ''}`;
    wrap.appendChild(header);

    wrap.appendChild(_statBar('GESCHW.', spd));
    wrap.appendChild(_statBar('AGILITÄT', agi));
    wrap.appendChild(_statBar('KAPAZITÄT', cap));
    wrap.appendChild(_statBar('AUSDAUER', end));

    const btn = document.createElement('button');
    btn.className = 'heli-select-btn';
    btn.textContent = I18N.HELI_SELECT_CONFIRM;
    btn.addEventListener('click', () => {
        _activeHeliId = null;
        onSelect(ht.id);
    });
    wrap.appendChild(btn);

    requestAnimationFrame(() => {
        wrap.querySelectorAll<HTMLElement>('.heli-stat-fill').forEach(el => {
            el.style.width = (el.dataset.pct ?? '0') + '%';
        });
    });

    return wrap;
};

export const showHeliSelect = (deps: HeliSelectDeps) => {
    const { rankIndex, onSelect, onBack } = deps;

    const body = mountScreenShell('heli-select', I18N.HELI_SELECT_TITLE, I18N.HELI_SELECT_SUB, onBack);

    const visibleTypes = HELI_TYPES.filter(ht => !(ht.hideWhenLocked && ht.minRankIndex > rankIndex));

    const carousel = createSwipeCarousel<HeliType>({
        items: visibleTypes,
        isLocked: ht => ht.minRankIndex > rankIndex,
        renderCard: (ht, locked) => {
            const card = document.createElement('div');
            const lockLabel = locked
                ? `<div class="box-sub heli-lock-label">${I18N.HELI_LOCKED_FROM(RANKS[ht.minRankIndex].name.toUpperCase())}</div>`
                : `<div class="box-sub heli-cap-label">${ht.selectCap}</div>`;
            card.innerHTML = `
                <canvas id="icon-${ht.id}" class="heli-card-canvas"></canvas>
                <div class="box-label">${ht.selectLabel}</div>
                ${lockLabel}`;
            return card;
        },
        renderDetail: ht => {
            const locked = ht.minRankIndex > rankIndex;
            if (locked) return null;
            _activeHeliId = ht.id;
            return _buildHeliDetail(ht, onSelect);
        },
        onDetailClose: () => {
            _activeHeliId = null;
        },
    });

    body.appendChild(carousel);
    showScreen('heli-select');
    animateHeliPreviews();
};
