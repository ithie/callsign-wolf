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
