import './whats-new.css';
import { I18N } from '../../i18n';
import { ensureEl as _ensureEl } from '../dom-helpers';
import { loadSession, saveSession } from '../../session';

export const mount = () => {
    const el = _ensureEl('whats-new-overlay');
    el.classList.add('ui-screen');
    el.innerHTML = `
        <div id="whats-new-version">${I18N.WHATS_NEW_HEADLINE} · ${I18N.WHATS_NEW_VERSION}</div>
        <div id="whats-new-title">${I18N.WHATS_NEW_TITLE.toUpperCase()}</div>
        <ul id="whats-new-items">
            ${[...I18N.WHATS_NEW_ITEMS].map(item => `<li>${item}</li>`).join('')}
        </ul>
        <div id="whats-new-hint">${I18N.WHATS_NEW_HINT}</div>`;
    el.addEventListener('click', _hide);
};

export const show = (onProceed: () => void): boolean => {
    if (loadSession().lastSeenVersion === I18N.WHATS_NEW_VERSION || !I18N.WHATS_NEW_VERSION) return false;
    _onProceed = onProceed;
    document.getElementById('whats-new-overlay')!.style.display = 'flex';
    return true;
};

let _onProceed: (() => void) | null = null;

const _hide = () => {
    document.getElementById('whats-new-overlay')!.style.display = 'none';
    const s = loadSession();
    s.lastSeenVersion = I18N.WHATS_NEW_VERSION;
    saveSession(s);
    _onProceed?.();
};
