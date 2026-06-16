import { describe, it, expect, beforeEach } from 'vitest';
import * as Downwash from './downwash';
import type { ParticlesCtx, ParticleSystemArgs } from './ctx';

const mkCtx = (overrides: Partial<ParticlesCtx> = {}): ParticlesCtx => ({
    particles: [],
    debris: [],
    flocks: [],
    emitters: [],
    heli: { x: 10, y: 10, z: 0.5, vx: 0, vy: 0, vz: 0, type: 'dolphin', angle: 0, rotorRPM: 0 },
    wind: { x: 0, y: 0, angle: 0, phase: 0, varOffset: 0, rawStr: 0 },
    waterLevel: 0,
    gridSize: 50,
    getGround: () => 0,
    getHeliType: () => ({ rotorOffsets: [0] }) as any,
    ...overrides,
});

const args = (ctx: ParticlesCtx, dt = 1): ParticleSystemArgs => ({ ctx, dt });

describe('Downwash.update — no spawn', () => {
    it('spawns nothing when rotorRPM <= 0.8', () => {
        const ctx = mkCtx({ heli: { ...mkCtx().heli, rotorRPM: 0.8 } });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(0);
    });

    it('spawns nothing when RPM > 0.8 but heli too high above land', () => {
        // heli.z (3.0) >= waterLevel (0) + 2.5 → no dust
        const ctx = mkCtx({ heli: { ...mkCtx().heli, rotorRPM: 1, z: 3.0 } });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(0);
    });

    it('spawns nothing when RPM > 0.8 but too high over water', () => {
        // heli.z (2.5) >= waterLevel (0) + 2.0 → no water spray
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 2.5 },
            getGround: () => -0.5,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(0);
    });
});

describe('Downwash.update — land dust', () => {
    it('spawns 1 dust particle per rotor when low over land', () => {
        // gH (1.0) > waterLevel (0) + 0.1, heli.z (1.5) < waterLevel (0) + 2.5
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.5 },
            getGround: () => 1.0,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(1);
    });

    it('spawns 2 dust particles for a two-rotor heli', () => {
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.5, type: 'atlas' },
            getGround: () => 1.0,
            getHeliType: () => ({ rotorOffsets: [1.5, -1.5] }) as any,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(2);
    });

    it('dust particle starts at ground height + 0.1', () => {
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.5 },
            getGround: () => 0.5,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles[0].z).toBeCloseTo(0.6);
    });

    it('dust particle has the tan color string', () => {
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.5 },
            getGround: () => 1.0,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles[0].color).toBe('150, 140, 120');
    });
});

describe('Downwash.update — water spray', () => {
    it('spawns 2 spray particles per rotor when low over water', () => {
        // gH (-1.0) < waterLevel (0) + 0.1, heli.z (1.0) < waterLevel (0) + 2.0
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.0 },
            getGround: () => -1.0,
        });
        Downwash.update(args(ctx));
        expect(ctx.particles).toHaveLength(2);
    });

    it('water spray particle z equals waterLevel', () => {
        const ctx = mkCtx({
            heli: { ...mkCtx().heli, rotorRPM: 1, z: 1.0 },
            waterLevel: 0.5,
            getGround: () => -1.0,
        });
        Downwash.update(args(ctx));
        ctx.particles.forEach(p => expect(p.z).toBe(0.5));
    });
});

describe('Downwash.update — particle physics', () => {
    it('moves existing particles by vx*dt and vy*dt each tick', () => {
        const ctx = mkCtx();
        ctx.particles.push({ x: 0, y: 0, z: 0, vx: 1, vy: 2, vz: 0, life: 1, color: 'red' });
        Downwash.update(args(ctx, 2));
        expect(ctx.particles[0].x).toBeCloseTo(2);
        expect(ctx.particles[0].y).toBeCloseTo(4);
    });

    it('decrements life by 0.02 * dt each tick', () => {
        const ctx = mkCtx();
        ctx.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, color: 'red' });
        Downwash.update(args(ctx, 1));
        expect(ctx.particles[0].life).toBeCloseTo(0.98);
    });

    it('removes dead particles (life <= 0)', () => {
        const ctx = mkCtx();
        ctx.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.01, color: 'red' });
        Downwash.update(args(ctx, 1));
        expect(ctx.particles).toHaveLength(0);
    });

    it('keeps alive particles', () => {
        const ctx = mkCtx();
        ctx.particles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.5, color: 'red' });
        Downwash.update(args(ctx, 1));
        expect(ctx.particles).toHaveLength(1);
    });

    it('does not touch debris or emitters', () => {
        const ctx = mkCtx();
        Downwash.update(args(ctx));
        expect(ctx.debris).toHaveLength(0);
        expect(ctx.emitters).toHaveLength(0);
    });
});
