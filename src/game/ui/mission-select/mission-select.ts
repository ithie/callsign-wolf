import './mission-select.css';
import '../nav-screens.css';
import { I18N, localize } from '../../i18n';
import { ensureEl } from '../dom-helpers';
import { isMissionUnlocked, type PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';
import { createSwipeCarousel } from '../swipe-carousel/swipe-carousel';
import { addStamp } from '../box-stamp';

type MissionSelectDeps = {
    campaign: CampaignExport;
    campaignIndex: number;
    session: PlayerSession;
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
    const { campaign, campaignIndex, session, onSelect, onBack } = deps;
    const key = String(campaignIndex);
    const cp = session.campaignProgress[key];

    const body = mountScreenShell('mission-select', localize(campaign.campaignTitle), I18N.MISSION_SELECT_SUB, onBack);

    const missionItems: MissionItem[] = campaign.levels.map((level, i) => {
        const mp = cp?.missions[i];
        return {
            level,
            index: i,
            unlocked: isMissionUnlocked(session, key, i, campaign.type),
            done: mp?.completed ?? false,
            bestTime: mp?.bestTimeMs ?? null,
        };
    });

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
    });

    body.appendChild(carousel);
    showScreenCrtEnter('mission-select');
};
