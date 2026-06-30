import './rankup.css';
import { I18N } from '../../i18n';
import { ensureEl } from '../dom-helpers';
import { iso } from '../../render';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { rankBadgeHtml, type Rank, RANKS } from '../rank-badge/rank-badge';
import { COMMODORE_SVG } from '../commodore-svg';
import { createDrawObjects } from '../../draw-objects';

export { rankBadgeHtml };

let _getPlayerName: (() => string) | null = null;

const _stub2 = document.createElement('canvas');
_stub2.width = 2; _stub2.height = 2;
const _stub2cx = _stub2.getContext('2d')!;
const _stub2iso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
    iso(wx, wy, wz, camX, camY, { canvas: _stub2, tileW, tileH, stepH });
const _stubSr = { add: () => {}, flush: () => {} };
const { drawHeli: _drawHeli } = createDrawObjects(_stub2cx, _stub2iso, tileW, tileH, _stubSr as any);

export const init = (getPlayerName: () => string): void => {
    _getPlayerName = getPlayerName;
};

export const hide = (): void => {
    _heliId = null;
    _animRunning = false;
    (document.getElementById('rankup-overlay') as HTMLElement).style.display = 'none';
    const cb = _onDismiss;
    _onDismiss = null;
    cb?.();
};

export const mount = (): void => {
    const el = ensureEl('rankup-overlay');
    el.innerHTML = `
        <p id="rankup-decree"></p>
        <div id="rankup-main">
            <div id="rankup-heli" style="display:none">
                <canvas id="rankup-heli-canvas"></canvas>
            </div>
            <div id="rankup-badge"></div>
            <div id="rankup-commodore">${COMMODORE_SVG}</div>
        </div>
        <p class="start-hint" style="color: #cc9900; margin-top: 10px">${I18N.NEXT}</p>`;
    el.addEventListener('click', hide);
};

// ── Heli canvas animation ──────────────────────────────────────────────────

let _heliId: string | null = null;
let _animAngle = 0;
let _animRotor = 0;
let _animRunning = false;
let _onDismiss: (() => void) | null = null;

const _animLoop = (): void => {
    const overlay = document.getElementById('rankup-overlay');
    if (!overlay || overlay.style.display === 'none' || !_drawHeli || !_heliId) {
        _animRunning = false;
        return;
    }
    const c = document.getElementById('rankup-heli-canvas') as HTMLCanvasElement | null;
    if (!c) {
        _animRunning = false;
        return;
    }

    const W = Math.round(200 * CANVAS_SCALE);
    const H = Math.round(160 * CANVAS_SCALE);
    if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
    } else {
        c.getContext('2d')!.clearRect(0, 0, W, H);
    }

    _animAngle += 0.009;
    _animRotor += 0.18;

    const ctx2d = c.getContext('2d')!;
    const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });

    _drawHeli(_heliId, 0, 0, 0, _animAngle, 0, 0, _animRotor, 0, 0, {
        targetCtx: ctx2d,
        targetIso: offIso,
        scaleOverride: 0.7,
    });

    requestAnimationFrame(_animLoop);
};

export const show = (rank: Rank, unlockedHeli?: string, onDismiss?: () => void): void => {
    _onDismiss = onDismiss ?? null;
    const rankIdx = RANKS.indexOf(rank);
    const prevRank = rankIdx > 0 ? RANKS[rankIdx - 1] : null;
    const callsign = _getPlayerName?.() || 'WOLF';
    const decreeEl = document.getElementById('rankup-decree') as HTMLElement;
    if (decreeEl && prevRank) {
        decreeEl.textContent = I18N.RANKUP_DECREE(
            I18N.RANK_NAME(prevRank.key),
            I18N.RANK_NAME(rank.key),
            callsign,
        );
        decreeEl.style.display = 'block';
    } else if (decreeEl) {
        decreeEl.style.display = 'none';
    }
    (document.getElementById('rankup-badge') as HTMLElement).innerHTML = rankBadgeHtml(rank);
    const heliEl = document.getElementById('rankup-heli') as HTMLElement;
    if (unlockedHeli) {
        _heliId = unlockedHeli;
        _animAngle = 0;
        _animRotor = 0;
        heliEl.style.display = 'flex';
        if (!_animRunning) {
            _animRunning = true;
            requestAnimationFrame(_animLoop);
        }
    } else {
        _heliId = null;
        heliEl.style.display = 'none';
    }
    (document.getElementById('rankup-overlay') as HTMLElement).style.display = 'flex';
};

