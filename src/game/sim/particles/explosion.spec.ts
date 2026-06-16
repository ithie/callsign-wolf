import { describe, it, expect } from 'vitest';
import { init, update } from './explosion';
import type { ParticlesCtx, DebrisPiece } from './ctx';

const makeCtx = (): ParticlesCtx => ({
    particles: [], debris: [], flocks: [], emitters: [],
    heli: { x: 10, y: 10, z: 2, vx: 0.2, vy: 0.1, vz: -0.1, type: 'dolphin', angle: 0.3, rotorRPM: 0 },
    wind: { x: 0, y: 0, angle: 0, phase: 0, varOffset: 0, rawStr: 0 },
    waterLevel: 0, gridSize: 28,
    getGround: () => 0,
    getHeliType: () => ({ scale: 1, rotorOffsets: [0], extraRotorDebris: false }),
});

const makeDebris = (overrides: Partial<DebrisPiece> = {}): DebrisPiece => ({
    x: 5, y: 5, z: 2, vx: 0.05, vy: 0, vz: -0.1,
    angle: 0, av: 0.05,
    w: 1.5, h: 0.4, color: '#ff6600', stroke: '#dd3300',
    life: 3.0, bounced: false,
    ...overrides,
});

// ─── init (spawnExplosion) ────────────────────────────────────────────────────

describe('Explosion.init', () => {
    it('pushes particles into ctx.particles', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        expect(ctx.particles.length).toBeGreaterThan(0);
    });

    it('pushes 5 debris pieces (fuselage, tail, rotor×2, door)', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        expect(ctx.debris.length).toBe(5);
    });

    it('pushes 6 debris pieces when extraRotorDebris is true', () => {
        const ctx = makeCtx();
        ctx.getHeliType = () => ({ scale: 1, rotorOffsets: [0], extraRotorDebris: true });
        init({ ctx, dt: 0 });
        expect(ctx.debris.length).toBe(6);
    });

    it('all particles have required fields with valid values', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.particles.forEach(p => {
            expect(typeof p.x).toBe('number');
            expect(typeof p.y).toBe('number');
            expect(typeof p.z).toBe('number');
            expect(typeof p.vx).toBe('number');
            expect(typeof p.vy).toBe('number');
            expect(typeof p.vz).toBe('number');
            expect(p.life).toBeGreaterThan(0);
            expect(p.color.length).toBeGreaterThan(0);
        });
    });

    it('all debris pieces start with bounced=false', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.debris.forEach(d => expect(d.bounced).toBe(false));
    });

    it('high impact speed produces more particles than low impact speed', () => {
        const ctxLow = makeCtx();
        ctxLow.heli = { ...ctxLow.heli, vx: 0.01, vy: 0, vz: 0 };
        init({ ctx: ctxLow, dt: 0 });

        const ctxHigh = makeCtx();
        ctxHigh.heli = { ...ctxHigh.heli, vx: 0.5, vy: 0.3, vz: -0.3 };
        init({ ctx: ctxHigh, dt: 0 });

        expect(ctxHigh.particles.length).toBeGreaterThan(ctxLow.particles.length);
    });

    it('particles spawn near heli position', () => {
        const ctx = makeCtx();
        init({ ctx, dt: 0 });
        ctx.particles.forEach(p => {
            expect(Math.abs(p.x - ctx.heli.x)).toBeLessThan(5);
            expect(Math.abs(p.y - ctx.heli.y)).toBeLessThan(5);
        });
    });
});

// ─── update (debris physics) ──────────────────────────────────────────────────

describe('Explosion.update', () => {
    it('decrements debris life by 0.016 per tick', () => {
        const ctx = makeCtx();
        ctx.debris.push(makeDebris({ life: 2.0 }));
        update({ ctx, dt: 1 });
        expect(ctx.debris[0].life).toBeCloseTo(2.0 - 0.016, 5);
    });

    it('removes debris when life drops to 0', () => {
        const ctx = makeCtx();
        ctx.debris.push(makeDebris({ life: 0.01 }));
        update({ ctx, dt: 1 });
        expect(ctx.debris).toHaveLength(0);
    });

    it('keeps alive debris in ctx.debris', () => {
        const ctx = makeCtx();
        ctx.debris.push(makeDebris({ life: 5.0 }));
        update({ ctx, dt: 1 });
        expect(ctx.debris).toHaveLength(1);
    });

    it('applies gravity to vz each tick', () => {
        const ctx = makeCtx();
        const d = makeDebris({ z: 5, vz: 0 });
        ctx.debris.push(d);
        update({ ctx, dt: 1 });
        expect(d.vz).toBeCloseTo(-0.006, 5); // default gravity
    });

    it('respects explicit gravity field on debris', () => {
        const ctx = makeCtx();
        const d = makeDebris({ z: 5, vz: 0, gravity: -0.02 });
        ctx.debris.push(d);
        update({ ctx, dt: 1 });
        expect(d.vz).toBeCloseTo(-0.02, 5);
    });

    it('reflects vz and sets bounced=true when debris hits ground', () => {
        const ctx = makeCtx();
        const d = makeDebris({ z: -0.1, vz: -0.2, bounced: false });
        ctx.debris.push(d);
        update({ ctx, dt: 1 });
        expect(d.bounced).toBe(true);
        expect(d.vz).toBeGreaterThan(0);
    });

    it('spawns one dust particle on first bounce', () => {
        const ctx = makeCtx();
        ctx.debris.push(makeDebris({ z: -0.1, vz: -0.2, bounced: false }));
        update({ ctx, dt: 1 });
        expect(ctx.particles).toHaveLength(1);
        expect(ctx.particles[0].isSmoke).toBe(true);
    });

    it('does not spawn dust on subsequent bounces (bounced=true)', () => {
        const ctx = makeCtx();
        ctx.debris.push(makeDebris({ z: -0.1, vz: -0.2, bounced: true }));
        update({ ctx, dt: 1 });
        expect(ctx.particles).toHaveLength(0);
    });

    it('rotates debris via av each tick', () => {
        const ctx = makeCtx();
        const d = makeDebris({ z: 5, angle: 0, av: 0.1 });
        ctx.debris.push(d);
        update({ ctx, dt: 1 });
        expect(d.angle).toBeCloseTo(0.1, 5);
    });
});
