import type { ParticlesCtx, ParticleSystemArgs } from './ctx';

const _getRotorPositions = (ctx: ParticlesCtx) => {
    const { heli, getHeliType } = ctx;
    const cosA = Math.cos(heli.angle), sinA = Math.sin(heli.angle);
    return getHeliType(heli.type).rotorOffsets.map((ox: number) => ({
        x: heli.x + cosA * ox,
        y: heli.y + sinA * ox,
    }));
};

export const update = ({ ctx, dt }: ParticleSystemArgs) => {
    const { particles, heli, waterLevel, getGround } = ctx;
    const gH = getGround(heli.x, heli.y);
    const rotors = _getRotorPositions(ctx);
    if (heli.rotorRPM > 0.8) {
        if (heli.z < waterLevel + 2.5 && gH > waterLevel + 0.1) {
            rotors.forEach((rotor: { x: number; y: number }) => {
                const a = Math.random() * Math.PI * 2;
                particles.push({
                    x: rotor.x + Math.cos(a) * 0.6, y: rotor.y + Math.sin(a) * 0.6,
                    z: gH + 0.1, vx: Math.cos(a) * 0.06, vy: Math.sin(a) * 0.06, vz: 0,
                    life: 0.5, color: '150, 140, 120',
                });
            });
        } else if (heli.z < waterLevel + 2.0 && gH < waterLevel + 0.1) {
            rotors.forEach((rotor: { x: number; y: number }) => {
                for (let i = 0; i < 2; i++) {
                    const a = Math.random() * Math.PI * 2;
                    particles.push({
                        x: rotor.x + Math.cos(a) * 0.6, y: rotor.y + Math.sin(a) * 0.6,
                        z: waterLevel, vx: Math.cos(a) * 0.08, vy: Math.sin(a) * 0.08, vz: 0,
                        life: 0.4, color: '200, 230, 255',
                    });
                }
            });
        }
    }
    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.02 * dt;
    });
    for (let i = particles.length - 1; i >= 0; i--)
        if (particles[i].life <= 0) particles.splice(i, 1);
};
