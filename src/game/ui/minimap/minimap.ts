import './minimap.css';

const MM_SIZE = 130;
// Terrain canvas is rendered at MM_SS× the display resolution and then scaled back down
// via CSS, so zooming in (see below) never blows up the coastline strokes into thick,
// blurry lines — lineWidth in initMinimapTerrain is scaled up by the same factor to
// compensate, keeping the line visually thin (~1px) at every zoom level.
const MM_SS = 3;
const CONE_LEN = 28;
const CONE_HALF_ANGLE = Math.PI / 5.5; // ~33°

// Speed-dependent minimap zoom: full speed = whole map (as before), slow/hover = tight
// window around the helicopter for precise placement — especially on large maps like
// Zephyr. Continuously interpolated, no hard cutover.
const ZOOM_OUT_KMH = 100; // at/above this speed: whole map
const ZOOM_IN_KMH = 15; // at/below this speed: tightest window
const MAX_ZOOM_RATIO = 3; // tightest window is at most this many times closer than the full map
const EDGE_MARGIN = 6; // px gap to the minimap border so dots aren't clipped
// Zoom change is eased over time (not just over distance/speed) so it never snaps —
// time, in ms, for the zoom level to cover half the remaining distance to its target.
const ZOOM_SMOOTH_HALFLIFE_MS = 1000;

let _el: HTMLElement | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _overlayCanvas: HTMLCanvasElement | null = null;
let _overlayCtx: CanvasRenderingContext2D | null = null;
let _pad: HTMLElement;
let _carrier: HTMLElement;
let _heli: HTMLElement;
let _pool: HTMLElement[] = [];
let _smoothZoomT = 0;
let _lastZoomUpdateMs = 0;

const _getDot = (i: number): HTMLElement => {
    if (!_pool[i]) {
        const dot = document.createElement('div');
        dot.className = 'minimap-dot';
        _el!.appendChild(dot);
        _pool.push(dot);
    }
    return _pool[i];
};

export const mountMinimap = (): void => {
    if (_el) return;
    _el = document.createElement('div');
    _el.id = 'minimap-dom';

    _canvas = document.createElement('canvas');
    _canvas.width = MM_SIZE * MM_SS;
    _canvas.height = MM_SIZE * MM_SS;
    _canvas.style.cssText = `position:absolute;top:0;left:0;width:${MM_SIZE}px;height:${MM_SIZE}px;`;
    _el.appendChild(_canvas);

    _overlayCanvas = document.createElement('canvas');
    _overlayCanvas.width = MM_SIZE;
    _overlayCanvas.height = MM_SIZE;
    _overlayCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    _overlayCtx = _overlayCanvas.getContext('2d')!;
    _el.appendChild(_overlayCanvas);

    _pad = document.createElement('div');
    _pad.id = 'minimap-pad';
    _el.appendChild(_pad);

    _carrier = document.createElement('div');
    _carrier.id = 'minimap-carrier';
    _el.appendChild(_carrier);

    _heli = document.createElement('div');
    _heli.id = 'minimap-heli';
    _el.appendChild(_heli);

    document.body.appendChild(_el);
};

export const initMinimapTerrain = (points: number[][], gridSize: number, waterLevel: number): void => {
    if (!_canvas) return;
    const ctx = _canvas.getContext('2d')!;
    const ssSize = MM_SIZE * MM_SS;
    ctx.clearRect(0, 0, ssSize, ssSize);
    const ts = ssSize / gridSize;

    const isLand = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
        return (points[x][y] + points[x + 1][y] + points[x][y + 1] + points[x + 1][y + 1]) / 4 > waterLevel;
    };

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 200, 80, 0.75)';
    // Drawn at 1 *internal* pixel: at max zoom (MAX_ZOOM_RATIO == MM_SS) that maps 1:1 to
    // a screen pixel — crisp and thin instead of blown up; at full-map zoom it's merely
    // downscaled further (sub-pixel, antialiased), never thicker than this.
    ctx.lineWidth = 1;
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            if (!isLand(x, y)) continue;
            const px = x * ts,
                py = y * ts;
            if (y > 0 && !isLand(x, y - 1)) {
                ctx.moveTo(px, py);
                ctx.lineTo(px + ts, py);
            }
            if (y < gridSize - 1 && !isLand(x, y + 1)) {
                ctx.moveTo(px, py + ts);
                ctx.lineTo(px + ts, py + ts);
            }
            if (x > 0 && !isLand(x - 1, y)) {
                ctx.moveTo(px, py);
                ctx.lineTo(px, py + ts);
            }
            if (x < gridSize - 1 && !isLand(x + 1, y)) {
                ctx.moveTo(px + ts, py);
                ctx.lineTo(px + ts, py + ts);
            }
        }
    }
    ctx.stroke();
};

