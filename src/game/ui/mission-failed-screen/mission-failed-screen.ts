import '../base.css';
import './mission-failed-screen.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (onClick: () => void): void => {
    _el = ensureEl('mission-failed-screen');
    _el.classList.add('ui-screen');
    _el.innerHTML = `
        <div class="title" style="color:#fff">${I18N.MISSION_FAILED}</div>
        <p class="start-hint">${I18N.ACKNOWLEDGE}</p>`;
    _el.addEventListener('click', onClick);
};

export const show = (): void => {
    if (_el) _el.style.display = 'flex';
};
export const hide = (): void => {
    if (_el) _el.style.display = 'none';
};
