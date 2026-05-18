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

export type IsoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) => { x: number; y: number };
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
    drawCollisionBox(camX: number, camY: number, wX: number, wY: number, angle: number, xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number, color?: string): void;
    debugCollision: boolean;
    debugAltitude: boolean;
}

interface _Face {
    worldVerts: number[][];
    color: string;
    stroke: string | null;
    strokeWidth: number;
}

interface _Instance {
    def: DEF | null;
    x: number; y: number; z: number; angle: number;
    faces: _Face[];
    depth: number;
    drawFn: DrawFn | null;
}

export function createSceneRenderer(ctx: CanvasRenderingContext2D, iso: IsoFn): SceneRenderer {
    const _instances: _Instance[] = [];

    const _transform = (
        lx: number, ly: number, lz: number,
        pivot: number[], angle: number,
        wx: number, wy: number, wz: number,
    ): number[] => {
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        return [
            (lx - pivot[0]) * cosA - (ly - pivot[1]) * sinA + wx,
            (lx - pivot[0]) * sinA + (ly - pivot[1]) * cosA + wy,
            (lz - pivot[2]) + wz,
        ];
    };

    const _visible = (nx: number, ny: number, angle: number): boolean => {
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        return (nx * cosA - ny * sinA) + (nx * sinA + ny * cosA) > 0;
    };

    const _drawCollisionBox = (
        camX: number, camY: number,
        wX: number, wY: number, angle: number,
        xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number,
        color?: string,
    ) => {
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const wp = (lx: number, ly: number, lz: number) => ({
            x: wX + lx * cosA - ly * sinA,
            y: wY + lx * sinA + ly * cosA,
            z: lz,
        });
        const corners = [
            wp(xMin, yMin, zMin), wp(xMax, yMin, zMin),
            wp(xMax, yMax, zMin), wp(xMin, yMax, zMin),
            wp(xMin, yMin, zMax), wp(xMax, yMin, zMax),
            wp(xMax, yMax, zMax), wp(xMin, yMax, zMax),
        ];
        const sc = corners.map(p => iso(p.x, p.y, p.z, camX, camY));
        const edges = [
            [0,1],[1,2],[2,3],[3,0],
            [4,5],[5,6],[6,7],[7,4],
            [0,4],[1,5],[2,6],[3,7],
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
        debugCollision: false,
        debugAltitude: false,

        drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) {
            _drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color);
        },

        add(def, { x, y, z = 0, angle = 0, colors, drawFn, depth: depthOverride } = {} as DEFInstanceOptions) {
            const faces: _Face[] = [];
            if (def) {
                const pivot = def.pivot ?? [0, 0, 0];
                for (const face of def.faces) {
                    if (face.normal) {
                        const [nx, ny] = face.normal;
                        if (!_visible(nx, ny, angle)) continue;
                    }
                    faces.push({
                        worldVerts: face.verts.map(([lx, ly, lz]) =>
                            _transform(lx, ly, lz, pivot, angle, x, y, z)
                        ),
                        color: (colors && colors[face.id]) ?? face.color,
                        stroke: face.stroke ?? null,
                        strokeWidth: face.strokeWidth ?? 1,
                    });
                }
            }
            _instances.push({
                def, x, y, z, angle, faces,
                depth: depthOverride ?? (x + y),
                drawFn: drawFn ?? null,
            });
        },

        flush(camX, camY) {
            _instances.sort((a, b) => a.depth - b.depth);
            for (const inst of _instances) {
                for (const face of inst.faces) {
                    const pts = face.worldVerts.map(([wx, wy, wz]) => iso(wx, wy, wz, camX, camY));
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.closePath();
                    ctx.fillStyle = face.color;
                    ctx.fill();
                    if (face.stroke) {
                        ctx.strokeStyle = face.stroke;
                        ctx.lineWidth = face.strokeWidth;
                        ctx.stroke();
                    }
                }
                if (inst.drawFn) inst.drawFn(camX, camY);
            }
            if (renderer.debugCollision) {
                for (const inst of _instances) {
                    if (!inst.def?.collisionBoxes) continue;
                    for (const cb of inst.def.collisionBoxes) {
                        _drawCollisionBox(
                            camX, camY, inst.x, inst.y, inst.angle,
                            cb.xMin, cb.xMax, cb.yMin, cb.yMax,
                            inst.z + cb.zMin, inst.z + cb.zMax,
                        );
                    }
                }
            }
            _instances.length = 0;
        },
    };

    return renderer;
}
