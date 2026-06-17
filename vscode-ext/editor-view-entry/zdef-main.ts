export {};
declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

import type { DEF, DEFFace, DEFCollisionBox, DEFPart } from '../../src/game/defs';
import { createSceneRenderer } from '../../src/game/scene-renderer';
import { applyParts, getTransformedPivots } from '../../src/game/def-utils';

import HANGAR_RAW from '../../src/game/models/hangar.zdef';
import LIGHTHOUSE_RAW from '../../src/game/models/lighthouse.zdef';
import SAILBOAT_RAW from '../../src/game/models/sailboat.zdef';
import COASTHAWK_RAW from '../../src/game/models/coasthawk.zdef';
import DOLPHIN_RAW from '../../src/game/models/dolphin.zdef';
import ATLAS_RAW from '../../src/game/models/atlas.zdef';
import GLIDER_RAW from '../../src/game/models/glider.zdef';
import SUBMARINE_RAW from '../../src/game/models/submarine.zdef';
import CARRIER_RAW from '../../src/game/models/carrier.zdef';
import ORNITHOPTER_RAW from '../../src/game/models/ornithopter.zdef';
import CARRIER_HULL_RAW from '../../src/game/models/carrier_hull.zdef';
import CARRIER_TOWER_RAW from '../../src/game/models/carrier_tower.zdef';
import FUEL_TRUCK_CHASSIS_RAW from '../../src/game/models/fuel_truck_chassis.zdef';
import FUEL_TRUCK_TANK_RAW from '../../src/game/models/fuel_truck_tank.zdef';
import FUEL_TRUCK_CAB_RAW from '../../src/game/models/fuel_truck_cab.zdef';
import CARRIER_CAR_RAW from '../../src/game/models/carrier_car.zdef';
import CARRIER_DECK_TRACTOR_RAW from '../../src/game/models/carrier_deck_tractor.zdef';

interface RescueZone { x: number; y: number; w: number; h: number; z?: number; role: string; }
interface LandingZone { x: number; y: number; w: number; h: number; z: number; }
interface DEFModel extends DEF { rescueZones?: RescueZone[]; landingZone?: LandingZone; }
interface ZdefMeta { label: string; isStatic: boolean; movementType: string; }
interface Grid { visible: boolean; x: number; y: number; z: number; selected: boolean; }
interface Quad { angle: number; defaultAngle: number; cam: { x: number; y: number }; zoom: number; }

let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let scheduleNotify: () => void = () => {};

const TW = 64, TH = 32, SH = 25;

const toDefCast = (raw: unknown): DEFModel => raw as unknown as DEFModel;
const PRESETS: Record<string, { def: DEFModel; label: string; isStatic: boolean; movementType: string }> = {
    hangar:               { def: toDefCast(HANGAR_RAW),           label: 'Hangar',               isStatic: true,  movementType: 'none' },
    lighthouse:           { def: toDefCast(LIGHTHOUSE_RAW),       label: 'Lighthouse',           isStatic: true,  movementType: 'none' },
    sailboat:             { def: toDefCast(SAILBOAT_RAW),         label: 'Sailboat',             isStatic: false, movementType: 'ship' },
    coasthawk:            { def: toDefCast(COASTHAWK_RAW),        label: 'Coast-Hawk',           isStatic: false, movementType: 'heli' },
    dolphin:              { def: toDefCast(DOLPHIN_RAW),          label: 'Dolphin',              isStatic: false, movementType: 'heli' },
    atlas:                { def: toDefCast(ATLAS_RAW),            label: 'Atlas',                isStatic: false, movementType: 'heli' },
    ornithopter:          { def: toDefCast(ORNITHOPTER_RAW),      label: 'Ornithopter',          isStatic: false, movementType: 'heli' },
    glider:               { def: toDefCast(GLIDER_RAW),           label: 'Glider (ASK-21)',      isStatic: false, movementType: 'plane' },
    submarine:            { def: toDefCast(SUBMARINE_RAW),        label: 'Submarine',            isStatic: false, movementType: 'ship' },
    carrier:              { def: toDefCast(CARRIER_RAW),          label: 'Carrier (komplett)',   isStatic: false, movementType: 'ship' },
    carrier_hull:         { def: toDefCast(CARRIER_HULL_RAW),     label: 'Carrier Hull',         isStatic: false, movementType: 'ship' },
    carrier_tower:        { def: toDefCast(CARRIER_TOWER_RAW),    label: 'Carrier Tower',        isStatic: false, movementType: 'ship' },
    fuel_truck_chassis:   { def: toDefCast(FUEL_TRUCK_CHASSIS_RAW), label: 'Fuel Truck (Chassis)', isStatic: true, movementType: 'none' },
    fuel_truck_tank:      { def: toDefCast(FUEL_TRUCK_TANK_RAW),  label: 'Fuel Truck (Tank)',    isStatic: true,  movementType: 'none' },
    fuel_truck_cab:       { def: toDefCast(FUEL_TRUCK_CAB_RAW),   label: 'Fuel Truck (Cab)',     isStatic: true,  movementType: 'none' },
    carrier_car:          { def: toDefCast(CARRIER_CAR_RAW),      label: 'Carrier Car',          isStatic: false, movementType: 'auto' },
    carrier_deck_tractor: { def: toDefCast(CARRIER_DECK_TRACTOR_RAW), label: 'Carrier Deck Tractor', isStatic: false, movementType: 'auto' },
};

const state: {
    def: DEFModel | null;
    meta: ZdefMeta;
    selectedFaceIdx: number;
    selectedVertIdx: number;
    activePart: string | null;
    partTestAngles: Record<string, number>;
    dirty: boolean;
    filename: string | null;
} = {
    def: null,
    meta: { label: '', isStatic: true, movementType: 'none' },
    selectedFaceIdx: -1,
    selectedVertIdx: -1,
    activePart: null,
    partTestAngles: {},
    dirty: false,
    filename: null,
};

const buildTestParams = (): Record<string, number> => {
    const p: Record<string, number> = {};
    for (const part of state.def?.parts ?? []) {
        if (part.rotate && state.partTestAngles[part.id] !== undefined)
            p[part.rotate.param] = state.partTestAngles[part.id];
    }
    return p;
};

const mkGrid = (): Grid => ({ visible: true, x: 0, y: 0, z: 0, selected: false });
const grids: Grid[] = [mkGrid(), mkGrid(), mkGrid(), mkGrid()];
const gridVs: Grid[] = [mkGrid(), mkGrid(), mkGrid(), mkGrid()];

const getActiveFaces = (): DEFFace[] => {
    if (!state.def) return [];
    if (state.activePart) {
        const part = state.def.parts?.find(p => p.id === state.activePart);
        return part?.faces ?? [];
    }
    return state.def.faces;
};

const PIVOT_COLORS = ['#ff6644', '#44bbff', '#44ff88', '#ffaa44', '#cc44ff'];
const DEG = Math.PI / 180;
const QUAD_DEFAULT_ANGLES = [225, 315, 135, 45];
const GAME_VIEW_Q = 3;
const quads: Quad[] = QUAD_DEFAULT_ANGLES.map((a, i) => ({
    angle: i === GAME_VIEW_Q ? 0 : a * DEG,
    defaultAngle: i === GAME_VIEW_Q ? 0 : a * DEG,
    cam: { x: 0, y: 0 },
    zoom: 3.0,
}));
let activeQ = 0, lockedQ = 0;
let renderCx = 0, renderCy = 0, renderZoom = 3.0, renderViewAngle = 225 * DEG;
let renderCam = quads[0].cam;

