import './base.css';
import './screens.css';
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
import * as WhatsNew from './whats-new/whats-new.ui';
import { showScreen, showScreenCrtEnter } from './nav';
import { loadSession, getRank, RANKS } from '../session';
import type { CampaignExport } from '../../shared/types';

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
            {
                de: 'Schlechte Sicht. Stürme ziehen auf. Bringe den Verwundeten zum Träger.',
                en: 'Poor visibility. Storms approaching.',
            },
            { rain: true, objectives: [{ type: 'rescue_all' }] }
        ),
        _stubLevel(
            { de: 'Phase 3 — Nachtflug', en: 'Phase 3 — Night Flight' },
            {
                de: 'Nur Instrumente. Keine Sterne. Flieg auf Kompass.',
                en: 'Instruments only. No stars. Fly by compass.',
            },
            { night: true, objectives: [{ type: 'rescue_all' }] }
        ),
    ],
};

const STUB_FREE_FLIGHT: CampaignExport = {
    type: 'free-flight',
    campaignTitle: { de: 'FREIER FLUG', en: 'FREE FLIGHT' },
    campaignSublines: [{ de: 'Keine Vorgaben. Einfach fliegen.', en: 'No objectives. Just fly.' }],
    levels: [_stubLevel({ de: 'Freier Flug', en: 'Free Flight' }, { de: '', en: '' })],
};

const session = loadSession();

// ── Sidebar ────────────────────────────────────────────────────────────────

const injectStyles = (): void => {
    const style = document.createElement('style');
    style.textContent = `
        #_preview-panel {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: 200px; background: #111; border-left: 1px solid #333;
            z-index: 99999; display: flex; flex-direction: column;
            font-family: monospace; font-size: 11px; overflow-y: auto;
            overflow-x: hidden;
        }
        #_preview-panel::-webkit-scrollbar { width: 4px; }
        #_preview-panel::-webkit-scrollbar-thumb { background: #444; }
        ._preview-header {
            padding: 8px 10px 4px; font-size: 9px; font-weight: 700;
            letter-spacing: .1em; text-transform: uppercase; color: #555;
        }
        ._preview-btn {
            display: block; width: 100%; background: none; color: #9d9; border: none;
            border-top: 1px solid #222; padding: 7px 10px; text-align: left;
            font-family: monospace; font-size: 11px; cursor: pointer;
        }
        ._preview-btn:hover { background: #1a2a1a; color: #aff; }
        ._preview-btn.active { background: #0f2a10; color: #4f4; }
        ._preview-title {
            padding: 10px 10px 6px; font-size: 10px; font-weight: 700;
            color: #4f4; letter-spacing: .05em; border-bottom: 1px solid #333;
            flex-shrink: 0;
        }
    `;
    document.head.appendChild(style);
};

const panel = document.createElement('div');
panel.id = '_preview-panel';

const addSection = (label: string): void => {
    const h = document.createElement('div');
    h.className = '_preview-header';
    h.textContent = label;
    panel.appendChild(h);
};

const addBtn = (label: string, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = '_preview-btn';
    btn.textContent = label;
    btn.onclick = () => {
        panel.querySelectorAll<HTMLButtonElement>('._preview-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onClick();
    };
    panel.appendChild(btn);
    return btn;
};

// ── Nav helpers ────────────────────────────────────────────────────────────

const showNav = (id: Parameters<typeof showScreenCrtEnter>[0]): void => showScreenCrtEnter(id);

// ── Mount all components ───────────────────────────────────────────────────

const setup = (): void => {
    injectStyles();

    const title = document.createElement('div');
    title.className = '_preview-title';
    title.textContent = '⚡ UI PREVIEW';
    panel.appendChild(title);

    // ── Settings (needs init before mount) ─────────────────────────────────
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
        onBack: () => showNav('main-menu'),
    });

    // ── Mount overlay components ────────────────────────────────────────────
    Briefing.mount();
    Rankup.mount();
    WhatsNew.mount();
    CookieBanner.mount();
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
        onAbort: () => showNav('main-menu'),
    });

    // ── Mount nav screens ───────────────────────────────────────────────────
    MainMenu.mount({
        onSplashClick: () => showNav('main-menu'),
        onStart: () => showNav('campaign-select'),
        onSettings: () => showNav('settings-screen'),
        onCredits: () => showNav('credits-screen'),
        onLegal: () => LegalScreen.show(),
    });
    CampaignSelect.mount();
    MissionSelect.mount();
    HeliSelect.mount();
    Settings.mount();
    LegalScreen.mount(() => showNav('main-menu'));

    // ── Show/hide helpers ────────────────────────────────────────────────────
    const showCampaign = () =>
        CampaignSelect.show({
            session,
            campaigns: [STUB_FREE_FLIGHT, STUB_CAMPAIGN, STUB_CAMPAIGN],
            onSelect: i => showMission(i),
            onBack: () => showNav('main-menu'),
        });

    const showMission = (ci: number) =>
        MissionSelect.show({
            campaign: STUB_CAMPAIGN,
            campaignIndex: ci,
            session,
            onSelect: () => showHeli(),
            onBack: () => showCampaign(),
        });

    const showHeli = () =>
        HeliSelect.show({
            rankIndex: RANKS.indexOf(getRank(session)),
            onSelect: id => console.log('[ui-preview] heli selected:', id),
            onBack: () => showMission(0),
        });

    // ── Sidebar sections ─────────────────────────────────────────────────────
    addSection('Navigation Screens');
    addBtn('Splash / Main Menu', () => {
        showScreen(null);
        showNav('main-menu');
    });
    addBtn('Campaign Select', () => showCampaign());
    addBtn('Mission Select', () => showMission(0));
    addBtn('Heli Select', () => showHeli());
    addBtn('Settings', () => {
        showNav('settings-screen');
    });
    addBtn('Legal', () => LegalScreen.show());

    addSection('Overlays');
    addBtn('Briefing', () => {
        showScreen(null);
        Briefing.show(
            {
                headline: { de: 'PHASE 1 — ERSTER KONTAKT', en: 'PHASE 1 — FIRST CONTACT' },
                sublines: [
                    { de: '▸ Rette 2 Überlebende', en: '▸ Rescue 2 survivors' },
                    { de: '▸ Lande auf dem Träger', en: '▸ Land on the carrier' },
                ],
                briefing: {
                    de: 'Die Küstenwache hat zwei Überlebende im Nordosten gemeldet. Wetter zieht auf. Beeil dich.',
                    en: 'Coast guard reported two survivors to the north-east. Weather is closing in. Move fast.',
                },
                address: 'SAR WOLF · MISSION 01',
            },
            () => {}
        );
    });
    addBtn('Pause Button (show)', () => {
        PauseOverlay.show();
    });
    addBtn('Rank Up', () => {
        showScreen(null);
        Rankup.show(RANKS[1], 'atlas');
    });
    addBtn("What's New", () => {
        showScreen(null);
        WhatsNew.show(() => {});
    });
    addBtn('Cookie Banner', () => {
        showScreen(null);
        CookieBanner.mount();
    });

    addSection('Loading');
    addBtn('Loading Screen', () => {
        showScreen(null);
        const handle = LoadingScreen.show('ZEEWOLF SAR — LADEN…');
        handle.step('Terrain', 0.3);
        setTimeout(() => handle.step('Objekte', 0.6), 600);
        setTimeout(() => handle.step('Fertig', 1.0), 1200);
    });

    document.body.appendChild(panel);

    // Start on main menu
    showNav('main-menu');
    panel.querySelector<HTMLButtonElement>('._preview-btn')?.click();
};

setup();
