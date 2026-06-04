import './pause-overlay.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

type PauseOverlayDeps = {
    isMusicEnabled: () => boolean;
    setMusicEnabled: (v: boolean) => void;
    isSfxEnabled: () => boolean;
    setSfxEnabled: (v: boolean) => void;
    onPause: () => void;
    onResume: () => void;
    onAbort: () => void;
};

let _deps: PauseOverlayDeps;

const HL = 'var(--accent, #4af)';

const _refreshButtons = () => {
    const music = _deps.isMusicEnabled();
    const sfx = _deps.isSfxEnabled();

    const set = (id: string, active: boolean) => {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (!el) return;
        el.style.borderColor = active ? HL : '';
        el.style.color = active ? HL : '';
    };

    set('pause-music-on', music);
    set('pause-music-off', !music);
    set('pause-sfx-on', sfx);
    set('pause-sfx-off', !sfx);
};

const _show = () => {
    _deps.onPause();
    _refreshButtons();
    document.getElementById('pause-overlay')!.classList.add('visible');
};

const _hide = () => {
    document.getElementById('pause-overlay')!.classList.remove('visible');
    _deps.onResume();
};

const _abort = () => {
    document.getElementById('pause-overlay')!.classList.remove('visible');
    _deps.onAbort();
};

export const show = () => {
    const el = document.getElementById('pause-btn');
    if (el) el.style.display = 'flex';
};

export const hide = () => {
    const el = document.getElementById('pause-btn');
    if (el) el.style.display = 'none';
    document.getElementById('pause-overlay')?.classList.remove('visible');
};

export const mount = (deps: PauseOverlayDeps) => {
    _deps = deps;

    // gear button — mounted inside #hud-tl alongside the mute button
    const container = ensureEl('hud-tl');
    let btn = document.getElementById('pause-btn');
    if (!btn) {
        btn = document.createElement('div');
        btn.id = 'pause-btn';
        container.appendChild(btn);
    }
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
            <defs><filter id="glow-gear"><feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter></defs>
            <g filter="url(#glow-gear)" fill="#ff6600" stroke="#ff8800" stroke-width="0.5">
                <path d="M12.8 7.1 L13.7 2.7 L18.3 2.7 L19.2 7.1 L22.1 8.7 L26.3 7.3 L28.7 11.4 L25.4 14.4 L25.4 17.6 L28.7 20.6 L26.3 24.7 L22.1 23.3 L19.2 24.9 L18.3 29.3 L13.7 29.3 L12.8 24.9 L9.9 23.3 L5.7 24.7 L3.3 20.6 L6.6 17.6 L6.6 14.4 L3.3 11.4 L5.7 7.3 L9.9 8.7 Z"
                    fill="none" stroke="#ff6600" stroke-width="1.8" stroke-linejoin="round"/>
            </g>
        </svg>`;
    btn.onclick = _show;

    // overlay
    const overlay = ensureEl('pause-overlay');
    overlay.innerHTML = `
        <div id="pause-panel">
            <div id="pause-title">${I18N.PAUSE_TITLE}</div>
            <div class="pause-field">
                <label>${I18N.MUSIC_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-music-on">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="pause-music-off">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="pause-field">
                <label>${I18N.SFX_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-sfx-on">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="pause-sfx-off">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <button class="settings-btn" id="pause-resume">${I18N.PAUSE_RESUME}</button>
            <button class="settings-btn" id="pause-abort" style="background:#1a0000;border-color:#500;color:#c44">${I18N.PAUSE_ABORT}</button>
        </div>`;

    document.getElementById('pause-music-on')!.onclick = () => {
        _deps.setMusicEnabled(true);
        _refreshButtons();
    };
    document.getElementById('pause-music-off')!.onclick = () => {
        _deps.setMusicEnabled(false);
        _refreshButtons();
    };
    document.getElementById('pause-sfx-on')!.onclick = () => {
        _deps.setSfxEnabled(true);
        _refreshButtons();
    };
    document.getElementById('pause-sfx-off')!.onclick = () => {
        _deps.setSfxEnabled(false);
        _refreshButtons();
    };
    document.getElementById('pause-resume')!.onclick = _hide;
    document.getElementById('pause-abort')!.onclick = _abort;
};
