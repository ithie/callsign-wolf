// ─── SceneRenderer ────────────────────────────────────────────────────────────
// Factory for the isometric depth-sorted DEF renderer.
// See DEF_SPEC.md for the full architecture.
//
// Usage — ONE batch per frame for the whole world:
//   const renderer = createSceneRenderer(ctx, iso);
//   renderer.add(MY_DEF, { x, y, z, angle });          // models: bounds from their faces
//   renderer.add(null, { x, y, z, bounds, drawFn });  // custom drawing: give bounds
//   renderer.flush(camX, camY);                        // once, at the end of the frame
//
// Sorting (classic isometric box sort): every item has a world-space bounding box.
// Of two items that overlap on screen, the one lying completely behind the other
// along x, y or z (the camera looks from +x/+y/+z) is painted first. Only boxes
// that really intersect fall back to the depth key (`depth`, default x + y).
// ──────────────────────────────────────────────────────────────────────────────

import type { DEF } from './defs';

export type IsoFn = (
    wx: number,
    wy: number,
    wz: number,
    camX: number,
    camY: number,
    out?: { x: number; y: number }
) => { x: number; y: number };
export type DrawFn = (camX: number, camY: number) => void;

/** World-space axis-aligned bounding box. */
export type Box3 = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

export interface DEFInstanceOptions {
    x: number;
    y: number;
    z?: number;
    angle?: number;
    /** Per-face color overrides keyed by face id */
    colors?: Record<string, string>;
    /** Called after DEF faces, depth-sorted alongside them */
    drawFn?: DrawFn;
    /** Fallback depth key, only used between items whose boxes intersect. Default x + y. */
    depth?: number;
    /** World bounds of what drawFn paints. Default: the DEF's transformed faces, else the point (x, y, z). */
    bounds?: Box3;
    /** Items of one group (e.g. the faces of one rotating model part) keep their depth-key order among themselves. */
    group?: number;
}

export interface SceneRenderer {
    add(def: DEF | null, opts: DEFInstanceOptions): void;
    flush(camX: number, camY: number): void;
    drawCollisionBox(
        camX: number,
        camY: number,
        wX: number,
        wY: number,
        angle: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        zMin: number,
        zMax: number,
        color?: string
    ): void;
}

interface _Instance {
    def: DEF | null;
    x: number;
    y: number;
    z: number;
    angle: number;
    colors: Record<string, string> | undefined;
    depth: number;
    drawFn: DrawFn | null;
    group: number;
    box: Box3;
    // Screen rectangle, filled in flush().
    sx0: number; sx1: number; sy0: number; sy1: number;
}

// One batch per frame holds the whole visible world (models per node, trees, lights, …).
const _POOL_SIZE = 2048;
const _makeInst = (): _Instance => ({
    def: null,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    colors: undefined,
    depth: 0,
    drawFn: null,
    group: 0,
    box: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 },
    sx0: 0, sx1: 0, sy0: 0, sy1: 0,
});

// Boxes touching within this tolerance count as separated (shared edges/faces).
const _EPS = 1e-4;
// Screen grid cell size (px) used to find overlapping pairs without testing all n².
const _CELL = 96;

// a lies completely behind b along at least one axis.
const _behind = (a: Box3, b: Box3): boolean =>
    a.x1 <= b.x0 + _EPS || a.y1 <= b.y0 + _EPS || a.z1 <= b.z0 + _EPS;

