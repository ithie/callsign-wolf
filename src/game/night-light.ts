import { G } from './state';
import { getGround } from './sim/terrain';

// Night visibility: the heli's searchlight cone plus a rotating lighthouse beam.
// Terrain, world objects, foliage and payloads all ask isNightLit() so they agree on
// what's lit. updateNightLight() runs once per frame before anything is drawn.

const BEAM_HALF_ANGLE = 0.16; // rad
const BEAM_RANGE = 45; // tiles
const BEAM_RANGE2 = BEAM_RANGE * BEAM_RANGE;
const BEAM_SPEED = 0.0007; // rad per ms, ~9 s per revolution

let _heliHalfAngle = 0;
let _heliRange2 = 0;
let _hX = 0;
let _hY = 0;
let _hA = 0;
let _lh: { x: number; y: number } | null = null;
let _beamA = 0;

export const updateNightLight = (lighthouse: { x: number; y: number } | null): void => {
    const alt = G.heli.z - getGround(G.heli.x, G.heli.y);
    _heliHalfAngle = 0.3 + alt * 0.05;
    _heliRange2 = (10 + alt * 2.0) ** 2;
    _hX = G.heli.x;
    _hY = G.heli.y;
    _hA = G.heli.angle;
    _lh = lighthouse;
    _beamA = (Date.now() * BEAM_SPEED) % (Math.PI * 2);
};

const _inCone = (x: number, y: number, ox: number, oy: number, a: number, half: number, range2: number): boolean => {
    const dx = x - ox, dy = y - oy;
    if (dx * dx + dy * dy >= range2) return false;
    let diff = Math.atan2(dy, dx) - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return Math.abs(diff) < half;
};

export const isHeliLit = (x: number, y: number): boolean => _inCone(x, y, _hX, _hY, _hA, _heliHalfAngle, _heliRange2);

export const isBeamLit = (x: number, y: number): boolean =>
    !!_lh && _inCone(x, y, _lh.x, _lh.y, _beamA, BEAM_HALF_ANGLE, BEAM_RANGE2);

export const isNightLit = (x: number, y: number): boolean => isHeliLit(x, y) || isBeamLit(x, y);

// 0..1 brightness of the lighthouse beam at (x,y), fading out towards its range.
export const beamIntensityAt = (x: number, y: number): number => {
    if (!_lh) return 0;
    const d = Math.hypot(x - _lh.x, y - _lh.y);
    return Math.max(0.25, 0.8 * (1 - d / BEAM_RANGE));
};
