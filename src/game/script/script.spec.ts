import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { worldBoxes, boxesOverlap, bearingDeg, type CollisionBox } from './contact';
import { generateScriptObjects, checkScriptImports } from '../../../plugins/script-types';
import { applyNodes, COLLAPSE_PARAM, COLLAPSE_DIR_PARAM, COLLAPSE_WIND_PARAM, COLLAPSE_BURST_PARAM } from '../def-utils';
import type { DEF3 } from '../defs';

const CAMPAIGNS_DIR = resolve(__dirname, '../campaigns');

const TURBINE_BOXES = JSON.parse(readFileSync(resolve(__dirname, '../models/objects/wind_turbine.zdef'), 'utf-8'))
    .collisionBoxes as CollisionBox[];
const VESSEL_BOXES = JSON.parse(readFileSync(resolve(__dirname, '../models/supply_vessel.zdef'), 'utf-8'))
    .collisionBoxes as CollisionBox[];

const touching = (a: ReturnType<typeof worldBoxes>, b: ReturnType<typeof worldBoxes>): boolean =>
    a.some(x => b.some(y => boxesOverlap(x, y)));

// ─── onTouch contact ──────────────────────────────────────────────────────────

describe('contact — rotated 3D boxes', () => {
    const unit: CollisionBox = { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: 0, zMax: 1 };

    it('overlapping boxes touch, separated ones do not', () => {
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 1.9, 0, 0, 0))).toBe(true);
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 2.1, 0, 0, 0))).toBe(false);
    });

    it('respects rotation (a 45° box reaches further along the diagonal)', () => {
        // Axis-aligned the gap is 2.5 - 1 - 1 = 0.5; rotated 45° the corner reaches √2 ≈ 1.41.
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 2.3, 0, 0, 0))).toBe(false);
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 2.3, 0, Math.PI / 4, 0))).toBe(true);
    });

    it('needs z overlap too — something below a nacelle does not touch it', () => {
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 0, 0, 0, 1.5))).toBe(false);
        expect(touching(worldBoxes([unit], 0, 0, 0, 0), worldBoxes([unit], 0, 0, 0, 0.5))).toBe(true);
    });

    it('supply vessel hull drifting into a turbine pole touches it', () => {
        const turbine = worldBoxes(TURBINE_BOXES, 40, 40, 0, 0);
        // Hull broadside on (heading 135°), drifting along 225° towards the pole.
        const at = (d: number) => worldBoxes(VESSEL_BOXES, 40 + d * Math.SQRT1_2, 40 + d * Math.SQRT1_2, 135 * Math.PI / 180, 0);
        expect(touching(at(3), turbine)).toBe(false);
        expect(touching(at(1), turbine)).toBe(true);
    });

    it('vessel passing under the nacelle (only the nacelle box above) does not touch', () => {
        const nacelleOnly = worldBoxes(TURBINE_BOXES.filter(b => b.zMin >= 8), 40, 40, 0, 0);
        expect(nacelleOnly).toHaveLength(1);
        expect(touching(worldBoxes(VESSEL_BOXES, 40.5, 40, 0, 0), nacelleOnly)).toBe(false);
    });
});

describe('bearingDeg — map convention like object angles', () => {
    it('0° = +x, 90° = +y, always 0..360', () => {
        expect(bearingDeg(0, 0, 5, 0)).toBeCloseTo(0);
        expect(bearingDeg(0, 0, 0, 5)).toBeCloseTo(90);
        expect(bearingDeg(0, 0, -5, 0)).toBeCloseTo(180);
        expect(bearingDeg(0, 0, 0, -5)).toBeCloseTo(270);
    });

    it('Ikarus: supply vessel → turbine 2 is about 66°', () => {
        expect(bearingDeg(350, 288, 388, 375)).toBeCloseTo(66.4, 1);
    });
});

// ─── Generic collapse in the model baker ──────────────────────────────────────

