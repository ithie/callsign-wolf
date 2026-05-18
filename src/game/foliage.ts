import { G } from './state';
import { campaignHandler } from './main';
import { getGround } from './sim/terrain';
import type { WindState } from './draw-objects';

type DrawTreeFn = (
    tX: number,
    tY: number,
    cx: number,
    cy: number,
    scale: number,
    gz: number,
    type: string,
    wind: WindState,
    partyMode: boolean
) => void;

const FOLIAGE_DECODE: Record<string, string> = { p: 'pine', o: 'oak', b: 'bush', d: 'dead' };

const decompressFoliage = (str: string | { x: number; y: number; s: number; type: string }[]) => {
    if (!str) return [];
    if (typeof str !== 'string') return str;
    return str.split('|').map(token => {
        const type = FOLIAGE_DECODE[token[0]] || 'pine';
        const [x, y, s] = token.slice(1).split(',').map(Number);
        return { type, x: x / 10, y: y / 10, s: s / 10 };
    });
};

let _treeIndex: Map<string, any[]> = new Map();

export const initFoliageFromMission = () => {
    const md = campaignHandler.getCurrentMissionData();
    const foliage = decompressFoliage(md.foliage || []);
    G.TREES_MAP = foliage.map((f: any) => ({ x: f.x, y: f.y, s: f.s || 1.0, type: f.type || 'pine', gz: null }));
    G.TREES_MAP.forEach((t: any) => { t.gz = getGround(t.x, t.y); });
    _treeIndex.clear();
    G.TREES_MAP.forEach((t: any) => {
        const key = `${Math.floor(t.x)}_${Math.floor(t.y)}`;
        const bucket = _treeIndex.get(key);
        if (bucket) bucket.push(t);
        else _treeIndex.set(key, [t]);
    });
};

export const createFoliage = (opts: {
    canvas: HTMLCanvasElement;
    tileW: number;
    tileH: number;
    drawTree: DrawTreeFn;
    isApp: boolean;
    getPartyMode: () => boolean;
}) => {
    const { canvas, tileW, tileH, drawTree, isApp, getPartyMode } = opts;

    const drawTrees = (camX: number, camY: number, rx: number, ry: number) => {
        const _tr = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
        const xFrom = Math.floor(rx - _tr), xTo = Math.ceil(rx + _tr);
        const yFrom = Math.floor(ry - _tr), yTo = Math.ceil(ry + _tr);
        for (let tx = xFrom; tx <= xTo; tx++) {
            for (let ty = yFrom; ty <= yTo; ty++) {
                const bucket = _treeIndex.get(`${tx}_${ty}`);
                if (!bucket) continue;
                for (const t of bucket) {
                    drawTree(
                        t.x, t.y, camX, camY, t.s, t.gz, t.type || 'pine',
                        G.wind,
                        !isApp && getPartyMode() && t.type !== 'dead'
                    );
                }
            }
        }
    };

    return { drawTrees };
};
