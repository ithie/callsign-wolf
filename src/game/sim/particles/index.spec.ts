import { describe, it, expect } from 'vitest';
import { initParticles, updateParticles, spawnExplosion } from './index';
import type { ParticlesCtx } from './ctx';

const makeCtx = (): ParticlesCtx => ({
    particles: [], debris: [], flocks: [], emitters: [],
    heli: { x: 10, y: 10, z: 5, vx: 0.2, vy: 0, vz: -0.1, type: 'dolphin', angle: 0, rotorRPM: 0 },
    wind: { x: 0, y: 0, angle: 0, phase: 0, varOffset: 0, rawStr: 0 },
    waterLevel: 0, gridSize: 28,
    getGround: () => 1,
    getHeliType: () => ({ scale: 1, rotorOffsets: [0], extraRotorDebris: false }),
});

// ─── initParticles ────────────────────────────────────────────────────────────

describe('Registry: initParticles', () => {
    it('populates flocks (Birds.init ran)', () => {
        const ctx = makeCtx();
        initParticles({ ctx, dt: 0 });
        expect(ctx.flocks.length).toBeGreaterThan(0);
    });

    it('does NOT trigger explosion on mission start', () => {
        const ctx = makeCtx();
        initParticles({ ctx, dt: 0 });
        expect(ctx.particles).toHaveLength(0);
        expect(ctx.debris).toHaveLength(0);
    });
});

// ─── spawnExplosion ───────────────────────────────────────────────────────────

describe('Registry: spawnExplosion', () => {
    it('spawns particles into ctx.particles', () => {
        const ctx = makeCtx();
        spawnExplosion({ ctx, dt: 0 });
        expect(ctx.particles.length).toBeGreaterThan(0);
    });

    it('spawns debris into ctx.debris', () => {
        const ctx = makeCtx();
        spawnExplosion({ ctx, dt: 0 });
        expect(ctx.debris.length).toBeGreaterThan(0);
    });

    it('does NOT touch ctx.flocks', () => {
        const ctx = makeCtx();
        spawnExplosion({ ctx, dt: 0 });
        expect(ctx.flocks).toHaveLength(0);
    });
});

// ─── updateParticles ──────────────────────────────────────────────────────────

describe('Registry: updateParticles', () => {
    it('processes emitter particles (WorldEmitters.update ran)', () => {
        const ctx = makeCtx();
        ctx.emitters = [{ x: 5, y: 5, gz: 0, type: 'fire', particles: [], spawnTimer: 0 }];
        updateParticles({ ctx, dt: 4 }); // dt=4 reaches FIRE_SPAWN_INTERVAL
        expect(ctx.emitters[0].particles.length).toBeGreaterThan(0);
    });

    it('removes dead debris (Explosion.update ran)', () => {
        const ctx = makeCtx();
        ctx.debris.push({
            x: 5, y: 5, z: 2, vx: 0, vy: 0, vz: 0,
            angle: 0, av: 0, w: 1, h: 0.5,
            color: '#f00', stroke: '#f00',
            life: 0.01, bounced: false,
        });
        updateParticles({ ctx, dt: 1 });
        expect(ctx.debris).toHaveLength(0);
    });

    it('updates bird positions (Birds.update ran)', () => {
        const ctx = makeCtx();
        initParticles({ ctx, dt: 0 }); // populate flocks first
        const before = { x: ctx.flocks[0].birds[0].x, y: ctx.flocks[0].birds[0].y };
        updateParticles({ ctx, dt: 1 });
        const after = ctx.flocks[0].birds[0];
        expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0);
    });

    it('removes dead downwash particles (Downwash.update ran)', () => {
        const ctx = makeCtx();
        // Push a particle with life just above 0 — one tick of Downwash.update will drain it
        ctx.particles.push({
            x: 10, y: 10, z: 0, vx: 0, vy: 0, vz: 0,
            life: 0.01, color: '150, 140, 120',
        });
        updateParticles({ ctx, dt: 1 });
        expect(ctx.particles).toHaveLength(0);
    });
});
