import './imprint-page.css';
import { I18N_DE, I18N_EN, LEGAL_DATENSCHUTZ_IMPRINT } from '../../i18n';
import { ensureEl } from '@/ui/dom-helpers';

const _rows = (lines: readonly string[]) => lines.map(l => (l ? `<p>${l}</p>` : '<br>')).join('');

export const mount = (): void => {
    ensureEl('imprint-page');
};

export const show = (backUrl?: string): void => {
    const el = ensureEl('imprint-page');
    const initLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    const backHtml = backUrl
        ? `<a class="back-link sec-en" href="${backUrl}">&#8592; BACK</a>
           <a class="back-link sec-de" href="${backUrl}">&#8592; ZURÜCK</a>`
        : '';
    el.dataset.lang = initLang;
    el.innerHTML = `<div class="imp-wrap">
        <h1>SAR: CALLSIGN WOLF</h1>
        <div class="sub sec-en">${I18N_EN.LEGAL_TITLE}</div>
        <div class="sub sec-de">${I18N_DE.LEGAL_TITLE}</div>
        <div class="lang-row">
            <button class="lang-btn en" onclick="(function(e){e.dataset.lang='en';e.querySelector('.lang-btn.en').classList.add('active');e.querySelector('.lang-btn.de').classList.remove('active');document.documentElement.lang='en'})(document.getElementById('imprint-page'))">ENGLISH</button>
            <button class="lang-btn de" onclick="(function(e){e.dataset.lang='de';e.querySelector('.lang-btn.de').classList.add('active');e.querySelector('.lang-btn.en').classList.remove('active');document.documentElement.lang='de'})(document.getElementById('imprint-page'))">DEUTSCH</button>
        </div>

        <h2 class="sec-en">${I18N_EN.LEGAL_IMPRESSUM_HEADING}</h2>
        <div class="block sec-en">${_rows(I18N_EN.LEGAL_IMPRESSUM)}</div>
        <h2 class="sec-de">${I18N_DE.LEGAL_IMPRESSUM_HEADING}</h2>
        <div class="block sec-de">${_rows(I18N_DE.LEGAL_IMPRESSUM)}</div>

        <h2 class="sec-en">${I18N_EN.LEGAL_DATENSCHUTZ_HEADING}</h2>
        <div class="block sec-en">${_rows(LEGAL_DATENSCHUTZ_IMPRINT.en)}</div>
        <h2 class="sec-de">${I18N_DE.LEGAL_DATENSCHUTZ_HEADING}</h2>
        <div class="block sec-de">${_rows(LEGAL_DATENSCHUTZ_IMPRINT.de)}</div>

        ${backHtml}
    </div>`;
    el.style.display = 'block';
    const initBtn = el.querySelector<HTMLElement>(`.lang-btn.${initLang}`);
    if (initBtn) initBtn.classList.add('active');
};

export const hide = (): void => {
    const el = document.getElementById('imprint-page');
    if (el) el.style.display = 'none';
};
