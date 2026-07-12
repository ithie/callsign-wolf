import './mission-select.css';
import '@/ui/nav-screens.css';
import { I18N, localize } from '../../i18n';
import { ensureEl } from '@/ui/dom-helpers';
import { isMissionUnlocked, type PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';
import { HELI_TYPES } from '../../heli-types';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { createSwipeCarousel } from '@/ui/swipe-carousel/swipe-carousel';
import { hapticImpact, ImpactStyle } from '../../haptics';
import { addStamp } from '../box-stamp';

type MissionSelectDeps = {
    campaign: CampaignExport;
    campaignIndex: number;
    session: PlayerSession;
    rankIndex: number;
    onSelect: (missionIndex: number) => void;
    onBack: () => void;
};

type MissionItem = {
    level: CampaignExport['levels'][number];
    index: number;
    unlocked: boolean;
    done: boolean;
    bestTime: number | null;
};

export const mount = () => {
    ensureEl('mission-select');
};

export const show = (deps: MissionSelectDeps) => {
    const { campaign, campaignIndex, session, rankIndex, onSelect, onBack } = deps;
    const key = String(campaignIndex);
    const cp = session.campaignProgress[key];

    const body = mountScreenShell('mission-select', localize(campaign.campaignTitle), onBack);

    const allItems: MissionItem[] = campaign.levels.map((level, i) => {
        const mp = cp?.missions[i];
        const typeRatingFor = (level as any).typeRatingFor as string | undefined;
        const missionMinRank = typeRatingFor
            ? (HELI_TYPES.find(h => h.id === typeRatingFor)?.minRankIndex ?? 0)
            : 0;
        return {
            level,
            index: i,
            unlocked: isMissionUnlocked(session, key, i, campaign.type, rankIndex, missionMinRank),
            done: mp?.completed ?? false,
            bestTime: mp?.bestTimeMs ?? null,
        };
    });

    // For tutorial campaigns: only show missions that are currently unlocked
    const missionItems = campaign.type === 'tutorial'
        ? allItems.filter(m => m.unlocked)
        : allItems;

    const carousel = createSwipeCarousel<MissionItem>({
        items: missionItems,
        isLocked: m => !m.unlocked,
        renderStamp: (_m, locked) => locked ? addStamp(I18N.NOT_UNLOCKED, '#7a1a1a') : null,
        renderCard: (m) => {
            const card = document.createElement('div');
            let content = `<div class="box-label${m.done ? ' mission-done' : ''}">${localize(m.level.headline)}</div>`;

            if (!m.unlocked) {
                content += `<div class="box-sub" style="color:#333">${I18N.MISSION_LOCKED}</div>`;
            } else {
                content += (m.level.sublines ?? []).map(s => `<div class="box-sub">${localize(s)}</div>`).join('');
                if (m.done && m.bestTime !== null) {
                    content += `<div class="box-sub mission-time">${I18N.BEST_TIME(m.bestTime)}</div>`;
                } else if (m.done) {
                    content += `<div class="box-sub mission-done">✓ ${I18N.DONE}</div>`;
                }
            }

            card.innerHTML = content;
            return card;
        },
        onTap: m => onSelect(m.index),
        haptic: () => hapticImpact(ImpactStyle.Light),
    });

    body.appendChild(carousel);
    showScreenCrtEnter('mission-select');
};
