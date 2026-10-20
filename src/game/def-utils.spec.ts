import { describe, it, expect } from 'vitest';
import { applyParts, applyRotateNodes, getTransformedPivots, applyNodes, renderNodes } from './def-utils';
import type { DEF, DEF2, DEF3 } from './defs';

const CLOSE = 4; // decimal places for float comparisons

// ─── applyParts — rotateNodes (legacy) ───────────────────────────────────────

describe('applyParts — rotateNodes', () => {
    it('appends rotated faces to existing faces', () => {
        const def: DEF = {
            id: 'test',
            faces: [{ id: 'base', verts: [[0, 0, 0]], color: '#000' }],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'angle',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        const result = applyParts(def, { angle: 0 });
        expect(result.faces.length).toBe(2);
        expect(result.faces[0].id).toBe('base');
        expect(result.faces[1].id).toBe('arm');
    });

    it('does not mutate the original DEF', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'angle',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        applyParts(def, { angle: Math.PI / 2 });
        expect(def.faces.length).toBe(0);
    });

    it('rotates 90° around Z: [1,0,0] → [0,1,0]', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'a',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        const result = applyParts(def, { a: Math.PI / 2 });
        const [x, y, z] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(0, CLOSE);
        expect(y).toBeCloseTo(1, CLOSE);
        expect(z).toBeCloseTo(0, CLOSE);
    });

    it('rotates 180° around Z: [1,0,0] → [-1,0,0]', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'a',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        const result = applyParts(def, { a: Math.PI });
        const [x, y] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(-1, CLOSE);
        expect(y).toBeCloseTo(0, CLOSE);
    });

    it('pivot offset is respected', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [1, 0, 0],
                axis: [0, 0, 1],
                param: 'a',
                faces: [{ id: 'arm', verts: [[2, 0, 0]], color: '#fff' }],
            }],
        };
        // point [2,0,0] is distance 1 from pivot [1,0,0]
        // rotating 90° around Z through pivot → [1,1,0]
        const result = applyParts(def, { a: Math.PI / 2 });
        const [x, y] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(1, CLOSE);
        expect(y).toBeCloseTo(1, CLOSE);
    });

    it('angle=0 leaves verts unchanged', () => {
        const verts = [[3, 2, 1]];
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'a',
                faces: [{ id: 'arm', verts, color: '#fff' }],
            }],
        };
        const result = applyParts(def, { a: 0 });
        const [x, y, z] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(3, CLOSE);
        expect(y).toBeCloseTo(2, CLOSE);
        expect(z).toBeCloseTo(1, CLOSE);
    });

    it('missing param defaults to angle 0', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'missing',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        const result = applyParts(def, {});
        const [x, y] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(1, CLOSE);
        expect(y).toBeCloseTo(0, CLOSE);
    });
});

// ─── applyParts — parts ───────────────────────────────────────────────────────

describe('applyParts — parts', () => {
    it('appends part faces (no rotation)', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [{
                id: 'wing',
                faces: [{ id: 'w0', verts: [[0, 0, 0]], color: '#fff' }],
            }],
        };
        const result = applyParts(def, {});
        expect(result.faces.length).toBe(1);
        expect(result.faces[0].id).toBe('w0');
    });

    it('opts.only filters which parts are included', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [
                { id: 'a', faces: [{ id: 'fa', verts: [], color: '#f00' }] },
                { id: 'b', faces: [{ id: 'fb', verts: [], color: '#0f0' }] },
            ],
        };
        const result = applyParts(def, {}, { only: ['a'] });
        expect(result.faces.length).toBe(1);
        expect(result.faces[0].id).toBe('fa');
    });

    it('part with rotate applies Rodrigues rotation', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [{
                id: 'rotor',
                faces: [{ id: 'blade', verts: [[1, 0, 0]], color: '#fff' }],
                rotate: { pivot: [0, 0, 0], axis: [0, 0, 1], param: 'angle' },
            }],
        };
        const result = applyParts(def, { angle: Math.PI / 2 });
        const [x, y] = result.faces[0].verts[0];
        expect(x).toBeCloseTo(0, CLOSE);
        expect(y).toBeCloseTo(1, CLOSE);
    });
});

// ─── applyRotateNodes (alias) ─────────────────────────────────────────────────

describe('applyRotateNodes', () => {
    it('is an alias for applyParts and produces same result', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            rotateNodes: [{
                pivot: [0, 0, 0],
                axis: [0, 0, 1],
                param: 'a',
                faces: [{ id: 'arm', verts: [[1, 0, 0]], color: '#fff' }],
            }],
        };
        const r1 = applyParts(def, { a: 1.2 });
        const r2 = applyRotateNodes(def, { a: 1.2 });
        expect(r1.faces[0].verts[0]).toEqual(r2.faces[0].verts[0]);
    });
});

// ─── getTransformedPivots ─────────────────────────────────────────────────────

// ─── D3F — computed normals (applyNodes) ──────────────────────────────────────

