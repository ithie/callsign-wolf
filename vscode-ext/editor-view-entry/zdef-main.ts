export {};
declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

import type { DEF, DEFFace, DEFCollisionBox, DEFPart, DEF2, DEF2Face, DEF2Node, DEFFragment, DEFLight } from '../../src/game/defs';
import { createSceneRenderer } from '../../src/game/scene-renderer';
import { applyParts, getTransformedPivots, renderNodes } from '../../src/game/def-utils';

import HANGAR_RAW from '../../src/game/models/objects/hangar.zdef';
import LIGHTHOUSE_RAW from '../../src/game/models/objects/lighthouse.zdef';
import SAILBOAT_RAW from '../../src/game/models/sailboat.zdef';
import COASTHAWK_RAW from '../../src/game/models/coasthawk.zdef';
import DOLPHIN_RAW from '../../src/game/models/dolphin.zdef';
import ATLAS_RAW from '../../src/game/models/atlas.zdef';
import GLIDER_RAW from '../../src/game/models/objects/glider.zdef';
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
    def2: DEF2 | null;
    meta: ZdefMeta;
    selectedFaceIdx: number;
    selectedVertIdx: number;
    activePart: string | null;
    partTestAngles: Record<string, number>;
    dirty: boolean;
    filename: string | null;
    selectedFragmentIdx: number;
} = {
    def: null,
    def2: null,
    meta: { label: '', isStatic: true, movementType: 'none' },
    selectedFaceIdx: -1,
    selectedVertIdx: -1,
    activePart: null,
    partTestAngles: {},
    dirty: false,
    filename: null,
    selectedFragmentIdx: -1,
};
const wireframe = [false, false, false, false];

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
    if (state.def2) {
        const result: DEFFace[] = [];
        const recurse = (nodes: any[]) => {
            for (const node of nodes ?? []) {
                for (const f of node.faces ?? []) {
                    if (f.type !== 'line') result.push(f as DEFFace);
                }
                if (node.children) recurse(node.children);
            }
        };
        recurse((state.def2 as any).nodes ?? []);
        return result;
    }
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
grids[GAME_VIEW_Q].visible = false;
gridVs[GAME_VIEW_Q].visible = false;
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
    document.querySelectorAll<HTMLButtonElement>('.quad-wireframe-toggle').forEach((btn, q) => {
        btn.style.display = q === GAME_VIEW_Q ? 'none' : '';
        btn.style.top = Math.floor(q / 2) * qh + 4 + 'px';
        btn.style.left = (q % 2) * qw + qw - 72 + 'px';
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

        const _computeModelDepth = (faces: DEFFace[]): number => {
            if (!faces.length) return 0;
            const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
            let sum = 0;
            for (const f of faces) {
                let cx = 0, cy = 0;
                for (const v of f.verts) { cx += v[0]; cy += v[1]; }
                sum += (cx / f.verts.length) * cosA + (cy / f.verts.length) * sinA;
            }
            return sum / faces.length;
        };
        const _gridDepth = (grid: Grid): number => grid.x * Math.cos(renderViewAngle) + grid.y * Math.sin(renderViewAngle);

        if (state.def) {
            const _md0 = _computeModelDepth(getActiveFaces());
            if (_gridDepth(g) <= _md0) drawGrid(g);
            if (_gridDepth(gv) <= _md0) drawGridV(gv);
        } else {
            drawGrid(g); drawGridV(gv);
        }

        if (state.def) {
            const testParams = buildTestParams();
            const activeFaces = getActiveFaces();

            if (state.def2) {
                const colors2: Record<string, string> = {};
                if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
                    colors2[activeFaces[state.selectedFaceIdx].id] = '#ffdd44';
                }
                SceneRenderer.debugCollision = showCboxes;
                renderNodes(state.def2, {}, { x: 0, y: 0, angle: renderViewAngle, colors: colors2 } as any, SceneRenderer as any, renderCam.x, renderCam.y, { ctx, isoFn: iso, tileW: TW * renderZoom } as any);
            } else {
                const colors: Record<string, string> = {};
                if (state.activePart) {
                    const ap = state.def.parts?.find(p => p.id === state.activePart);
                    if (ap) ap.faces.forEach(f => { colors[f.id] = '#2d5c88'; });
                }
                if (state.selectedFragmentIdx >= 0 && state.def.fragments?.[state.selectedFragmentIdx]) {
                    const selFr = state.def.fragments[state.selectedFragmentIdx];
                    const fragColor = _fragColors[state.selectedFragmentIdx % _fragColors.length];
                    selFr.faceIds.forEach(id => { colors[id] = fragColor; });
                }
                if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
                    colors[activeFaces[state.selectedFaceIdx].id] = '#ffdd44';
                }
                const renderedDef = applyParts(state.def, testParams);
                SceneRenderer.debugCollision = showCboxes;
                SceneRenderer.add(renderedDef, { x: 0, y: 0, angle: renderViewAngle, colors });
                SceneRenderer.flush(renderCam.x, renderCam.y);
            }

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

        if (state.def) {
            const _md2 = _computeModelDepth(getActiveFaces());
            if (_gridDepth(g) > _md2) drawGrid(g);
            if (_gridDepth(gv) > _md2) drawGridV(gv);
        }

        if (wireframe[q] && state.def) {
            const _allFaces = getActiveFaces();
            ctx.save();
            ctx.strokeStyle = 'rgba(180,220,255,0.45)';
            ctx.lineWidth = 0.7;
            for (const f of _allFaces) {
                if (!f.verts.length) continue;
                const pts = f.verts.map(v => localToScreen(v[0], v[1], v[2]));
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();
        }

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
    if (state.def2) { sec.style.display = 'none'; return; }
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

const _def2FindFaceNode = (faceRef: DEF2Face): { node: DEF2Node; localIdx: number } | null => {
    if (!state.def2) return null;
    const search = (nodes: DEF2Node[]): { node: DEF2Node; localIdx: number } | null => {
        for (const node of nodes) {
            const idx = (node.faces ?? []).indexOf(faceRef as any);
            if (idx >= 0) return { node, localIdx: idx };
            if (node.children) { const r = search(node.children); if (r) return r; }
        }
        return null;
    };
    return search(state.def2.nodes);
};

const _def2MoveFace = (srcFlatIdx: number, dstFlatIdx: number): void => {
    if (!state.def2) return;
    const allFaces = getActiveFaces();
    const srcFace = allFaces[srcFlatIdx] as unknown as DEF2Face;
    const dstFace = allFaces[dstFlatIdx] as unknown as DEF2Face;
    const srcFound = _def2FindFaceNode(srcFace);
    if (!srcFound) return;
    srcFound.node.faces!.splice(srcFound.localIdx, 1);
    const dstFound = _def2FindFaceNode(dstFace);
    if (!dstFound) return;
    dstFound.node.faces!.splice(dstFound.localIdx, 0, srcFace);
    state.selectedFaceIdx = getActiveFaces().indexOf(srcFace as unknown as DEFFace);
    markDirty(); renderAll();
};

const _def2MoveFaceToNode = (srcFlatIdx: number, nodeIdx: number): void => {
    if (!state.def2) return;
    const allFaces = getActiveFaces();
    const srcFace = allFaces[srcFlatIdx] as unknown as DEF2Face;
    const srcFound = _def2FindFaceNode(srcFace);
    if (!srcFound) return;
    const targetNode = state.def2.nodes[nodeIdx];
    if (!targetNode || srcFound.node === targetNode) return;
    srcFound.node.faces!.splice(srcFound.localIdx, 1);
    if (!targetNode.faces) targetNode.faces = [];
    targetNode.faces.push(srcFace);
    state.selectedFaceIdx = getActiveFaces().indexOf(srcFace as unknown as DEFFace);
    markDirty(); renderAll();
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

    if (state.def2) {
        let html = '';
        let fi = 0;
        const buildFacesHtml = (node: DEF2Node, depth: number): string => {
            let h = '';
            for (const f of node.faces ?? []) {
                if ((f as any).type === 'line') continue;
                const idx = fi++;
                const indent = depth > 0 ? ` style="padding-left:${4 + depth * 10}px"` : '';
                h += `<div class="face-item${idx === state.selectedFaceIdx ? ' active' : ''}" data-i="${idx}" draggable="true"${indent}>` +
                     `<span class="drag-handle">⠿</span>` +
                     `<div class="face-swatch" style="background:${f.color}"></div>` +
                     `<div class="face-id" title="${f.id ?? ''}">${f.id ?? '—'}</div>` +
                     `</div>`;
            }
            for (const child of node.children ?? []) h += buildFacesHtml(child, depth + 1);
            return h;
        };
        state.def2.nodes.forEach((node, ni) => {
            html += `<div class="node-group">` +
                    `<div class="node-header" data-ni="${ni}">Node ${ni}${node.rotate ? ' ↻' : ''}</div>` +
                    `<div class="node-faces" data-ni="${ni}">${buildFacesHtml(node, 0)}</div>` +
                    `</div>`;
        });
        list.innerHTML = html;

        let dragSrcIdx = -1;
        list.querySelectorAll<HTMLElement>('.face-item').forEach(el => {
            el.addEventListener('click', () => selectFace(parseInt(el.dataset['i'] ?? '0')));
            el.addEventListener('dragstart', e => {
                dragSrcIdx = parseInt(el.dataset['i'] ?? '-1');
                e.dataTransfer!.effectAllowed = 'move';
            });
            el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', e => {
                e.preventDefault(); el.classList.remove('drag-over');
                const dstIdx = parseInt(el.dataset['i'] ?? '-1');
                if (dragSrcIdx >= 0 && dragSrcIdx !== dstIdx) _def2MoveFace(dragSrcIdx, dstIdx);
                dragSrcIdx = -1;
            });
        });
        list.querySelectorAll<HTMLElement>('.node-header').forEach(el => {
            el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
            el.addEventListener('drop', e => {
                e.preventDefault(); el.classList.remove('drag-over');
                const ni = parseInt(el.dataset['ni'] ?? '0');
                if (dragSrcIdx >= 0) _def2MoveFaceToNode(dragSrcIdx, ni);
                dragSrcIdx = -1;
            });
        });
        return;
    }

    list.innerHTML = faces.map((f, i) => `
    <div class="face-item ${i === state.selectedFaceIdx ? 'active' : ''}" data-i="${i}">
      <div class="face-swatch" style="background:${f.color}"></div>
      <div class="face-id" title="${f.id}">${f.id}</div>
      <button class="face-del-btn" data-i="${i}" title="Fläche löschen">✕</button>
    </div>`).join('');
    list.querySelectorAll<HTMLElement>('.face-item').forEach(el => {
        const i = parseInt(el.dataset['i'] ?? '0');
        el.addEventListener('click', e => {
            if ((e.target as HTMLElement).closest('.face-del-btn')) return;
            selectFace(i);
        });
        el.addEventListener('contextmenu', e => {
            e.preventDefault();
            selectFace(i);
            _showFaceCtxMenu(e.clientX, e.clientY, i);
        });
        const swatch = el.querySelector('.face-swatch');
        if (swatch) {
            swatch.addEventListener('dblclick', e => {
                e.stopPropagation();
                selectFace(i);
                _showFaceCtxMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY - 10, i);
                setTimeout(() => {
                    const picker = document.querySelector('.ctx-menu input[type="color"]') as HTMLInputElement;
                    if (picker) picker.click();
                }, 50);
            });
        }
    });
    list.querySelectorAll<HTMLButtonElement>('.face-del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const i = parseInt(btn.dataset['i'] ?? '0');
            const allFaces = getActiveFaces();
            allFaces.splice(i, 1);
            state.selectedFaceIdx = Math.min(state.selectedFaceIdx, allFaces.length - 1);
            if (!allFaces.length) state.selectedFaceIdx = -1;
            state.selectedVertIdx = -1;
            markDirty(); renderAll();
        });
    });
};

