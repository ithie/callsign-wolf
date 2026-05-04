import './settings.css';
import { I18N, LANG, setLanguage } from '../../i18n';
import { getRank, encodeSession, decodeSession, getCampaignsDone, getMissionsDone, STORAGE_KEY, type PlayerSession } from '../../session';
import { storageRemove } from '../../storage';
import { rankBadgeHtml } from '../rankup/rankup';

type Deps = {
    getSession: () => PlayerSession;
    saveSession: (s: PlayerSession) => void;
    getRankMissions: () => number;
    getControlMode: () => 'heading' | 'screen';
    setControlMode: (m: 'heading' | 'screen') => void;
    isTouchDevice: () => boolean;
    isMusicEnabled: () => boolean;
    setMusicEnabled: (v: boolean) => void;
    isSfxEnabled: () => boolean;
    setSfxEnabled: (v: boolean) => void;
    onBack: () => void;
};

let _deps: Deps;

export const initSettings = (deps: Deps) => {
    _deps = deps;
};

import { showScreen, showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

export const mountSettings = () => {
    const body = mountScreenShell('settings-screen', I18N.MENU_SETTINGS, I18N.PILOT_HEADING, fromSettings);
    body.innerHTML = `
        <div id="settings-badge"></div>
        <div class="settings-field">
            <label>${I18N.PILOT_CALLSIGN}</label>
            <input id="player-name-input" type="text" maxlength="5" placeholder="—" />
        </div>
        <div id="settings-stats"></div>
        <div class="settings-field" style="margin-top: 8px">
            <label>${I18N.PILOT_SAVECODE}</label>
            <div id="settings-code-display">—</div>
        </div>
        <div class="settings-field">
            <label>${I18N.PILOT_IMPORT}</label>
            <div style="display:flex; gap: 10px; align-items: center">
                <input id="import-code-input" class="settings-field input" type="text" maxlength="10" placeholder="XXXXX-XXXX" />
                <button class="settings-btn" id="apply-save-code-btn">${I18N.PILOT_IMPORTLOAD}</button>
            </div>
            <div id="import-code-msg" style="font-size: 12px; letter-spacing: 2px; min-height: 18px; margin-top: 4px"></div>
        </div>
        <div id="settings-ctrl-row" style="display:none; flex-direction:column; align-items:center; margin-top:16px; width:100%">
            <div class="settings-field" style="width:100%">
                <label>${I18N.CONTROLS_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="ctrl-btn-profi">${I18N.CONTROLS_SIMPLIFIED}</button>
                    <button class="settings-btn" id="ctrl-btn-vereinfacht">${I18N.CONTROLS_PROFESSIONAL}</button>
                </div>
                <div id="ctrl-mode-hint" style="font-size:11px; letter-spacing:1px; color:#8af; margin-top:4px; min-height:16px"></div>
            </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px solid #1a1a2e; padding-top: 16px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px">
            <div class="settings-field" style="width:100%">
                <label>${I18N.MUSIC_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="music-on-btn">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="music-off-btn">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="settings-field" style="width:100%">
                <label>${I18N.SFX_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="sfx-on-btn">${I18N.AUDIO_ON}</button>
                    <button class="settings-btn" id="sfx-off-btn">${I18N.AUDIO_OFF}</button>
                </div>
            </div>
            <div class="settings-field" style="width:100%">
                <label>${I18N.LANGUAGE_HEADING}</label>
                <div style="display:flex; gap:10px; margin-top:6px">
                    <button class="settings-btn" id="lang-de-btn">DEUTSCH</button>
                    <button class="settings-btn" id="lang-en-btn">ENGLISH</button>
                </div>
            </div>
        </div>
        <div style="margin-top: 20px; border-top: 1px solid #1a1a2e; padding-top: 16px; width: 100%; display: flex; flex-direction: column; align-items: center">
            <button id="delete-session-btn" class="settings-btn" style="background: #1a0000; border-color: #500; color: #c44">${I18N.DELETE_SESSION}</button>
            <div id="delete-session-msg" style="font-size: 12px; letter-spacing: 2px; color: #c44; min-height: 18px; margin-top: 6px"></div>
        </div>
        `;

    document.getElementById('apply-save-code-btn')!.addEventListener('click', applySaveCode);
    document.getElementById('delete-session-btn')!.addEventListener('click', deleteSessionData);
    document.getElementById('music-on-btn')!.addEventListener('click', () => { _deps.setMusicEnabled(true);  _refreshAudioButtons(); });
    document.getElementById('music-off-btn')!.addEventListener('click', () => { _deps.setMusicEnabled(false); _refreshAudioButtons(); });
    document.getElementById('sfx-on-btn')!.addEventListener('click', () => { _deps.setSfxEnabled(true);  _refreshAudioButtons(); });
    document.getElementById('sfx-off-btn')!.addEventListener('click', () => { _deps.setSfxEnabled(false); _refreshAudioButtons(); });
    document.getElementById('lang-de-btn')!.addEventListener('click', () => { setLanguage('de'); toSettings(); });
    document.getElementById('lang-en-btn')!.addEventListener('click', () => { setLanguage('en'); toSettings(); });
    document.getElementById('ctrl-btn-profi')!.addEventListener('click', () => {
        _deps.setControlMode('heading');
        _refreshCtrlButtons();
    });
    document.getElementById('ctrl-btn-vereinfacht')!.addEventListener('click', () => {
        _deps.setControlMode('screen');
        _refreshCtrlButtons();
    });

};

const HL = 'var(--accent, #4af)';

const _refreshAudioButtons = () => {
    const musicOn  = document.getElementById('music-on-btn')  as HTMLButtonElement;
    const musicOff = document.getElementById('music-off-btn') as HTMLButtonElement;
    const sfxOn    = document.getElementById('sfx-on-btn')    as HTMLButtonElement;
    const sfxOff   = document.getElementById('sfx-off-btn')   as HTMLButtonElement;
    const music = _deps.isMusicEnabled();
    const sfx   = _deps.isSfxEnabled();
    musicOn.style.borderColor  = music ? HL : '';  musicOn.style.color  = music ? HL : '';
    musicOff.style.borderColor = music ? '' : HL;  musicOff.style.color = music ? '' : HL;
    sfxOn.style.borderColor    = sfx   ? HL : '';  sfxOn.style.color    = sfx   ? HL : '';
    sfxOff.style.borderColor   = sfx   ? '' : HL;  sfxOff.style.color   = sfx   ? '' : HL;
};

const _refreshLangButtons = () => {
    const de = document.getElementById('lang-de-btn') as HTMLButtonElement | null;
    const en = document.getElementById('lang-en-btn') as HTMLButtonElement | null;
    if (!de || !en) return;
    de.style.borderColor = LANG === 'de' ? HL : '';
    de.style.color       = LANG === 'de' ? HL : '';
    en.style.borderColor = LANG === 'en' ? HL : '';
    en.style.color       = LANG === 'en' ? HL : '';
};

const _refreshCtrlButtons = () => {
    const mode = _deps.getControlMode();
    const profi = document.getElementById('ctrl-btn-profi') as HTMLButtonElement;
    const vereinfacht = document.getElementById('ctrl-btn-vereinfacht') as HTMLButtonElement;
    const hint = document.getElementById('ctrl-mode-hint') as HTMLElement;
    profi.style.borderColor = mode === 'heading' ? HL : '';
    profi.style.color = mode === 'heading' ? HL : '';
    vereinfacht.style.borderColor = mode === 'screen' ? HL : '';
    vereinfacht.style.color = mode === 'screen' ? HL : '';
    hint.textContent = mode === 'heading' ? I18N.CONTROLS_SIMPLIFIED_DETAILS : I18N.CONTROLS_PROFESSIONAL_DETAILS;
};

const _refreshSettingsScreen = () => {
    const session = _deps.getSession();
    const rank = getRank(session, _deps.getRankMissions());
    (document.getElementById('settings-badge') as HTMLElement).innerHTML = rankBadgeHtml(rank);
    (document.getElementById('settings-code-display') as HTMLElement).textContent = encodeSession(session, _deps.getRankMissions());
    const statsEl = document.getElementById('settings-stats') as HTMLElement;
    const noSave = !session.cookieConsent ? I18N.NO_SAVE_STATE : '';
    statsEl.textContent = I18N.STATS(getCampaignsDone(session), getMissionsDone(session)) + noSave;
};

export const toSettings = () => {
    _refreshSettingsScreen();
    const session = _deps.getSession();
    const input = document.getElementById('player-name-input') as HTMLInputElement;
    input.value = session.playerName || '';
    input.oninput = () => {
        session.playerName = input.value
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 5);
        input.value = session.playerName;
        _deps.saveSession(session);
        _refreshSettingsScreen();
    };
    (document.getElementById('import-code-input') as HTMLInputElement).value = '';
    (document.getElementById('import-code-msg') as HTMLElement).textContent = '';
    const ctrlRow = document.getElementById('settings-ctrl-row') as HTMLElement;
    if (_deps.isTouchDevice()) {
        ctrlRow.style.display = 'flex';
        _refreshCtrlButtons();
    } else {
        ctrlRow.style.display = 'none';
    }
    _refreshAudioButtons();
    _refreshLangButtons();
    showScreenCrtEnter('settings-screen');
};

