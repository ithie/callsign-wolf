import { describe, it, expect } from 'vitest';
import { update } from './world-emitters';
import type { ParticlesCtx, ParticleEmitter, EmitterParticle } from './ctx';

const makeCtx = (): ParticlesCtx => ({
    particles: [], debris: [], flocks: [], emitters: [],
    heli: { x: 10, y: 10, z: 5, vx: 0, vy: 0, vz: 0, type: 'dolphin', angle: 0, rotorRPM: 0 },
    wind: { x: 0, y: 0, angle: 0, phase: 0, varOffset: 0, rawStr: 0 },
    waterLevel: 0, gridSize: 28,
    getGround: () => 0,
    getHeliType: () => ({ scale: 1, rotorOffsets: [0] }),
});

const makeEmitter = (type: 'fire' | 'smoke' = 'fire'): ParticleEmitter => ({
    x: 5, y: 5, gz: 0, type, particles: [], spawnTimer: 0,
});

const makeParticle = (overrides: Partial<EmitterParticle> = {}): EmitterParticle => ({
    x: 5, y: 5, z: 0.5, vx: 0, vy: 0, vz: 0.05,
    life: 1.0, maxLife: 1.5, size: 1.2,
    color: '220,80,0', isSmoke: false, isFire: true,
    ...overrides,
});

// ─── Spawn behaviour ──────────────────────────────────────────────────────────

describe('WorldEmitters.update – spawning', () => {
    it('spawns particles when spawnTimer reaches FIRE_SPAWN_INTERVAL (4)', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        ctx.emitters = [emitter];
        update({ ctx, dt: 4 });
        expect(emitter.particles.length).toBeGreaterThan(0);
    });

    it('does not spawn before the interval is reached', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 }); // spawnTimer = 1 < 4
        expect(emitter.particles.length).toBe(0);
    });

    it('fire emitter spawns both fire and smoke particles per cycle', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        ctx.emitters = [emitter];
        update({ ctx, dt: 4 });
        expect(emitter.particles.some(p => p.isFire)).toBe(true);
        expect(emitter.particles.some(p => p.isSmoke)).toBe(true);
    });

    it('smoke emitter spawns only smoke particles', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('smoke');
        ctx.emitters = [emitter];
        update({ ctx, dt: 5 }); // SMOKE_SPAWN_INTERVAL = 5
        expect(emitter.particles.every(p => p.isSmoke)).toBe(true);
        expect(emitter.particles.some(p => p.isFire)).toBe(false);
    });

    it('caps particle count at 60 regardless of dt', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        ctx.emitters = [emitter];
        for (let i = 0; i < 200; i++) update({ ctx, dt: 4 });
        expect(emitter.particles.length).toBeLessThanOrEqual(60);
    });

    it('resets spawnTimer to 0 when cap is hit', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        // Fill to cap
        for (let i = 0; i < 60; i++) emitter.particles.push(makeParticle());
        emitter.spawnTimer = 3;
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 }); // still can't spawn (timer < interval), but cap check runs
        // After cap check: spawnTimer should be 0
        expect(emitter.spawnTimer).toBe(0);
    });
});

// ─── Particle lifecycle ───────────────────────────────────────────────────────

describe('WorldEmitters.update – particle lifecycle', () => {
    it('removes particles when life reaches 0', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('smoke');
        emitter.particles.push(makeParticle({ life: 0.01, isSmoke: true, isFire: undefined }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 }); // life -= 0.02 * 1 → below 0
        expect(emitter.particles).toHaveLength(0);
    });

    it('keeps particles that are still alive', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        emitter.particles.push(makeParticle({ life: 2.0 }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        expect(emitter.particles).toHaveLength(1);
        expect(emitter.particles[0].life).toBeCloseTo(2.0 - 0.02, 3);
    });

    it('advances particle position each tick', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('fire');
        emitter.particles.push(makeParticle({ x: 5, y: 5, vx: 0.1, vy: 0 }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        // wind convergence slightly reduces vx before position update → test direction, not exact value
        expect(emitter.particles[0].x).toBeGreaterThan(5);
    });

    it('particle z increases (smoke rises)', () => {
        const ctx = makeCtx();
        const emitter = makeEmitter('smoke');
        emitter.particles.push(makeParticle({ z: 1.0, vz: 0.05, isSmoke: true, isFire: undefined }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        expect(emitter.particles[0].z).toBeGreaterThan(1.0);
    });
});

// ─── Wind drift ───────────────────────────────────────────────────────────────

describe('WorldEmitters.update – wind drift', () => {
    it('drifts particles eastward when wind points east', () => {
        const ctx = makeCtx();
        ctx.wind.rawStr = 5;
        ctx.wind.angle = 0; // east = +x
        const emitter = makeEmitter('fire');
        emitter.particles.push(makeParticle({ vx: 0 }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        expect(emitter.particles[0].vx).toBeGreaterThan(0);
    });

    it('drifts particles northward when wind points north (angle = π/2)', () => {
        const ctx = makeCtx();
        ctx.wind.rawStr = 5;
        ctx.wind.angle = Math.PI / 2; // north = +y
        const emitter = makeEmitter('fire');
        emitter.particles.push(makeParticle({ vy: 0 }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        expect(emitter.particles[0].vy).toBeGreaterThan(0);
    });

    it('no drift when wind rawStr is 0', () => {
        const ctx = makeCtx();
        ctx.wind.rawStr = 0;
        const emitter = makeEmitter('fire');
        emitter.particles.push(makeParticle({ vx: 0, vy: 0 }));
        ctx.emitters = [emitter];
        update({ ctx, dt: 1 });
        expect(emitter.particles[0].vx).toBeCloseTo(0, 5);
        expect(emitter.particles[0].vy).toBeCloseTo(0, 5);
    });
});