const renderFaceEditor = (): void => {
    const sec = document.getElementById('vert-sec') as HTMLElement;
    const label = document.getElementById('vert-sec-label') as HTMLElement;
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !state.def || !faces.length) { sec.style.display = 'none'; return; }
    const face = faces[state.selectedFaceIdx];
    if (!face) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    label.textContent = face.id;
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
      <button class="vert-del-btn" data-i="${i}" title="Vertex löschen">✕</button>
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
        (row.querySelector('.vert-del-btn') as HTMLButtonElement).addEventListener('click', e => {
            e.stopPropagation();
            if (face.verts.length <= 3) return;
            face.verts.splice(i, 1);
            state.selectedVertIdx = Math.min(state.selectedVertIdx, face.verts.length - 1);
            markDirty(); renderFaceEditor(); draw();
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

const renderLights = (): void => {
    const panel = document.getElementById('lights-panel')!;
    const lights = state.def?.lights;
    if (!lights?.length) { panel.innerHTML = '<div class="empty">–</div>'; return; }
    panel.innerHTML = lights.map((l, i) => `
    <div class="cbox-block" style="margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${l.color ?? '#fff'};border:1px solid #444;flex-shrink:0"></span>
        <span style="font-size:10px;opacity:0.6">[${l.pos.map((v: number) => v.toFixed(2)).join(', ')}]</span>
      </div>
      <div class="cbox-grid">
        <label>Hz</label>
        <input type="number" step="0.1" min="0" value="${l.blinkHz ?? ''}" class="li-hz" data-idx="${i}" placeholder="immer an" style="grid-column:2/4">
        <label>Phase</label>
        <input type="number" step="0.01" min="0" max="1" value="${l.phase ?? 0}" class="li-ph" data-idx="${i}" style="grid-column:2/4">
        <label>Duty</label>
        <input type="number" step="0.05" min="0.05" max="1" value="${l.dutyCycle ?? 0.5}" class="li-dc" data-idx="${i}" style="grid-column:2/4">
      </div>
    </div>`).join('');
    panel.querySelectorAll<HTMLInputElement>('.li-hz').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset['idx']!);
            const v = parseFloat(inp.value);
            lights[idx].blinkHz = isNaN(v) || v <= 0 ? undefined : v;
            markDirty();
        });
    });
    panel.querySelectorAll<HTMLInputElement>('.li-ph').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset['idx']!);
            lights[idx].phase = Math.max(0, Math.min(1, parseFloat(inp.value) || 0));
            markDirty();
        });
    });
    panel.querySelectorAll<HTMLInputElement>('.li-dc').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset['idx']!);
            lights[idx].dutyCycle = Math.max(0.05, Math.min(1, parseFloat(inp.value) || 0.5));
            markDirty();
        });
    });
};