const area = document.getElementById('canvas-area') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const positionResetButtons = (): void => {
    const qw = area.clientWidth / 2, qh = area.clientHeight / 2;
    document.querySelectorAll<HTMLButtonElement>('.quad-reset').forEach((btn, q) => {
        btn.style.display = q === GAME_VIEW_Q ? 'none' : '';
        btn.style.top = Math.floor(q / 2) * qh + 4 + 'px';
        btn.style.left = (q % 2) * qw + qw - 24 + 'px';
    });
    document.querySelectorAll<HTMLButtonElement>('.quad-grid-toggle').forEach((btn, q) => {
        btn.style.display = q === GAME_VIEW_Q ? 'none' : '';
        btn.style.top = Math.floor(q / 2) * qh + 4 + 'px';
        btn.style.left = (q % 2) * qw + qw - 48 + 'px';
    });
};
const resize = (): void => {
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
    positionResetButtons();
    draw();
};
new ResizeObserver(resize).observe(area);

const iso = (wx: number, wy: number, wz: number, camX: number, camY: number, out?: { x: number; y: number }): { x: number; y: number } => {
    const x = renderCx + (wx - wy) * ((TW * renderZoom) / 2) - camX;
    const y = renderCy + (wx + wy) * ((TH * renderZoom) / 2) - wz * SH * renderZoom - camY;
    if (out) { out.x = x; out.y = y; return out; }
    return { x, y };
};

const SceneRenderer = createSceneRenderer(ctx, iso);

const localToScreen = (lx: number, ly: number, lz: number): { x: number; y: number } => {
    const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
    return iso(lx * cosA - ly * sinA, lx * sinA + ly * cosA, lz, renderCam.x, renderCam.y);
};

