import { describe, it, expect } from 'vitest';
import { getLandColor, COLORS } from './constants';

describe('getLandColor', () => {
    it('returns rgb() format', () => {
        const col = getLandColor(0, false);
        expect(col).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    });

    it('h=0 day → r=50, g=150, b=50', () => {
        expect(getLandColor(0, false)).toBe('rgb(50, 150, 50)');
    });

    it('h=5 day → r=150, g=200, b=50', () => {
        expect(getLandColor(5, false)).toBe('rgb(150, 200, 50)');
    });

    it('night colors are darker than day for same height', () => {
        const day = getLandColor(3, false);
        const night = getLandColor(3, true);
        const parseRgb = (s: string) => s.match(/\d+/g)!.map(Number);
        const [dr, dg, db] = parseRgb(day);
        const [nr, ng, nb] = parseRgb(night);
        expect(nr).toBeLessThan(dr);
        expect(ng).toBeLessThan(dg);
        expect(nb).toBeLessThan(db);
    });

    it('night multiplies by 0.3 / 0.4 / 0.6', () => {
        const h = 0;
        // r = 50, g = 150, b = 50 at h=0
        expect(getLandColor(h, true)).toBe(
            `rgb(${Math.floor(50 * 0.3)}, ${Math.floor(150 * 0.4)}, ${Math.floor(50 * 0.6)})`
        );
    });

    it('r and g increase with height (day)', () => {
        const parseRgb = (s: string) => s.match(/\d+/g)!.map(Number);
        const low = parseRgb(getLandColor(1, false));
        const high = parseRgb(getLandColor(5, false));
        expect(high[0]).toBeGreaterThan(low[0]); // r
        expect(high[1]).toBeGreaterThan(low[1]); // g
    });

    it('b stays constant at 50 (day) regardless of height', () => {
        for (const h of [0, 1, 3, 7, 10]) {
            const col = getLandColor(h, false);
            const b = Number(col.match(/\d+/g)![2]);
            expect(b).toBe(50);
        }
    });
});

describe('COLORS', () => {
    it('has required keys', () => {
        const required = ['water', 'waterNight', 'padStroke', 'padFill', 'padNight',
            'carrierBase', 'carrierNight', 'uiHighlight'];
        required.forEach(k => {
            expect((COLORS as any)[k]).toBeDefined();
        });
    });

    it('water is darker in night', () => {
        // simple string comparison: '#001433' < '#004488' lexicographically
        expect(COLORS.waterNight < COLORS.water).toBe(true);
    });
});