// ── Fragment editor ───────────────────────────────────────────────────────────

// Collect all faces regardless of location (top-level, parts, or ZDEF2 nodes)
const _getAllEditorFaces = (): DEFFace[] => {
    const result: DEFFace[] = [...(state.def?.faces ?? [])];
    for (const part of state.def?.parts ?? []) {
        result.push(...part.faces);
    }
    return result;
};

interface PreviewFrag {
    faces: DEFFace[];
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    selfAngle: number;
    rotSpeed: number;
    age: number;
    maxAge: number;
}

let _previewFrags: PreviewFrag[] | null = null;
let _previewRafId = 0;
const PREVIEW_GRAVITY = 0.018;
const PREVIEW_MAX_AGE = 120;

const _fragColors = ['#4af', '#fa4', '#4f8', '#f4a', '#a4f', '#ff4'];

const renderFragmentList = (): void => {
    const sec = document.getElementById('fragments-sec') as HTMLElement;
    const list = document.getElementById('fragment-list')!;
    const playBtn = document.getElementById('btn-play-fragments') as HTMLButtonElement;
    const resetBtn = document.getElementById('btn-reset-fragments') as HTMLButtonElement;
    if (state.def2) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    const frags = state.def?.fragments ?? [];
    const hasFrags = frags.length > 0;
    playBtn.style.display = hasFrags && !_previewFrags ? '' : 'none';
    resetBtn.style.display = _previewFrags ? '' : 'none';

    if (!frags.length) { list.innerHTML = '<div class="empty">–</div>'; return; }
    list.innerHTML = frags.map((fr, i) => {
        const color = _fragColors[i % _fragColors.length];
        const sel = i === state.selectedFragmentIdx;
        const faceCount = fr.faceIds.length;
        const allFaces = _getAllEditorFaces();
        const faceRows = sel ? allFaces.map((f, fi) => {
            const checked = fr.faceIds.includes(f.id) ? 'checked' : '';
            return `<label class="frag-face-label"><input type="checkbox" class="frag-face-cb" data-fi="${fi}" ${checked}/>${f.id}</label>`;
        }).join('') : '';
        const pivot = fr.pivot;
        const imp = fr.impulse ?? [0, 0, 0];
        const detail = sel ? `
        <div class="cbox-grid" style="margin-top:4px">
            <label>Pivot</label>
            <input type="number" step="0.1" class="fri" data-f="px" value="${pivot[0].toFixed(2)}" style="width:44px">
            <input type="number" step="0.1" class="fri" data-f="py" value="${pivot[1].toFixed(2)}" style="width:44px">
            <label>Z</label>
            <input type="number" step="0.1" class="fri" data-f="pz" value="${pivot[2].toFixed(2)}" style="width:44px;grid-column:2">
            <label>Impuls</label>
            <input type="number" step="0.05" class="fri" data-f="ix" value="${imp[0].toFixed(2)}" style="width:44px">
            <input type="number" step="0.05" class="fri" data-f="iy" value="${imp[1].toFixed(2)}" style="width:44px">
            <label>Z</label>
            <input type="number" step="0.05" class="fri" data-f="iz" value="${imp[2].toFixed(2)}" style="width:44px;grid-column:2">
            <label>Torque</label>
            <input type="number" step="0.5" class="fri" data-f="torque" value="${(fr.torque ?? 0).toFixed(1)}" style="width:44px;grid-column:2">
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--dim)">Flächen:</div>
        <div class="frag-faces-wrap">${faceRows}</div>` : '';
        return `<div class="frag-item ${sel ? 'active' : ''}" data-fi="${i}">
            <div class="frag-header">
                <div class="part-dot" style="background:${color}"></div>
                <div class="part-name">${fr.id}</div>
                <div class="part-info">${faceCount}f</div>
                <button class="btn btn-sm btn-danger frag-del" data-fi="${i}" style="padding:0 4px">✕</button>
            </div>${detail}
        </div>`;
    }).join('');

    list.querySelectorAll<HTMLElement>('.frag-header').forEach(el => {
        el.addEventListener('click', e => {
            if ((e.target as HTMLElement).closest('.frag-del')) return;
            const fi = parseInt((el.parentElement as HTMLElement).dataset['fi'] ?? '-1');
            state.selectedFragmentIdx = state.selectedFragmentIdx === fi ? -1 : fi;
            renderFragmentList(); draw();
        });
    });
    list.querySelectorAll<HTMLButtonElement>('.frag-del').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const fi = parseInt(btn.dataset['fi'] ?? '-1');
            state.def!.fragments!.splice(fi, 1);
            if (state.selectedFragmentIdx >= (state.def!.fragments!.length)) state.selectedFragmentIdx = -1;
            markDirty(); renderFragmentList(); draw();
        });
    });
    list.querySelectorAll<HTMLInputElement>('.fri').forEach(inp => {
        inp.addEventListener('input', () => {
            const fi = state.selectedFragmentIdx;
            if (fi < 0 || !state.def?.fragments?.[fi]) return;
            const fr = state.def.fragments[fi];
            const f = inp.dataset['f'];
            const v = parseFloat(inp.value) || 0;
            if (f === 'px') fr.pivot[0] = v;
            else if (f === 'py') fr.pivot[1] = v;
            else if (f === 'pz') fr.pivot[2] = v;
            else if (f === 'ix') { if (!fr.impulse) fr.impulse = [0,0,0]; fr.impulse[0] = v; }
            else if (f === 'iy') { if (!fr.impulse) fr.impulse = [0,0,0]; fr.impulse[1] = v; }
            else if (f === 'iz') { if (!fr.impulse) fr.impulse = [0,0,0]; fr.impulse[2] = v; }
            else if (f === 'torque') fr.torque = v;
            markDirty(); draw();
        });
        inp.addEventListener('click', e => e.stopPropagation());
    });
    list.querySelectorAll<HTMLInputElement>('.frag-face-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const fi = state.selectedFragmentIdx;
            if (fi < 0 || !state.def?.fragments?.[fi]) return;
            const fr = state.def.fragments[fi];
            const faceIdx = parseInt(cb.dataset['fi'] ?? '-1');
            const face = _getAllEditorFaces()[faceIdx];
            if (!face) return;
            if (cb.checked) { if (!fr.faceIds.includes(face.id)) fr.faceIds.push(face.id); }
            else { fr.faceIds = fr.faceIds.filter(id => id !== face.id); }
            markDirty(); renderFragmentList();
        });
        cb.addEventListener('click', e => e.stopPropagation());
    });
};

