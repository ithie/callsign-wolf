import { G } from './state';
import { getGround } from './sim/terrain';

export interface DrawTerrainCtx {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    tileW: number;
    tileH: number;
    stepH: number;
    getTerrain: () => { gridSize: number };
    isPadTile: (x: number, y: number) => boolean;
    isServiceTile: (x: number, y: number) => boolean;
    isApp: boolean;
    getPartyMode: () => boolean;
    partyPalette: string[];
}

export const createDrawTerrain = (dtCtx: DrawTerrainCtx) => {
    const {
        ctx, canvas, tileW, tileH, stepH,
        getTerrain, isPadTile, isServiceTile,
        isApp, getPartyMode, partyPalette,
    } = dtCtx;

    let _tileColors: string[][] = [];
    const _terrainBatch = new Map<string, number[]>();

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
        const { gridSize } = getTerrain();
        _terrainBatch.clear();
        const hw = tW / 2, hh = tH / 2;
        const htW = tileW / 2, htH = tileH / 2;

        for (let x = Math.max(0, xFrom); x < Math.min(gridSize - 1, xTo); x++) {
            for (let y = Math.max(0, yFrom); y < Math.min(gridSize - 1, yTo); y++) {
                const h0 = G.points[x][y], h1 = G.points[x + 1][y];
                const h2 = G.points[x + 1][y + 1], h3 = G.points[x][y + 1];
                const fill = getFill(x, y, h0);
                const rh0 = h0, rh1 = h1, rh2 = h2, rh3 = h3;
                const p0x = hw + (x - y) * htW - ccX;
                const p0y = hh + (x + y) * htH - rh0 * stepH - ccY;
                const p1x = hw + (x + 1 - y) * htW - ccX;
                const p1y = hh + (x + 1 + y) * htH - rh1 * stepH - ccY;
                const p2x = hw + (x + 1 - (y + 1)) * htW - ccX;
                const p2y = hh + (x + 1 + (y + 1)) * htH - rh2 * stepH - ccY;
                const p3x = hw + (x - (y + 1)) * htW - ccX;
                const p3y = hh + (x + (y + 1)) * htH - rh3 * stepH - ccY;

                let batch = _terrainBatch.get(fill);
                if (!batch) { batch = []; _terrainBatch.set(fill, batch); }
                batch.push(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
            }
        }

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
    };

    const precomputeDayColors = (rain: boolean) => {
        const { gridSize } = getTerrain();
        _tileColors = [];
        for (let x = 0; x < gridSize; x++) {
            _tileColors[x] = [];
            for (let y = 0; y < gridSize; y++) {
                const h0 = G.points[x]?.[y] ?? 0;
                const wl = G.waterLevel;
                const c = 35 + Math.floor(h0 * 15);
                _tileColors[x][y] = isPadTile(x, y)
                    ? '#444'
                    : isServiceTile(x, y)
                    ? '#444'
                    : h0 > wl
                    ? `rgb(${c - 10},${c + 30},${c - 10})`
                    : rain
                    ? '#002244'
                    : '#003d7a';
            }
        }
    };

    const drawTerrain = (camX: number, camY: number, rx: number, ry: number, isNight: boolean, _rain: boolean) => {
        const _tileRange = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
        const xFrom = Math.floor(rx - _tileRange);
        const xTo = Math.ceil(rx + _tileRange);
        const yFrom = Math.floor(ry - _tileRange);
        const yTo = Math.ceil(ry + _tileRange);

        if (isNight) {
            const alt = G.heli.z - Math.max(G.waterLevel, getGround(G.heli.x, G.heli.y, G.points, G.CARRIER));
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
                return h0 > G.waterLevel
                    ? `rgb(${intensity - 20},${intensity + 10},${intensity - 20})`
                    : `rgb(0,${Math.floor(intensity * 0.3)},${Math.floor(intensity * 0.6)})`;
            });
            return;
        }

        if (!isApp && getPartyMode()) {
            _renderTerrainBatched(canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo, (x, y, _h0) => {
                if (isPadTile(x, y)) return '#444';
                if (isServiceTile(x, y)) return '#aaaaaa';
                const tileOffset = Math.abs(x * 173 + y * 251) % 800;
                const phase = Math.floor((Date.now() + tileOffset * 320) / 280);
                return partyPalette[phase % partyPalette.length];
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
