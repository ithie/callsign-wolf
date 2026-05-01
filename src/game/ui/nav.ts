export const NAV_SCREENS = [
    'splash',
    'main-menu',
    'campaign-select',
    'mission-select',
    'heli-select',
    'credits-screen',
    'settings-screen',
] as const;

export type NavScreen = typeof NAV_SCREENS[number];

/** Show one nav screen and hide all others. Pass null to hide all. */
export const showScreen = (id: NavScreen | null): void => {
    NAV_SCREENS.forEach(s => {
        const el = document.getElementById(s);
        if (!el) return;
        if (s === id) {
            el.style.display = 'flex';
            el.scrollTop = 0;
        } else {
            el.style.display = 'none';
        }
    });
};