const drawGrid = (g: Grid): void => {
    if (!g.visible) return;
    const H = 8, STEP = 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = g.selected ? 'rgba(100,180,255,0.45)' : 'rgba(100,140,180,0.22)';
    for (let yi = -H; yi <= H; yi += STEP) {
        const p0 = localToScreen(g.x - H, g.y + yi, g.z), p1 = localToScreen(g.x + H, g.y + yi, g.z);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    for (let xi = -H; xi <= H; xi += STEP) {
        const p0 = localToScreen(g.x + xi, g.y - H, g.z), p1 = localToScreen(g.x + xi, g.y + H, g.z);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.strokeStyle = g.selected ? 'rgba(120,200,255,0.75)' : 'rgba(160,190,230,0.40)';
    ctx.lineWidth = 1.5;
    const ax0 = localToScreen(g.x - H, g.y, g.z), ax1 = localToScreen(g.x + H, g.y, g.z);
    ctx.beginPath(); ctx.moveTo(ax0.x, ax0.y); ctx.lineTo(ax1.x, ax1.y); ctx.stroke();
    const ay0 = localToScreen(g.x, g.y - H, g.z), ay1 = localToScreen(g.x, g.y + H, g.z);
    ctx.beginPath(); ctx.moveTo(ay0.x, ay0.y); ctx.lineTo(ay1.x, ay1.y); ctx.stroke();
    ctx.restore();
};

const drawGridV = (gv: Grid): void => {
    if (!gv.visible) return;
    const H = 8, STEP = 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = gv.selected ? 'rgba(255,160,100,0.45)' : 'rgba(180,140,100,0.22)';
    for (let zi = -H; zi <= H; zi += STEP) {
        const p0 = localToScreen(gv.x - H, gv.y, gv.z + zi), p1 = localToScreen(gv.x + H, gv.y, gv.z + zi);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    for (let xi = -H; xi <= H; xi += STEP) {
        const p0 = localToScreen(gv.x + xi, gv.y, gv.z - H), p1 = localToScreen(gv.x + xi, gv.y, gv.z + H);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.strokeStyle = gv.selected ? 'rgba(255,180,120,0.75)' : 'rgba(220,180,140,0.40)';
    ctx.lineWidth = 1.5;
    const ax0 = localToScreen(gv.x - H, gv.y, gv.z), ax1 = localToScreen(gv.x + H, gv.y, gv.z);
    ctx.beginPath(); ctx.moveTo(ax0.x, ax0.y); ctx.lineTo(ax1.x, ax1.y); ctx.stroke();
    const az0 = localToScreen(gv.x, gv.y, gv.z - H), az1 = localToScreen(gv.x, gv.y, gv.z + H);
    ctx.beginPath(); ctx.moveTo(az0.x, az0.y); ctx.lineTo(az1.x, az1.y); ctx.stroke();
    ctx.restore();
};

const drawDirectionArrow = (): void => {
    const z = 1.8;
    const shaft = localToScreen(0, 0, z), tip = localToScreen(3.0, 0, z);
    const w0 = localToScreen(2.4, 0.3, z), w1 = localToScreen(2.4, -0.3, z);
    ctx.strokeStyle = 'rgba(0,220,255,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shaft.x, shaft.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.fillStyle = 'rgba(0,220,255,0.85)';
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(w0.x, w0.y); ctx.lineTo(w1.x, w1.y);
    ctx.closePath(); ctx.fill();
};

const drawPivotCircles = (params: Record<string, number>): void => {
    if (!state.def?.parts) return;
    const pivots = getTransformedPivots(state.def, params);
    let colorIdx = 0;
    for (const part of state.def.parts) {
        if (!part.rotate) continue;
        const color = PIVOT_COLORS[colorIdx++ % PIVOT_COLORS.length];
        const pivot = pivots.get(part.id) ?? part.rotate.pivot;
        const [px, py, pz] = pivot;
        const pt = localToScreen(px, py, pz);
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
};

const hitTestPivot = (mx: number, my: number, params: Record<string, number> = {}): string | null => {
    if (!state.def?.parts) return null;
    const pivots = getTransformedPivots(state.def, params);
    for (const part of state.def.parts) {
        if (!part.rotate) continue;
        const pivot = pivots.get(part.id) ?? part.rotate.pivot;
        const [px, py, pz] = pivot;
        const pt = localToScreen(px, py, pz);
        if (Math.hypot(mx - pt.x, my - pt.y) < 9) return part.id;
    }
    return null;
};

const draw = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const qw = canvas.width / 2, qh = canvas.height / 2;
    const showCboxes = (document.getElementById('show-cboxes') as HTMLInputElement).checked;

    for (let q = 0; q < 4; q++) {
        setRenderContext(q);
        const col = q % 2, row = Math.floor(q / 2);
        const ox = col * qw, oy = row * qh;
        const g = grids[q], gv = gridVs[q];

        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, qw, qh);
        ctx.clip();

        if (state.def) {
            const activeFaces = getActiveFaces();
            const colors: Record<string, string> = {};
            if (state.activePart) {
                const ap = state.def.parts?.find(p => p.id === state.activePart);
                if (ap) ap.faces.forEach(f => { colors[f.id] = '#2d5c88'; });
            }
            if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
                colors[activeFaces[state.selectedFaceIdx].id] = '#ffdd44';
            }

            const testParams = buildTestParams();
            const renderedDef = applyParts(state.def, testParams);
            SceneRenderer.debugCollision = showCboxes;
            SceneRenderer.add(renderedDef, { x: 0, y: 0, angle: renderViewAngle, colors });
            SceneRenderer.flush(renderCam.x, renderCam.y);

            if (state.selectedFaceIdx >= 0) {
                const face = activeFaces[state.selectedFaceIdx];
                if (face && face.verts.length >= 2) {
                    const pts = face.verts.map(v => localToScreen(v[0], v[1], v[2]));
                    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.closePath();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                }
            }

            if (!state.meta.isStatic) drawDirectionArrow();

            if (state.selectedFaceIdx >= 0) {
                const face = activeFaces[state.selectedFaceIdx];
                if (face) {
                    face.verts.forEach((v, i) => {
                        const pt = localToScreen(v[0], v[1], v[2]);
                        const sel = i === state.selectedVertIdx;
                        ctx.beginPath(); ctx.arc(pt.x, pt.y, sel ? 5 : 3.5, 0, Math.PI * 2);
                        ctx.fillStyle = sel ? '#ff4444' : '#ffee00'; ctx.fill();
                        ctx.strokeStyle = sel ? '#fff' : '#888'; ctx.lineWidth = 1; ctx.stroke();
                    });
                }
            }

            drawPivotCircles(testParams);

            if (state.def?.rescueZones?.length) {
                const zoneColors: Record<string, string> = {
                    pickup: 'rgba(80,220,80,', dropoff: 'rgba(80,140,255,', both: 'rgba(255,180,60,',
                };
                for (const z of state.def.rescueZones!) {
                    const zz = z.z ?? 0;
                    const c = zoneColors[z.role] || zoneColors['both'];
                    const pts = [
                        localToScreen(z.x - z.w, z.y - z.h, zz), localToScreen(z.x + z.w, z.y - z.h, zz),
                        localToScreen(z.x + z.w, z.y + z.h, zz), localToScreen(z.x - z.w, z.y + z.h, zz),
                    ];
                    ctx.save();
                    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.closePath();
                    ctx.fillStyle = c + '0.18)'; ctx.fill();
                    ctx.strokeStyle = c + '0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke();
                    ctx.restore();
                }
            }

            if (state.def?.landingZone) {
                const lz = state.def.landingZone;
                const pts = [
                    localToScreen(lz.x - lz.w, lz.y - lz.h, lz.z), localToScreen(lz.x + lz.w, lz.y - lz.h, lz.z),
                    localToScreen(lz.x + lz.w, lz.y + lz.h, lz.z), localToScreen(lz.x - lz.w, lz.y + lz.h, lz.z),
                ];
                ctx.save();
                ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255,80,80,0.15)'; ctx.fill();
                ctx.strokeStyle = 'rgba(255,80,80,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke();
                ctx.restore();
            }

            if (gridDrag.active && gridDrag.snapFaceIdx >= 0) {
                const allFaces = [...state.def.faces];
                if (state.def.parts) state.def.parts.forEach(p => allFaces.push(...p.faces));
                const snapFace = allFaces[gridDrag.snapFaceIdx];
                if (snapFace) {
                    const sv = snapFace.verts[gridDrag.snapVertIdx];
                    const spt = localToScreen(sv[0], sv[1], sv[2]);
                    ctx.beginPath(); ctx.arc(spt.x, spt.y, 8, 0, Math.PI * 2);
                    ctx.strokeStyle = '#ffee00'; ctx.lineWidth = 2; ctx.stroke();
                }
            }
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText('Kein Modell', ox + qw / 2, oy + qh / 2);
        }

        drawGrid(g); drawGridV(gv);

        const isGameView = q === GAME_VIEW_Q;
        const activeColor = isGameView ? 'rgba(255,190,60,0.7)' : 'rgba(100,180,255,0.55)';
        ctx.strokeStyle = q === activeQ ? activeColor : (isGameView ? 'rgba(255,180,50,0.2)' : 'rgba(255,255,255,0.07)');
        ctx.lineWidth = q === activeQ ? 2 : 1;
        ctx.strokeRect(ox + 0.5, oy + 0.5, qw - 1, qh - 1);
        ctx.fillStyle = q === activeQ ? (isGameView ? 'rgba(255,200,80,0.9)' : 'rgba(140,200,255,0.8)') : (isGameView ? 'rgba(255,180,50,0.4)' : 'rgba(255,255,255,0.2)');
        ctx.font = '10px monospace'; ctx.textAlign = 'left';
        if (isGameView) {
            ctx.fillText('SPIEL', ox + 6, oy + 14);
        } else {
            const deg = ((Math.round((quads[q].angle * 180) / Math.PI) % 360) + 360) % 360;
            ctx.fillText(`${deg}°`, ox + 6, oy + 14);
        }
        ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qw, 0); ctx.lineTo(qw, canvas.height);
    ctx.moveTo(0, qh); ctx.lineTo(canvas.width, qh);
    ctx.stroke();
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
const renderPartsList = (): void => {
    const sec = document.getElementById('parts-sec') as HTMLElement;
    const list = document.getElementById('parts-list')!;
    if (!state.def?.parts?.length) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    let colorIdx = 0;
    const allPartIds = state.def.parts.map(p => p.id);
    list.innerHTML = state.def.parts.map(part => {
        const isRotating = !!part.rotate;
        const color = isRotating ? PIVOT_COLORS[colorIdx++ % PIVOT_COLORS.length] : 'var(--dim)';
        const angle = state.partTestAngles[part.id] ?? 0;
        const sliderRow = isRotating ? `
      <div class="part-slider-row">
        <input type="range" min="-3.14" max="3.14" step="0.02" value="${angle}" data-pid="${part.id}">
        <span class="part-slider-val" id="pval-${part.id}">${((angle * 180) / Math.PI).toFixed(0)}°</span>
      </div>` : '';
        const parentOptions = allPartIds
            .filter(id => id !== part.id)
            .map(id => `<option value="${id}" ${part.parent === id ? 'selected' : ''}>${id}</option>`)
            .join('');
        const parentRow = `
      <div class="part-parent-row">
        <span>parent</span>
        <select data-pid="${part.id}" class="part-parent-select">
          <option value="" ${!part.parent ? 'selected' : ''}>—</option>
          ${parentOptions}
        </select>
      </div>`;
        return `
      <div class="part-item ${state.activePart === part.id ? 'active' : ''}" data-pid="${part.id}">
        <div class="part-header">
          <div class="part-dot" style="background:${color}"></div>
          <div class="part-name">${part.id}</div>
          <div class="part-info">${part.faces.length}f</div>
          ${isRotating ? '<div class="part-rotate-badge">↺</div>' : ''}
        </div>${sliderRow}${parentRow}
      </div>`;
    }).join('');

    list.querySelectorAll<HTMLElement>('.part-header').forEach(el => {
        el.addEventListener('click', () => {
            const pid = (el.parentElement as HTMLElement).dataset['pid'] ?? null;
            state.activePart = state.activePart === pid ? null : pid;
            if (state.activePart !== null) { state.selectedFaceIdx = -1; state.selectedVertIdx = -1; }
            renderPartsList(); renderFaceList(); renderFaceEditor(); draw();
        });
    });
    list.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(slider => {
        slider.addEventListener('input', e => {
            const pid = (e.target as HTMLInputElement).dataset['pid']!;
            const val = parseFloat((e.target as HTMLInputElement).value);
            state.partTestAngles[pid] = val;
            const valEl = document.getElementById(`pval-${pid}`);
            if (valEl) valEl.textContent = ((val * 180) / Math.PI).toFixed(0) + '°';
            draw();
        });
        slider.addEventListener('click', e => e.stopPropagation());
    });
    list.querySelectorAll<HTMLSelectElement>('select.part-parent-select').forEach(sel => {
        sel.addEventListener('change', e => {
            const pid = (e.target as HTMLSelectElement).dataset['pid'];
            const val = (e.target as HTMLSelectElement).value;
            const part = state.def!.parts?.find(p => p.id === pid);
            if (!part) return;
            if (val) { (part as DEFPart & { parent?: string }).parent = val; } else { delete (part as DEFPart & { parent?: string }).parent; }
            markDirty(); draw();
        });
        sel.addEventListener('click', e => e.stopPropagation());
    });
};

const renderFaceList = (): void => {
    const list = document.getElementById('face-list')!;
    const count = document.getElementById('face-count')!;
    const faces = getActiveFaces();
    if (!state.def || !faces.length) {
        list.innerHTML = state.def ? '<div class="empty">Part wählen oder Fläche hinzufügen</div>' : '<div class="empty">Kein Modell geladen</div>';
        count.textContent = ''; return;
    }
    count.textContent = `(${faces.length})`;
    list.innerHTML = faces.map((f, i) => `
    <div class="face-item ${i === state.selectedFaceIdx ? 'active' : ''}" data-i="${i}">
      <div class="face-swatch" style="background:${f.color}"></div>
      <div class="face-id" title="${f.id}">${f.id}</div>
    </div>`).join('');
    list.querySelectorAll<HTMLElement>('.face-item').forEach(el => {
        el.addEventListener('click', () => selectFace(parseInt(el.dataset['i'] ?? '0')));
    });
};

const renderFaceEditor = (): void => {
    const sec = document.getElementById('face-editor') as HTMLElement;
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !state.def || !faces.length) { sec.style.display = 'none'; return; }
    const face = faces[state.selectedFaceIdx];
    if (!face) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    (document.getElementById('face-id-input') as HTMLInputElement).value = face.id;
    (document.getElementById('face-color') as HTMLInputElement).value = toColorInput(face.color);
    (document.getElementById('face-color-hex') as HTMLInputElement).value = face.color;
    const hasStroke = !!face.stroke;
    (document.getElementById('face-has-stroke') as HTMLInputElement).checked = hasStroke;
    (document.getElementById('face-stroke') as HTMLInputElement).value = toColorInput(face.stroke || '#aaaaaa');
    (document.getElementById('face-stroke-hex') as HTMLInputElement).value = face.stroke || '#aaaaaa';
    (document.getElementById('face-stroke-w') as HTMLInputElement).value = String(face.strokeWidth ?? 1);
    const hasNormal = Array.isArray(face.normal);
    (document.getElementById('face-has-normal') as HTMLInputElement).checked = hasNormal;
    (document.getElementById('face-nx') as HTMLInputElement).value = String(hasNormal ? face.normal![0] : 0);
    (document.getElementById('face-ny') as HTMLInputElement).value = String(hasNormal ? face.normal![1] : 0);
    renderVertList(face);
};

const renderVertList = (face: DEFFace): void => {
    const list = document.getElementById('vert-list')!;
    list.innerHTML = face.verts.map((v, i) => `
    <div class="vert-row ${i === state.selectedVertIdx ? 'selected' : ''}" data-i="${i}">
      <span class="vi">V${i}</span>
      <input type="number" class="vx" step="0.01" value="${v[0].toFixed(3)}" style="width:52px">
      <input type="number" class="vy" step="0.01" value="${v[1].toFixed(3)}" style="width:52px">
      <input type="number" class="vz" step="0.01" value="${v[2].toFixed(3)}" style="width:52px">
    </div>`).join('');
    list.querySelectorAll<HTMLElement>('.vert-row').forEach(row => {
        const i = parseInt(row.dataset['i'] ?? '0');
        row.addEventListener('click', () => { state.selectedVertIdx = i; renderFaceEditor(); draw(); });
        (row.querySelector('.vx') as HTMLInputElement).addEventListener('input', e => {
            face.verts[i][0] = parseFloat((e.target as HTMLInputElement).value) || 0; markDirty(); draw();
        });
        (row.querySelector('.vy') as HTMLInputElement).addEventListener('input', e => {
            face.verts[i][1] = parseFloat((e.target as HTMLInputElement).value) || 0; markDirty(); draw();
        });
        (row.querySelector('.vz') as HTMLInputElement).addEventListener('input', e => {
            face.verts[i][2] = parseFloat((e.target as HTMLInputElement).value) || 0; markDirty(); draw();
        });
    });
};

const renderCboxList = (): void => {
    const list = document.getElementById('cbox-list')!;
    const boxes = state.def?.collisionBoxes;
    if (!boxes?.length) { list.innerHTML = '<div class="empty">–</div>'; return; }
    list.innerHTML = boxes.map((cb, i) => `
    <div class="cbox-block">
      <div class="row">
        <input type="text" class="cbi-id" data-i="${i}" value="${cb.id}" style="flex:1;font-size:10px">
        <button class="btn btn-sm btn-danger cbox-del" data-i="${i}">✕</button>
      </div>
      <div class="cbox-grid">
        <label>xMin/Max</label>
        <input type="number" step="0.1" value="${cb.xMin}" class="cbi" data-i="${i}" data-f="xMin">
        <input type="number" step="0.1" value="${cb.xMax}" class="cbi" data-i="${i}" data-f="xMax">
        <label>yMin/Max</label>
        <input type="number" step="0.1" value="${cb.yMin}" class="cbi" data-i="${i}" data-f="yMin">
        <input type="number" step="0.1" value="${cb.yMax}" class="cbi" data-i="${i}" data-f="yMax">
        <label>zMin/Max</label>
        <input type="number" step="0.1" value="${cb.zMin}" class="cbi" data-i="${i}" data-f="zMin">
        <input type="number" step="0.1" value="${cb.zMax}" class="cbi" data-i="${i}" data-f="zMax">
      </div>
    </div>`).join('');
    list.querySelectorAll<HTMLInputElement>('.cbi').forEach(inp => {
        inp.addEventListener('input', e => {
            const t = e.target as HTMLInputElement;
            (boxes[+t.dataset['i']!] as Record<string, unknown>)[t.dataset['f']!] = parseFloat(t.value) || 0;
            markDirty(); draw();
        });
    });
    list.querySelectorAll<HTMLInputElement>('.cbi-id').forEach(inp => {
        inp.addEventListener('input', e => {
            const t = e.target as HTMLInputElement;
            boxes[+t.dataset['i']!].id = t.value; markDirty();
        });
    });
    list.querySelectorAll<HTMLButtonElement>('.cbox-del').forEach(btn => {
        btn.addEventListener('click', () => {
            boxes.splice(+btn.dataset['i']!, 1); markDirty(); renderCboxList(); draw();
        });
    });
};

const renderZoneList = (): void => {
    const list = document.getElementById('zone-list')!;
    const zones = state.def?.rescueZones;
    if (!zones?.length) { list.innerHTML = '<div class="empty">–</div>'; return; }
    const roleLabel: Record<string, string> = { pickup: '⬆ Aufnehmen', dropoff: '⬇ Absetzen', both: '⇅ Beides' };
    list.innerHTML = zones.map((z, i) => `
    <div class="cbox-block">
      <div class="row">
        <select class="zone-role" data-i="${i}" style="flex:1;font-size:10px">
          ${['pickup', 'dropoff', 'both'].map(r => `<option value="${r}"${z.role === r ? ' selected' : ''}>${roleLabel[r]}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-danger zone-del" data-i="${i}">✕</button>
      </div>
      <div class="cbox-grid">
        <label>X</label>
        <input type="number" step="0.1" value="${z.x}" class="zi" data-i="${i}" data-f="x">
        <input type="number" step="0.1" value="${z.y}" class="zi" data-i="${i}" data-f="y">
        <label>W/H</label>
        <input type="number" step="0.1" value="${z.w}" class="zi" data-i="${i}" data-f="w">
        <input type="number" step="0.1" value="${z.h}" class="zi" data-i="${i}" data-f="h">
        <label>Z</label>
        <input type="number" step="0.05" value="${z.z ?? 0}" class="zi" data-i="${i}" data-f="z" style="grid-column:2">
      </div>
    </div>`).join('');
    list.querySelectorAll<HTMLInputElement>('.zi').forEach(inp => {
        inp.addEventListener('input', e => {
            const t = e.target as HTMLInputElement;
            (zones[+t.dataset['i']!] as Record<string, unknown>)[t.dataset['f']!] = parseFloat(t.value) || 0;
            markDirty(); draw();
        });
    });
    list.querySelectorAll<HTMLSelectElement>('.zone-role').forEach(sel => {
        sel.addEventListener('change', e => {
            zones[+(e.target as HTMLSelectElement).dataset['i']!].role = (e.target as HTMLSelectElement).value;
            markDirty(); draw();
        });
    });
    list.querySelectorAll<HTMLButtonElement>('.zone-del').forEach(btn => {
        btn.addEventListener('click', () => {
            zones.splice(+btn.dataset['i']!, 1); markDirty(); renderZoneList(); draw();
        });
    });
};

const renderLandingZone = (): void => {
    const panel = document.getElementById('landing-zone-panel')!;
    const btnAdd = document.getElementById('btn-add-landing') as HTMLButtonElement;
    const btnRemove = document.getElementById('btn-remove-landing') as HTMLButtonElement;
    const lz = (state.def as DEFModel | null)?.landingZone;
    if (!lz) {
        panel.innerHTML = '<div class="empty">–</div>';
        btnAdd.style.display = ''; btnRemove.style.display = 'none';
        return;
    }
    btnAdd.style.display = 'none'; btnRemove.style.display = '';
    panel.innerHTML = `
    <div class="cbox-block"><div class="cbox-grid">
      <label>X</label>
      <input type="number" step="0.1" value="${lz.x}" class="lzi" data-f="x">
      <input type="number" step="0.1" value="${lz.y}" class="lzi" data-f="y">
      <label>W/H</label>
      <input type="number" step="0.1" value="${lz.w}" class="lzi" data-f="w">
      <input type="number" step="0.1" value="${lz.h}" class="lzi" data-f="h">
      <label>Z</label>
      <input type="number" step="0.05" value="${lz.z}" class="lzi" data-f="z" style="grid-column:2">
    </div></div>`;
    panel.querySelectorAll<HTMLInputElement>('.lzi').forEach(inp => {
        inp.addEventListener('input', e => {
            const t = e.target as HTMLInputElement;
            (lz as unknown as Record<string, unknown>)[t.dataset['f']!] = parseFloat(t.value) || 0;
            markDirty(); draw();
        });
    });
};

const renderAll = (): void => {
    renderPartsList(); renderFaceList(); renderFaceEditor(); renderCboxList(); renderZoneList(); renderLandingZone(); draw();
};

const selectFace = (i: number): void => {
    state.selectedFaceIdx = i; state.selectedVertIdx = -1;
    renderFaceList(); renderFaceEditor(); draw();
};

const loadPreset = (key: string): void => {
    const p = PRESETS[key];
    if (!p) return;
    state.def = JSON.parse(JSON.stringify(p.def)) as DEFModel;
    state.meta = { label: p.label, isStatic: p.isStatic, movementType: p.movementType };
    state.selectedFaceIdx = -1; state.selectedVertIdx = -1; state.activePart = null;
    state.partTestAngles = {}; state.dirty = false; state.filename = null;
    syncMetaToUI(); renderAll();
};

const syncMetaToUI = (): void => {
    (document.getElementById('meta-id') as HTMLInputElement).value = state.def ? state.def.id : '';
    (document.getElementById('meta-label') as HTMLInputElement).value = state.meta.label;
    (document.getElementById('r-static') as HTMLInputElement).checked = state.meta.isStatic;
    (document.getElementById('r-moving') as HTMLInputElement).checked = !state.meta.isStatic;
    (document.getElementById('move-type') as HTMLSelectElement).value = state.meta.movementType;
    (document.getElementById('move-type-row') as HTMLElement).style.opacity = state.meta.isStatic ? '0.4' : '1';
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const toColorInput = (c: string | null | undefined): string => {
    if (!c) return '#888888';
    if (c.startsWith('rgba')) {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
};
const markDirty = (): void => { state.dirty = true; scheduleNotify(); };
const getQuadrant = (mx: number, my: number): number =>
    (mx < canvas.width / 2 ? 0 : 1) + (my < canvas.height / 2 ? 0 : 2);
const setRenderContext = (q: number): void => {
    const qw = canvas.width / 2, qh = canvas.height / 2;
    renderCx = (q % 2) * qw + qw / 2;
    renderCy = Math.floor(q / 2) * qh + qh / 2;
    renderZoom = quads[q].zoom;
    renderViewAngle = quads[q].angle;
    renderCam = quads[q].cam;
};
const hitTestGrid = (mx: number, my: number, g: Grid): boolean => {
    if (!g.visible) return false;
    const H = 8;
    return pointInPolygon(mx, my, [
        localToScreen(g.x - H, g.y - H, g.z), localToScreen(g.x + H, g.y - H, g.z),
        localToScreen(g.x + H, g.y + H, g.z), localToScreen(g.x - H, g.y + H, g.z),
    ]);
};
const hitTestGridV = (mx: number, my: number, gv: Grid): boolean => {
    if (!gv.visible) return false;
    const H = 8;
    return pointInPolygon(mx, my, [
        localToScreen(gv.x - H, gv.y, gv.z - H), localToScreen(gv.x + H, gv.y, gv.z - H),
        localToScreen(gv.x + H, gv.y, gv.z + H), localToScreen(gv.x - H, gv.y, gv.z + H),
    ]);
};
const syncGridUI = (): void => {
    const g = grids[activeQ], gv = gridVs[activeQ];
    (document.getElementById('grid-x') as HTMLInputElement).value = g.x.toFixed(2);
    (document.getElementById('grid-y') as HTMLInputElement).value = g.y.toFixed(2);
    (document.getElementById('grid-z') as HTMLInputElement).value = g.z.toFixed(2);
    (document.getElementById('grid-visible') as HTMLInputElement).checked = g.visible;
    (document.getElementById('gridv-x') as HTMLInputElement).value = gv.x.toFixed(2);
    (document.getElementById('gridv-y') as HTMLInputElement).value = gv.y.toFixed(2);
    (document.getElementById('gridv-z') as HTMLInputElement).value = gv.z.toFixed(2);
    (document.getElementById('gridv-visible') as HTMLInputElement).checked = gv.visible;
    const label = `(Ansicht ${activeQ + 1})`;
    document.getElementById('grid-q-label')!.textContent = label;
    document.getElementById('gridv-q-label')!.textContent = label;
};

const gridDrag: { active: boolean; moved: boolean; target: string; quadrant: number; snapFaceIdx: number; snapVertIdx: number } = {
    active: false, moved: false, target: 'floor', quadrant: 0, snapFaceIdx: -1, snapVertIdx: -1,
};

const snapGrid = (q: number): void => {
    const g = gridDrag.target === 'wall' ? gridVs[q] : grids[q];
    if (!state.def) { gridDrag.snapFaceIdx = -1; gridDrag.snapVertIdx = -1; return; }
    const T = 0.35;
    let bestDist = Infinity, bestFi = -1, bestVi = -1;
    const allFaces = [...state.def.faces];
    if (state.def.parts) state.def.parts.forEach(p => allFaces.push(...p.faces));
    for (let fi = 0; fi < allFaces.length; fi++) {
        for (let vi = 0; vi < allFaces[fi].verts.length; vi++) {
            const v = allFaces[fi].verts[vi];
            const d = Math.min(Math.abs(v[2] - g.z), Math.hypot(v[0] - g.x, v[1] - g.y));
            if (d < bestDist) { bestDist = d; bestFi = fi; bestVi = vi; }
        }
    }
    if (bestFi >= 0 && bestDist < T) {
        const v = allFaces[bestFi].verts[bestVi];
        if (Math.abs(v[2] - g.z) < T) g.z = v[2];
        if (Math.hypot(v[0] - g.x, v[1] - g.y) < T) { g.x = v[0]; g.y = v[1]; }
        gridDrag.snapFaceIdx = bestFi; gridDrag.snapVertIdx = bestVi;
    } else { gridDrag.snapFaceIdx = -1; gridDrag.snapVertIdx = -1; }
};

const pointInPolygon = (mx: number, my: number, pts: { x: number; y: number }[]): boolean => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
        if (yi > my !== yj > my && mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
};
const faceCentroidDepth = (face: DEFFace): number => {
    const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
    let d = 0;
    for (const v of face.verts) d += v[0] * cosA - v[1] * sinA + v[0] * sinA + v[1] * cosA;
    return d / face.verts.length;
};

// ── Interaction ────────────────────────────────────────────────────────────────
let isDragging = false, dragMoved = false, lastMouse = { x: 0, y: 0 };
const vertDrag: { active: boolean; vertIdx: number; moved: boolean } = { active: false, vertIdx: -1, moved: false };
const pivotDrag: { active: boolean; partId: string | null; moved: boolean } = { active: false, partId: null, moved: false };

const hitTestVertex = (mx: number, my: number): number => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !state.def || !faces.length) return -1;
    const face = faces[state.selectedFaceIdx];
    if (!face) return -1;
    for (let i = 0; i < face.verts.length; i++) {
        const pt = localToScreen(face.verts[i][0], face.verts[i][1], face.verts[i][2]);
        if (Math.hypot(mx - pt.x, my - pt.y) < 8) return i;
    }
    return -1;
};
const syncVertRow = (face: DEFFace, i: number): void => {
    const row = document.querySelector<HTMLElement>(`#vert-list .vert-row[data-i="${i}"]`);
    if (!row) return;
    const v = face.verts[i];
    (row.querySelector('.vx') as HTMLInputElement).value = v[0].toFixed(3);
    (row.querySelector('.vy') as HTMLInputElement).value = v[1].toFixed(3);
    (row.querySelector('.vz') as HTMLInputElement).value = v[2].toFixed(3);
};

area.addEventListener('mousedown', e => {
    vertDrag.moved = false; pivotDrag.moved = false; gridDrag.moved = false;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    activeQ = getQuadrant(mx, my); lockedQ = activeQ;
    setRenderContext(lockedQ);
    const g = grids[lockedQ], gv = gridVs[lockedQ];

    const pid = hitTestPivot(mx, my, buildTestParams());
    if (pid && state.def?.parts?.find(p => p.id === pid)?.rotate) {
        pivotDrag.active = true; pivotDrag.partId = pid;
        area.style.cursor = 'ew-resize'; lastMouse = { x: e.clientX, y: e.clientY }; return;
    }
    const vi = hitTestVertex(mx, my);
    if (vi >= 0) {
        vertDrag.active = true; vertDrag.vertIdx = vi; area.style.cursor = 'grabbing';
        if (state.selectedVertIdx !== vi) { state.selectedVertIdx = vi; renderFaceEditor(); draw(); }
    } else if (e.shiftKey && g.selected && g.visible && hitTestGrid(mx, my, g)) {
        gridDrag.active = true; gridDrag.target = 'floor'; gridDrag.quadrant = lockedQ; area.style.cursor = 'grabbing';
    } else if (e.shiftKey && gv.selected && gv.visible && hitTestGridV(mx, my, gv)) {
        gridDrag.active = true; gridDrag.target = 'wall'; gridDrag.quadrant = lockedQ; area.style.cursor = 'grabbing';
    } else { isDragging = true; dragMoved = false; }
    lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
    isDragging = false; vertDrag.active = false; pivotDrag.active = false;
    gridDrag.active = false; gridDrag.snapFaceIdx = -1; gridDrag.snapVertIdx = -1;
    area.style.cursor = '';
});

window.addEventListener('mousemove', e => {
    const dsx = e.clientX - lastMouse.x, dsy = e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };

    if (pivotDrag.active && pivotDrag.partId) {
        if (Math.abs(dsx) > 0) {
            state.partTestAngles[pivotDrag.partId] = (state.partTestAngles[pivotDrag.partId] ?? 0) + dsx * 0.015;
            pivotDrag.moved = true;
            const slider = document.querySelector<HTMLInputElement>(`#parts-list input[data-pid="${pivotDrag.partId}"]`);
            if (slider) {
                const val = state.partTestAngles[pivotDrag.partId];
                slider.value = String(val);
                const valEl = document.getElementById(`pval-${pivotDrag.partId}`);
                if (valEl) valEl.textContent = ((val * 180) / Math.PI).toFixed(0) + '°';
            }
            draw();
        }
        return;
    }

    if (vertDrag.active && state.selectedFaceIdx >= 0 && state.def) {
        setRenderContext(lockedQ);
        const face = getActiveFaces()[state.selectedFaceIdx];
        if (face && Math.abs(dsx) + Math.abs(dsy) > 0) {
            const v = face.verts[vertDrag.vertIdx];
            if (e.shiftKey) {
                v[2] -= dsy / (SH * renderZoom);
            } else {
                const tw2 = (TW * renderZoom) / 2, th2 = (TH * renderZoom) / 2;
                const dwx = (dsx / tw2 + dsy / th2) / 2, dwy = (dsy / th2 - dsx / tw2) / 2;
                const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
                v[0] += dwx * cosA + dwy * sinA; v[1] += -dwx * sinA + dwy * cosA;
            }
            vertDrag.moved = true; markDirty(); syncVertRow(face, vertDrag.vertIdx); draw();
        }
        return;
    }

    if (gridDrag.active && Math.abs(dsx) + Math.abs(dsy) > 0) {
        setRenderContext(lockedQ);
        const g = gridDrag.target === 'wall' ? gridVs[gridDrag.quadrant] : grids[gridDrag.quadrant];
        const tw2 = (TW * renderZoom) / 2;
        const dwx = dsx / tw2 / 2, dwy = -dsx / tw2 / 2;
        const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
        g.x += dwx * cosA + dwy * sinA; g.y += -dwx * sinA + dwy * cosA;
        g.z -= dsy / (SH * renderZoom);
        gridDrag.moved = true; snapGrid(gridDrag.quadrant); syncGridUI(); draw(); return;
    }

    if (isDragging) {
        if (Math.abs(dsx) + Math.abs(dsy) > 3) dragMoved = true;
        if (e.shiftKey && lockedQ !== GAME_VIEW_Q) {
            quads[lockedQ].angle = (quads[lockedQ].angle + dsx * 0.008) % (Math.PI * 2);
            if (quads[lockedQ].angle < 0) quads[lockedQ].angle += Math.PI * 2;
        } else { quads[lockedQ].cam.x -= dsx; quads[lockedQ].cam.y -= dsy; }
        draw();
    }
});

area.addEventListener('mousemove', e => {
    if (vertDrag.active || isDragging || gridDrag.active || pivotDrag.active) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newQ = getQuadrant(mx, my);
    if (newQ !== activeQ) { activeQ = newQ; syncGridUI(); draw(); }
    setRenderContext(activeQ);
    if (hitTestVertex(mx, my) >= 0) { area.style.cursor = 'grab'; return; }
    if (hitTestPivot(mx, my, buildTestParams())) { area.style.cursor = 'ew-resize'; return; }
    const g = grids[activeQ], gv = gridVs[activeQ];
    if (g.visible && g.selected && e.shiftKey && hitTestGrid(mx, my, g)) { area.style.cursor = 'grab'; return; }
    if (gv.visible && gv.selected && e.shiftKey && hitTestGridV(mx, my, gv)) { area.style.cursor = 'grab'; return; }
    area.style.cursor = '';
});

area.addEventListener('click', e => {
    if (dragMoved || vertDrag.moved || gridDrag.moved || pivotDrag.moved) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setRenderContext(lockedQ);
    const g = grids[lockedQ], gv = gridVs[lockedQ];

    if (state.def) {
        const activeFaces = getActiveFaces();
        if (state.selectedFaceIdx >= 0) {
            const face = activeFaces[state.selectedFaceIdx];
            if (face) {
                for (let i = 0; i < face.verts.length; i++) {
                    const pt = localToScreen(face.verts[i][0], face.verts[i][1], face.verts[i][2]);
                    if (Math.hypot(mx - pt.x, my - pt.y) < 8) {
                        state.selectedVertIdx = i; renderFaceEditor(); draw(); return;
                    }
                }
            }
        }
        if (activeFaces.length) {
            const order = activeFaces.map((_, i) => i)
                .sort((a, b) => faceCentroidDepth(activeFaces[b]) - faceCentroidDepth(activeFaces[a]));
            for (const i of order) {
                const f = activeFaces[i];
                if (f.normal) {
                    const [nx, ny] = f.normal, cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
                    if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
                }
                const pts = f.verts.map(v => localToScreen(v[0], v[1], v[2]));
                if (pointInPolygon(mx, my, pts)) { selectFace(i); return; }
            }
        }
    }

    if (g.visible && hitTestGrid(mx, my, g)) { g.selected = true; draw(); return; }
    if (gv.visible && hitTestGridV(mx, my, gv)) { gv.selected = true; draw(); return; }
    if (g.selected) { g.selected = false; draw(); } else if (gv.selected) { gv.selected = false; draw(); }
});

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const g = grids[activeQ], gv = gridVs[activeQ];
        if (g.selected) { g.selected = false; draw(); } else if (gv.selected) { gv.selected = false; draw(); }
    }
});