const _buildPreviewFrags = (): PreviewFrag[] => {
    if (!state.def?.fragments?.length) return [];
    const result: PreviewFrag[] = [];
    for (const frag of state.def.fragments) {
        const [px, py, pz] = frag.pivot;
        const bakedFaces: DEFFace[] = [];
        const allEditorFaces = _getAllEditorFaces();
        for (const faceId of frag.faceIds) {
            const src = allEditorFaces.find(f => f.id === faceId);
            if (!src) continue;
            const verts = src.verts.map(v => [v[0] - px, v[1] - py, v[2] - pz]);
            bakedFaces.push({ ...src, verts });
        }
        if (!bakedFaces.length) continue;
        const [ix, iy, iz] = frag.impulse ?? [0, 0, 0];
        const torque = frag.torque ?? ((Math.random() - 0.5) * 6);
        result.push({
            faces: bakedFaces,
            x: px, y: py, z: pz,
            vx: ix, vy: iy, vz: iz + 0.04 + Math.random() * 0.06,
            selfAngle: 0,
            rotSpeed: torque / (PREVIEW_MAX_AGE * 0.5),
            age: 0,
            maxAge: PREVIEW_MAX_AGE,
        });
    }
    return result;
};

const _drawPreview = (): void => {
    if (!_previewFrags) return;
    for (const f of _previewFrags) {
        if (f.age >= f.maxAge) continue;
        const fragDef = { id: '_prev', faces: f.faces } as unknown as DEF;
        SceneRenderer.add(fragDef, { x: f.x, y: f.y, z: f.z, angle: f.selfAngle });
    }
    SceneRenderer.flush(renderCam.x, renderCam.y);
};

