// ─── UI-Systemtexte ──────────────────────────────────────────────────────────
// Alle spielersichtbaren Systemtexte werden hier zentral gepflegt.
// Kampagnentexte (Headlines, Briefings) stehen in den jeweiligen JSON-Dateien.
// Sprache wird beim Start via localStorage (Nutzerpräferenz) oder navigator.language ermittelt.

export const LANG_PREF_KEY = 'zeewolf_lang';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

const _detectLang = (): 'de' | 'en' => {
    try {
        const stored = localStorage.getItem(LANG_PREF_KEY);
        if (stored === 'de' || stored === 'en') return stored;
        return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    } catch {
        return 'de';
    }
};

const _DE = {
    DONE: 'abgeschlossen',
    OUT_OF_FUEL: 'KEIN TREIBSTOFF!',
    MAX_ALTITUDE: 'MAX. HÖHE',
    CARGO_SECURED: 'FRACHT GESICHERT!',
    PATIENT_SECURED: 'PATIENT GESICHERT!',
    DELIVERED: 'ABGELIEFERT!',
    ONBOARD: (n: number, max: number) => `AN BORD [${n}/${max}]`,
    CABIN_FULL: 'KABINE VOLL!',
    DROP_AT_PAD: 'AM LANDEPLATZ ABLEGEN!',
    SECURED: (rescued: number, total: number) => `GESICHERT: ${rescued}/${total}`,

    SOARING: 'HOCH HINAUS – ↑↓ PITCH  ←→ BANK',
    SYSTEM_READY: 'SYSTEM BEREIT – TRIEBWERK STARTEN [W]',

    ...(!_IS_APP ? { PARTY_ON: '🎉 PARTY MODE 🎉', UNLOCK_ALL: '🔓 ALL CAMPAIGNS UNLOCKED' } : {}),

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'KLICKEN ZUM SYSTEMSTART',

    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_SUBTITLE: 'MAIN SYSTEM',
    MENU_START: 'SPIEL STARTEN',
    ...(!_IS_APP
        ? {
              MENU_MULTIPLAYER: 'MULTIPLAYER',
              MP_SUBTITLE: 'KOOP-EINSATZ',
              MP_CREATE: 'SPIEL ERSTELLEN',
              MP_JOIN: 'BEITRETEN',
              MP_GENERATING: 'GENERIERE...',
              MP_WAIT_ANSWER: 'WARTE AUF ANTWORT...',
              MP_WAIT_CONNECT: 'WARTE AUF VERBINDUNG...',
              MP_CONNECTING: 'VERBINDE...',
              MP_CONNECTED: 'VERBUNDEN',
              MP_ERROR: 'FEHLER – BITTE ERNEUT VERSUCHEN',
              MP_READY_PROMPT: 'BEREIT ZUM EINSATZ?',
              MP_READY_BTN: 'BEREIT',
              MP_WAIT_READY: 'WARTE AUF MITSPIELER...',
              MP_COPY: 'KOPIEREN',
              MP_CONNECT: 'VERBINDEN',
              MP_GEN_ANSWER: 'ANTWORT GENERIEREN',
              MP_STEP1_HOST: 'Schritt 1: Diesen Code an deinen Mitspieler senden:',
              MP_STEP2_HOST: 'Schritt 2: Antwort des Mitspielers einfügen:',
              MP_STEP1_GUEST: 'Code des Gastgebers einfügen:',
              MP_STEP2_GUEST: 'Diesen Code an den Gastgeber senden:',
              MP_PASTE_HINT: 'Code hier einfügen…',
              CRASH_REMOTE_HELI: 'KOLLISION MIT MITSPIELER',
          }
        : {}),
    MENU_HELI: 'HELIKOPTER',
    MENU_SETTINGS: 'EINSTELLUNGEN',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Weiter',
    BACK: '◀ ZURÜCK',
    RETRY: 'WIEDERHOLEN',
    RETURN_TO_BASE: 'ZURÜCK ZUR BASIS',

    CAMPAIGN_SELECT_TITLE: 'KAMPAGNE WÄHLEN',
    CAMPAIGN_SELECT_SUB: 'EINSATZGEBIET',
    CAMPAIGN_SELECT_MISSIONS: 'Missionen',

    MISSION_SELECT_SUB: 'EINSÄTZE',
    MISSION_LOCKED: '[ GESPERRT ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `BESTZEIT: ${min}:${sec.padStart(4, '0')}`;
    },

    CAMPAIGN_SWITCH_WARNING: 'Fortschritt wird zurückgesetzt.',
    CAMPAIGN_SWITCH_CONFIRM: 'TROTZDEM WECHSELN',

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_SUB: 'LUFTFAHRZEUG WÄHLEN',
    HELI_LOCKED_FROM: (rank: string) => `ab ${rank}`,

    TERMINATED: 'TERMINATED',
    MISSION_COMPLETE: 'MISSION COMPLETE',
    OBJECTIVES_CLEARED: 'ALL OBJECTIVES CLEARED',
    CAMPAIGN_COMPLETE: 'CAMPAIGN COMPLETE',
    ALL_MISSIONS_CLEARED: 'ALL MISSIONS CLEARED',
    CAMPAIGN_FAILED: 'CAMPAIGN FAILED',
    MISSION_ABORTED: 'MISSION ABORTED',

    CLICK_TO_DEPLOY: 'KLICKEN ZUM EINSATZ',

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Ihre Mission, ${rank} ${callsign || 'WOLF'}`,

    SAVE_CODE_INVALID: 'UNGÜLTIGER CODE',
    SAVE_CODE_LOADED: 'SPIELSTAND GELADEN',
    NO_SAVE_STATE: '  |  KEIN SPEICHERSTAND',
    STATS: (c: number, m: number) => `KAMPAGNEN: ${c}  |  MISSIONEN: ${m}`,
    CAMPAIGN_LOCKED: '[ GESPERRT ]',

    DELETE_SESSION: 'SPIELSTAND LÖSCHEN',
    DELETE_CONFIRM: 'WIRKLICH LÖSCHEN?',
    SESSION_DELETED: 'GELÖSCHT – SEITE WIRD NEU GELADEN…',

    DELIVER_MODE_ON: 'ABSETZ-MODUS — [R] ABBRECHEN',
    DELIVER_MODE_OFF: '',
    DELIVERED_TO_ZONE: 'PERSON ABGESETZT!',
    DELIVER_NO_ZONE: 'KEINE ABSETZZONE HIER',

    CRASH_WATER: 'WASSERAUFPRALL',
    CRASH_BAD_ZONE: 'FALSCHES LANDEZIEL',
    CRASH_TOO_FAST: 'ZU SCHNELL',
    CRASH_HARD_IMPACT: 'HARTER AUFPRALL',
    CRASH_CARRIER_TOWER: 'TRÄGERTURM-KOLLISION',
    CRASH_PARKED_HELI: 'KOLLISION MIT ABGESTELLTEM HELI',
    CRASH_HANGAR: 'HANGAR-KOLLISION',
    CRASH_FUEL_TRUCK: 'KOLLISION MIT TANKWAGEN',
    CRASH_LIGHTHOUSE: 'LEUCHTTURM-KOLLISION',
    CRASH_BOAT: 'KOLLISION MIT BOOT',
    CRASH_SUBMARINE: 'KOLLISION MIT U-BOOT',
    CRASH_TREE: 'BAUMKONTAKT',

    WHATS_NEW_HEADLINE: 'NEUIGKEITEN',
    WHATS_NEW_VERSION: 'v26.4.0',
    WHATS_NEW_TITLE: 'iOS App',
    WHATS_NEW_HINT: 'KLICKEN ZUM FORTFAHREN',
    WHATS_NEW_ITEMS: ['Jetzt als native iOS App spielbar'],

    PILOT_HEADING: 'PROFIL',
    PILOT_CALLSIGN: 'RUFZEICHEN (MAX. 8 ZEICHEN, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'CODE IMPORTIEREN (ÜBERSCHREIBT SPIELSTAND)',
    PILOT_IMPORTLOAD: 'LADEN',
    CONTROLS_HEADING: 'STEUERUNG',
    CONTROLS_SIMPLIFIED: 'VEREINFACHT',
    CONTROLS_SIMPLIFIED_DETAILS: 'Rechter Stick dreht und beschleunigt relativ zum Heli.',
    CONTROLS_PROFESSIONAL: 'PROFI',
    CONTROLS_PROFESSIONAL_DETAILS: 'Rechter Stick: oben = vorwärts, unabhängig von Ausrichtung.',
    MUSIC_HEADING: 'MUSIK',
    SFX_HEADING: 'SOUND-EFFEKTE',
    AUDIO_ON: 'AN',
    AUDIO_OFF: 'AUS',
    LANGUAGE_HEADING: 'SPRACHE',
    CAMPAIGN_SWITCH_PROGRESS_WARN: 'Der Fortschritt der aktiven Kampagne wird gelöscht.',
    RANKUP_HELI_UNLOCK: 'NEUES LUFTFAHRZEUG FREIGESCHALTET',
    RANKUP_TITLE: 'Beförderung',

    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Alle Rechte vorbehalten.',

    CREDITS_ROLE_DEVELOPMENT: 'SPIELDESIGN & ENTWICKLUNG',
    CREDITS_ROLE_CAMPAIGN: 'KAMPAGNEN-DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIK',
    CREDITS_ROLE_TEST: 'TESTER',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRIERT VON',
} as const;

const _EN = {
    DONE: 'complete',
    OUT_OF_FUEL: 'OUT OF FUEL!',
    MAX_ALTITUDE: 'MAX. ALTITUDE',
    CARGO_SECURED: 'CARGO SECURED!',
    PATIENT_SECURED: 'PATIENT SECURED!',
    DELIVERED: 'DELIVERED!',
    ONBOARD: (n: number, max: number) => `ON BOARD [${n}/${max}]`,
    CABIN_FULL: 'CABIN FULL!',
    DROP_AT_PAD: 'DROP AT LANDING PAD!',
    SECURED: (rescued: number, total: number) => `SECURED: ${rescued}/${total}`,

    SOARING: 'SOARING HIGH – ↑↓ PITCH  ←→ BANK',
    SYSTEM_READY: 'SYSTEM READY – START ENGINE [W]',

    ...(!_IS_APP ? { PARTY_ON: '🎉 PARTY MODE 🎉', UNLOCK_ALL: '🔓 ALL CAMPAIGNS UNLOCKED' } : {}),

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'CLICK TO START SYSTEM',

    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_SUBTITLE: 'MAIN SYSTEM',
    MENU_START: 'START GAME',
    ...(!_IS_APP
        ? {
              MENU_MULTIPLAYER: 'MULTIPLAYER',
              MP_SUBTITLE: 'CO-OP MISSION',
              MP_CREATE: 'CREATE GAME',
              MP_JOIN: 'JOIN',
              MP_GENERATING: 'GENERATING...',
              MP_WAIT_ANSWER: 'WAITING FOR ANSWER...',
              MP_WAIT_CONNECT: 'WAITING FOR CONNECTION...',
              MP_CONNECTING: 'CONNECTING...',
              MP_CONNECTED: 'CONNECTED',
              MP_ERROR: 'ERROR – PLEASE TRY AGAIN',
              MP_READY_PROMPT: 'READY FOR DEPLOYMENT?',
              MP_READY_BTN: 'READY',
              MP_WAIT_READY: 'WAITING FOR OTHER PLAYER...',
              MP_COPY: 'COPY',
              MP_CONNECT: 'CONNECT',
              MP_GEN_ANSWER: 'GENERATE ANSWER',
              MP_STEP1_HOST: 'Step 1: Send this code to your co-pilot:',
              MP_STEP2_HOST: "Step 2: Paste your co-pilot's answer:",
              MP_STEP1_GUEST: "Paste the host's code:",
              MP_STEP2_GUEST: 'Send this code to the host:',
              MP_PASTE_HINT: 'Paste code here…',
              CRASH_REMOTE_HELI: 'COLLISION WITH CO-PILOT',
          }
        : {}),
    MENU_HELI: 'HELICOPTER',
    MENU_SETTINGS: 'SETTINGS',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Continue',
    BACK: '◀ BACK',
    RETRY: 'RETRY',
    RETURN_TO_BASE: 'RETURN TO BASE',

    CAMPAIGN_SELECT_TITLE: 'SELECT CAMPAIGN',
    CAMPAIGN_SELECT_SUB: 'AREA OF OPERATION',
    CAMPAIGN_SELECT_MISSIONS: 'Missions',

    MISSION_SELECT_SUB: 'MISSIONS',
    MISSION_LOCKED: '[ LOCKED ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `BEST TIME: ${min}:${sec.padStart(4, '0')}`;
    },

    CAMPAIGN_SWITCH_WARNING: 'Progress will be reset.',
    CAMPAIGN_SWITCH_CONFIRM: 'SWITCH ANYWAY',

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_SUB: 'SELECT AIRCRAFT',
    HELI_LOCKED_FROM: (rank: string) => `from ${rank}`,

    TERMINATED: 'TERMINATED',
    MISSION_COMPLETE: 'MISSION COMPLETE',
    OBJECTIVES_CLEARED: 'ALL OBJECTIVES CLEARED',
    CAMPAIGN_COMPLETE: 'CAMPAIGN COMPLETE',
    ALL_MISSIONS_CLEARED: 'ALL MISSIONS CLEARED',
    CAMPAIGN_FAILED: 'CAMPAIGN FAILED',
    MISSION_ABORTED: 'MISSION ABORTED',

    CLICK_TO_DEPLOY: 'CLICK TO DEPLOY',

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Your mission, ${rank} ${callsign || 'WOLF'}`,

    SAVE_CODE_INVALID: 'INVALID CODE',
    SAVE_CODE_LOADED: 'SAVE LOADED',
    NO_SAVE_STATE: '  |  NO SAVE STATE',
    STATS: (c: number, m: number) => `CAMPAIGNS: ${c}  |  MISSIONS: ${m}`,
    CAMPAIGN_LOCKED: '[ LOCKED ]',

    DELETE_SESSION: 'DELETE SAVE',
    DELETE_CONFIRM: 'REALLY DELETE?',
    SESSION_DELETED: 'DELETED – RELOADING…',

    DELIVER_MODE_ON: 'DEPLOY MODE — [R] CANCEL',
    DELIVER_MODE_OFF: '',
    DELIVERED_TO_ZONE: 'PERSON DEPLOYED!',
    DELIVER_NO_ZONE: 'NO DEPLOY ZONE HERE',

    CRASH_WATER: 'WATER IMPACT',
    CRASH_BAD_ZONE: 'WRONG LANDING ZONE',
    CRASH_TOO_FAST: 'TOO FAST',
    CRASH_HARD_IMPACT: 'HARD IMPACT',
    CRASH_CARRIER_TOWER: 'CARRIER TOWER COLLISION',
    CRASH_PARKED_HELI: 'COLLISION WITH PARKED HELI',
    CRASH_HANGAR: 'HANGAR COLLISION',
    CRASH_FUEL_TRUCK: 'FUEL TRUCK COLLISION',
    CRASH_LIGHTHOUSE: 'LIGHTHOUSE COLLISION',
    CRASH_BOAT: 'BOAT COLLISION',
    CRASH_SUBMARINE: 'SUBMARINE COLLISION',
    CRASH_TREE: 'TREE CONTACT',

    WHATS_NEW_HEADLINE: "WHAT'S NEW",
    WHATS_NEW_VERSION: 'v26.4.0',
    WHATS_NEW_TITLE: 'iOS App',
    WHATS_NEW_HINT: 'CLICK TO CONTINUE',
    WHATS_NEW_ITEMS: ['Now available as a native iOS app'],

    PILOT_HEADING: 'PROFILE',
    PILOT_CALLSIGN: 'CALLSIGN (MAX. 8 CHARS, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'IMPORT CODE (OVERWRITES SAVE)',
    PILOT_IMPORTLOAD: 'LOAD',
    CONTROLS_HEADING: 'CONTROLS',
    CONTROLS_SIMPLIFIED: 'SIMPLIFIED',
    CONTROLS_SIMPLIFIED_DETAILS: 'Right stick rotates and accelerates relative to the heli.',
    CONTROLS_PROFESSIONAL: 'PROFESSIONAL',
    CONTROLS_PROFESSIONAL_DETAILS: 'Right stick: up = forward, independent of heading.',
    MUSIC_HEADING: 'MUSIC',
    SFX_HEADING: 'SOUND EFFECTS',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    LANGUAGE_HEADING: 'LANGUAGE',
    CAMPAIGN_SWITCH_PROGRESS_WARN: 'Progress of the active campaign will be deleted.',
    RANKUP_HELI_UNLOCK: 'NEW AIRCRAFT UNLOCKED',
    RANKUP_TITLE: 'Promotion',

    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — All rights reserved.',

    CREDITS_ROLE_DEVELOPMENT: 'GAME DESIGN & DEVELOPMENT',
    CREDITS_ROLE_CAMPAIGN: 'CAMPAIGN DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIC',
    CREDITS_ROLE_TEST: 'TESTERS',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRED BY',
} as const;

const _lang0 = _detectLang();

export let I18N: typeof _DE = (_lang0 === 'de' ? _DE : _EN) as typeof _DE;

/** Active language code — used by localize() and campaign text rendering. */
export let LANG: 'de' | 'en' = _lang0;

const _langCallbacks: Array<() => void> = [];

/** Register a callback to fire whenever the language changes. */
export const onLanguageChange = (cb: () => void): void => {
    _langCallbacks.push(cb);
};

/** Change the active language, persist the choice, and notify all listeners. */
export const setLanguage = (lang: 'de' | 'en'): void => {
    try {
        localStorage.setItem(LANG_PREF_KEY, lang);
    } catch {}
    LANG = lang;
    I18N = (lang === 'de' ? _DE : _EN) as typeof _DE;
    _langCallbacks.forEach(cb => cb());
};

/** Resolve a LocalizedString to the active language (falls back to 'de'). */
export const localize = (ls: string | { de: string; en?: string } | undefined): string => {
    if (!ls) return '';
    if (typeof ls === 'string') return ls;
    return LANG === 'en' && ls.en ? ls.en : ls.de;
};