area.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const q = getQuadrant(e.clientX - rect.left, e.clientY - rect.top);
    quads[q].zoom = Math.max(0.5, Math.min(20, quads[q].zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    draw();
}, { passive: false });

// ── UI events ──────────────────────────────────────────────────────────────────
(document.getElementById('preset-select') as HTMLSelectElement).addEventListener('change', e => {
    const t = e.target as HTMLSelectElement;
    if (t.value) { loadPreset(t.value); t.value = ''; }
});
(document.getElementById('meta-id') as HTMLInputElement).addEventListener('input', e => {
    if (state.def) { state.def.id = (e.target as HTMLInputElement).value; markDirty(); }
});
(document.getElementById('meta-label') as HTMLInputElement).addEventListener('input', e => {
    state.meta.label = (e.target as HTMLInputElement).value; markDirty();
});
document.querySelectorAll<HTMLInputElement>('input[name="mobil"]').forEach(r => {
    r.addEventListener('change', () => {
        state.meta.isStatic = (document.getElementById('r-static') as HTMLInputElement).checked;
        (document.getElementById('move-type-row') as HTMLElement).style.opacity = state.meta.isStatic ? '0.4' : '1';
        markDirty(); draw();
    });
});
(document.getElementById('move-type') as HTMLSelectElement).addEventListener('change', e => {
    state.meta.movementType = (e.target as HTMLSelectElement).value; markDirty();
});
(document.getElementById('show-cboxes') as HTMLInputElement).addEventListener('change', () => draw());

