import { campaignHandler } from '../main';
import { G } from '../state';
import { getHeliType } from '../heli-types';
import { getGround } from './terrain';
import { PhysicsCtx } from './ctx';


export const spawnExplosion = (heli: any, particles: any[], debris: any[], points: number[][], CARRIER: any) => {
    const impactSpeed = Math.hypot(heli.vx, heli.vy, heli.vz || 0);
    const intensity = Math.min(1.0, impactSpeed / 0.25);
    const count = Math.floor(30 + intensity * 80);
    const x = heli.x, y = heli.y;
    const z = Math.max(heli.z, getGround(heli.x, heli.y, points, CARRIER) + 0.1);
    const fwdX = impactSpeed > 0.01 ? heli.vx / impactSpeed : 0;
    const fwdY = impactSpeed > 0.01 ? heli.vy / impactSpeed : 0;

    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = (Math.random() - 0.3) * Math.PI;
        const spd = (0.04 + Math.random() * 0.12) * (0.5 + intensity * 0.5);
        const isFire = Math.random() < 0.6;
        const biasFwd = 0.5 + Math.random() * 0.5;
        particles.push({
            x, y,
            z: z + Math.random() * 0.3,
            vx: Math.cos(a) * Math.cos(el) * spd + fwdX * impactSpeed * biasFwd,
            vy: Math.sin(a) * Math.cos(el) * spd + fwdY * impactSpeed * biasFwd,
            vz: Math.sin(el) * spd * 0.5 + 0.05,
            gravity: -0.004,
            size: isFire ? 4 + Math.random() * 6 : 3 + Math.random() * 8,
            life: 0.6 + Math.random() * 0.8,
            maxLife: 1.0,
            color: isFire
                ? `${220 + Math.floor(Math.random() * 35)}, ${Math.floor(Math.random() * 120)}, 0`
                : `${80 + Math.floor(Math.random() * 60)}, ${70 + Math.floor(Math.random() * 40)}, ${60 + Math.floor(Math.random() * 40)}`,
            isSmoke: !isFire,
        });
    }

    const shrapnel = Math.floor(15 + intensity * 30);
    for (let i = 0; i < shrapnel; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 0.05 + Math.random() * 0.2 * intensity;
        const biasFwd = 0.3 + Math.random() * 0.7;
        particles.push({
            x, y,
            z: z + Math.random() * 0.2,
            vx: Math.cos(a) * spd + fwdX * impactSpeed * biasFwd * 1.2,
            vy: Math.sin(a) * spd + fwdY * impactSpeed * biasFwd * 1.2,
            vz: 0.02 + Math.random() * 0.1,
            gravity: -0.008,
            size: 2,
            life: 1.0 + Math.random() * 1.5,
            maxLife: 2.0,
            color: `${180 + Math.floor(Math.random() * 60)}, ${160 + Math.floor(Math.random() * 40)}, ${100 + Math.floor(Math.random() * 50)}`,
            isMetal: true,
        });
    }

    const _ht = getHeliType(heli.type);
    const scale = _ht.scale;
    const parts = [
        { name: 'fuselage', color: '#ff6600', stroke: '#dd3300', w: 1.5 * scale, h: 0.4 * scale },
        { name: 'tail',     color: '#ff6600', stroke: '#dd3300', w: 1.0 * scale, h: 0.2 * scale },
        { name: 'rotor1',   color: '#333',    stroke: '#555',    w: 1.8 * scale, h: 0.08 * scale },
        { name: 'rotor2',   color: '#333',    stroke: '#555',    w: 1.8 * scale, h: 0.08 * scale },
        { name: 'door',     color: '#cc4400', stroke: '#aa2200', w: 0.5 * scale, h: 0.4 * scale },
    ];
    if (_ht.extraRotorDebris) parts.push({ name: 'rotor3', color: '#333', stroke: '#555', w: 1.8, h: 0.08 });

    parts.forEach(part => {
        const a = Math.random() * Math.PI * 2;
        const spd = (0.03 + Math.random() * 0.1) * (0.4 + intensity * 0.6);
        const biasFwd = 0.4 + Math.random() * 0.6;
        debris.push({
            x, y,
            z: z + 0.1 + Math.random() * 0.4,
            vx: Math.cos(a) * spd * 0.4 + fwdX * impactSpeed * biasFwd,
            vy: Math.sin(a) * spd * 0.4 + fwdY * impactSpeed * biasFwd,
            vz: 0.03 + Math.random() * 0.08 * intensity,
            angle: heli.angle + (Math.random() - 0.5),
            av: (Math.random() - 0.5) * 0.15 * (0.5 + intensity),
            w: part.w, h: part.h, color: part.color, stroke: part.stroke,
            life: 3.0 + Math.random() * 2.0,
            bounced: false,
        });
    });

    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            for (let j = 0; j < 3; j++) {
                const a = Math.random() * Math.PI * 2;
                particles.push({
                    x: x + Math.cos(a) * 0.3,
                    y: y + Math.sin(a) * 0.3,
                    z: z + Math.random() * 0.5,
                    vx: (Math.random() - 0.5) * 0.01,
                    vy: (Math.random() - 0.5) * 0.01,
                    vz: 0.01 + Math.random() * 0.02,
                    gravity: 0,
                    size: 6 + Math.random() * 10,
                    life: 0.4 + Math.random() * 0.4,
                    maxLife: 0.8,
                    color: `${60 + Math.floor(Math.random() * 40)}, ${55 + Math.floor(Math.random() * 30)}, ${50 + Math.floor(Math.random() * 30)}`,
                    isSmoke: true,
                });
            }
        }, i * 120);
    }
}

