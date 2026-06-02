import '../base.css';
import './campaign-complete-screen.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (onClick: () => void): void => {
    _el = ensureEl('campaign-complete-screen');
    _el.classList.add('ui-screen');
    _el.innerHTML = `
        <div class="title" style="color:#ff6600">${I18N.CAMPAIGN_COMPLETE}</div>
        <div id="campaign-complete-name" style="color:#5f5;font-size:24px;margin:10px 0"></div>
        <p style="color:#aaa;font-size:16px;letter-spacing:2px">${I18N.ALL_MISSIONS_CLEARED}</p>
        <p class="start-hint">${I18N.ACKNOWLEDGE}</p>`;
    _el.addEventListener('click', onClick);
};

export const show = (name: string): void => {
    if (!_el) return;
    const nameEl = document.getElementById('campaign-complete-name');
    if (nameEl) nameEl.textContent = name;
    _el.style.display = 'flex';
};

export const hide = (): void => { if (_el) _el.style.display = 'none'; };
