import { I18N_DE, I18N_EN, LEGAL_DATENSCHUTZ_IMPRINT } from '../../i18n';

const _rows = (lines: readonly string[]) => lines.map(l => (l ? `<p>${l}</p>` : '<br>')).join('');

export const render = (): void => {
    document.head.insertAdjacentHTML(
        'beforeend',
        `<style>
            body{background:#050505;color:#5f5;font-family:monospace;margin:0;padding:24px max(24px,env(safe-area-inset-left,0px));overflow-x:hidden;position:static;height:auto;width:auto;}
            h1{color:#ff6600;font-size:clamp(24px,5vw,42px);letter-spacing:6px;margin-bottom:4px;font-weight:bold;}
            h2{color:#ff6600;font-size:11px;letter-spacing:4px;font-weight:bold;margin:28px 0 10px;border-bottom:1px solid #1a1a1a;padding-bottom:6px;}
            p{color:#666;font-size:12px;line-height:1.8;margin:4px 0;letter-spacing:0.5px;}
            .sub{color:#5f5;letter-spacing:4px;font-size:12px;margin-bottom:36px;}
            .lang-row{margin-bottom:28px;}
            .lang-btn{background:none;border:1px solid #333;color:#444;font-family:monospace;font-size:11px;letter-spacing:3px;padding:4px 14px;cursor:pointer;margin-right:8px;}
            .lang-btn.active{border-color:#5f5;color:#5f5;}
            .block{padding-left:10px;border-left:1px solid #1a1a1a;}
            .wrap{max-width:640px;margin:0 auto;padding-bottom:48px;}
            .wrap[data-lang="en"] .sec-de{display:none;}
            .wrap[data-lang="de"] .sec-en{display:none;}
        </style>`
    );

    const initLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    document.body.innerHTML = `<div class="wrap" id="imp" data-lang="${initLang}">
        <h1>SAR: CALLSIGN WOLF</h1>
        <div class="sub">${I18N_EN.LEGAL_TITLE} · ${I18N_DE.LEGAL_TITLE}</div>
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
    </div>`;

    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    const initBtn = document.querySelector<HTMLElement>(`.lang-btn.${initLang}`);
    if (initBtn) initBtn.classList.add('active');
};
