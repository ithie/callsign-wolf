import './imprint-page.css';
import { I18N_DE, I18N_EN, LEGAL_DATENSCHUTZ_IMPRINT } from '../../i18n';

const _rows = (lines: readonly string[]) => lines.map(l => (l ? `<p>${l}</p>` : '<br>')).join('');

export const render = (backUrl?: string): void => {

    const initLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    const backHtml = backUrl
        ? `<a class="back-link sec-en" href="${backUrl}">&#8592; BACK</a>
           <a class="back-link sec-de" href="${backUrl}">&#8592; ZURÜCK</a>`
        : '';
    document.body.innerHTML = `<div class="wrap" id="imp" data-lang="${initLang}">
        <h1>SAR: CALLSIGN WOLF</h1>
        <div class="sub sec-en">${I18N_EN.LEGAL_TITLE}</div>
        <div class="sub sec-de">${I18N_DE.LEGAL_TITLE}</div>
        <div class="lang-row">
            <button class="lang-btn en" onclick="document.getElementById('imp').dataset.lang='en';document.querySelector('.lang-btn.en').classList.add('active');document.querySelector('.lang-btn.de').classList.remove('active')">ENGLISH</button>
            <button class="lang-btn de" onclick="document.getElementById('imp').dataset.lang='de';document.querySelector('.lang-btn.de').classList.add('active');document.querySelector('.lang-btn.en').classList.remove('active')">DEUTSCH</button>
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

    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    const initBtn = document.querySelector<HTMLElement>(`.lang-btn.${initLang}`);
    if (initBtn) initBtn.classList.add('active');
};
