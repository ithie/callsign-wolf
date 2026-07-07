import { describe, it, expect } from 'vitest';
import { HELI_TYPES, getHeliType } from './heli-types';

describe('HELI_TYPES', () => {
    it('contains at least one entry', () => {
        expect(HELI_TYPES.length).toBeGreaterThan(0);
    });

    it('all ids are unique', () => {
        const ids = HELI_TYPES.map(h => h.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('contains expected vehicle ids', () => {
        const ids = HELI_TYPES.map(h => h.id);
        expect(ids).toContain('dolphin');
        expect(ids).toContain('coasthawk');
        expect(ids).toContain('atlas');
    });

    it('all scale values are > 0', () => {
        HELI_TYPES.forEach(h => {
            expect(h.scale).toBeGreaterThan(0);
        });
    });

    it('all previewScale values are > 0', () => {
        HELI_TYPES.forEach(h => {
            expect(h.previewScale).toBeGreaterThan(0);
        });
    });

    it('all physics values are >= 0', () => {
        HELI_TYPES.forEach(h => {
            expect(h.maxLoad).toBeGreaterThanOrEqual(0);
            expect(h.accel).toBeGreaterThanOrEqual(0);
            expect(h.friction).toBeGreaterThan(0);
            expect(h.tiltSpeed).toBeGreaterThanOrEqual(0);
            expect(h.fuelRate).toBeGreaterThanOrEqual(0);
            expect(h.liftPower).toBeGreaterThanOrEqual(0);
            expect(h.cargoResist).toBeGreaterThanOrEqual(0);
        });
    });

    it('friction is < 1 for all helis (realistic deceleration)', () => {
        HELI_TYPES.forEach(h => {
            expect(h.friction).toBeLessThan(1);
        });
    });

    it('collision box xMin < xMax and yMin < yMax and zMax > 0', () => {
        HELI_TYPES.forEach(h => {
            const b = h.collisionBox;
            expect(b.xMin).toBeLessThan(b.xMax);
            expect(b.yMin).toBeLessThan(b.yMax);
            expect(b.zMax).toBeGreaterThan(0);
        });
    });

    it('all helis have a DEF with at least one face (root, parts, or nodes)', () => {
        HELI_TYPES.forEach(h => {
            expect(h.def).toBeDefined();
            const rootFaces = h.def.faces?.length ?? 0;
            const partFaces = h.def.parts?.reduce((sum, p) => sum + p.faces.length, 0) ?? 0;
            const nodeFaces = (h.def as any).nodes?.reduce((sum: number, n: any) => sum + (n.faces?.length ?? 0), 0) ?? 0;
            expect(rootFaces + partFaces + nodeFaces).toBeGreaterThan(0);
        });
    });

    it('heavier helis have higher maxLoad', () => {
        const dolphin = getHeliType('dolphin');
        const atlas = getHeliType('atlas');
        expect(atlas.maxLoad).toBeGreaterThan(dolphin.maxLoad);
    });

    it('heavier helis have lower accel', () => {
        const dolphin = getHeliType('dolphin');
        const atlas = getHeliType('atlas');
        expect(atlas.accel).toBeLessThan(dolphin.accel);
    });

    it('tandem helis have multiple rotorOffsets', () => {
        const atlas = getHeliType('atlas');
        expect(atlas.rotorOffsets.length).toBeGreaterThan(1);
    });
});

describe('getHeliType', () => {
    it('returns the correct entry by id', () => {
        const h = getHeliType('coasthawk');
        expect(h.id).toBe('coasthawk');
        expect(h.label).toBe('Coast-Hawk');
    });

    it('throws for unknown id', () => {
        expect(() => getHeliType('fantasy_chopper')).toThrow('Unknown heli type: fantasy_chopper');
    });

    it('result is same object reference as in HELI_TYPES', () => {
        const h = getHeliType('dolphin');
        expect(h).toBe(HELI_TYPES.find(x => x.id === 'dolphin'));
    });
});
