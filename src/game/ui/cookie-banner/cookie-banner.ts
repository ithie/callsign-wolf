import './cookie-banner.css';
import { LANG, setLanguage, onLanguageChange } from '../../i18n';
import { STORAGE_KEY } from '../../session';
import { storageGet } from '../../storage';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';
import { ensureEl as _ensureEl } from '../dom-helpers';

let _onConsent: (() => void) | null = null;

const _hasExistingData = (): boolean => storageGet(STORAGE_KEY) !== null;

const _html = (): string => {
    const de = LANG === 'de';
    const hasData = _hasExistingData();
    return `<div id="cookie-inner">
        <div class="cookie-lang-row">
            <button class="cookie-lang-btn${de ? ' active' : ''}" data-lang="de">DEUTSCH</button>
            <button class="cookie-lang-btn${!de ? ' active' : ''}" data-lang="en">ENGLISH</button>
        </div>
        <div style="color:#cc9900;font-size:15px;letter-spacing:5px;font-weight:bold">${de ? 'DATENSCHUTZ' : 'PRIVACY'}</div>
        <p>${de
            ? 'SAR: Callsign WOLF kann folgende Daten <strong style="color:#aaa">ausschließlich lokal</strong> in deinem Browser (localStorage) speichern – aber nur mit deiner Einwilligung:'
            : 'SAR: Callsign WOLF can store the following data <strong style="color:#aaa">exclusively local</strong> in your browser (localStorage) – but only with your consent:'
        }</p>
        <p style="color:#555;font-size:13px;line-height:1.6">${de
            ? '▸ Rufzeichen &nbsp;▸ Dienstgrad &nbsp;▸ Kampagnenfortschritt &nbsp;▸ Einwilligungsstatus &nbsp;▸ Spracheinstellung'
            : '▸ Callsign &nbsp;▸ Rank &nbsp;▸ Campaign progress &nbsp;▸ Consent status &nbsp;▸ Language setting'
        }</p>
        <p>${de
            ? '<strong style="color:#aaa">Zustimmen:</strong> Daten werden lokal gespeichert – dein Fortschritt bleibt dauerhaft erhalten. <strong style="color:#aaa">Ablehnen:</strong> Es werden keine Daten gespeichert – das Spiel ist trotzdem vollständig spielbar, jedoch ohne dauerhaften Fortschritt.'
            : '<strong style="color:#aaa">Accept:</strong> Data is stored locally – your progress is saved permanently. <strong style="color:#aaa">Decline:</strong> No data is stored – the game is fully playable, but without persistent progress.'
        }</p>
        <p>${de
            ? 'Unabhängig davon wird die Steuerungseinstellung <strong style="color:#aaa">immer lokal</strong> gespeichert, da es sich um eine rein technische Geräteeinstellung handelt (kein Personenbezug).'
            : 'Independently, the control setting is <strong style="color:#aaa">always stored locally</strong>, as it is a purely technical device setting (no personal data).'
        }</p>
        ${!_IS_APP ? `<p style="border-top:1px solid #1a2a1a;padding-top:10px;margin-top:4px">
            <strong style="color:#cc9900">${de ? 'MULTIPLAYER-MODUS:' : 'MULTIPLAYER MODE:'}</strong>
            ${de
                ? 'Wenn du eine Multiplayer-Verbindung aufbaust, werden zur Vermittlung der direkten Peer-to-Peer-Verbindung <strong style="color:#aaa">Google STUN-Server</strong> (stun.l.google.com) kontaktiert. Dabei wird deine <strong style="color:#aaa">IP-Adresse</strong> an Google übermittelt. Dies geschieht ausschließlich auf deine aktive Veranlassung hin und nur für die Dauer des Verbindungsaufbaus. Google setzt dabei <strong style="color:#aaa">keine Cookies</strong>. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO.'
                : 'When you establish a multiplayer connection, <strong style="color:#aaa">Google STUN servers</strong> (stun.l.google.com) are contacted to broker the direct peer-to-peer connection. Your <strong style="color:#aaa">IP address</strong> is transmitted to Google solely at your active initiative and only for the duration of the connection setup. Google does <strong style="color:#aaa">not set any cookies</strong>. Legal basis: Art.&nbsp;6 para.&nbsp;1 lit.&nbsp;b GDPR.'
            }
        </p>` : ''}
        <p style="color:#444;font-size:12px">${de
            ? 'Rechtsgrundlage für die lokale Speicherung: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;a DSGVO (Einwilligung). Gespeicherte Daten können jederzeit über <strong style="color:#555">Hauptmenü → Einstellungen → Spielstand löschen</strong> unwiderruflich gelöscht werden.'
            : 'Legal basis for local storage: Art.&nbsp;6 para.&nbsp;1 lit.&nbsp;a GDPR (consent). Stored data can be deleted at any time via <strong style="color:#555">Main Menu → Settings → Delete Save</strong>.'
        }</p>
        <div id="cookie-buttons">
            <button class="approve" onclick="approveCookies()">${de ? 'ZUSTIMMEN' : 'ACCEPT'}</button>
            <button class="decline" onclick="declineCookies()">${de ? 'ABLEHNEN' : 'DECLINE'}</button>
            ${hasData ? `<button class="decline" style="background:#1a0000;border-color:#500;color:#c44" onclick="confirmDeleteSession()">${de ? 'WIDERRUFEN & LÖSCHEN' : 'REVOKE & DELETE'}</button>` : ''}
        </div>
    </div>`;
};

export const mountCookieBanner = (onConsent?: () => void): void => {
    _onConsent = onConsent ?? null;
    const el = _ensureEl('cookie-banner');
    el.innerHTML = _html();
    el.addEventListener('click', (e: Event) => {
        const lang = (e.target as HTMLElement).dataset.lang;
        if (lang === 'de' || lang === 'en') setLanguage(lang);
    });
};

onLanguageChange(() => {
    const el = document.getElementById('cookie-banner');
    if (el) el.innerHTML = _html();
});

export const notifyConsent = (): void => {
    _onConsent?.();
    _onConsent = null;
};
