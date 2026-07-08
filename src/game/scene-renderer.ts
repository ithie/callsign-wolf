// ─── SceneRenderer ────────────────────────────────────────────────────────────
// Factory for the isometric depth-sorted DEF renderer.
// See DEF_SPEC.md for the full architecture.
//
// Usage:
//   const renderer = createSceneRenderer(ctx, iso);
//   renderer.add(MY_DEF, { x, y, z, angle });
//   renderer.flush(camX, camY);
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

export interface DEFInstanceOptions {
    x: number;
    y: number;
    z?: number;
    angle?: number;
    /** Per-face color overrides keyed by face id */
    colors?: Record<string, string>;
    /** Called after DEF faces, depth-sorted alongside them */
    drawFn?: DrawFn;
    /** Explicit depth override (use for sub-objects whose centroid differs from origin) */
    depth?: number;
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
}

const _POOL_SIZE = 512;
const _makeInst = (): _Instance => ({
    def: null,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    colors: undefined,
    depth: 0,
    drawFn: null,
});

// Pre-allocated scratch points for face vertex projection (max 64 verts per face).
const _scratchPts: { x: number; y: number }[] = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));

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

    const renderer: SceneRenderer = {
        drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) {
            _drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color);
        },

        add(def, { x, y, z = 0, angle = 0, colors, drawFn, depth: depthOverride } = {} as DEFInstanceOptions) {
            const inst = _poolNext < _POOL_SIZE ? _pool[_poolNext++] : _makeInst();
            inst.def = def;
            inst.x = x;
            inst.y = y;
            inst.z = z;
            inst.angle = angle;
            inst.colors = colors;
            inst.depth = depthOverride ?? x + y;
            inst.drawFn = drawFn ?? null;
            _instances.push(inst);
        },

        flush(camX, camY) {
            _instances.sort((a, b) => a.depth - b.depth);
            for (const inst of _instances) {
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
            }
            _instances.length = 0;
            _poolNext = 0;
        },
    };

    return renderer;
};
