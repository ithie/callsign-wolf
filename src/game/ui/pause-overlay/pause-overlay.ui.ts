import { mount, show } from './pause-overlay';

export const Standard = () => {
    mount({
        isMusicEnabled:  () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => true,
        setSfxEnabled:   (_v: boolean) => {},
        getControlMode:  () => 'screen' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => false,
        onPause:  () => {},
        onResume: () => {},
        onAbort:  () => {},
    });
    show();
};

export const AllesStumm = () => {
    mount({
        isMusicEnabled:  () => false,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => false,
        setSfxEnabled:   (_v: boolean) => {},
        getControlMode:  () => 'screen' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => false,
        onPause:  () => {},
        onResume: () => {},
        onAbort:  () => {},
    });
    show();
};

export const TouchHeading = () => {
    mount({
        isMusicEnabled:  () => true,
        setMusicEnabled: (_v: boolean) => {},
        isSfxEnabled:    () => true,
        setSfxEnabled:   (_v: boolean) => {},
        getControlMode:  () => 'heading' as const,
        setControlMode:  (_m: 'heading' | 'screen') => {},
        isTouchDevice:   () => true,
        onPause:  () => {},
        onResume: () => {},
        onAbort:  () => {},
    });
    show();
};
