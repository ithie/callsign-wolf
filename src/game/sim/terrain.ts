import { campaignHandler } from '../main';
import { G } from '../state';

export function initGrid(size: number, points: number[][]) {
    for (let x = 0; x <= size; x++) {
        points[x] = [];
        for (let y = 0; y <= size; y++) points[x][y] = 0;
    }
}

export function generateTerrain(
    points: number[][],
    PAD: { xMin: number; xMax: number; yMin: number; yMax: number; z: number } | null
) {
    const { terrain, gridSize } = campaignHandler.getTerrain();
    for (let x = 0; x <= gridSize; x++) {
        for (let y = 0; y <= gridSize; y++) {
            if (PAD && x >= PAD.xMin && x <= PAD.xMax + 1 && y >= PAD.yMin && y <= PAD.yMax + 1) points[x][y] = PAD.z;
            else points[x][y] = terrain[x][y];
        }
    }
}

export function getCarrierLocal(globX: number, globY: number, CARRIER = G.CARRIER) {
    const dx = globX - CARRIER.x, dy = globY - CARRIER.y;
    const ang = -CARRIER.angle;
    return {
        x: dx * Math.cos(ang) - dy * Math.sin(ang),
        y: dx * Math.sin(ang) + dy * Math.cos(ang),
    };
}

export function getGround(fx: number, fy: number, points = G.points, CARRIER = G.CARRIER) {
    if (CARRIER && CARRIER.x !== undefined) {
        const local = getCarrierLocal(fx, fy, CARRIER);
        if (local.x >= -CARRIER.w && local.x <= CARRIER.w && local.y >= -CARRIER.l && local.y <= CARRIER.l) {
            if (local.x > -5.5 && local.x < -1.0 && local.y > 2.6 && local.y < 4.1) return CARRIER.zDeck + 1.2;
            return CARRIER.zDeck;
        }
    }
    for (const s of G.SUBMARINES) {
        const dx = fx - s.x, dy = fy - s.y;
        const cosA = Math.cos(-s.angle), sinA = Math.sin(-s.angle);
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        if (Math.abs(lx) <= s.l && Math.abs(ly) <= s.w) return s.zDeck;
    }
    const { gridSize } = campaignHandler.getTerrain();
    let x1 = Math.floor(fx), y1 = Math.floor(fy);
    if (x1 < 0 || y1 < 0 || x1 >= gridSize - 1 || y1 >= gridSize - 1) return -1.0;
    if (!points[x1] || !points[x1 + 1]) return -1.0;
    const tX = fx - x1, tY = fy - y1;
    if (x1 + 1 < gridSize && y1 + 1 < gridSize) {
        return (
            points[x1][y1] * (1 - tX) * (1 - tY) +
            points[x1 + 1][y1] * tX * (1 - tY) +
            points[x1 + 1][y1 + 1] * tX * tY +
            points[x1][y1 + 1] * (1 - tX) * tY
        );
    }
    return 0;
}

export const isFlatTerrain = (x: number, y: number): boolean => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const p = G.points;
    if (!p[xi] || !p[xi + 1]) return false;
    const h0 = p[xi][yi] ?? 0, h1 = p[xi + 1][yi] ?? 0;
    const h2 = p[xi][yi + 1] ?? 0, h3 = p[xi + 1][yi + 1] ?? 0;
    return Math.max(h0, h1, h2, h3) - Math.min(h0, h1, h2, h3) < 0.15;
};
