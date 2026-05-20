import './legal-screen.css';
import { I18N } from '../../i18n';
import { ensureEl } from '../dom-helpers';
import { mountScreenShell } from '../screen-shell/screen-shell';
import { showScreenCrtEnter } from '../nav';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

type I18NWithWeb = typeof I18N & { LEGAL_DATENSCHUTZ_WEB?: string };

const _addParagraphs = (parent: HTMLElement, lines: readonly string[]) => {
    lines.forEach(line => {
        const el = document.createElement('div');
        el.className = line === '' ? 'legal-spacer' : 'legal-para';
        el.textContent = line;
        parent.appendChild(el);
    });
};

export const mount = (onBack: () => void): void => {
    const root = ensureEl('legal-screen');
    if (root.children.length > 0) return;
    const body = mountScreenShell('legal-screen', I18N.LEGAL_TITLE, '', onBack);

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

    if (!_IS_APP) {
        const stunText = (I18N as I18NWithWeb).LEGAL_DATENSCHUTZ_WEB;
        if (stunText) {
            const p = document.createElement('div');
            p.className = 'legal-para';
            p.textContent = stunText;
            content.appendChild(p);
        }
    }

    body.appendChild(content);
};

export const show = (): void => {
    showScreenCrtEnter('legal-screen');
};
