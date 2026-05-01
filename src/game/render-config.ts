const _isMobile =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
    window.matchMedia('(pointer: coarse)').matches;

const _isApp = import.meta.env.VITE_TARGET === 'app';

export const CANVAS_SCALE = _isMobile ? 0.5 : 1.0;
export const DESKTOP_RENDER_SCALE = 0.6;
// Applied only to web-desktop: keeps the same number of visible tiles while rendering fewer pixels
export const gameRenderScale = (!_isApp && !_isMobile) ? DESKTOP_RENDER_SCALE : 1;

export const tileW = _isMobile ? 32 : 64;
export const tileH = _isMobile ? 16 : 32;
export const stepH = _isMobile ? 12.5 : 25;
