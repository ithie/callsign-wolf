import './back-button.css';
import { I18N } from '@/game/i18n';

export const createBackButton = (onClick: () => void): HTMLElement => {
    const btn = document.createElement('div');
    btn.className = 'back-btn';
    btn.textContent = I18N.BACK;
    btn.addEventListener('click', () => {
        const screen = btn.closest('.ui-screen') as HTMLElement | null;
        if (screen) {
            screen.classList.add('crt-leaving');
            setTimeout(() => { screen.classList.remove('crt-leaving'); onClick(); }, 380);
        } else {
            onClick();
        }
    });
    return btn;
};
