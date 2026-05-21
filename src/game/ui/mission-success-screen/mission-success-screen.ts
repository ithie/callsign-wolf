import '../base.css';
import '../screens.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (): void => {
    _el = ensureEl('mission-success-screen');
    _el.classList.add('ui-screen');
    _el.innerHTML = `
        <div class="title" style="color:#fff">${I18N.MISSION_COMPLETE}</div>
        <p style="color:#ffd700">${I18N.OBJECTIVES_CLEARED}</p>
        <p class="start-hint">${I18N.ACKNOWLEDGE}</p>`;
};

export const show = (onClick: () => void): void => {
    if (!_el) return;
    _el.onclick = onClick;
    _el.style.display = 'flex';
};

export const hide = (): void => {
    if (_el) _el.style.display = 'none';
};
