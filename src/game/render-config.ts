const _isMac = (window as any).__platform === 'mac';
const _isIPad = !_isMac && (
    navigator.userAgent.includes('iPad') ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
);
// Fallback for desktop browsers and the VS Code preview panel (no __platform, no touch).
// screen.width on iPhone = portrait pt (~393), on Mac = display width (~1440+).
const _isLarge = !_isMac && !_isIPad && window.screen.width > 500;

export const CANVAS_SCALE = 0.5;
export const gameRenderScale = 1;

// Target ~20 visible tiles across the screen width (same as iPhone).
// Mac (~1200 pt wide): tileW 52 → ~23 tiles. _isLarge (800 pt preview): tileW 40 → ~20 tiles.
export const tileW = _isMac ? 52 : _isLarge ? 40 : _isIPad ? 34 : 20;
export const tileH = _isMac ? 26 : _isLarge ? 20 : _isIPad ? 17 : 10;
export const stepH = _isMac ? 20 : _isLarge ? 15.6 : _isIPad ? 13.3 : 7.8;
