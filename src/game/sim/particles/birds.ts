import type { Bird, Flock, ParticleSystemArgs } from './ctx';

export const init = ({ ctx }: ParticleSystemArgs) => {
    ctx.flocks.splice(0);
    const { gridSize, getGround, waterLevel } = ctx;
    const numFlocks = 2 + Math.floor(Math.random() * 2);
    const spawnCx = gridSize / 2;
    const spawnCy = gridSize / 2;
    for (let f = 0; f < numFlocks; f++) {
        let fx = 0, fy = 0, found = false;
        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 5 + Math.random() * 18;
            fx = Math.max(3, Math.min(gridSize - 3, spawnCx + Math.cos(angle) * dist));
            fy = Math.max(3, Math.min(gridSize - 3, spawnCy + Math.sin(angle) * dist));
            if (getGround(fx, fy) > waterLevel + 0.2) { found = true; break; }
        }
        if (!found) { fx = 5 + Math.random() * (gridSize - 10); fy = 5 + Math.random() * (gridSize - 10); }
        const fz = 3 + Math.random() * 5;
        const baseAngle = Math.random() * Math.PI * 2;
        const spd = 0.012 + Math.random() * 0.008;
        const count = 4 + Math.floor(Math.random() * 6);
        const birds: Bird[] = [];
        for (let i = 0; i < count; i++) {
            birds.push({
                x: fx + (Math.random() - 0.5) * 3, y: fy + (Math.random() - 0.5) * 3,
                z: fz + (Math.random() - 0.5) * 0.8,
                vx: Math.cos(baseAngle) * spd, vy: Math.sin(baseAngle) * spd, vz: 0,
                wingPhase: Math.random() * Math.PI * 2,
            });
        }
        ctx.flocks.push({ birds, fleeing: false, fleeTimer: 0 } satisfies Flock);
    }
};

export const update = ({ ctx }: ParticleSystemArgs) => {
    const { flocks, heli, wind, gridSize, getGround } = ctx;
    flocks.forEach(flock => {
        const cx = flock.birds.reduce((s, b) => s + b.x, 0) / flock.birds.length;
        const cy = flock.birds.reduce((s, b) => s + b.y, 0) / flock.birds.length;
        const distToHeli = Math.hypot(heli.x - cx, heli.y - cy);
        const heliLoud = heli.rotorRPM > 0.3;
        if (heliLoud && distToHeli < 8) { flock.fleeing = true; flock.fleeTimer = 180; }
        if (flock.fleeTimer > 0) flock.fleeTimer--;
        else flock.fleeing = false;

        const flockAngle = Math.atan2(
            flock.birds.reduce((s, b) => s + b.vy, 0),
            flock.birds.reduce((s, b) => s + b.vx, 0)
        );
        const baseSpd = flock.fleeing ? 0.035 : 0.014;

        flock.birds.forEach(bird => {
            let targetAngle = flockAngle;
            if (flock.fleeing) {
                const awayAngle = Math.atan2(bird.y - heli.y, bird.x - heli.x);
                targetAngle = awayAngle + (Math.random() - 0.5) * 0.5;
            } else {
                targetAngle += (Math.random() - 0.5) * 0.04 + wind.x * 0.08;
            }
            const toCx = cx - bird.x, toCy = cy - bird.y;
            const cohesion = 0.0003;
            bird.vx += toCx * cohesion + Math.cos(targetAngle) * 0.001;
            bird.vy += toCy * cohesion + Math.sin(targetAngle) * 0.001;
            const spd = Math.hypot(bird.vx, bird.vy);
            if (spd > 0.001) { bird.vx = (bird.vx / spd) * baseSpd; bird.vy = (bird.vy / spd) * baseSpd; }
            const gz = getGround(bird.x, bird.y);
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
