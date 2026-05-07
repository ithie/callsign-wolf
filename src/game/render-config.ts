const _isMobile =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.matchMedia('(pointer: coarse)').matches;

const _isApp = import.meta.env.VITE_TARGET === 'app';

export const CANVAS_SCALE = _isMobile ? 0.5 : 1.0;
export const DESKTOP_RENDER_SCALE = 0.6;
// Applied only to web-desktop: keeps the same number of visible tiles while rendering fewer pixels
export const gameRenderScale = (!_isApp && !_isMobile) ? DESKTOP_RENDER_SCALE : 1;

// App phone: canvas is 3× downscaled → tiles must be ~64/3≈21 for desktop parity; 20 gives slight zoom-out
export const tileW = _isApp ? 20 : _isMobile ? 24 : 64;
export const tileH = _isApp ? 10 : _isMobile ? 12 : 32;
export const stepH = _isApp ? 7.8 : _isMobile ? 9.4 : 25;
