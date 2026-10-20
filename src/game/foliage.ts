import { G } from './state';
import { campaignHandler } from './main';
import { getGround } from './sim/terrain';
import { isLightningActive } from './lightning-state';
import { isNightLit } from './night-light';
import type { WindState } from './draw-objects';
import type { DEFInstanceOptions } from './scene-renderer';

type DrawTreeFn = (
    tX: number,
    tY: number,
    cx: number,
    cy: number,
    scale: number,
    gz: number,
    type: string,
    wind: WindState,
    heliPos?: { x: number; y: number; z: number },
    snow?: boolean
) => void;

type EntryOpts = Pick<DEFInstanceOptions, 'x' | 'y' | 'z' | 'depth' | 'bounds' | 'drawFn'>;

type SceneAddFn = (def: null, opts: EntryOpts) => void;

const FOLIAGE_DECODE: Record<string, string> = { p: 'pine', o: 'oak', b: 'bush', d: 'dead', u: 'beach_umbrella', l: 'beach_lounger', c: 'beach_cooler', v: 'beach_umbrella_tilted', g: 'beach_person', s: 'swimmer' };

const _decompressRle = (rle: string) =>
    rle.split('|').map(token => {
        const type = FOLIAGE_DECODE[token[0]] || 'pine';
        const [x, y, s] = token.slice(1).split(',').map(Number);
        return { type, x: x / 10, y: y / 10, s: s / 10 };
    });

const _isDeflated = (s: string) => s.charCodeAt(0) === 0;

const _inflate = async (s: string): Promise<string> => {
    const bytes = Uint8Array.from(atob(s.slice(1)), c => c.charCodeAt(0));
    const ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
};

const decompressFoliage = (str: string | { x: number; y: number; s: number; type: string }[]) => {
    if (!str) return [];
    if (typeof str !== 'string') return str;
    return _decompressRle(str);
};

let _treeIndex: Map<string, any[]> = new Map();

export const initFoliageFromMission = async (): Promise<void> => {
    const md = campaignHandler.getCurrentMissionData();
    let raw = md.foliage || [];
    if (typeof raw === 'string' && _isDeflated(raw)) raw = _decompressRle(await _inflate(raw));
    const foliage = decompressFoliage(raw);
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
    sceneAdd: SceneAddFn;
    isNight: () => boolean;
}) => {
    const { canvas, tileW, tileH, drawTree, sceneAdd, isNight } = opts;

    const rebuildEntryCache = () => {
        const snow = !!campaignHandler.getCurrentMissionData().snow;
        G.TREES_MAP.forEach((t: any) => {
            const treeType = t.type || 'pine';
            t._entry = {
                x: t.x, y: t.y, z: t.gz, depth: t.x + t.y,
                // Same extents as the tree collision box (collision.ts).
                bounds: { x0: t.x - 0.35 * t.s, x1: t.x + 0.35 * t.s, y0: t.y - 0.35 * t.s, y1: t.y + 0.35 * t.s, z0: t.gz, z1: t.gz + 2.3 * t.s },
                drawFn: (cx: number, cy: number) => drawTree(t.x, t.y, cx, cy, t.s, t.gz, treeType, G.wind, G.heli, snow),
            } satisfies EntryOpts;
        });
    };

    const drawTrees = (_camX: number, _camY: number, rx: number, ry: number) => {
        const _tr = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
        const xFrom = Math.floor(rx - _tr), xTo = Math.ceil(rx + _tr);
        const yFrom = Math.floor(ry - _tr), yTo = Math.ceil(ry + _tr);
        const night = isNight();
        const lightning = night && isLightningActive();
        for (let tx = xFrom; tx <= xTo; tx++) {
            for (let ty = yFrom; ty <= yTo; ty++) {
                const bucket = _treeIndex.get(`${tx}_${ty}`);
                if (!bucket) continue;
                for (const t of bucket) {
                    if (night && !lightning && !isNightLit(t.x, t.y)) continue;
                    sceneAdd(null, t._entry);
                }
            }
        }
    };

    return { drawTrees, rebuildEntryCache };
};
