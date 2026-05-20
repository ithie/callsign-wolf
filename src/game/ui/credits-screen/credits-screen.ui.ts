import './credits-screen.css';
import { soundHandler, musicConfig } from '../../main';
import { I18N } from '../../i18n';

import { ensureEl as _ensureEl } from '../dom-helpers';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

export const mount = (onBack: () => void): void => {
    const root = _ensureEl('credits-screen');
    if (root.children.length > 0) return;
    const body = mountScreenShell('credits-screen', I18N.MENU_CREDITS, '', onBack);
    const canvas = document.createElement('canvas');
    canvas.id = 'credits-canvas';
    const inner = document.createElement('div');
    inner.id = 'credits-inner';
    body.appendChild(canvas);
    body.appendChild(inner);
};

export const show = () => {
    _buildCredits();
    showScreenCrtEnter('credits-screen');
    if (musicConfig.credits) soundHandler.play(musicConfig.credits, true);
};

const _buildCredits = () => {
    const inner = document.getElementById('credits-inner')!;
    inner.innerHTML = '';
    const sections: { role: string; names: string[] }[] = [
        { role: I18N.CREDITS_ROLE_DEVELOPMENT, names: ['Yarrick'] },
        { role: I18N.CREDITS_ROLE_CAMPAIGN, names: ['Jay "G" Man'] },
        { role: I18N.CREDITS_ROLE_CONSULTGS, names: ['DBuhn'] },
        { role: I18N.CREDITS_ROLE_SOUND, names: ['Chris "Loud" E.'] },
        { role: I18N.CREDITS_ROLE_RECORDING, names: ['Yarrick'] },
        { role: I18N.CREDITS_ROLE_VOICEARTIST, names: ['Bri B.'] },
        { role: I18N.CREDITS_ROLE_LEADERTEST, names: ['Steven J. McG.'] },
        {
            role: I18N.CREDITS_ROLE_TEST,
            names: ['Da Harp, Jay "G" Man', 'DBuhn, Gaunt', 'Bigwilli, Bri B.', 'Schollfried, Sarahm'],
        },
        { role: I18N.CREDITS_ROLE_INSPIREDBY, names: ['Zeewolf (Binary Asylum, 1994)'] },
    ];
    let delay = 0.15;
    sections.forEach(s => {
        const sec = document.createElement('div');
        sec.className = 'credits-section';
        const role = document.createElement('div');
        role.className = 'credits-role';
        role.textContent = s.role;
        sec.appendChild(role);
        s.names.forEach(nm => {
            const el = document.createElement('div');
            el.className = 'credits-name';
            el.textContent = nm;
            el.style.animationDelay = delay + 's';
            delay += 0.18;
            sec.appendChild(el);
        });
        inner.appendChild(sec);
        const div = document.createElement('div');
        div.className = 'credits-divider';
        inner.appendChild(div);
    });
    const made = document.createElement('div');
    made.className = 'credits-made-with';
    made.textContent = I18N.MADE_WITH;
    inner.appendChild(made);
    const copy = document.createElement('div');
    copy.className = 'credits-copyright';
    copy.textContent = I18N.COPYRIGHT;
    inner.appendChild(copy);
};
