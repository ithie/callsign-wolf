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

const _DATENSCHUTZ_FR = [
    'SAR : Callsign WOLF stocke les données suivantes localement sur votre appareil :',
    '▸ Indicatif  ▸ Grade  ▸ Progression  ▸ Langue  ▸ Paramètre de contrôle',
    'Les données sont utilisées exclusivement pour le fonctionnement du jeu et ne sont pas partagées avec des tiers. Base légale : Art. 6 par. 1 lit. b RGPD.',
    'Les données stockées peuvent être supprimées à tout moment via Menu Principal → Paramètres → Supprimer la sauvegarde.',
    'Contact confidentialité : yarrick@web.de',
] as const;

const _DATENSCHUTZ_ES = [
    'SAR: Callsign WOLF almacena los siguientes datos localmente en tu dispositivo:',
    '▸ Indicativo  ▸ Rango  ▸ Progreso  ▸ Idioma  ▸ Configuración de control',
    'Los datos se utilizan exclusivamente para la funcionalidad del juego y no se comparten con terceros. Base legal: Art. 6 apdo. 1 lit. b RGPD.',
    'Los datos almacenados pueden eliminarse en cualquier momento desde Menú Principal → Ajustes → Borrar guardado.',
    'Contacto de privacidad: yarrick@web.de',
] as const;

const _DATENSCHUTZ_PT = [
    'SAR: Callsign WOLF armazena os seguintes dados localmente no seu dispositivo:',
    '▸ Indicativo  ▸ Patente  ▸ Progresso  ▸ Idioma  ▸ Configuração de controlo',
    'Os dados são utilizados exclusivamente para a funcionalidade do jogo e não são partilhados com terceiros. Base legal: Art. 6.º, n.º 1, al. b) RGPD.',
    'Os dados armazenados podem ser eliminados a qualquer momento em Menu Principal → Configurações → Apagar Save.',
    'Contacto de privacidade: yarrick@web.de',
] as const;

/** App-version privacy text — used by the ?imprint page (App Store link) for both DE and EN. */
export const LEGAL_DATENSCHUTZ_IMPRINT = { de: _DATENSCHUTZ_DE, en: _DATENSCHUTZ_EN };

import { storageGet, storageSet } from './storage';

export type Lang = 'de' | 'en' | 'fr' | 'es' | 'pt';

const _detectLang = (): Lang => {
    try {
        const stored = storageGet(LANG_PREF_KEY);
        if (stored === 'de' || stored === 'en' || stored === 'fr' || stored === 'es' || stored === 'pt') return stored;
        const nav = navigator.language?.toLowerCase() ?? '';
        if (nav.startsWith('de')) return 'de';
        if (nav.startsWith('fr')) return 'fr';
        if (nav.startsWith('es')) return 'es';
        if (nav.startsWith('pt')) return 'pt';
        return 'en';
    } catch {
        return 'de';
    }
};

