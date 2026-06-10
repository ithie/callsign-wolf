import { createSettingsBtn } from './settings-btn';

export const variants = (): void => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:32px;padding:48px;background:#0a0a0a;min-height:100vh;font-family:monospace;box-sizing:border-box';

    const row = (title: string, ...btns: HTMLButtonElement[]): HTMLElement => {
        const section = document.createElement('div');
        section.style.cssText = 'display:flex;flex-direction:column;gap:12px';
        const heading = document.createElement('div');
        heading.style.cssText = 'font-size:10px;letter-spacing:3px;color:#333;text-transform:uppercase';
        heading.textContent = title;
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
        btns.forEach(b => btnRow.appendChild(b));
        section.append(heading, btnRow);
        return section;
    };

    wrap.appendChild(row('Normal',
        createSettingsBtn('AN'),
        createSettingsBtn('AUS'),
        createSettingsBtn('LADEN'),
    ));

    const active = createSettingsBtn('AN');
    active.style.borderColor = 'var(--accent, #4af)';
    active.style.color = 'var(--accent, #4af)';
    wrap.appendChild(row('Active (highlight)', active, createSettingsBtn('AUS')));

    wrap.appendChild(row('Danger',
        createSettingsBtn('SESSION LÖSCHEN', { danger: true }),
    ));

    document.body.appendChild(wrap);
};