export const fromSettings = () => {
    showScreen('main-menu');
    _deps.onBack();
};

const applySaveCode = () => {
    const input = document.getElementById('import-code-input') as HTMLInputElement;
    const msg = document.getElementById('import-code-msg') as HTMLElement;
    const decoded = decodeSession(input.value.trim());
    if (!decoded) {
        msg.style.color = '#f44';
        msg.textContent = I18N.SAVE_CODE_INVALID;
        return;
    }
    const session = _deps.getSession();
    Object.assign(session, decoded);
    _deps.saveSession(session);
    input.value = '';
    msg.style.color = '#5f5';
    msg.textContent = I18N.SAVE_CODE_LOADED;
    _refreshSettingsScreen();
    (document.getElementById('player-name-input') as HTMLInputElement).value = session.playerName || '';
};

const deleteSessionData = () => {
    const btn = document.getElementById('delete-session-btn') as HTMLElement;
    btn.textContent = I18N.DELETE_CONFIRM;
    btn.onclick = _confirmDeleteSession;
};

const _confirmDeleteSession = () => {
    const msg = document.getElementById('delete-session-msg') as HTMLElement;
    msg.textContent = I18N.SESSION_DELETED;
    storageRemove(STORAGE_KEY);
    setTimeout(() => window.location.reload(), 1200);
};

