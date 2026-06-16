import { describe, it, expect } from 'vitest';
import { init, update } from './birds';
import type { ParticlesCtx } from './ctx';

const makeCtx = (): ParticlesCtx => ({
    particles: [], debris: [], flocks: [], emitters: [],
    heli: { x: 10, y: 10, z: 5, vx: 0, vy: 0, vz: 0, type: 'dolphin', angle: 0, rotorRPM: 0 },
    wind: { x: 0, y: 0, angle: 0, phase: 0, varOffset: 0, rawStr: 0 },
    waterLevel: 0, gridSize: 28,
    getGround: () => 1,
    getHeliType: () => ({ scale: 1, rotorOffsets: [0] }),
});

// ─── init ─────────────────────────────────────────────────────────────────────

describe('Birds.init', () => {
    it('populates 2–3 flocks', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        expect(ctx.flocks.length).toBeGreaterThanOrEqual(2);
        expect(ctx.flocks.length).toBeLessThanOrEqual(3);
    });

    it('each flock has 4–9 birds', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks.forEach(flock => {
            expect(flock.birds.length).toBeGreaterThanOrEqual(4);
            expect(flock.birds.length).toBeLessThanOrEqual(9);
        });
    });

    it('each bird has all required numeric fields', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks.forEach(flock =>
            flock.birds.forEach(bird => {
                expect(typeof bird.x).toBe('number');
                expect(typeof bird.y).toBe('number');
                expect(typeof bird.z).toBe('number');
                expect(typeof bird.vx).toBe('number');
                expect(typeof bird.vy).toBe('number');
                expect(typeof bird.vz).toBe('number');
                expect(typeof bird.wingPhase).toBe('number');
            })
        );
    });

    it('all flocks start non-fleeing with fleeTimer 0', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks.forEach(flock => {
            expect(flock.fleeing).toBe(false);
            expect(flock.fleeTimer).toBe(0);
        });
    });

    it('clears existing flocks on re-init', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        init({ ctx, dt: 0 });
        expect(ctx.flocks.length).toBeGreaterThanOrEqual(2);
        expect(ctx.flocks.length).toBeLessThanOrEqual(3);
    });

    it('birds spawn within grid bounds', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks.forEach(flock =>
            flock.birds.forEach(bird => {
                expect(bird.x).toBeGreaterThanOrEqual(0);
                expect(bird.x).toBeLessThanOrEqual(ctx.gridSize);
                expect(bird.y).toBeGreaterThanOrEqual(0);
                expect(bird.y).toBeLessThanOrEqual(ctx.gridSize);
            })
        );
    });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('Birds.update', () => {
    it('triggers fleeing when loud heli is within 8 units', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        const flock = ctx.flocks[0];
        const cx = flock.birds.reduce((s, b) => s + b.x, 0) / flock.birds.length;
        const cy = flock.birds.reduce((s, b) => s + b.y, 0) / flock.birds.length;
        ctx.heli = { ...ctx.heli, x: cx + 1, y: cy + 1, rotorRPM: 0.9 };
        update({ ctx, dt: 1 });
        expect(flock.fleeing).toBe(true);
        // fleeTimer is set to 180 then immediately decremented in the same tick
        expect(flock.fleeTimer).toBe(179);
    });

    it('does not trigger fleeing when heli is quiet (RPM <= 0.3)', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        const flock = ctx.flocks[0];
        const cx = flock.birds.reduce((s, b) => s + b.x, 0) / flock.birds.length;
        const cy = flock.birds.reduce((s, b) => s + b.y, 0) / flock.birds.length;
        ctx.heli = { ...ctx.heli, x: cx, y: cy, rotorRPM: 0.1 };
        update({ ctx, dt: 1 });
        expect(flock.fleeing).toBe(false);
    });

    it('fleeTimer decrements each tick when not re-triggered', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks[0].fleeing = true;
        ctx.flocks[0].fleeTimer = 5;
        ctx.heli = { ...ctx.heli, x: 9999, y: 9999, rotorRPM: 0 };
        update({ ctx, dt: 1 });
        expect(ctx.flocks[0].fleeTimer).toBe(4);
    });

    it('fleeing resets to false once fleeTimer hits 0', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.flocks[0].fleeing = true;
        ctx.flocks[0].fleeTimer = 1;
        ctx.heli = { ...ctx.heli, x: 9999, y: 9999, rotorRPM: 0 };
        update({ ctx, dt: 1 }); // timer: 1 → 0
        update({ ctx, dt: 1 }); // timer = 0 → fleeing = false
        expect(ctx.flocks[0].fleeing).toBe(false);
    });

    it('birds move each tick (position changes)', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        const before = { x: ctx.flocks[0].birds[0].x, y: ctx.flocks[0].birds[0].y };
        update({ ctx, dt: 1 });
        const after = ctx.flocks[0].birds[0];
        // At least one axis should have moved
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0);
    });
});
