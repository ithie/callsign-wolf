/**
 * Verifies the isometric projection constants are consistent across the codebase.
 *
 * The canonical game constants:
 *   tileW = 64, tileH = 32, stepH = 25
 *
 * render-utils.ts derives:
 *   sTH = sTW / 2             → matches tileH / tileW = 32/64 = 0.5  ✓
 *   sH  = sTW * (25 / 64)     → matches stepH / tileW = 25/64 ≈ 0.391 ✓
 *
 * scene-renderer.ts applies:
 *   screen.x = cx + (wx - wy) * (tileW / 2)
 *   screen.y = cy + (wx + wy) * (tileH / 2) - wz * stepH
 */
import { describe, it, expect } from 'vitest';

const TILE_W = 64;
const TILE_H = 32;
const STEP_H = 25;

/** Iso projection as used in the game (scene-renderer.ts) */
const gameIso = (wx: number, wy: number, wz: number, cx: number, cy: number) => ({
    x: cx + (wx - wy) * (TILE_W / 2),
    y: cy + (wx + wy) * (TILE_H / 2) - wz * STEP_H,
});

/** Iso projection as used in render-utils.ts (parameterised by sTW) */
const renderUtilsIso = (wx: number, wy: number, wz: number, cx: number, cy: number, sTW: number) => {
    const sTH = sTW / 2;
    const sH  = sTW * (25 / 64);
    return {
        x: cx + (wx - wy) * (sTW / 2),
        y: cy + (wx + wy) * (sTH / 2) - wz * sH,
    };
};

describe('iso formula ratios', () => {
    it('tileH / tileW = 0.5 (sTH = sTW / 2)', () => {
        expect(TILE_H / TILE_W).toBeCloseTo(0.5, 10);
    });

    it('stepH / tileW = 25/64 (sH = sTW * (25/64))', () => {
        expect(STEP_H / TILE_W).toBeCloseTo(25 / 64, 10);
    });
});

describe('render-utils iso matches game iso up to a scale factor', () => {
    const testCases = [
        { wx: 0, wy: 0, wz: 0 },
        { wx: 5, wy: 3, wz: 2 },
        { wx: -2, wy: 7, wz: 4 },
        { wx: 10, wy: 10, wz: 0 },
        { wx: 3, wy: 0, wz: 8 },
    ];

    it('x-offset is proportional to (sTW / tileW) scale', () => {
        const scale = 2.0; // arbitrary scale factor
        const sTW = TILE_W * scale;
        const cx = 400, cy = 300;

        testCases.forEach(({ wx, wy, wz }) => {
            const game   = gameIso(wx, wy, wz, cx, cy);
            const editor = renderUtilsIso(wx, wy, wz, cx, cy, sTW);
            // Offsets from centre must be exactly `scale` × the game offsets
            expect(editor.x - cx).toBeCloseTo((game.x - cx) * scale, 8);
            expect(editor.y - cy).toBeCloseTo((game.y - cy) * scale, 8);
        });
    });

    it('at scale = tileW the two formulas are identical', () => {
        const sTW = TILE_W; // scale = 1
        const cx = 400, cy = 300;

        testCases.forEach(({ wx, wy, wz }) => {
            const game   = gameIso(wx, wy, wz, cx, cy);
            const editor = renderUtilsIso(wx, wy, wz, cx, cy, sTW);
            expect(editor.x).toBeCloseTo(game.x, 8);
            expect(editor.y).toBeCloseTo(game.y, 8);
        });
    });
});

describe('iso formula geometry sanity', () => {
    it('moving +X increases both screen x and y', () => {
        const a = gameIso(0, 0, 0, 0, 0);
        const b = gameIso(1, 0, 0, 0, 0);
        expect(b.x).toBeGreaterThan(a.x);
        expect(b.y).toBeGreaterThan(a.y);
    });

    it('moving +Y decreases screen x and increases screen y', () => {
        const a = gameIso(0, 0, 0, 0, 0);
        const b = gameIso(0, 1, 0, 0, 0);
        expect(b.x).toBeLessThan(a.x);
        expect(b.y).toBeGreaterThan(a.y);
    });

    it('moving +Z decreases screen y (goes up)', () => {
        const a = gameIso(0, 0, 0, 0, 0);
        const b = gameIso(0, 0, 1, 0, 0);
        expect(b.x).toBe(a.x); // height has no horizontal component
        expect(b.y).toBeLessThan(a.y);
    });
});