const _stepPreview = (): void => {
    if (!_previewFrags) return;
    for (const f of _previewFrags) {
        if (f.age >= f.maxAge) continue;
        f.vz -= PREVIEW_GRAVITY;
        f.x += f.vx; f.y += f.vy; f.z += f.vz;
        f.selfAngle += f.rotSpeed;
        f.age++;
    }
    if (_previewFrags.every(f => f.age >= f.maxAge)) stopPreview();
};

const stopPreview = (): void => {
    cancelAnimationFrame(_previewRafId);
    _previewFrags = null;
    const playBtn = document.getElementById('btn-play-fragments') as HTMLButtonElement;
    const resetBtn = document.getElementById('btn-reset-fragments') as HTMLButtonElement;
    if (playBtn) playBtn.style.display = '';
    if (resetBtn) resetBtn.style.display = 'none';
    draw();
};

const _previewLoop = (): void => {
    _stepPreview();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const qw = canvas.width / 2, qh = canvas.height / 2;
    for (let q = 0; q < 4; q++) {
        setRenderContext(q);
        ctx.save();
        ctx.beginPath(); ctx.rect((q % 2) * qw, Math.floor(q / 2) * qh, qw, qh); ctx.clip();
        _drawPreview();
        ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qw, 0); ctx.lineTo(qw, canvas.height);
    ctx.moveTo(0, qh); ctx.lineTo(canvas.width, qh);
    ctx.stroke();
    if (_previewFrags) _previewRafId = requestAnimationFrame(_previewLoop);
};

