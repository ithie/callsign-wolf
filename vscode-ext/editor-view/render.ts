import { state, getCurrentMission } from './state';
import { renderEventsPanel } from './events-editor';
import { COLORS, getSandColor } from '@/shared/constants';
import { createSceneRenderer } from '../../src/game/scene-renderer';
import { createIsoFn } from '../../src/game/render';
import { renderNodes, applyParts } from '../../src/game/def-utils';
import { createDrawObjects } from '../../src/game/draw-objects';
import type { DEF, DEF2 } from '../../src/game/defs';

import LIGHTHOUSE_RAW        from '../../src/game/models/objects/lighthouse.zdef';
import WIND_TURBINE_RAW      from '../../src/game/models/objects/wind_turbine.zdef';
import BUOY_RAW              from '../../src/game/models/objects/buoy.zdef';
import BAYWATCH_CAR_RAW      from '../../src/game/models/objects/baywatch_car.zdef';
import BAYWATCH_HQ_RAW       from '../../src/game/models/objects/baywatch_hq.zdef';
import BAYWATCH_TOWER_RAW    from '../../src/game/models/objects/baywatch_tower.zdef';
import CONCERT_STAGE_RAW     from '../../src/game/models/objects/concert_stage.zdef';
import FESTIVAL_TENT_RAW     from '../../src/game/models/objects/festival_tent.zdef';
import FESTIVAL_TENT_BRK_RAW from '../../src/game/models/objects/festival_tent_broken.zdef';
import FESTIVAL_CAR_RAW      from '../../src/game/models/objects/festival_car.zdef';
import XMAS_HOUSE_A_RAW      from '../../src/game/models/objects/xmas_house_a.zdef';
import XMAS_HOUSE_B_RAW      from '../../src/game/models/objects/xmas_house_b.zdef';
import XMAS_LANTERN_RAW      from '../../src/game/models/objects/xmas_lantern.zdef';
import SLEIGH_RAW            from '../../src/game/models/objects/sleigh.zdef';
import REINDEER_RAW          from '../../src/game/models/objects/reindeer.zdef';
import VOLLEYBALL_COURT_RAW  from '../../src/game/models/objects/volleyball_court.zdef';
import HANGAR_RAW            from '../../src/game/models/objects/hangar.zdef';
import TOWER_RAW             from '../../src/game/models/objects/tower.zdef';
import HANGAR_TOWER_RAW      from '../../src/game/models/objects/hangar_tower.zdef';
import PLANE_WRECK_RAW       from '../../src/game/models/objects/plane_wreck.zdef';
import SAILBOAT_BROKEN_RAW   from '../../src/game/models/objects/sailboat_broken.zdef';
import RESEARCH_PLATFORM_RAW from '../../src/game/models/research_platform.zdef';
import SUBMARINE_RAW         from '../../src/game/models/submarine.zdef';
import CARRIER_RAW           from '../../src/game/models/carrier.zdef';
import FRIGATE_RAW           from '../../src/game/models/frigate.zdef';
import SUPPLY_VESSEL_RAW     from '../../src/game/models/supply_vessel.zdef';
import SAILBOAT_RAW          from '../../src/game/models/sailboat.zdef';
import SAR_BOAT_RAW          from '../../src/game/models/sar_boat.zdef';
import PILOT_BOAT_RAW        from '../../src/game/models/pilot_boat.zdef';

const _DEF_MAP: Record<string, { def: unknown; v2: boolean }> = {
    lighthouse:           { def: LIGHTHOUSE_RAW,        v2: false },
    wind_turbine:         { def: WIND_TURBINE_RAW,      v2: false },
    buoy:                 { def: BUOY_RAW,              v2: false },
    baywatch_car:         { def: BAYWATCH_CAR_RAW,      v2: false },
    baywatch_hq:          { def: BAYWATCH_HQ_RAW,       v2: false },
    baywatch_tower:       { def: BAYWATCH_TOWER_RAW,    v2: false },
    concert_stage:        { def: CONCERT_STAGE_RAW,     v2: false },
    festival_tent:        { def: FESTIVAL_TENT_RAW,     v2: false },
    festival_tent_broken: { def: FESTIVAL_TENT_BRK_RAW, v2: false },
    festival_car:         { def: FESTIVAL_CAR_RAW,      v2: false },
    xmas_house_a:         { def: XMAS_HOUSE_A_RAW,      v2: false },
    xmas_house_b:         { def: XMAS_HOUSE_B_RAW,      v2: false },
    xmas_lantern:         { def: XMAS_LANTERN_RAW,      v2: false },
    sleigh:               { def: SLEIGH_RAW,             v2: false },
    reindeer:             { def: REINDEER_RAW,           v2: false },
    volleyball_court:     { def: VOLLEYBALL_COURT_RAW,  v2: false },
    hangar_tower:         { def: HANGAR_TOWER_RAW,       v2: false },
    plane_wreck:          { def: PLANE_WRECK_RAW,        v2: false },
    sailboat_broken:      { def: SAILBOAT_BROKEN_RAW,   v2: false },
    research_platform:    { def: RESEARCH_PLATFORM_RAW, v2: false },
    submarine:            { def: SUBMARINE_RAW,          v2: false },
    carrier:              { def: CARRIER_RAW,            v2: true  },
    frigate:              { def: FRIGATE_RAW,            v2: true  },
    supply_vessel:        { def: SUPPLY_VESSEL_RAW,      v2: true  },
    sar_boat:             { def: SAR_BOAT_RAW,           v2: true  },
    pilot_boat:           { def: PILOT_BOAT_RAW,         v2: true  },
    boat:                 { def: SAILBOAT_RAW,           v2: false },
    salvage_tug:          { def: SUPPLY_VESSEL_RAW,      v2: true  },
};

