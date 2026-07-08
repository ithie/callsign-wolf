import { G } from './state';
import { getGround } from './sim/terrain';
import { isLightningActive } from './lightning-state';

export interface DrawTerrainCtx {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    tileW: number;
    tileH: number;
    stepH: number;
    getTerrain: () => { gridSize: number };
    isPadTile: (x: number, y: number) => boolean;
    isServiceTile: (x: number, y: number) => boolean;
}

export const createDrawTerrain = (dtCtx: DrawTerrainCtx) => {
    const {
        ctx, canvas, tileW, tileH, stepH,
        getTerrain, isPadTile, isServiceTile,
    } = dtCtx;

    let _tileColors: string[][] = [];
    // Precomputed base vertex coords per tile (without hw/hh/camX/camY offset).
    // Layout: [bx0,by0, bx1,by1, bx2,by2, bx3,by3] at index (y*gridSize+x)*8.
    let _baseCoords: Float32Array | null = null;
    const _terrainBatch = new Map<string, number[]>();
    const _batchColorLastD = new Map<string, number>();
    let _batchMaxD = -Infinity;
    // Per-diagonal getFill result cache — computed once in Pass 1, reused in Pass 2.
    const _diagFillCache: string[] = [];

    const _renderTerrainBatched = (
        tW: number,
        tH: number,
        ccX: number,
        ccY: number,
        xFrom: number,
        xTo: number,
        yFrom: number,
        yTo: number,
        getFill: (x: number, y: number, h0: number) => string
    ) => {
        const base = _baseCoords;
        if (!base) return;
        const { gridSize } = getTerrain();
        _terrainBatch.clear();
        _batchColorLastD.clear();
        _batchMaxD = -Infinity;
        const ox = tW / 2 - ccX, oy = tH / 2 - ccY;

        const flushBatch = () => {
            for (const [fill, coords] of _terrainBatch) {
                ctx.fillStyle = fill;
                ctx.beginPath();
                for (let i = 0; i < coords.length; i += 8) {
                    ctx.moveTo(coords[i], coords[i + 1]);
                    ctx.lineTo(coords[i + 2], coords[i + 3]);
                    ctx.lineTo(coords[i + 4], coords[i + 5]);
                    ctx.lineTo(coords[i + 6], coords[i + 7]);
                    ctx.closePath();
                }
                ctx.fill();
            }
            _terrainBatch.clear();
            _batchColorLastD.clear();
            _batchMaxD = -Infinity;
        };

        const dMin = xFrom + yFrom, dMax = xTo + yTo;
        for (let d = dMin; d <= dMax; d++) {
            const xLo = Math.max(Math.max(0, xFrom), d - Math.min(gridSize - 1, yTo) + 1);
            const xHi = Math.min(Math.min(gridSize - 1, xTo) - 1, d - Math.max(0, yFrom));

            // Pass 1: compute fills into cache and detect depth-order conflicts.
            // Conflict: color C reappears after another color D was added since C's last occurrence,
            // meaning D must be drawn between C's two occurrences — impossible with a single batch.
            let needsFlush = false;
            let cacheLen = 0;
            for (let x = xLo; x <= xHi; x++) {
                const y = d - x;
                if (y < 0 || y >= gridSize - 1) { _diagFillCache[cacheLen++] = ''; continue; }
                const fill = getFill(x, y, G.points[x][y]);
                _diagFillCache[cacheLen++] = fill;
                if (!needsFlush) {
                    const lastD = _batchColorLastD.get(fill);
                    if (lastD !== undefined && _batchMaxD > lastD) needsFlush = true;
                }
            }

            if (needsFlush) flushBatch();

            // Pass 2: add tiles to batch using cached fills and precomputed base coords.
            let anyAdded = false;
            for (let ci = 0, x = xLo; x <= xHi; x++, ci++) {
                const fill = _diagFillCache[ci];
                if (!fill) continue;
                const y = d - x;
                const bi = (y * gridSize + x) * 8;
                const p0x = base[bi]     + ox, p0y = base[bi + 1] + oy;
                const p1x = base[bi + 2] + ox, p1y = base[bi + 3] + oy;
                const p2x = base[bi + 4] + ox, p2y = base[bi + 5] + oy;
                const p3x = base[bi + 6] + ox, p3y = base[bi + 7] + oy;

                let batch = _terrainBatch.get(fill);
                if (!batch) { batch = []; _terrainBatch.set(fill, batch); }
                batch.push(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
                _batchColorLastD.set(fill, d);
                anyAdded = true;
            }
            if (anyAdded) _batchMaxD = d;
        }
        flushBatch();
    };

    const precomputeDayColors = (rain: boolean, snow = false) => {
        const { gridSize } = getTerrain();
        const htW = tileW / 2, htH = tileH / 2;

        // Precompute base vertex coords from terrain heights (camera-independent).
        // Each vertex expanded 0.5px outward from tile centroid to close anti-aliasing gaps.
        _baseCoords = new Float32Array(gridSize * gridSize * 8);
        for (let x = 0; x < gridSize - 1; x++) {
            for (let y = 0; y < gridSize - 1; y++) {
                const h0 = G.points[x][y],         h1 = G.points[x + 1][y];
                const h2 = G.points[x + 1][y + 1], h3 = G.points[x][y + 1];
                const bi = (y * gridSize + x) * 8;
                _baseCoords[bi]     = (x - y) * htW;
                _baseCoords[bi + 1] = (x + y) * htH - h0 * stepH - 0.5;      // top: y up
                _baseCoords[bi + 2] = (x + 1 - y) * htW + 0.5;               // right: x right
                _baseCoords[bi + 3] = (x + 1 + y) * htH - h1 * stepH;
                _baseCoords[bi + 4] = (x + 1 - (y + 1)) * htW;
                _baseCoords[bi + 5] = (x + 1 + (y + 1)) * htH - h2 * stepH + 0.5; // bottom: y down
                _baseCoords[bi + 6] = (x - (y + 1)) * htW - 0.5;             // left: x left
                _baseCoords[bi + 7] = (x + (y + 1)) * htH - h3 * stepH;
            }
        }

        _tileColors = [];
        for (let x = 0; x < gridSize; x++) {
            _tileColors[x] = [];
            for (let y = 0; y < gridSize; y++) {
                const h0 = G.points[x]?.[y] ?? 0;
                const wl = G.waterLevel;
                const c = 35 + Math.floor(h0 * 15);
                const isSand = !isPadTile(x, y) && !isServiceTile(x, y) && h0 > wl && (G.sandPoints[x]?.[y] ?? 0) > 0;
                const isPavement = !isPadTile(x, y) && !isServiceTile(x, y) && h0 > wl && (G.pavementPoints[x]?.[y] ?? 0) > 0;
                const sr = 190 + Math.floor(h0 * 8), sg = 205 + Math.floor(h0 * 7), sb = 220 + Math.floor(h0 * 6);
                _tileColors[x][y] = isPadTile(x, y)
                    ? (snow ? '#888' : '#444')
                    : isServiceTile(x, y)
                    ? (snow ? '#888' : '#444')
                    : isPavement
                    ? (snow ? `rgb(${c + 70},${c + 75},${c + 80})` : `rgb(${c + 40},${c + 40},${c + 45})`)
                    : isSand
                    ? (snow ? `rgb(${sr},${sg},${sb})` : `rgb(${Math.min(240, c + 160)},${Math.min(215, c + 135)},${Math.min(140, c + 55)})`)
                    : h0 > wl
                    ? (snow ? `rgb(${sr},${sg},${sb})` : `rgb(${c - 10},${c + 30},${c - 10})`)
                    : (rain && snow) ? '#081a38'
                    : rain ? '#002244'
                    : snow ? '#0a3060'
                    : '#1a5f9e';
            }
        }
    };

    const drawTerrain = (camX: number, camY: number, rx: number, ry: number, isNight: boolean, _rain: boolean) => {
        const _tileRange = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
        // At altitude, rx/ry shift NW by heli.z*(stepH/tileH). Extend SE to keep elevated tiles in range.
        const _heightBoost = isFinite(G.heli.z) && G.heli.z > 0 ? Math.ceil(G.heli.z * stepH / tileH) : 0;
        const xFrom = Math.floor(rx - _tileRange);
        const xTo = Math.ceil(rx + _tileRange + _heightBoost);
        const yFrom = Math.floor(ry - _tileRange);
        const yTo = Math.ceil(ry + _tileRange + _heightBoost);

        if (isNight) {
            if (isLightningActive()) {
                _renderTerrainBatched(canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo, (x, y, h0) => {
                    if (isPadTile(x, y) || isServiceTile(x, y)) return 'rgb(38,38,44)';
                    if (h0 > G.waterLevel && (G.pavementPoints[x]?.[y] ?? 0) > 0) return 'rgb(50,50,56)';
                    if (h0 > G.waterLevel && (G.sandPoints[x]?.[y] ?? 0) > 0) return 'rgb(105,100,75)';
                    return h0 > G.waterLevel ? 'rgb(38,52,38)' : 'rgb(15,25,52)';
                });
                return;
            }
            const alt = G.heli.z - getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
            const coneWidth = 0.3 + alt * 0.05;
            const range = 10 + alt * 2.0;
            const range2 = range * range;
            const intensity = Math.floor(255 * Math.max(0.1, 1.0 - alt / 15));
            const haX = G.heli.x, haY = G.heli.y, haA = G.heli.angle;
            _renderTerrainBatched(canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo, (x, y, h0) => {
                const _isPad = isPadTile(x, y);
                const _isSvc = isServiceTile(x, y);
                let diff = Math.atan2(y - haY, x - haX) - haA;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                const dx = x - haX, dy = y - haY;
                const inLight = Math.abs(diff) < coneWidth && dx * dx + dy * dy < range2;
                if (!inLight) return '#020205';
                if (_isPad) return `rgb(${intensity - 30},${intensity - 30},${intensity - 30})`;
                if (_isSvc) return `rgb(${Math.floor(intensity * 0.55)},${Math.floor(intensity * 0.55)},${Math.floor(intensity * 0.55)})`;
                if (h0 > G.waterLevel && (G.pavementPoints[x]?.[y] ?? 0) > 0)
                    return `rgb(${Math.floor(intensity * 0.6)},${Math.floor(intensity * 0.6)},${Math.floor(intensity * 0.65)})`;
                if (h0 > G.waterLevel && (G.sandPoints[x]?.[y] ?? 0) > 0)
                    return `rgb(${Math.floor(intensity * 1.05)},${Math.floor(intensity * 0.88)},${Math.floor(intensity * 0.45)})`;
                return h0 > G.waterLevel
                    ? `rgb(${intensity - 20},${intensity + 10},${intensity - 20})`
                    : `rgb(0,${Math.floor(intensity * 0.3)},${Math.floor(intensity * 0.6)})`;
            });
            return;
        }

        _renderTerrainBatched(
            canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo,
            (x, y, _h0) => _tileColors[x]?.[y] ?? '#003d7a'
        );
    };

    return { drawTerrain, precomputeDayColors };
};