export const updateDebris = () => {
    G.debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.z += d.vz;
        d.vz += d.gravity !== undefined ? d.gravity : -0.006;
        d.angle += d.av;
        d.av *= 0.98;
        d.life -= 0.016;
        const gz = getGround(d.x, d.y, G.points, G.CARRIER);
        if (d.z <= gz) {
            d.z = gz;
            d.vz = Math.abs(d.vz) * 0.25;
            d.vx *= 0.6;
            d.vy *= 0.6;
            d.av *= 0.4;
            if (!d.bounced) {
                G.particles.push({
                    x: d.x, y: d.y, z: gz + 0.05,
                    vx: (Math.random() - 0.5) * 0.03,
                    vy: (Math.random() - 0.5) * 0.03,
                    vz: 0.015, gravity: 0, size: 4, life: 0.3, maxLife: 0.3,
                    color: '150,130,100', isSmoke: true,
                });
                d.bounced = true;
            }
        }
    });
    G.debris = G.debris.filter(d => d.life > 0);
}

export const initBirds = () => {
    G.flocks = [];
    const { gridSize } = campaignHandler.getTerrain();
    const numFlocks = 2 + Math.floor(Math.random() * 2);
    const spawnCx = G.START_POS ? G.START_POS.x : gridSize / 2;
    const spawnCy = G.START_POS ? G.START_POS.y : gridSize / 2;
    for (let f = 0; f < numFlocks; f++) {
        let fx = 0, fy = 0, found = false;
        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 5 + Math.random() * 18;
            fx = Math.max(3, Math.min(gridSize - 3, spawnCx + Math.cos(angle) * dist));
            fy = Math.max(3, Math.min(gridSize - 3, spawnCy + Math.sin(angle) * dist));
            if (getGround(fx, fy, G.points, G.CARRIER) > G.waterLevel + 0.2) { found = true; break; }
        }
        if (!found) { fx = 5 + Math.random() * (gridSize - 10); fy = 5 + Math.random() * (gridSize - 10); }
        const fz = 3 + Math.random() * 5;
        const baseAngle = Math.random() * Math.PI * 2;
        const spd = 0.012 + Math.random() * 0.008;
        const count = 4 + Math.floor(Math.random() * 6);
        const birds = [];
        for (let i = 0; i < count; i++) {
            birds.push({
                x: fx + (Math.random() - 0.5) * 3, y: fy + (Math.random() - 0.5) * 3,
                z: fz + (Math.random() - 0.5) * 0.8,
                vx: Math.cos(baseAngle) * spd, vy: Math.sin(baseAngle) * spd, vz: 0,
                wingPhase: Math.random() * Math.PI * 2,
            });
        }
        G.flocks.push({ birds, fleeing: false, fleeTimer: 0 });
    }
}

