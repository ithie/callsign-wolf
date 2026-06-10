import { RANKS } from './rank-badge';
import { rankBadgeHtml } from './rank-badge';

export const allRanks = (): void => {
    const container = document.createElement('div');
    container.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'gap:32px',
        'padding:48px',
        'justify-content:center',
        'align-items:center',
        'min-height:100vh',
        'background:#0a0a0a',
        'box-sizing:border-box',
        'font-family:monospace',
    ].join(';');

    for (const rank of RANKS) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px';
        wrap.innerHTML = rankBadgeHtml(rank);
        const label = document.createElement('span');
        label.style.cssText = 'font-size:10px;letter-spacing:3px;color:#444;text-transform:uppercase';
        label.textContent = `ab ${rank.minMissions} Einsätzen`;
        wrap.appendChild(label);
        container.appendChild(wrap);
    }
    document.body.appendChild(container);
};
