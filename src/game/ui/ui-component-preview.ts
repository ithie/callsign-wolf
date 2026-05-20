import './base.css';
import './screens.css';
import { loadSession, getRank, RANKS } from '../session';
import type { CampaignExport } from '../../shared/types';

import * as MainMenu from './main-menu/main-menu.ui';
import * as Briefing from './briefing/briefing.ui';
import * as CampaignSelect from './campaign-select/campaign-select.ui';
import * as MissionSelect from './mission-select/mission-select.ui';
import * as HeliSelect from './heli-select/heli-select.ui';
import * as Settings from './settings/settings.ui';
import * as LegalScreen from './legal-screen/legal-screen.ui';
import * as CookieBanner from './cookie-banner/cookie-banner.ui';
import * as LoadingScreen from './loading-screen/loading-screen.ui';
import * as PauseOverlay from './pause-overlay/pause-overlay.ui';
import * as Rankup from './rankup/rankup.ui';
import { createDrawObjects } from '../draw-objects';
import { iso } from '../render';
import { tileW, tileH, stepH } from '../render-config';
import * as WhatsNew from './whats-new/whats-new.ui';
import * as CreditsScreen from './credits-screen/credits-screen.ui';
import * as TouchControls from './touch-controls/touch-controls.ui';
import * as MpLobby from './mp-lobby/mp-lobby.ui';
import { showScreen, showScreenCrtEnter } from './nav';

// ── Stub data ──────────────────────────────────────────────────────────────

const _stubLevel = (
    headline: { de: string; en: string },
    briefing: { de: string; en: string },
    overrides: Partial<CampaignExport['levels'][number]> = {}
): CampaignExport['levels'][number] => ({
    headline,
    briefing,
    gridSize: 100,
    terrain: '0x2710',
    foliage: [],
    objects: [],
    payloads: [],
    objectives: [],
    spawnObject: 'pad',
    rain: false,
    night: false,
    windDir: 0,
    windStr: 0,
    windVar: false,
    ...overrides,
});

const STUB_CAMPAIGN: CampaignExport = {
    type: 'ZEEWOLF_CAMPAIGN',
    campaignTitle: { de: 'OPERATION ZEEWOLF', en: 'OPERATION ZEEWOLF' },
    campaignSublines: [
        { de: 'Sichere den Archipel.', en: 'Secure the archipelago.' },
        { de: 'Viel Glück, Pilot.', en: 'Good luck, pilot.' },
    ],
    music: { briefing: '', ingame: '' },
    levels: [
        _stubLevel(
            { de: 'Phase 1 — Erster Kontakt', en: 'Phase 1 — First Contact' },
            {
                de: 'Rette die verschollene Crew. Zwei Personen werden im Nordosten gemeldet.',
                en: 'Rescue the missing crew. Two persons reported north-east.',
            },
            { objects: [{ type: 'carrier', x: 20, y: 20 } as any], objectives: [{ type: 'rescue_all' }] }
        ),
        _stubLevel(
            { de: 'Phase 2 — Sturmfront', en: 'Phase 2 — Storm Front' },
            { de: 'Schlechte Sicht. Stürme ziehen auf.', en: 'Poor visibility. Storms approaching.' },
            { rain: true, objectives: [{ type: 'rescue_all' }] }
        ),
        _stubLevel(
            { de: 'Phase 3 — Nachtflug', en: 'Phase 3 — Night Flight' },
            { de: 'Nur Instrumente. Keine Sterne.', en: 'Instruments only. No stars.' },
            { night: true, objectives: [{ type: 'rescue_all' }] }
        ),
    ],
};

const STUB_FREE_FLIGHT: CampaignExport = {
    type: 'free-flight',
    campaignTitle: { de: 'FREIER FLUG', en: 'FREE FLIGHT' },
    campaignSublines: [{ de: 'Keine Vorgaben.', en: 'No objectives.' }],
    levels: [_stubLevel({ de: 'Freier Flug', en: 'Free Flight' }, { de: '', en: '' })],
};

const session = loadSession();

// ── initRankup with a self-contained drawHeli ──────────────────────────────
// createDrawObjects needs a factory ctx/iso but drawHeli overrides them via
// targetCtx/targetIso, so the factory canvas is just a dummy.
const _dummyCanvas = document.createElement('canvas');
_dummyCanvas.width = 2;
_dummyCanvas.height = 2;
const _dummyCtx = _dummyCanvas.getContext('2d')!;
const _dummyIso = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
    iso(wx, wy, wz, camX, camY, { canvas: _dummyCanvas, tileW, tileH, stepH });
const _stubSceneRenderer = { add: () => {}, flush: () => {}, debugAltitude: false };
const { drawHeli: _previewDrawHeli } = createDrawObjects(_dummyCtx, _dummyIso, tileW, tileH, _stubSceneRenderer as any);
Rankup.init(_previewDrawHeli);

const showNav = (id: Parameters<typeof showScreenCrtEnter>[0]): void => showScreenCrtEnter(id);

// ── Component setups ───────────────────────────────────────────────────────

const setupMainMenu = (): void => {
    MainMenu.mount({
        onSplashClick: () => showNav('main-menu'),
        onStart: () => showNav('campaign-select'),
        onSettings: () => showNav('settings-screen'),
        onCredits: () => showNav('credits-screen'),
        onLegal: () => LegalScreen.show(),
    });
    showNav('main-menu');
};

