import { mount, show } from './pause-overlay';

export const Standard = () => {
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