// ── ISO Camera ────────────────────────────────────────────────────────────────
export const BASE_HW = 14;          // half-tile width at zoom=1
const HEIGHT_SCALE = 1.8;           // pixels of height per terrain unit at zoom=1

const _canvas = (): HTMLCanvasElement =>
    document.getElementById('editorCanvas') as HTMLCanvasElement;

export const isoHW  = (): number => BASE_HW * state.zoom;
export const isoHH  = (): number => BASE_HW * state.zoom * 0.5;
export const isoHS  = (): number => HEIGHT_SCALE * state.zoom;

const _ox = (c: HTMLCanvasElement): number =>
    c.width / 2 - (state.panX - state.panY) * isoHW();
const _oy = (c: HTMLCanvasElement): number =>
    c.height * 0.35 - (state.panX + state.panY) * isoHH();

export const gridToScreen = (gx: number, gy: number): { sx: number; sy: number } => {
    const c = _canvas();
    return {
        sx: (gx - gy) * isoHW() + _ox(c),
        sy: (gx + gy) * isoHH() + _oy(c),
    };
};

export const screenToGrid = (sx: number, sy: number): { gx: number; gy: number } => {
    const c = _canvas();
    const hw = isoHW(), hh = isoHH(), ox = _ox(c), oy = _oy(c);
    const dx = sx - ox, dy = sy - oy;
    return { gx: (dx / hw + dy / hh) / 2, gy: (dy / hh - dx / hw) / 2 };
};

// Center camera at game-native zoom (tileW/2 = 16px on Mac → zoom ≈ 1.14)
export const centerCamera = (gridSize: number): void => {
    state.zoom = 16 / BASE_HW;
    state.panX = gridSize / 2;
    state.panY = gridSize / 2;
};

// Fit entire map into view
export const fitCamera = (gridSize: number): void => {
    const c = _canvas();
    const fitW = c.width  / (gridSize * 2 * BASE_HW * 1.05);
    const fitH = (c.height * 0.9) / (gridSize * BASE_HW * 1.05);
    state.zoom = Math.min(fitW, fitH);
    state.panX = gridSize / 2;
    state.panY = gridSize / 2;
};

// ── Canvas Init ───────────────────────────────────────────────────────────────
export const initIsoCanvas = (): void => {
    const canvas = _canvas();
    const resize = () => {
        const p = canvas.parentElement!;
        canvas.width  = p.offsetWidth;
        canvas.height = p.offsetHeight;
        drawMap();
    };
    new ResizeObserver(resize).observe(canvas.parentElement ?? canvas);
    resize();
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const _showObjPanel = (id: string): void => {
    const panel = document.getElementById('ed-obj-panel');
    const el    = document.getElementById(id);
    if (panel) panel.style.display = 'block';
    if (el)    el.style.display    = 'block';
};

const _isoArrow = (
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    angleDeg: number,
    hw: number, hh: number,
    len: number, color: string,
): void => {
    const rad = (angleDeg * Math.PI) / 180;
    // World direction → ISO screen direction
    const wdx = Math.cos(rad), wdy = Math.sin(rad);
    const sdx = (wdx - wdy) * hw, sdy = (wdx + wdy) * hh;
    const mag  = Math.hypot(sdx, sdy);
    const nx   = (sdx / mag) * len, ny = (sdy / mag) * len;
    ctx.strokeStyle = color;
    ctx.lineWidth   = Math.max(1, hw * 0.15);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + nx, cy + ny);
    ctx.stroke();
    // arrowhead
    const head = len * 0.35, spread = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + nx, cy + ny);
    ctx.lineTo(cx + nx - Math.cos(Math.atan2(ny, nx) - spread) * head,
               cy + ny - Math.sin(Math.atan2(ny, nx) - spread) * head);
    ctx.moveTo(cx + nx, cy + ny);
    ctx.lineTo(cx + nx - Math.cos(Math.atan2(ny, nx) + spread) * head,
               cy + ny - Math.sin(Math.atan2(ny, nx) + spread) * head);
    ctx.stroke();
};

const _isoDiamond = (
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    hw: number, hh: number,
    fill: string, stroke?: string,
): void => {
    ctx.beginPath();
    ctx.moveTo(sx,      sy);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx,      sy + 2 * hh);
    ctx.lineTo(sx - hw, sy + hh);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
};

