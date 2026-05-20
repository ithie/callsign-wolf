import { init, mount, show } from './settings';
import type { PlayerSession } from '../../session';

const _session = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    cookieConsent: true,
    consentTimestamp: Date.now(),
    consentVersion: 'v25.0',
    playerName: 'WOLF',
    activeCampaignIndex: 1,
    highestUnlockedCampaignIndex: 2,
    campaignProgress: {
        '0': { completed: true, missions: [{ completed: true, bestTimeMs: 180000 }] },
        '1': {
            completed: true,
            missions: Array.from({ length: 5 }, () => ({ completed: true, bestTimeMs: 260000 })),
        },
    },
    rankOverride: 0,
    allUnlocked: false,
    lastSeenVersion: '',
    ...overrides,
});

export const Desktop = () => {
    init({
        getSession:      () => _session(),
        saveSession:     (_s: PlayerSession) => {},
        getRankMissions: () => 6,
        getControlMode:  () => 'screen' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => false,
        isMusicEnabled:  () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => true,
        setSfxEnabled:   (_v: boolean) => {},
        onBack: () => {},
    });
    mount();
    show();
};

export const TouchHeading = () => {
    init({
        getSession:      () => _session(),
        saveSession:     (_s: PlayerSession) => {},
        getRankMissions: () => 6,
        getControlMode:  () => 'heading' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => true,
        isMusicEnabled:  () => false,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => false,
        setSfxEnabled:   (_v: boolean) => {},
        onBack: () => {},
    });
    mount();
    show();
};

export const NeuerSpieler = () => {
    init({
        getSession:      () => _session({ playerName: '', campaignProgress: {}, cookieConsent: null }),
        saveSession:     (_s: PlayerSession) => {},
        getRankMissions: () => 0,
        getControlMode:  () => 'screen' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => false,
        isMusicEnabled:  () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => true,
        setSfxEnabled:   (_v: boolean) => {},
        onBack: () => {},
    });
    mount();
    show();
};
