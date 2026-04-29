import './rankup.css';
import { I18N } from '../../i18n';
import { ensureEl } from '../dom-helpers';
import type { Rank } from '../../session';

export const rankBadgeHtml = (rank: Rank): string =>
    `<div class="rank-board${rank.name === 'Major' ? ' major' : ''}">` +
    `<span class="rank-pips">${rank.pips}</span>` +
    `<span class="rank-label">${rank.name.toUpperCase()}</span>` +
    `</div>`;

export const mountRankup = (): void => {
    const el = ensureEl('rankup-overlay');
    el.innerHTML = `
        <div id="rankup-label">${I18N.RANKUP_TITLE}</div>
        <div id="rankup-badge"></div>
        <div id="rankup-title"></div>
        <div id="rankup-address"></div>
        <div id="rankup-heli" style="display:none">
            <div class="rankup-heli-label">${I18N.RANKUP_HELI_UNLOCK}</div>
            <div class="rankup-heli-name"></div>
        </div>
        <p class="start-hint" style="color: #cc9900; margin-top: 10px">${I18N.NEXT}</p>`;
    el.addEventListener('click', dismissRankUp);
};

export const showRankUp = (rank: Rank, playerName: string, unlockedHeli?: string): void => {
    (document.getElementById('rankup-badge') as HTMLElement).innerHTML = rankBadgeHtml(rank);
    (document.getElementById('rankup-title') as HTMLElement).textContent = rank.name.toUpperCase();
    (document.getElementById('rankup-address') as HTMLElement).textContent = I18N.PILOT_ADDRESS(
        rank.name,
        playerName
    ).toUpperCase();
    const heliEl = document.getElementById('rankup-heli') as HTMLElement;
    if (unlockedHeli) {
        (heliEl.querySelector('.rankup-heli-name') as HTMLElement).textContent = unlockedHeli;
        heliEl.style.display = 'flex';
    } else {
        heliEl.style.display = 'none';
    }
    (document.getElementById('rankup-overlay') as HTMLElement).style.display = 'flex';
};

export const dismissRankUp = (): void => {
    (document.getElementById('rankup-overlay') as HTMLElement).style.display = 'none';
};
