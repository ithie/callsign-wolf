const _isApp = import.meta.env.VITE_TARGET === 'app';

const _isIPad = _isApp && (
    navigator.userAgent.includes('iPad') ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
);

export const CANVAS_SCALE = _isApp ? 0.5 : 1.0;
export const DESKTOP_RENDER_SCALE = 0.6;
export const gameRenderScale = _isApp ? 1 : DESKTOP_RENDER_SCALE;

export const tileW = _isIPad ? 28 : _isApp ? 20 : 64;
export const tileH = _isIPad ? 14 : _isApp ? 10 : 32;
export const stepH = _isIPad ? 10.9 : _isApp ? 7.8 : 25;
