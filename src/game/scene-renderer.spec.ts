import { describe, it, expect, vi } from 'vitest';
import { createSceneRenderer } from './scene-renderer';
import type { DEF } from './defs';

// Identity projection — depth/angle math is what's under test, not the iso transform.
const identityIso = (wx: number, wy: number, _wz: number, _cx: number, _cy: number, out?: { x: number; y: number }) => {
    const p = out ?? { x: 0, y: 0 };
    p.x = wx; p.y = wy;
    return p;
};

const makeCtx = () => ({
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
} as unknown as CanvasRenderingContext2D);

const faceDef = (normal3d: [number, number, number]): DEF => ({
    id: 'test',
    faces: [{
        id: 'f',
        verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
        color: '#fff',
        normal3d,
    }],
});

describe('SceneRenderer — D3F normal3d culling', () => {
    it('draws a face whose normal points toward the camera (1,1,1)', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        renderer.add(faceDef([1, 1, 1]), { x: 0, y: 0, angle: 0 });
        renderer.flush(0, 0);
        expect(ctx.fill).toHaveBeenCalledTimes(1);
    });

    it('culls a face whose normal points away from the camera', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        renderer.add(faceDef([-1, -1, -1]), { x: 0, y: 0, angle: 0 });
        renderer.flush(0, 0);
        expect(ctx.fill).not.toHaveBeenCalled();
    });

    it('draws a pure +Z (top) face — matches "no normal = always visible" convention', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        renderer.add(faceDef([0, 0, 1]), { x: 0, y: 0, angle: 0 });
        renderer.flush(0, 0);
        expect(ctx.fill).toHaveBeenCalledTimes(1);
    });

    it('culls a pure -Z (bottom) face', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        renderer.add(faceDef([0, 0, -1]), { x: 0, y: 0, angle: 0 });
        renderer.flush(0, 0);
        expect(ctx.fill).not.toHaveBeenCalled();
    });

    it('rotating the instance 180° flips a visible +X wall into culled', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        renderer.add(faceDef([1, 0, 0]), { x: 0, y: 0, angle: Math.PI });
        renderer.flush(0, 0);
        expect(ctx.fill).not.toHaveBeenCalled();
    });

    it('an explicit legacy `normal` still wins over normal3d if both were present', () => {
        const ctx = makeCtx();
        const renderer = createSceneRenderer(ctx, identityIso as any);
        const def: DEF = {
            id: 'test',
            faces: [{
                id: 'f',
                verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
                color: '#fff',
                normal: [1, 0], // visible
                normal3d: [-1, -1, -1], // would cull if it were the only signal
            }],
        };
        renderer.add(def, { x: 0, y: 0, angle: 0 });
        renderer.flush(0, 0);
        expect(ctx.fill).toHaveBeenCalledTimes(1);
    });
});

// ─── Box sort ─────────────────────────────────────────────────────────────────

import { sortByBoxes, type Box3 } from './scene-renderer';

// Same shape as the game's iso(): screen x from x−y, screen y from x+y and z.
const _rect = (b: Box3) => {
    const pts: [number, number][] = [];
    for (let c = 0; c < 8; c++) {
        const x = c & 1 ? b.x1 : b.x0, y = c & 2 ? b.y1 : b.y0, z = c & 4 ? b.z1 : b.z0;
        pts.push([(x - y) * 32, (x + y) * 16 - z * 16]);
    }
    return {
        sx0: Math.min(...pts.map(p => p[0])) - 2, sx1: Math.max(...pts.map(p => p[0])) + 2,
        sy0: Math.min(...pts.map(p => p[1])) - 2, sy1: Math.max(...pts.map(p => p[1])) + 2,
    };
};
const _box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box3 => ({ x0, x1, y0, y1, z0, z1 });
// Draw order as names; key = box centre x + y (the old single-value depth).
const _order = (items: Record<string, Box3>, groups: Record<string, number> = {}) => {
    const names = Object.keys(items);
    const boxes = names.map(n => items[n]);
    const order = sortByBoxes(
        boxes,
        boxes.map(_rect),
        boxes.map(b => (b.x0 + b.x1) / 2 + (b.y0 + b.y1) / 2),
        names.map(n => groups[n] ?? 0),
    );
    return order.map(i => names[i]);
};
const _before = (order: string[], a: string, b: string) => order.indexOf(a) < order.indexOf(b);

describe('SceneRenderer — box sort', () => {
    it('long hull in front of a thin mast paints over it, although its centre lies further back', () => {
        const order = _order({
            hull: _box(25, 45, 41, 42, 0, 2),   // centre key 76.5
            mast: _box(39.85, 40.15, 39.85, 40.15, 0, 12), // centre key 80
        });
        expect(_before(order, 'mast', 'hull')).toBe(true);
    });

    it('heli hovering over a deck is painted after the deck, wherever it is along the hull', () => {
        const order = _order({
            deck: _box(0, 6, 0, 2, 0, 1),
            heli: _box(1, 2, 0.5, 1, 1.5, 2), // behind the deck centre
        });
        expect(_before(order, 'deck', 'heli')).toBe(true);
    });

    it('heli behind a tower is covered by it, in front of it covers it', () => {
        const tower = _box(10, 11, 10, 11, 0, 10);
        expect(_before(_order({ tower, heli: _box(8, 9, 8, 9, 5, 6) }), 'heli', 'tower')).toBe(true);
        expect(_before(_order({ tower, heli: _box(12, 13, 12, 13, 5, 6) }), 'tower', 'heli')).toBe(true);
    });

    it('vessel next to the carrier: the one further back is painted first', () => {
        const order = _order({
            vessel: _box(20, 26, 36, 38, 0, 3.8),
            carrier: _box(10, 30, 26, 34, 0, 4.2),
        });
        expect(_before(order, 'carrier', 'vessel')).toBe(true);
    });

    it('flat shadow is painted below the object standing on it', () => {
        const order = _order({
            car: _box(5, 7, 5, 6, 0, 1),
            shadow: _box(5, 7, 5, 6, 0, 0),
        });
        expect(_before(order, 'shadow', 'car')).toBe(true);
    });

    it('items of one render group keep their key order', () => {
        // Box rule alone would put b (lower) first; as one group, key order wins.
        const order = _order({ a: _box(0, 1, 0, 1, 2, 3), b: _box(0.5, 1.5, 0.5, 1.5, 0, 1) }, { a: 1, b: 1 });
        expect(order).toEqual(['a', 'b']);
    });

    it('returns every item exactly once, even for cyclic overlaps', () => {
        const order = _order({
            p: _box(0, 4, 0, 1, 0, 1),
            q: _box(3, 4, 0, 4, 0.5, 1.5),
            r: _box(0, 1, 0, 4, 1, 2),
        });
        expect([...order].sort()).toEqual(['p', 'q', 'r']);
    });

    it('stays fast with a full frame of items', () => {
        const boxes: Box3[] = [];
        let seed = 1;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 800; i++) {
            const x = rnd() * 60, y = rnd() * 60, z = rnd() * 3;
            boxes.push(_box(x, x + 0.3 + rnd() * 3, y, y + 0.3 + rnd() * 3, z, z + 0.3 + rnd() * 6));
        }
        const rects = boxes.map(_rect), keys = boxes.map(b => b.x0 + b.y0), groups = boxes.map(() => 0);
        sortByBoxes(boxes, rects, keys, groups); // warm-up
        const t0 = performance.now();
        const runs = 20;
        for (let r = 0; r < runs; r++) sortByBoxes(boxes, rects, keys, groups);
        const ms = (performance.now() - t0) / runs;
        expect(ms).toBeLessThan(8);
    });
});
