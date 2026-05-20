import './loading-screen.css';
import { ensureEl } from '../dom-helpers';

const MIN_MS = 1000;

export type LoadingHandle = {
    step: (label: string, progress: number) => void;
    done: () => Promise<void>;
};

export const show = (title: string): LoadingHandle => {
    const el = ensureEl('loading-screen');
    el.innerHTML = `
        <div class="loading-title">${title}</div>
        <div class="loading-bar-track"><div class="loading-bar-fill"></div></div>
        <div class="loading-label"></div>
    `;
    el.style.display = 'flex';

    const startTime = Date.now();
    const fill = el.querySelector<HTMLElement>('.loading-bar-fill')!;
    const labelEl = el.querySelector<HTMLElement>('.loading-label')!;

    return {
        step(label: string, progress: number) {
            labelEl.textContent = label;
            fill.style.width = `${progress * 100}%`;
        },
        async done() {
            const elapsed = Date.now() - startTime;
            const remaining = MIN_MS - elapsed;
            if (remaining > 0) await new Promise<void>(r => setTimeout(r, remaining));
            el.classList.add('loading-fade-out');
            await new Promise<void>(r => setTimeout(r, 350));
            el.style.display = 'none';
            el.classList.remove('loading-fade-out');
            el.innerHTML = '';
        },
    };
};
