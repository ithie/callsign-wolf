import './campaign-end-screen.css';
import { ensureEl } from '@/ui/dom-helpers';
import { I18N } from '../../i18n';

let _el: HTMLElement | null = null;
let _onDone: (() => void) | null = null;

export const mount = (onDone: () => void): void => {
    _onDone = onDone;
    _el = ensureEl('campaign-end-screen');
    _el.classList.add('ui-screen');
    _el.addEventListener('click', () => _onDone?.());
};

const _burst = (el: HTMLElement) => {
    const wrap = document.createElement('div');
    wrap.className = 'ced-burst';
    wrap.style.left = `${20 + Math.random() * 60}%`;
    wrap.style.top = `${15 + Math.random() * 55}%`;
    const colors = ['#ff6600', '#ffcc00', '#fff', '#ff9900', '#ffee88', '#ff4444'];
    for (let i = 0; i < 12; i++) {
        const s = document.createElement('div');
        s.className = 'ced-burst-spark';
        s.style.setProperty('--angle', `${i * 30}deg`);
        s.style.setProperty('--dist', `${55 + Math.random() * 70}px`);
        s.style.background = colors[Math.floor(Math.random() * colors.length)];
        s.style.animationDelay = `${Math.random() * 0.08}s`;
        wrap.appendChild(s);
    }
    el.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1300);
};

export const getSections = (): { role: string; names: string[] }[] => [
    { role: I18N.CREDITS_ROLE_DEVELOPMENT, names: ['Yarrick'] },
    { role: I18N.CREDITS_ROLE_CAMPAIGN, names: ['Jay "G" Man'] },
    { role: I18N.CREDITS_ROLE_CONSULTGS, names: ['DBuhn'] },
    { role: I18N.CREDITS_ROLE_SOUND, names: ['Chris "Loud" E.'] },
    { role: I18N.CREDITS_ROLE_LEADERTEST, names: ['Steven J. McG.'] },
    {
        role: I18N.CREDITS_ROLE_TEST,
        names: ['Da Harp', 'Jay "G" Man', 'DBuhn', 'Bigwilli', 'Mrs Beer', 'deathnical', 'SkzStay15'],
    },
    {
        role: I18N.CREDITS_ROLE_SANDBOX,
        names: ['Peer V. Rse'],
    },
    { role: I18N.CREDITS_ROLE_INSPIREDBY, names: ['Zeewolf (Binary Asylum, 1994)'] },
];

const _scheduleBursts = (el: HTMLElement, startDelay: number) => {
    [1200, 3800, 6500, 9500, 13000, 17000, 21000].forEach(t => setTimeout(() => _burst(el), startDelay + t));
};

export const show = (campaignName: string, onCreditsStart?: () => void): void => {
    if (!_el) return;

    const blocksHtml = getSections()
        .map(
            s => `
        <div class="ced-block">
            <div class="ced-role">${s.role}</div>
            ${s.names.map(n => `<div class="ced-name">${n}</div>`).join('')}
        </div>`
        )
        .join('');

    _el.innerHTML = `
        <div class="ced-scroll-wrap">
            <div class="ced-scroll-inner" id="ced-scroll-inner">
                <div class="ced-phase1-block">
                    <div class="ced-complete">${I18N.CAMPAIGN_COMPLETE}</div>
                    ${campaignName ? `<div class="ced-campaign-name">${campaignName}</div>` : ''}
                    <div class="ced-cleared">${I18N.ALL_MISSIONS_CLEARED}</div>
                </div>
                ${blocksHtml}
            </div>
        </div>
        <div class="ced-footer" id="ced-footer">
            <div class="ced-made">MADE WITH <span class="ced-heart">♥</span> IN JAVASCRIPT</div>
            <div class="ced-copyright">${I18N.COPYRIGHT}</div>
        </div>`;

    _el.style.display = 'flex';

    setTimeout(() => {
        const inner = document.getElementById('ced-scroll-inner');
        inner?.classList.add('ced-rolling');
        onCreditsStart?.();

        setTimeout(() => {
            document.getElementById('ced-footer')?.classList.add('ced-footer-visible');
        }, 12000);

        _scheduleBursts(_el!, 0);
    }, 1500);
};

export const hide = (): void => {
    if (_el) _el.style.display = 'none';
};
