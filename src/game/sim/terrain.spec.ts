import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../main', () => ({
    campaignHandler: { getTerrain: () => ({ gridSize: 10, terrain: [] }) },
}));

import { G } from '../state';
import { getCarrierLocal, initGrid, getGround, isFlatTerrain } from './terrain';

const mkCarrier = (x: number, y: number, angle: number, w = 8, l = 4, zDeck = 2) =>
    ({ x, y, angle, w, l, zDeck } as any);

const mkPoints = (size: number, fillWith = 0): number[][] => {
    const p: number[][] = [];
    for (let x = 0; x <= size; x++) {
        p[x] = [];
        for (let y = 0; y <= size; y++) p[x][y] = fillWith;
    }
    return p;
};

beforeEach(() => {
    G.SUBMARINES.length = 0;
});

// ─── getCarrierLocal ──────────────────────────────────────────────────────────

describe('getCarrierLocal', () => {
    it('returns zero offset when point equals carrier position', () => {
        const c = mkCarrier(5, 5, 0);
        const r = getCarrierLocal(5, 5, c);
        expect(r.x).toBeCloseTo(0);
        expect(r.y).toBeCloseTo(0);
    });

    it('is identity at angle 0', () => {
        const c = mkCarrier(0, 0, 0);
        const r = getCarrierLocal(3, 4, c);
        expect(r.x).toBeCloseTo(3);
        expect(r.y).toBeCloseTo(4);
    });

    it('rotates correctly at angle π/2', () => {
        const c = mkCarrier(0, 0, Math.PI / 2);
        const r = getCarrierLocal(1, 0, c); // dx=1, dy=0
        // ang=-π/2: x=dx*cos(-π/2)-dy*sin(-π/2)=0-0=0, y=dx*sin(-π/2)+dy*cos(-π/2)=-1+0=-1
        expect(r.x).toBeCloseTo(0);
        expect(r.y).toBeCloseTo(-1);
    });

    it('rotates correctly at angle π', () => {
        const c = mkCarrier(0, 0, Math.PI);
        const r = getCarrierLocal(2, 0, c);
        // ang=-π: cos(-π)=-1, sin(-π)≈0 → x=-2, y≈0
        expect(r.x).toBeCloseTo(-2);
        expect(r.y).toBeCloseTo(0);
    });

    it('offset is translated before rotation', () => {
        const c = mkCarrier(10, 10, 0);
        const r = getCarrierLocal(12, 10, c);
        expect(r.x).toBeCloseTo(2);
        expect(r.y).toBeCloseTo(0);
    });
});

// ─── initGrid ─────────────────────────────────────────────────────────────────

describe('initGrid', () => {
    it('creates (size+1) rows', () => {
        const p: number[][] = [];
        initGrid(4, p);
        expect(p.length).toBe(5);
    });

    it('each row has (size+1) columns filled with 0', () => {
        const p: number[][] = [];
        initGrid(3, p);
        p.forEach(row => {
            expect(row).toHaveLength(4);
            row.forEach(v => expect(v).toBe(0));
        });
    });

    it('overwrites previously populated points', () => {
        const p: number[][] = [];
        initGrid(2, p);
        p[0][0] = 99;
        initGrid(2, p);
        expect(p[0][0]).toBe(0);
    });
});

// ─── getGround ────────────────────────────────────────────────────────────────

describe('getGround — basic interpolation', () => {
    it('returns 0 on a flat zeroed grid', () => {
        const p = mkPoints(10);
        const result = getGround(5, 5, p, {} as any);
        expect(result).toBe(0);
    });

    it('returns exact value at grid corner', () => {
        const p = mkPoints(10);
        p[3][4] = 2.5;
        const result = getGround(3, 4, p, {} as any);
        expect(result).toBeCloseTo(2.5);
    });

    it('interpolates between two heights', () => {
        const p = mkPoints(10);
        p[5][5] = 0;
        p[6][5] = 4;
        // fx=5.5 → tX=0.5, tY=0 → result ≈ 0*(0.5)*(1) + 4*(0.5)*(1) = 2
        const result = getGround(5.5, 5, p, {} as any);
        expect(result).toBeCloseTo(2);
    });

    it('returns -1.0 for out-of-bounds coordinates', () => {
        const p = mkPoints(10);
        expect(getGround(-1, 5, p, {} as any)).toBe(-1.0);
        expect(getGround(5, -1, p, {} as any)).toBe(-1.0);
        expect(getGround(11, 5, p, {} as any)).toBe(-1.0);
    });
});

describe('getGround — carrier deck', () => {
    it('returns CARRIER.zDeck when inside carrier bounds', () => {
        const p = mkPoints(10);
        const c = mkCarrier(5, 5, 0, 8, 4, 3.0);
        // local (0,0) is inside [-8,8]x[-4,4]
        const result = getGround(5, 5, p, c);
        expect(result).toBe(3.0);
    });

    it('returns grid height outside carrier bounds', () => {
        const p = mkPoints(10, 1);
        const c = mkCarrier(5, 5, 0, 2, 2, 3.0);
        // local (3,0) is outside [-2,2]x[-2,2]; x1=8 is valid in gridSize=10
        const result = getGround(8, 5, p, c);
        expect(result).toBe(1);
    });

    it('skips carrier check when CARRIER.x is undefined', () => {
        const p = mkPoints(10, 1.5);
        const result = getGround(5, 5, p, {} as any);
        expect(result).toBeCloseTo(1.5);
    });
});

describe('getGround — submarine deck', () => {
    it('returns sub zDeck when position is inside sub bounds', () => {
        G.SUBMARINES.push({ x: 5, y: 5, angle: 0, l: 3, w: 1, zDeck: 2.5 });
        const p = mkPoints(10);
        const result = getGround(5, 5, p, {} as any);
        expect(result).toBeCloseTo(2.5);
    });

    it('ignores sub when position is outside bounds', () => {
        G.SUBMARINES.push({ x: 5, y: 5, angle: 0, l: 1, w: 1, zDeck: 2.5 });
        const p = mkPoints(10, 1);
        const result = getGround(5, 8, p, {} as any); // ly=3 > w=1 → outside
        expect(result).toBeCloseTo(1);
    });
});

// ─── isFlatTerrain ────────────────────────────────────────────────────────────

describe('isFlatTerrain', () => {
    beforeEach(() => { G.points = mkPoints(10); });

    it('returns true on perfectly flat terrain', () => {
        G.points[2][3] = 1;
        G.points[3][3] = 1;
        G.points[2][4] = 1;
        G.points[3][4] = 1;
        expect(isFlatTerrain(2, 3)).toBe(true);
    });

    it('returns false when height difference exceeds 0.15', () => {
        G.points[2][3] = 0;
        G.points[3][3] = 0;
        G.points[2][4] = 0;
        G.points[3][4] = 0.2;
        expect(isFlatTerrain(2, 3)).toBe(false);
    });

    it('returns true when height difference is exactly 0.14', () => {
        G.points[4][4] = 0;
        G.points[5][4] = 0;
        G.points[4][5] = 0;
        G.points[5][5] = 0.14;
        expect(isFlatTerrain(4, 4)).toBe(true);
    });

    it('returns false for undefined grid position', () => {
        expect(isFlatTerrain(-1, 0)).toBe(false);
    });
});
