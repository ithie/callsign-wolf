import { describe, it, expect } from 'vitest';
import { compressFoliage, decompressFoliage, compressTerrain, decompressTerrain } from './utils';

// ─── Foliage ──────────────────────────────────────────────────────────────────

describe('compressFoliage', () => {
    it('returns empty string for empty array', () => {
        expect(compressFoliage([])).toBe('');
    });

    it('encodes all four types with correct prefix chars', () => {
        const out = compressFoliage([
            { type: 'pine', x: 0, y: 0, s: 1 },
            { type: 'oak',  x: 0, y: 0, s: 1 },
            { type: 'bush', x: 0, y: 0, s: 1 },
            { type: 'dead', x: 0, y: 0, s: 1 },
        ]);
        const tokens = out.split('|');
        expect(tokens[0][0]).toBe('p');
        expect(tokens[1][0]).toBe('o');
        expect(tokens[2][0]).toBe('b');
        expect(tokens[3][0]).toBe('d');
    });

    it('encodes coordinates at ×10 precision', () => {
        const out = compressFoliage([{ type: 'pine', x: 12.3, y: 4.5, s: 0.7 }]);
        expect(out).toBe('p123,45,7');
    });

    it('separates multiple trees with pipe', () => {
        const out = compressFoliage([
            { type: 'pine', x: 1, y: 2, s: 1 },
            { type: 'oak',  x: 3, y: 4, s: 1 },
        ]);
        expect(out.split('|').length).toBe(2);
    });

    it('defaults unknown type to p (pine)', () => {
        const out = compressFoliage([{ type: 'unknown' as any, x: 0, y: 0, s: 1 }]);
        expect(out[0]).toBe('p');
    });

    it('defaults missing s to 1.0 (encodes as 10)', () => {
        const out = compressFoliage([{ type: 'pine', x: 0, y: 0, s: undefined as any }]);
        expect(out.endsWith(',10')).toBe(true);
    });
});

describe('decompressFoliage', () => {
    it('returns empty array for empty string', () => {
        expect(decompressFoliage('')).toEqual([]);
    });

    it('roundtrips a single tree exactly', () => {
        const input = [{ type: 'oak', x: 7.2, y: 3.1, s: 1.5 }];
        const result = decompressFoliage(compressFoliage(input));
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('oak');
        expect(result[0].x).toBeCloseTo(7.2, 1);
        expect(result[0].y).toBeCloseTo(3.1, 1);
        expect(result[0].s).toBeCloseTo(1.5, 1);
    });

    it('roundtrips all types correctly', () => {
        const input = [
            { type: 'pine', x: 1.1, y: 2.2, s: 1.0 },
            { type: 'oak',  x: 3.3, y: 4.4, s: 0.8 },
            { type: 'bush', x: 5.5, y: 6.6, s: 1.2 },
            { type: 'dead', x: 7.7, y: 8.8, s: 0.9 },
        ];
        const result = decompressFoliage(compressFoliage(input));
        expect(result).toHaveLength(4);
        input.forEach((item, i) => {
            expect(result[i].type).toBe(item.type);
            expect(result[i].x).toBeCloseTo(item.x, 1);
            expect(result[i].y).toBeCloseTo(item.y, 1);
            expect(result[i].s).toBeCloseTo(item.s, 1);
        });
    });
});

// ─── Terrain ──────────────────────────────────────────────────────────────────

describe('compressTerrain', () => {
    it('encodes a flat grid as a single RLE token', () => {
        const gridSize = 3;
        const grid: number[][] = Array.from({ length: gridSize + 1 }, () =>
            Array.from({ length: gridSize + 1 }, () => 2.0)
        );
        const out = compressTerrain(grid);
        // All values are 2.0 → ×10 = 20, repeated (gridSize+1)² = 16 times
        expect(out).toBe(`20x${(gridSize + 1) ** 2}`);
    });

    it('encodes distinct values without RLE', () => {
        const grid = [[0.0, 1.0], [2.0, 3.0]];
        const out = compressTerrain(grid);
        expect(out).toBe('0,10,20,30');
    });

    it('uses RLE only when count > 1', () => {
        const grid = [[0.0, 0.0], [1.0, 0.0]];
        const out = compressTerrain(grid);
        expect(out).toBe('0x2,10,0');
    });
});

describe('decompressTerrain', () => {
    it('returns (gridSize+1) × (gridSize+1) array', () => {
        const gridSize = 5;
        const grid: number[][] = Array.from({ length: gridSize + 1 }, () =>
            Array.from({ length: gridSize + 1 }, () => 1.0)
        );
        const result = decompressTerrain(compressTerrain(grid), gridSize);
        expect(result.length).toBe(gridSize + 1);
        result.forEach(col => expect(col.length).toBe(gridSize + 1));
    });

    it('roundtrips a flat terrain', () => {
        const gridSize = 4;
        const grid: number[][] = Array.from({ length: gridSize + 1 }, () =>
            Array.from({ length: gridSize + 1 }, () => 3.5)
        );
        const result = decompressTerrain(compressTerrain(grid), gridSize);
        result.forEach(col => col.forEach(v => expect(v).toBeCloseTo(3.5, 1)));
    });

    it('roundtrips varied terrain exactly', () => {
        const gridSize = 2;
        const grid: number[][] = [
            [0.0, 1.0, 2.0],
            [3.0, 4.0, 5.0],
            [6.0, 7.0, 8.0],
        ];
        const result = decompressTerrain(compressTerrain(grid), gridSize);
        for (let x = 0; x <= gridSize; x++) {
            for (let y = 0; y <= gridSize; y++) {
                expect(result[x][y]).toBeCloseTo(grid[x][y], 1);
            }
        }
    });

    it('roundtrips negative (below water) heights', () => {
        const gridSize = 1;
        const grid: number[][] = [[-1.0, -2.5], [0.0, 1.0]];
        const result = decompressTerrain(compressTerrain(grid), gridSize);
        expect(result[0][0]).toBeCloseTo(-1.0, 1);
        expect(result[0][1]).toBeCloseTo(-2.5, 1);
    });
});
