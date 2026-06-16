import type { Particle, DebrisPiece, ParticleSystemArgs } from './ctx';

export const init = ({ ctx }: ParticleSystemArgs) => {
    const { particles, debris, getGround, getHeliType } = ctx;
    const heli = ctx.heli;
    const impactSpeed = Math.hypot(heli.vx, heli.vy, heli.vz);
    const intensity = Math.min(1.0, impactSpeed / 0.25);
    const count = Math.floor(30 + intensity * 80);
    const x = heli.x, y = heli.y;
    const z = Math.max(heli.z, getGround(heli.x, heli.y) + 0.1);
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
        } satisfies Particle);
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
        } satisfies Particle);
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
        } satisfies DebrisPiece);
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
                } satisfies Particle);
            }
        }, i * 120);
    }
};

export const update = ({ ctx }: ParticleSystemArgs) => {
    const { debris, particles, getGround } = ctx;
    debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.z += d.vz;
        d.vz += d.gravity !== undefined ? d.gravity : -0.006;
        d.angle += d.av;
        d.av *= 0.98;
        d.life -= 0.016;
        const gz = getGround(d.x, d.y);
        if (d.z <= gz) {
            d.z = gz;
            d.vz = Math.abs(d.vz) * 0.25;
            d.vx *= 0.6;
            d.vy *= 0.6;
            d.av *= 0.4;
            if (!d.bounced) {
                particles.push({
                    x: d.x, y: d.y, z: gz + 0.05,
                    vx: (Math.random() - 0.5) * 0.03,
                    vy: (Math.random() - 0.5) * 0.03,
                    vz: 0.015, gravity: 0, size: 4, life: 0.3, maxLife: 0.3,
                    color: '150,130,100', isSmoke: true,
                } satisfies Particle);
                d.bounced = true;
            }
        }
    });
    for (let i = debris.length - 1; i >= 0; i--)
        if (debris[i].life <= 0) debris.splice(i, 1);
};