const _DE = {
    DONE: 'abgeschlossen',

    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'KLICKEN ZUM STARTEN',

    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_START: 'SPIEL STARTEN',
    MENU_HELI: 'HELIKOPTER',
    MENU_SETTINGS: 'EINSTELLUNGEN',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Weiter',
    BACK: 'ZURÜCK',
    ACKNOWLEDGE: 'VERSTANDEN',
    RETRY: 'NOCHMAL',
    NEXT_MISSION: 'NÄCHSTE MISSION',
    TO_MISSION_SELECT: 'ZUR MISSIONSAUSWAHL',
    TO_CAMPAIGN_SELECT: 'ZUR KAMPAGNENAUSWAHL',

    CAMPAIGN_SELECT_TITLE: 'KAMPAGNE WÄHLEN',
    CAMPAIGN_SELECT_MISSIONS: 'Missionen',

    MISSION_LOCKED: '[ GESPERRT ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `BESTZEIT: ${min}:${sec.padStart(4, '0')}`;
    },

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_CONFIRM: 'AUSWÄHLEN',
    HELI_LOCKED_FROM: (rank: string) => `ab ${rank}`,
    HELI_TYPE_RATING_REQUIRED: 'MUSTERZULASSUNG ERFORDERLICH',
    HELI_STAT_SPEED: 'GESCHW.',
    HELI_STAT_AGILITY: 'AGILITÄT',
    HELI_STAT_CAPACITY: 'KAPAZITÄT',
    HELI_STAT_ENDURANCE: 'AUSDAUER',
    LOADING_READY: 'Bereit.',

    MISSION_COMPLETE: 'MISSION GESCHAFFT',
    OBJECTIVES_CLEARED: 'ALLE ZIELE ERFÜLLT',
    TYPE_RATING_GRANTED: 'MUSTERZULASSUNG ERTEILT',
    TYPE_RATING_FAILED: 'MUSTERZULASSUNG NICHT ERTEILT',
    TYPE_RATING_UNLOCKED: (label: string) => `★ MUSTERZULASSUNG ${label.toUpperCase()} FREIGESCHALTET`,
    MISSION_FAILED: 'MISSION GESCHEITERT',
    CAMPAIGN_COMPLETE: 'KAMPAGNE GESCHAFFT',
    ALL_MISSIONS_CLEARED: 'ALLE MISSIONEN ABGESCHLOSSEN',

    CLICK_TO_DEPLOY: 'KLICKEN ZUM EINSATZ',

    RANK_NAME: (key: string): string =>
        (
            ({ leutnant: 'Leutnant', oberleutnant: 'Oberleutnant', hauptmann: 'Hauptmann', major: 'Major' }) as Record<
                string,
                string
            >
        )[key] ?? key,

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Ihre Mission, ${rank} ${callsign || 'WOLF'}`,
    RANKUP_DECREE: (fromRank: string, toRank: string, callsign: string) =>
        `${fromRank} ${callsign || 'WOLF'}!\nHiermit befördere ich Sie zum ${toRank.toUpperCase()}.`,

    SAVE_CODE_INVALID: 'UNGÜLTIGER CODE',
    SAVE_CODE_LOADED: 'SPIELSTAND GELADEN',
    STATS: (c: number, m: number) => `KAMPAGNEN: ${c}  |  MISSIONEN: ${m}`,
    CAMPAIGN_LOCKED: '[ GESPERRT ]',

    DELETE_SESSION: 'SPIELSTAND LÖSCHEN',
    DELETE_CONFIRM: 'WIRKLICH LÖSCHEN?',
    SESSION_DELETED: 'GELÖSCHT.',

    DELIVER_MODE_ON: 'ABSETZ-MODUS — [R] ABBRECHEN',
    DELIVER_MODE_OFF: '',

    PILOT_CALLSIGN: 'RUFZEICHEN (MAX. 8 ZEICHEN, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'CODE IMPORTIEREN (ÜBERSCHREIBT SPIELSTAND)',
    PILOT_IMPORTLOAD: 'LADEN',
    MUSIC_HEADING: 'MUSIK',
    SFX_HEADING: 'SOUND-EFFEKTE',
    AUDIO_ON: 'AN',
    AUDIO_OFF: 'AUS',
    PAUSE_TITLE: '— PAUSE —',
    PAUSE_RESUME: 'WEITER',
    PAUSE_ABORT: '✕ ABBRUCH',
    LANGUAGE_HEADING: 'SPRACHE',
    TUT_TAKEOFF_M: 'STARTEN & AUFSTEIGEN — LINKEN STICK NACH OBEN HALTEN',
    TUT_TURN_L_M: 'DREHEN LINKS — LINKEN STICK NACH LINKS',
    TUT_TURN_R_M: 'DREHEN RECHTS — LINKEN STICK NACH RECHTS',
    TUT_STRAFE_L_M: 'GLEITEN LINKS — RECHTEN STICK NACH LINKS',
    TUT_STRAFE_R_M: 'GLEITEN RECHTS — RECHTEN STICK NACH RECHTS',
    TUT_FORWARD_M: 'VORWÄRTS — RECHTEN STICK NACH OBEN',
    TUT_BACKWARD_M: 'RÜCKWÄRTS — RECHTEN STICK NACH UNTEN',
    TUT_LAND_M: 'TANK FAST LEER — LINKEN STICK NACH UNTEN ZUM LANDEN',
    TUT_ENGINE_STOP: 'MOTOR STOPPEN — LINKEN STICK NOCHMAL NACH UNTEN DRÜCKEN',
    TUT_REFUEL: 'WARTEN — TANKWAGEN BETANKT DEN HELIKOPTER',
    TUT_REFUEL_2: 'ZUERST AUFTANKEN — LANDEN, MOTOR AUS, WARTEN',
    TUT_LOCATE_CRATE: 'KISTE SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_CRATE_PICKUP_M: 'KISTE AUFNEHMEN — PITCH-RAD NACH UNTEN, ÜBER KISTE SCHWEBEN',
    TUT_CRATE_TO_PAD_M: 'KISTE ZUM LANDEPLATZ BRINGEN UND DORT ABSENKEN',
    TUT_LOCATE_PERSON: 'PERSON SUCHEN — MINIMAP NUTZEN UND ANNÄHERN',
    TUT_PERSON_PICKUP_M: 'PERSON AUFNEHMEN — PITCH-RAD NACH UNTEN, DANN NACH OBEN',
    TUT_PERSON_TO_PAD_M: 'MIT PATIENT ZUM LANDEPLATZ FLIEGEN UND LANDEN',
    TUT_TAKEOFF_K: 'STARTEN & AUFSTEIGEN — W GEDRÜCKT HALTEN',
    TUT_TURN_L_K: 'DREHEN LINKS — PFEILTASTE LINKS',
    TUT_TURN_R_K: 'DREHEN RECHTS — PFEILTASTE RECHTS',
    TUT_STRAFE_L_K: 'GLEITEN LINKS — TASTE A',
    TUT_STRAFE_R_K: 'GLEITEN RECHTS — TASTE D',
    TUT_FORWARD_K: 'VORWÄRTS — PFEILTASTE HOCH',
    TUT_BACKWARD_K: 'RÜCKWÄRTS — PFEILTASTE RUNTER',
    TUT_LAND_K: 'TANK FAST LEER — TASTE S ZUM LANDEN',
    TUT_ENGINE_STOP_K: 'MOTOR STOPPEN — TASTE S NOCHMAL DRÜCKEN',
    TUT_CRATE_PICKUP_K: 'KISTE AUFNEHMEN — E DRÜCKEN, ÜBER KISTE SCHWEBEN',
    TUT_CRATE_TO_PAD_K: 'KISTE ZUM LANDEPLATZ BRINGEN — E ZUM ABSENKEN',
    TUT_PERSON_PICKUP_K: 'PERSON AUFNEHMEN — E DRÜCKEN, DANN Q',
    TUT_PERSON_TO_PAD_K: 'MIT PATIENT ZUM LANDEPLATZ FLIEGEN UND LANDEN',
    TUT_DONE: 'TUTORIAL ABGESCHLOSSEN — VIEL ERFOLG!',
    TRAINING_REQUIRED: 'MUSTERZULASSUNG ERFORDERLICH',
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
        '53332 Bornheim',
        'Deutschland',
        '',
        'Kontakt',
        'E-Mail: yarrick@web.de',
        '',
        'Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV:',
        'Michael Draws-Beer – Anschrift wie oben',
        '',
        'Ust.ID: DE463616899',
        'Kleinunternehmer gemäß § 19 UStG - keine Umsatzsteuer wird ausgewiesen',
    ],
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_DE,

    HELI_COLOR_ORANGE: 'ORANGE',
    HELI_COLOR_BLUE: 'BLAU',
    HELI_COLOR_SAND: 'SAND',
    HELI_COLOR_GREEN: 'GRÜN',


    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Alle Rechte vorbehalten.',

    CREDITS_ROLE_DEVELOPMENT: 'SPIELDESIGN & ENTWICKLUNG',
    CREDITS_ROLE_CAMPAIGN: 'KAMPAGNEN-DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIK',
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
    MENU_START: 'START GAME',
    MENU_HELI: 'HELICOPTER',
    MENU_SETTINGS: 'SETTINGS',
    MENU_CREDITS: 'CREDITS',

    NEXT: 'Continue',
    BACK: 'BACK',
    ACKNOWLEDGE: 'ACKNOWLEDGED',
    RETRY: 'RETRY',
    NEXT_MISSION: 'NEXT MISSION',
    TO_MISSION_SELECT: 'MISSION SELECT',
    TO_CAMPAIGN_SELECT: 'CAMPAIGN SELECT',

    CAMPAIGN_SELECT_TITLE: 'SELECT CAMPAIGN',
    CAMPAIGN_SELECT_MISSIONS: 'Missions',

    MISSION_LOCKED: '[ LOCKED ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `BEST TIME: ${min}:${sec.padStart(4, '0')}`;
    },

    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_CONFIRM: 'SELECT',
    HELI_LOCKED_FROM: (rank: string) => `from ${rank}`,
    HELI_TYPE_RATING_REQUIRED: 'TYPE RATING REQUIRED',
    HELI_STAT_SPEED: 'SPEED',
    HELI_STAT_AGILITY: 'AGILITY',
    HELI_STAT_CAPACITY: 'CAPACITY',
    HELI_STAT_ENDURANCE: 'ENDURANCE',
    LOADING_READY: 'Ready.',

    MISSION_COMPLETE: 'MISSION COMPLETE',
    OBJECTIVES_CLEARED: 'ALL OBJECTIVES CLEARED',
    TYPE_RATING_GRANTED: 'TYPE RATING GRANTED',
    TYPE_RATING_FAILED: 'TYPE RATING NOT GRANTED',
    TYPE_RATING_UNLOCKED: (label: string) => `★ ${label.toUpperCase()} TYPE RATING UNLOCKED`,
    MISSION_FAILED: 'MISSION FAILED',
    CAMPAIGN_COMPLETE: 'CAMPAIGN COMPLETE',
    ALL_MISSIONS_CLEARED: 'ALL MISSIONS CLEARED',

    CLICK_TO_DEPLOY: 'CLICK TO DEPLOY',

    RANK_NAME: (key: string): string =>
        (
            ({
                leutnant: 'Lieutenant',
                oberleutnant: '1st Lieutenant',
                hauptmann: 'Captain',
                major: 'Major',
            }) as Record<string, string>
        )[key] ?? key,

    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Your mission, ${rank} ${callsign || 'WOLF'}`,
    RANKUP_DECREE: (fromRank: string, toRank: string, callsign: string) =>
        `${fromRank} ${callsign || 'WOLF'}!\nI hereby promote you to ${toRank.toUpperCase()}.`,

    SAVE_CODE_INVALID: 'INVALID CODE',
    SAVE_CODE_LOADED: 'SAVE LOADED',
    STATS: (c: number, m: number) => `CAMPAIGNS: ${c}  |  MISSIONS: ${m}`,
    CAMPAIGN_LOCKED: '[ LOCKED ]',

    DELETE_SESSION: 'DELETE SAVE',
    DELETE_CONFIRM: 'REALLY DELETE?',
    SESSION_DELETED: 'DELETED.',

    DELIVER_MODE_ON: 'DEPLOY MODE — [R] CANCEL',
    DELIVER_MODE_OFF: '',

    PILOT_CALLSIGN: 'CALLSIGN (MAX. 8 CHARS, A–Z)',
    PILOT_SAVECODE: 'SAVE CODE',
    PILOT_IMPORT: 'IMPORT CODE (OVERWRITES SAVE)',
    PILOT_IMPORTLOAD: 'LOAD',
    MUSIC_HEADING: 'MUSIC',
    SFX_HEADING: 'SOUND EFFECTS',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    PAUSE_TITLE: '— PAUSED —',
    PAUSE_RESUME: 'RESUME',
    PAUSE_ABORT: '✕ ABORT',
    TUT_TAKEOFF_M: 'START & CLIMB — HOLD LEFT STICK UP',
    TUT_TURN_L_M: 'TURN LEFT — LEFT STICK LEFT',
    TUT_TURN_R_M: 'TURN RIGHT — LEFT STICK RIGHT',
    TUT_STRAFE_L_M: 'STRAFE LEFT — RIGHT STICK LEFT',
    TUT_STRAFE_R_M: 'STRAFE RIGHT — RIGHT STICK RIGHT',
    TUT_FORWARD_M: 'FORWARD — RIGHT STICK UP',
    TUT_BACKWARD_M: 'BACKWARD — RIGHT STICK DOWN',
    TUT_LAND_M: 'LOW FUEL — LEFT STICK DOWN TO LAND',
    TUT_ENGINE_STOP: 'STOP ENGINE — PUSH LEFT STICK DOWN AGAIN',
    TUT_REFUEL: 'WAIT — FUEL TRUCK IS REFUELLING THE HELICOPTER',
    TUT_REFUEL_2: 'REFUEL FIRST — LAND, STOP ENGINE, WAIT',
    TUT_LOCATE_CRATE: 'FIND CRATE — USE MINIMAP AND APPROACH',
    TUT_CRATE_PICKUP_M: 'PICK UP CRATE — PITCH WHEEL DOWN, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_M: 'BRING CRATE TO LANDING PAD AND LOWER IT THERE',
    TUT_LOCATE_PERSON: 'LOCATE SURVIVOR — USE MINIMAP AND APPROACH',
    TUT_PERSON_PICKUP_M: 'RESCUE SURVIVOR — PITCH WHEEL DOWN, THEN UP',
    TUT_PERSON_TO_PAD_M: 'FLY TO LANDING PAD WITH PATIENT AND LAND',
    TUT_TAKEOFF_K: 'START & CLIMB — HOLD W',
    TUT_TURN_L_K: 'TURN LEFT — ARROW LEFT',
    TUT_TURN_R_K: 'TURN RIGHT — ARROW RIGHT',
    TUT_STRAFE_L_K: 'STRAFE LEFT — KEY A',
    TUT_STRAFE_R_K: 'STRAFE RIGHT — KEY D',
    TUT_FORWARD_K: 'FORWARD — ARROW UP',
    TUT_BACKWARD_K: 'BACKWARD — ARROW DOWN',
    TUT_LAND_K: 'LOW FUEL — KEY S TO LAND',
    TUT_ENGINE_STOP_K: 'STOP ENGINE — PRESS S AGAIN',
    TUT_CRATE_PICKUP_K: 'PICK UP CRATE — PRESS E, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_K: 'BRING CRATE TO PAD — PRESS E TO LOWER',
    TUT_PERSON_PICKUP_K: 'RESCUE SURVIVOR — PRESS E, THEN Q',
    TUT_PERSON_TO_PAD_K: 'FLY TO PAD WITH PATIENT AND LAND',
    TUT_DONE: 'TUTORIAL COMPLETE — GOOD LUCK!',
    TRAINING_REQUIRED: 'TYPE RATING REQUIRED',
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
        '53332 Bornheim',
        'Germany',
        '',
        'Contact',
        'Email: yarrick@web.de',
        '',
        'Responsible for content (§ 18 para. 2 MStV):',
        'Michael Draws-Beer – address as above',
        '',
        'VAT ID: DE463616899',
        'Small business owner according to § 19 of the German VAT Act (UStG) - no VAT is invoiced',
    ],
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_EN,

    HELI_COLOR_ORANGE: 'ORANGE',
    HELI_COLOR_BLUE: 'BLUE',
    HELI_COLOR_SAND: 'SAND',
    HELI_COLOR_GREEN: 'GREEN',


    MADE_WITH: 'MADE WITH ♥ IN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — All rights reserved.',

    CREDITS_ROLE_DEVELOPMENT: 'GAME DESIGN & DEVELOPMENT',
    CREDITS_ROLE_CAMPAIGN: 'CAMPAIGN DESIGN',
    CREDITS_ROLE_SOUND: 'SOUND & MUSIC',
    CREDITS_ROLE_LEADERTEST: 'LEADER-TESTER',
    CREDITS_ROLE_TEST: 'TESTERS',
    CREDITS_ROLE_CONSULTGS: 'CONSULTING G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRED BY',
} as const;

