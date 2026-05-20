export const addStamp = (text: string, color: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'stamp-overlay';
    wrap.style.cssText =
        'position:absolute;inset:0;display:flex;align-items:center;' +
        'justify-content:center;pointer-events:none;transform:rotate(-28deg)';
    const stamp = document.createElement('div');
    stamp.textContent = text.replace(/ /g, '\n');
    stamp.style.cssText =
        `color:${color};border:2px solid ${color};` +
        'border-radius:50%;padding:16px;' +
        'box-shadow:0 0 0 4px transparent,inset 0 0 0 2px ' + color + ';' +
        'font-size:13px;font-weight:900;letter-spacing:2px;line-height:1.4;' +
        'opacity:0.85;white-space:pre;text-align:center;' +
        'outline:2px solid ' + color + ';outline-offset:3px';
    wrap.appendChild(stamp);
    return wrap;
};
