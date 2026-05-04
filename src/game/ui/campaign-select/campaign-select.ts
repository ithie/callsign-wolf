import { I18N, localize } from '../../i18n';
import { isCampaignUnlocked, type PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';
import { ensureEl } from '../dom-helpers';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';
import { createSwipeCarousel } from '../swipe-carousel/swipe-carousel';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

type CampaignSelectDeps = {
    session: PlayerSession;
    campaigns: CampaignExport[];
    onSelect: (index: number) => void;
    onBack: () => void;
};

type CampaignItem = CampaignExport & { index: number };

export const mountCampaignSelect = () => {
    ensureEl('campaign-select');
};

export const showCampaignSelect = (deps: CampaignSelectDeps) => {
    const { session, campaigns, onSelect, onBack } = deps;

    const body = mountScreenShell('campaign-select', I18N.CAMPAIGN_SELECT_TITLE, I18N.CAMPAIGN_SELECT_SUB, onBack);

    const typePriority = (t: string) => (t === 'tutorial' ? 0 : t === 'free-flight' ? 1 : 2);
    const displayOrder: CampaignItem[] = campaigns
        .map((c, i) => ({ ...c, index: i }))
        .filter(c => (!_IS_APP ? c.type !== 'multiplayer' : true))
        .sort((a, b) => typePriority(a.type) - typePriority(b.type));

    const carousel = createSwipeCarousel<CampaignItem>({
        items: displayOrder,
        isLocked: c => !isCampaignUnlocked(session, campaigns, c.index),
        renderCard: (c, locked) => {
            const isTutorial = c.type === 'tutorial';
            const isActive = !isTutorial && c.type !== 'free-flight' && session.activeCampaignIndex === c.index;
            const cp = session.campaignProgress[String(c.index)];
            const completedCount = cp?.missions.filter(m => m?.completed).length ?? 0;

            const card = document.createElement('div');

            let content = `<div class="box-label"${isTutorial ? ` style="color:#ff9900"` : ''}>` +
                `${localize(c.campaignTitle)}</div>`;

            if (locked) {
                content += `<div class="box-sub" style="color:#333">${I18N.CAMPAIGN_LOCKED}</div>`;
            } else {
                content += c.campaignSublines.map(s => `<div class="box-sub">${localize(s)}</div>`).join('');
                content += `<div class="box-sub">${I18N.CAMPAIGN_SELECT_MISSIONS}: ${c.levels.length}</div>`;
                if (isActive && completedCount > 0) {
                    content += `<div class="box-sub" style="color:#8af">${completedCount}/${c.levels.length} ${I18N.DONE}</div>`;
                }
            }

            card.innerHTML = content;
            if (isTutorial) card.style.borderColor = '#ff9900';
            return card;
        },
        onTap: c => onSelect(c.index),
    });

    body.appendChild(carousel);
    showScreenCrtEnter('campaign-select');
};