const _FR = {
    DONE: 'terminé',
    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'APPUYER POUR DÉMARRER',
    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_START: 'JOUER',
    MENU_HELI: 'HÉLICOPTÈRE',
    MENU_SETTINGS: 'PARAMÈTRES',
    MENU_CREDITS: 'CRÉDITS',
    NEXT: 'Continuer',
    BACK: 'RETOUR',
    ACKNOWLEDGE: 'COMPRIS',
    RETRY: 'RÉESSAYER',
    NEXT_MISSION: 'MISSION SUIVANTE',
    TO_MISSION_SELECT: 'SÉLECTION DE MISSION',
    TO_CAMPAIGN_SELECT: 'SÉLECTION DE CAMPAGNE',
    CAMPAIGN_SELECT_TITLE: 'CHOISIR UNE CAMPAGNE',
    CAMPAIGN_SELECT_MISSIONS: 'Missions',
    MISSION_LOCKED: '[ VERROUILLÉ ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `MEILLEUR TEMPS: ${min}:${sec.padStart(4, '0')}`;
    },
    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_CONFIRM: 'SÉLECTIONNER',
    HELI_LOCKED_FROM: (rank: string) => `à partir de ${rank}`,
    HELI_TYPE_RATING_REQUIRED: 'QUALIFICATION REQUISE',
    HELI_STAT_SPEED: 'VITESSE',
    HELI_STAT_AGILITY: 'AGILITÉ',
    HELI_STAT_CAPACITY: 'CAPACITÉ',
    HELI_STAT_ENDURANCE: 'ENDURANCE',
    LOADING_READY: 'Prêt.',
    MISSION_COMPLETE: 'MISSION ACCOMPLIE',
    OBJECTIVES_CLEARED: 'TOUS LES OBJECTIFS ATTEINTS',
    TYPE_RATING_GRANTED: 'QUALIFICATION ACCORDÉE',
    TYPE_RATING_FAILED: 'QUALIFICATION NON ACCORDÉE',
    TYPE_RATING_UNLOCKED: (label: string) => `★ QUALIFICATION ${label.toUpperCase()} DÉBLOQUÉE`,
    MISSION_FAILED: 'MISSION ÉCHOUÉE',
    CAMPAIGN_COMPLETE: 'CAMPAGNE TERMINÉE',
    ALL_MISSIONS_CLEARED: 'TOUTES LES MISSIONS ACCOMPLIES',
    CLICK_TO_DEPLOY: 'APPUYER POUR DÉPLOYER',
    RANK_NAME: (key: string): string =>
        ({ leutnant: 'Lieutenant', oberleutnant: 'Premier Lieutenant', hauptmann: 'Capitaine', major: 'Commandant' } as Record<string, string>)[key] ?? key,
    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Votre mission, ${rank} ${callsign || 'WOLF'}`,
    RANKUP_DECREE: (fromRank: string, toRank: string, callsign: string) =>
        `${fromRank} ${callsign || 'WOLF'}!\nJe vous promeus au grade de ${toRank.toUpperCase()}.`,
    SAVE_CODE_INVALID: 'CODE INVALIDE',
    SAVE_CODE_LOADED: 'SAUVEGARDE CHARGÉE',
    STATS: (c: number, m: number) => `CAMPAGNES: ${c}  |  MISSIONS: ${m}`,
    CAMPAIGN_LOCKED: '[ VERROUILLÉ ]',
    DELETE_SESSION: 'SUPPRIMER LA SAUVEGARDE',
    DELETE_CONFIRM: 'VRAIMENT SUPPRIMER ?',
    SESSION_DELETED: 'SUPPRIMÉ.',
    DELIVER_MODE_ON: 'MODE DÉPLOIEMENT — [R] ANNULER',
    DELIVER_MODE_OFF: '',
    PILOT_CALLSIGN: 'INDICATIF (MAX. 8 CAR., A–Z)',
    PILOT_SAVECODE: 'CODE DE SAUVEGARDE',
    PILOT_IMPORT: 'IMPORTER LE CODE (ÉCRASE LA SAUVEGARDE)',
    PILOT_IMPORTLOAD: 'CHARGER',
    MUSIC_HEADING: 'MUSIQUE',
    SFX_HEADING: 'EFFETS SONORES',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    PAUSE_TITLE: '— PAUSE —',
    PAUSE_RESUME: 'REPRENDRE',
    PAUSE_ABORT: '✕ ABANDONNER',
    LANGUAGE_HEADING: 'LANGUE',
    TUT_TAKEOFF_M: 'DÉCOLLAGE & MONTÉE — MAINTENIR STICK GAUCHE EN HAUT',
    TUT_TURN_L_M: 'VIRER À GAUCHE — STICK GAUCHE À GAUCHE',
    TUT_TURN_R_M: 'VIRER À DROITE — STICK GAUCHE À DROITE',
    TUT_STRAFE_L_M: 'GLISSEMENT GAUCHE — STICK DROIT À GAUCHE',
    TUT_STRAFE_R_M: 'GLISSEMENT DROIT — STICK DROIT À DROITE',
    TUT_FORWARD_M: 'AVANT — STICK DROIT EN HAUT',
    TUT_BACKWARD_M: 'ARRIÈRE — STICK DROIT EN BAS',
    TUT_LAND_M: 'CARBURANT FAIBLE — STICK GAUCHE EN BAS POUR ATTERRIR',
    TUT_ENGINE_STOP: 'ARRÊTER MOTEUR — STICK GAUCHE EN BAS À NOUVEAU',
    TUT_REFUEL: 'ATTENDRE — LE CAMION RAVITAILLE L\'HÉLICOPTÈRE',
    TUT_REFUEL_2: 'REFUEL FIRST — LAND, STOP ENGINE, WAIT',
    TUT_LOCATE_CRATE: 'TROUVER LA CAISSE — MINIMAP ET APPROCHER',
    TUT_CRATE_PICKUP_M: 'SOULEVER LA CAISSE — MOLETTE EN BAS, SURVOLER LA CAISSE',
    TUT_CRATE_TO_PAD_M: 'APPORTER LA CAISSE AU PAD ET L\'ABAISSER',
    TUT_LOCATE_PERSON: 'LOCALISER LE SURVIVANT — MINIMAP ET APPROCHER',
    TUT_PERSON_PICKUP_M: 'SAUVER LE SURVIVANT — MOLETTE EN BAS, PUIS EN HAUT',
    TUT_PERSON_TO_PAD_M: 'VOLER AU PAD AVEC LE PATIENT ET ATTERRIR',
    TUT_TAKEOFF_K: 'START & CLIMB — HOLD W',
    TUT_TURN_L_K: 'TURN LEFT — ARROW LEFT',
    TUT_TURN_R_K: 'TURN RIGHT — ARROW RIGHT',
    TUT_STRAFE_L_K: 'STRAFE LEFT — KEY A',
    TUT_STRAFE_R_K: 'STRAFE RIGHT — KEY D',
    TUT_FORWARD_K: 'FORWARD — ARROW UP',
    TUT_BACKWARD_K: 'BACKWARD — ARROW DOWN',
    TUT_LAND_K: 'LOW FUEL — KEY S TO LAND',
    TUT_ENGINE_STOP_K: 'STOP ENGINE — PRESS S AGAIN',
    TUT_CRATE_PICKUP_K: 'PICK UP CRATE — PRESS E, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_K: 'BRING CRATE TO PAD — PRESS E TO LOWER',
    TUT_PERSON_PICKUP_K: 'RESCUE SURVIVOR — PRESS E, THEN Q',
    TUT_PERSON_TO_PAD_K: 'FLY TO PAD WITH PATIENT AND LAND',
    TUT_DONE: 'TUTORIEL TERMINÉ — BONNE CHANCE !',
    TRAINING_REQUIRED: 'QUALIFICATION REQUISE',
    NOT_UNLOCKED: 'NON DÉBLOQUÉ',
    MENU_LEGAL: 'MENTIONS LÉGALES',
    LEGAL_TITLE: 'MENTIONS LÉGALES',
    LEGAL_IMPRESSUM_HEADING: 'MENTIONS LÉGALES',
    LEGAL_DATENSCHUTZ_HEADING: 'POLITIQUE DE CONFIDENTIALITÉ',
    LEGAL_IMPRESSUM: _EN.LEGAL_IMPRESSUM,
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_FR,
    HELI_COLOR_ORANGE: 'ORANGE',
    HELI_COLOR_BLUE: 'BLEU',
    HELI_COLOR_SAND: 'SABLE',
    HELI_COLOR_GREEN: 'VERT',


    MADE_WITH: 'FAIT AVEC ♥ EN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Tous droits réservés.',
    CREDITS_ROLE_DEVELOPMENT: 'CONCEPTION & DÉVELOPPEMENT',
    CREDITS_ROLE_CAMPAIGN: 'CONCEPTION DE CAMPAGNE',
    CREDITS_ROLE_SOUND: 'SON & MUSIQUE',
    CREDITS_ROLE_LEADERTEST: 'TESTEUR EN CHEF',
    CREDITS_ROLE_TEST: 'TESTEURS',
    CREDITS_ROLE_CONSULTGS: 'CONSEIL G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRÉ PAR',
} as const;

const _ES = {
    DONE: 'completado',
    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'TOCA PARA EMPEZAR',
    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_START: 'INICIAR JUEGO',
    MENU_HELI: 'HELICÓPTERO',
    MENU_SETTINGS: 'AJUSTES',
    MENU_CREDITS: 'CRÉDITOS',
    NEXT: 'Continuar',
    BACK: 'VOLVER',
    ACKNOWLEDGE: 'ENTENDIDO',
    RETRY: 'REINTENTAR',
    NEXT_MISSION: 'SIGUIENTE MISIÓN',
    TO_MISSION_SELECT: 'SELECCIÓN DE MISIÓN',
    TO_CAMPAIGN_SELECT: 'SELECCIÓN DE CAMPAÑA',
    CAMPAIGN_SELECT_TITLE: 'ELEGIR CAMPAÑA',
    CAMPAIGN_SELECT_MISSIONS: 'Misiones',
    MISSION_LOCKED: '[ BLOQUEADO ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `MEJOR TIEMPO: ${min}:${sec.padStart(4, '0')}`;
    },
    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_CONFIRM: 'SELECCIONAR',
    HELI_LOCKED_FROM: (rank: string) => `desde ${rank}`,
    HELI_TYPE_RATING_REQUIRED: 'HABILITACIÓN REQUERIDA',
    HELI_STAT_SPEED: 'VELOCIDAD',
    HELI_STAT_AGILITY: 'AGILIDAD',
    HELI_STAT_CAPACITY: 'CAPACIDAD',
    HELI_STAT_ENDURANCE: 'RESISTENCIA',
    LOADING_READY: 'Listo.',
    MISSION_COMPLETE: 'MISIÓN CUMPLIDA',
    OBJECTIVES_CLEARED: 'TODOS LOS OBJETIVOS CUMPLIDOS',
    TYPE_RATING_GRANTED: 'HABILITACIÓN CONCEDIDA',
    TYPE_RATING_FAILED: 'HABILITACIÓN NO CONCEDIDA',
    TYPE_RATING_UNLOCKED: (label: string) => `★ HABILITACIÓN ${label.toUpperCase()} DESBLOQUEADA`,
    MISSION_FAILED: 'MISIÓN FALLIDA',
    CAMPAIGN_COMPLETE: 'CAMPAÑA COMPLETADA',
    ALL_MISSIONS_CLEARED: 'TODAS LAS MISIONES COMPLETADAS',
    CLICK_TO_DEPLOY: 'TOCA PARA DESPLEGAR',
    RANK_NAME: (key: string): string =>
        ({ leutnant: 'Teniente', oberleutnant: 'Primer Teniente', hauptmann: 'Capitán', major: 'Mayor' } as Record<string, string>)[key] ?? key,
    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Tu misión, ${rank} ${callsign || 'WOLF'}`,
    RANKUP_DECREE: (fromRank: string, toRank: string, callsign: string) =>
        `${fromRank} ${callsign || 'WOLF'}!\nPor la presente te asciendo a ${toRank.toUpperCase()}.`,
    SAVE_CODE_INVALID: 'CÓDIGO INVÁLIDO',
    SAVE_CODE_LOADED: 'GUARDADO CARGADO',
    STATS: (c: number, m: number) => `CAMPAÑAS: ${c}  |  MISIONES: ${m}`,
    CAMPAIGN_LOCKED: '[ BLOQUEADO ]',
    DELETE_SESSION: 'BORRAR GUARDADO',
    DELETE_CONFIRM: '¿REALMENTE BORRAR?',
    SESSION_DELETED: 'BORRADO.',
    DELIVER_MODE_ON: 'MODO DESPLIEGUE — [R] CANCELAR',
    DELIVER_MODE_OFF: '',
    PILOT_CALLSIGN: 'INDICATIVO (MÁX. 8 CHARS, A–Z)',
    PILOT_SAVECODE: 'CÓDIGO DE GUARDADO',
    PILOT_IMPORT: 'IMPORTAR CÓDIGO (SOBRESCRIBE GUARDADO)',
    PILOT_IMPORTLOAD: 'CARGAR',
    MUSIC_HEADING: 'MÚSICA',
    SFX_HEADING: 'EFECTOS DE SONIDO',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    PAUSE_TITLE: '— PAUSA —',
    PAUSE_RESUME: 'CONTINUAR',
    PAUSE_ABORT: '✕ ABANDONAR',
    LANGUAGE_HEADING: 'IDIOMA',
    TUT_TAKEOFF_M: 'DESPEGUE Y ASCENSO — MANTENER STICK IZQUIERDO ARRIBA',
    TUT_TURN_L_M: 'GIRAR A LA IZQUIERDA — STICK IZQUIERDO A LA IZQUIERDA',
    TUT_TURN_R_M: 'GIRAR A LA DERECHA — STICK IZQUIERDO A LA DERECHA',
    TUT_STRAFE_L_M: 'DESLIZAR A LA IZQUIERDA — STICK DERECHO A LA IZQUIERDA',
    TUT_STRAFE_R_M: 'DESLIZAR A LA DERECHA — STICK DERECHO A LA DERECHA',
    TUT_FORWARD_M: 'ADELANTE — STICK DERECHO ARRIBA',
    TUT_BACKWARD_M: 'ATRÁS — STICK DERECHO ABAJO',
    TUT_LAND_M: 'COMBUSTIBLE BAJO — STICK IZQUIERDO ABAJO PARA ATERRIZAR',
    TUT_ENGINE_STOP: 'PARAR MOTOR — STICK IZQUIERDO ABAJO DE NUEVO',
    TUT_REFUEL: 'ESPERAR — EL CAMIÓN REABASTECE EL HELICÓPTERO',
    TUT_REFUEL_2: 'REFUEL FIRST — LAND, STOP ENGINE, WAIT',
    TUT_LOCATE_CRATE: 'BUSCAR CAJA — USAR MINIMAPA Y ACERCARSE',
    TUT_CRATE_PICKUP_M: 'RECOGER CAJA — RUEDA ABAJO, FLOTAR SOBRE LA CAJA',
    TUT_CRATE_TO_PAD_M: 'LLEVAR LA CAJA AL HELIPUERTO Y BAJARLA',
    TUT_LOCATE_PERSON: 'LOCALIZAR SUPERVIVIENTE — USAR MINIMAPA Y ACERCARSE',
    TUT_PERSON_PICKUP_M: 'RESCATAR SUPERVIVIENTE — RUEDA ABAJO, LUEGO ARRIBA',
    TUT_PERSON_TO_PAD_M: 'VOLAR AL HELIPUERTO CON EL PACIENTE Y ATERRIZAR',
    TUT_TAKEOFF_K: 'START & CLIMB — HOLD W',
    TUT_TURN_L_K: 'TURN LEFT — ARROW LEFT',
    TUT_TURN_R_K: 'TURN RIGHT — ARROW RIGHT',
    TUT_STRAFE_L_K: 'STRAFE LEFT — KEY A',
    TUT_STRAFE_R_K: 'STRAFE RIGHT — KEY D',
    TUT_FORWARD_K: 'FORWARD — ARROW UP',
    TUT_BACKWARD_K: 'BACKWARD — ARROW DOWN',
    TUT_LAND_K: 'LOW FUEL — KEY S TO LAND',
    TUT_ENGINE_STOP_K: 'STOP ENGINE — PRESS S AGAIN',
    TUT_CRATE_PICKUP_K: 'PICK UP CRATE — PRESS E, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_K: 'BRING CRATE TO PAD — PRESS E TO LOWER',
    TUT_PERSON_PICKUP_K: 'RESCUE SURVIVOR — PRESS E, THEN Q',
    TUT_PERSON_TO_PAD_K: 'FLY TO PAD WITH PATIENT AND LAND',
    TUT_DONE: 'TUTORIAL COMPLETADO — ¡BUENA SUERTE!',
    TRAINING_REQUIRED: 'HABILITACIÓN REQUERIDA',
    NOT_UNLOCKED: 'NO DESBLOQUEADO',
    MENU_LEGAL: 'AVISO LEGAL',
    LEGAL_TITLE: 'AVISO LEGAL',
    LEGAL_IMPRESSUM_HEADING: 'INFORMACIÓN LEGAL',
    LEGAL_DATENSCHUTZ_HEADING: 'POLÍTICA DE PRIVACIDAD',
    LEGAL_IMPRESSUM: _EN.LEGAL_IMPRESSUM,
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_ES,
    HELI_COLOR_ORANGE: 'NARANJA',
    HELI_COLOR_BLUE: 'AZUL',
    HELI_COLOR_SAND: 'ARENA',
    HELI_COLOR_GREEN: 'VERDE',


    MADE_WITH: 'HECHO CON ♥ EN JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Todos los derechos reservados.',
    CREDITS_ROLE_DEVELOPMENT: 'DISEÑO & DESARROLLO',
    CREDITS_ROLE_CAMPAIGN: 'DISEÑO DE CAMPAÑA',
    CREDITS_ROLE_SOUND: 'SONIDO & MÚSICA',
    CREDITS_ROLE_LEADERTEST: 'TESTER PRINCIPAL',
    CREDITS_ROLE_TEST: 'TESTERS',
    CREDITS_ROLE_CONSULTGS: 'CONSULTORÍA G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRADO POR',
} as const;

