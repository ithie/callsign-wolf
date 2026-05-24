import { vi } from 'vitest';

// @capacitor/preferences is a native plugin — stub it so the import chain works in Node
vi.mock('@capacitor/preferences', () => ({
    Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

import { describe, it, expect } from 'vitest';
import {
    encodeSession, decodeSession,
    getRank, getMissionsDone, getCampaignsDone,
    isCampaignUnlocked, isMissionUnlocked,
    type PlayerSession,
} from './session';

const mkSession = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    playerName: '',
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
    ...overrides,
});

// ─── getMissionsDone / getCampaignsDone ───────────────────────────────────────

describe('getMissionsDone', () => {
    it('returns 0 with no progress', () => {
        expect(getMissionsDone(mkSession())).toBe(0);
    });

    it('counts only completed missions', () => {
        const s = mkSession({
            campaignProgress: {
                '0': { completed: true, missions: [
                    { completed: true, bestTimeMs: 1000 },
                    { completed: false, bestTimeMs: null },
                ]},
                '1': { completed: false, missions: [
                    { completed: true, bestTimeMs: 500 },
                ]},
            },
        });
        expect(getMissionsDone(s)).toBe(2);
    });
});

describe('getCampaignsDone', () => {
    it('returns 0 with no progress', () => {
        expect(getCampaignsDone(mkSession())).toBe(0);
    });

    it('counts only completed campaigns', () => {
        const s = mkSession({
            campaignProgress: {
                '0': { completed: true,  missions: [] },
                '1': { completed: false, missions: [] },
                '2': { completed: true,  missions: [] },
            },
        });
        expect(getCampaignsDone(s)).toBe(2);
    });
});

// ─── getRank ─────────────────────────────────────────────────────────────────

describe('getRank', () => {
    it('Leutnant at 0 missions', () => {
        expect(getRank(mkSession(), 0).name).toBe('Leutnant');
    });

    it('Oberleutnant at 10 missions', () => {
        expect(getRank(mkSession(), 10).name).toBe('Oberleutnant');
    });

    it('Hauptmann at 30 missions', () => {
        expect(getRank(mkSession(), 30).name).toBe('Hauptmann');
    });

    it('Major at 60 missions', () => {
        expect(getRank(mkSession(), 60).name).toBe('Major');
    });

    it('rankOverride elevates rank with 0 missions', () => {
        expect(getRank(mkSession({ rankOverride: 3 }), 0).name).toBe('Major');
    });

    it('rankOverride does not lower a higher earned rank', () => {
        expect(getRank(mkSession({ rankOverride: 0 }), 60).name).toBe('Major');
    });

    it('uses getMissionsDone when nonTutorialMissions is omitted', () => {
        const s = mkSession({
            campaignProgress: {
                '0': { completed: false, missions: Array(10).fill({ completed: true, bestTimeMs: null }) },
            },
        });
        expect(getRank(s).name).toBe('Oberleutnant');
    });
});

// ─── isMissionUnlocked ────────────────────────────────────────────────────────

describe('isMissionUnlocked', () => {
    it('first mission is always unlocked', () => {
        expect(isMissionUnlocked(mkSession(), '0', 0, 'regular')).toBe(true);
    });

    it('subsequent mission locked without previous completion', () => {
        expect(isMissionUnlocked(mkSession(), '0', 1, 'regular')).toBe(false);
    });

    it('subsequent mission unlocked when previous is complete', () => {
        const s = mkSession({
            campaignProgress: {
                '0': { completed: false, missions: [{ completed: true, bestTimeMs: null }] },
            },
        });
        expect(isMissionUnlocked(s, '0', 1, 'regular')).toBe(true);
    });

    it('free-flight is always fully unlocked', () => {
        expect(isMissionUnlocked(mkSession(), '0', 5, 'free-flight')).toBe(true);
    });
});

// ─── isCampaignUnlocked ───────────────────────────────────────────────────────

describe('isCampaignUnlocked', () => {
    const campaigns = [
        { type: 'tutorial' },
        { type: 'free-flight' },
        { type: 'regular' },
        { type: 'regular' },
    ];

    it('tutorial is always unlocked', () => {
        expect(isCampaignUnlocked(mkSession(), campaigns, 0)).toBe(true);
    });

    it('free-flight unlocked once tutorial is done', () => {
        const s = mkSession({
            campaignProgress: { '0': { completed: true, missions: [] } },
        });
        expect(isCampaignUnlocked(s, campaigns, 1)).toBe(true);
    });

    it('first regular locked until tutorial done', () => {
        expect(isCampaignUnlocked(mkSession(), campaigns, 2)).toBe(false);
    });

    it('first regular unlocked after tutorial', () => {
        const s = mkSession({
            campaignProgress: { '0': { completed: true, missions: [] } },
        });
        expect(isCampaignUnlocked(s, campaigns, 2)).toBe(true);
    });

    it('second regular locked until first regular is done', () => {
        const s = mkSession({
            campaignProgress: { '0': { completed: true, missions: [] } },
        });
        expect(isCampaignUnlocked(s, campaigns, 3)).toBe(false);
    });

    it('second regular unlocked after first regular is done', () => {
        const s = mkSession({
            campaignProgress: {
                '0': { completed: true, missions: [] },
                '2': { completed: true, missions: [] },
            },
        });
        expect(isCampaignUnlocked(s, campaigns, 3)).toBe(true);
    });

    it('highestUnlockedCampaignIndex unlocks up to that index', () => {
        expect(isCampaignUnlocked(mkSession({ highestUnlockedCampaignIndex: 3 }), campaigns, 3)).toBe(true);
    });

    it('out-of-bounds index returns false', () => {
        expect(isCampaignUnlocked(mkSession(), campaigns, 99)).toBe(false);
    });
});

// ─── encodeSession / decodeSession ────────────────────────────────────────────

describe('encodeSession / decodeSession', () => {
    it('produces XXXXX-XXXX format', () => {
        expect(encodeSession(mkSession(), 0)).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{4}$/);
    });

    it('roundtrips callsign', () => {
        const s = mkSession({ playerName: 'WOLF' });
        expect(decodeSession(encodeSession(s, 0))?.playerName).toBe('WOLF');
    });

    it('roundtrips rank index', () => {
        const s = mkSession({ rankOverride: 3 });
        expect(decodeSession(encodeSession(s, 60))?.rankOverride).toBe(3);
    });

    it('roundtrips highestUnlockedCampaignIndex', () => {
        const s = mkSession({ highestUnlockedCampaignIndex: 5 });
        expect(decodeSession(encodeSession(s, 0))?.highestUnlockedCampaignIndex).toBe(5);
    });

    it('reconstructs campaign progress from nextMission count', () => {
        const s = mkSession({
            campaignProgress: {
                '1': { completed: false, missions: [
                    { completed: true, bestTimeMs: null },
                    { completed: true, bestTimeMs: null },
                ]},
            },
        });
        const decoded = decodeSession(encodeSession(s, 0));
        expect(decoded?.campaignProgress?.['1']?.missions).toHaveLength(2);
        expect(decoded?.campaignProgress?.['1']?.missions[0].completed).toBe(true);
    });

    it('is case-insensitive', () => {
        const s = mkSession({ playerName: 'TEST' });
        const lower = encodeSession(s, 0).toLowerCase();
        expect(decodeSession(lower)?.playerName).toBe('TEST');
    });

    it('strips hyphens and spaces before decoding', () => {
        const s = mkSession({ playerName: 'ACE' });
        const code = encodeSession(s, 0);
        const noDash = code.replace('-', '');
        expect(decodeSession(noDash)?.playerName).toBe('ACE');
    });

    it('returns null for wrong checksum', () => {
        const code = encodeSession(mkSession(), 0);
        const corrupted = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A');
        expect(decodeSession(corrupted)).toBeNull();
    });

    it('returns null for too-short input', () => {
        expect(decodeSession('ABC')).toBeNull();
    });

    it('callsign longer than 5 chars is truncated to 5', () => {
        const s = mkSession({ playerName: 'ABCDEFGH' });
        expect(decodeSession(encodeSession(s, 0))?.playerName).toBe('ABCDE');
    });

    it('non-letter callsign chars are stripped', () => {
        const s = mkSession({ playerName: 'A1B2C' });
        expect(decodeSession(encodeSession(s, 0))?.playerName).toBe('ABC');
    });
});
