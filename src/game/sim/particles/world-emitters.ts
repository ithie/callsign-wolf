import type { EmitterParticle, ParticleEmitter, ParticleSystemArgs } from './ctx';

const FIRE_SUB_R = 0.18;
const SMOKE_SUB_R = 0.12;
const FIRE_SUB: [number, number][] = [[0,0],[FIRE_SUB_R,0],[-FIRE_SUB_R,0],[0,FIRE_SUB_R],[0,-FIRE_SUB_R]];
const SMOKE_SUB: [number, number][] = [[0,0],[SMOKE_SUB_R,0],[-SMOKE_SUB_R,0],[0,SMOKE_SUB_R],[0,-SMOKE_SUB_R]];

// Intervals in dt-units (dt≈1 at 30fps): one spawn every 4–5 frames
// Fire steady-state: ~16 fire + ~34 smoke ≈ 50 particles
// Smoke steady-state: ~27 smoke particles
const FIRE_SPAWN_INTERVAL = 4;
const SMOKE_SPAWN_INTERVAL = 5;
// Hard cap per emitter — prevents runaway at low FPS (high dt)
const MAX_PARTICLES = 60;

// Scale factor to convert G.wind.rawStr into visible particle drift speed
const WIND_PARTICLE_SCALE = 200;
// Exponential convergence rate per frame (reaches ~63% of target after 1/CONV frames)
const WIND_CONV = 0.08;

const _spawnFire = (e: ParticleEmitter, ox: number, oy: number): EmitterParticle => ({
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

const _spawnSmoke = (e: ParticleEmitter, ox: number, oy: number, isFire: boolean): EmitterParticle => ({
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

export const update = ({ ctx, dt }: ParticleSystemArgs) => {
    const { emitters, wind } = ctx;
    const targetVx = Math.cos(wind.angle) * wind.rawStr * WIND_PARTICLE_SCALE;
    const targetVy = Math.sin(wind.angle) * wind.rawStr * WIND_PARTICLE_SCALE;
    const conv = Math.min(1, WIND_CONV * dt);

    emitters.forEach((e: ParticleEmitter) => {
        e.spawnTimer += dt;
        const isFire = e.type === 'fire';
        const spawnInterval = isFire ? FIRE_SPAWN_INTERVAL : SMOKE_SPAWN_INTERVAL;
        const sub = isFire ? FIRE_SUB : SMOKE_SUB;

        while (e.spawnTimer >= spawnInterval && e.particles.length < MAX_PARTICLES) {
            e.spawnTimer -= spawnInterval;
            const [ox, oy] = sub[Math.floor(Math.random() * sub.length)];
            if (isFire) e.particles.push(_spawnFire(e, ox, oy));
            e.particles.push(_spawnSmoke(e, ox, oy, isFire));
        }
        // Drain timer if cap was hit to avoid burst on uncap
        if (e.particles.length >= MAX_PARTICLES) e.spawnTimer = 0;

        e.particles.forEach(p => {
            p.vx += (targetVx - p.vx) * conv;
            p.vy += (targetVy - p.vy) * conv;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= 0.02 * dt;
        });

        e.particles = e.particles.filter(p => p.life > 0);
    });
};
