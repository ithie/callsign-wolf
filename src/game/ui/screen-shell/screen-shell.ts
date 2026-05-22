import '../base.css';
import '../screens.css';
import { ensureEl } from '../dom-helpers';
import { createBackButton } from '../back-button/back-button';

export const mountScreenShell = (
    id: string,
    title: string,
    subtitle: string,
    onBack?: () => void,
): HTMLElement => {
    const root = ensureEl(id);
    root.classList.add('ui-screen');
    root.innerHTML = `
        <div class="title">${title}</div>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        <div class="screen-body"></div>`;
    if (onBack) root.appendChild(createBackButton(onBack));
    return root.querySelector<HTMLElement>('.screen-body')!;
};
