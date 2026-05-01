import './main-menu.css';
import { I18N } from '../../i18n';
import { ensureEl as _ensureEl } from '../dom-helpers';
import { showScreen } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

type MainMenuCallbacks = {
    onStart: () => void;
    onMultiplayer?: () => void;
    onSettings: () => void;
    onCredits: () => void;
    onSplashClick: () => void;
};

let _splashHandler: (() => void) | null = null;

export const mountMainMenu = (cb: MainMenuCallbacks) => {
    const splash = _ensureEl('splash');

    // Remove previous handler before remounting to avoid duplicate listeners
    if (_splashHandler) {
        splash.removeEventListener('click', _splashHandler);
        _splashHandler = null;
    }

    splash.classList.add('ui-screen');
    splash.innerHTML = `
        <div class="title">${I18N.SPLASH_TITLE}</div>
        <div class="subtitle" id="splash-version"></div>
        <canvas id="menu-heli-big"></canvas>
        <p class="start-hint">${I18N.SPLASH_HINT}</p>`;

    // i.thie softworks interstitial — created once, managed manually (not a nav screen)
    const ithie = _ensureEl('ithie-splash');
    ithie.innerHTML = `<span class="ithie-text" id="ithie-text"></span><span class="ithie-cursor">_</span>`;

    const _typewrite = (text: string) => {
        const el = document.getElementById('ithie-text')!;
        el.textContent = '';
        let i = 0;
        const tick = () => { if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, 65); } };
        tick();
    };

    const _handleSplashClick = () => {
        splash.removeEventListener('click', _handleSplashClick);
        _splashHandler = null;

        // 1. flicker: CSS animation via class
        splash.classList.add('splash-clicked');

        // 2. CRT collapse starts mid-flicker so the white bleeds into the implosion
        setTimeout(() => { splash.classList.add('crt-collapse'); }, 150);

        // 3. hide splash, show interstitial, start typewriter
        setTimeout(() => {
            showScreen(null);
            splash.classList.remove('splash-clicked', 'crt-collapse');
            ithie.style.display = 'flex';
            ithie.style.transition = 'opacity 500ms ease';
            ithie.getBoundingClientRect(); // force reflow so transition fires
            ithie.style.opacity = '1';
            _typewrite('i.thie softworks.');
        }, 560);

        // 4. fade out interstitial (hold = 520..2220ms = 1700ms)
        setTimeout(() => {
            ithie.style.transition = 'opacity 600ms ease';
            ithie.style.opacity = '0';
        }, 2220);

        // 5. hand off to callback
        setTimeout(() => {
            ithie.style.display = 'none';
            _splashHandler = _handleSplashClick;
            splash.addEventListener('click', _handleSplashClick);
            cb.onSplashClick();
        }, 2900);
    };

    _splashHandler = _handleSplashClick;
    splash.addEventListener('click', _handleSplashClick);

    const menuBody = mountScreenShell('main-menu', I18N.MENU_TITLE, I18N.MENU_SUBTITLE);
    const menuRoot = document.getElementById('main-menu')!;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'main-menu-bg-canvas';
    menuRoot.insertBefore(bgCanvas, menuRoot.firstChild);
    menuBody.innerHTML = `
        <nav class="menu-nav">
            <div class="menu-item" id="menu-item-start">${I18N.MENU_START}</div>
            ${!_IS_APP && cb.onMultiplayer ? `<div class="menu-item" id="menu-item-multiplayer">${I18N.MENU_MULTIPLAYER}</div>` : ''}
            <div class="menu-item" id="menu-item-settings">${I18N.MENU_SETTINGS}</div>
            <div class="menu-item" id="menu-item-credits">${I18N.MENU_CREDITS}</div>
        </nav>`;
    document.getElementById('menu-item-start')!.addEventListener('click', cb.onStart);
    if (!_IS_APP) document.getElementById('menu-item-multiplayer')?.addEventListener('click', cb.onMultiplayer!);
    document.getElementById('menu-item-settings')!.addEventListener('click', cb.onSettings);
    document.getElementById('menu-item-credits')!.addEventListener('click', cb.onCredits);
};