(document.getElementById('face-id-input') as HTMLInputElement).addEventListener('input', e => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].id = (e.target as HTMLInputElement).value;
    markDirty(); renderFaceList();
});

const setupColorPair = (colorId: string, hexId: string, apply: (v: string) => void): void => {
    (document.getElementById(colorId) as HTMLInputElement).addEventListener('input', e => {
        const v = (e.target as HTMLInputElement).value;
        (document.getElementById(hexId) as HTMLInputElement).value = v; apply(v);
    });
    (document.getElementById(hexId) as HTMLInputElement).addEventListener('change', e => {
        const v = (e.target as HTMLInputElement).value.trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(v) || v.startsWith('rgba')) {
            (document.getElementById(colorId) as HTMLInputElement).value = toColorInput(v); apply(v);
        }
    });
};
setupColorPair('face-color', 'face-color-hex', v => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].color = v; markDirty(); renderFaceList(); draw();
});
setupColorPair('face-stroke', 'face-stroke-hex', v => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    if ((document.getElementById('face-has-stroke') as HTMLInputElement).checked) {
        faces[state.selectedFaceIdx].stroke = v; markDirty(); draw();
    }
});
(document.getElementById('face-has-stroke') as HTMLInputElement).addEventListener('change', e => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].stroke = (e.target as HTMLInputElement).checked
        ? (document.getElementById('face-stroke-hex') as HTMLInputElement).value || '#aaaaaa'
        : null;
    markDirty(); draw();
});
(document.getElementById('face-stroke-w') as HTMLInputElement).addEventListener('input', e => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].strokeWidth = parseFloat((e.target as HTMLInputElement).value) || 1;
    markDirty(); draw();
});
(document.getElementById('face-has-normal') as HTMLInputElement).addEventListener('change', e => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    if ((e.target as HTMLInputElement).checked) {
        face.normal = [
            parseFloat((document.getElementById('face-nx') as HTMLInputElement).value) || 0,
            parseFloat((document.getElementById('face-ny') as HTMLInputElement).value) || 0,
        ];
    } else { delete face.normal; }
    markDirty(); draw();
});
(['face-nx', 'face-ny'] as const).forEach(id => {
    (document.getElementById(id) as HTMLInputElement).addEventListener('input', () => {
        const faces = getActiveFaces();
        if (state.selectedFaceIdx < 0 || !faces.length ||
            !(document.getElementById('face-has-normal') as HTMLInputElement).checked) return;
        faces[state.selectedFaceIdx].normal = [
            parseFloat((document.getElementById('face-nx') as HTMLInputElement).value) || 0,
            parseFloat((document.getElementById('face-ny') as HTMLInputElement).value) || 0,
        ];
        markDirty(); draw();
    });
});
(document.getElementById('btn-add-vert') as HTMLButtonElement).addEventListener('click', () => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    face.verts.push([...(face.verts[face.verts.length - 1] || [0, 0, 0])] as [number, number, number]);
    markDirty(); renderFaceEditor(); draw();
});
(document.getElementById('btn-del-vert') as HTMLButtonElement).addEventListener('click', () => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    if (face.verts.length <= 3) return;
    face.verts.pop();
    state.selectedVertIdx = Math.min(state.selectedVertIdx, face.verts.length - 1);
    markDirty(); renderFaceEditor(); draw();
});
(document.getElementById('btn-del-face') as HTMLButtonElement).addEventListener('click', () => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces.splice(state.selectedFaceIdx, 1);
    state.selectedFaceIdx = Math.min(state.selectedFaceIdx, faces.length - 1);
    if (!faces.length) state.selectedFaceIdx = -1;
    state.selectedVertIdx = -1; markDirty(); renderAll();
});
(document.getElementById('btn-add-face') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    const faces = getActiveFaces();
    faces.push({ id: 'face_' + faces.length, verts: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], color: '#888888' });
    state.selectedFaceIdx = faces.length - 1; state.selectedVertIdx = -1; markDirty(); renderAll();
});
(document.getElementById('btn-add-cbox') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    if (!state.def.collisionBoxes) state.def.collisionBoxes = [];
    state.def.collisionBoxes.push({ id: 'box_' + state.def.collisionBoxes.length, xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: 0, zMax: 1 });
    markDirty(); renderCboxList(); draw();
});
(document.getElementById('btn-add-zone') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    if (!state.def.rescueZones) state.def.rescueZones = [];
    state.def.rescueZones.push({ x: 0, y: 0, w: 1.5, h: 1.5, z: 0, role: 'both' });
    markDirty(); renderZoneList(); draw();
});
(document.getElementById('btn-add-landing') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    (state.def as DEFModel).landingZone = { x: 0, y: 0, w: 1.5, h: 1.5, z: 0 };
    markDirty(); renderLandingZone(); draw();
});
(document.getElementById('btn-remove-landing') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    delete (state.def as DEFModel).landingZone;
    markDirty(); renderLandingZone(); draw();
});

