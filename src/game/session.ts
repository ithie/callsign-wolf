export const STORAGE_KEY = 'z_session';

import { storageGet, storageSet } from './storage';
import { CAMPAIGN_TYPE } from '../shared/types';

export interface MissionProgress {
    completed: boolean;
    bestTimeMs: number | null;
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
}

export interface Rank {
    name: string;
    pips: string;
    minMissions: number;
}

export const RANKS: Rank[] = [
    { name: 'Leutnant', pips: '★', minMissions: 0 },
    { name: 'Oberleutnant', pips: '★  ★', minMissions: 5 },
    { name: 'Hauptmann', pips: '★ ★ ★', minMissions: 10 },
    { name: 'Major', pips: '◆', minMissions: 30 },
];

const _default = (): PlayerSession => ({
    playerName: '',
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
});

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
        return { ..._default(), ...parsed };
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
    Object.values(s.campaignProgress).reduce((sum, cp) => sum + cp.missions.filter(m => m.completed).length, 0);

export const getCampaignsDone = (s: PlayerSession): number =>
    Object.values(s.campaignProgress).filter(cp => cp.completed).length;

export const getRank = (s: PlayerSession, nonTutorialMissions?: number): Rank => {
    const missions = nonTutorialMissions ?? getMissionsDone(s);
    let derivedIdx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (missions >= RANKS[i].minMissions) {
            derivedIdx = i;
            break;
        }
    }
    return RANKS[Math.max(derivedIdx, s.rankOverride ?? 0)];
};

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

    if (type === CAMPAIGN_TYPE.FREE_FLIGHT) return true;

    const tutorialIndex = campaigns.findIndex(c => c.type === CAMPAIGN_TYPE.TUTORIAL);
    const tutorialDone = tutorialIndex === -1 || !!s.campaignProgress[String(tutorialIndex)]?.completed;
    if (!tutorialDone) return false;

    const regular = campaigns
        .map((c, i) => ({ type: c.type, i }))
        .filter(c => c.type !== CAMPAIGN_TYPE.TUTORIAL && c.type !== CAMPAIGN_TYPE.FREE_FLIGHT);
    const pos = regular.findIndex(c => c.i === index);
    if (pos <= 0) return true;
    const prev = regular[pos - 1];
    return !!s.campaignProgress[String(prev.i)]?.completed;
};

export const isCampaignLockedByTutorial = (
    s: PlayerSession,
    campaigns: ReadonlyArray<{ type: string }>,
    index: number
): boolean => {
    const type = campaigns[index]?.type;
    if (!type || type === CAMPAIGN_TYPE.TUTORIAL || type === CAMPAIGN_TYPE.FREE_FLIGHT) return false;
    if (index <= (s.highestUnlockedCampaignIndex ?? 0)) return false;
    const tutorialIndex = campaigns.findIndex(c => c.type === CAMPAIGN_TYPE.TUTORIAL);
    if (tutorialIndex === -1) return false;
    return !s.campaignProgress[String(tutorialIndex)]?.completed;
};

export const isMissionUnlocked = (
    s: PlayerSession,
    campaignKey: string,
    missionIndex: number,
    campaignType: string
): boolean => {
    if (campaignType === CAMPAIGN_TYPE.FREE_FLIGHT) return true;
    if (missionIndex === 0) return true;
    return !!s.campaignProgress[campaignKey]?.missions[missionIndex - 1]?.completed;
};

// ─── Save Code (9-char Base32) ────────────────────────────────────────────────
// Bit layout (45 bits → 9 × 5-bit Base32 chars):
//   [0-1]   rank index                   (2 bits, 0-3)
//   [2-4]   highestUnlockedCampaign      (3 bits, 0-7)
//   [5-7]   activeCampaignIndex          (3 bits, 0-7)
//   [8-11]  nextMission in active camp.  (4 bits, 0-15)
//   [12-36] callsign                     (5 × 5 bits: A-Z=0-25, null=26)
//   [37-44] checksum                     (8 bits, XOR-fold of bits 0-36)
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
    const rankIdx = RANKS.indexOf(getRank(s, nonTutorialMissions));
    const highest = Math.min(s.highestUnlockedCampaignIndex ?? 0, 7);
    const activeEntry = Object.entries(s.campaignProgress)
        .filter(([, cp]) => cp.missions.some(m => m.completed))
        .sort((a, b) => Number(b[0]) - Number(a[0]))[0];
    const active = activeEntry ? Math.min(Number(activeEntry[0]), 7) : 0;
    const activeCp = activeEntry?.[1];
    const nextMission = Math.min(activeCp ? activeCp.missions.filter(m => m.completed).length : 0, 15);
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
    push(active, 3);
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
    const activeCampaignIndex = read(5, 3);
    const nextMission = read(8, 4);

    let playerName = '';
    for (let i = 0; i < 5; i++) {
        const v = read(12 + i * 5, 5);
        if (v === 26) break;
        if (v < 26) playerName += String.fromCharCode(65 + v);
    }

    // Reconstruct partial campaign progress for active campaign
    const campaignProgress: Record<string, CampaignProgress> = {};
    if (nextMission > 0) {
        campaignProgress[String(activeCampaignIndex)] = {
            completed: false,
            missions: Array.from({ length: nextMission }, () => ({ completed: true, bestTimeMs: null })),
        };
    }

    return {
        playerName,
        highestUnlockedCampaignIndex,
        rankOverride: rankIdx,
        campaignProgress,
    };
};
