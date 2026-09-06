const _isMac = (window as any).__platform === 'mac';
const _isIPad =
    !_isMac &&
    (navigator.userAgent.includes('iPad') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));
// Fallback for desktop browsers and the VS Code preview panel (no __platform, no touch).
// screen.width on iPhone = portrait pt (~393), on Mac = display width (~1440+).
const _isLarge = !_isMac && !_isIPad && window.screen.width > 500;

export const CANVAS_SCALE = 0.4;
export const gameRenderScale = CANVAS_SCALE / 0.5;

// Target ~20 visible tiles across the screen width (same as iPhone).
// Mac (~1200 pt wide): tileW 52 → ~23 tiles. _isLarge (800 pt preview): tileW 40 → ~20 tiles.
export const tileW = _isMac ? 52 : _isLarge ? 40 : _isIPad ? 34 : 17;
export const tileH = tileW / 2;
export const stepH = tileH * 0.78;