// Pure ordering core — exported for unit tests. Returns draw order (indices).
// keys: fallback depth per item. groups: 0 = none.
export const sortByBoxes = (
    boxes: Box3[],
    rects: { sx0: number; sx1: number; sy0: number; sy1: number }[],
    keys: number[],
    groups: number[],
): number[] => {
    const n = boxes.length;
    // Stable base order by key: decides everything the boxes can't.
    const base = Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
    const rank = new Array<number>(n);
    base.forEach((idx, r) => { rank[idx] = r; });
    const preds: number[][] = Array.from({ length: n }, () => []);

    // Bucket screen rects into a grid; test each pair once (in the cell holding the
    // top-left corner of their intersection).
    const cells = new Map<number, number[]>();
    const cellKey = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
    for (let i = 0; i < n; i++) {
        const r = rects[i];
        const cx0 = Math.floor(r.sx0 / _CELL), cx1 = Math.floor(r.sx1 / _CELL);
        const cy0 = Math.floor(r.sy0 / _CELL), cy1 = Math.floor(r.sy1 / _CELL);
        for (let cx = cx0; cx <= cx1; cx++) {
            for (let cy = cy0; cy <= cy1; cy++) {
                const k = cellKey(cx, cy);
                const list = cells.get(k);
                if (list) list.push(i); else cells.set(k, [i]);
            }
        }
    }
    for (const [, list] of cells) {
        for (let a = 0; a < list.length; a++) {
            const i = list[a], ri = rects[i];
            for (let b = a + 1; b < list.length; b++) {
                const j = list[b], rj = rects[j];
                if (ri.sx1 <= rj.sx0 || rj.sx1 <= ri.sx0 || ri.sy1 <= rj.sy0 || rj.sy1 <= ri.sy0) continue;
                // Process this pair only in its canonical cell.
                const ox = Math.max(ri.sx0, rj.sx0), oy = Math.max(ri.sy0, rj.sy0);
                const home = cellKey(Math.floor(ox / _CELL), Math.floor(oy / _CELL));
                if (cells.get(home) !== list) continue;
                if (groups[i] !== 0 && groups[i] === groups[j]) continue;
                const ib = _behind(boxes[i], boxes[j]);
                const jb = _behind(boxes[j], boxes[i]);
                if (ib && !jb) preds[j].push(i);
                else if (jb && !ib) preds[i].push(j);
                // Neither (boxes intersect) or both (ambiguous): the key order decides.
            }
        }
    }

    // Depth-first topological sort in key order; predecessors first. A cycle is
    // broken by skipping the edge back into the item currently being placed.
    const order: number[] = [];
    const mark = new Uint8Array(n); // 0 = new, 1 = in progress, 2 = done
    const visit = (start: number) => {
        const stack: number[] = [start];
        const iter: number[] = [0];
        mark[start] = 1;
        while (stack.length) {
            const top = stack[stack.length - 1];
            const p = preds[top];
            // Visit predecessors in key order too, so ties stay stable.
            if (iter[iter.length - 1] === 0 && p.length > 1) p.sort((a, b) => rank[a] - rank[b]);
            const k = iter[iter.length - 1];
            if (k < p.length) {
                iter[iter.length - 1] = k + 1;
                const nxt = p[k];
                if (mark[nxt] === 0) { mark[nxt] = 1; stack.push(nxt); iter.push(0); }
                continue;
            }
            mark[top] = 2;
            order.push(top);
            stack.pop();
            iter.pop();
        }
    };
    for (const idx of base) if (mark[idx] === 0) visit(idx);
    return order;
};

// Pre-allocated scratch points for face vertex projection (max 64 verts per face).
const _scratchPts: { x: number; y: number }[] = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));
const _scratchIso = { x: 0, y: 0 };

