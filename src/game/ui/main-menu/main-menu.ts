import './main-menu.css';
import { I18N } from '../../i18n';
import { ensureEl as _ensureEl } from '../dom-helpers';
import { showScreen } from '../nav';
import { mountScreenShell } from '../screen-shell/screen-shell';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

type MainMenuCallbacks = {
    onSplashClick: () => void;
    onStart: () => void;
    onMultiplayer?: () => void;
    onSettings: () => void;
    onCredits: () => void;
    onLegal: () => void;
};


let _splashHandler: (() => void) | null = null;
let _menuIntroPlayed = false;
let _menuItemTexts: { el: HTMLElement; text: string }[] = [];
let _audioCtx: AudioContext | null = null;

const _typeBeep = () => {
    try {
        if (!_audioCtx) _audioCtx = new AudioContext();
        const osc = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.type = 'square';
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(0.05, _audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.04);
        osc.start(_audioCtx.currentTime);
        osc.stop(_audioCtx.currentTime + 0.04);
    } catch {}
};

export const mountMainMenu = (cb: MainMenuCallbacks) => {
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
            ${!_IS_APP && cb.onMultiplayer ? `<div class="menu-item" id="menu-item-multiplayer">${I18N.MENU_MULTIPLAYER}</div>` : ''}
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
    if (!_IS_APP) document.getElementById('menu-item-multiplayer')?.addEventListener('click', cb.onMultiplayer!);
    document.getElementById('menu-item-settings')!.addEventListener('click', cb.onSettings);
    document.getElementById('menu-item-credits')!.addEventListener('click', cb.onCredits);
    document.getElementById('menu-item-legal')!.addEventListener('click', cb.onLegal);
};
