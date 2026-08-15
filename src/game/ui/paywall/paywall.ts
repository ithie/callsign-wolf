import './paywall.css';
import { I18N } from '../../i18n';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { createSettingsBtn } from '../settings-btn/settings-btn';
import { showScreenCrtEnter } from '../nav';
import { storageSet, storageGet } from '../../storage';
import { UNLOCK_KEY } from '../../session';
import { iso } from '../../render';
import { tileW, tileH, stepH, CANVAS_SCALE } from '../../render-config';
import { createDrawObjects } from '../../draw-objects';
import { soundHandler } from '../../main';

declare global {
    interface Window {
        __iapResult?: (result: string) => void;
        __iapPrice?: (price: string) => void;
    }
}

const _post = (msg: Record<string, string>): void => {
    (window as any).webkit?.messageHandlers?.iap?.postMessage(msg);
};

// ── Heli preview ──────────────────────────────────────────────────────────────
const _HELIS = [
    { id: 'dolphin',   label: 'DOLPHIN',   scale: 0.55 },
    { id: 'coasthawk', label: 'COASTHAWK', scale: 0.42 },
    { id: 'atlas',     label: 'ATLAS',     scale: 0.42 },
] as const;

const _stubC = document.createElement('canvas');
_stubC.width = 2; _stubC.height = 2;
const _stubCx = _stubC.getContext('2d')!;
const _stubIso = (wx: number, wy: number, wz: number, cx: number, cy: number) =>
    iso(wx, wy, wz, cx, cy, { canvas: _stubC, tileW, tileH, stepH });
const _stubSr = { add: () => {}, flush: () => {} };
const { drawHeli: _drawHeli } = createDrawObjects(_stubCx, _stubIso, tileW, tileH, _stubSr as any);

type _HeliState = { angle: number; angVel: number; targetVel: number; nextChange: number; rotorPos: number };

let _animId: number | null = null;
let _heliStates: _HeliState[] = [];

const _randVel = () => (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.008);

const _startHeliAnim = (canvases: HTMLCanvasElement[]): void => {
    _heliStates = _HELIS.map((_, i) => ({
        angle:      (i / _HELIS.length) * Math.PI * 2,
        angVel:     _randVel(),
        targetVel:  _randVel(),
        nextChange: Date.now() + 2000 + Math.random() * 3000,
        rotorPos:   Math.random() * Math.PI * 2,
    }));

    const W = Math.round(120 * CANVAS_SCALE);
    const H = Math.round(96 * CANVAS_SCALE);
    const loop = () => {
        const now = Date.now();
        _HELIS.forEach((h, i) => {
            const st = _heliStates[i];
            // smoothly approach target velocity
            st.angVel += (st.targetVel - st.angVel) * 0.04;
            st.angle  += st.angVel;
            st.rotorPos += 0.15;
            if (now >= st.nextChange) {
                st.targetVel  = _randVel();
                st.nextChange = now + 2000 + Math.random() * 3000;
            }

            const c = canvases[i];
            if (!c || !c.isConnected) return;
            if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
            else c.getContext('2d')!.clearRect(0, 0, W, H);
            const cx = c.getContext('2d')!;
            const offIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
                iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
            const hRoll = Math.max(-0.35, Math.min(0.35, st.angVel / 0.008 * 0.35));
            _drawHeli(h.id, 0, 0, 0, st.angle, 0, hRoll, st.rotorPos, 0, 0, {
                targetCtx: cx, targetIso: offIso, scaleOverride: h.scale,
            });
        });
        _animId = requestAnimationFrame(loop);
    };
    _animId = requestAnimationFrame(loop);
};

const _stopHeliAnim = (): void => {
    if (_animId !== null) { cancelAnimationFrame(_animId); _animId = null; }
};

// ── Screen ────────────────────────────────────────────────────────────────────
export const mount = (): void => {
    mountScreenShell('paywall', '', undefined);
};

export const show = (onBack: () => void): void => {
    soundHandler.play('unlock');

    const body = mountScreenShell('paywall', I18N.PAYWALL_TITLE, () => {
        _cleanup();
        onBack();
    });

    const desc = document.createElement('p');
    desc.id = 'paywall-description';
    desc.textContent = I18N.PAYWALL_DESCRIPTION;

    const heliRow = document.createElement('div');
    heliRow.id = 'paywall-heli-row';
    const canvases: HTMLCanvasElement[] = _HELIS.map(h => {
        const wrap = document.createElement('div');
        wrap.className = 'paywall-heli-wrap';
        const c = document.createElement('canvas');
        c.className = 'paywall-heli-canvas';
        const lbl = document.createElement('div');
        lbl.className = 'paywall-heli-label';
        lbl.textContent = h.label;
        wrap.append(c, lbl);
        heliRow.appendChild(wrap);
        return c;
    });

    const price = document.createElement('div');
    price.id = 'paywall-price';
    price.textContent = '…';

    const buyBtn = createSettingsBtn(I18N.PAYWALL_BUY, { id: 'paywall-buy-btn' });
    const restoreBtn = createSettingsBtn(I18N.PAYWALL_RESTORE, { id: 'paywall-restore-btn' });

    const hr = document.createElement('hr');
    hr.className = 'paywall-divider';

    const status = document.createElement('div');
    status.id = 'paywall-status';

    body.append(desc, heliRow, price, buyBtn, hr, restoreBtn, status);

    _startHeliAnim(canvases);

    const _setStatus = (msg: string, cls: 'success' | 'error' | 'pending' | '') => {
        status.textContent = msg;
        status.className = cls ? `status ${cls}` : '';
    };

    const _setPending = () => {
        buyBtn.disabled = true;
        restoreBtn.disabled = true;
        _setStatus(I18N.PAYWALL_PENDING, 'pending');
    };

    buyBtn.addEventListener('click', () => {
        _setPending();
        _post({ action: 'purchase' });
    });

    restoreBtn.addEventListener('click', () => {
        _setPending();
        _post({ action: 'restore' });
    });

    window.__iapResult = (result: string) => {
        buyBtn.disabled = false;
        restoreBtn.disabled = false;
        if (result === 'success' || result === 'already') {
            storageSet(UNLOCK_KEY, '1');
            _setStatus(I18N.PAYWALL_SUCCESS, 'success');
            setTimeout(() => {
                _cleanup();
                onBack();
            }, 1800);
        } else if (result === 'cancelled') {
            _setStatus('', '');
        } else {
            _setStatus(I18N.PAYWALL_ERROR, 'error');
        }
    };

    window.__iapPrice = (p: string) => {
        price.textContent = p;
    };

    _post({ action: 'loadPrice' });

    showScreenCrtEnter('paywall');
};

const _cleanup = (): void => {
    _stopHeliAnim();
    window.__iapResult = undefined;
    window.__iapPrice = undefined;
    soundHandler.play('maintheme');
};

export const isFullVersionActive = (): boolean => storageGet(UNLOCK_KEY) === '1';

export const triggerRestore = (onResult: (result: 'success' | 'already' | 'cancelled' | 'error') => void): void => {
    window.__iapResult = (result) => {
        window.__iapResult = undefined;
        if (result === 'success' || result === 'already') storageSet(UNLOCK_KEY, '1');
        onResult(result as any);
    };
    _post({ action: 'restore' });
};
