import './mission-select.css';
import '@/ui/nav-screens.css';
import { I18N, localize } from '../../i18n';
import { ensureEl } from '@/ui/dom-helpers';
import { isMissionUnlocked, isMissionPaywalled, type PlayerSession } from '../../session';
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
    onSelect: (missionIndex: number, endless?: boolean) => void;
    onBack: () => void;
    onShowPaywall: () => void;
};

type MissionItem = {
    level: CampaignExport['levels'][number];
    index: number;
    unlocked: boolean;
    done: boolean;
    bestTime: number | null;
    endlessBest: number | null;
    hasEndless: boolean;
};

export const mount = () => {
    ensureEl('mission-select');
};

export const show = (deps: MissionSelectDeps) => {
    const { campaign, campaignIndex, session, rankIndex, onSelect, onBack, onShowPaywall } = deps;
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
            endlessBest: mp?.endlessBest ?? null,
            hasEndless: (level as any).endless === true,
        };
    });

    // For tutorial campaigns: only show missions that are currently unlocked
    const missionItems = campaign.type === 'tutorial'
        ? allItems.filter(m => m.unlocked)
        : allItems;

    const showModeOverlay = (m: MissionItem) => {
        hapticImpact(ImpactStyle.Light);
        const overlay = document.createElement('div');
        overlay.className = 'mission-mode-overlay';

        const panel = document.createElement('div');
        panel.className = 'mission-mode-panel';

        const title = document.createElement('div');
        title.className = 'mission-mode-panel-title';
        title.textContent = localize(m.level.headline);
        panel.appendChild(title);

        const btnTime = document.createElement('button');
        btnTime.className = 'mission-mode-choice mission-mode-choice--timed';
        btnTime.tabIndex = -1;
        const timeLabel = document.createElement('span');
        timeLabel.className = 'mission-mode-choice-label';
        timeLabel.textContent = I18N.MODE_TIMED;
        const timeSub = document.createElement('span');
        timeSub.className = 'mission-mode-choice-sub';
        timeSub.textContent = m.bestTime !== null ? I18N.BEST_TIME(m.bestTime) : (m.done ? `✓ ${I18N.DONE}` : '');
        btnTime.append(timeLabel, timeSub);

        const btnEndless = document.createElement('button');
        btnEndless.className = 'mission-mode-choice mission-mode-choice--endless';
        btnEndless.tabIndex = -1;
        const endlessLabel = document.createElement('span');
        endlessLabel.className = 'mission-mode-choice-label';
        endlessLabel.textContent = I18N.MODE_ENDLESS;
        const endlessSub = document.createElement('span');
        endlessSub.className = 'mission-mode-choice-sub';
        endlessSub.textContent = m.endlessBest !== null ? I18N.ENDLESS_BEST(m.endlessBest) : '';
        btnEndless.append(endlessLabel, endlessSub);

        btnTime.addEventListener('click', () => { overlay.remove(); hapticImpact(ImpactStyle.Light); onSelect(m.index, false); });
        btnEndless.addEventListener('click', () => { overlay.remove(); hapticImpact(ImpactStyle.Light); onSelect(m.index, true); });
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        panel.append(btnTime, btnEndless);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    };

    const carousel = createSwipeCarousel<MissionItem>({
        items: missionItems,
        isLocked: m => !m.unlocked,
        renderStamp: (m, locked) => {
            if (!locked) return null;
            if (isMissionPaywalled(campaign.type, m.index)) return addStamp(I18N.FULL_VERSION_BADGE, '#8850cc');
            return addStamp(I18N.NOT_UNLOCKED, '#7a1a1a');
        },
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
                if (m.hasEndless && m.endlessBest !== null) {
                    content += `<div class="box-sub mission-time">${I18N.ENDLESS_BEST(m.endlessBest)}</div>`;
                }
            }

            card.innerHTML = content;
            return card;
        },
        onTap: m => { if (m.hasEndless) showModeOverlay(m); else onSelect(m.index, false); },
        onLockedTap: m => {
            if (isMissionPaywalled(campaign.type, m.index)) onShowPaywall();
        },
        haptic: () => hapticImpact(ImpactStyle.Light),
    });

    body.appendChild(carousel);
    showScreenCrtEnter('mission-select');
};
