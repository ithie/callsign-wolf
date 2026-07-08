import './pause-overlay.css';
import { ensureEl } from '@/ui/dom-helpers';
import { I18N } from '../../i18n';
import { createSettingsBtn } from '../settings-btn/settings-btn';

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

const _makeField = (labelText: string, ...btns: HTMLButtonElement[]): HTMLDivElement => {
    const field = document.createElement('div');
    field.className = 'pause-field';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    const row = document.createElement('div');
    row.className = 'pause-row';
    btns.forEach(b => row.appendChild(b));
    field.append(lbl, row);
    return field;
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
    overlay.innerHTML = '';

    const panel = document.createElement('div');
    panel.id = 'pause-panel';

    const title = document.createElement('div');
    title.id = 'pause-title';
    title.textContent = I18N.PAUSE_TITLE;

    const musicOn  = createSettingsBtn(I18N.AUDIO_ON,  { id: 'pause-music-on' });
    const musicOff = createSettingsBtn(I18N.AUDIO_OFF, { id: 'pause-music-off' });
    const sfxOn    = createSettingsBtn(I18N.AUDIO_ON,  { id: 'pause-sfx-on' });
    const sfxOff   = createSettingsBtn(I18N.AUDIO_OFF, { id: 'pause-sfx-off' });
    const resume   = createSettingsBtn(I18N.PAUSE_RESUME, { id: 'pause-resume' });
    const abort    = createSettingsBtn(I18N.PAUSE_ABORT,  { id: 'pause-abort', danger: true });

    panel.append(
        title,
        _makeField(I18N.MUSIC_HEADING, musicOn, musicOff),
        _makeField(I18N.SFX_HEADING,   sfxOn,   sfxOff),
        resume,
        abort,
    );
    overlay.appendChild(panel);

    musicOn.onclick  = () => { _deps.setMusicEnabled(true);  _refreshButtons(); };
    musicOff.onclick = () => { _deps.setMusicEnabled(false); _refreshButtons(); };
    sfxOn.onclick    = () => { _deps.setSfxEnabled(true);    _refreshButtons(); };
    sfxOff.onclick   = () => { _deps.setSfxEnabled(false);   _refreshButtons(); };
    resume.onclick   = _hide;
    abort.onclick    = _abort;
};