describe('applyNodes — D3F auto-normal', () => {
    const quad = (...verts: number[][]) => verts;

    it('computes an outward normal from winding for a version:3 def', () => {
        const def: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [{
                    id: 'top',
                    verts: quad([-0.5, -0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 1], [-0.5, 0.5, 1]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, {});
        const [nx, ny, nz] = result.faces[0].normal3d!;
        expect(nx).toBeCloseTo(0, CLOSE);
        expect(ny).toBeCloseTo(0, CLOSE);
        expect(nz).toBeCloseTo(1, CLOSE);
    });

    it('a +X-facing wall computes normal3d ≈ [1,0,0]', () => {
        const def: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [{
                    id: 'right',
                    verts: quad([0.5, -0.5, 0], [0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, -0.5, 1]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, {});
        const [nx, ny, nz] = result.faces[0].normal3d!;
        expect(nx).toBeCloseTo(1, CLOSE);
        expect(ny).toBeCloseTo(0, CLOSE);
        expect(nz).toBeCloseTo(0, CLOSE);
    });

    it('an explicit legacy normal overrides auto-computation (normal3d absent)', () => {
        const def: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [{
                    id: 'right',
                    normal: [1, 0],
                    verts: quad([0.5, -0.5, 0], [0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, -0.5, 1]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, {});
        expect(result.faces[0].normal).toEqual([1, 0]);
        expect(result.faces[0].normal3d).toBeUndefined();
    });

    it('version:2 defs never get normal3d, even without an explicit normal', () => {
        const def: DEF2 = {
            version: 2,
            id: 'test',
            nodes: [{
                faces: [{
                    id: 'top',
                    verts: quad([-0.5, -0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 1], [-0.5, 0.5, 1]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, {});
        expect(result.faces[0].normal3d).toBeUndefined();
    });

    it('normal3d follows node rotation: local +X wall rotated 90° around Z → [0,1,0]', () => {
        const def: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                rotate: { pivot: [0, 0, 0], axis: [0, 0, 1], param: 'a' },
                faces: [{
                    id: 'right',
                    verts: quad([0.5, -0.5, 0], [0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, -0.5, 1]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, { a: Math.PI / 2 });
        const [nx, ny, nz] = result.faces[0].normal3d!;
        expect(nx).toBeCloseTo(0, CLOSE);
        expect(ny).toBeCloseTo(1, CLOSE);
        expect(nz).toBeCloseTo(0, CLOSE);
    });

    it('degenerate face (collinear verts) gets no normal3d', () => {
        const def: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [{
                    id: 'flat',
                    verts: quad([0, 0, 0], [1, 0, 0], [2, 0, 0]),
                    color: '#fff',
                }],
            }],
        };
        const result = applyNodes(def, {});
        expect(result.faces[0].normal3d).toBeUndefined();
    });
});

type _AddOpts = { depth?: number; group?: number };

describe('renderNodes — depthAnchor dz (rotation-invariant fallback depth)', () => {
    const anchoredDef = (dz: number): DEF3 => ({
        version: 3,
        id: 'test',
        nodes: [{
            depthAnchor: [0, 0, dz],
            faces: [{ id: 'f', verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#fff' }],
        }],
    });

    it('dz is not rotated by instance angle (unlike dx/dy)', () => {
        const depths: number[] = [];
        for (const angle of [0, Math.PI / 3, Math.PI, 4.7]) {
            const renderer = { add: (_d: unknown, opts: _AddOpts) => { depths.push(opts.depth!); } };
            renderNodes(anchoredDef(-3), {}, { x: 0, y: 0, angle }, renderer);
        }
        depths.forEach(d => expect(d).toBeCloseTo(-3, CLOSE));
    });

    it('a large negative dz keeps a node behind others at every angle, unlike a dx-only epsilon', () => {
        const low: DEF3 = { version: 3, id: 'low', nodes: [{ depthAnchor: [0, 0, -3], faces: [{ id: 'a', verts: [[0,0,0]], color: '#fff' }] }] };
        const high: DEF3 = { version: 3, id: 'high', nodes: [{ depthAnchor: [1.85, 0, 0.55], faces: [{ id: 'b', verts: [[0,0,0]], color: '#fff' }] }] };
        for (const angle of [0, 1, 2, 3, 4, 5, 6]) {
            let lowDepth = 0, highDepth = 0;
            renderNodes(low, {}, { x: 0, y: 0, angle }, { add: (_d: unknown, opts: _AddOpts) => { lowDepth = opts.depth!; } });
            renderNodes(high, {}, { x: 0, y: 0, angle }, { add: (_d: unknown, opts: _AddOpts) => { highDepth = opts.depth!; } });
            expect(lowDepth).toBeLessThan(highDepth);
        }
    });
});

describe('renderNodes — queues into the frame batch, never flushes', () => {
    const twoNodeDef: DEF3 = {
        version: 3,
        id: 'test',
        nodes: [
            { faces: [{ id: 'a', verts: [[0,0,0]], color: '#fff' }] },
            { faces: [{ id: 'b', verts: [[0,0,0]], color: '#fff' }] },
        ],
    };

    it('the renderer it is given needs no flush() at all', () => {
        const calls: string[] = [];
        renderNodes(twoNodeDef, {}, { x: 0, y: 0, angle: 0 }, { add: () => { calls.push('add'); } });
        expect(calls).toEqual(['add', 'add']);
    });

    it('each top-level node becomes its own sort item', () => {
        const ids: string[][] = [];
        renderNodes(twoNodeDef, {}, { x: 0, y: 0, angle: 0 }, {
            add: (d: unknown) => { ids.push((d as { faces: { id: string }[] }).faces.map(f => f.id)); },
        });
        expect(ids).toEqual([['a'], ['b']]);
    });

    it('a node with no moving parts gets one add() call in authored array order (not a per-face centroid sort)', () => {
        const flatDef: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [
                    { id: 'low', verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#fff' },
                    { id: 'high', verts: [[0, 0, 5], [1, 0, 5], [1, 1, 5], [0, 1, 5]], color: '#fff' },
                ],
            }],
        };
        const calls: { faces: { id: string }[] }[] = [];
        renderNodes(flatDef, {}, { x: 0, y: 0, angle: 0 }, { add: (d: unknown) => { calls.push(d as { faces: { id: string }[] }); } });
        expect(calls.length).toBe(1);
        expect(calls[0].faces.map(f => f.id)).toEqual(['low', 'high']);
    });

    it('a node WITH a rotating part gets a per-face depth order, all faces in one render group', () => {
        const rotatingDef: DEF3 = {
            version: 3,
            id: 'test',
            nodes: [{
                faces: [{ id: 'low', verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#fff' }],
                children: [{
                    rotate: { pivot: [0, 0, 0], axis: [0, 0, 1], param: 'a' },
                    faces: [{ id: 'high', verts: [[0, 0, 5], [1, 0, 5], [1, 1, 5], [0, 1, 5]], color: '#fff' }],
                }],
            }],
        };
        const items: { id: string; depth?: number; group?: number }[] = [];
        renderNodes(rotatingDef, {}, { x: 0, y: 0, angle: 0 }, {
            add: (d: unknown, opts: _AddOpts) => { items.push({ id: (d as { faces: { id: string }[] }).faces[0].id, ...opts }); },
        });
        expect(items.length).toBe(2);
        const low = items.find(d => d.id === 'low')!;
        const high = items.find(d => d.id === 'high')!;
        expect(high.depth).toBeGreaterThan(low.depth!);
        expect(low.group).toBeGreaterThan(0);
        expect(high.group).toBe(low.group);
    });
});

describe('getTransformedPivots', () => {
    it('returns empty map for def with no parts', () => {
        const def: DEF = { id: 'test', faces: [] };
        expect(getTransformedPivots(def, {}).size).toBe(0);
    });

    it('excludes parts without a rotate property', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [{ id: 'static', faces: [] }],
        };
        expect(getTransformedPivots(def, {}).size).toBe(0);
    });

    it('returns the pivot unchanged for a root part with no parent', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [{
                id: 'arm',
                faces: [],
                rotate: { pivot: [2, 0, 0], axis: [0, 0, 1], param: 'angle' },
            }],
        };
        const pivots = getTransformedPivots(def, { angle: Math.PI / 2 });
        const [px, py, pz] = pivots.get('arm')!;
        expect(px).toBeCloseTo(2, CLOSE);
        expect(py).toBeCloseTo(0, CLOSE);
        expect(pz).toBeCloseTo(0, CLOSE);
    });

    it('transforms child pivot through parent rotation', () => {
        // Parent rotates 90° around Z at origin.
        // Child has pivot at [2, 0, 0] relative to world.
        // After parent's 90° rotation: child pivot should be at [0, 2, 0].
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [
                {
                    id: 'parent',
                    faces: [],
                    rotate: { pivot: [0, 0, 0], axis: [0, 0, 1], param: 'angle' },
                },
                {
                    id: 'child',
                    parent: 'parent',
                    faces: [],
                    rotate: { pivot: [2, 0, 0], axis: [0, 0, 1], param: 'angle' },
                },
            ],
        };
        const pivots = getTransformedPivots(def, { angle: Math.PI / 2 });
        const [px, py] = pivots.get('child')!;
        expect(px).toBeCloseTo(0, CLOSE);
        expect(py).toBeCloseTo(2, CLOSE);
    });

    it('all rotating parts appear in the result map', () => {
        const def: DEF = {
            id: 'test',
            faces: [],
            parts: [
                { id: 'a', faces: [], rotate: { pivot: [0,0,0], axis: [0,0,1], param: 'p' } },
                { id: 'b', faces: [] },
                { id: 'c', faces: [], rotate: { pivot: [1,0,0], axis: [0,0,1], param: 'p' } },
            ],
        };
        const pivots = getTransformedPivots(def, {});
        expect(pivots.has('a')).toBe(true);
        expect(pivots.has('b')).toBe(false);
        expect(pivots.has('c')).toBe(true);
    });
});