const _PT = {
    DONE: 'concluído',
    SPLASH_TITLE: 'SAR: CALLSIGN WOLF',
    SPLASH_HINT: 'TOQUE PARA INICIAR',
    MENU_TITLE: 'SAR: CALLSIGN WOLF',
    MENU_START: 'INICIAR JOGO',
    MENU_HELI: 'HELICÓPTERO',
    MENU_SETTINGS: 'CONFIGURAÇÕES',
    MENU_CREDITS: 'CRÉDITOS',
    NEXT: 'Continuar',
    BACK: 'VOLTAR',
    ACKNOWLEDGE: 'ENTENDIDO',
    RETRY: 'TENTAR NOVAMENTE',
    NEXT_MISSION: 'PRÓXIMA MISSÃO',
    TO_MISSION_SELECT: 'SELEÇÃO DE MISSÃO',
    TO_CAMPAIGN_SELECT: 'SELEÇÃO DE CAMPANHA',
    CAMPAIGN_SELECT_TITLE: 'ESCOLHER CAMPANHA',
    CAMPAIGN_SELECT_MISSIONS: 'Missões',
    MISSION_LOCKED: '[ BLOQUEADO ]',
    BEST_TIME: (ms: number): string => {
        const totalSec = ms / 1000;
        const min = Math.floor(totalSec / 60);
        const sec = (totalSec % 60).toFixed(1);
        return `MELHOR TEMPO: ${min}:${sec.padStart(4, '0')}`;
    },
    HELI_SELECT_TITLE: 'HANGAR',
    HELI_SELECT_CONFIRM: 'SELECIONAR',
    HELI_LOCKED_FROM: (rank: string) => `a partir de ${rank}`,
    HELI_TYPE_RATING_REQUIRED: 'HABILITAÇÃO NECESSÁRIA',
    HELI_STAT_SPEED: 'VELOCIDADE',
    HELI_STAT_AGILITY: 'AGILIDADE',
    HELI_STAT_CAPACITY: 'CAPACIDADE',
    HELI_STAT_ENDURANCE: 'RESISTÊNCIA',
    LOADING_READY: 'Pronto.',
    MISSION_COMPLETE: 'MISSÃO CONCLUÍDA',
    OBJECTIVES_CLEARED: 'TODOS OS OBJETIVOS CUMPRIDOS',
    TYPE_RATING_GRANTED: 'HABILITAÇÃO CONCEDIDA',
    TYPE_RATING_FAILED: 'HABILITAÇÃO NÃO CONCEDIDA',
    TYPE_RATING_UNLOCKED: (label: string) => `★ HABILITAÇÃO ${label.toUpperCase()} DESBLOQUEADA`,
    MISSION_FAILED: 'MISSÃO FRACASSADA',
    CAMPAIGN_COMPLETE: 'CAMPANHA CONCLUÍDA',
    ALL_MISSIONS_CLEARED: 'TODAS AS MISSÕES CONCLUÍDAS',
    CLICK_TO_DEPLOY: 'TOQUE PARA IMPLANTAR',
    RANK_NAME: (key: string): string =>
        ({ leutnant: 'Tenente', oberleutnant: 'Primeiro Tenente', hauptmann: 'Capitão', major: 'Major' } as Record<string, string>)[key] ?? key,
    PILOT_ADDRESS: (rank: string, callsign: string) => `${rank} ${callsign || 'WOLF'}`,
    BRIEFING_ADDRESS: (rank: string, callsign: string) => `Sua missão, ${rank} ${callsign || 'WOLF'}`,
    RANKUP_DECREE: (fromRank: string, toRank: string, callsign: string) =>
        `${fromRank} ${callsign || 'WOLF'}!\nPor este meio, promovo-te ao posto de ${toRank.toUpperCase()}.`,
    SAVE_CODE_INVALID: 'CÓDIGO INVÁLIDO',
    SAVE_CODE_LOADED: 'SAVE CARREGADO',
    STATS: (c: number, m: number) => `CAMPANHAS: ${c}  |  MISSÕES: ${m}`,
    CAMPAIGN_LOCKED: '[ BLOQUEADO ]',
    DELETE_SESSION: 'APAGAR SAVE',
    DELETE_CONFIRM: 'REALMENTE APAGAR?',
    SESSION_DELETED: 'APAGADO.',
    DELIVER_MODE_ON: 'MODO IMPLANTAÇÃO — [R] CANCELAR',
    DELIVER_MODE_OFF: '',
    PILOT_CALLSIGN: 'INDICATIVO (MÁX. 8 CHARS, A–Z)',
    PILOT_SAVECODE: 'CÓDIGO DE SAVE',
    PILOT_IMPORT: 'IMPORTAR CÓDIGO (SOBRESCREVE SAVE)',
    PILOT_IMPORTLOAD: 'CARREGAR',
    MUSIC_HEADING: 'MÚSICA',
    SFX_HEADING: 'EFEITOS SONOROS',
    AUDIO_ON: 'ON',
    AUDIO_OFF: 'OFF',
    PAUSE_TITLE: '— PAUSA —',
    PAUSE_RESUME: 'CONTINUAR',
    PAUSE_ABORT: '✕ ABANDONAR',
    LANGUAGE_HEADING: 'IDIOMA',
    TUT_TAKEOFF_M: 'DECOLAR E SUBIR — MANTER STICK ESQUERDO PARA CIMA',
    TUT_TURN_L_M: 'VIRAR À ESQUERDA — STICK ESQUERDO PARA A ESQUERDA',
    TUT_TURN_R_M: 'VIRAR À DIREITA — STICK ESQUERDO PARA A DIREITA',
    TUT_STRAFE_L_M: 'DESLIZAR À ESQUERDA — STICK DIREITO PARA A ESQUERDA',
    TUT_STRAFE_R_M: 'DESLIZAR À DIREITA — STICK DIREITO PARA A DIREITA',
    TUT_FORWARD_M: 'AVANÇAR — STICK DIREITO PARA CIMA',
    TUT_BACKWARD_M: 'RECUAR — STICK DIREITO PARA BAIXO',
    TUT_LAND_M: 'COMBUSTÍVEL BAIXO — STICK ESQUERDO PARA BAIXO PARA POUSAR',
    TUT_ENGINE_STOP: 'PARAR MOTOR — STICK ESQUERDO PARA BAIXO NOVAMENTE',
    TUT_REFUEL: 'AGUARDAR — O CAMIÃO ABASTECE O HELICÓPTERO',
    TUT_REFUEL_2: 'REFUEL FIRST — LAND, STOP ENGINE, WAIT',
    TUT_LOCATE_CRATE: 'PROCURAR CAIXA — USAR MINIMAPA E APROXIMAR',
    TUT_CRATE_PICKUP_M: 'APANHAR CAIXA — RODA PARA BAIXO, PAIRAR SOBRE A CAIXA',
    TUT_CRATE_TO_PAD_M: 'LEVAR A CAIXA À PLATAFORMA E BAIXÁ-LA',
    TUT_LOCATE_PERSON: 'LOCALIZAR SOBREVIVENTE — USAR MINIMAPA E APROXIMAR',
    TUT_PERSON_PICKUP_M: 'RESGATAR SOBREVIVENTE — RODA PARA BAIXO, DEPOIS PARA CIMA',
    TUT_PERSON_TO_PAD_M: 'VOAR À PLATAFORMA COM O PACIENTE E POUSAR',
    TUT_TAKEOFF_K: 'START & CLIMB — HOLD W',
    TUT_TURN_L_K: 'TURN LEFT — ARROW LEFT',
    TUT_TURN_R_K: 'TURN RIGHT — ARROW RIGHT',
    TUT_STRAFE_L_K: 'STRAFE LEFT — KEY A',
    TUT_STRAFE_R_K: 'STRAFE RIGHT — KEY D',
    TUT_FORWARD_K: 'FORWARD — ARROW UP',
    TUT_BACKWARD_K: 'BACKWARD — ARROW DOWN',
    TUT_LAND_K: 'LOW FUEL — KEY S TO LAND',
    TUT_ENGINE_STOP_K: 'STOP ENGINE — PRESS S AGAIN',
    TUT_CRATE_PICKUP_K: 'PICK UP CRATE — PRESS E, HOVER OVER CRATE',
    TUT_CRATE_TO_PAD_K: 'BRING CRATE TO PAD — PRESS E TO LOWER',
    TUT_PERSON_PICKUP_K: 'RESCUE SURVIVOR — PRESS E, THEN Q',
    TUT_PERSON_TO_PAD_K: 'FLY TO PAD WITH PATIENT AND LAND',
    TUT_DONE: 'TUTORIAL CONCLUÍDO — BOA SORTE!',
    TRAINING_REQUIRED: 'HABILITAÇÃO NECESSÁRIA',
    NOT_UNLOCKED: 'NÃO DESBLOQUEADO',
    MENU_LEGAL: 'AVISO LEGAL',
    LEGAL_TITLE: 'AVISO LEGAL',
    LEGAL_IMPRESSUM_HEADING: 'INFORMAÇÕES LEGAIS',
    LEGAL_DATENSCHUTZ_HEADING: 'POLÍTICA DE PRIVACIDADE',
    LEGAL_IMPRESSUM: _EN.LEGAL_IMPRESSUM,
    LEGAL_DATENSCHUTZ: _DATENSCHUTZ_PT,
    HELI_COLOR_ORANGE: 'LARANJA',
    HELI_COLOR_BLUE: 'AZUL',
    HELI_COLOR_SAND: 'AREIA',
    HELI_COLOR_GREEN: 'VERDE',


    MADE_WITH: 'FEITO COM ♥ EM JAVASCRIPT',
    COPYRIGHT: '© 2026 i.thie softworks — Todos os direitos reservados.',
    CREDITS_ROLE_DEVELOPMENT: 'DESIGN & DESENVOLVIMENTO',
    CREDITS_ROLE_CAMPAIGN: 'DESIGN DE CAMPANHA',
    CREDITS_ROLE_SOUND: 'SOM & MÚSICA',
    CREDITS_ROLE_LEADERTEST: 'TESTER PRINCIPAL',
    CREDITS_ROLE_TEST: 'TESTERS',
    CREDITS_ROLE_CONSULTGS: 'CONSULTORIA G.S.',
    CREDITS_ROLE_INSPIREDBY: 'INSPIRADO POR',
} as const;

