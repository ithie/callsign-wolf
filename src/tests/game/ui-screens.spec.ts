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

vi.mock('../../game/render', () => ({
    iso: vi.fn(() => ({ x: 0, y: 0 })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as MainMenu from '../../game/ui/main-menu/main-menu';
import * as Briefing from '../../game/ui/briefing/briefing';
import * as Settings from '../../game/ui/settings/settings';
import * as Rankup from '../../game/ui/rankup/rankup';
import * as CreditsScreen from '../../game/ui/credits-screen/credits-screen';
import type { PlayerSession } from '../../game/session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const snap = (id: string) => expect(document.getElementById(id)!.innerHTML).toMatchSnapshot();

const mockSession = (): PlayerSession => ({
    playerName: 'WOLF',
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
});

const mockSettingsDeps = () => ({
    getSession: mockSession,
    saveSession: vi.fn(),
    getRankMissions: () => 0,
    getControlMode: () => 'heading' as const,
    setControlMode: vi.fn(),
    isMusicEnabled: () => true,
    setMusicEnabled: vi.fn(),
    isSfxEnabled: () => true,
    setSfxEnabled: vi.fn(),
    onBack: vi.fn(),
    onSessionDeleted: vi.fn(),
});

const noopCallbacks = {
    onSplashClick: vi.fn(),
    onStart: vi.fn(),
    onSettings: vi.fn(),
    onCredits: vi.fn(),
    onLegal: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('UI screen snapshots', () => {
    it('main-menu', () => {
        MainMenu.mount(noopCallbacks);
        snap('main-menu');
    });

    it('briefing', () => {
        Briefing.mount();
        snap('mission-briefing');
    });

    it('settings-screen', () => {
        Settings.init(mockSettingsDeps());
        Settings.mount();
        Rankup.mount();
        snap('settings-screen');
    });

    it('rankup-overlay', () => {
        Settings.init(mockSettingsDeps());
        Settings.mount();
        Rankup.mount();
        snap('rankup-overlay');
    });

    it('credits-screen', () => {
        CreditsScreen.mount(vi.fn());
        snap('credits-screen');
    });
});
