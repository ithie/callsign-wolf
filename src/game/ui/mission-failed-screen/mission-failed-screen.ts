import '../base.css';
import './mission-failed-screen.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (onBack: () => void, onRetry: () => void, extraText?: string): void => {
    _el = ensureEl('mission-failed-screen');
    _el.classList.add('ui-screen');
    _el.innerHTML = `
        <div class="title" style="color:#fff">${I18N.MISSION_FAILED}</div>
        ${extraText ? `<p style="color:#f55;font-size:1.1em;letter-spacing:0.05em">${extraText}</p>` : ''}
        <div class="failed-buttons">
            <button class="failed-btn failed-btn--primary">${I18N.RETRY}</button>
            <button class="failed-btn failed-btn--secondary">${I18N.BACK}</button>
        </div>`;
    _el.querySelector('.failed-btn--primary')!.addEventListener('click', e => { e.stopPropagation(); onRetry(); });
    _el.querySelector('.failed-btn--secondary')!.addEventListener('click', e => { e.stopPropagation(); onBack(); });
};

export const show = (): void => {
    if (_el) _el.style.display = 'flex';
};
export const hide = (): void => {
    if (_el) _el.style.display = 'none';
};
