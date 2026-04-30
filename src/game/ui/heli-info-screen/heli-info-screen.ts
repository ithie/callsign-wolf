import './heli-info-screen.css';
import { iso } from '../../render';
import { HELI_TYPES } from '../../heli-types';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { showScreen } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

let _G: any;
let _drawHeli: (...args: any[]) => void;
let _onBack: (() => void) | null = null;

let _selectedHeliInfoId: string | null = null;
let _rotorPos = 0;
let _selectionCooldown = false;

export const mountHeliInfoScreen = (onBack: () => void): void => {
    _onBack = onBack;
    const body = mountScreenShell('heli-info', 'HANGAR', 'TYPENÜBERSICHT', _handleBack);
    body.innerHTML = `
        <div id="heli-info-stage">
            <div id="heli-cards-area"></div>
            <div id="heli-detail-panel"></div>
        </div>`;
};

const _handleBack = () => {
    if (_selectedHeliInfoId) {
        _selectHeliInfo(_selectedHeliInfoId);
    } else if (!_selectionCooldown) {
        _onBack?.();
    }
};

export const initHeliInfoScreen = (
    G: any,
    drawHeli: (...args: any[]) => void,
) => {
    _G = G;
    _drawHeli = drawHeli;
};

export const toHeliInfo = () => {
    _selectedHeliInfoId = null;
    _selectionCooldown = false;
    _buildHeliInfoCards();
    showScreen('heli-info');
    _animHeliInfo();
};

const _buildHeliInfoCards = () => {
    const area = document.getElementById('heli-cards-area')!;
    area.innerHTML = '';
    const panel = document.getElementById('heli-detail-panel')!;
    panel.classList.remove('visible');
    panel.innerHTML = '';

    HELI_TYPES.forEach(ht => {
        const card = document.createElement('div');
        card.className = 'heli-card';
        card.id = 'heli-card-' + ht.id;
        card.innerHTML = `<canvas id="heli-info-cv-${ht.id}" width="254" height="180"></canvas>
            <div class="heli-card-label">${ht.selectLabel}</div>`;
        card.addEventListener('click', () => _selectHeliInfo(ht.id));
        area.appendChild(card);
    });
};

const _selectHeliInfo = (id: string) => {
    if (_selectionCooldown) return;
    _selectionCooldown = true;
    setTimeout(() => { _selectionCooldown = false; }, 500);

    const types = HELI_TYPES;
    const panel = document.getElementById('heli-detail-panel')!;

    if (_selectedHeliInfoId === id) {
        _selectedHeliInfoId = null;
        types.forEach(ht => {
            document.getElementById('heli-card-' + ht.id)!.classList.remove('collapsed');
        });
        panel.classList.remove('visible');
        return;
    }

    _selectedHeliInfoId = id;
    _rotorPos = 0;
    types.forEach(ht => {
        const card = document.getElementById('heli-card-' + ht.id)!;
        if (ht.id === id) card.classList.remove('collapsed');
        else card.classList.add('collapsed');
    });

    const ht = HELI_TYPES.find(h => h.id === id)!;
    const spd = Math.min(100, Math.round(ht.accel / 0.00117 * 100));
    const agi = Math.min(100, Math.round(ht.tiltSpeed / 0.05 * 100));
    const cap = Math.min(100, Math.round(ht.maxLoad / 20 * 100));
    const end = Math.min(100, Math.max(0, Math.round((0.012 - ht.fuelRate) / 0.012 * 90 + 10)));
    const bar = (lbl: string, pct: number) => `<div class="heli-stat-row">
        <span class="heli-stat-label">${lbl}</span>
        <div class="heli-stat-bar"><div class="heli-stat-fill" data-pct="${pct}"></div></div>
    </div>`;
    panel.innerHTML = `
        <div class="heli-detail-name">${ht.selectLabel}</div>
        <div class="heli-detail-sub">${ht.selectSub}</div>
        <div class="heli-detail-fluff">${ht.description || ''}</div>
        ${bar('GESCHW.', spd)}${bar('AGILITÄT', agi)}${bar('KAPAZITÄT', cap)}${bar('AUSDAUER', end)}
        <div style="font-size:12px;color:#333;letter-spacing:2px;margin-top:16px">${ht.canCarryCargo ? '✦ CARGOFÄHIG' : ''}</div>`;
    panel.classList.add('visible');
    setTimeout(() => {
        panel.querySelectorAll('.heli-stat-fill').forEach((el: Element) => {
            (el as HTMLElement).style.width = (el as HTMLElement).dataset.pct + '%';
        });
    }, 60);
};

const _animHeliInfo = () => {
    if (document.getElementById('heli-info')!.style.display === 'none') return;

    if (_selectedHeliInfoId) _rotorPos += 0.22;

    HELI_TYPES.forEach(ht => {
        const c = document.getElementById('heli-info-cv-' + ht.id) as HTMLCanvasElement | null;
        if (!c) return;

        const isSelected = ht.id === _selectedHeliInfoId;
        if (isSelected) {
            _G.menuAngles[ht.id] += 0.009;
        } else {
            // snap back to rest angle when not selected
            const diff = -0.075 - _G.menuAngles[ht.id];
            if (Math.abs(diff) > 0.001) _G.menuAngles[ht.id] += diff * 0.1;
        }

        const card = c.closest('.heli-card');
        if (card?.classList.contains('collapsed')) return;

        const cx = c.getContext('2d')!;
        const tW = Math.round(254 * CANVAS_SCALE);
        const tH = Math.round(180 * CANVAS_SCALE);
        if (c.width !== tW || c.height !== tH) { c.width = tW; c.height = tH; }
        else cx.clearRect(0, 0, c.width, c.height);
        const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
            iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
        _drawHeli(ht.id, 0, 0, 0, _G.menuAngles[ht.id], 0, 0,
            isSelected ? _rotorPos : 0,
            0, 0,
            { targetCtx: cx, targetIso: offIso, scaleOverride: ht.previewScale * 0.6 });
    });
    requestAnimationFrame(_animHeliInfo);
};
