export const STORAGE_KEY = 'z_session';
export const UNLOCK_KEY = 'z_unlocked';

import { storageGet, storageSet } from './storage';
import { CAMPAIGN_TYPE } from '../shared/types';
import { RANKS, getRank, type Rank } from './ui/rank-badge/rank-badge';
import { HELI_TYPES } from './heli-types';
export type { Rank };
export { RANKS, getRank };

export interface MissionProgress {
    completed: boolean;
    bestTimeMs: number | null;
    count: number;
}

export interface CampaignProgress {
    completed: boolean;
    missions: MissionProgress[];
}

export interface PlayerSession {
    playerName: string; // callsign, max 5 chars A-Z
    highestUnlockedCampaignIndex: number; // highest regular campaign index reachable (for cross-device import)
    campaignProgress: Record<string, CampaignProgress>;
    rankOverride: number; // rank index preserved across device imports
    typeRatings?: Record<string, true>;         // heliId → passed
    typeRatingBestTime?: Record<string, number>; // heliId → best time ms
    typeRatingSystemSince?: number;             // absent/0 = old save (gets migrated), 1 = system active
}


const _default = (): PlayerSession => ({
    playerName: '',
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
    typeRatings: {},
    typeRatingBestTime: {},
    typeRatingSystemSince: 0,
});

export const isUnlocked = (): boolean => storageGet(UNLOCK_KEY) === '1';

export const migrateSession = (s: PlayerSession): void => {
    if (!s.typeRatingSystemSince) {
        s.typeRatingSystemSince = 1;
        if (!s.typeRatings) s.typeRatings = {};
        for (const h of HELI_TYPES) s.typeRatings[h.id] = true;
    }
};

export const loadSession = (): PlayerSession => {
    try {
        const raw = storageGet(STORAGE_KEY);
        if (!raw) return _default();
        const parsed = JSON.parse(raw);
        // Strip legacy fields from old saves
        delete parsed.activeCampaignIndex;
        delete parsed.allUnlocked;
        delete parsed.lastSeenVersion;
        delete parsed.cookieConsent;
        delete parsed.consentTimestamp;
        delete parsed.consentVersion;
        const merged = { ..._default(), ...parsed };
        for (const key of Object.keys(merged.campaignProgress)) {
            const cp = merged.campaignProgress[key];
            if (!Array.isArray(cp?.missions)) cp.missions = [];
        }
        if (!merged.typeRatings) merged.typeRatings = {};
        if (!merged.typeRatingBestTime) merged.typeRatingBestTime = {};
        migrateSession(merged);
        return merged;
    } catch {
        return _default();
    }
};

export const saveSession = (s: PlayerSession): void => {
    try {
        storageSet(STORAGE_KEY, JSON.stringify(s));
    } catch {}
};

export const getMissionsDone = (s: PlayerSession): number =>
    Object.values(s.campaignProgress ?? {}).reduce((sum, cp) =>
        sum + (Array.isArray(cp?.missions) ? cp.missions.filter((m: any) => m?.completed).length : 0), 0);

export const getCampaignsDone = (s: PlayerSession): number =>
    Object.values(s.campaignProgress).filter(cp => cp.completed).length;


export const isCampaignUnlocked = (
    s: PlayerSession,
    campaigns: ReadonlyArray<{ type: string }>,
    index: number
): boolean => {
    const type = campaigns[index]?.type;
    if (!type) return false;
    if (type === CAMPAIGN_TYPE.TUTORIAL) return true;
    // Cross-device import: highest reached campaign unlocks all up to that index
    if (index <= (s.highestUnlockedCampaignIndex ?? 0)) return true;

    // Paywall: non-tutorial, non-free-flight campaigns require full version
    if (type !== CAMPAIGN_TYPE.FREE_FLIGHT && !isUnlocked()) return false;

    // Coast Hawk type rating is the gate for all non-tutorial content
    if (!s.typeRatings?.['coasthawk']) return false;

    if (type === CAMPAIGN_TYPE.FREE_FLIGHT) return true;

    const tutorialIndex = campaigns.findIndex(c => c.type === CAMPAIGN_TYPE.TUTORIAL);
    const tutorialDone = tutorialIndex === -1 || !!s.campaignProgress[String(tutorialIndex)]?.missions[0]?.completed;
    if (!tutorialDone) return false;

    const regular = campaigns
        .map((c, i) => ({ type: c.type, i }))
        .filter(c => c.type !== CAMPAIGN_TYPE.TUTORIAL && c.type !== CAMPAIGN_TYPE.FREE_FLIGHT);
    const pos = regular.findIndex(c => c.i === index);
    if (pos <= 0) return true;
    const prev = regular[pos - 1];
    return (s.highestUnlockedCampaignIndex ?? 0) > prev.i || !!s.campaignProgress[String(prev.i)]?.completed;
};

export const isCampaignPaywalled = (
    campaigns: ReadonlyArray<{ type: string }>,
    index: number
): boolean => {
    const type = campaigns[index]?.type;
    if (!type || type === CAMPAIGN_TYPE.TUTORIAL || type === CAMPAIGN_TYPE.FREE_FLIGHT) return false;
    return !isUnlocked();
};

export const isMissionPaywalled = (campaignType: string, missionIndex: number): boolean => {
    if (campaignType === CAMPAIGN_TYPE.FREE_FLIGHT) return missionIndex !== 1 && !isUnlocked();
    return false;
};