export const showMinimap = (v: boolean): void => {
    if (_el) _el.style.display = v ? 'block' : 'none';
};

export type MinimapData = {
    gridSize: number;
    pad: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
    carrier: { x: number; y: number } | null;
    vessels: Array<{ x: number; y: number; type: string }>;
    heli: { x: number; y: number; angle: number; vx?: number; vy?: number };
    payloads: Array<{ x: number; y: number; type: string; rescued: boolean; npcTarget: boolean; hanging: boolean }>;
    windBft: number;
    windAngle: number;
    rings: Array<{ x: number; y: number; flown: boolean }>;
};

export const updateMinimap = (data: MinimapData): void => {
    if (!_el) return;

    _el.style.right = 'max(16px, env(safe-area-inset-right))';
    _el.style.top = 'max(12px, env(safe-area-inset-top))';
    _el.style.bottom = '';

    // ── Speed-dependent zoom ─────────────────────────────────────────────────
    const speedKmh = Math.hypot(data.heli.vx ?? 0, data.heli.vy ?? 0) * 1115;
    let t = 1 - (speedKmh - ZOOM_IN_KMH) / (ZOOM_OUT_KMH - ZOOM_IN_KMH);
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t); // smoothstep instead of a hard cutover

    // Ease the zoom level over time, not just over distance — a sudden brake/accel
    // would otherwise snap the view in/out abruptly, which feels disorienting.
    const now = Date.now();
    const dtMs = _lastZoomUpdateMs ? Math.min(250, now - _lastZoomUpdateMs) : 0;
    _lastZoomUpdateMs = now;
    const smoothFactor = dtMs > 0 ? 1 - Math.pow(0.5, dtMs / ZOOM_SMOOTH_HALFLIFE_MS) : 1;
    _smoothZoomT += (t - _smoothZoomT) * smoothFactor;
    t = _smoothZoomT;

    const halfGrid = data.gridSize / 2;
    // Bounded by MAX_ZOOM_RATIO (scale-independent) rather than a fixed grid-unit count,
    // so a huge map like Zephyr (gridSize 500) doesn't zoom in far more aggressively than
    // a small one — same max magnification everywhere.
    const minHalfView = halfGrid / MAX_ZOOM_RATIO;
    const halfView = halfGrid + (minHalfView - halfGrid) * t;
    const cx = halfGrid + (data.heli.x - halfGrid) * t;
    const cy = halfGrid + (data.heli.y - halfGrid) * t;
    const sc = MM_SIZE / (2 * halfView);

    // The terrain canvas is only rendered once per mission (initMinimapTerrain, fixed
    // scale scFull = MM_SIZE/gridSize) — instead of redrawing it every frame, it's
    // brought onto the same zoom/pan projection as the dots via a CSS transform.
    if (_canvas) {
        const scFull = MM_SIZE / data.gridSize;
        const zoomRatio = sc / scFull;
        const offsetX = MM_SIZE / 2 - cx * sc;
        const offsetY = MM_SIZE / 2 - cy * sc;
        _canvas.style.transformOrigin = '0 0';
        _canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoomRatio})`;
    }

    // World to minimap-pixel coordinates, clamped to the square border (Chebyshev
    // distance) instead of cut off — indicates the direction of targets outside the
    // current (zoomed) view.
    const project = (wx: number, wy: number): { x: number; y: number } => {
        let px = (wx - cx) * sc + MM_SIZE / 2;
        let py = (wy - cy) * sc + MM_SIZE / 2;
        const dx = px - MM_SIZE / 2, dy = py - MM_SIZE / 2;
        const half = MM_SIZE / 2 - EDGE_MARGIN;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d > half) {
            const s = half / d;
            px = MM_SIZE / 2 + dx * s;
            py = MM_SIZE / 2 + dy * s;
        }
        return { x: px, y: py };
    };

    if (data.pad) {
        const tl = project(data.pad.xMin, data.pad.yMin);
        const br = project(data.pad.xMax, data.pad.yMax);
        _pad.style.left = `${tl.x}px`;
        _pad.style.top = `${tl.y}px`;
        _pad.style.width = `${Math.max(0, br.x - tl.x)}px`;
        _pad.style.height = `${Math.max(0, br.y - tl.y)}px`;
        _pad.style.display = 'block';
    } else {
        _pad.style.display = 'none';
    }

    if (data.carrier) {
        const c = project(data.carrier.x, data.carrier.y);
        _carrier.style.left = `${c.x}px`;
        _carrier.style.top = `${c.y}px`;
        _carrier.style.display = 'block';
    } else {
        _carrier.style.display = 'none';
    }

    const heliPx = project(data.heli.x, data.heli.y);

    // vision cone + wind indicator
    if (_overlayCtx) {
        const octx = _overlayCtx;
        octx.clearRect(0, 0, MM_SIZE, MM_SIZE);

        // vision cone
        const hx = heliPx.x;
        const hy = heliPx.y;
        const a = data.heli.angle;
        octx.beginPath();
        octx.moveTo(hx, hy);
        octx.lineTo(hx + CONE_LEN * Math.cos(a - CONE_HALF_ANGLE), hy + CONE_LEN * Math.sin(a - CONE_HALF_ANGLE));
        octx.lineTo(hx + CONE_LEN * Math.cos(a + CONE_HALF_ANGLE), hy + CONE_LEN * Math.sin(a + CONE_HALF_ANGLE));
        octx.closePath();
        octx.fillStyle = 'rgba(255, 255, 255, 0.13)';
        octx.fill();
        octx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        octx.lineWidth = 0.5;
        octx.stroke();

        // wind arrow + Bft label (bottom-left corner)
        if (data.windBft > 0) {
            const arrowLen = 6 + data.windBft * 3.2; // Bft 1=9px … Bft 5=22px
            const ax = 10, ay = MM_SIZE - 10;
            const wa = data.windAngle;
            const ex = ax + Math.cos(wa) * arrowLen;
            const ey = ay + Math.sin(wa) * arrowLen;
            const headLen = arrowLen * 0.35;
            const headAngle = 0.45;
            octx.strokeStyle = 'rgba(180,220,255,0.85)';
            octx.lineWidth = 1.5;
            octx.beginPath();
            octx.moveTo(ax, ay);
            octx.lineTo(ex, ey);
            octx.lineTo(ex - headLen * Math.cos(wa - headAngle), ey - headLen * Math.sin(wa - headAngle));
            octx.moveTo(ex, ey);
            octx.lineTo(ex - headLen * Math.cos(wa + headAngle), ey - headLen * Math.sin(wa + headAngle));
            octx.stroke();
        }
    }

    _heli.style.left = `${heliPx.x}px`;
    _heli.style.top = `${heliPx.y}px`;
    _heli.style.display = 'block';

    let dotIdx = 0;

    // Vessels: submarine/carrier weiß (8px); wind_turbine cyan (5px); research_platform gelb (6px); Boote grau (6px)
    data.vessels.forEach(v => {
        const dot = _getDot(dotIdx++);
        const p = project(v.x, v.y);
        dot.style.left = `${p.x}px`;
        dot.style.top = `${p.y}px`;
        if (v.type === 'submarine' || v.type === 'carrier') {
            dot.style.background = '#fff';
            dot.style.width = dot.style.height = '8px';
        } else if (v.type === 'wind_turbine') {
            dot.style.background = '#4af';
            dot.style.width = dot.style.height = '5px';
        } else if (v.type === 'research_platform') {
            dot.style.background = '#ff0';
            dot.style.width = dot.style.height = '6px';
        } else {
            dot.style.background = '#888';
            dot.style.width = dot.style.height = '6px';
        }
        dot.style.display = 'block';
    });

    // Rettungsziele: Personen und Crates in Rot
    const activePays = data.payloads.filter(p => !p.rescued && !p.npcTarget && !p.hanging && p.type !== 'orni_wreck');
    activePays.forEach(p => {
        const dot = _getDot(dotIdx++);
        const pp = project(p.x, p.y);
        dot.style.left = `${pp.x}px`;
        dot.style.top = `${pp.y}px`;
        dot.style.background = p.type === 'crate' ? '#ff7755' : '#ff3333';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.display = 'block';
    });

    // Ringe: gelb (offen) oder grün (geflogen)
    data.rings.forEach(ring => {
        const dot = _getDot(dotIdx++);
        const rp = project(ring.x, ring.y);
        dot.style.left = `${rp.x}px`;
        dot.style.top = `${rp.y}px`;
        dot.style.background = ring.flown ? '#44ee44' : '#FFD700';
        dot.style.width = '6px';
        dot.style.height = '6px';
        dot.style.display = 'block';
    });

    for (let i = dotIdx; i < _pool.length; i++) {
        _pool[i].style.display = 'none';
    }
};
