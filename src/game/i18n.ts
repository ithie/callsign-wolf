// ─── UI-Systemtexte ──────────────────────────────────────────────────────────
// Alle spielersichtbaren Systemtexte werden hier zentral gepflegt.
// Kampagnentexte (Headlines, Briefings) stehen in den jeweiligen JSON-Dateien.
// Sprache wird beim Start via storage (Nutzerpräferenz) oder navigator.language ermittelt.

export const LANG_PREF_KEY = 'z_lang';

const _DATENSCHUTZ_DE = [
    'SAR: Callsign WOLF speichert folgende Daten lokal auf deinem Gerät:',
    '▸ Rufzeichen  ▸ Dienstgrad  ▸ Kampagnenfortschritt  ▸ Spracheinstellung  ▸ Steuerungseinstellung',
    'Die Daten werden ausschließlich zur Spielfunktion genutzt und nicht an Dritte weitergegeben. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.',
    'Gespeicherte Daten können jederzeit über Hauptmenü → Einstellungen → Spielstand löschen gelöscht werden.',
    'Kontakt für Datenschutzanfragen: yarrick@web.de',
] as const;

const _DATENSCHUTZ_EN = [
    'SAR: Callsign WOLF stores the following data locally on your device:',
    '▸ Callsign  ▸ Rank  ▸ Campaign progress  ▸ Language setting  ▸ Control setting',
    'Data is used exclusively for game functionality and is not shared with third parties. Legal basis: Art. 6 para. 1 lit. b GDPR.',
    'Stored data can be deleted at any time via Main Menu → Settings → Delete Save.',
    'Privacy contact: yarrick@web.de',
] as const;

/** App-version privacy text — used by the ?imprint page (App Store link) for both DE and EN. */
export const LEGAL_DATENSCHUTZ_IMPRINT = { de: _DATENSCHUTZ_DE, en: _DATENSCHUTZ_EN };


import { storageGet, storageSet } from './storage';

const _detectLang = (): 'de' | 'en' => {
    try {
        const stored = storageGet(LANG_PREF_KEY);
        if (stored === 'de' || stored === 'en') return stored;
        return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    } catch {
        return 'de';
    }
};