const setupBriefing = (): void => {
    Briefing.mount();
    showScreen(null);
    Briefing.show(
        {
            headline: { de: 'PHASE 1 — ERSTER KONTAKT', en: 'PHASE 1 — FIRST CONTACT' },
            sublines: [
                { de: '▸ Rette 2 Überlebende', en: '▸ Rescue 2 survivors' },
                { de: '▸ Lande auf dem Träger', en: '▸ Land on the carrier' },
            ],
            briefing: {
                de: 'Die Küstenwache hat zwei Überlebende im Nordosten gemeldet. Wetter zieht auf.',
                en: 'Coast guard reported two survivors north-east. Weather closing in.',
            },
            address: 'SAR WOLF · MISSION 01',
        },
        () => {}
    );
};

const setupCampaignSelect = (): void => {
    CampaignSelect.mount();
    CampaignSelect.show({
        session,
        campaigns: [STUB_FREE_FLIGHT, STUB_CAMPAIGN, STUB_CAMPAIGN],
        onSelect: () => {},
        onBack: () => {},
    });
};

const setupMissionSelect = (): void => {
    MissionSelect.mount();
    MissionSelect.show({
        campaign: STUB_CAMPAIGN,
        campaignIndex: 1,
        session,
        onSelect: () => {},
        onBack: () => {},
    });
};

const setupHeliSelect = (): void => {
    HeliSelect.mount();
    HeliSelect.show({
        rankIndex: RANKS.indexOf(getRank(session)),
        onSelect: () => {},
        onBack: () => {},
    });
};

const setupSettings = (): void => {
    Settings.init({
        getSession: () => session,
        saveSession: () => {},
        getRankMissions: () => 8,
        getControlMode: () => 'screen',
        setControlMode: () => {},
        isTouchDevice: () => false,
        isMusicEnabled: () => false,
        setMusicEnabled: () => {},
        isSfxEnabled: () => false,
        setSfxEnabled: () => {},
        onBack: () => {},
    });
    Settings.mount();
    Settings.show();
};

const setupLegalScreen = (): void => {
    LegalScreen.mount(() => {});
    LegalScreen.show();
};

const setupCookieBanner = (): void => {
    CookieBanner.mount();
};

const setupLoadingScreen = (): void => {
    showScreen(null);
    const handle = LoadingScreen.show('ZEEWOLF SAR — LADEN…');
    handle.step('Terrain', 0.3);
    setTimeout(() => handle.step('Objekte', 0.6), 600);
    setTimeout(() => handle.step('Fertig', 1.0), 1200);
};

const setupPauseOverlay = (): void => {
    PauseOverlay.mount({
        isMusicEnabled: () => false,
        setMusicEnabled: () => {},
        isSfxEnabled: () => false,
        setSfxEnabled: () => {},
        getControlMode: () => 'screen',
        setControlMode: () => {},
        isTouchDevice: () => false,
        onPause: () => {},
        onResume: () => {},
        onAbort: () => {},
    });
    showScreen(null);
    PauseOverlay.show();
};

const setupRankup = (): void => {
    Rankup.mount();
    showScreen(null);
    Rankup.show(RANKS[1], 'atlas');
};

const setupWhatsNew = (): void => {
    WhatsNew.mount();
    showScreen(null);
    WhatsNew.show(() => {});
};

const setupCreditsScreen = (): void => {
    CreditsScreen.mount(() => {});
    showNav('credits-screen');
};

const setupTouchControls = (): void => {
    TouchControls.mount();
};

const setupMpLobby = (): void => {
    MpLobby.mount();
    showScreen(null);
    MpLobby.show({
        onConnected: () => {},
        onBack: () => {},
    });
};

const setupUnavailable = (name: string): void => {
    document.body.style.cssText =
        'display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;';
    const el = document.createElement('div');
    el.style.cssText = 'font-family:monospace;font-size:13px;color:#555;text-align:center;';
    el.textContent = `Kein Preview für: ${name}`;
    document.body.appendChild(el);
};

// ── Main ───────────────────────────────────────────────────────────────────

const component = (window as any).__PREVIEW_COMPONENT as string;

switch (component) {
    case 'main-menu':
        setupMainMenu();
        break;
    case 'briefing':
        setupBriefing();
        break;
    case 'campaign-select':
        setupCampaignSelect();
        break;
    case 'mission-select':
        setupMissionSelect();
        break;
    case 'heli-select':
        setupHeliSelect();
        break;
    case 'settings':
        setupSettings();
        break;
    case 'legal-screen':
        setupLegalScreen();
        break;
    case 'cookie-banner':
        setupCookieBanner();
        break;
    case 'loading-screen':
        setupLoadingScreen();
        break;
    case 'pause-overlay':
        setupPauseOverlay();
        break;
    case 'rankup':
        setupRankup();
        break;
    case 'whats-new':
        setupWhatsNew();
        break;
    case 'credits-screen':
        setupCreditsScreen();
        break;
    case 'touch-controls':
        setupTouchControls();
        break;
    case 'mp-lobby':
        setupMpLobby();
        break;
    default:
        setupUnavailable(component);
        break;
}