export const isCampaignLockedByTutorial = (
    s: PlayerSession,
    campaigns: ReadonlyArray<{ type: string }>,
    index: number
): boolean => {
    const type = campaigns[index]?.type;
    if (!type || type === CAMPAIGN_TYPE.TUTORIAL) return false;
    if (index <= (s.highestUnlockedCampaignIndex ?? 0)) return false;
    // Missing Coast Hawk type rating → training required stamp for everything
    if (!s.typeRatings?.['coasthawk']) return true;
    // Free flight is unlocked once Coast Hawk rating exists
    if (type === CAMPAIGN_TYPE.FREE_FLIGHT) return false;
    const tutorialIndex = campaigns.findIndex(c => c.type === CAMPAIGN_TYPE.TUTORIAL);
    if (tutorialIndex === -1) return false;
    return !s.campaignProgress[String(tutorialIndex)]?.missions[0]?.completed;
};

export const isMissionUnlocked = (
    s: PlayerSession,
    campaignKey: string,
    missionIndex: number,
    campaignType: string,
    rankIndex = 0,
    missionMinRank = 0,
): boolean => {
    if (campaignType === CAMPAIGN_TYPE.FREE_FLIGHT) {
        // Only mission index 1 (Seenotrettung) is free; all others require full version
        if (missionIndex !== 1 && !isUnlocked()) return false;
        return true;
    }
    if (missionIndex === 0) return true;
    if (campaignType === CAMPAIGN_TYPE.TUTORIAL) {
        const tutorialDone = !!s.campaignProgress[campaignKey]?.missions[0]?.completed;
        if (!tutorialDone) return false;
        return rankIndex >= missionMinRank;
    }
    if (Number(campaignKey) < (s.highestUnlockedCampaignIndex ?? 0)) return true;
    return !!s.campaignProgress[campaignKey]?.missions[missionIndex - 1]?.completed;
};

// ─── Save Code (9-char Base32) ────────────────────────────────────────────────
// Bit layout (45 bits → 9 × 5-bit Base32 chars):
//   [0-1]   rank index                   (2 bits, 0-3)
//   [2-4]   highestUnlockedCampaign      (3 bits, 0-7)
//   [5-7]   active campaign              (3 bits, 0-7)
//   [8-11]  nextMission in active camp.  (4 bits, 0-15)
//   [12-36] callsign                     (5 × 5 bits: A-Z=0-25, null=26)
//   [37-44] checksum                     (8 bits, XOR-fold of bits 0-36)
//
// highest advances past active when a campaign is fully completed (sentinel):
//   active == highest → campaign in progress, completed = false
//   active  < highest → campaign done, completed = true
//
// Alphabet: standard Base32 (RFC 4648) A-Z 2-7, case-insensitive.
// Display format: XXXXX-XXXX
// Old codes (no checksum / 6-bit checksum) are rejected automatically.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const _checksumBits = (bits: number[]): number => {
    let acc = 0;
    for (let i = 0; i < 37; i++) {
        if (bits[i]) acc ^= 1 << (i % 8);
    }
    return acc & 0xff;
};

export const encodeSession = (s: PlayerSession, nonTutorialMissions: number): string => {
    const rankIdx = RANKS.indexOf(getRank(s.rankOverride ?? 0, nonTutorialMissions));
    const highest = Math.min(s.highestUnlockedCampaignIndex ?? 0, 7);
    const activeCp = s.campaignProgress[String(highest)];
    const nextMission = Math.min(activeCp ? activeCp.missions.filter(m => m?.completed).length : 0, 15);
    const callsign = (s.playerName || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 5);

    const bits: number[] = [];
    const push = (val: number, n: number) => {
        for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    push(rankIdx, 2);
    push(highest, 3);
    push(0, 3); // bits [5-7] reserved
    push(nextMission, 4);
    for (let i = 0; i < 5; i++) {
        push(i < callsign.length ? callsign.charCodeAt(i) - 65 : 26, 5);
    }
    push(_checksumBits(bits), 8); // bits is 37 long at this point

    let code = '';
    for (let i = 0; i < 9; i++) {
        const val = bits.slice(i * 5, i * 5 + 5).reduce((a, b) => (a << 1) | b, 0);
        code += B32[val];
    }
    return code.slice(0, 5) + '-' + code.slice(5);
};

export const decodeSession = (input: string): Partial<PlayerSession> | null => {
    const clean = input.toUpperCase().replace(/[^A-Z234567]/g, '');
    if (clean.length !== 9) return null;

    const bits: number[] = [];
    for (const ch of clean) {
        const v = B32.indexOf(ch);
        if (v < 0) return null;
        for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
    }
    const read = (start: number, n: number) => bits.slice(start, start + n).reduce((a, b) => (a << 1) | b, 0);

    if (read(37, 8) !== _checksumBits(bits)) return null; // rejects old/corrupt codes

    const rankIdx = Math.min(read(0, 2), RANKS.length - 1);
    const highestUnlockedCampaignIndex = read(2, 3);
    // bits [5-7] always equal [2-4], discarded
    const nextMission = read(8, 4);

    let playerName = '';
    for (let i = 0; i < 5; i++) {
        const v = read(12 + i * 5, 5);
        if (v === 26) break;
        if (v < 26) playerName += String.fromCharCode(65 + v);
    }

    const campaignProgress: Record<string, CampaignProgress> = {};
    if (nextMission > 0) {
        campaignProgress[String(highestUnlockedCampaignIndex)] = {
            completed: false,
            missions: Array.from({ length: nextMission }, () => ({ completed: true, bestTimeMs: null, count: 1 })),
        };
    }

    return {
        playerName,
        highestUnlockedCampaignIndex,
        rankOverride: rankIdx,
        campaignProgress,
    };
};
