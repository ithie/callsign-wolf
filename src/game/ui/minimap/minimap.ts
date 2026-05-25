import './minimap.css';

const MM_SIZE = 130;
const MM_PAD_PX = 20;
const CONE_LEN = 28;
const CONE_HALF_ANGLE = Math.PI / 5.5; // ~33°

let _el: HTMLElement | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _overlayCanvas: HTMLCanvasElement | null = null;
let _overlayCtx: CanvasRenderingContext2D | null = null;
let _pad: HTMLElement;
let _carrier: HTMLElement;
let _heli: HTMLElement;
let _pool: HTMLElement[] = [];

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
    _canvas.width = MM_SIZE;
    _canvas.height = MM_SIZE;
    _canvas.style.cssText = 'position:absolute;top:0;left:0;';
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
    ctx.clearRect(0, 0, MM_SIZE, MM_SIZE);
    const ts = MM_SIZE / gridSize;

    const isLand = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
        return (points[x][y] + points[x + 1][y] + points[x][y + 1] + points[x + 1][y + 1]) / 4 > waterLevel;
    };

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 200, 80, 0.75)';
    ctx.lineWidth = 1;
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            if (!isLand(x, y)) continue;
            const px = x * ts, py = y * ts;
            if (y > 0            && !isLand(x, y - 1)) { ctx.moveTo(px, py);      ctx.lineTo(px + ts, py);      }
            if (y < gridSize - 1 && !isLand(x, y + 1)) { ctx.moveTo(px, py + ts); ctx.lineTo(px + ts, py + ts); }
            if (x > 0            && !isLand(x - 1, y)) { ctx.moveTo(px, py);      ctx.lineTo(px, py + ts);      }
            if (x < gridSize - 1 && !isLand(x + 1, y)) { ctx.moveTo(px + ts, py); ctx.lineTo(px + ts, py + ts); }
        }
    }
    ctx.stroke();
};

export const showMinimap = (v: boolean): void => {
    if (_el) _el.style.display = v ? 'block' : 'none';
};

export type MinimapData = {
    gridSize: number;
    isTouch: boolean;
    pad: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
    carrier: { x: number; y: number } | null;
    vessels: Array<{ x: number; y: number; type: string }>;
    heli: { x: number; y: number; angle: number };
    payloads: Array<{ x: number; y: number; type: string; rescued: boolean; npcTarget: boolean; hanging: boolean }>;
};

export const updateMinimap = (data: MinimapData): void => {
    if (!_el) return;

    _el.style.right  = data.isTouch ? 'max(16px, env(safe-area-inset-right))' : `${MM_PAD_PX}px`;
    _el.style.top    = data.isTouch ? 'max(12px, env(safe-area-inset-top))' : '';
    _el.style.bottom = data.isTouch ? '' : `${MM_PAD_PX}px`;

    const sc = MM_SIZE / data.gridSize;

    if (data.pad) {
        _pad.style.left    = `${data.pad.xMin * sc}px`;
        _pad.style.top     = `${data.pad.yMin * sc}px`;
        _pad.style.width   = `${(data.pad.xMax - data.pad.xMin) * sc}px`;
        _pad.style.height  = `${(data.pad.yMax - data.pad.yMin) * sc}px`;
        _pad.style.display = 'block';
    } else {
        _pad.style.display = 'none';
    }

    if (data.carrier) {
        _carrier.style.left    = `${data.carrier.x * sc}px`;
        _carrier.style.top     = `${data.carrier.y * sc}px`;
        _carrier.style.display = 'block';
    } else {
        _carrier.style.display = 'none';
    }

    // vision cone
    if (_overlayCtx) {
        const octx = _overlayCtx;
        octx.clearRect(0, 0, MM_SIZE, MM_SIZE);
        const hx = data.heli.x * sc;
        const hy = data.heli.y * sc;
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
    }

    _heli.style.left    = `${data.heli.x * sc}px`;
    _heli.style.top     = `${data.heli.y * sc}px`;
    _heli.style.display = 'block';

    let dotIdx = 0;

    // Ziel-Objekte: Submarines blau; andere Vessels (Boote) grau
    data.vessels.forEach(v => {
        const dot = _getDot(dotIdx++);
        dot.style.left       = `${v.x * sc}px`;
        dot.style.top        = `${v.y * sc}px`;
        dot.style.background = v.type === 'submarine' ? '#44aaff' : '#888';
        dot.style.width      = '6px';
        dot.style.height     = '6px';
        dot.style.display    = 'block';
    });

    // Rettungsziele: Personen und Crates in Rot
    const activePays = data.payloads.filter(p => !p.rescued && !p.npcTarget && !p.hanging && p.type !== 'orni_wreck');
    activePays.forEach(p => {
        const dot = _getDot(dotIdx++);
        dot.style.left       = `${p.x * sc}px`;
        dot.style.top        = `${p.y * sc}px`;
        dot.style.background = p.type === 'crate' ? '#ff7755' : '#ff3333';
        dot.style.width      = '4px';
        dot.style.height     = '4px';
        dot.style.display    = 'block';
    });

    for (let i = dotIdx; i < _pool.length; i++) {
        _pool[i].style.display = 'none';
    }
};
