import type { EmitterParticle, ParticleEmitter, ParticleSystemArgs } from './ctx';

const CHIMNEY_SPAWN_INTERVAL = 6;
const MAX_CHIMNEY_PARTICLES = 20;
const WRECK_SPAWN_INTERVAL = 9;
const MAX_WRECK_PARTICLES = 14;

const _spawnChimney = (e: ParticleEmitter, ox: number, oy: number): EmitterParticle => {
    const gray = 90 + Math.floor(Math.random() * 40);
    return {
        x: e.x + ox, y: e.y + oy,
        z: e.gz + 0.05,
        vx: (Math.random() - 0.5) * 0.016,
        vy: (Math.random() - 0.5) * 0.016,
        vz: 0.018 + Math.random() * 0.014,
        life: 3.0 + Math.random() * 2.0,
        maxLife: 5.0,
        size: 2.2 + Math.random() * 1.8,
        color: `${gray}, ${gray}, ${gray}`,
        isSmoke: true,
    };
};

// Random point uniformly distributed within a circle of given radius
const _circleOffset = (r: number): [number, number] => {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return [Math.cos(a) * d, Math.sin(a) * d];
};

// Intervals in dt-units (dt≈1 at 30fps): one spawn every 4–5 frames
// Fire steady-state: ~16 fire + ~34 smoke ≈ 50 particles per emitter
// Smoke steady-state: ~27 smoke particles
const FIRE_SPAWN_INTERVAL = 4;
const SMOKE_SPAWN_INTERVAL = 5;
const MAX_PARTICLES = 60;

const WIND_PARTICLE_SCALE = 200;
const WIND_CONV = 0.08;

const DEFAULT_FIRE_RADIUS = 0.18;

const _spawnFire = (e: ParticleEmitter, ox: number, oy: number): EmitterParticle => {
    const r = Math.random();
    // Colour gradient: fresh (r≈1) = white-yellow → mid = orange → old (r≈0) = dark red
    const red   = 255;
    const green = Math.floor(r > 0.6 ? 200 + (r - 0.6) / 0.4 * 55 : r * (200 / 0.6));
    return {
        x: e.x + ox, y: e.y + oy,
        z: e.gz + 0.05,
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.008,
        vz: 0.09 + Math.random() * 0.08,
        life: r * 0.6 + 0.6 + Math.random() * 0.4,
        maxLife: 1.6,
        size: 1.2 + Math.random() * 1.0,
        color: `${red}, ${green}, 0`,
        isSmoke: false,
        isFire: true,
    };
};

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

        if (e.type === 'chimney') {
            while (e.spawnTimer >= CHIMNEY_SPAWN_INTERVAL && e.particles.length < MAX_CHIMNEY_PARTICLES) {
                e.spawnTimer -= CHIMNEY_SPAWN_INTERVAL;
                e.particles.push(_spawnChimney(e, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06));
            }
            if (e.particles.length >= MAX_CHIMNEY_PARTICLES) e.spawnTimer = 0;
        } else if (e.type === 'wreck_smoke') {
            while (e.spawnTimer >= WRECK_SPAWN_INTERVAL && e.particles.length < MAX_WRECK_PARTICLES) {
                e.spawnTimer -= WRECK_SPAWN_INTERVAL;
                const [ox, oy] = _circleOffset(e.radius ?? 0.12);
                e.particles.push(_spawnSmoke(e, ox, oy, true)); // dark, smoldering
            }
            if (e.particles.length >= MAX_WRECK_PARTICLES) e.spawnTimer = 0;
        } else {
            const isFire = e.type === 'fire';
            const spawnInterval = isFire ? FIRE_SPAWN_INTERVAL : SMOKE_SPAWN_INTERVAL;
            const spawnR = (e.radius ?? DEFAULT_FIRE_RADIUS);

            while (e.spawnTimer >= spawnInterval && e.particles.length < MAX_PARTICLES) {
                e.spawnTimer -= spawnInterval;
                const [ox, oy] = _circleOffset(spawnR);
                if (isFire) e.particles.push(_spawnFire(e, ox, oy));
                e.particles.push(_spawnSmoke(e, ox, oy, isFire));
            }
            if (e.particles.length >= MAX_PARTICLES) e.spawnTimer = 0;
        }

        const isChimney = e.type === 'chimney';
        e.particles.forEach(p => {
            p.vx += (targetVx - p.vx) * conv;
            p.vy += (targetVy - p.vy) * conv;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= 0.02 * dt;
            if (isChimney) p.size += 0.012 * dt;
        });

        e.particles = e.particles.filter(p => p.life > 0);
    });
};
