import './pause-overlay.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

type PauseOverlayDeps = {
    isMusicEnabled: () => boolean;
    setMusicEnabled: (v: boolean) => void;
    isSfxEnabled: () => boolean;
    setSfxEnabled: (v: boolean) => void;
    getControlMode: () => 'heading' | 'screen';
    setControlMode: (m: 'heading' | 'screen') => void;
    onPause: () => void;
    onResume: () => void;
};

let _deps: PauseOverlayDeps;

const HL = 'var(--accent, #4af)';

const _refreshButtons = () => {
    const music = _deps.isMusicEnabled();
    const sfx   = _deps.isSfxEnabled();
    const mode  = _deps.getControlMode();

    const set = (id: string, active: boolean) => {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (!el) return;
        el.style.borderColor = active ? HL : '';
        el.style.color       = active ? HL : '';
    };

    set('pause-music-on',  music);
    set('pause-music-off', !music);
    set('pause-sfx-on',    sfx);
    set('pause-sfx-off',   !sfx);
    set('pause-ctrl-simplified', mode === 'heading');
    set('pause-ctrl-profi',      mode === 'screen');
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

export const showPauseButton = () => {
    const el = document.getElementById('pause-btn');
    if (el) el.style.display = 'flex';
};

export const hidePauseButton = () => {
    const el = document.getElementById('pause-btn');
    if (el) el.style.display = 'none';
    document.getElementById('pause-overlay')?.classList.remove('visible');
};

export const mountPauseButton = (deps: PauseOverlayDeps) => {
    _deps = deps;

    // gear button — mounted inside #hud-tl alongside the mute button
    const container = ensureEl('hud-tl');
    let btn = document.getElementById('pause-btn');
    if (!btn) { btn = document.createElement('div'); btn.id = 'pause-btn'; container.appendChild(btn); }
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
            <defs><filter id="glow-gear"><feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter></defs>
            <g filter="url(#glow-gear)" fill="#ff6600" stroke="#ff8800" stroke-width="0.5">
                <circle cx="16" cy="16" r="4.5" fill="none" stroke="#ff6600" stroke-width="2"/>
                <path d="M16 6.5 L17.4 9.2 L20.4 8.2 L20.8 11.3 L23.8 12.2 L22.4 15 L24.5 17.4 L22 19.2 L22.4 22.3 L19.3 22.8 L18.1 25.7 L15.3 24.4 L12.7 25.7 L11.5 22.8 L8.4 22.3 L8.8 19.2 L6.3 17.4 L8.4 15 L7 12.2 L10 11.3 L10.4 8.2 L13.4 9.2 Z"
                    fill="none" stroke="#ff6600" stroke-width="1.8" stroke-linejoin="round"/>
            </g>
        </svg>`;
    btn.onclick = _show;

    // overlay
    const overlay = ensureEl('pause-overlay');
    overlay.innerHTML = `
        <div id="pause-panel">
            <div id="pause-title">— PAUSED —</div>
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
            <div class="pause-field">
                <label>${I18N.CONTROLS_HEADING}</label>
                <div class="pause-row">
                    <button class="settings-btn" id="pause-ctrl-simplified">${I18N.CONTROLS_SIMPLIFIED}</button>
                    <button class="settings-btn" id="pause-ctrl-profi">${I18N.CONTROLS_PROFESSIONAL}</button>
                </div>
            </div>
            <button class="settings-btn" id="pause-resume">▶ WEITER</button>
        </div>`;

    document.getElementById('pause-music-on')!.onclick  = () => { _deps.setMusicEnabled(true);  _refreshButtons(); };
    document.getElementById('pause-music-off')!.onclick = () => { _deps.setMusicEnabled(false); _refreshButtons(); };
    document.getElementById('pause-sfx-on')!.onclick    = () => { _deps.setSfxEnabled(true);    _refreshButtons(); };
    document.getElementById('pause-sfx-off')!.onclick   = () => { _deps.setSfxEnabled(false);   _refreshButtons(); };
    document.getElementById('pause-ctrl-simplified')!.onclick = () => { _deps.setControlMode('heading'); _refreshButtons(); };
    document.getElementById('pause-ctrl-profi')!.onclick      = () => { _deps.setControlMode('screen');  _refreshButtons(); };
    document.getElementById('pause-resume')!.onclick = _hide;
};
