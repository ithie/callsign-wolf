import { I18N, localize } from '../../i18n';
import { isCampaignUnlocked, type PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';
import { ensureEl } from '../dom-helpers';
import { showScreen } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

type CampaignSelectDeps = {
    session: PlayerSession;
    campaigns: CampaignExport[];
    onSelect: (index: number) => void;
    onBack: () => void;
};

export const mountCampaignSelect = () => {
    ensureEl('campaign-select');
};

export const showCampaignSelect = (deps: CampaignSelectDeps) => {
    const { session, campaigns, onSelect, onBack } = deps;

    const body = mountScreenShell('campaign-select', I18N.CAMPAIGN_SELECT_TITLE, I18N.CAMPAIGN_SELECT_SUB, onBack);

    const grid = document.createElement('div');
    grid.className = 'campaign-grid';
    grid.id = 'campaign-grid';
    body.appendChild(grid);

    const typePriority = (t: string) => (t === 'tutorial' ? 0 : t === 'free-flight' ? 1 : 2);
    const displayOrder = campaigns
        .map((c, i) => ({ ...c, index: i }))
        .filter(c => c.type !== 'glider' && (!_IS_APP ? c.type !== 'multiplayer' : true))
        .sort((a, b) => typePriority(a.type) - typePriority(b.type));

    displayOrder.forEach(({ campaignTitle, campaignSublines, levels, type, index }) => {
        const locked = !isCampaignUnlocked(session, campaigns, index);
        const isTutorial = type === 'tutorial';
        const isActive = !isTutorial && type !== 'free-flight' && session.activeCampaignIndex === index;
        const cp = session.campaignProgress[String(index)];
        const completedCount = cp?.missions.filter(m => m?.completed).length ?? 0;

        const tile = document.createElement('div');
        tile.className = `grid-box${locked ? ' locked' : ''}`;
        if (isTutorial) tile.style.borderColor = '#ff9900';

        let sublines = campaignSublines.map(s => `<div class="box-sub">${localize(s)}</div>`).join('');
        sublines += `<div class="box-sub">${I18N.CAMPAIGN_SELECT_MISSIONS}: ${levels.length}</div>`;
        if (isActive && completedCount > 0) {
            sublines += `<div class="box-sub" style="color:#8af">${completedCount}/${levels.length} ${I18N.DONE}</div>`;
        }

        tile.innerHTML =
            `<div class="box-label"${isTutorial ? ` style="color: #ff9900"` : ''}>` +
            `${localize(campaignTitle)}</div>` +
            (locked ? `<div class="box-sub" style="color:#333">${I18N.CAMPAIGN_LOCKED}</div>` : sublines);

        if (!locked) tile.addEventListener('click', () => onSelect(index));
        grid.appendChild(tile);
    });

    showScreen('campaign-select');
};