document.getElementById('btn-add-fragment')!.addEventListener('click', () => {
    if (!state.def) return;
    if (!state.def.fragments) state.def.fragments = [];
    const id = 'frag_' + state.def.fragments.length;
    const selFace = state.selectedFaceIdx >= 0 ? state.def.faces[state.selectedFaceIdx] : null;
    state.def.fragments.push({
        id,
        faceIds: selFace ? [selFace.id] : [],
        pivot: [0, 0, 0],
    });
    state.selectedFragmentIdx = state.def.fragments.length - 1;
    markDirty(); renderFragmentList(); draw();
});

document.getElementById('btn-play-fragments')!.addEventListener('click', () => {
    if (!state.def?.fragments?.length) return;
    _previewFrags = _buildPreviewFrags();
    const playBtn = document.getElementById('btn-play-fragments') as HTMLButtonElement;
    const resetBtn = document.getElementById('btn-reset-fragments') as HTMLButtonElement;
    playBtn.style.display = 'none';
    resetBtn.style.display = '';
    _previewRafId = requestAnimationFrame(_previewLoop);
});

document.getElementById('btn-reset-fragments')!.addEventListener('click', stopPreview);

const renderAll = (): void => {
    renderPartsList(); renderFaceList(); renderFaceEditor(); renderCboxList(); renderZoneList(); renderLandingZone(); renderLights(); renderFragmentList(); draw();
};

const selectFace = (i: number): void => {
    state.selectedFaceIdx = i; state.selectedVertIdx = -1;
    renderFaceList(); renderFaceEditor(); draw();
};

const loadPreset = (key: string): void => {
    const p = PRESETS[key];
    if (!p) return;
    fromJSON(JSON.stringify(p.def));
    // Override meta with preset's declared values (fromJSON derives them from JSON fields)
    state.meta = { label: p.label, isStatic: p.isStatic, movementType: p.movementType };
    state.dirty = false; state.filename = null;
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
        _closeCtxMenu();
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
    const delIdx = state.selectedVertIdx >= 0 && state.selectedVertIdx < face.verts.length
        ? state.selectedVertIdx : face.verts.length - 1;
    face.verts.splice(delIdx, 1);
    state.selectedVertIdx = Math.min(state.selectedVertIdx, face.verts.length - 1);
    markDirty(); renderFaceEditor(); draw();
});
(document.getElementById('btn-del-face') as HTMLButtonElement).addEventListener('click', () => {
    if (state.def2) {
        const allFaces = getActiveFaces();
        if (state.selectedFaceIdx < 0 || !allFaces.length) return;
        const found = _def2FindFaceNode(allFaces[state.selectedFaceIdx] as unknown as DEF2Face);
        if (!found) return;
        found.node.faces!.splice(found.localIdx, 1);
        const newFaces = getActiveFaces();
        state.selectedFaceIdx = Math.min(state.selectedFaceIdx, newFaces.length - 1);
        if (!newFaces.length) state.selectedFaceIdx = -1;
        state.selectedVertIdx = -1; markDirty(); renderAll();
        return;
    }
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces.splice(state.selectedFaceIdx, 1);
    state.selectedFaceIdx = Math.min(state.selectedFaceIdx, faces.length - 1);
    if (!faces.length) state.selectedFaceIdx = -1;
    state.selectedVertIdx = -1; markDirty(); renderAll();
});
(document.getElementById('btn-add-face') as HTMLButtonElement).addEventListener('click', () => {
    if (!state.def) return;
    if (state.def2) {
        const allFaces = getActiveFaces();
        let targetNode = state.def2.nodes[0];
        if (state.selectedFaceIdx >= 0 && allFaces[state.selectedFaceIdx]) {
            const found = _def2FindFaceNode(allFaces[state.selectedFaceIdx] as unknown as DEF2Face);
            if (found) targetNode = found.node;
        }
        if (!targetNode.faces) targetNode.faces = [];
        const newFace: DEF2Face = { id: 'face_' + allFaces.length, verts: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], color: '#1a4080' };
        targetNode.faces.push(newFace);
        state.selectedFaceIdx = getActiveFaces().indexOf(newFace as unknown as DEFFace);
        state.selectedVertIdx = -1; markDirty(); renderAll();
        return;
    }
    const faces = getActiveFaces();
    faces.push({ id: 'face_' + faces.length, verts: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], color: '#1a70c8' });
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

document.querySelectorAll<HTMLButtonElement>('.quad-wireframe-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const q = parseInt(btn.dataset['q'] ?? '0');
        wireframe[q] = !wireframe[q];
        btn.classList.toggle('active', wireframe[q]);
        draw();
    });
});