export const createSceneRenderer = (ctx: CanvasRenderingContext2D, iso: IsoFn): SceneRenderer => {
    const _instances: _Instance[] = [];
    const _pool: _Instance[] = Array.from({ length: _POOL_SIZE }, _makeInst);
    let _poolNext = 0;

    const _drawCollisionBox = (
        camX: number,
        camY: number,
        wX: number,
        wY: number,
        angle: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        zMin: number,
        zMax: number,
        color?: string
    ) => {
        const cosA = Math.cos(angle),
            sinA = Math.sin(angle);
        const wp = (lx: number, ly: number, lz: number) => ({
            x: wX + lx * cosA - ly * sinA,
            y: wY + lx * sinA + ly * cosA,
            z: lz,
        });
        const corners = [
            wp(xMin, yMin, zMin),
            wp(xMax, yMin, zMin),
            wp(xMax, yMax, zMin),
            wp(xMin, yMax, zMin),
            wp(xMin, yMin, zMax),
            wp(xMax, yMin, zMax),
            wp(xMax, yMax, zMax),
            wp(xMin, yMax, zMax),
        ];
        const sc = corners.map(p => iso(p.x, p.y, p.z, camX, camY));
        const edges = [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 0],
            [4, 5],
            [5, 6],
            [6, 7],
            [7, 4],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ];
        ctx.save();
        ctx.strokeStyle = color ?? 'rgba(0,255,100,0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.shadowColor = color ?? '#00ff66';
        ctx.shadowBlur = 4;
        edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(sc[a].x, sc[a].y);
            ctx.lineTo(sc[b].x, sc[b].y);
            ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
    };

    // World box of a DEF instance: all its face vertices, transformed.
    const _defBox = (inst: _Instance, out: Box3): void => {
        const def = inst.def!;
        const pivot = def.pivot ?? [0, 0, 0];
        const cosA = Math.cos(inst.angle), sinA = Math.sin(inst.angle);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (const face of def.faces) {
            for (const v of face.verts) {
                const dx = v[0] - pivot[0], dy = v[1] - pivot[1];
                const wx = dx * cosA - dy * sinA + inst.x;
                const wy = dx * sinA + dy * cosA + inst.y;
                const wz = v[2] - pivot[2] + inst.z;
                if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
                if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
                if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
            }
        }
        if (x0 === Infinity) { x0 = x1 = inst.x; y0 = y1 = inst.y; z0 = z1 = inst.z; }
        out.x0 = x0; out.x1 = x1; out.y0 = y0; out.y1 = y1; out.z0 = z0; out.z1 = z1;
    };

    const _screenRect = (inst: _Instance, camX: number, camY: number): void => {
        const b = inst.box;
        let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
        for (let c = 0; c < 8; c++) {
            const p = iso(c & 1 ? b.x1 : b.x0, c & 2 ? b.y1 : b.y0, c & 4 ? b.z1 : b.z0, camX, camY, _scratchIso);
            if (p.x < sx0) sx0 = p.x; if (p.x > sx1) sx1 = p.x;
            if (p.y < sy0) sy0 = p.y; if (p.y > sy1) sy1 = p.y;
        }
        // Points/flat lines still cover a few pixels on screen.
        inst.sx0 = sx0 - 2; inst.sx1 = sx1 + 2; inst.sy0 = sy0 - 2; inst.sy1 = sy1 + 2;
    };

    const _drawInstance = (inst: _Instance, camX: number, camY: number): void => {
        if (inst.def) {
            const def = inst.def;
            const pivot = def.pivot ?? [0, 0, 0];
            const cosA = Math.cos(inst.angle),
                sinA = Math.sin(inst.angle);
            const p0 = pivot[0],
                p1 = pivot[1],
                p2 = pivot[2];
            for (const face of def.faces) {
                if (face.normal) {
                    const [nx, ny] = face.normal;
                    if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
                } else if (face.normal3d) {
                    // D3F: full 3D cull. Camera view direction is (1,1,1) — dot product
                    // sign only depends on the component sum, so no normalization needed.
                    const [nx, ny, nz] = face.normal3d;
                    if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) + nz <= 0) continue;
                }
                const verts = face.verts;
                for (let i = 0; i < verts.length; i++) {
                    const lx = verts[i][0],
                        ly = verts[i][1],
                        lz = verts[i][2];
                    const dx = lx - p0,
                        dy = ly - p1;
                    iso(
                        dx * cosA - dy * sinA + inst.x,
                        dx * sinA + dy * cosA + inst.y,
                        lz - p2 + inst.z,
                        camX,
                        camY,
                        _scratchPts[i]
                    );
                }
                let _fcx = 0,
                    _fcy = 0;
                const _fn = verts.length;
                for (let i = 0; i < _fn; i++) {
                    _fcx += _scratchPts[i].x;
                    _fcy += _scratchPts[i].y;
                }
                _fcx /= _fn;
                _fcy /= _fn;
                ctx.beginPath();
                for (let i = 0; i < _fn; i++) {
                    const _dx = _scratchPts[i].x - _fcx,
                        _dy = _scratchPts[i].y - _fcy;
                    const _d = Math.hypot(_dx, _dy) || 1;
                    const _ex = _fcx + _dx * (1 + 0.5 / _d);
                    const _ey = _fcy + _dy * (1 + 0.5 / _d);
                    i === 0 ? ctx.moveTo(_ex, _ey) : ctx.lineTo(_ex, _ey);
                }
                ctx.closePath();
                ctx.fillStyle = (inst.colors && inst.colors[face.id]) ?? face.color;
                ctx.fill();
                if (face.stroke) {
                    ctx.strokeStyle = face.stroke;
                    ctx.lineWidth = face.strokeWidth ?? 1;
                    ctx.stroke();
                }
            }
        }
        if (inst.drawFn) inst.drawFn(camX, camY);
    };

    const renderer: SceneRenderer = {
        drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) {
            _drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color);
        },

        add(def, { x, y, z = 0, angle = 0, colors, drawFn, depth: depthOverride, bounds, group } = {} as DEFInstanceOptions) {
            const inst = _poolNext < _POOL_SIZE ? _pool[_poolNext++] : _makeInst();
            inst.def = def;
            inst.x = x;
            inst.y = y;
            inst.z = z;
            inst.angle = angle;
            inst.colors = colors;
            inst.depth = depthOverride ?? x + y;
            inst.drawFn = drawFn ?? null;
            inst.group = group ?? 0;
            if (bounds) Object.assign(inst.box, bounds);
            else if (def) _defBox(inst, inst.box);
            else Object.assign(inst.box, { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z });
            _instances.push(inst);
        },

        flush(camX, camY) {
            const n = _instances.length;
            for (const inst of _instances) _screenRect(inst, camX, camY);
            const order = sortByBoxes(
                _instances.map(i => i.box),
                _instances,
                _instances.map(i => i.depth),
                _instances.map(i => i.group),
            );
            for (let k = 0; k < n; k++) _drawInstance(_instances[order[k]], camX, camY);
            _instances.length = 0;
            _poolNext = 0;
        },
    };

    return renderer;
};

// Unique group ids for add({ group }) — e.g. one per rotating model part.
let _nextGroup = 1;
export const newRenderGroup = (): number => {
    _nextGroup = _nextGroup >= 0x3fffffff ? 1 : _nextGroup + 1;
    return _nextGroup;
};
