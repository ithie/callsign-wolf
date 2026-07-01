export type {
    Particle, DebrisPiece, Bird, Flock,
    EmitterParticle, ParticleEmitter,
    HeliRef, WindState,
    ParticlesCtx, ParticleSystem, ParticleSystemArgs,
} from './ctx';

import type { ParticleSystem, ParticleSystemArgs } from './ctx';
import * as Birds from './birds';
import * as WorldEmitters from './world-emitters';
import * as Downwash from './downwash';
import * as Explosion from './explosion';

// Systems initialized on mission start (Birds only — Explosion.init is the crash trigger)
const _initSystems: ParticleSystem[] = [Birds];
// All systems ticked every physics frame
const _particleSystems: ParticleSystem[] = [Birds, WorldEmitters, Downwash, Explosion];

export const initParticles = (args: ParticleSystemArgs) =>
    _initSystems.forEach(s => s.init!(args));

export const updateParticles = (args: ParticleSystemArgs) =>
    _particleSystems.forEach(s => s.update(args));

// Named event trigger — semantically an init of the explosion particle system
export const spawnExplosion = (args: ParticleSystemArgs) => Explosion.init(args);

export const spawnPositionExplosion = (args: ParticleSystemArgs, x: number, y: number, z: number) =>
    Explosion.initAt(args.ctx, x, y, z);