(document.getElementById('btn-clear-grid') as HTMLButtonElement).addEventListener('click', () => {
    const g = grids[activeQ];
    g.visible = false; g.selected = false; g.x = 0; g.y = 0; g.z = 0;
    syncGridUI(); draw();
});
(document.getElementById('btn-clear-gridv') as HTMLButtonElement).addEventListener('click', () => {
    const gv = gridVs[activeQ];
    gv.visible = false; gv.selected = false; gv.x = 0; gv.y = 0; gv.z = 0;
    syncGridUI(); draw();
});

const _closeCtxMenu = (): void => {
    document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
};

const _showFaceCtxMenu = (clientX: number, clientY: number, faceIdx: number): void => {
    _closeCtxMenu();
    const faces = getActiveFaces();
    const face = faces[faceIdx];
    if (!face) return;

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';

    const colorRow = document.createElement('div');
    colorRow.className = 'ctx-menu-sub';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = toColorInput(face.color);
    colorPicker.addEventListener('input', e => {
        face.color = (e.target as HTMLInputElement).value;
        markDirty(); renderAll();
    });
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Farbe';
    colorRow.appendChild(colorPicker);
    colorRow.appendChild(colorLabel);
    menu.appendChild(colorRow);

    const strokeRow = document.createElement('div');
    strokeRow.className = 'ctx-menu-sub';
    const strokeCheck = document.createElement('input');
    strokeCheck.type = 'checkbox';
    strokeCheck.checked = !!face.stroke;
    const strokePicker = document.createElement('input');
    strokePicker.type = 'color';
    strokePicker.value = toColorInput(face.stroke || '#aaaaaa');
    strokePicker.style.display = face.stroke ? '' : 'none';
    strokeCheck.addEventListener('change', e => {
        if ((e.target as HTMLInputElement).checked) {
            face.stroke = strokePicker.value;
            face.strokeWidth = face.strokeWidth ?? 1;
            strokePicker.style.display = '';
        } else {
            delete face.stroke;
            delete face.strokeWidth;
            strokePicker.style.display = 'none';
        }
        markDirty(); renderAll();
    });
    strokePicker.addEventListener('input', e => {
        if (face.stroke !== undefined) { face.stroke = (e.target as HTMLInputElement).value; markDirty(); renderAll(); }
    });
    const strokeLabel = document.createElement('label');
    strokeLabel.textContent = 'Kontur';
    strokeRow.appendChild(strokeCheck);
    strokeRow.appendChild(strokeLabel);
    strokeRow.appendChild(strokePicker);
    menu.appendChild(strokeRow);

    const sep1 = document.createElement('div');
    sep1.className = 'ctx-menu-sep';
    menu.appendChild(sep1);

    const normalCheck = document.createElement('div');
    normalCheck.className = 'ctx-menu-sub';
    const normalToggle = document.createElement('input');
    normalToggle.type = 'checkbox';
    normalToggle.checked = Array.isArray(face.normal);
    const nlabel = document.createElement('label');
    nlabel.textContent = 'Normal';
    normalCheck.appendChild(normalToggle);
    normalCheck.appendChild(nlabel);
    menu.appendChild(normalCheck);

    const normalInputs = document.createElement('div');
    normalInputs.className = 'ctx-menu-sub';
    normalInputs.style.display = normalToggle.checked ? '' : 'none';
    (['nx', 'ny'] as const).forEach((lbl, idx) => {
        const l = document.createElement('label'); l.textContent = lbl;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.step = '0.1'; inp.style.width = '46px';
        inp.value = String(Array.isArray(face.normal) ? face.normal[idx] : 0);
        inp.addEventListener('input', () => {
            if (!Array.isArray(face.normal)) face.normal = [0, 0];
            face.normal[idx] = parseFloat(inp.value) || 0;
            markDirty(); renderAll();
        });
        normalInputs.appendChild(l);
        normalInputs.appendChild(inp);
    });
    menu.appendChild(normalInputs);
    normalToggle.addEventListener('change', e => {
        const inputs = normalInputs.querySelectorAll<HTMLInputElement>('input');
        if ((e.target as HTMLInputElement).checked) {
            face.normal = [parseFloat(inputs[0].value) || 0, parseFloat(inputs[1].value) || 0];
            normalInputs.style.display = '';
        } else {
            delete face.normal;
            normalInputs.style.display = 'none';
        }
        markDirty(); renderAll();
    });

    const sep2 = document.createElement('div');
    sep2.className = 'ctx-menu-sep';
    menu.appendChild(sep2);

    const renameRow = document.createElement('div');
    renameRow.className = 'ctx-menu-sub';
    const renameLabel = document.createElement('label');
    renameLabel.textContent = 'ID:';
    const renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.value = face.id;
    renameInput.addEventListener('input', e => {
        face.id = (e.target as HTMLInputElement).value;
        markDirty(); renderFaceList();
        const secLabel = document.getElementById('vert-sec-label');
        if (secLabel) secLabel.textContent = face.id;
    });
    renameRow.appendChild(renameLabel);
    renameRow.appendChild(renameInput);
    menu.appendChild(renameRow);

    const sep3 = document.createElement('div');
    sep3.className = 'ctx-menu-sep';
    menu.appendChild(sep3);

    const delItem = document.createElement('div');
    delItem.className = 'ctx-menu-item danger';
    delItem.textContent = '✕ Löschen';
    delItem.addEventListener('click', () => {
        faces.splice(faceIdx, 1);
        state.selectedFaceIdx = Math.min(state.selectedFaceIdx, faces.length - 1);
        if (!faces.length) state.selectedFaceIdx = -1;
        state.selectedVertIdx = -1;
        _closeCtxMenu();
        markDirty(); renderAll();
    });
    menu.appendChild(delItem);

    document.body.appendChild(menu);
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = clientX, y = clientY;
    if (x + menu.offsetWidth > vw) x = vw - menu.offsetWidth - 4;
    if (y + menu.offsetHeight > vh) y = vh - menu.offsetHeight - 4;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const onOutside = (e: MouseEvent): void => {
        if (!menu.contains(e.target as Node)) { _closeCtxMenu(); document.removeEventListener('mousedown', onOutside); }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside), 0);
};

