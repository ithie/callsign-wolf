import { G } from '../../state';

// 5 sub-emitter offsets — center + 4 cardinal points
const FIRE_SUB_R = 0.18;
const SMOKE_SUB_R = 0.12;
const FIRE_SUB: [number, number][] = [[0,0],[FIRE_SUB_R,0],[-FIRE_SUB_R,0],[0,FIRE_SUB_R],[0,-FIRE_SUB_R]];
const SMOKE_SUB: [number, number][] = [[0,0],[SMOKE_SUB_R,0],[-SMOKE_SUB_R,0],[0,SMOKE_SUB_R],[0,-SMOKE_SUB_R]];

const FIRE_SPAWN_INTERVAL = 0.15;
const SMOKE_SPAWN_INTERVAL = 0.25;

// Particles drift toward the wind's terminal velocity using exponential convergence.
// G.wind.rawStr is the unsheltered wind magnitude (≈ windStr/10 * 0.0002 * gust).
// WIND_PARTICLE_SCALE converts that to a target particle speed in world units/frame.
// At windStr=5 (rawStr≈0.0001): target ≈ 0.02/frame → ~2 world units of drift.
const WIND_PARTICLE_SCALE = 200;
// Convergence rate per frame at dt=1 — reaches ~63% of target after 1/CONV frames.
const WIND_CONV = 0.08;

const _spawnFire = (e: any, ox: number, oy: number) => ({
    x: e.x + ox, y: e.y + oy,
    z: e.gz + 0.05,
    vx: (Math.random() - 0.5) * 0.006,
    vy: (Math.random() - 0.5) * 0.006,
    vz: 0.08 + Math.random() * 0.06,
    life: 1.0 + Math.random() * 0.5,
    maxLife: 1.5,
    size: 1.2 + Math.random() * 1.0,
    color: `${220 + Math.floor(Math.random() * 35)}, ${Math.floor(60 + Math.random() * 100)}, 0`,
    isSmoke: false,
    isFire: true,
});

const _spawnSmoke = (e: any, ox: number, oy: number, isFire: boolean) => ({
    x: e.x + ox, y: e.y + oy,
    z: e.gz + (isFire ? 0.5 : 0.1),
    vx: (Math.random() - 0.5) * 0.006,
    vy: (Math.random() - 0.5) * 0.006,
    vz: 0.04 + Math.random() * 0.04,
    life: 2.0 + Math.random() * 1.5,
    maxLife: 3.5,
    size: 1.0 + Math.random() * 1.0,
    color: isFire
        ? `${50 + Math.floor(Math.random() * 20)}, ${45 + Math.floor(Math.random() * 15)}, ${40 + Math.floor(Math.random() * 15)}`
        : `${130 + Math.floor(Math.random() * 40)}, ${125 + Math.floor(Math.random() * 35)}, ${120 + Math.floor(Math.random() * 30)}`,
    isSmoke: true,
});

export const updateParticleEmitters = (dt: number) => {
    // Use unsheltered wind — emitters are stationary, shelter is only relevant for the heli.
    const rawStr = (G.wind as any).rawStr ?? 0;
    const windAngle = (G.wind as any).angle ?? 0;
    const targetVx = Math.cos(windAngle) * rawStr * WIND_PARTICLE_SCALE;
    const targetVy = Math.sin(windAngle) * rawStr * WIND_PARTICLE_SCALE;
    const conv = Math.min(1, WIND_CONV * dt);

    G.PARTICLE_EMITTERS.forEach((e: any) => {
        e.spawnTimer += dt;
        const isFire = e.type === 'fire';
        const spawnInterval = isFire ? FIRE_SPAWN_INTERVAL : SMOKE_SPAWN_INTERVAL;
        const sub = isFire ? FIRE_SUB : SMOKE_SUB;

        while (e.spawnTimer >= spawnInterval) {
            e.spawnTimer -= spawnInterval;
            const [ox, oy] = sub[Math.floor(Math.random() * sub.length)];
            if (isFire) e.particles.push(_spawnFire(e, ox, oy));
            e.particles.push(_spawnSmoke(e, ox, oy, isFire));
        }

        // Exponential convergence toward wind terminal velocity.
        // Older particles have drifted further — creates a natural elongated downwind trail.
        e.particles.forEach((p: any) => {
            p.vx += (targetVx - p.vx) * conv;
            p.vy += (targetVy - p.vy) * conv;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= 0.02 * dt;
        });

        e.particles = e.particles.filter((p: any) => p.life > 0);
    });
};
