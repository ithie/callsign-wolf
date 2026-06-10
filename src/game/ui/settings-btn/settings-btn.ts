import './settings-btn.css';

type Opts = { id?: string; danger?: boolean };

export const createSettingsBtn = (label: string, opts: Opts = {}): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = 'settings-btn' + (opts.danger ? ' danger' : '');
    btn.textContent = label;
    if (opts.id) btn.id = opts.id;
    return btn;
};
