import { mount, show } from './pause-overlay';

const _setTint = (hex = '#ff6600') => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--heli-color', hex);
    document.documentElement.style.setProperty('--heli-color-rgb', `${r}, ${g}, ${b}`);
};

export const Standard = () => {
    _setTint('#ff6600');
    mount({
        isMusicEnabled: () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled: () => true,
        setSfxEnabled: (_v: boolean) => {},
        onPause: () => {},
        onResume: () => {},
        onAbort: () => {},
    });
    show();
};

export const AllesStumm = () => {
    _setTint('#55aadd');
    mount({
        isMusicEnabled: () => false,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled: () => false,
        setSfxEnabled: (_v: boolean) => {},
        onPause: () => {},
        onResume: () => {},
        onAbort: () => {},
    });
    show();
};

export const TouchHeading = () => {
    _setTint('#4e8c38');
    mount({
        isMusicEnabled: () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled: () => true,
        setSfxEnabled: (_v: boolean) => {},
        onPause: () => {},
        onResume: () => {},
        onAbort: () => {},
    });
    show();
};
