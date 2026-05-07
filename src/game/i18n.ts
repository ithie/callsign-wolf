// ─── UI-Systemtexte ──────────────────────────────────────────────────────────
// Alle spielersichtbaren Systemtexte werden hier zentral gepflegt.
// Kampagnentexte (Headlines, Briefings) stehen in den jeweiligen JSON-Dateien.
// Sprache wird beim Start via storage (Nutzerpräferenz) oder navigator.language ermittelt.

export const LANG_PREF_KEY = 'zeewolf_lang';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

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

    ...(!_IS_APP ? { PARTY_ON: '🎉 PARTY MODE 🎉', UNLOCK_ALL: '🔓 ALL CAMPAIGNS UNLOCKED' } : {}),

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'KLICKEN ZUM STARTEN',

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
    HELI_SELECT_CONFIRM: 'AUSWÄHLEN',
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
    CRASH_TOWER: 'TOWER-KOLLISION',
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
    PAUSE_TITLE: '— PAUSE —',
    PAUSE_RESUME: '▶ WEITER',
    PAUSE_ABORT: '✕ ABBRUCH',
    LANGUAGE_HEADING: 'SPRACHE',
    TUT_ENGINE_D: 'MOTOR STARTEN — DRÜCKE [W]',
    TUT_ENGINE_M: 'MOTOR STARTEN — LINKEN STICK NACH OBEN',
    TUT_CLIMB_D: 'AUFSTEIGEN — MINDESTENS 5 METER HÖHE ERREICHEN',
    TUT_CLIMB_M: 'AUFSTEIGEN — LINKEN STICK HOCHHALTEN',
    TUT_STRAFE_D: 'GLEITEN — MIT [A] UND [D] SEITWÄRTS BEWEGEN',
    TUT_STRAFE_M: 'GLEITEN — LINKEN STICK NACH LINKS ODER RECHTS',
    TUT_STEER_H_D: 'STEUERN — [←][→] DREHEN, [↑][↓] BESCHLEUNIGEN',
    TUT_STEER_H_M: 'VEREINFACHT — STICK IN RICHTUNG DES HELIKOPTERS DRÜCKEN',
    TUT_STEER_S_D: 'STEUERN — [←][→] DREHEN, [↑][↓] BESCHLEUNIGEN',
    TUT_STEER_S_M: 'PROFI — STICK HOCH = VORWÄRTS, LINKS/RECHTS = DREHEN',
    TUT_LAND_D: 'TANK FAST LEER — ZURÜCK ZUM LANDEPLATZ UND LANDEN [S]',
    TUT_LAND_M: 'TANK FAST LEER — ZURÜCK ZUM LANDEPLATZ UND LANDEN',
    TUT_REFUEL: 'WARTEN — TANKWAGEN BETANKT DEN HELIKOPTER',
    TUT_LOCATE_PERSON: 'PERSON SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_WINCH_DOWN_D: 'WINDE ABSENKEN — [E] DRÜCKEN UND ÜBER PERSON SCHWEBEN',
    TUT_WINCH_DOWN_M: 'WINDE ABSENKEN — PITCH-RAD NACH UNTEN DREHEN',
    TUT_WINCH_UP_D: 'EINWINSCHEN — [Q] DRÜCKEN',
    TUT_WINCH_UP_M: 'EINWINSCHEN — PITCH-RAD NACH OBEN DREHEN',
    TUT_DELIVER_PERSON_D: 'ABSETZEN — DELIVER-TOGGLE ODER [LEERTASTE]',
    TUT_DELIVER_PERSON_M: 'ABSETZEN — DELIVER-TOGGLE BETÄTIGEN',
    TUT_LOCATE_CRATE: 'KISTE SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_DELIVER_CRATE_D: 'KISTE ABSETZEN — DELIVER-TOGGLE ODER [LEERTASTE]',
    TUT_DELIVER_CRATE_M: 'KISTE ABSETZEN — DELIVER-TOGGLE BETÄTIGEN',
    TUT_DONE: 'TUTORIAL ABGESCHLOSSEN — VIEL ERFOLG!',
    CAMPAIGN_SWITCH_PROGRESS_WARN: 'Der Fortschritt der aktiven Kampagne wird gelöscht.',
    RANKUP_HELI_UNLOCK: 'NEUES LUFTFAHRZEUG FREIGESCHALTET',
    RANKUP_TITLE: 'Beförderung',

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
    ...(_IS_APP
        ? {
              LEGAL_DATENSCHUTZ: [
                  'SAR: Callsign WOLF speichert folgende Daten lokal auf deinem Gerät:',
                  '▸ Rufzeichen  ▸ Dienstgrad  ▸ Kampagnenfortschritt  ▸ Spracheinstellung',
                  'Die Daten werden ausschließlich zur Spielfunktion genutzt und nicht an Dritte weitergegeben. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.',
                  'Gespeicherte Daten können jederzeit über Hauptmenü → Einstellungen → Spielstand löschen gelöscht werden.',
                  'Die Steuerungseinstellung wird ebenfalls lokal gespeichert (rein technische Geräteeinstellung, kein Personenbezug).',
                  'Kontakt für Datenschutzanfragen: yarrick@web.de',
              ],
          }
        : {
              LEGAL_DATENSCHUTZ: [
                  'SAR: Callsign WOLF speichert folgende Daten ausschließlich lokal in deinem Browser (localStorage) – und nur mit deiner Einwilligung:',
                  '▸ Rufzeichen  ▸ Dienstgrad  ▸ Kampagnenfortschritt  ▸ Einwilligungsstatus  ▸ Spracheinstellung',
                  'Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Gespeicherte Daten können jederzeit über Hauptmenü → Einstellungen → Spielstand löschen gelöscht werden.',
                  'Die Steuerungseinstellung wird unabhängig von der Einwilligung immer lokal gespeichert (rein technische Geräteeinstellung, kein Personenbezug).',
                  'Es findet keine Weitergabe von Daten an Dritte statt.',
                  'Kontakt für Datenschutzanfragen: yarrick@web.de',
              ],
              LEGAL_DATENSCHUTZ_WEB: 'Beim Aufbau einer Multiplayer-Verbindung werden zur Vermittlung der Peer-to-Peer-Verbindung Google STUN-Server (stun.l.google.com) kontaktiert. Dabei wird deine IP-Adresse übermittelt – ausschließlich auf deine Veranlassung und nur für die Dauer des Verbindungsaufbaus. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.',
          }),

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

    ...(!_IS_APP ? { PARTY_ON: '🎉 PARTY MODE 🎉', UNLOCK_ALL: '🔓 ALL CAMPAIGNS UNLOCKED' } : {}),

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'CLICK TO START',

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
    HELI_SELECT_CONFIRM: 'SELECT',
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
    CRASH_TOWER: 'TOWER COLLISION',
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
    PAUSE_TITLE: '— PAUSED —',
    PAUSE_RESUME: '▶ RESUME',
    PAUSE_ABORT: '✕ ABORT',
    TUT_ENGINE_D: 'START ENGINE — PRESS [W]',
    TUT_ENGINE_M: 'START ENGINE — PUSH LEFT STICK UP',
    TUT_CLIMB_D: 'CLIMB — REACH AT LEAST 5 METRES',
    TUT_CLIMB_M: 'CLIMB — HOLD LEFT STICK UP',
    TUT_STRAFE_D: 'STRAFE — MOVE SIDEWAYS WITH [A] AND [D]',
    TUT_STRAFE_M: 'STRAFE — PUSH LEFT STICK LEFT OR RIGHT',
    TUT_STEER_H_D: 'STEER — [←][→] TURN, [↑][↓] ACCELERATE',
    TUT_STEER_H_M: 'SIMPLIFIED — PUSH STICK IN HELI DIRECTION',
    TUT_STEER_S_D: 'STEER — [←][→] TURN, [↑][↓] ACCELERATE',
    TUT_STEER_S_M: 'PROFESSIONAL — STICK UP = FORWARD, LEFT/RIGHT = TURN',
    TUT_LAND_D: 'LOW FUEL — RETURN TO PAD AND LAND [S]',
    TUT_LAND_M: 'LOW FUEL — RETURN TO PAD AND LAND',
    TUT_REFUEL: 'WAIT — FUEL TRUCK IS REFUELLING THE HELICOPTER',
    TUT_LOCATE_PERSON: 'LOCATE SURVIVOR — USE MINIMAP AND APPROACH',
    TUT_WINCH_DOWN_D: 'LOWER WINCH — PRESS [E] AND HOVER OVER SURVIVOR',
    TUT_WINCH_DOWN_M: 'LOWER WINCH — ROLL PITCH WHEEL DOWN',
    TUT_WINCH_UP_D: 'RAISE WINCH — PRESS [Q]',
    TUT_WINCH_UP_M: 'RAISE WINCH — ROLL PITCH WHEEL UP',
    TUT_DELIVER_PERSON_D: 'SET DOWN — DELIVER TOGGLE OR [SPACE]',
    TUT_DELIVER_PERSON_M: 'SET DOWN — USE DELIVER TOGGLE',
    TUT_LOCATE_CRATE: 'FIND CRATE — USE MINIMAP AND APPROACH',
    TUT_DELIVER_CRATE_D: 'RELEASE CRATE — DELIVER TOGGLE OR [SPACE]',
    TUT_DELIVER_CRATE_M: 'RELEASE CRATE — USE DELIVER TOGGLE',
    TUT_DONE: 'TUTORIAL COMPLETE — GOOD LUCK!',
    LANGUAGE_HEADING: 'LANGUAGE',
    CAMPAIGN_SWITCH_PROGRESS_WARN: 'Progress of the active campaign will be deleted.',
    RANKUP_HELI_UNLOCK: 'NEW AIRCRAFT UNLOCKED',
    RANKUP_TITLE: 'Promotion',

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
    ...(_IS_APP
        ? {
              LEGAL_DATENSCHUTZ: [
                  'SAR: Callsign WOLF stores the following data locally on your device:',
                  '▸ Callsign  ▸ Rank  ▸ Campaign progress  ▸ Language setting',
                  'Data is used exclusively for game functionality and is not shared with third parties. Legal basis: Art. 6 para. 1 lit. b GDPR.',
                  'Stored data can be deleted at any time via Main Menu → Settings → Delete Save.',
                  'The control setting is also stored locally (purely technical device setting, no personal data).',
                  'Privacy contact: yarrick@web.de',
              ],
          }
        : {
              LEGAL_DATENSCHUTZ: [
                  'SAR: Callsign WOLF stores the following data exclusively locally in your browser (localStorage) – and only with your consent:',
                  '▸ Callsign  ▸ Rank  ▸ Campaign progress  ▸ Consent status  ▸ Language setting',
                  'Legal basis: Art. 6 para. 1 lit. a GDPR (consent). Stored data can be deleted at any time via Main Menu → Settings → Delete Save.',
                  'The control setting is always stored locally regardless of consent (purely technical device setting, no personal data).',
                  'No data is shared with third parties.',
                  'Privacy contact: yarrick@web.de',
              ],
              LEGAL_DATENSCHUTZ_WEB: 'When establishing a multiplayer connection, Google STUN servers (stun.l.google.com) are contacted to broker the peer-to-peer connection. Your IP address is transmitted – solely at your initiative and only for the duration of the connection setup. Legal basis: Art. 6 para. 1 lit. b GDPR.',
          }),

    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — All rights reserved.',

    CREDITS_ROLE_DEVELOPMENT: 'GAME DESIGN & DEVELOPMENT',
    CREDITS_ROLE_CAMPAIGN: 'CAMPAIGN DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIC',
    CREDITS_ROLE_TEST: 'TESTERS',
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
