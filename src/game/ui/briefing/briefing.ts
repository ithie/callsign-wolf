import './briefing.css';
import { localize } from '../../i18n';
import type { LocalizedString } from '../../../shared/types';
import { ensureEl as _ensureEl } from '../dom-helpers';
import { COMMODORE_SVG as _COMMODORE_SVG } from '../commodore-svg';

export const mount = (): void => {
    _ensureEl('mission-briefing');
};

export interface BriefingData {
    headline: LocalizedString | undefined;
    sublines: LocalizedString[] | undefined;
    briefing: LocalizedString | undefined;
    address: string;
}

let _onDismiss: (() => void) | null = null;

export const hide = (): void => {
    const el = document.getElementById('mission-briefing');
    if (el) el.style.display = 'none';
};

const _dismiss = (): void => {
    hide();
    const cb = _onDismiss;
    _onDismiss = null;
    cb?.();
};

export const show = (data: BriefingData, onDismiss: () => void): void => {
    _onDismiss = onDismiss;
    const el = document.getElementById('mission-briefing')!;
    const sublinesHtml = Array.isArray(data.sublines) && data.sublines.length
        ? `<div id="briefing-sublines">${data.sublines.map(s => `▸ ${localize(s)}`).join('<br>')}</div>`
        : '';
    const bodyHtml = data.briefing
        ? `<div id="briefing-body">${localize(data.briefing)}</div>`
        : '';
    el.innerHTML = `
        <div id="briefing-panel">
            <div id="briefing-text">
                <div id="briefing-address">${data.address}</div>
                <div id="briefing-headline">${localize(data.headline) || 'MISSION BRIEFING'}</div>
                ${sublinesHtml}
                ${bodyHtml}
                <button id="briefing-ok-btn">OKAY</button>
            </div>
            <div id="briefing-commander-img">${_COMMODORE_SVG}</div>
        </div>`;
    document.getElementById('briefing-ok-btn')!.addEventListener('click', _dismiss);
    el.style.display = 'flex';
};
