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

import { mountWhatsNew } from '../../game/ui/whats-new/whats-new';
import { mountMainMenu } from '../../game/ui/main-menu/main-menu';
import { mountBriefing } from '../../game/ui/briefing/briefing';
import { mountCookieBanner } from '../../game/ui/cookie-banner/cookie-banner';
import { mountMuteButton } from '../../game/ui/mute-button/mute-button';
import { initSettings, mountSettings } from '../../game/ui/settings/settings';
import { mountRankup } from '../../game/ui/rankup/rankup';
import { mountCreditsScreen } from '../../game/ui/credits-screen/credits-screen';
import { mountMpLobby } from '../../game/ui/mp-lobby/mp-lobby';
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
    onSplashClick: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => { document.body.innerHTML = ''; });

describe('UI screen snapshots', () => {
    it('whats-new', () => {
        mountWhatsNew();
        snap('whats-new-overlay');
    });

    it('splash (main-menu)', () => {
        mountMainMenu(noopCallbacks);
        snap('splash');
    });

    it('main-menu', () => {
        mountMainMenu(noopCallbacks);
        snap('main-menu');
    });

    it('briefing', () => {
        mountBriefing();
        snap('mission-briefing');
    });

    it('cookie-banner', () => {
        mountCookieBanner();
        snap('cookie-banner');
    });

    it('mute-button', () => {
        mountMuteButton({ isMuted: () => false, onToggle: vi.fn() });
        snap('audio-mute');
    });

    it('settings-screen', () => {
        initSettings(mockSettingsDeps());
        mountSettings(); mountRankup();
        snap('settings-screen');
    });

    it('rankup-overlay', () => {
        initSettings(mockSettingsDeps());
        mountSettings(); mountRankup();
        snap('rankup-overlay');
    });

    it('credits-screen', () => {
        mountCreditsScreen(vi.fn());
        snap('credits-screen');
    });

    it('mp-lobby-screen', () => {
        mountMpLobby();
        snap('mp-lobby-screen');
    });
});
