const iso = (
    vx: number,
    vy: number,
    h: number,
    cx: number,
    cy: number,
    { canvas, tileW, tileH, stepH }: { canvas: HTMLCanvasElement; tileH: number; tileW: number; stepH: number },
    out?: { x: number; y: number }
) => {
    let cv = canvas || document.getElementById('gameCanvas');
    const px = cv.width / 2 + (vx - vy) * (tileW / 2) - cx;
    const py = cv.height / 2 + (vx + vy) * (tileH / 2) - h * stepH - cy;
    if (out) { out.x = px; out.y = py; return out; }
    return { x: px, y: py };
};

type IsoConfig = { canvas: HTMLCanvasElement; tileW: number; tileH: number; stepH: number };

const createIsoFn = (config: IsoConfig) =>
    (wx: number, wy: number, wz: number, cx: number, cy: number, out?: { x: number; y: number }) =>
        iso(wx, wy, wz, cx, cy, config, out);

export { iso, createIsoFn };
