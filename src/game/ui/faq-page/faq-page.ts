import './faq-page.css';
import { ensureEl } from '@/ui/dom-helpers';

const FAQ_DE = [
    { q: 'WIE STELLE ICH MEINEN KAUF WIEDER HER?', a: 'Öffne die Einstellungen im Hauptmenü und tippe auf „Käufe wiederherstellen".' },
    { q: 'WAS IST DER SPEICHERCODE?', a: 'Der Speichercode sichert deinen Spielfortschritt als kurzen Text. Notiere ihn, um deinen Stand auf ein neues Gerät zu übertragen. Den Code findest du in den Einstellungen – er ist nach dem Freischalten der Vollversion verfügbar.' },
    { q: 'WAS SCHALTET DER KAUF FREI?', a: 'SAR: Callsign WOLF ist kostenlos spielbar. Mit einem einmaligen Kauf (1,99 €) schaltest du alle Kampagnenmissionen dauerhaft frei – kein Abo, keine weiteren Kosten.' },
    { q: 'GIBT ES WERBUNG ODER TRACKING?', a: 'Nein. Keine Werbung, kein Tracking, keine Datensammlung.' },
    { q: 'ICH HABE EINE FRAGE ODER EIN PROBLEM.', a: 'Schreib uns: yarrick@web.de' },
];

const FAQ_EN = [
    { q: 'HOW DO I RESTORE MY PURCHASE?', a: 'Open Settings from the main menu and tap "Restore Purchases".' },
    { q: 'WHAT IS THE SAVE CODE?', a: 'The Save Code backs up your progress as a short text string. Note it down to transfer your game to a new device. Find it in Settings – available after purchasing the full version.' },
    { q: 'WHAT DOES THE PURCHASE UNLOCK?', a: 'SAR: Callsign WOLF is free to play. A one-time purchase (€1.99) unlocks all campaign missions permanently – no subscription, no further costs.' },
    { q: 'ARE THERE ADS OR TRACKING?', a: 'No. No ads, no tracking, no data collection.' },
    { q: 'I HAVE A QUESTION OR PROBLEM.', a: 'Write to us: yarrick@web.de' },
];

const _faqHtml = (items: typeof FAQ_DE, cls: string) =>
    items.map(({ q, a }) => `
        <h2 class="${cls}">${q}</h2>
        <div class="block ${cls}"><p>${a}</p></div>
    `).join('');

export const mount = (): void => {
    ensureEl('faq-page');
};

export const show = (backUrl?: string): void => {
    const el = ensureEl('faq-page');
    const initLang = 'de';
    const backHtml = backUrl
        ? `<a class="back-link sec-en" href="${backUrl}">&#8592; BACK</a>
           <a class="back-link sec-de" href="${backUrl}">&#8592; ZURÜCK</a>`
        : '';
    el.dataset.lang = initLang;
    el.innerHTML = `<div class="faq-wrap">
        <h1>SAR: CALLSIGN WOLF</h1>
        <div class="sub sec-en">FAQ</div>
        <div class="sub sec-de">FAQ</div>
        <div class="lang-row">
            <button class="lang-btn en" onclick="(function(e){e.dataset.lang='en';e.querySelector('.lang-btn.en').classList.add('active');e.querySelector('.lang-btn.de').classList.remove('active')})(document.getElementById('faq-page'))">ENGLISH</button>
            <button class="lang-btn de" onclick="(function(e){e.dataset.lang='de';e.querySelector('.lang-btn.de').classList.add('active');e.querySelector('.lang-btn.en').classList.remove('active')})(document.getElementById('faq-page'))">DEUTSCH</button>
        </div>
        ${_faqHtml(FAQ_EN, 'sec-en')}
        ${_faqHtml(FAQ_DE, 'sec-de')}
        ${backHtml}
    </div>`;
    el.style.display = 'block';
    const initBtn = el.querySelector<HTMLElement>(`.lang-btn.${initLang}`);
    if (initBtn) initBtn.classList.add('active');
};

export const hide = (): void => {
    const el = document.getElementById('faq-page');
    if (el) el.style.display = 'none';
};
