export const soundHandler = {
    state: { activeTheme: '', isMuted: true },
    mute: () => {},
    unmute: () => {},
    play: (_theme: string, _fade: boolean, _volume?: number) => {},
    stop: () => {},
};

export const musicConfig: { mainMenu: string; credits: string; success: string; defeat: string } = {
    mainMenu: '',
    credits: '',
    success: '',
    defeat: '',
};
