export const ensureEl = (id: string): HTMLElement => {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
    return el;
};
