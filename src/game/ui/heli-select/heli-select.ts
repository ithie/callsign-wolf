import './heli-select.css';
import '@/ui/nav-screens.css';
import { iso } from '../../render';
import { HELI_TYPES, type HeliType } from '../../heli-types';
import { RANKS } from '../rank-badge/rank-badge';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { zstate } from '../../state';
import { I18N, localize } from '../../i18n';
import { ensureEl } from '@/ui/dom-helpers';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { createSwipeCarousel } from '@/ui/swipe-carousel/swipe-carousel';
import { hapticImpact, ImpactStyle } from '../../haptics';
import { addStamp } from '../box-stamp';
import { storageGet, storageSet } from '../../storage';

let _G: any;
let _drawHeli: (...args: any[]) => void;

const _getPlayerColor = (): string => {
    const v = storageGet('z_heli_color');
    return v === 'blue' ? 'blue' : v === 'sand' ? 'sand' : v === 'green' ? 'green' : 'orange';
};

export const init = (G: any, drawHeli: (...args: any[]) => void) => {
    _G = G;
    _drawHeli = drawHeli;
};

let _lastBgTs = 0;
let _lastMenuHeliTs = 0;

export const animMainMenuBg = (ts: number = performance.now()) => {
    if (document.getElementById('main-menu')!.style.display === 'none') return;
    if (ts - _lastBgTs < 1000 / 30) { requestAnimationFrame(animMainMenuBg); return; }
    _lastBgTs = ts;
    const c = document.getElementById('main-menu-bg-canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const cx = c.getContext('2d')!;
    const cW = Math.round(900 * CANVAS_SCALE), cH = Math.round(500 * CANVAS_SCALE);
    if (c.width !== cW || c.height !== cH) { c.width = cW; c.height = cH; }
    else cx.clearRect(0, 0, c.width, c.height);
    const t = Date.now() * 0.001;
    const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    const _mc = _getPlayerColor();
    _drawHeli('dolphin', 0, 0, 0, t * 0.25, Math.sin(t * 0.4) * 0.07, Math.cos(t * 0.35) * 0.07, t * 8, 0, 0, {
        targetCtx: cx, targetIso: offIso, scaleOverride: 5,
        colorVariant: _mc === 'disco' ? undefined : _mc,
    });
    requestAnimationFrame(animMainMenuBg);
};

export const drawMenuHeli = (ts: number = performance.now()) => {
    if (zstate.gameStarted) return;
    if (ts - _lastMenuHeliTs < 1000 / 30) { requestAnimationFrame(drawMenuHeli); return; }
    _lastMenuHeliTs = ts;
    const c = document.getElementById('menu-heli-big') as HTMLCanvasElement | null;
    if (!c) return;
    const cx = c.getContext('2d')!;
    const cW = Math.round(800 * CANVAS_SCALE), cH = Math.round(300 * CANVAS_SCALE);
    if (c.width !== cW || c.height !== cH) { c.width = cW; c.height = cH; }
    else cx.clearRect(0, 0, c.width, c.height);
    const t = Date.now() * 0.001;
    const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    const _mc = _getPlayerColor();
    _drawHeli('dolphin', 1.5, 1.5, 0.8, t * 0.5, Math.sin(t) * 0.1, Math.cos(t) * 0.1, t * 12, 0, 0, {
        targetCtx: cx, targetIso: offIso, scaleOverride: 3,
        colorVariant: _mc === 'disco' ? undefined : _mc,
    });
    const splashVisible = document.getElementById('splash')!.style.display !== 'none';
    if (splashVisible) requestAnimationFrame(drawMenuHeli);
};

let _previewAnimRunning = false;
let _activeHeliId: string | null = null;
let _rotorPos = 0;
let _overlayAngle = 0;

const OVERLAY_SCALE_RATIO = 1.7;

const _heliPreviewLoop = () => {
    if (document.getElementById('heli-select')!.style.display === 'none') {
        _previewAnimRunning = false;
        return;
    }
    _rotorPos += 0.18;
    HELI_TYPES.forEach(ht => {
        const isActive = ht.id === _activeHeliId;

        // Overlay rotates; card canvas freezes at rest angle while overlay is open
        const cardAngle = isActive ? -0.075 : _G.menuAngles[ht.id];
        if (isActive) {
            _overlayAngle += 0.009;
        } else {
            const diff = -0.075 - _G.menuAngles[ht.id];
            if (Math.abs(diff) > 0.001) _G.menuAngles[ht.id] += diff * 0.1;
        }

        const c = document.getElementById('icon-' + ht.id) as HTMLCanvasElement | null;
        if (c) {
            const cx = c.getContext('2d')!;
            const tW = Math.round(280 * CANVAS_SCALE);
            const tH = Math.round(220 * CANVAS_SCALE);
            if (c.width !== tW || c.height !== tH) { c.width = tW; c.height = tH; }
            else cx.clearRect(0, 0, c.width, c.height);
            const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
                iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
            _drawHeli(ht.id, 0, 0, 0, cardAngle, 0, 0, 0, 0, 0, {
                targetCtx: cx, targetIso: offIso, scaleOverride: ht.previewScale,
                colorVariant: ht.id === 'ornithopter' ? undefined : _getPlayerColor(),
            });
        }

        if (isActive) {
            const oc = document.getElementById('overlay-icon-' + ht.id) as HTMLCanvasElement | null;
            if (oc && oc.isConnected) {
                const ocx = oc.getContext('2d')!;
                const oW = Math.round(360 * CANVAS_SCALE);
                const oH = Math.round(280 * CANVAS_SCALE);
                if (oc.width !== oW || oc.height !== oH) { oc.width = oW; oc.height = oH; }
                else ocx.clearRect(0, 0, oc.width, oc.height);
                const overlayIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
                    iso(wx, wy, wz, camX, camY, { canvas: oc, tileW, tileH, stepH });
                _drawHeli(ht.id, 0, 0, 0, _overlayAngle, 0, 0, _rotorPos, 0, 0, {
                    targetCtx: ocx, targetIso: overlayIso, scaleOverride: ht.previewScale * OVERLAY_SCALE_RATIO,
                    colorVariant: ht.id === 'ornithopter' ? undefined : _getPlayerColor(),
                });
            }
        }
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

export const mount = () => {
    ensureEl('heli-select');
};

type HeliSelectDeps = {
    rankIndex: number;
    typeRatings: Record<string, true>;
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

const _buildOverlayDetail = (ht: HeliType, onSelect: (heliId: string) => void): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'heli-overlay-wrap';

    // Column 1: heli canvas — click propagates to overlay background → closes
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'heli-overlay-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.className = 'heli-overlay-canvas';
    canvas.id = 'overlay-icon-' + ht.id;
    canvasWrap.appendChild(canvas);
    wrap.appendChild(canvasWrap);

    // Column 2: description text — click propagates to overlay → closes
    if (ht.description) {
        const textCol = document.createElement('div');
        textCol.className = 'heli-overlay-text';
        textCol.textContent = localize(ht.description);
        wrap.appendChild(textCol);
    }

    // Column 3: stats + button — stopPropagation so clicking here does NOT close
    const statsCol = document.createElement('div');
    statsCol.className = 'heli-overlay-stats';
    statsCol.addEventListener('click', e => e.stopPropagation());

    const _colorDefs: Array<{ key: string; cls: string; label: string }> = [
        { key: 'orange', cls: 'heli-color-swatch-orange', label: I18N.HELI_COLOR_ORANGE },
        { key: 'blue',   cls: 'heli-color-swatch-blue',   label: I18N.HELI_COLOR_BLUE },
        { key: 'sand',   cls: 'heli-color-swatch-sand',   label: I18N.HELI_COLOR_SAND },
        { key: 'green',  cls: 'heli-color-swatch-green',  label: I18N.HELI_COLOR_GREEN },
    ];
    const colorRow = document.createElement('div');
    colorRow.className = 'heli-color-row';
    _colorDefs.forEach(({ key, cls, label }) => {
        const wrap = document.createElement('div');
        wrap.className = 'heli-color-item';
        const swatch = document.createElement('button');
        swatch.className = `heli-color-swatch ${cls}`;
        if (_getPlayerColor() === key) swatch.classList.add('heli-color-swatch-active');
        swatch.title = label;
        swatch.addEventListener('click', e => {
            e.stopPropagation();
            storageSet('z_heli_color', key);
            colorRow.querySelectorAll('.heli-color-swatch').forEach(s => s.classList.remove('heli-color-swatch-active'));
            swatch.classList.add('heli-color-swatch-active');
        });
        const lbl = document.createElement('span');
        lbl.className = 'heli-color-swatch-label';
        lbl.textContent = label;
        wrap.appendChild(swatch);
        wrap.appendChild(lbl);
        colorRow.appendChild(wrap);
    });
    if (ht.id !== 'ornithopter') statsCol.appendChild(colorRow);

    const spd = Math.min(100, Math.round(ht.accel / 0.00117 * 100));
    const agi = Math.min(100, Math.round(ht.tiltSpeed / 0.05 * 100));
    const cap = Math.min(100, Math.round(ht.maxLoad / 20 * 100));
    const end = Math.min(100, Math.max(0, Math.round((0.012 - ht.fuelRate) / 0.012 * 90 + 10)));

    statsCol.appendChild(_statBar(I18N.HELI_STAT_SPEED, spd));
    statsCol.appendChild(_statBar(I18N.HELI_STAT_AGILITY, agi));
    statsCol.appendChild(_statBar(I18N.HELI_STAT_CAPACITY, cap));
    statsCol.appendChild(_statBar(I18N.HELI_STAT_ENDURANCE, end));

    const btn = document.createElement('button');
    btn.className = 'heli-select-btn';
    btn.textContent = I18N.HELI_SELECT_CONFIRM;
    btn.addEventListener('click', () => {
        _activeHeliId = null;
        onSelect(ht.id);
    });
    statsCol.appendChild(btn);

    requestAnimationFrame(() => {
        statsCol.querySelectorAll<HTMLElement>('.heli-stat-fill').forEach(el => {
            el.style.width = (el.dataset.pct ?? '0') + '%';
        });
    });

    wrap.appendChild(statsCol);
    return wrap;
};

export const show = (deps: HeliSelectDeps) => {
    const { rankIndex, typeRatings, onSelect, onBack } = deps;

    const _isLocked = (ht: HeliType): boolean => {
        if (ht.minRankIndex > rankIndex) return true;
        if (ht.typeRatingRequired && !typeRatings[ht.id]) return true;
        return false;
    };
    const _lockLabel = (ht: HeliType): string => {
        if (ht.minRankIndex > rankIndex)
            return `<div class="box-sub heli-lock-label heli-card-label-sub">${I18N.HELI_LOCKED_FROM(I18N.RANK_NAME(RANKS[ht.minRankIndex].key).toUpperCase())}</div>`;
        if (ht.typeRatingRequired && !typeRatings[ht.id])
            return `<div class="box-sub heli-lock-label heli-card-label-sub">${I18N.HELI_TYPE_RATING_REQUIRED}</div>`;
        return `<div class="box-sub heli-cap-label heli-card-label-sub">${localize(ht.selectCap)}</div>`;
    };

    const body = mountScreenShell('heli-select', I18N.HELI_SELECT_TITLE, onBack);

    const visibleTypes = HELI_TYPES.filter(ht => !(ht.hideWhenLocked && ht.minRankIndex > rankIndex));

    const carousel = createSwipeCarousel<HeliType>({
        items: visibleTypes,
        isLocked: _isLocked,
        renderStamp: (ht) =>
            ht.typeRatingRequired && !typeRatings[ht.id]
                ? addStamp(I18N.HELI_TYPE_RATING_REQUIRED, '#5a3a00')
                : null,
        renderCard: (ht, _locked) => {
            const card = document.createElement('div');
            card.innerHTML = `
                <canvas id="icon-${ht.id}" class="heli-card-canvas"></canvas>
                <div class="heli-card-label">
                    <div class="box-label">${ht.selectLabel}</div>
                    ${_lockLabel(ht)}
                </div>`;
            return card;
        },
        renderDetail: (ht, _close) => {
            const locked = _isLocked(ht);
            if (locked) return null;
            _activeHeliId = ht.id;
            _overlayAngle = _G.menuAngles[ht.id];
            return _buildOverlayDetail(ht, onSelect);
        },
        onDetailClose: () => {
            _activeHeliId = null;
        },
        haptic: () => hapticImpact(ImpactStyle.Light),
    });

    body.appendChild(carousel);
    showScreenCrtEnter('heli-select');
    animateHeliPreviews();
};