(document.getElementById('grid-visible') as HTMLInputElement).addEventListener('change', e => {
    grids[activeQ].visible = (e.target as HTMLInputElement).checked;
    if (!grids[activeQ].visible) grids[activeQ].selected = false; draw();
});
(document.getElementById('grid-x') as HTMLInputElement).addEventListener('input', e => { grids[activeQ].x = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });
(document.getElementById('grid-y') as HTMLInputElement).addEventListener('input', e => { grids[activeQ].y = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });
(document.getElementById('grid-z') as HTMLInputElement).addEventListener('input', e => { grids[activeQ].z = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });
(document.getElementById('gridv-visible') as HTMLInputElement).addEventListener('change', e => {
    gridVs[activeQ].visible = (e.target as HTMLInputElement).checked;
    if (!gridVs[activeQ].visible) gridVs[activeQ].selected = false; draw();
});
(document.getElementById('gridv-x') as HTMLInputElement).addEventListener('input', e => { gridVs[activeQ].x = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });
(document.getElementById('gridv-y') as HTMLInputElement).addEventListener('input', e => { gridVs[activeQ].y = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });
(document.getElementById('gridv-z') as HTMLInputElement).addEventListener('input', e => { gridVs[activeQ].z = parseFloat((e.target as HTMLInputElement).value) || 0; draw(); });

