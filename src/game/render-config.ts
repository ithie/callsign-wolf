const _isMac = (window as any).__platform === 'mac';
const _isIPad = !_isMac && (
    navigator.userAgent.includes('iPad') ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
);

export const CANVAS_SCALE = 0.5;
export const gameRenderScale = 1;

export const tileW = _isMac ? 32 : _isIPad ? 28 : 20;
export const tileH = _isMac ? 16 : _isIPad ? 14 : 10;
export const stepH = _isMac ? 12.5 : _isIPad ? 10.9 : 7.8;
