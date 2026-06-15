import { campaignHandler } from '../../main';
import { G } from '../../state';
import { getGround } from '../terrain';

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
};

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
};
