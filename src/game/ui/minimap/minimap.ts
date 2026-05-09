import './minimap.css';

const MM_SIZE = 130;
const MM_PAD_PX = 20;

let _el: HTMLElement | null = null;
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

export const showMinimap = (v: boolean): void => {
    if (_el) _el.style.display = v ? 'block' : 'none';
};

export type MinimapData = {
    gridSize: number;
    isTouch: boolean;
    pad: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
    carrier: { x: number; y: number } | null;
    heli: { x: number; y: number };
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

    _heli.style.left    = `${data.heli.x * sc}px`;
    _heli.style.top     = `${data.heli.y * sc}px`;
    _heli.style.display = 'block';

    const activePays = data.payloads.filter(p => !p.rescued && !p.npcTarget && !p.hanging);
    activePays.forEach((p, i) => {
        const dot = _getDot(i);
        dot.style.left       = `${p.x * sc}px`;
        dot.style.top        = `${p.y * sc}px`;
        dot.style.background = p.type === 'crate' ? '#d84' : '#f00';
        dot.style.display    = 'block';
    });
    for (let i = activePays.length; i < _pool.length; i++) {
        _pool[i].style.display = 'none';
    }
};
