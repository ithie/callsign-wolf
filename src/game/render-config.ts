const _isIPad = (
    navigator.userAgent.includes('iPad') ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
);

export const CANVAS_SCALE = 0.5;
export const gameRenderScale = 1;

export const tileW = _isIPad ? 28 : 20;
export const tileH = _isIPad ? 14 : 10;
export const stepH = _isIPad ? 10.9 : 7.8;