describe('collapse — applyNodes with COLLAPSE_PARAM', () => {
    const tower: DEF3 = {
        version: 3, id: 'tower',
        nodes: [
            { faces: [{ id: 'base', color: '#888888', verts: [[-1, -1, 0], [1, -1, 0], [1, -1, 2], [-1, -1, 2]] }] },
            { faces: [{ id: 'top', color: '#888888', verts: [[-1, 1, 8], [1, 1, 8], [1, 1, 10], [-1, 1, 10]] }] },
        ],
    } as unknown as DEF3;
    const maxZ = (params: Record<string, number>) =>
        Math.max(...applyNodes(tower, params).faces.flatMap(f => f.verts.map(v => v[2])));

    it('t = 0 leaves the model untouched', () => {
        expect(maxZ({ [COLLAPSE_PARAM]: 0 })).toBeCloseTo(10);
    });

    it('t = 1 piles everything into a low heap', () => {
        expect(maxZ({ [COLLAPSE_PARAM]: 1 })).toBeLessThan(10 * 0.15);
    });

    it('sinks monotonically over the animation', () => {
        const zs = [0, 0.25, 0.5, 0.75, 1].map(t => maxZ({ [COLLAPSE_PARAM]: t }));
        for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeLessThanOrEqual(zs[i - 1] + 1e-9);
    });

    it('with full wind, parts fall downwind', () => {
        // Model centred on x = 0: the rubble's centre of mass moves towards the wind direction.
        const meanX = (params: Record<string, number>) => {
            const xs = applyNodes(tower, params).faces.flatMap(f => f.verts.map(v => v[0]));
            return xs.reduce((a, b) => a + b, 0) / xs.length;
        };
        const standing = meanX({});
        expect(meanX({ [COLLAPSE_PARAM]: 1, [COLLAPSE_DIR_PARAM]: 0, [COLLAPSE_WIND_PARAM]: 1 })).toBeGreaterThan(standing + 0.2);
        expect(meanX({ [COLLAPSE_PARAM]: 1, [COLLAPSE_DIR_PARAM]: Math.PI, [COLLAPSE_WIND_PARAM]: 1 })).toBeLessThan(standing - 0.2);
    });

    it('burst (vessels): pieces fly apart and end up flat', () => {
        const spreadOf = (params: Record<string, number>) => {
            const faces = applyNodes(tower, params).faces;
            const cs = faces.map(f => f.verts.reduce((a, v) => [a[0] + v[0] / f.verts.length, a[1] + v[1] / f.verts.length], [0, 0]));
            return cs.reduce((a, c) => a + Math.hypot(c[0], c[1]), 0) / cs.length;
        };
        const burst = { [COLLAPSE_BURST_PARAM]: 1 };
        expect(spreadOf({ [COLLAPSE_PARAM]: 1, ...burst })).toBeGreaterThan(spreadOf({}) + 0.8);
        expect(maxZ({ [COLLAPSE_PARAM]: 1, ...burst })).toBeLessThan(10 * 0.25);
    });

    it('rubble keeps back-face culling (normals from the deformed geometry)', () => {
        // Hidden back walls must stay hidden while collapsing, or e.g. a deck house shows twice.
        const faces = applyNodes(tower, { [COLLAPSE_PARAM]: 0.5 }).faces as any[];
        expect(faces.every(f => Array.isArray(f.normal3d) && f.normal3d.length === 3)).toBe(true);
    });
});

// ─── Type generation ──────────────────────────────────────────────────────────

describe('script types — generateScriptObjects', () => {
    it('maps names to API types per mission id, payloads included', () => {
        const code = generateScriptObjects('zephyr', {
            levels: [
                { objects: [{ type: 'wind_turbine', name: 'ignored_no_id' }] },
                {
                    id: 'ikarus',
                    objects: [
                        { type: 'pad', name: 'pad' },
                        { type: 'supply_vessel', name: 'versorger' },
                        { type: 'wind_turbine', name: 'wt2' },
                        { type: 'reindeer', name: 'rudolf' },
                        { type: 'xmas_house_a', name: 'haus' },
                    ],
                    payloads: [{ type: 'person', name: 'kapitaen' }],
                },
            ],
        });
        expect(code).toContain('export type ZephyrObjects');
        expect(code).toContain(`"versorger": Vessel<'supply_vessel'>;`);
        expect(code).toContain('"wt2": WindTurbine;');
        expect(code).toContain(`"rudolf": Prop<'reindeer'>;`);
        expect(code).toContain(`"haus": Structure<'xmas_house_a'>;`);
        expect(code).toContain(`"kapitaen": Payload<'person'>;`);
        expect(code).not.toContain('"pad"');
        expect(code).not.toContain('ignored_no_id');
    });

    it('rejects duplicate names within a mission (objects and payloads share them)', () => {
        expect(() => generateScriptObjects('x', {
            levels: [{ id: 'm', objects: [{ type: 'buoy', name: 'a' }], payloads: [{ type: 'person', name: 'a' }] }],
        })).toThrow(/used twice/);
    });

    it('rejects duplicate mission ids', () => {
        expect(() => generateScriptObjects('x', { levels: [{ id: 'm' }, { id: 'm' }] })).toThrow(/used twice/);
    });

    it('checked-in type files match their .zcampaign', () => {
        for (const file of readdirSync(CAMPAIGNS_DIR).filter(f => f.endsWith('.script.ts'))) {
            const key = file.slice(0, -'.script.ts'.length);
            const campaign = JSON.parse(readFileSync(join(CAMPAIGNS_DIR, `${key}.zcampaign`), 'utf-8'));
            const onDisk = readFileSync(join(CAMPAIGNS_DIR, `${key}.script-objects.ts`), 'utf-8');
            expect(onDisk).toBe(generateScriptObjects(key, campaign));
        }
    });
});

// ─── Import rule ──────────────────────────────────────────────────────────────

describe('script imports', () => {
    const file = join(CAMPAIGNS_DIR, 'zephyr.script.ts');

    it('allows the script API and files next to the script', () => {
        const code = `import { defineCampaignScript } from '@/game/script';\nimport type { ZephyrObjects } from './zephyr.script-objects';\nimport { helper } from './shared/helpers';`;
        expect(checkScriptImports(code, file, CAMPAIGNS_DIR)).toEqual([]);
    });

    it('rejects game internals', () => {
        const code = `import { G } from '../state';\nimport { getGround } from '@/game/sim/terrain';\nconst m = await import('../sim/collapse');`;
        expect(checkScriptImports(code, file, CAMPAIGNS_DIR)).toHaveLength(3);
    });

    it('every campaign script obeys the rule', () => {
        for (const f of readdirSync(CAMPAIGNS_DIR).filter(n => n.endsWith('.script.ts'))) {
            const path = join(CAMPAIGNS_DIR, f);
            expect(checkScriptImports(readFileSync(path, 'utf-8'), path, CAMPAIGNS_DIR)).toEqual([]);
        }
    });
});