const _DE = {
    DONE: 'abgeschlossen',

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'KLICKEN ZUM STARTEN',

    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_SUBTITLE: 'MAIN SYSTEM',
    MENU_START: 'SPIEL STARTEN',
    MENU_HELI: 'HELIKOPTER',
    MENU_SETTINGS: 'EINSTELLUNGEN',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Weiter',
    BACK: '◀ ZURÜCK',
    ACKNOWLEDGE: 'VERSTANDEN',

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

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_SUB: 'LUFTFAHRZEUG WÄHLEN',
    HELI_SELECT_CONFIRM: 'AUSWÄHLEN',
    HELI_LOCKED_FROM: (rank: string) => `ab ${rank}`,

    MISSION_COMPLETE: 'MISSION GESCHAFFT',
    OBJECTIVES_CLEARED: 'ALLE ZIELE ERFÜLLT',
    MISSION_FAILED: 'MISSION GESCHEITERT',
    CAMPAIGN_COMPLETE: 'KAMPAGNE GESCHAFFT',
    ALL_MISSIONS_CLEARED: 'ALLE MISSIOSNEN ABGESCHLOSSEN',

    CLICK_TO_DEPLOY: 'KLICKEN ZUM EINSATZ',

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Ihre Mission, ${rank} ${callsign || 'WOLF'}`,

    SAVE_CODE_INVALID: 'UNGÜLTIGER CODE',
    SAVE_CODE_LOADED: 'SPIELSTAND GELADEN',
    STATS: (c: number, m: number) => `KAMPAGNEN: ${c}  |  MISSIONEN: ${m}`,
    CAMPAIGN_LOCKED: '[ GESPERRT ]',

    DELETE_SESSION: 'SPIELSTAND LÖSCHEN',
    DELETE_CONFIRM: 'WIRKLICH LÖSCHEN?',
    SESSION_DELETED: 'GELÖSCHT – SEITE WIRD NEU GELADEN…',

    DELIVER_MODE_ON: 'ABSETZ-MODUS — [R] ABBRECHEN',
    DELIVER_MODE_OFF: '',

    PILOT_HEADING: 'PROFIL',
    PILOT_CALLSIGN: 'RUFZEICHEN (MAX. 8 ZEICHEN, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'CODE IMPORTIEREN (ÜBERSCHREIBT SPIELSTAND)',
    PILOT_IMPORTLOAD: 'LADEN',
    MUSIC_HEADING: 'MUSIK',
    SFX_HEADING: 'SOUND-EFFEKTE',
    AUDIO_ON: 'AN',
    AUDIO_OFF: 'AUS',
    PAUSE_TITLE: '— PAUSE —',
    PAUSE_RESUME: '▶ WEITER',
    PAUSE_ABORT: '✕ ABBRUCH',
    LANGUAGE_HEADING: 'SPRACHE',
    TUT_TAKEOFF_D: 'STARTEN & AUFSTEIGEN — [W] HALTEN BIS 100M',
    TUT_TAKEOFF_M: 'STARTEN & AUFSTEIGEN — LINKEN STICK NACH OBEN HALTEN',
    TUT_TURN_L_D: 'DREHEN LINKS — [←] GEDRÜCKT HALTEN',
    TUT_TURN_L_M: 'DREHEN LINKS — RECHTEN STICK NACH LINKS',
    TUT_TURN_R_D: 'DREHEN RECHTS — [→] GEDRÜCKT HALTEN',
    TUT_TURN_R_M: 'DREHEN RECHTS — RECHTEN STICK NACH RECHTS',
    TUT_STRAFE_L_D: 'GLEITEN LINKS — [A] GEDRÜCKT HALTEN',
    TUT_STRAFE_L_M: 'GLEITEN LINKS — LINKEN STICK NACH LINKS',
    TUT_STRAFE_R_D: 'GLEITEN RECHTS — [D] GEDRÜCKT HALTEN',
    TUT_STRAFE_R_M: 'GLEITEN RECHTS — LINKEN STICK NACH RECHTS',
    TUT_FORWARD_D: 'VORWÄRTS — [↑] GEDRÜCKT HALTEN',
    TUT_FORWARD_M: 'VORWÄRTS — RECHTEN STICK NACH OBEN',
    TUT_BACKWARD_D: 'RÜCKWÄRTS — [↓] GEDRÜCKT HALTEN',
    TUT_BACKWARD_M: 'RÜCKWÄRTS — RECHTEN STICK NACH UNTEN',
    TUT_LAND_D: 'TANK FAST LEER — NUR [S] ZUM LANDEN',
    TUT_LAND_M: 'TANK FAST LEER — LINKEN STICK NACH UNTEN ZUM LANDEN',
    TUT_REFUEL: 'WARTEN — TANKWAGEN BETANKT DEN HELIKOPTER',
    TUT_LOCATE_CRATE: 'KISTE SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_CRATE_PICKUP_D: 'KISTE AUFNEHMEN — WINDE ABSENKEN [E] UND ÜBER KISTE SCHWEBEN',
    TUT_CRATE_PICKUP_M: 'KISTE AUFNEHMEN — PITCH-RAD NACH UNTEN, ÜBER KISTE SCHWEBEN',
    TUT_CRATE_TO_PAD_D: 'KISTE ZUM LANDEPLATZ BRINGEN UND DORT ABSENKEN',
    TUT_CRATE_TO_PAD_M: 'KISTE ZUM LANDEPLATZ BRINGEN UND DORT ABSENKEN',
    TUT_LOCATE_PERSON: 'PERSON SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_PERSON_PICKUP_D: 'PERSON AUFNEHMEN — WINDE ABSENKEN [E], DANN EINWINSCHEN [Q]',
    TUT_PERSON_PICKUP_M: 'PERSON AUFNEHMEN — PITCH-RAD NACH UNTEN, DANN NACH OBEN',
    TUT_PERSON_TO_PAD_D: 'MIT PATIENT ZUM LANDEPLATZ FLIEGEN UND LANDEN [S]',
    TUT_PERSON_TO_PAD_M: 'MIT PATIENT ZUM LANDEPLATZ FLIEGEN UND LANDEN',
    TUT_DONE: 'TUTORIAL ABGESCHLOSSEN — VIEL ERFOLG!',
    TRAINING_REQUIRED: 'TRAINING ERFORDERLICH',
    NOT_UNLOCKED: 'NICHT FREIGESCHALTET',
    MENU_LEGAL: 'RECHTLICHES',
    LEGAL_TITLE: 'RECHTLICHES',
    LEGAL_IMPRESSUM_HEADING: 'IMPRESSUM',
    LEGAL_DATENSCHUTZ_HEADING: 'DATENSCHUTZ',
    LEGAL_IMPRESSUM: [
        'Angaben gemäß § 5 TMG / DDG:',
        '',
        'Michael Draws-Beer',
        'Friedrichstrasse 46',
        '53332',
        'Deutschland',
        '',
        'Kontakt',
        'E-Mail: yarrick@web.de',
        '',
        'Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV:',
        'Michael Draws-Beer – Anschrift wie oben',
    ],
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_DE,

    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Alle Rechte vorbehalten.',

    CREDITS_ROLE_DEVELOPMENT: 'SPIELDESIGN & ENTWICKLUNG',
    CREDITS_ROLE_CAMPAIGN: 'KAMPAGNEN-DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIK',
    CREDITS_ROLE_RECORDING: 'AUFNAHMELEITUNG',
    CREDITS_ROLE_VOICEARTIST: 'SPRECHER',
    CREDITS_ROLE_LEADERTEST: 'LEITER TEST',
    CREDITS_ROLE_TEST: 'TESTER',
    CREDITS_ROLE_CONSULTGS: 'FACHBERATUNG G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRIERT VON',
} as const;

const _EN = {
    DONE: 'complete',

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'CLICK TO START',

    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_SUBTITLE: 'MAIN SYSTEM',
    MENU_START: 'START GAME',
    MENU_HELI: 'HELICOPTER',
    MENU_SETTINGS: 'SETTINGS',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Continue',
    BACK: '◀ BACK',
    ACKNOWLEDGE: 'ACKNOWLEDGED',

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

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_SUB: 'SELECT AIRCRAFT',
    HELI_SELECT_CONFIRM: 'SELECT',
    HELI_LOCKED_FROM: (rank: string) => `from ${rank}`,

    MISSION_COMPLETE: 'MISSION COMPLETE',
    OBJECTIVES_CLEARED: 'ALL OBJECTIVES CLEARED',
    MISSION_FAILED: 'MISSION FAILED',
    CAMPAIGN_COMPLETE: 'CAMPAIGN COMPLETE',
    ALL_MISSIONS_CLEARED: 'ALL MISSIONS CLEARED',

    CLICK_TO_DEPLOY: 'CLICK TO DEPLOY',

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Your mission, ${rank} ${callsign || 'WOLF'}`,

    SAVE_CODE_INVALID: 'INVALID CODE',
    SAVE_CODE_LOADED: 'SAVE LOADED',
    STATS: (c: number, m: number) => `CAMPAIGNS: ${c}  |  MISSIONS: ${m}`,
    CAMPAIGN_LOCKED: '[ LOCKED ]',

    DELETE_SESSION: 'DELETE SAVE',
    DELETE_CONFIRM: 'REALLY DELETE?',
    SESSION_DELETED: 'DELETED – RELOADING…',

    DELIVER_MODE_ON: 'DEPLOY MODE — [R] CANCEL',
    DELIVER_MODE_OFF: '',

    PILOT_HEADING: 'PROFILE',
    PILOT_CALLSIGN: 'CALLSIGN (MAX. 8 CHARS, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'IMPORT CODE (OVERWRITES SAVE)',
    PILOT_IMPORTLOAD: 'LOAD',
    MUSIC_HEADING: 'MUSIC',
    SFX_HEADING: 'SOUND EFFECTS',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    PAUSE_TITLE: '— PAUSED —',
    PAUSE_RESUME: '▶ RESUME',
    PAUSE_ABORT: '✕ ABORT',
    TUT_TAKEOFF_D: 'START & CLIMB — HOLD [W] TO 100M',
    TUT_TAKEOFF_M: 'START & CLIMB — HOLD LEFT STICK UP',
    TUT_TURN_L_D: 'TURN LEFT — HOLD [←]',
    TUT_TURN_L_M: 'TURN LEFT — RIGHT STICK LEFT',
    TUT_TURN_R_D: 'TURN RIGHT — HOLD [→]',
    TUT_TURN_R_M: 'TURN RIGHT — RIGHT STICK RIGHT',
    TUT_STRAFE_L_D: 'STRAFE LEFT — HOLD [A]',
    TUT_STRAFE_L_M: 'STRAFE LEFT — LEFT STICK LEFT',
    TUT_STRAFE_R_D: 'STRAFE RIGHT — HOLD [D]',
    TUT_STRAFE_R_M: 'STRAFE RIGHT — LEFT STICK RIGHT',
    TUT_FORWARD_D: 'FORWARD — HOLD [↑]',
    TUT_FORWARD_M: 'FORWARD — RIGHT STICK UP',
    TUT_BACKWARD_D: 'BACKWARD — HOLD [↓]',
    TUT_BACKWARD_M: 'BACKWARD — RIGHT STICK DOWN',
    TUT_LAND_D: 'LOW FUEL — LAND WITH [S] ONLY',
    TUT_LAND_M: 'LOW FUEL — LEFT STICK DOWN TO LAND',
    TUT_REFUEL: 'WAIT — FUEL TRUCK IS REFUELLING THE HELICOPTER',
    TUT_LOCATE_CRATE: 'FIND CRATE — USE MINIMAP AND APPROACH',
    TUT_CRATE_PICKUP_D: 'PICK UP CRATE — LOWER WINCH [E] AND HOVER OVER CRATE',
    TUT_CRATE_PICKUP_M: 'PICK UP CRATE — PITCH WHEEL DOWN, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_D: 'BRING CRATE TO LANDING PAD AND LOWER IT THERE',
    TUT_CRATE_TO_PAD_M: 'BRING CRATE TO LANDING PAD AND LOWER IT THERE',
    TUT_LOCATE_PERSON: 'LOCATE SURVIVOR — USE MINIMAP AND APPROACH',
    TUT_PERSON_PICKUP_D: 'RESCUE SURVIVOR — LOWER WINCH [E], THEN RAISE [Q]',
    TUT_PERSON_PICKUP_M: 'RESCUE SURVIVOR — PITCH WHEEL DOWN, THEN UP',
    TUT_PERSON_TO_PAD_D: 'FLY TO LANDING PAD WITH PATIENT AND LAND [S]',
    TUT_PERSON_TO_PAD_M: 'FLY TO LANDING PAD WITH PATIENT AND LAND',
    TUT_DONE: 'TUTORIAL COMPLETE — GOOD LUCK!',
    TRAINING_REQUIRED: 'TRAINING REQUIRED',
    NOT_UNLOCKED: 'NOT UNLOCKED',
    LANGUAGE_HEADING: 'LANGUAGE',
    MENU_LEGAL: 'LEGAL',
    LEGAL_TITLE: 'LEGAL NOTICE',
    LEGAL_IMPRESSUM_HEADING: 'IMPRINT',
    LEGAL_DATENSCHUTZ_HEADING: 'PRIVACY POLICY',
    LEGAL_IMPRESSUM: [
        'Information according to § 5 TMG / DDG:',
        '',
        'Michael Draws-Beer',
        'Friedrichstrasse 46',
        '53332',
        'Germany',
        '',
        'Contact',
        'Email: yarrick@web.de',
        '',
        'Responsible for content (§ 18 para. 2 MStV):',
        'Michael Draws-Beer – address as above',
    ],
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_EN,

    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — All rights reserved.',

    CREDITS_ROLE_DEVELOPMENT: 'GAME DESIGN & DEVELOPMENT',
    CREDITS_ROLE_CAMPAIGN: 'CAMPAIGN DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIC',
    CREDITS_ROLE_RECORDING: 'AUDIO-RECORDING',
    CREDITS_ROLE_VOICEARTIST: 'VOICE-ARTIST',
    CREDITS_ROLE_LEADERTEST: 'LEADER-TESTER',
    CREDITS_ROLE_TEST: 'TESTERS',
    CREDITS_ROLE_CONSULTGS: 'CONSULTING G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRED BY',
} as const;

const _lang0 = _detectLang();

export const I18N_DE: typeof _DE = _DE;
export const I18N_EN: typeof _DE = _EN as unknown as typeof _DE;

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
    storageSet(LANG_PREF_KEY, lang);
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
