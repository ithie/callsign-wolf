import '@/ui/base.css';
import '@/ui/screens.css';
import { ensureEl } from '@/ui/dom-helpers';
import { createBackButton } from '@/ui/back-button/back-button';

export const mountScreenShell = (
    id: string,
    title: string,
    onBack?: () => void,
): HTMLElement => {
    const root = ensureEl(id);
    root.classList.add('ui-screen');
    root.innerHTML = `
        <div class="title">${title}</div>
        <div class="screen-body"></div>`;
    if (onBack) root.appendChild(createBackButton(onBack));
    return root.querySelector<HTMLElement>('.screen-body')!;
};
