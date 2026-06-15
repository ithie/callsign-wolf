import { G } from '../../state';
import { getHeliType } from '../../heli-types';
import { getGround } from '../terrain';
import { PhysicsCtx } from '../ctx';

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
};
