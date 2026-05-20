// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock heavy / side-effectful dependencies ─────────────────────────────────

vi.mock('../../game/main', () => ({
    soundHandler: { play: vi.fn(), stop: vi.fn(), setVolume: vi.fn(), toggle: vi.fn() },
    musicConfig: { mainMenu: 'main', credits: 'credits', success: 'success', defeat: 'defeat' },
    COMMANDER_SVG: '<svg id="commander-mock"></svg>',
    campaignHandler: {},
    zinit: vi.fn(),
}));

vi.mock('../../game/multiplayer/rtc', () => ({
    createRTCPeer: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock('../../game/render', () => ({
    iso: vi.fn(() => ({ x: 0, y: 0 })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as WhatsNew from '../../game/ui/whats-new/whats-new';
import * as MainMenu from '../../game/ui/main-menu/main-menu';
import * as Briefing from '../../game/ui/briefing/briefing';
import * as CookieBanner from '../../game/ui/cookie-banner/cookie-banner';
import * as Settings from '../../game/ui/settings/settings';
import * as Rankup from '../../game/ui/rankup/rankup';
import * as CreditsScreen from '../../game/ui/credits-screen/credits-screen';
import * as MpLobby from '../../game/ui/mp-lobby/mp-lobby';
import type { PlayerSession } from '../../game/session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const snap = (id: string) => expect(document.getElementById(id)!.innerHTML).toMatchSnapshot();

const mockSession = (): PlayerSession => ({
    cookieConsent: true,
    consentTimestamp: Date.now(),
    consentVersion: 'v25.0',
    playerName: 'WOLF',
    activeCampaignIndex: 0,
    highestUnlockedCampaignIndex: 0,

    campaignProgress: {},
    rankOverride: 0,
    allUnlocked: false,
    lastSeenVersion: '25.0',
});

const mockSettingsDeps = () => ({
    getSession: mockSession,
    saveSession: vi.fn(),
    getRankMissions: () => 0,
    getControlMode: () => 'heading' as const,
    setControlMode: vi.fn(),
    isTouchDevice: () => false,
    isMusicEnabled: () => true,
    setMusicEnabled: vi.fn(),
    isSfxEnabled: () => true,
    setSfxEnabled: vi.fn(),
    onBack: vi.fn(),
});

const noopCallbacks = {
    onStart: vi.fn(),
    onMultiplayer: vi.fn(),
    onSettings: vi.fn(),
    onCredits: vi.fn(),
    onLegal: vi.fn(),
    onSplashClick: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => { document.body.innerHTML = ''; });

describe('UI screen snapshots', () => {
    it('whats-new', () => {
        WhatsNew.mount();
        snap('whats-new-overlay');
    });

    it('main-menu', () => {
        MainMenu.mount(noopCallbacks);
        snap('main-menu');
    });

    it('briefing', () => {
        Briefing.mount();
        snap('mission-briefing');
    });

    it('cookie-banner', () => {
        CookieBanner.mount();
        snap('cookie-banner');
    });


    it('settings-screen', () => {
        Settings.init(mockSettingsDeps());
        Settings.mount(); Rankup.mount();
        snap('settings-screen');
    });

    it('rankup-overlay', () => {
        Settings.init(mockSettingsDeps());
        Settings.mount(); Rankup.mount();
        snap('rankup-overlay');
    });

    it('credits-screen', () => {
        CreditsScreen.mount(vi.fn());
        snap('credits-screen');
    });

    it('mp-lobby-screen', () => {
        MpLobby.mount();
        snap('mp-lobby-screen');
    });
});