// Sync vessel settings from m.objects[idx] into the sidebar vessel form
export const syncVesselUI = (obj: any, kind: 'carrier' | 'boat' | 'submarine'): void => {
    const prefix = kind === 'carrier' ? 'carrier' : kind === 'submarine' ? 'submarine' : 'boat';
    const g = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    const pathEl   = g(`m_${prefix}_path`)   as HTMLSelectElement | null;
    const speedEl  = g(`m_${prefix}_speed`)  as HTMLInputElement | null;
    const radiusEl = g(`m_${prefix}_radius`) as HTMLInputElement | null;
    const angleEl  = g(`m_${prefix}_angle`)  as HTMLInputElement | null;
    const nameEl   = g(`m_${prefix}_name`)   as HTMLInputElement | null;
    const exitEl   = g(`m_${prefix}_exitWarning`) as HTMLInputElement | null;
    const radioEl  = g(`m_${prefix}_radioSilent`) as HTMLInputElement | null;
    if (pathEl)   pathEl.value   = obj.path      ?? 'static';
    if (speedEl)  speedEl.value  = (obj.speed    ?? 0).toString();
    if (radiusEl) radiusEl.value = (obj.radius   ?? 40).toString();
    if (angleEl)  angleEl.value  = (obj.angle    ?? 0).toString();
    if (nameEl)   nameEl.value   = obj.vesselName ?? '';
    if (exitEl)   (exitEl as any).checked = obj.exitWarning ?? false;
    if (radioEl)  (radioEl as any).checked = !(obj.radioSilent ?? false);
    if (kind === 'boat') {
        const radioRow = document.getElementById('m_boat_radioSilent_row');
        if (radioRow) radioRow.style.display = obj.type === 'frigate' ? '' : 'none';
    }
};