area.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setRenderContext(lockedQ);
    if (!state.def) return;
    const activeFaces = getActiveFaces();
    if (!activeFaces.length) return;
    const order = activeFaces.map((_, i) => i)
        .sort((a, b) => faceCentroidDepth(activeFaces[b]) - faceCentroidDepth(activeFaces[a]));
    for (const i of order) {
        const f = activeFaces[i];
        if (f.normal) {
            const [nx, ny] = f.normal, cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
            if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
        }
        const pts = f.verts.map(v => localToScreen(v[0], v[1], v[2]));
        if (pointInPolygon(mx, my, pts)) {
            selectFace(i);
            _showFaceCtxMenu(e.clientX, e.clientY, i);
            return;
        }
    }
});

// ── Serialization ──────────────────────────────────────────────────────────────
const toJSON = (): string => {
    if (state.def2) {
        // ZDEF2: preserve full node structure, update mutable metadata and cboxes from editor state
        const out = {
            ...state.def2,
            label: state.meta.label,
            static: state.meta.isStatic,
            movementType: state.meta.movementType,
            collisionBoxes: state.def?.collisionBoxes ?? [],
            ...(state.def?.rescueZones?.length ? { rescueZones: state.def.rescueZones } : {}),
            ...((state.def as DEFModel | null)?.landingZone ? { landingZone: (state.def as DEFModel).landingZone } : {}),
        };
        return JSON.stringify(out, null, 2);
    }
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
    if (d.fragments?.length) out['fragments'] = d.fragments;
    if (d.rescueZones?.length) out['rescueZones'] = d.rescueZones;
    if ((d as DEFModel).landingZone) out['landingZone'] = (d as DEFModel).landingZone;
    if (d.lights?.length) out['lights'] = d.lights;
    return JSON.stringify(out, null, 2);
};

const fromJSON = (content: string): void => {
    const d = JSON.parse(content.replace(/\/\/[^\n]*/g, '')) as Record<string, unknown>;
    if ((d['version'] as number) === 2) {
        state.def2 = d as unknown as DEF2;
        // Minimal v1 stub so cbox/zone/landing editors still work
        state.def = {
            id: d['id'] as string,
            faces: [],
            collisionBoxes: (d['collisionBoxes'] as DEFCollisionBox[]) || [],
            rescueZones: d['rescueZones'] as RescueZone[] | undefined,
            landingZone: d['landingZone'] as LandingZone | undefined,
        } as DEFModel;
    } else {
        state.def2 = null;
        state.def = {
            id: d['id'] as string,
            pivot: (d['pivot'] as number[] | undefined) || [0, 0, 0],
            faces: (d['faces'] as DEFFace[]) || [],
            collisionBoxes: (d['collisionBoxes'] as DEFCollisionBox[]) || [],
            parts: d['parts'] as DEFPart[] | undefined,
            fragments: d['fragments'] as DEFFragment[] | undefined,
            rotateNodes: d['rotateNodes'] as DEF['rotateNodes'],
            rescueZones: d['rescueZones'] as RescueZone[] | undefined,
            landingZone: d['landingZone'] as LandingZone | undefined,
            lights: d['lights'] as DEFLight[] | undefined,
        };
    }
    state.meta = {
        label: (d['label'] as string) || (d['id'] as string),
        isStatic: d['static'] !== false,
        movementType: (d['movementType'] as string) || 'none',
    };
    state.selectedFaceIdx = -1; state.selectedVertIdx = -1; state.activePart = null;
    state.selectedFragmentIdx = -1; state.partTestAngles = {}; state.dirty = false;
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