const _lang0 = _detectLang();
document.documentElement.lang = _lang0;

export const I18N_DE: typeof _DE = _DE;
export const I18N_EN: typeof _DE = _EN as unknown as typeof _DE;

const _langMap: Record<Lang, typeof _DE> = {
    de: _DE as typeof _DE,
    en: _EN as unknown as typeof _DE,
    fr: _FR as unknown as typeof _DE,
    es: _ES as unknown as typeof _DE,
    pt: _PT as unknown as typeof _DE,
};

export let I18N: typeof _DE = _langMap[_lang0];

/** Active language code — used by localize() and campaign text rendering. */
export let LANG: Lang = _lang0;

const _langCallbacks: Array<() => void> = [];

/** Register a callback to fire whenever the language changes. */
export const onLanguageChange = (cb: () => void): void => {
    _langCallbacks.push(cb);
};

/** Change the active language, persist the choice, and notify all listeners. */
export const setLanguage = (lang: Lang): void => {
    storageSet(LANG_PREF_KEY, lang);
    LANG = lang;
    I18N = _langMap[lang];
    document.documentElement.lang = lang;
    _langCallbacks.forEach(cb => cb());
};

/** Resolve a LocalizedString to the active language (falls back to 'de'). */
export const localize = (ls: string | { de: string; en?: string } | undefined): string => {
    if (!ls) return '';
    if (typeof ls === 'string') return ls;
    return LANG !== 'de' && ls.en ? ls.en : ls.de;
};
