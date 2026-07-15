import './legal-screen.css';
import { I18N } from '../../i18n';
import { ensureEl } from '@/ui/dom-helpers';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { showScreenCrtEnter } from '../nav';


const _addParagraphs = (parent: HTMLElement, lines: readonly string[]) => {
    lines.forEach(line => {
        const el = document.createElement('div');
        el.className = line === '' ? 'legal-spacer' : 'legal-para';
        el.textContent = line;
        parent.appendChild(el);
    });
};

let _onBack: () => void = () => {};

export const mount = (onBack: () => void): void => {
    _onBack = onBack;
    ensureEl('legal-screen');
};

export const show = (): void => {
    const body = mountScreenShell('legal-screen', I18N.LEGAL_TITLE, _onBack);

    const content = document.createElement('div');
    content.className = 'legal-content';

    const impHead = document.createElement('div');
    impHead.className = 'legal-section-heading';
    impHead.textContent = I18N.LEGAL_IMPRESSUM_HEADING;
    content.appendChild(impHead);
    _addParagraphs(content, I18N.LEGAL_IMPRESSUM);

    const dsHead = document.createElement('div');
    dsHead.className = 'legal-section-heading';
    dsHead.textContent = I18N.LEGAL_DATENSCHUTZ_HEADING;
    content.appendChild(dsHead);
    _addParagraphs(content, I18N.LEGAL_DATENSCHUTZ);

    body.appendChild(content);
    showScreenCrtEnter('legal-screen');
};
