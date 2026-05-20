import { describe, it, expect } from 'vitest';
import { nGonRing, cylFaces, HANGAR_DEF, LIGHTHOUSE_DEF } from './defs';

const TWO_PI = Math.PI * 2;

describe('nGonRing', () => {
    it('returns n points', () => {
        expect(nGonRing(1, 0, 8).length).toBe(8);
        expect(nGonRing(1, 0, 16).length).toBe(16);
    });

    it('all points are at the given radius', () => {
        const r = 3.5;
        nGonRing(r, 0, 12).forEach(([x, y]) => {
            expect(Math.sqrt(x * x + y * y)).toBeCloseTo(r, 5);
        });
    });

    it('all points are at the given z', () => {
        const z = 7.25;
        nGonRing(1, z, 8).forEach(p => {
            expect(p[2]).toBe(z);
        });
    });

    it('points are evenly spaced (equal arc distance between neighbours)', () => {
        const pts = nGonRing(1, 0, 8);
        const dists = pts.map((p, i) => {
            const next = pts[(i + 1) % pts.length];
            return Math.sqrt((next[0] - p[0]) ** 2 + (next[1] - p[1]) ** 2);
        });
        const first = dists[0];
        dists.forEach(d => expect(d).toBeCloseTo(first, 10));
    });

    it('first point is at angle 0 → [r, 0, z]', () => {
        const r = 2;
        const [x, y] = nGonRing(r, 0, 6)[0];
        expect(x).toBeCloseTo(r, 10);
        expect(y).toBeCloseTo(0, 10);
    });
});

describe('cylFaces', () => {
    it('first face is always the top cap', () => {
        const faces = cylFaces(1, 0, 2, '#fff', null, 8);
        expect(faces[0].id).toMatch(/^cap_z/);
        expect(faces[0].verts.length).toBe(8);
    });

    it('top cap verts are all at zT', () => {
        const zT = 5.0;
        const faces = cylFaces(1, 0, zT, '#fff', null, 8);
        faces[0].verts.forEach(v => expect(v[2]).toBeCloseTo(zT, 10));
    });

    it('side face verts include both zB and zT', () => {
        const zB = 0, zT = 3;
        const faces = cylFaces(1, zB, zT, '#fff', null, 8);
        const sideFace = faces.find(f => f.id.startsWith('side_'))!;
        const zs = sideFace.verts.map(v => v[2]);
        expect(zs).toContain(zB);
        expect(zs).toContain(zT);
    });

    it('omits backface sides (nx+ny < -0.1)', () => {
        const n = 16;
        const faces = cylFaces(1, 0, 1, '#fff', null, n);
        const sideFaces = faces.filter(f => f.id.startsWith('side_'));
        sideFaces.forEach(f => {
            // Reconstruct the face's midpoint angle from its index in the id
            const idx = parseInt(f.id.split('_')[1], 10);
            const a0 = (idx / n) * TWO_PI;
            const a1 = ((idx + 1) / n) * TWO_PI;
            const nx = Math.cos((a0 + a1) / 2);
            const ny = Math.sin((a0 + a1) / 2);
            expect(nx + ny).toBeGreaterThanOrEqual(-0.1);
        });
    });

    it('includes fewer than n side faces (backfaces are culled)', () => {
        const n = 16;
        const faces = cylFaces(1, 0, 1, '#fff', null, n);
        const sideFaces = faces.filter(f => f.id.startsWith('side_'));
        expect(sideFaces.length).toBeLessThan(n);
    });

    it('passes color and stroke through to all faces', () => {
        const color = '#abc123';
        const stroke = '#def456';
        const faces = cylFaces(1, 0, 1, color, stroke, 8);
        faces.forEach(f => {
            expect(f.color).toBe(color);
            expect(f.stroke).toBe(stroke);
        });
    });
});

describe('HANGAR_DEF', () => {
    it('has id "hangar"', () => {
        expect(HANGAR_DEF.id).toBe('hangar');
    });

    it('has at least one collision box', () => {
        expect(HANGAR_DEF.collisionBoxes!.length).toBeGreaterThan(0);
    });

    it('all collision boxes have xMin < xMax, yMin < yMax, zMin < zMax', () => {
        HANGAR_DEF.collisionBoxes!.forEach(b => {
            expect(b.xMin).toBeLessThan(b.xMax);
            expect(b.yMin).toBeLessThan(b.yMax);
            expect(b.zMin).toBeLessThan(b.zMax);
        });
    });

    it('all face ids are unique', () => {
        const ids = HANGAR_DEF.faces.map(f => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('exterior faces have normals, interior faces do not', () => {
        HANGAR_DEF.faces.forEach(f => {
            if (f.id.endsWith('_ext')) {
                expect(f.normal).toBeDefined();
            } else if (f.id.endsWith('_int')) {
                expect(f.normal).toBeUndefined();
            }
        });
    });
});

describe('LIGHTHOUSE_DEF', () => {
    it('has id "lighthouse"', () => {
        expect(LIGHTHOUSE_DEF.id).toBe('lighthouse');
    });

    it('has multiple collision boxes (base + tower)', () => {
        expect(LIGHTHOUSE_DEF.collisionBoxes!.length).toBeGreaterThanOrEqual(2);
    });

    it('all face ids are unique', () => {
        const ids = LIGHTHOUSE_DEF.faces.map(f => f.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('has many faces from stacked cylinders', () => {
        expect(LIGHTHOUSE_DEF.faces.length).toBeGreaterThan(20);
    });
});
