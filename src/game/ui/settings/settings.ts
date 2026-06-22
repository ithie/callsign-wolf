import './settings.css';
import { I18N, LANG, setLanguage } from '../../i18n';
import {
    getRank,
    encodeSession,
    decodeSession,
    getCampaignsDone,
    getMissionsDone,
    type PlayerSession,
} from '../../session';
import { rankBadgeHtml } from '../rank-badge/rank-badge';
import { createSettingsBtn } from '../settings-btn/settings-btn';
import { showScreen, showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

type Deps = {
    getSession: () => PlayerSession;
    saveSession: (s: PlayerSession) => void;
    getRankMissions: () => number;
    isMusicEnabled: () => boolean;
    setMusicEnabled: (v: boolean) => void;
    isSfxEnabled: () => boolean;
    setSfxEnabled: (v: boolean) => void;
    onBack: () => void;
    onSessionDeleted: () => void;
};

let _deps: Deps;

export const init = (deps: Deps) => {
    _deps = deps;
};

const _field = (labelText: string, ...children: HTMLElement[]): HTMLDivElement => {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-top:6px';
    children.forEach(c => row.appendChild(c));
    field.append(lbl, row);
    return field;
};

export const mount = () => {
    const body = mountScreenShell('settings-screen', I18N.MENU_SETTINGS, I18N.PILOT_HEADING, hide);

    // Badge
    const badge = document.createElement('div');
    badge.id = 'settings-badge';

    // Callsign
    const nameInput = document.createElement('input');
    nameInput.id = 'player-name-input';
    nameInput.type = 'text';
    nameInput.maxLength = 5;
    nameInput.placeholder = '—';
    const callsignField = document.createElement('div');
    callsignField.className = 'settings-field';
    const callsignLbl = document.createElement('label');
    callsignLbl.textContent = I18N.PILOT_CALLSIGN;
    callsignField.append(callsignLbl, nameInput);

    // Stats
    const stats = document.createElement('div');
    stats.id = 'settings-stats';

    // Save code
    const codeDisplay = document.createElement('div');
    codeDisplay.id = 'settings-code-display';
    codeDisplay.textContent = '—';
    const codeField = document.createElement('div');
    codeField.className = 'settings-field';
    codeField.style.marginTop = '8px';
    const codeLbl = document.createElement('label');
    codeLbl.textContent = I18N.PILOT_SAVECODE;
    codeField.append(codeLbl, codeDisplay);

    // Import
    const importInput = document.createElement('input');
    importInput.id = 'import-code-input';
    importInput.type = 'text';
    importInput.maxLength = 10;
    importInput.placeholder = 'XXXXX-XXXX';
    const applyBtn = createSettingsBtn(I18N.PILOT_IMPORTLOAD, { id: 'apply-save-code-btn' });
    const importRow = document.createElement('div');
    importRow.style.cssText = 'display:flex;gap:10px;align-items:center';
    importRow.append(importInput, applyBtn);
    const importMsg = document.createElement('div');
    importMsg.id = 'import-code-msg';
    importMsg.style.cssText = 'font-size:12px;letter-spacing:2px;min-height:18px;margin-top:4px';
    const importField = document.createElement('div');
    importField.className = 'settings-field';
    const importLbl = document.createElement('label');
    importLbl.textContent = I18N.PILOT_IMPORT;
    importField.append(importLbl, importRow, importMsg);

    // Audio + Language section
    const audioSection = document.createElement('div');
    audioSection.style.cssText = 'margin-top:20px;border-top:1px solid #1a1a2e;padding-top:16px;width:100%;display:flex;flex-direction:column;align-items:center;gap:10px';

    const musicOn  = createSettingsBtn(I18N.AUDIO_ON,  { id: 'music-on-btn' });
    const musicOff = createSettingsBtn(I18N.AUDIO_OFF, { id: 'music-off-btn' });
    const sfxOn    = createSettingsBtn(I18N.AUDIO_ON,  { id: 'sfx-on-btn' });
    const sfxOff   = createSettingsBtn(I18N.AUDIO_OFF, { id: 'sfx-off-btn' });
    const langDe   = createSettingsBtn('DEUTSCH', { id: 'lang-de-btn' });
    const langEn   = createSettingsBtn('ENGLISH', { id: 'lang-en-btn' });

    const musicField = _field(I18N.MUSIC_HEADING, musicOn, musicOff);
    musicField.style.width = '100%';
    const sfxField = _field(I18N.SFX_HEADING, sfxOn, sfxOff);
    sfxField.style.width = '100%';
    const langField = _field(I18N.LANGUAGE_HEADING, langDe, langEn);
    langField.style.width = '100%';
    audioSection.append(musicField, sfxField, langField);

    // Delete section
    const deleteSection = document.createElement('div');
    deleteSection.style.cssText = 'margin-top:20px;border-top:1px solid #1a1a2e;padding-top:16px;width:100%;display:flex;flex-direction:column;align-items:center';
    const deleteBtn = createSettingsBtn(I18N.DELETE_SESSION, { id: 'delete-session-btn', danger: true });
    const deleteMsg = document.createElement('div');
    deleteMsg.id = 'delete-session-msg';
    deleteMsg.style.cssText = 'font-size:12px;letter-spacing:2px;color:#c44;min-height:18px;margin-top:6px';
    deleteSection.append(deleteBtn, deleteMsg);

    body.append(badge, callsignField, stats, codeField, importField, audioSection, deleteSection);

    // Event wiring
    applyBtn.addEventListener('click', applySaveCode);
    deleteBtn.addEventListener('click', deleteSessionData);
    musicOn.addEventListener('click',  () => { _deps.setMusicEnabled(true);  _refreshAudioButtons(); });
    musicOff.addEventListener('click', () => { _deps.setMusicEnabled(false); _refreshAudioButtons(); });
    sfxOn.addEventListener('click',    () => { _deps.setSfxEnabled(true);    _refreshAudioButtons(); });
    sfxOff.addEventListener('click',   () => { _deps.setSfxEnabled(false);   _refreshAudioButtons(); });
    langDe.addEventListener('click',   () => { setLanguage('de'); show(); });
    langEn.addEventListener('click',   () => { setLanguage('en'); show(); });
};

const HL = 'var(--accent, #4af)';

const _refreshAudioButtons = () => {
    const musicOn  = document.getElementById('music-on-btn')  as HTMLButtonElement;
    const musicOff = document.getElementById('music-off-btn') as HTMLButtonElement;
    const sfxOn    = document.getElementById('sfx-on-btn')    as HTMLButtonElement;
    const sfxOff   = document.getElementById('sfx-off-btn')   as HTMLButtonElement;
    const music = _deps.isMusicEnabled();
    const sfx   = _deps.isSfxEnabled();
    musicOn.style.borderColor  = music ? HL : '';
    musicOn.style.color        = music ? HL : '';
    musicOff.style.borderColor = music ? '' : HL;
    musicOff.style.color       = music ? '' : HL;
    sfxOn.style.borderColor    = sfx ? HL : '';
    sfxOn.style.color          = sfx ? HL : '';
    sfxOff.style.borderColor   = sfx ? '' : HL;
    sfxOff.style.color         = sfx ? '' : HL;
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

const _refreshSettingsScreen = () => {
    const session = _deps.getSession();
    const rank = getRank(session.rankOverride ?? 0, _deps.getRankMissions());
    (document.getElementById('settings-badge') as HTMLElement).innerHTML = rankBadgeHtml(rank);
    (document.getElementById('settings-code-display') as HTMLElement).textContent = encodeSession(
        session,
        _deps.getRankMissions(),
    );
    const statsEl = document.getElementById('settings-stats') as HTMLElement;
    statsEl.textContent = I18N.STATS(getCampaignsDone(session), getMissionsDone(session));
};

export const show = () => {
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
    (document.getElementById('delete-session-msg') as HTMLElement).textContent = '';
    _refreshAudioButtons();
    _refreshLangButtons();
    showScreenCrtEnter('settings-screen');
};

export const hide = () => {
    showScreen('main-menu');
    _deps.onBack();
};

const applySaveCode = () => {
    const input = document.getElementById('import-code-input') as HTMLInputElement;
    const msg   = document.getElementById('import-code-msg')   as HTMLElement;
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
    const btn = document.getElementById('delete-session-btn') as HTMLElement;
    const msg = document.getElementById('delete-session-msg') as HTMLElement;
    _deps.onSessionDeleted();
    msg.textContent = I18N.SESSION_DELETED;
    btn.textContent = I18N.DELETE_SESSION;
    btn.onclick = null;
    const input = document.getElementById('player-name-input') as HTMLInputElement;
    if (input) input.value = '';
    _refreshSettingsScreen();
};