export const updateBirds = () => {
    const { gridSize } = campaignHandler.getTerrain();
    G.flocks.forEach((flock: any) => {
        const cx = flock.birds.reduce((s: number, b: any) => s + b.x, 0) / flock.birds.length;
        const cy = flock.birds.reduce((s: number, b: any) => s + b.y, 0) / flock.birds.length;
        const distToHeli = Math.hypot(G.heli.x - cx, G.heli.y - cy);
        const heliLoud = G.heli.rotorRPM > 0.3;
        if (heliLoud && distToHeli < 8) { flock.fleeing = true; flock.fleeTimer = 180; }
        if (flock.fleeTimer > 0) flock.fleeTimer--;
        else flock.fleeing = false;

        const flockAngle = Math.atan2(
            flock.birds.reduce((s: number, b: any) => s + b.vy, 0),
            flock.birds.reduce((s: number, b: any) => s + b.vx, 0)
        );
        const baseSpd = flock.fleeing ? 0.035 : 0.014;

        flock.birds.forEach((bird: any) => {
            let targetAngle = flockAngle;
            if (flock.fleeing) {
                const awayAngle = Math.atan2(bird.y - G.heli.y, bird.x - G.heli.x);
                targetAngle = awayAngle + (Math.random() - 0.5) * 0.5;
            } else {
                targetAngle += (Math.random() - 0.5) * 0.04 + G.wind.x * 0.08;
            }
            const toCx = cx - bird.x, toCy = cy - bird.y;
            const cohesion = 0.0003;
            bird.vx += toCx * cohesion + Math.cos(targetAngle) * 0.001;
            bird.vy += toCy * cohesion + Math.sin(targetAngle) * 0.001;
            const spd = Math.hypot(bird.vx, bird.vy);
            if (spd > 0.001) { bird.vx = (bird.vx / spd) * baseSpd; bird.vy = (bird.vy / spd) * baseSpd; }
            const gz = getGround(bird.x, bird.y, G.points, G.CARRIER);
            const targetZ = gz + 4 + Math.sin(bird.wingPhase * 0.3) * 0.5;
            bird.vz += (targetZ - bird.z) * 0.05;
            bird.vz *= 0.85;
            bird.x += bird.vx; bird.y += bird.vy; bird.z += bird.vz;
            bird.wingPhase += flock.fleeing ? 0.4 : 0.2;
            if (bird.x < 3) bird.vx += 0.005;
            if (bird.x > gridSize - 3) bird.vx -= 0.005;
            if (bird.y < 3) bird.vy += 0.005;
            if (bird.y > gridSize - 3) bird.vy -= 0.005;
        });
    });
}

const _getRotorPositions = () => {
    const cosA = Math.cos(G.heli.angle), sinA = Math.sin(G.heli.angle);
    return getHeliType(G.heli.type).rotorOffsets.map((ox: number) => ({
        x: G.heli.x + cosA * ox,
        y: G.heli.y + sinA * ox,
    }));
};

export const handleParticles = (dt: number, _ctx: PhysicsCtx) => {
    const gH = getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
    const rotors = _getRotorPositions();
    if (G.heli.rotorRPM > 0.8) {
        if (G.heli.z < G.waterLevel + 2.5 && gH > G.waterLevel + 0.1) {
            rotors.forEach((rotor: any) => {
                const a = Math.random() * Math.PI * 2;
                G.particles.push({
                    x: rotor.x + Math.cos(a) * 0.6, y: rotor.y + Math.sin(a) * 0.6,
                    z: gH + 0.1,
                    vx: Math.cos(a) * 0.06, vy: Math.sin(a) * 0.06,
                    life: 0.5, color: '150, 140, 120',
                });
            });
        } else if (G.heli.z < G.waterLevel + 2.0 && gH < G.waterLevel + 0.1) {
            rotors.forEach((rotor: any) => {
                for (let i = 0; i < 2; i++) {
                    const a = Math.random() * Math.PI * 2;
                    G.particles.push({
                        x: rotor.x + Math.cos(a) * 0.6, y: rotor.y + Math.sin(a) * 0.6,
                        z: G.waterLevel,
                        vx: Math.cos(a) * 0.08, vy: Math.sin(a) * 0.08,
                        life: 0.4, color: '200, 230, 255',
                    });
                }
            });
        }
    }
    G.particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.02 * dt;
    });
    G.particles = G.particles.filter(p => p.life > 0);
}