// ── Main Draw ─────────────────────────────────────────────────────────────────
export const drawMap = (): void => {
    const canvas = _canvas();
    const ctx    = canvas.getContext('2d')!;
    const m      = getCurrentMission();
    if (!m) return;

    // Hide all obj-section panels
    const objPanel = document.getElementById('ed-obj-panel');
    if (objPanel) objPanel.style.display = 'none';
    document.querySelectorAll<HTMLElement>('.floating-ui').forEach(el => {
        el.style.display = 'none';
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hw  = isoHW(), hh = isoHH(), hs = isoHS();
    const ox  = _ox(canvas), oy = _oy(canvas);
    const W   = canvas.width, H = canvas.height;
    const gs  = m.gridSize;

    const toSX = (gx: number, gy: number): number => (gx - gy) * hw + ox;
    const toSY = (gx: number, gy: number): number => (gx + gy) * hh + oy;

    const wl     = (m as any).waterLevel ?? 0;
    const isSnow = !!(m as any).snow;

    // ── DEF model rendering — uses the game's own createIsoFn ─────────────────
    const defTW   = hw * 2;
    const defIso  = createIsoFn({ canvas, tileW: defTW, tileH: hh * 2, stepH: hw * 0.78 });
    const defCamX = canvas.width  / 2 - ox;
    const defCamY = canvas.height / 2 - oy;
    const defDrawCtx = { ctx, isoFn: defIso, tileW: defTW };

    // Game draw functions reused in editor (drawTree needs no SceneRenderer)
    const _noSR = { add: () => {}, flush: () => {} } as any;
    const { drawTree, drawPerson } = createDrawObjects(ctx, defIso, defTW, hh * 2, _noSR);

    const _renderDEF = (def: unknown, v2: boolean, wx: number, wy: number, wz: number, angle: number, colors?: Record<string, string>): void => {
        const sr = createSceneRenderer(ctx, defIso);
        if (v2) {
            renderNodes(def as DEF2, {}, { x: wx, y: wy, z: wz, angle }, sr, defCamX, defCamY, defDrawCtx);
        } else {
            sr.add(def as DEF, { x: wx, y: wy, z: wz, angle, colors });
        }
        sr.flush(defCamX, defCamY);
    };

    // ── Visible range (4 corners → grid coords) ───────────────────────────────
    const corners = [[0,0],[W,0],[0,H],[W,H]].map(([sx,sy]) => {
        const dx = sx - ox, dy = sy - oy;
        return { gx: (dx/hw + dy/hh) / 2, gy: (dy/hh - dx/hw) / 2 };
    });
    const M  = 3;
    const x0 = Math.max(0,  Math.floor(Math.min(...corners.map(c => c.gx)) - M));
    const x1 = Math.min(gs, Math.ceil( Math.max(...corners.map(c => c.gx)) + M));
    const y0 = Math.max(0,  Math.floor(Math.min(...corners.map(c => c.gy)) - M));
    const y1 = Math.min(gs, Math.ceil( Math.max(...corners.map(c => c.gy)) + M));

    // ── Terrain ISO ───────────────────────────────────────────────────────────
    // Painter's algorithm: draw by ascending diagonal (x+y).
    // Each tile uses per-corner heights (identical to game draw-terrain.ts) →
    // smooth continuous surface, no staircase, no side walls.
    for (let d = x0 + y0; d <= x1 + y1 - 2; d++) {
        for (let gx = Math.max(x0, d - (y1 - 1)); gx <= Math.min(x1 - 2, d - y0); gx++) {
            const gy = d - gx;
            if (gy < y0 || gy >= y1 - 1) continue;

            const h0 = m.terrain[gx]?.[gy];
            const h1 = m.terrain[gx + 1]?.[gy];
            const h2 = m.terrain[gx + 1]?.[gy + 1];
            const h3 = m.terrain[gx]?.[gy + 1];
            if (h0 === undefined || h1 === undefined || h2 === undefined || h3 === undefined) continue;

            const isWater = h0 <= wl;
            const isSand  = !isWater && ((m as any).sand?.[gx]?.[gy] ?? 0) > 0;
            const isPave  = !isWater && ((m as any).pavement?.[gx]?.[gy] ?? 0) > 0;
            const _c = 35 + Math.floor(h0 * 15);
            const topColor = isWater
                ? (isSnow ? '#0a3060' : '#1a5f9e')
                : isPave  ? (isSnow ? `rgb(${_c+70},${_c+75},${_c+80})` : `rgb(${_c+40},${_c+40},${_c+45})`)
                : isSand  ? getSandColor(h0)
                : isSnow  ? `rgb(${190 + Math.floor(h0*8)},${205 + Math.floor(h0*7)},${220 + Math.floor(h0*6)})`
                : `rgb(${_c-10},${_c+30},${_c-10})`;

            const sx = toSX(gx, gy);
            const sy = toSY(gx, gy);

            ctx.beginPath();
            ctx.moveTo(sx,      sy        - h0 * hs);  // top:    (gx,   gy)
            ctx.lineTo(sx + hw, sy + hh   - h1 * hs);  // right:  (gx+1, gy)
            ctx.lineTo(sx,      sy + 2*hh - h2 * hs);  // bottom: (gx+1, gy+1)
            ctx.lineTo(sx - hw, sy + hh   - h3 * hs);  // left:   (gx,   gy+1)
            ctx.closePath();
            ctx.fillStyle = topColor;
            ctx.fill();

            if (hw > 18) {
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.lineWidth   = 0.5;
                ctx.stroke();
            }
        }
    }

    // ── Foliage ───────────────────────────────────────────────────────────────
    // gz converts terrain height (editor pixels/hs) → defIso z-units (pixels/stepH)
    // so trees sit on the terrain surface rather than floating below it.
    const _foliageGz = (terrH: number): number =>
        (0.5 + terrH * HEIGHT_SCALE / BASE_HW) / 0.78;

    const foliage = (m as any).foliage || [];
    foliage.forEach((f: any) => {
        const terrH = m.terrain[Math.floor(f.x)]?.[Math.floor(f.y)] ?? 0;
        const fGz   = _foliageGz(terrH);
        drawTree(f.x + 0.5, f.y + 0.5, defCamX, defCamY, f.s ?? 1, fGz, f.type, { x: 0, y: 0, phase: 0 });
    });

    // ── Event connections ─────────────────────────────────────────────────────
    const _evList: any[] = (m as any).events ?? [];
    if (_evList.length > 0) {
        ctx.save();
        _evList.forEach((ev: any) => {
            const t = ev.trigger;
            const srcObj = m.objects?.[t.objectIdx];
            if (!srcObj) return;
            const sx = toSX(srcObj.x + 0.5, srcObj.y + 0.5);
            const sy = toSY(srcObj.x + 0.5, srcObj.y + 0.5);
            if (t.type === 'objectReaches') {
                const dstObj = m.objects?.[t.nearObjectIdx];
                if (!dstObj) return;
                const dx = toSX(dstObj.x + 0.5, dstObj.y + 0.5);
                const dy = toSY(dstObj.x + 0.5, dstObj.y + 0.5);
                ctx.strokeStyle = 'rgba(255,140,0,0.55)';
                ctx.lineWidth   = 1.5;
                ctx.setLineDash([5, 4]);
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(dx, dy); ctx.stroke();
                const r = (t.distance ?? 8) * hw;
                ctx.strokeStyle = 'rgba(255,140,0,0.2)';
                ctx.lineWidth   = 1;
                ctx.beginPath(); ctx.ellipse(dx, dy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
            } else if (t.type === 'heliNear') {
                const r = (t.distance ?? 10) * hw;
                ctx.strokeStyle = 'rgba(255,230,50,0.35)';
                ctx.lineWidth   = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
            }
        });
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ── Objects ───────────────────────────────────────────────────────────────
    m.objects.forEach((obj, idx) => {
        const isSel = state.selectedObjectIdx === idx;
        const cx    = toSX(obj.x + 0.5, obj.y + 0.5);
        const cy    = toSY(obj.x + 0.5, obj.y + 0.5);
        const objAngle    = (obj as any).angle ?? 0;           // degrees — for _isoArrow
        const objAngleRad = objAngle * Math.PI / 180;          // radians — for _renderDEF
        const defEntry = obj.type !== 'pad' ? _DEF_MAP[obj.type] : undefined;

        if (isSel) { ctx.shadowBlur = 14; ctx.shadowColor = '#fff'; }

        if (obj.type === 'pad') {
            const towerVariant = (obj as any).towerVariant ?? 'classic';
            // Gray base plate — matches game's isPadTile → '#444'
            const _pb = [
                defIso(obj.x,   obj.y,   wl, defCamX, defCamY),
                defIso(obj.x+7, obj.y,   wl, defCamX, defCamY),
                defIso(obj.x+7, obj.y+7, wl, defCamX, defCamY),
                defIso(obj.x,   obj.y+7, wl, defCamX, defCamY),
            ];
            ctx.beginPath();
            ctx.moveTo(_pb[0].x, _pb[0].y);
            ctx.lineTo(_pb[1].x, _pb[1].y);
            ctx.lineTo(_pb[2].x, _pb[2].y);
            ctx.lineTo(_pb[3].x, _pb[3].y);
            ctx.closePath();
            ctx.fillStyle = '#444';
            ctx.fill();
            if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
            ctx.shadowBlur = 0;
            // Hangar building — same offset as game: xMax-3 = obj.x+4, yMin-1 = obj.y-1
            _renderDEF(HANGAR_RAW, false, obj.x + 4, obj.y - 1, wl, 0);
            // Tower (variant-dependent)
            const towerDef = towerVariant === 'new' ? HANGAR_TOWER_RAW : TOWER_RAW;
            const towerX   = towerVariant === 'new' ? obj.x + 7 : obj.x + 6.5;
            _renderDEF(towerDef, false, towerX, obj.y - 1, wl, 0);
            // Corner lights matching game _drawPadLights positions
            ([
                [obj.x + 0.5, obj.y + 0.5], [obj.x + 7.5, obj.y + 0.5],
                [obj.x + 7.5, obj.y + 7.5], [obj.x + 0.5, obj.y + 7.5],
            ] as [number, number][]).forEach(([lx, ly]) => {
                const lp = defIso(lx, ly, wl, defCamX, defCamY);
                ctx.fillStyle = '#cc2200';
                ctx.beginPath();
                ctx.arc(lp.x, lp.y, Math.max(1.5, hw * 0.12), 0, Math.PI * 2);
                ctx.fill();
            });
            const mid = defIso(obj.x + 3.5, obj.y + 3.5, wl, defCamX, defCamY);
            if (m.spawnObject === 'pad') _drawDolphin(ctx, mid.x, mid.y, 0, hw, hh);
            if (isSel) _showObjPanel('ui_pad');
            if (isSel) {
                const btn = document.getElementById('btn_spawn_pad');
                if (btn) btn.style.background = m.spawnObject === 'pad' ? COLORS.uiHighlight : 'var(--accent)';
                const tvSel = document.getElementById('pad_tower_variant') as HTMLSelectElement | null;
                if (tvSel) tvSel.value = towerVariant;
            }

        } else if (
            obj.type === 'carrier' || obj.type === 'boat' || obj.type === 'pilot_boat' ||
            obj.type === 'sar_boat' || obj.type === 'salvage_tug' || obj.type === 'supply_vessel' ||
            obj.type === 'frigate'
        ) {
            const isCarrier = obj.type === 'carrier';
            if (defEntry) {
                _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, wl, objAngleRad);
            } else {
                const color = obj.type === 'pilot_boat'   ? '#ffcc00' :
                              obj.type === 'sar_boat'     ? '#d32f2f' :
                              obj.type === 'salvage_tug'  ? '#888' :
                              obj.type === 'supply_vessel'? '#0d233a' :
                              obj.type === 'frigate'      ? '#5a6673' : '#ddd';
                const rad = Math.max(4, hw * 0.8);
                ctx.beginPath();
                ctx.ellipse(cx, cy, rad, rad * 0.6, 0, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
            }

            _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 2.2, '#fff');

            // Path preview
            if ((obj as any).path === 'circle') {
                const r  = ((obj as any).radius ?? 40);
                ctx.beginPath();
                ctx.ellipse(cx, cy, r * hw, r * hh * 0.9, 0, 0, Math.PI * 2);
                ctx.strokeStyle = isCarrier ? COLORS.carrierPath + '88' : '#4af8';
                ctx.lineWidth   = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (m.spawnObject === obj.type) _drawDolphin(ctx, cx, cy, 0, hw, hh);
            if (isSel) {
                _showObjPanel(isCarrier ? 'ui_carrier' : 'ui_boat');
                syncVesselUI(obj, isCarrier ? 'carrier' : 'boat');
                if (isCarrier) {
                    const btn = document.getElementById('btn_spawn_carrier');
                    if (btn) btn.style.background = m.spawnObject === 'carrier' ? COLORS.uiHighlight : 'var(--accent)';
                }
            }

        } else if (obj.type === 'submarine') {
            if (defEntry) {
                _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, wl, objAngleRad);
            } else {
                const rad = Math.max(3, hw * 0.7);
                ctx.beginPath();
                ctx.ellipse(cx, cy, rad, rad * 0.55, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#111c';
                ctx.fill();
                if (isSel) { ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5; ctx.stroke(); }
            }
            _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.8, '#888');
            if (isSel) { _showObjPanel('ui_submarine'); syncVesselUI(obj, 'submarine'); }

        } else if (obj.type === 'lighthouse') {
            if (defEntry) {
                _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad);
            }

        } else if (obj.type === 'research_platform') {
            if (defEntry) {
                _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad);
            }

        } else if (obj.type === 'wind_turbine') {
            if (defEntry) {
                const d = defEntry.def as DEF;
                const baked = d.parts?.length ? applyParts(d, {}) : d;
                _renderDEF(baked, false, obj.x, obj.y, 0, objAngleRad);
            }
            if (isSel) {
                _showObjPanel('ui_wt');
                const spinEl = document.getElementById('m_wt_spinning') as HTMLInputElement | null;
                if (spinEl) spinEl.checked = !!(obj as any).spinning;
            }

        } else {
            const panelMap: Record<string, string> = {
                plane_wreck: 'ui_plane_wreck', sailboat_broken: 'ui_sailboat_broken',
                ornithopter_wreck: 'ui_ornithopter_wreck', baywatch_car: 'ui_baywatch_car',
                baywatch_hq: 'ui_baywatch_hq', baywatch_tower: 'ui_baywatch_tower',
                concert_stage: 'ui_concert_stage', festival_tent: 'ui_festival_tent',
                festival_tent_broken: 'ui_festival_tent_broken', festival_car: 'ui_festival_car',
                xmas_house_a: 'ui_xmas_house', xmas_house_b: 'ui_xmas_house',
                xmas_lantern: 'ui_xmas_lantern', sleigh: 'ui_sleigh', reindeer: 'ui_reindeer',
            };

            if (obj.type === 'ring') {
                const rr    = (obj as any).radius ?? 2.5;
                const rz    = (obj as any).z ?? 4;
                const rAng  = (obj as any).angle ?? 0;  // radians, same as game
                const cosA  = Math.cos(rAng), sinA = Math.sin(rAng);
                const SEGS  = 24;
                // Ground shadow
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth   = 1;
                ctx.beginPath();
                for (let si = 0; si <= SEGS; si++) {
                    const t = (si / SEGS) * Math.PI * 2;
                    const p = defIso(obj.x + rr * Math.cos(t) * (-sinA), obj.y + rr * Math.cos(t) * cosA, 0, defCamX, defCamY);
                    if (si === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                }
                ctx.closePath(); ctx.stroke();
                // 3-D ring
                ctx.strokeStyle = isSel ? '#fff' : '#FFD700';
                ctx.lineWidth   = isSel ? 2.5 : 1.5;
                ctx.beginPath();
                for (let si = 0; si <= SEGS; si++) {
                    const t = (si / SEGS) * Math.PI * 2;
                    const p = defIso(
                        obj.x + rr * Math.cos(t) * (-sinA),
                        obj.y + rr * Math.cos(t) * cosA,
                        rz  + rr * Math.sin(t),
                        defCamX, defCamY,
                    );
                    if (si === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            } else if (defEntry) {
                const colors: Record<string, string> | undefined =
                    (defEntry.def as any).palettes && (obj as any).colorVariant
                        ? (defEntry.def as any).palettes[(obj as any).colorVariant]
                        : undefined;
                _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad, colors);
                if ((obj as any).angle !== undefined) {
                    _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.6, 'rgba(255,255,255,0.5)');
                }
            } else {
                // Fallback colored circle for types without a DEF model
                const typeColors: Record<string, string> = {
                    ornithopter_wreck: '#d0d0d0',
                };
                const color = typeColors[obj.type] || '#aaa';
                const r     = Math.max(3, hw * 0.65);
                ctx.beginPath();
                ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
                ctx.fillStyle = color + 'cc';
                ctx.fill();
                if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
                if ((obj as any).angle !== undefined) {
                    _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.6, '#fff');
                }
            }

            if (isSel && panelMap[obj.type]) {
                _showObjPanel(panelMap[obj.type]);
                const simpleId: Record<string, string> = {
                    plane_wreck: 'm_pw_angle', sailboat_broken: 'm_sb_angle',
                    ornithopter_wreck: 'm_ow_angle', baywatch_car: 'm_bwc_angle',
                    xmas_lantern: 'm_xmas_lantern_angle', sleigh: 'm_sleigh_angle',
                    reindeer: 'm_reindeer_angle',
                };
                const aEl = document.getElementById(simpleId[obj.type] || '') as HTMLInputElement | null;
                if (aEl) aEl.value = ((obj as any).angle ?? 0).toString();
                if (obj.type === 'xmas_house_a' || obj.type === 'xmas_house_b') {
                    const typeSel = document.getElementById('m_xmas_house_type') as HTMLSelectElement | null;
                    if (typeSel) typeSel.value = obj.type;
                }
                if (obj.type === 'festival_tent' || obj.type === 'festival_tent_broken') {
                    const cid = obj.type === 'festival_tent' ? 'm_tent_color' : 'm_tent_broken_color';
                    const cEl = document.getElementById(cid) as HTMLSelectElement | null;
                    if (cEl) cEl.value = (obj as any).colorVariant ?? '';
                    const aEl2 = document.getElementById(obj.type === 'festival_tent' ? 'm_tent_angle' : 'm_tent_broken_angle') as HTMLInputElement | null;
                    if (aEl2) aEl2.value = String((obj as any).angle ?? 0);
                }
                if (obj.type === 'festival_car') {
                    const cEl = document.getElementById('m_fcar_color') as HTMLSelectElement | null;
                    if (cEl) cEl.value = (obj as any).colorVariant ?? '';
                    const aEl2 = document.getElementById('m_fcar_angle') as HTMLInputElement | null;
                    if (aEl2) aEl2.value = ((obj as any).angle ?? 0).toString();
                }
            }
        }

        ctx.shadowBlur = 0;

        if (isSel) {
            renderEventsPanel(idx);
            _showObjPanel('ui_events');
        }

        // Object type label (only when reasonably zoomed in)
        if (hw > 10) {
            ctx.fillStyle = isSel ? '#fff' : 'rgba(255,255,255,0.65)';
            ctx.font      = `${Math.max(8, hw * 0.7)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(obj.type, cx, cy - Math.max(6, hw * 0.9));
            ctx.textAlign = 'left';
        }
    });

    // ── Payloads ──────────────────────────────────────────────────────────────
    const payloads = m.payloads || [];
    payloads.forEach((p, idx) => {
        const { sx: px, sy: py } = { sx: toSX(p.x + 0.5, p.y + 0.5), sy: toSY(p.x + 0.5, p.y + 0.5) };
        const r = Math.max(4, hw * 0.6);
        const isAtt = !!(p as any).attachTo;
        const isSel = state.selectedPayloadIdx === idx;

        if (isSel) { ctx.shadowBlur = 10; ctx.shadowColor = '#fff'; }

        if (p.type === 'person' || p.type === 'rescuer') {
            drawPerson(p.x + 0.5, p.y + 0.5, wl, 0, true, defCamX, defCamY,
                p.type === 'rescuer' ? 'rescuer' : undefined, (p as any).outfitColors);
            // selection ring
            if (isSel) {
                ctx.beginPath();
                ctx.ellipse(px, py, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            }
        } else if (p.type === 'crate') {
            const cp = defIso(p.x + 0.5, p.y + 0.5, wl, defCamX, defCamY);
            const cs = defTW * 0.22;
            ctx.fillStyle = isAtt ? '#44ccff' : '#d84';
            ctx.strokeStyle = '#530';
            ctx.lineWidth = Math.max(0.5, defTW / 64);
            ctx.fillRect(cp.x - cs / 2, cp.y - cs, cs, cs);
            ctx.strokeRect(cp.x - cs / 2, cp.y - cs, cs, cs);
            if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cp.x - cs / 2, cp.y - cs, cs, cs); }
        } else {
            // reindeer and other types — colored ellipse
            const ellColors: Record<string, [string, string]> = {
                reindeer: [isAtt ? '#eebb88' : '#cc8844', '#aa6622'],
            };
            const [fill, stroke] = ellColors[p.type] || ['#aaa', '#888'];
            ctx.beginPath();
            ctx.ellipse(px, py, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = fill; ctx.fill();
            ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
        }

        if (!(p as any).npcTarget) {
            ctx.fillStyle = '#fff';
            ctx.font      = `bold ${Math.max(7, hw * 0.5)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(String(idx + 1), px, py + r * 1.3);
            ctx.textAlign = 'left';
        }
        ctx.shadowBlur = 0;
    });

    // ── Particle Emitters ─────────────────────────────────────────────────────
    ((m as any).particleEmitters || []).forEach((e: any) => {
        const ex = toSX(e.x + 0.5, e.y + 0.5);
        const ey = toSY(e.x + 0.5, e.y + 0.5);
        const r  = Math.max(4, hw * 0.45);
        const isFire = e.type === 'fire';

        // Radius ring for fire emitters
        if (isFire && (e.radius ?? 0) > 0) {
            const fireR = (e.radius as number) * hw;
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.ellipse(ex, ey, fireR, fireR * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = isFire ? '#ff6600' : '#888';
        ctx.beginPath();
        ctx.ellipse(ex, ey, r * 1.8, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle   = isFire ? '#ff4400' : '#666';
        ctx.beginPath();
        ctx.ellipse(ex, ey, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font      = `${Math.max(8, hw * 0.6)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(isFire ? '🔥' : '💨', ex, ey);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    });

    // ── Wind compass (top-right, inset from edge) ─────────────────────────────
    _drawWindCompass(ctx, m, W - 60, 50);

    // ── Minimap (bottom-right) ────────────────────────────────────────────────
    _drawMinimap(ctx, m, canvas, ox, oy, hw, hh);
};

// ── Dolphin spawn indicator ───────────────────────────────────────────────────
const _drawDolphin = (
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    _angleDeg: number,
    hw: number, hh: number,
): void => {
    const s = Math.max(4, hw * 1.2);
    ctx.save();
    ctx.translate(cx, cy - hh * 1.8);  // float above spawn point

    // Rotor disk (semi-transparent)
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.4, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,200,50,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,50,0.5)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Fuselage
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f90';
    ctx.fill();

    // Tail boom
    ctx.fillStyle = '#e80';
    ctx.fillRect(-s * 0.5, -s * 0.08, s * 0.45, s * 0.16);

    ctx.restore();

    // Connecting line from marker to spawn point
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,160,0,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 1.2);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);
};

// ── Wind compass ──────────────────────────────────────────────────────────────
const _drawWindCompass = (
    ctx: CanvasRenderingContext2D,
    m: ReturnType<typeof getCurrentMission>,
    x: number, y: number,
): void => {
    if (!m) return;
    const dirRad  = (m.windDir * Math.PI) / 180;
    const isSelWind = state.selectedUI === 'wind';
    if (isSelWind) {
        ctx.shadowBlur  = 10;
        ctx.shadowColor = COLORS.windActive ?? '#4fc';
        if (document.getElementById('ui_wind'))
            _showObjPanel('ui_wind');
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelWind ? (COLORS.windActive ?? '#4fc') : COLORS.padStroke;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    if (m.windStr > 0) {
        const str01   = Math.min(m.windStr, 10) / 10;
        const arrowL  = 8 + Math.sqrt(str01) * 14;
        const tipX    = x + Math.cos(dirRad) * arrowL;
        const tipY    = y + Math.sin(dirRad) * arrowL;
        ctx.lineWidth = 1.5 + str01 * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        const hl = 5, spread = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(dirRad - spread) * hl, tipY - Math.sin(dirRad - spread) * hl);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(dirRad + spread) * hl, tipY - Math.sin(dirRad + spread) * hl);
        ctx.stroke();
        ctx.fillStyle = isSelWind ? (COLORS.windActive ?? '#4fc') : COLORS.padStroke;
        ctx.font      = 'bold 9px monospace';
        ctx.fillText(`${m.windStr.toFixed(1)}`, x - 22, y + 38);
    }
};

// ── Minimap ───────────────────────────────────────────────────────────────────
const _drawMinimap = (
    ctx: CanvasRenderingContext2D,
    m: ReturnType<typeof getCurrentMission>,
    canvas: HTMLCanvasElement,
    ox: number, oy: number,
    hw: number, hh: number,
): void => {
    if (!m) return;
    const MW = 160, MH = 100;
    const MX = canvas.width - MW - 8;
    const MY = canvas.height - MH - 8;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(MX - 1, MY - 1, MW + 2, MH + 2);

    const gs = m.gridSize;
    const ts = Math.min(MW / gs, MH / gs);
    const wl = (m as any).waterLevel ?? 0;

    // Terrain (simplified 2D top-down)
    for (let gx = 0; gx < gs; gx++) {
        for (let gy = 0; gy < gs; gy++) {
            if (m.terrain[gx]?.[gy] === undefined) continue;
            const h = m.terrain[gx]?.[gy];
            if (h === undefined) continue;
            const _mc = 35 + Math.floor(h * 15);
            ctx.fillStyle = h <= wl ? '#1a5f9e' : `rgb(${_mc-10},${_mc+30},${_mc-10})`;
            ctx.fillRect(MX + gx * ts, MY + gy * ts, ts + 0.5, ts + 0.5);
        }
    }

    // Objects
    m.objects.forEach(o => {
        const mx = MX + (o.x + 0.5) * ts, my = MY + (o.y + 0.5) * ts;
        ctx.fillStyle = o.type === 'pad' ? COLORS.padFill :
                        o.type === 'carrier' ? COLORS.carrierBase : '#4af';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
    });

    // Viewport indicator
    // Convert canvas corners to grid, then to minimap coords
    const W = canvas.width, H = canvas.height;
    const corners = [[0,0],[W,0],[W,H],[0,H]].map(([sx,sy]) => {
        const dx = sx - ox, dy = sy - oy;
        return {
            mx: MX + ((dx/hw + dy/hh)/2) * ts,
            my: MY + ((dy/hh - dx/hw)/2) * ts,
        };
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].mx, corners[0].my);
    corners.forEach(c => ctx.lineTo(c.mx, c.my));
    ctx.closePath();
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(MX, MY, MW, MH);
};

export const minimapHitToGrid = (sx: number, sy: number, gs: number): { gx: number; gy: number } | null => {
    const c = _canvas();
    const MW = 160, MH = 100;
    const MX = c.width - MW - 8;
    const MY = c.height - MH - 8;
    if (sx < MX || sx > MX + MW || sy < MY || sy > MY + MH) return null;
    const ts = Math.min(MW / gs, MH / gs);
    return { gx: (sx - MX) / ts, gy: (sy - MY) / ts };
};
