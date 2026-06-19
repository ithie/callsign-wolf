import '../base.css';
import './mission-success-screen.css';
import { ensureEl } from '../dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (onNext: (() => void) | null, onBack: () => void, backLabel?: string): void => {
    _el = ensureEl('mission-success-screen');
    _el.classList.add('ui-screen');
    _el.innerHTML = `
        <div class="title" style="color:#fff">${I18N.MISSION_COMPLETE}</div>
        <p style="color:#ffd700">${I18N.OBJECTIVES_CLEARED}</p>
        <div class="success-buttons">
            ${onNext ? `<button class="success-btn success-btn--primary">${I18N.NEXT_MISSION}</button>` : ''}
            <button class="success-btn success-btn--secondary">${backLabel ?? I18N.TO_MISSION_SELECT}</button>
        </div>`;
    if (onNext) {
        _el.querySelector('.success-btn--primary')!.addEventListener('click', e => { e.stopPropagation(); onNext(); });
    }
    _el.querySelector('.success-btn--secondary')!.addEventListener('click', e => { e.stopPropagation(); onBack(); });
};

export const show = (): void => {
    if (_el) _el.style.display = 'flex';
};

export const hide = (): void => {
    if (_el) _el.style.display = 'none';
};
