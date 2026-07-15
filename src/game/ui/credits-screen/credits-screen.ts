import './credits-screen.css';
import { soundHandler } from '../../main';
import { I18N } from '../../i18n';

import { ensureEl as _ensureEl } from '@/ui/dom-helpers';
import { showScreenCrtEnter } from '../nav';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { getSections } from '../campaign-end-screen/campaign-end-screen';

let _onBack: () => void = () => {};

export const mount = (onBack: () => void): void => {
    _onBack = onBack;
    _ensureEl('credits-screen');
};

export const show = () => {
    const body = mountScreenShell('credits-screen', I18N.MENU_CREDITS, _onBack);
    const canvas = document.createElement('canvas');
    canvas.id = 'credits-canvas';
    const inner = document.createElement('div');
    inner.id = 'credits-inner';
    body.appendChild(canvas);
    body.appendChild(inner);
    _buildCredits();
    showScreenCrtEnter('credits-screen');
    soundHandler.play('spocktribute');
};

const _buildCredits = () => {
    const inner = document.getElementById('credits-inner')!;
    inner.innerHTML = '';

    let delay = 0.15;
    getSections().forEach(s => {
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
