import '../base.css';
import { ensureEl } from '../dom-helpers';
import { createBackButton } from '../back-button/back-button';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;

export const mount = (onConfirm: () => void, onCancel: () => void): void => {
    _el = ensureEl('campaign-switch-warning');
    _el.innerHTML = `
        <div class="title" style="font-size:26px;color:#f90">${I18N.CAMPAIGN_SWITCH_WARNING}</div>
        <p style="color:#aaa;font-size:15px;letter-spacing:1px;margin:10px 0 24px">
            ${I18N.CAMPAIGN_SWITCH_PROGRESS_WARN}
        </p>
        <div style="display:flex;gap:20px">
            <div class="back-btn" style="color:#f90;border-color:#f90" id="campaign-switch-confirm">
                ${I18N.CAMPAIGN_SWITCH_CONFIRM}
            </div>
        </div>`;
    (_el.lastElementChild as HTMLElement).prepend(createBackButton(onCancel));
    document.getElementById('campaign-switch-confirm')!.addEventListener('click', onConfirm);
};

export const show = (): void => { if (_el) _el.style.display = 'flex'; };
export const hide = (): void => { if (_el) _el.style.display = 'none'; };
