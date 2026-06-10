import './rank-badge.css';
import { I18N } from '../../i18n';

export interface Rank {
    key: string;
    minMissions: number;
}

const _PIPS: Record<string, string> = {
    leutnant:      '★',
    oberleutnant:  '★  ★',
    hauptmann:     '★ ★ ★',
    major:         '◆',
};

export const RANKS: Rank[] = [
    { key: 'leutnant',     minMissions: 0  },
    { key: 'oberleutnant', minMissions: 5  },
    { key: 'hauptmann',    minMissions: 10 },
    { key: 'major',        minMissions: 30 },
];

export const getRank = (rankOverride: number, missions: number): Rank => {
    let derivedIdx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (missions >= RANKS[i].minMissions) {
            derivedIdx = i;
            break;
        }
    }
    return RANKS[Math.max(derivedIdx, rankOverride)];
};

export const rankBadgeHtml = (rank: Rank): string =>
    `<div class="rank-badge${rank.key === 'major' ? ' major' : ''}">` +
    `<span class="rank-pips">${_PIPS[rank.key] ?? ''}</span>` +
    `<span class="rank-label">${I18N.RANK_NAME(rank.key).toUpperCase()}</span>` +
    `</div>`;
