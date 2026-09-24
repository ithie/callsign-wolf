import type { ParticleSystemArgs } from './ctx';
import { tileW } from '../../render-config';

export type FoamParticle = {
    x: number; y: number;
    vx: number; vy: number;
    phase: number;
    maxLife: number;
    size: number;
};

const MAX_FOAM       = 6;
const SPAWN_INTERVAL = 50;       // dt-units between spawn attempts
const SPAWN_RADIUS   = 14;       // tile-radius around heli to search
const DENSITY_WINDOW = 2;        // half-size: checks (2*2+1)² = 25 tiles
const DENSITY_MIN    = 16;       // minimum water tiles in that window to allow spawn
const PARTICLE_SCALE = tileW / 20;

let _spawnTimer = SPAWN_INTERVAL; // start ready but won't burst

export const resetFoam = (): void => { _spawnTimer = SPAWN_INTERVAL; };

const _isWater = (x: number, y: number, waterLevel: number,
                  getGround: (x: number, y: number) => number): boolean =>
    getGround(Math.round(x), Math.round(y)) <= waterLevel;

const _densityOk = (cx: number, cy: number, waterLevel: number,
                    getGround: (x: number, y: number) => number): boolean => {
    let count = 0;
    for (let dx = -DENSITY_WINDOW; dx <= DENSITY_WINDOW; dx++)
        for (let dy = -DENSITY_WINDOW; dy <= DENSITY_WINDOW; dy++)
            if (_isWater(cx + dx, cy + dy, waterLevel, getGround)) count++;
    return count >= DENSITY_MIN;
};

export const update = ({ ctx, dt }: ParticleSystemArgs): void => {
    const { foamParticles, heli, wind, waterLevel, getGround } = ctx;

    _spawnTimer += dt;
    if (_spawnTimer >= SPAWN_INTERVAL && foamParticles.length < MAX_FOAM) {
        _spawnTimer = 0;
        // pick a random tile within radius
        const angle = Math.random() * Math.PI * 2;
        const dist  = 7 + Math.random() * (SPAWN_RADIUS - 7);
        const tx = heli.x + Math.cos(angle) * dist;
        const ty = heli.y + Math.sin(angle) * dist;

        if (_isWater(tx, ty, waterLevel, getGround) &&
            _densityOk(tx, ty, waterLevel, getGround)) {

            const windDrift = wind.rawStr * 0.0004;
            foamParticles.push({
                x: tx + (Math.random() - 0.5) * 0.4,
                y: ty + (Math.random() - 0.5) * 0.4,
                vx: Math.cos(wind.angle) * windDrift + (Math.random() - 0.5) * 0.0006,
                vy: Math.sin(wind.angle) * windDrift + (Math.random() - 0.5) * 0.0006,
                phase: 0,
                maxLife: 8 + Math.random() * 6,
                size: (0.8 + Math.random() * 0.7) * PARTICLE_SCALE,
            });
        }
    }

    const toRemove: number[] = [];
    foamParticles.forEach((p, i) => {
        p.x     += p.vx * dt;
        p.y     += p.vy * dt;
        p.phase += 0.016 * dt;
        if (p.phase >= p.maxLife || !_isWater(p.x, p.y, waterLevel, getGround))
            toRemove.push(i);
    });
    for (let i = toRemove.length - 1; i >= 0; i--)
        foamParticles.splice(toRemove[i], 1);
};