document.querySelectorAll<HTMLButtonElement>('.quad-reset').forEach(btn => {
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const q = parseInt(btn.dataset['q'] ?? '0');
        quads[q].angle = quads[q].defaultAngle; draw();
    });
});
document.querySelectorAll<HTMLButtonElement>('.quad-grid-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const q = parseInt(btn.dataset['q'] ?? '0');
        const allOn = grids[q].visible || gridVs[q].visible;
        grids[q].visible = !allOn; gridVs[q].visible = !allOn;
        if (!grids[q].visible) grids[q].selected = false;
        if (!gridVs[q].visible) gridVs[q].selected = false;
        btn.classList.toggle('hidden', !grids[q].visible);
        syncGridUI(); draw();
    });
});

// ── Serialization ──────────────────────────────────────────────────────────────
const toJSON = (): string => {
    const d = state.def!;
    const out: Record<string, unknown> = {
        id: d.id,
        label: state.meta.label,
        static: state.meta.isStatic,
        movementType: state.meta.movementType,
        pivot: d.pivot || [0, 0, 0],
        faces: d.faces,
        collisionBoxes: d.collisionBoxes || [],
    };
    if (d.parts?.length) out['parts'] = d.parts;
    if (d.rescueZones?.length) out['rescueZones'] = d.rescueZones;
    if ((d as DEFModel).landingZone) out['landingZone'] = (d as DEFModel).landingZone;
    return JSON.stringify(out, null, 2);
};

