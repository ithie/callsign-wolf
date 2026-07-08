import './main-menu.css';
import '@/ui/nav-screens.css';
import { I18N } from '../../i18n';
import { ensureEl as _ensureEl } from '@/ui/dom-helpers';
import { showScreen } from '../nav';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { playSfx } from '../../heli-sound';

type MainMenuCallbacks = {
    onSplashStart?: () => void;
    onSplashClick: () => void;
    onStart: () => void;
    onSettings: () => void;
    onCredits: () => void;
    onLegal: () => void;
};


let _splashHandler: (() => void) | null = null;
let _menuIntroPlayed = false;
let _menuItemTexts: { el: HTMLElement; text: string }[] = [];

const _typeBeep = () => playSfx(520, 0.04, 0.05, 'square');

export const mount = (cb: MainMenuCallbacks) => {
    const splash = _ensureEl('splash');

    if (_splashHandler) {
        splash.removeEventListener('click', _splashHandler);
        _splashHandler = null;
    }

    splash.classList.add('ui-screen');
    splash.innerHTML = `<p class="start-hint">${I18N.SPLASH_HINT}</p>`;

    const ithie = _ensureEl('ithie-splash');
    ithie.innerHTML = `<span class="ithie-text" id="ithie-text"></span><span class="ithie-cursor">_</span>`;

    const logo = _ensureEl('logo-splash');
    logo.innerHTML = `<span class="ithie-text" id="logo-splash-text"></span><span class="ithie-cursor">_</span>`;

    const _typewrite = (el: HTMLElement, text: string) => {
        el.textContent = '';
        let i = 0;
        const tick = () => { if (i < text.length) { el.textContent += text[i++]; _typeBeep(); setTimeout(tick, 65); } };
        tick();
    };

    const _handleSplashClick = () => {
        cb.onSplashStart?.();
        splash.removeEventListener('click', _handleSplashClick);
        _splashHandler = null;

        splash.classList.add('splash-clicked');

        setTimeout(() => {
            showScreen(null);
            splash.classList.remove('splash-clicked');
            ithie.style.display = 'flex';
            ithie.style.transition = 'opacity 500ms ease';
            ithie.getBoundingClientRect();
            ithie.style.opacity = '1';
            _typewrite(document.getElementById('ithie-text')!, 'i.thie softworks.');
        }, 350);

        // flash bright, then cut to black
        setTimeout(() => {
            ithie.style.transition = 'filter 140ms ease-out';
            ithie.getBoundingClientRect();
            ithie.style.filter = 'brightness(4)';
        }, 2000);
        setTimeout(() => {
            ithie.style.transition = 'filter 280ms ease-in';
            ithie.style.filter = 'brightness(0)';
        }, 2140);

        setTimeout(() => {
            ithie.style.display = 'none';
            ithie.style.filter = '';
            ithie.style.transition = '';
            logo.style.display = 'flex';
            logo.style.opacity = '0';
            logo.style.transition = 'opacity 380ms ease';
            logo.getBoundingClientRect();
            logo.style.opacity = '1';
            _typewrite(document.getElementById('logo-splash-text')!, 'To old rekindling flames...');
        }, 2900);

        setTimeout(() => {
            logo.style.transition = 'opacity 380ms ease';
            logo.style.opacity = '0';
        }, 2900 + 380 + 3800);

        setTimeout(() => {
            logo.style.display = 'none';
            logo.style.opacity = '';
            logo.style.transition = '';
            _splashHandler = _handleSplashClick;
            splash.addEventListener('click', _handleSplashClick);
            cb.onSplashClick();
        }, 2900 + 380 + 3800 + 380);
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
            <div class="menu-item" id="menu-item-settings">${I18N.MENU_SETTINGS}</div>
            <div class="menu-item" id="menu-item-credits">${I18N.MENU_CREDITS}</div>
        </nav>
        <div id="menu-item-legal" class="menu-legal-link">${I18N.MENU_LEGAL}</div>`;
    _menuItemTexts = Array.from(
        document.querySelectorAll<HTMLElement>('#main-menu .menu-item')
    ).map(el => ({ el, text: el.textContent ?? '' }));

    if (!_menuIntroPlayed) {
        _menuItemTexts.forEach(({ el }) => { el.textContent = ''; });
        const menuEl = document.getElementById('main-menu')!;
        const obs = new MutationObserver(() => {
            if (menuEl.style.display !== 'none' && !_menuIntroPlayed) {
                _menuIntroPlayed = true;
                obs.disconnect();
                _menuItemTexts.forEach(({ el, text }) => {
                    let i = 0;
                    const type = () => { if (i < text.length) { el.textContent += text[i++]; _typeBeep(); setTimeout(type, 40); } };
                    setTimeout(type, 60);
                });
            }
        });
        obs.observe(menuEl, { attributes: true, attributeFilter: ['style'] });
    }

    document.getElementById('menu-item-start')!.addEventListener('click', cb.onStart);
    document.getElementById('menu-item-settings')!.addEventListener('click', cb.onSettings);
    document.getElementById('menu-item-credits')!.addEventListener('click', cb.onCredits);
    document.getElementById('menu-item-legal')!.addEventListener('click', cb.onLegal);
};
