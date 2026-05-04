export const NAV_SCREENS = [
    'splash',
    'main-menu',
    'campaign-select',
    'mission-select',
    'heli-select',
    'credits-screen',
    'settings-screen',
    'legal-screen',
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

/** showScreen + CRT turn-on animation for forward navigation. */
export const showScreenCrtEnter = (id: NavScreen): void => {
    showScreen(id);
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('crt-entering');
    requestAnimationFrame(() => {
        el.classList.add('crt-entering');
        setTimeout(() => el.classList.remove('crt-entering'), 380);
    });
};