const fromJSON = (content: string): void => {
    const d = JSON.parse(content) as Record<string, unknown>;
    state.def = {
        id: d['id'] as string,
        pivot: (d['pivot'] as number[] | undefined) || [0, 0, 0],
        faces: (d['faces'] as DEFFace[]) || [],
        collisionBoxes: (d['collisionBoxes'] as DEFCollisionBox[]) || [],
        parts: d['parts'] as DEFPart[] | undefined,
        rotateNodes: d['rotateNodes'] as DEF['rotateNodes'],
        rescueZones: d['rescueZones'] as RescueZone[] | undefined,
        landingZone: d['landingZone'] as LandingZone | undefined,
    };
    state.meta = {
        label: (d['label'] as string) || (d['id'] as string),
        isStatic: d['static'] !== false,
        movementType: (d['movementType'] as string) || 'none',
    };
    state.selectedFaceIdx = -1; state.selectedVertIdx = -1; state.activePart = null;
    state.partTestAngles = {}; state.dirty = false;
    syncMetaToUI(); renderAll();
};

// ── VS Code bridge ─────────────────────────────────────────────────────────────
scheduleNotify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
        if (state.def) vscode.postMessage({ type: 'change', content: toJSON() });
    }, 300);
};

window.addEventListener('message', (e: MessageEvent<{ type: string; content?: string }>) => {
    if (e.data.type === 'load' && e.data.content !== undefined) fromJSON(e.data.content);
});

syncGridUI();
draw();
vscode.postMessage({ type: 'ready' });
