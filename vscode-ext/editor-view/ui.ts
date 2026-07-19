import { state, createEmptyMission, getCurrentMission } from './state';
import { drawMap } from './render';
import { compressTerrain, decompressTerrain, compressFoliage, decompressFoliage } from '@/shared/utils';
import { Mission } from '@/shared/types';

// Overrideable callback — set by VS Code bridge to receive state changes
let _onStateChanged: (() => void) | null = null;
export const setOnStateChanged = (fn: (() => void) | null): void => {
    _onStateChanged = fn;
};

// Notify the Electron workbench parent frame that editor state has changed
export const notifyWorkbench = () => {
    if (window.parent !== window) window.parent.postMessage({ type: 'editor-state-changed' }, '*');
    _onStateChanged?.();
};

// Broadcast current mission to the preview window via BroadcastChannel
const previewChannel = new BroadcastChannel('editor-preview');
const broadcastPreview = () => {
    const m = getCurrentMission();
    if (!m) return;
    previewChannel.postMessage({ type: 'mission-update', mission: m, heliType: (m as any).heliOverride || undefined });
};
// Re-broadcast when the preview window signals it's ready
previewChannel.onmessage = e => {
    if (e.data.type === 'preview-ready') broadcastPreview();
};

const getEl = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const getInput = (id: string) => getEl<HTMLInputElement>(id);

// ── Payload-Liste ─────────────────────────────────────────────────────────────
export const renderPayloadList = () => notifyWorkbench();

// ── Object-Liste ──────────────────────────────────────────────────────────────
export const renderObjectList = () => notifyWorkbench();

// ── Foliage-Liste ─────────────────────────────────────────────────────────────
export const renderFoliageList = () => notifyWorkbench();
const _lsDe = (ls: string | { de: string; en?: string } | undefined): string =>
    !ls ? '' : typeof ls === 'string' ? ls : ls.de || '';
const _lsEn = (ls: string | { de: string; en?: string } | undefined): string =>
    !ls ? '' : typeof ls === 'string' ? '' : ls.en || '';

export const syncToData = () => {
    const m = getCurrentMission();
    if (!m) return;
    m.headline = { de: getInput('m_headline_de').value, en: getInput('m_headline_en').value };
    const subDe = getEl<HTMLTextAreaElement>('m_sublines_de')
        .value.split('\n')
        .filter(l => l.trim());
    const subEn = getEl<HTMLTextAreaElement>('m_sublines_en')
        .value.split('\n')
        .filter(l => l.trim());
    m.sublines = subDe.map((de, i) => ({ de, en: subEn[i] || '' }));
    m.briefing = {
        de: getEl<HTMLTextAreaElement>('m_briefing_de').value,
        en: getEl<HTMLTextAreaElement>('m_briefing_en').value,
    };
    m.rain = getInput('m_rain').checked;
    m.snow = getInput('m_snow').checked;
    m.night = getInput('m_night').checked;
    m.padPayloadRefill = getInput('m_pad_payload_refill').checked || undefined;
    const _startOnboard = parseInt(getInput('m_start_onboard').value);
    (m as any).startOnboard = _startOnboard > 0 ? _startOnboard : undefined;
    (m as any).waterLevel = parseFloat(getInput('m_water_level').value) || 0;
    const _maxTime = parseFloat(getInput('m_max_time').value);
    (m as any).maxTime = isFinite(_maxTime) && _maxTime > 0 ? _maxTime : undefined;
    const _heliOverride = getEl<HTMLSelectElement>('m_heli_override').value;
    (m as any).heliOverride = _heliOverride || undefined;
    m.windDir = parseInt(getInput('m_wind_dir').value) || 0;
    m.windStr = parseFloat(getInput('m_wind_str').value) || 0;
    m.windVar = getInput('m_wind_var').checked;
    m.gridSize = parseInt(getInput('m_grid_size').value) || 100;
    const npcCount = parseInt(getInput('m_npc_heli_count').value);
    (m as any).npcHeliCount = npcCount > 0 ? npcCount : undefined;
    const npcType = getEl<HTMLSelectElement>('m_npc_heli_type').value;
    (m as any).npcHeliType = npcType !== 'random' ? npcType : undefined;
    renderMissionList();
    drawMap();
    broadcastPreview();
    notifyWorkbench();
};

// Sync vessel form fields back into the currently-selected object
const syncVesselFromUI = (kind: 'carrier' | 'boat' | 'submarine') => {
    const m = getCurrentMission();
    if (!m || state.selectedObjectIdx === null) return;
    const obj = m.objects[state.selectedObjectIdx] as any;
    const _boatTypes = new Set(['boat', 'pilot_boat', 'sar_boat', 'salvage_tug', 'supply_vessel', 'frigate']);
    if (!obj || (kind === 'boat' ? !_boatTypes.has(obj.type) : obj.type !== kind)) return;
    const prefix = kind === 'carrier' ? 'carrier' : kind === 'submarine' ? 'submarine' : 'boat';
    obj.path = (document.getElementById(`m_${prefix}_path`) as HTMLSelectElement)?.value ?? obj.path;
    obj.speed = parseFloat((document.getElementById(`m_${prefix}_speed`) as HTMLInputElement)?.value) || 0;
    obj.radius = parseFloat((document.getElementById(`m_${prefix}_radius`) as HTMLInputElement)?.value) || 40;
    obj.angle = parseInt((document.getElementById(`m_${prefix}_angle`) as HTMLInputElement)?.value) || 0;
    obj.vesselName = (document.getElementById(`m_${prefix}_name`) as HTMLInputElement)?.value ?? '';
    obj.exitWarning = (document.getElementById(`m_${prefix}_exitWarning`) as HTMLInputElement)?.checked ?? false;
    obj.radioSilent = !((document.getElementById(`m_${prefix}_radioSilent`) as HTMLInputElement)?.checked ?? true);
    drawMap();
    broadcastPreview();
    notifyWorkbench();
};

// ── Load mission into UI ───────────────────────────────────────────────────────
export const loadMission = (idx: number) => {
    state.curIdx = idx;
    const m = getCurrentMission();
    if (!m) return;
    if (!m.payloads) m.payloads = [];
    if (!m.objects) m.objects = [];

    getInput('m_headline_de').value = _lsDe(m.headline);
    getInput('m_headline_en').value = _lsEn(m.headline);
    getEl<HTMLTextAreaElement>('m_sublines_de').value = (m.sublines || []).map(_lsDe).join('\n');
    getEl<HTMLTextAreaElement>('m_sublines_en').value = (m.sublines || []).map(_lsEn).join('\n');
    getEl<HTMLTextAreaElement>('m_briefing_de').value = _lsDe(m.briefing);
    getEl<HTMLTextAreaElement>('m_briefing_en').value = _lsEn(m.briefing);
    getInput('m_grid_size').value = m.gridSize.toString();
    getInput('m_rain').checked = m.rain;
    getInput('m_snow').checked = !!m.snow;
    getInput('m_night').checked = m.night;
    getInput('m_pad_payload_refill').checked = !!(m as any).padPayloadRefill;
    getInput('m_start_onboard').value = ((m as any).startOnboard ?? 0).toString();
    getInput('m_water_level').value = ((m as any).waterLevel ?? 0).toString();
    getInput('m_max_time').value = (m as any).maxTime != null ? (m as any).maxTime.toString() : '';
    getEl<HTMLSelectElement>('m_heli_override').value = (m as any).heliOverride ?? '';
    getInput('m_wind_dir').value = (m.windDir ?? 0).toString();
    getInput('m_wind_str').value = (m.windStr ?? 0).toString();
    getInput('m_wind_var').checked = !!m.windVar;
    getInput('m_npc_heli_count').value = ((m as any).npcHeliCount ?? 0).toString();
    getEl<HTMLSelectElement>('m_npc_heli_type').value = (m as any).npcHeliType ?? 'random';

    state.selectedUI = null;
    state.selectedObjectIdx = null;
    renderMissionList();
    renderPayloadList();
    renderObjectList();
    renderFoliageList();
    drawMap();
    broadcastPreview();
    notifyWorkbench();
};

// ── Mission list UI ───────────────────────────────────────────────────────────
const renderMissionList = () => notifyWorkbench();

// ── Camera ────────────────────────────────────────────────────────────────────
const clampCamera = () => {
    const m = getCurrentMission();
    if (!m) return;
    const tSize = (600 / m.gridSize) * state.zoom;
    const viewGridW = 600 / tSize,
        viewGridH = 600 / tSize;
    state.panX = Math.max(0, Math.min(state.panX, m.gridSize - viewGridW));
    state.panY = Math.max(0, Math.min(state.panY, m.gridSize - viewGridH));
    if (viewGridW >= m.gridSize) state.panX = 0;
    if (viewGridH >= m.gridSize) state.panY = 0;
};

// ── Coastal smoothing ─────────────────────────────────────────────────────────
const smoothCoast = (m: Mission, cx: number, cy: number, radius: number) => {
    for (let pass = 0; pass < 2; pass++) {
        for (let x = Math.max(1, cx - radius); x < Math.min(m.gridSize, cx + radius); x++) {
            for (let y = Math.max(1, cy - radius); y < Math.min(m.gridSize, cy + radius); y++) {
                const h = m.terrain[x][y];
                const neighbors = [
                    m.terrain[x - 1]?.[y],
                    m.terrain[x + 1]?.[y],
                    m.terrain[x]?.[y - 1],
                    m.terrain[x]?.[y + 1],
                ].filter(v => v !== undefined);
                const maxN = Math.max(...neighbors),
                    minN = Math.min(...neighbors);
                if (h > 0 && minN <= 0 && h > 4) m.terrain[x][y] = Math.round(((h + minN) / 2) * 100) / 100;
                else if (h <= 0 && maxN > 4) m.terrain[x][y] = Math.round(((h + maxN) / 2) * 100) / 100;
            }
        }
    }
};

const SNAP_RADIUS = 8;
const makePayload = (type: 'person' | 'crate' | 'rescuer', gx: number, gy: number, m: Mission) => {
    let nearestIdx = -1,
        nearestDist = SNAP_RADIUS;
    for (let i = 0; i < m.objects.length; i++) {
        const obj = m.objects[i];
        if (obj.type !== 'carrier' && obj.type !== 'boat' && obj.type !== 'sar_boat' && obj.type !== 'submarine' && obj.type !== 'sailboat_broken')
            continue;
        const d = Math.hypot(gx - obj.x, gy - obj.y);
        if (d <= nearestDist) {
            nearestDist = d;
            nearestIdx = i;
        }
    }
    if (nearestIdx >= 0) {
        const obj = m.objects[nearestIdx] as any;
        return {
            type,
            x: gx,
            y: gy,
            attachTo: {
                objectType: obj.type as 'carrier' | 'boat' | 'submarine' | 'sailboat_broken',
                objectIdx: nearestIdx,
            },
        };
    }
    return { type, x: gx, y: gy };
};

const removeNearestPayload = (m: Mission, gx: number, gy: number, type: 'person' | 'crate' | 'rescuer') => {
    if (!m.payloads) return;
    let nearestIdx = -1,
        nearestDist = 3;
    m.payloads.forEach((p, i: number) => {
        if (p.type !== type) return;
        const d = Math.hypot(p.x - gx, p.y - gy);
        if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
        }
    });
    if (nearestIdx >= 0) m.payloads.splice(nearestIdx, 1);
};

// ── Paint / place ─────────────────────────────────────────────────────────────
const paint = (e: MouseEvent) => {
    const m = getCurrentMission();
    if (!m) return;
    const canvas = getEl<HTMLCanvasElement>('editorCanvas');
    const rect = canvas.getBoundingClientRect();
    const tSize = (600 / m.gridSize) * state.zoom;
    const gx = Math.floor((e.clientX - rect.left) / tSize + state.panX);
    const gy = Math.floor((e.clientY - rect.top) / tSize + state.panY);
    if (gx < 0 || gx >= m.gridSize || gy < 0 || gy >= m.gridSize) return;

    if (state.currentTool === 'terrain') {
        const rad = Math.ceil(state.brushRadius);
        const targetHeight = e.shiftKey ? -1.0 : 10.0;
        for (let dx = -rad; dx <= rad; dx++) {
            for (let dy = -rad; dy <= rad; dy++) {
                const dist = Math.hypot(dx, dy);
                const nx = gx + dx,
                    ny = gy + dy;
                if (dist <= state.brushRadius && m.terrain[nx] && m.terrain[nx][ny] !== undefined) {
                    const falloff = (Math.cos((dist / state.brushRadius) * Math.PI) + 1) / 2;
                    let newH = m.terrain[nx][ny] + (targetHeight - m.terrain[nx][ny]) * 0.05 * falloff;
                    m.terrain[nx][ny] = Math.round(Math.max(-1, Math.min(15, newH)) * 100) / 100;
                }
            }
        }
    } else if (state.currentTool === 'flatten') {
        const h = e.shiftKey ? -1 : 0.25;
        const rad = Math.ceil(state.brushRadius);
        for (let dx = -rad; dx <= rad; dx++) {
            for (let dy = -rad; dy <= rad; dy++) {
                const nx = gx + dx, ny = gy + dy;
                if (Math.hypot(dx, dy) <= state.brushRadius && m.terrain[nx] && ny >= 0 && ny <= m.gridSize) m.terrain[nx][ny] = h;
            }
        }
        // Bäume im Radius löschen wenn Wasser (shift) oder sehr flach
        if (e.shiftKey || h <= 0.1) {
            if ((m as any).foliage) {
                (m as any).foliage = (m as any).foliage.filter(
                    (f: any) => Math.hypot(f.x - gx, f.y - gy) > state.brushRadius
                );
            }
        }
    } else if (state.currentTool === 'pad') {
        const existing = m.objects.findIndex(o => o.type === 'pad');
        if (e.shiftKey) {
            if (existing >= 0) m.objects.splice(existing, 1);
        } else {
            const newPad = { type: 'pad' as const, x: gx, y: gy };
            if (existing >= 0) m.objects[existing] = newPad;
            else m.objects.push(newPad);
        }
    } else if (state.currentTool === 'carrier') {
        const existing = m.objects.findIndex(o => o.type === 'carrier');
        if (e.shiftKey) {
            if (existing >= 0) m.objects.splice(existing, 1);
        } else {
            const newCarrier =
                existing >= 0
                    ? { ...m.objects[existing], x: gx, y: gy }
                    : {
                          type: 'carrier' as const,
                          x: gx,
                          y: gy,
                          angle: 0,
                          path: 'circle' as const,
                          speed: 5,
                          radius: 40,
                      };
            if (existing >= 0) m.objects[existing] = newCarrier;
            else m.objects.push(newCarrier);
        }
    } else if (state.currentTool === 'boat') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'boat') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 8) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'boat', x: gx, y: gy, angle: 0, path: 'circle', speed: 3, radius: 20 });
        }
    } else if (state.currentTool === 'submarine') {
        if (e.shiftKey) {
            let nearestIdx = -1,
                nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'submarine') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            });
            if (nearestIdx >= 0) m.objects.splice(nearestIdx, 1);
        } else {
            let nearestIdx = -1,
                nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'submarine') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            });
            if (nearestIdx >= 0) {
                m.objects[nearestIdx] = { ...m.objects[nearestIdx], x: gx, y: gy };
            } else {
                m.objects.push({ type: 'submarine', x: gx, y: gy, angle: 0, path: 'static', speed: 0, radius: 20 });
            }
        }
    } else if (state.currentTool === 'lighthouse') {
        const existing = m.objects.findIndex(o => o.type === 'lighthouse');
        if (e.shiftKey) {
            if (existing >= 0) m.objects.splice(existing, 1);
        } else {
            const newLH = { type: 'lighthouse' as const, x: gx, y: gy };
            if (existing >= 0) m.objects[existing] = newLH;
            else m.objects.push(newLH);
        }
    } else if (state.currentTool === 'pilot_boat') {
        if (e.shiftKey) {
            const ni = m.objects.findIndex(o => o.type === 'pilot_boat');
            if (ni >= 0) m.objects.splice(ni, 1);
        } else {
            m.objects.push({ type: 'pilot_boat' as any, x: gx, y: gy, angle: 0, path: 'static', speed: 0, radius: 0 });
        }
    } else if (state.currentTool === 'sar_boat') {
        if (e.shiftKey) {
            const ni = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'sar_boat') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (ni && ni.d < 5) m.objects.splice(ni.i, 1);
        } else {
            m.objects.push({ type: 'sar_boat' as any, x: gx, y: gy, angle: 0, path: 'static', speed: 0, radius: 0 });
        }
    } else if (state.currentTool === 'salvage_tug') {
        if (e.shiftKey) {
            const ni = m.objects.findIndex(o => o.type === 'salvage_tug');
            if (ni >= 0) m.objects.splice(ni, 1);
        } else {
            m.objects.push({ type: 'salvage_tug' as any, x: gx, y: gy, angle: 0, path: 'static', speed: 0, radius: 0 });
        }
    } else if (state.currentTool === 'research_platform') {
        if (e.shiftKey) {
            const ni = m.objects.findIndex(o => o.type === 'research_platform');
            if (ni >= 0) m.objects.splice(ni, 1);
        } else {
            m.objects.push({ type: 'research_platform' as any, x: gx, y: gy });
        }
    } else if (state.currentTool === 'wind_turbine') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'wind_turbine') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'wind_turbine' as any, x: gx, y: gy });
        }
    } else if (state.currentTool === 'plane_wreck') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'plane_wreck') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'plane_wreck' as any, x: gx, y: gy, angle: 0 });
        }
    } else if (state.currentTool === 'ornithopter_wreck') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'ornithopter_wreck') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'ornithopter_wreck' as any, x: gx, y: gy, angle: 0 });
        }
    } else if (state.currentTool === 'sailboat_broken') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'sailboat_broken') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'sailboat_broken' as any, x: gx, y: gy, angle: 0 });
        }
    } else if (state.currentTool === 'buoy') {
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== 'buoy') return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: 'buoy' as any, x: gx, y: gy });
        }
    } else if (state.currentTool === 'baywatch_car' || state.currentTool === 'baywatch_hq' || state.currentTool === 'baywatch_tower') {
        const bwType = state.currentTool;
        if (e.shiftKey) {
            const near = m.objects.reduce((best: any, o: any, i: number) => {
                if (o.type !== bwType) return best;
                const d = Math.hypot(o.x - gx, o.y - gy);
                return !best || d < best.d ? { d, i } : best;
            }, null as any);
            if (near && near.d < 5) m.objects.splice(near.i, 1);
        } else {
            m.objects.push({ type: bwType as any, x: gx, y: gy, angle: 0 });
        }
    } else if (state.currentTool === 'person' || state.currentTool === 'rescuer') {
        const t = state.currentTool as 'person' | 'rescuer';
        if (e.shiftKey) removeNearestPayload(m, gx, gy, t);
        else {
            if (!m.payloads) m.payloads = [];
            m.payloads.push(makePayload(t, gx, gy, m));
        }
        renderPayloadList();
    } else if (state.currentTool === 'crate') {
        if (e.shiftKey) removeNearestPayload(m, gx, gy, 'crate');
        else {
            if (!m.payloads) m.payloads = [];
            m.payloads.push(makePayload('crate', gx, gy, m));
        }
        renderPayloadList();
    } else if (state.currentTool === 'festival_tent' || state.currentTool === 'festival_tent_broken') {
        const baseType = state.currentTool;
        const colorSel = document.getElementById(baseType === 'festival_tent_broken' ? 'm_tent_broken_color' : 'm_tent_color') as HTMLSelectElement;
        const rad = Math.max(0.5, state.brushRadius);
        const count = Math.max(1, Math.round(rad * 0.5));
        const _VARIANTS = ['', 'red', 'green'];
        if (e.shiftKey) {
            m.objects = m.objects.filter((o: any) => o.type !== baseType || Math.hypot(o.x - gx, o.y - gy) > rad);
        } else {
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const d = Math.random() * rad;
                const fx = Math.round(gx + Math.cos(a) * d);
                const fy = Math.round(gy + Math.sin(a) * d);
                if (fx < 0 || fx >= m.gridSize || fy < 0 || fy >= m.gridSize) continue;
                if ((m.terrain[fx]?.[fy] ?? -1) <= 0.05) continue;
                const selColor = colorSel?.value;
                const variant = (selColor === 'random' || !selColor)
                    ? _VARIANTS[Math.floor(Math.random() * _VARIANTS.length)]
                    : selColor;
                const angle = Math.round(Math.random() * 360);
                const obj: any = { type: baseType as any, x: fx, y: fy, angle };
                if (variant) obj.colorVariant = variant;
                m.objects.push(obj);
            }
        }
        notifyWorkbench();
    } else if (state.currentTool === 'foliage') {
        if (!(m as any).foliage) (m as any).foliage = [];
        const foliage = (m as any).foliage;
        if (e.shiftKey) {
            // Alle Bäume im Brush-Radius entfernen
            const rad = Math.max(0.5, state.brushRadius);
            (m as any).foliage = foliage.filter((f: any) => Math.hypot(f.x - gx, f.y - gy) > rad);
        } else {
            // Zufällig im Brush-Radius streuen (1-3 Bäume pro Klick)
            const rad = Math.max(0.5, state.brushRadius);
            const count = Math.max(1, Math.round(rad * 0.8));
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * rad;
                const fx = gx + Math.cos(angle) * dist;
                const fy = gy + Math.sin(angle) * dist;
                if (fx < 0 || fx >= m.gridSize || fy < 0 || fy >= m.gridSize) continue;
                const type = (document.getElementById('foliage-type') as HTMLSelectElement)?.value || 'pine';
                const h = m.terrain[Math.round(fx)]?.[Math.round(fy)] ?? -1;
                const isBeach = type === 'beach_person' || type === 'beach_umbrella' || type === 'beach_umbrella_tilted' || type === 'beach_lounger' || type === 'beach_cooler';
                if (isBeach ? h < -3 : h <= 0.05) continue;
                const scale = parseFloat(
                    (document.getElementById('foliage-scale') as HTMLInputElement)?.value || '1.0'
                );
                foliage.push({ x: Math.round(fx * 10) / 10, y: Math.round(fy * 10) / 10, s: scale, type });
            }
        }
        renderFoliageList();
    } else if (state.currentTool === 'sand') {
        const mSand = m as any;
        if (!mSand.sand)
            mSand.sand = Array.from({ length: m.gridSize + 1 }, () => new Array(m.gridSize + 1).fill(0));
        const val = e.shiftKey ? 0 : 1;
        const rad = Math.ceil(state.brushRadius);
        for (let dx = -rad; dx <= rad; dx++) {
            for (let dy = -rad; dy <= rad; dy++) {
                const nx = gx + dx, ny = gy + dy;
                if (Math.hypot(dx, dy) <= state.brushRadius && nx >= 0 && nx <= m.gridSize && ny >= 0 && ny <= m.gridSize) {
                    mSand.sand[nx][ny] = val;
                    if (val === 1 && m.terrain[nx]?.[ny] !== undefined && m.terrain[nx][ny] > 0)
                        m.terrain[nx][ny] = m.terrain[nx][ny] <= 0.6 ? 0.4 : 0.8;
                }
            }
        }
    } else if (state.currentTool === 'pavement') {
        const mPav = m as any;
        if (!mPav.pavement)
            mPav.pavement = Array.from({ length: m.gridSize + 1 }, () => new Array(m.gridSize + 1).fill(0));
        const val = e.shiftKey ? 0 : 1;
        const rad = Math.ceil(state.brushRadius);
        for (let dx = -rad; dx <= rad; dx++) {
            for (let dy = -rad; dy <= rad; dy++) {
                const nx = gx + dx, ny = gy + dy;
                if (nx >= 0 && nx <= m.gridSize && ny >= 0 && ny <= m.gridSize) {
                    mPav.pavement[nx][ny] = val;
                    if (val === 1 && m.terrain[nx]?.[ny] !== undefined && m.terrain[nx][ny] > 0)
                        m.terrain[nx][ny] = m.terrain[nx][ny] <= 0.6 ? 0.4 : 0.8;
                }
            }
        }
    }

    if (state.currentTool === 'terrain' || state.currentTool === 'flatten')
        smoothCoast(m, gx, gy, Math.ceil(state.brushRadius) + 2);

    renderObjectList();
    drawMap();
};

// ── Init ───────────────────────────────────────────────────────────────────────
export const initUI = () => {
    // ── Payload-Popup (Rechtsklick) ────────────────────────────────────────────
    const popup = document.createElement('div');
    popup.style.cssText =
        'position:fixed;display:none;background:rgba(10,10,10,0.96);border:1px solid #5f5;padding:10px 12px;font-family:monospace;font-size:12px;color:#fff;border-radius:4px;z-index:9999;box-shadow:0 5px 20px rgba(0,0,0,0.8);min-width:170px';
    document.body.appendChild(popup);

    const hidePopup = () => {
        popup.style.display = 'none';
    };

    const showPayloadPopup = (idx: number, cx: number, cy: number) => {
        const m = getCurrentMission()!;
        const pa = m.payloads[idx] as any;
        const icon = pa.type === 'person' ? '🟡' : pa.type === 'rescuer' ? '🔵' : '🟠';
        const typeName = pa.type === 'person' ? 'Person' : pa.type === 'rescuer' ? 'Retter' : 'Crate';

        popup.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText =
            'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px';
        const title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.textContent = `${icon} ${typeName} #${idx + 1}`;
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'cursor:pointer;color:#f55;font-weight:bold;font-size:16px;margin-left:12px';
        closeBtn.onclick = hidePopup;
        header.append(title, closeBtn);
        popup.appendChild(header);

        const deliverRow = document.createElement('div');
        deliverRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';
        const deliverLabel = document.createElement('span');
        deliverLabel.style.color = '#aaa';
        deliverLabel.textContent = 'Ziel:';
        const deliverSel = document.createElement('select');
        deliverSel.style.cssText =
            'flex:1;background:#111;color:#5f5;border:1px solid #444;font-family:monospace;font-size:11px';
        const opts: Array<[string, string]> = [['', '–']];
        if (m.objects.some((o: any) => o.type === 'pad')) opts.push(['pad', 'Pad']);
        if (m.objects.some((o: any) => o.type === 'carrier')) opts.push(['carrier', 'Carrier']);
        if (m.objects.some((o: any) => o.type === 'submarine')) opts.push(['submarine', 'U-Boot']);
        if (m.objects.some((o: any) => ['boat', 'pilot_boat', 'sar_boat', 'salvage_tug', 'supply_vessel', 'frigate'].includes(o.type)))
            opts.push(['boat', 'Boot']);
        opts.forEach(([val, lbl]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.text = lbl;
            if ((pa.deliverTo ?? '') === val) opt.selected = true;
            deliverSel.appendChild(opt);
        });
        deliverSel.onchange = () => {
            pa.deliverTo = deliverSel.value || undefined;
            renderPayloadList();
            notifyWorkbench();
            broadcastPreview();
        };
        deliverRow.append(deliverLabel, deliverSel);
        popup.appendChild(deliverRow);

        const npcRow = document.createElement('div');
        npcRow.style.cssText = 'margin:6px 0 2px';
        const npcLabel = document.createElement('label');
        npcLabel.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;color:#8af';
        const npcCb = document.createElement('input');
        npcCb.type = 'checkbox';
        npcCb.checked = !!pa.npcTarget;
        npcCb.onchange = () => {
            pa.npcTarget = npcCb.checked || undefined;
            renderPayloadList();
            notifyWorkbench();
            broadcastPreview();
        };
        npcLabel.append(npcCb, 'NPC-Ziel');
        npcRow.appendChild(npcLabel);
        popup.appendChild(npcRow);

        if (pa.type === 'person') {
            const swimRow = document.createElement('div');
            swimRow.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';
            const swimLabel = document.createElement('span');
            swimLabel.style.color = '#aaa';
            swimLabel.textContent = 'Outfit:';
            const swimSel = document.createElement('select');
            swimSel.style.cssText =
                'flex:1;background:#111;color:#8fa;border:1px solid #444;font-family:monospace;font-size:11px';
            const swimOpts: Array<[string, string]> = [
                ['', 'auto'],
                ['true', 'Badekleidung'],
                ['false', 'Normalkleidung'],
            ];
            const curSwim = pa.swimwear === true ? 'true' : pa.swimwear === false ? 'false' : '';
            swimOpts.forEach(([val, lbl]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = lbl;
                if (curSwim === val) opt.selected = true;
                swimSel.appendChild(opt);
            });
            swimSel.onchange = () => {
                if (swimSel.value === 'true') pa.swimwear = true;
                else if (swimSel.value === 'false') pa.swimwear = false;
                else delete pa.swimwear;
                renderPayloadList();
                notifyWorkbench();
                broadcastPreview();
            };
            swimRow.append(swimLabel, swimSel);
            popup.appendChild(swimRow);
        }

        const vw = window.innerWidth,
            vh = window.innerHeight;
        popup.style.left = Math.min(cx + 6, vw - 190) + 'px';
        popup.style.top = Math.min(cy + 6, vh - 150) + 'px';
        popup.style.display = 'block';
    };

    const showRingPopup = (idx: number, cx: number, cy: number) => {
        const m = getCurrentMission()!;
        const ring = m.objects[idx] as any;
        popup.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px';
        const title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.textContent = `⭕ Ring #${m.objects.slice(0, idx + 1).filter((o: any) => o.type === 'ring').length}`;
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'cursor:pointer;color:#f55;font-weight:bold;font-size:16px;margin-left:12px';
        closeBtn.onclick = hidePopup;
        header.append(title, closeBtn);
        popup.appendChild(header);

        const makeRow = (label: string, value: number, step: number, min: number, max: number, onChange: (v: number) => void) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin:4px 0;display:flex;align-items:center;gap:6px';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'color:#aaa;min-width:55px;font-size:11px';
            lbl.textContent = label;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = String(value);
            inp.step = String(step);
            inp.min = String(min);
            inp.max = String(max);
            inp.style.cssText = 'flex:1;background:#111;color:#FFD700;border:1px solid #444;font-family:monospace;font-size:11px;padding:2px 4px;width:60px';
            inp.oninput = () => { const v = parseFloat(inp.value); if (!isNaN(v)) onChange(v); };
            row.append(lbl, inp);
            return { row, inp };
        };

        const { row: angleRow, inp: angleInp } = makeRow('Winkel °:', Math.round((ring.angle ?? 0) * 180 / Math.PI), 15, 0, 360, v => {
            ring.angle = v * Math.PI / 180;
            drawMap(); notifyWorkbench(); broadcastPreview();
        });
        popup.appendChild(angleRow);

        popup.appendChild(makeRow('Höhe z:', ring.z ?? 4, 0.5, 0.5, 20, v => {
            ring.z = v; notifyWorkbench(); broadcastPreview();
        }).row);

        popup.appendChild(makeRow('Radius:', ring.radius ?? 2.5, 0.5, 1, 10, v => {
            ring.radius = v; drawMap(); notifyWorkbench(); broadcastPreview();
        }).row);

        const rotRow = document.createElement('div');
        rotRow.style.cssText = 'display:flex;gap:4px;margin-top:6px';
        const mkRotBtn = (label: string, delta: number) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = 'flex:1;background:#1a3a5a;border:1px solid #4af;color:#4af;font-size:11px;padding:4px;cursor:pointer;border-radius:3px;font-family:inherit';
            b.onclick = () => {
                ring.angle = (((ring.angle ?? 0) + delta * Math.PI / 180) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                angleInp.value = String(Math.round(ring.angle * 180 / Math.PI));
                drawMap(); notifyWorkbench(); broadcastPreview();
            };
            return b;
        };
        rotRow.append(mkRotBtn('↺ −15°', -15), mkRotBtn('↻ +15°', +15));
        popup.appendChild(rotRow);

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑 Ring löschen';
        delBtn.style.cssText = 'width:100%;background:#3a1a1a;border:1px solid #f55;color:#f55;font-size:11px;padding:5px;cursor:pointer;border-radius:3px;font-family:inherit;margin-top:6px';
        delBtn.onclick = () => {
            m.objects.splice(idx, 1);
            const mAny = m as any;
            if (!m.objects.some((o: any) => o.type === 'ring') && mAny.objectives)
                mAny.objectives = mAny.objectives.filter((o: any) => o.type !== 'ring_all');
            hidePopup();
            renderObjectList(); drawMap(); notifyWorkbench(); broadcastPreview();
        };
        popup.appendChild(delBtn);

        const vw = window.innerWidth, vh = window.innerHeight;
        popup.style.left = Math.min(cx + 6, vw - 190) + 'px';
        popup.style.top = Math.min(cy + 6, vh - 200) + 'px';
        popup.style.display = 'block';
    };

    document.addEventListener('mousedown', e => {
        if (!popup.contains(e.target as Node)) hidePopup();
    });

    getEl('btn-add-mission').onclick = () => {
        state.campaign.push(createEmptyMission());
        loadMission(state.campaign.length - 1);
    };
    getEl('btn-copy-mission').onclick = () => {
        const copy = JSON.parse(JSON.stringify(getCurrentMission()!));
        copy.headline += ' (Kopie)';
        state.campaign.push(copy);
        loadMission(state.campaign.length - 1);
    };

    // Foliage scale display
    const scaleInput = document.getElementById('foliage-scale') as HTMLInputElement;
    const scaleVal = document.getElementById('foliage-scale-val');
    if (scaleInput && scaleVal)
        scaleInput.oninput = () => {
            scaleVal.innerText = scaleInput.value;
        };
    // Clear foliage
    const clearFoliageBtn = document.getElementById('btn-clear-foliage');
    if (clearFoliageBtn) {
        clearFoliageBtn.onclick = () => {
            const m = getCurrentMission();
            if (!m || !confirm('Alle Bäume löschen?')) return;
            (m as any).foliage = [];
            renderFoliageList();
            drawMap();
            broadcastPreview();
        };
    }

    document.querySelectorAll('input[name="tool"]').forEach(el => {
        (el as HTMLInputElement).onchange = e => {
            state.currentTool = (e.target as HTMLInputElement).value;
            const foliageBar = getEl('foliage-type-bar');
            if (foliageBar) foliageBar.style.display = state.currentTool === 'foliage' ? 'block' : 'none';
            updateCursor();
        };
    });
    document.querySelectorAll('input[name="brush"]').forEach(el => {
        (el as HTMLInputElement).onchange = e => {
            const val = (e.target as HTMLInputElement).value;
            if (val === 'custom') {
                state.isCustomBrush = true;
                state.brushRadius = parseFloat(getInput('m_custom_brush').value) || 8;
            } else {
                state.isCustomBrush = false;
                state.brushRadius = parseFloat(val);
            }
            updateCursor();
        };
    });
    getInput('m_custom_brush').oninput = () => {
        if (state.isCustomBrush) {
            state.brushRadius = parseFloat(getInput('m_custom_brush').value) || 8;
            updateCursor();
        }
    };

    getEl('btn-zoom-in').onclick = () => {
        state.zoom = Math.min(15.0, state.zoom + 0.5);
        clampCamera();
        drawMap();
    };
    getEl('btn-zoom-out').onclick = () => {
        state.zoom = Math.max(1.0, state.zoom - 0.5);
        clampCamera();
        drawMap();
    };

    getEl('btn-resize-map').onclick = () => {
        const m = getCurrentMission();
        if (!m) return;
        const newSize = parseInt(getInput('m_grid_size').value);
        const oldT = m.terrain;
        m.terrain = Array.from({ length: newSize + 1 }, (_, x) =>
            Array.from({ length: newSize + 1 }, (_, y) => (x <= m.gridSize && y <= m.gridSize ? oldT[x][y] : -1))
        );
        m.gridSize = newSize;
        clampCamera();
        drawMap();
        broadcastPreview();
    };

    const safeClick = (id: string, fn: () => void) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };
    safeClick('close-wind', () => {
        state.selectedUI = null;
        drawMap();
    });
    safeClick('close-carrier', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-pad', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-boat', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-submarine', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-wt', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-plane-wreck', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-sailboat-broken', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-ornithopter-wreck', () => {
        state.selectedObjectIdx = null;
        drawMap();
    });
    safeClick('close-baywatch-car', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-baywatch-hq', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-baywatch-tower', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-concert-stage', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-festival-tent', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-festival-tent-broken', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-festival-car', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-xmas-house', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-xmas-lantern', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-sleigh', () => { state.selectedObjectIdx = null; drawMap(); });
    safeClick('close-reindeer', () => { state.selectedObjectIdx = null; drawMap(); });
    // Generic angle wire-up: input saves back to selected object of given types
    const wireAngle = (inputId: string, types: string[]) => {
        document.getElementById(inputId)?.addEventListener('input', () => {
            const m = getCurrentMission();
            if (!m || state.selectedObjectIdx === null) return;
            const obj = m.objects[state.selectedObjectIdx] as any;
            if (!types.includes(obj?.type)) return;
            obj.angle = parseInt((document.getElementById(inputId) as HTMLInputElement).value) || 0;
            drawMap(); broadcastPreview(); notifyWorkbench();
        });
    };
    wireAngle('m_bwc_angle', ['baywatch_car']);
    wireAngle('m_tent_angle', ['festival_tent']);
    wireAngle('m_tent_broken_angle', ['festival_tent_broken']);
    wireAngle('m_fcar_angle', ['festival_car']);
    wireAngle('m_pw_angle', ['plane_wreck']);
    wireAngle('m_sb_angle', ['sailboat_broken']);
    wireAngle('m_ow_angle', ['ornithopter_wreck']);
    wireAngle('m_xmas_house_angle', ['xmas_house_a', 'xmas_house_b']);
    wireAngle('m_xmas_lantern_angle', ['xmas_lantern']);
    wireAngle('m_sleigh_angle', ['sleigh']);
    wireAngle('m_reindeer_angle', ['reindeer']);

    // Type-selector handlers (non-angle object properties)
    const wireTypeSelect = (selectId: string, types: string[], useStartsWith = false) => {
        document.getElementById(selectId)?.addEventListener('change', () => {
            const m = getCurrentMission();
            if (!m || state.selectedObjectIdx === null) return;
            const obj = m.objects[state.selectedObjectIdx] as any;
            const match = useStartsWith ? types.some(t => obj?.type?.startsWith(t)) : types.includes(obj?.type);
            if (!match) return;
            const v = (document.getElementById(selectId) as HTMLSelectElement).value;
            if (v !== 'random') obj.type = v;
            drawMap(); broadcastPreview(); notifyWorkbench();
        });
    };
    const wireColorVariant = (selectId: string, type: string) => {
        document.getElementById(selectId)?.addEventListener('change', () => {
            const m = getCurrentMission();
            if (!m || state.selectedObjectIdx === null) return;
            const obj = m.objects[state.selectedObjectIdx] as any;
            if (obj?.type !== type) return;
            const v = (document.getElementById(selectId) as HTMLSelectElement).value;
            if (v === 'random') return;
            if (v === '') delete obj.colorVariant; else obj.colorVariant = v;
            drawMap(); broadcastPreview(); notifyWorkbench();
        });
    };
    wireColorVariant('m_tent_color', 'festival_tent');
    wireColorVariant('m_tent_broken_color', 'festival_tent_broken');
    wireColorVariant('m_fcar_color', 'festival_car');
    wireTypeSelect('m_xmas_house_type', ['xmas_house_a', 'xmas_house_b']);

    document.getElementById('m_wt_spinning')?.addEventListener('change', () => {
        const m = getCurrentMission();
        if (!m || state.selectedObjectIdx === null) return;
        const obj = m.objects[state.selectedObjectIdx] as any;
        if (obj?.type !== 'wind_turbine') return;
        obj.spinning = (document.getElementById('m_wt_spinning') as HTMLInputElement).checked;
        drawMap();
        broadcastPreview();
    });

    // Spawn buttons
    safeClick('btn_spawn_pad', () => {
        getCurrentMission()!.spawnObject = 'pad';
        drawMap();
    });
    safeClick('btn_spawn_carrier', () => {
        getCurrentMission()!.spawnObject = 'carrier';
        drawMap();
    });

    // Vessel sync
    ['carrier_path', 'carrier_speed', 'carrier_radius', 'carrier_angle', 'carrier_name'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('carrier'))
    );
    document.getElementById('m_carrier_exitWarning')?.addEventListener('change', () => syncVesselFromUI('carrier'));
    document.getElementById('m_carrier_radioSilent')?.addEventListener('change', () => syncVesselFromUI('carrier'));
    ['boat_path', 'boat_speed', 'boat_radius', 'boat_angle', 'boat_name'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('boat'))
    );
    document.getElementById('m_boat_exitWarning')?.addEventListener('change', () => syncVesselFromUI('boat'));
    document.getElementById('m_boat_radioSilent')?.addEventListener('change', () => syncVesselFromUI('boat'));
    ['submarine_path', 'submarine_speed', 'submarine_radius', 'submarine_angle', 'submarine_name'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('submarine'))
    );
    document.getElementById('m_submarine_exitWarning')?.addEventListener('change', () => syncVesselFromUI('submarine'));


    // General sync
    [
        'm_headline_de',
        'm_headline_en',
        'm_briefing_de',
        'm_briefing_en',
        'm_rain',
        'm_snow',
        'm_night',
        'm_water_level',
        'm_max_time',
        'm_heli_override',
        'm_wind_dir',
        'm_wind_str',
        'm_wind_var',
        'm_npc_heli_count',
        'm_npc_heli_type',
        'm_sublines_de',
        'm_sublines_en',
    ].forEach(id => getEl(id)?.addEventListener('input', syncToData));

    const canvas = getEl<HTMLCanvasElement>('editorCanvas');

    // ── Custom Cursor ──────────────────────────────────────────────────────────
    const cursorEl = document.createElement('canvas');
    cursorEl.id = 'brush-cursor';
    cursorEl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;display:none;';
    document.body.appendChild(cursorEl);
    const cursorCtx = cursorEl.getContext('2d')!;
    const PAINT_TOOLS = new Set(['terrain', 'flatten', 'foliage', 'sand', 'pavement']);
    const POINT_TOOLS = new Set([
        'pad',
        'carrier',
        'boat',
        'pilot_boat',
        'sar_boat',
        'salvage_tug',
        'supply_vessel',
        'frigate',
        'submarine',
        'lighthouse',
        'research_platform',
        'wind_turbine',
        'plane_wreck',
        'sailboat_broken',
        'ornithopter_wreck',
        'baywatch_car',
        'baywatch_hq',
        'baywatch_tower',
        'concert_stage',
        'festival_tent',
        'festival_tent_broken',
        'festival_car',
        'buoy',
        'xmas_house',
        'xmas_lantern',
        'sleigh',
        'reindeer',
        'person',
        'rescuer',
        'crate',
    ]);
    const dotColors: Record<string, string> = {
        pad: '#5f5',
        carrier: '#88aaff',
        boat: '#4af',
        submarine: '#888',
        frigate: '#6688bb',
        lighthouse: '#ffdd44',
        plane_wreck: '#aaa',
        sailboat_broken: '#b96',
        ornithopter_wreck: '#aaa',
        baywatch_car: '#cc2200',
        baywatch_hq: '#cc4400',
        baywatch_tower: '#cc4400',
        concert_stage: '#aa44ff',
        festival_tent: '#2266cc',
        festival_tent_broken: '#6688aa',
        festival_car: '#9aabb5',
        buoy: '#dd3300',
        xmas_house_a: '#aaddff',
        xmas_house_b: '#88bbee',
        xmas_lantern: '#ffdd44',
        sleigh: '#cc3333',
        reindeer: '#8b5228',
        person: '#ffe033',
        crate: '#ff8800',
    };

    const updateCursor = () => {
        const m = getCurrentMission();
        if (!m) return;
        const tool = state.currentTool;
        if (tool === 'move') {
            cursorEl.style.display = 'none';
            canvas.style.cursor = 'grab';
            return;
        }
        canvas.style.cursor = 'none';
        cursorEl.style.display = 'block';
        if (PAINT_TOOLS.has(tool)) {
            const tSize = (600 / m.gridSize) * state.zoom;
            const radiusPx = state.brushRadius * tSize;
            const size = Math.ceil(radiusPx * 2 + 8);
            cursorEl.width = size;
            cursorEl.height = size;
            cursorCtx.clearRect(0, 0, size, size);
            cursorCtx.beginPath();
            cursorCtx.arc(size / 2, size / 2, radiusPx, 0, Math.PI * 2);
            cursorCtx.strokeStyle = 'rgba(255,255,255,0.85)';
            cursorCtx.lineWidth = 1.5;
            cursorCtx.stroke();
            cursorCtx.beginPath();
            cursorCtx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
            cursorCtx.fillStyle = 'rgba(255,255,255,0.9)';
            cursorCtx.fill();
            cursorCtx.beginPath();
            cursorCtx.arc(size / 2, size / 2, radiusPx, 0, Math.PI * 2);
            cursorCtx.fillStyle =
                tool === 'flatten'
                    ? 'rgba(100,200,255,0.08)'
                    : tool === 'foliage'
                      ? 'rgba(50,200,50,0.1)'
                      : tool === 'sand'
                        ? 'rgba(212,180,80,0.12)'
                        : tool === 'pavement'
                          ? 'rgba(130,130,145,0.18)'
                          : 'rgba(255,160,0,0.08)';
            cursorCtx.fill();
        } else if (POINT_TOOLS.has(tool)) {
            const size = 32;
            cursorEl.width = size;
            cursorEl.height = size;
            cursorCtx.clearRect(0, 0, size, size);
            cursorCtx.strokeStyle = 'rgba(255,255,255,0.9)';
            cursorCtx.lineWidth = 1.5;
            cursorCtx.beginPath();
            cursorCtx.moveTo(size / 2, 0);
            cursorCtx.lineTo(size / 2, size);
            cursorCtx.moveTo(0, size / 2);
            cursorCtx.lineTo(size, size / 2);
            cursorCtx.stroke();
            cursorCtx.beginPath();
            cursorCtx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
            cursorCtx.fillStyle = dotColors[tool] || '#fff';
            cursorCtx.fill();
        }
    };

    canvas.addEventListener('mousemove', e => {
        const size = parseInt(cursorEl.width as any) || 32;
        cursorEl.style.left = e.clientX - size / 2 + 'px';
        cursorEl.style.top = e.clientY - size / 2 + 'px';
        updateCursor();
    });
    canvas.addEventListener('mouseenter', () => {
        if (state.currentTool !== 'move') {
            cursorEl.style.display = 'block';
            updateCursor();
        }
    });
    canvas.addEventListener('mouseleave', () => {
        cursorEl.style.display = 'none';
    });

    // ── M-Taste: Move-Modus ───────────────────────────────────────────────────
    const updateMoveCursor = () => {
        if (state.moveMode) {
            canvas.style.cursor = 'crosshair';
            cursorEl.style.display = 'none';
        } else {
            updateCursor();
        }
    };

    window.addEventListener('keydown', e => {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        if (e.key === 'm' || e.key === 'M') {
            if (state.selectedObjectIdx !== null || state.selectedPayloadIdx !== null) {
                state.moveMode = !state.moveMode;
                updateMoveCursor();
                drawMap();
            }
        }
        if (e.key === 'Escape') {
            if (state.isDraggingItem) {
                const m = getCurrentMission()!;
                if (state.dragItemType === 'payload')
                    Object.assign(m.payloads[state.dragItemIdx!], { x: state.dragOrigX, y: state.dragOrigY });
                else if (state.dragItemType === 'object')
                    Object.assign(m.objects[state.dragItemIdx!], { x: state.dragOrigX, y: state.dragOrigY });
                state.isDraggingItem = false;
                state.dragItemType = null;
                state.dragItemIdx = null;
                state.dragHasMoved = false;
            }
            hidePopup();
            state.moveMode = false;
            state.selectedObjectIdx = null;
            state.selectedPayloadIdx = null;
            updateMoveCursor();
            drawMap();
        }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── Context-menu (Doppelklick) ────────────────────────────────────────────
    const ctxMenu = document.getElementById('ed-ctx-menu')!;
    let _ctxGx = 0, _ctxGy = 0;
    const hideCtxMenu = () => { if (ctxMenu) ctxMenu.style.display = 'none'; };

    const _placeItem = (type: string, gx: number, gy: number) => {
        const m = getCurrentMission();
        if (!m) return;
        const mAny = m as any;
        const _vesselBase = (t: string) => ({ type: t as any, x: gx, y: gy, angle: 0, path: 'static' as const, speed: 0, radius: 20 });
        switch (type) {
            case 'pad': {
                const ei = m.objects.findIndex(o => o.type === 'pad');
                const n = { type: 'pad' as const, x: gx, y: gy };
                if (ei >= 0) m.objects[ei] = n; else m.objects.push(n);
                break;
            }
            case 'lighthouse': {
                const ei = m.objects.findIndex(o => o.type === 'lighthouse');
                const n = { type: 'lighthouse' as const, x: gx, y: gy };
                if (ei >= 0) m.objects[ei] = n; else m.objects.push(n);
                break;
            }
            case 'carrier': {
                const ei = m.objects.findIndex(o => o.type === 'carrier');
                const n = ei >= 0
                    ? { ...m.objects[ei], x: gx, y: gy }
                    : { type: 'carrier' as const, x: gx, y: gy, angle: 0, path: 'circle' as const, speed: 5, radius: 40 };
                if (ei >= 0) m.objects[ei] = n; else m.objects.push(n);
                break;
            }
            case 'research_platform':
                m.objects.push({ type: 'research_platform' as any, x: gx, y: gy });
                break;
            case 'wind_turbine':
                m.objects.push({ type: 'wind_turbine' as any, x: gx, y: gy });
                break;
            case 'plane_wreck':
                m.objects.push({ type: 'plane_wreck' as any, x: gx, y: gy, angle: 0 });
                break;
            case 'sailboat_broken':
                m.objects.push({ type: 'sailboat_broken' as any, x: gx, y: gy, angle: 0 });
                break;
            case 'ornithopter_wreck':
                m.objects.push({ type: 'ornithopter_wreck' as any, x: gx, y: gy, angle: 0 });
                break;
            case 'baywatch_car':
                m.objects.push({ type: 'baywatch_car' as any, x: gx, y: gy, angle: 0 });
                break;
            case 'baywatch_hq':
                m.objects.push({ type: 'baywatch_hq' as any, x: gx, y: gy });
                break;
            case 'baywatch_tower':
                m.objects.push({ type: 'baywatch_tower' as any, x: gx, y: gy });
                break;
            case 'concert_stage':
                m.objects.push({ type: 'concert_stage' as any, x: gx, y: gy });
                break;
            case 'festival_tent': {
                const _tcs = (document.getElementById('m_tent_color') as HTMLSelectElement)?.value;
                const _tv = (_tcs && _tcs !== 'random') ? _tcs : (['', 'red', 'green'][Math.floor(Math.random() * 3)]);
                const _to: any = { type: 'festival_tent' as any, x: gx, y: gy, angle: 0 };
                if (_tv) _to.colorVariant = _tv;
                m.objects.push(_to);
                break;
            }
            case 'festival_tent_broken': {
                const _tbcs = (document.getElementById('m_tent_broken_color') as HTMLSelectElement)?.value;
                const _tbv = (_tbcs && _tbcs !== 'random') ? _tbcs : (['', 'red', 'green'][Math.floor(Math.random() * 3)]);
                const _tbo: any = { type: 'festival_tent_broken' as any, x: gx, y: gy, angle: 0 };
                if (_tbv) _tbo.colorVariant = _tbv;
                m.objects.push(_tbo);
                break;
            }
            case 'festival_car': {
                const _fcs = (document.getElementById('m_fcar_color') as HTMLSelectElement)?.value ?? '';
                const _fco: any = { type: 'festival_car' as any, x: gx, y: gy, angle: 0 };
                if (_fcs) _fco.colorVariant = _fcs;
                m.objects.push(_fco);
                break;
            }
            case 'boat':
                m.objects.push({ ..._vesselBase('boat'), speed: 3 });
                break;
            case 'pilot_boat':
                m.objects.push(_vesselBase('pilot_boat'));
                break;
            case 'sar_boat':
                m.objects.push({ ..._vesselBase('sar_boat'), speed: 3 });
                break;
            case 'salvage_tug':
                m.objects.push(_vesselBase('salvage_tug'));
                break;
            case 'supply_vessel':
                m.objects.push(_vesselBase('supply_vessel'));
                break;
            case 'frigate':
                m.objects.push({ ..._vesselBase('frigate'), speed: 3 });
                break;
            case 'submarine':
                m.objects.push(_vesselBase('submarine'));
                break;
            case 'person':
            case 'rescuer':
            case 'crate':
                if (!m.payloads) m.payloads = [];
                m.payloads.push(makePayload(type as 'person' | 'rescuer' | 'crate', gx, gy, m));
                renderPayloadList();
                break;
            case 'smoke':
            case 'fire':
                if (!mAny.particleEmitters) mAny.particleEmitters = [];
                mAny.particleEmitters.push({ type, x: gx, y: gy });
                break;
            case 'ring':
                m.objects.push({ type: 'ring' as any, x: gx, y: gy, z: 4, radius: 2.5, angle: 0 });
                if (!mAny.objectives) mAny.objectives = [];
                if (!mAny.objectives.some((o: any) => o.type === 'ring_all'))
                    mAny.objectives.push({ type: 'ring_all' });
                break;
        }
        renderObjectList();
        drawMap();
        notifyWorkbench();
        broadcastPreview();
    };

    if (ctxMenu) {
        const _CTX_GROUPS = [
            { cat: 'Stat.', emoji: '🏗', items: [
                { v: 'pad', l: '🟩 Landepad' },
                { v: 'lighthouse', l: '🔦 Leuchtturm' },
                { v: 'research_platform', l: '🏗 Plattform' },
                { v: 'ring', l: '⭕ Ring' },
            ]},
            { cat: 'Fahr.', emoji: '🚢', items: [
                { v: 'carrier', l: '🚢 Träger' },
                { v: 'boat', l: '⛵ Boot' },
                { v: 'pilot_boat', l: '🚤 Lotsenboot' },
                { v: 'sar_boat', l: '🛥 SAR-Boot' },
                { v: 'salvage_tug', l: '🛳 Schlepper' },
                { v: 'supply_vessel', l: '🚢 Versorgungsschiff' },
                { v: 'frigate', l: '⚓ Fregatte' },
                { v: 'submarine', l: '🤿 U-Boot' },
            ]},
            { cat: 'Deko', emoji: '🌀', items: [
                { v: 'wind_turbine', l: '🌀 Windrad' },
                { v: 'plane_wreck', l: '✈️ Wrack' },
                { v: 'sailboat_broken', l: '⛵ Segel (gek.)' },
                { v: 'ornithopter_wreck', l: '🛸 Orni-Wrack' },
                { v: 'baywatch_car', l: '🚗 BW-Auto' },
                { v: 'baywatch_hq', l: '🏠 BW-HQ' },
                { v: 'baywatch_tower', l: '🗼 Wachturm' },
                { v: 'buoy', l: '🔴 Boje' },
                { v: 'concert_stage', l: '🎸 Bühne' },
                { v: 'festival_tent', l: '🎪 Zelt' },
                { v: 'festival_tent_broken', l: '🎪 Zelt (kap.)' },
                { v: 'festival_car', l: '🚙 Festival-Auto' },
            ]},
            { cat: 'Load', emoji: '📦', items: [
                { v: 'person', l: '🟡 Person' },
                { v: 'rescuer', l: '🔵 Retter' },
                { v: 'crate', l: '🟠 Crate' },
            ]},
            { cat: 'Ptcl', emoji: '✨', items: [
                { v: 'smoke', l: '💨 Rauch' },
                { v: 'fire', l: '🔥 Feuer + Rauch' },
            ]},
        ];

        let _ctxTabIdx = 0;

        const renderCtxMenuContent = () => {
            // keep the tab bar, replace content after it
            const tabBar = ctxMenu.querySelector('.ctx-tabs') as HTMLElement;
            // rebuild everything
            ctxMenu.innerHTML = '';

            // Tab bar
            const tabs = document.createElement('div');
            tabs.className = 'ctx-tabs';
            tabs.style.cssText = 'display:flex;border-bottom:1px solid #3a3a3a;background:#111';
            _CTX_GROUPS.forEach((g, gi) => {
                const t = document.createElement('button');
                t.textContent = g.cat;
                const isAct = gi === _ctxTabIdx;
                t.style.cssText = `flex:1;background:${isAct?'#1a3a5a':'none'};border:none;border-bottom:2px solid ${isAct?'#4af':'transparent'};color:${isAct?'#4af':'#888'};font-size:9px;padding:6px 2px 4px;cursor:pointer;font-family:inherit`;
                t.onmouseenter = () => { if (gi !== _ctxTabIdx) t.style.color = '#ccc'; };
                t.onmouseleave = () => { if (gi !== _ctxTabIdx) t.style.color = '#888'; };
                t.onclick = (ev) => { ev.stopPropagation(); _ctxTabIdx = gi; renderCtxMenuContent(); };
                tabs.appendChild(t);
            });
            ctxMenu.appendChild(tabs);

            // Items grid (2 columns)
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:6px';
            _CTX_GROUPS[_ctxTabIdx].items.forEach(item => {
                const btn = document.createElement('button');
                btn.textContent = item.l;
                btn.style.cssText = 'background:#1e1e1e;border:1px solid #3a3a3a;color:#ccc;font-size:11px;padding:5px 4px;cursor:pointer;border-radius:3px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
                btn.title = item.l.replace(/^.+? /, '');
                btn.onmouseenter = () => { btn.style.background = '#1a3a5a'; btn.style.borderColor = '#4af'; btn.style.color = '#fff'; };
                btn.onmouseleave = () => { btn.style.background = '#1e1e1e'; btn.style.borderColor = '#3a3a3a'; btn.style.color = '#ccc'; };
                btn.onclick = (ev) => { ev.stopPropagation(); _placeItem(item.v, _ctxGx, _ctxGy); hideCtxMenu(); };
                grid.appendChild(btn);
            });
            ctxMenu.appendChild(grid);
            if (tabBar) void tabBar; // silence TS unused warning
        };

        renderCtxMenuContent();

        document.addEventListener('mousedown', ev => {
            if (!ctxMenu.contains(ev.target as Node)) hideCtxMenu();
        });

        canvas.addEventListener('dblclick', ev => {
            const m = getCurrentMission();
            if (!m) return;
            const rect = canvas.getBoundingClientRect();
            const tSize = (600 / m.gridSize) * state.zoom;
            _ctxGx = Math.floor((ev.clientX - rect.left) / tSize + state.panX);
            _ctxGy = Math.floor((ev.clientY - rect.top) / tSize + state.panY);
            if (_ctxGx < 0 || _ctxGx >= m.gridSize || _ctxGy < 0 || _ctxGy >= m.gridSize) return;
            // clear object selection so no floating UI overlaps the context menu
            state.selectedObjectIdx = null;
            state.selectedPayloadIdx = null;
            state.isDraggingItem = false;
            drawMap();
            renderCtxMenuContent();
            ctxMenu.style.left = ev.clientX + 'px';
            ctxMenu.style.top = ev.clientY + 'px';
            ctxMenu.style.display = 'block';
            setTimeout(() => {
                const r = ctxMenu.getBoundingClientRect();
                if (r.right > window.innerWidth) ctxMenu.style.left = (ev.clientX - r.width) + 'px';
                if (r.bottom > window.innerHeight) ctxMenu.style.top = (ev.clientY - r.height) + 'px';
            }, 0);
        });
    }

    // ── Mouse down: object selection or paint ──────────────────────────────────
    canvas.onmousedown = e => {
        const rect = canvas.getBoundingClientRect();
        const m = getCurrentMission()!;
        const tSize = (600 / m.gridSize) * state.zoom;
        const mx = e.clientX - rect.left,
            my = e.clientY - rect.top;
        const gx = mx / tSize + state.panX,
            gy = my / tSize + state.panY;

        // Wind compass
        if (Math.hypot(mx - 50, my - 50) < 30) {
            state.selectedUI = state.selectedUI === 'wind' ? null : 'wind';
            state.selectedObjectIdx = null;
            drawMap();
            return;
        }

        // Move-Modus: M wurde gedrückt, Klick verschiebt selektiertes Objekt/Payload
        if (state.moveMode) {
            if (state.selectedObjectIdx !== null) {
                const obj = m.objects[state.selectedObjectIdx] as any;
                obj.x = Math.floor(gx);
                obj.y = Math.floor(gy);
                renderObjectList();
            } else if (state.selectedPayloadIdx !== null) {
                const p = m.payloads[state.selectedPayloadIdx] as any;
                const snapped = makePayload(p.type, Math.floor(gx), Math.floor(gy), m);
                m.payloads[state.selectedPayloadIdx] = {
                    ...snapped,
                    ...(p.deliverTo ? { deliverTo: p.deliverTo } : {}),
                    ...(p.npcTarget ? { npcTarget: p.npcTarget } : {}),
                } as any;
                renderPayloadList();
            }
            state.moveMode = false;
            updateMoveCursor();
            drawMap();
            return;
        }

        // Drag-Interception: beliebiges Tool, kein Shift → Payload/Objekt direkt ziehen
        if (!e.shiftKey) {
            const startDrag = (type: 'payload' | 'object' | 'emitter', idx: number, ox: number, oy: number) => {
                hidePopup();
                state.isDraggingItem = true;
                state.dragItemType = type;
                state.dragItemIdx = idx;
                state.dragHasMoved = false;
                state.dragWasSelected =
                    type === 'payload' ? state.selectedPayloadIdx === idx : state.selectedObjectIdx === idx;
                state.dragStartMX = e.clientX;
                state.dragStartMY = e.clientY;
                state.dragOrigX = ox;
                state.dragOrigY = oy;
                if (type === 'payload') {
                    state.selectedPayloadIdx = idx;
                    state.selectedObjectIdx = null;
                } else if (type === 'object') {
                    state.selectedObjectIdx = idx;
                    state.selectedPayloadIdx = null;
                } else {
                    // emitter — no floating UI selection
                    state.selectedObjectIdx = null;
                    state.selectedPayloadIdx = null;
                }
                state.selectedUI = null;
                drawMap();
            };

            const payloads = m.payloads || [];
            for (let i = 0; i < payloads.length; i++) {
                const p = payloads[i] as any;
                if (Math.hypot(gx - p.x, gy - p.y) < 2) {
                    startDrag('payload', i, p.x, p.y);
                    return;
                }
            }
            for (let i = 0; i < m.objects.length; i++) {
                const obj = m.objects[i] as any;
                let hit = false;
                if (obj.type === 'pad') hit = gx >= obj.x && gx <= obj.x + 8 && gy >= obj.y && gy <= obj.y + 8;
                else if (['carrier', 'boat', 'pilot_boat', 'sar_boat', 'salvage_tug', 'supply_vessel', 'frigate', 'submarine'].includes(obj.type))
                    hit = Math.hypot(gx - obj.x, gy - obj.y) < 6;
                else if (['lighthouse', 'research_platform', 'wind_turbine'].includes(obj.type))
                    hit = Math.hypot(gx - obj.x, gy - obj.y) < 2;
                else if (['plane_wreck', 'sailboat_broken', 'ornithopter_wreck', 'baywatch_car', 'baywatch_hq', 'baywatch_tower',
                    'concert_stage',
                    'festival_tent', 'festival_tent_broken', 'festival_car',
                    'xmas_house_a', 'xmas_house_b', 'sleigh', 'reindeer'].includes(obj.type))
                    hit = Math.hypot(gx - obj.x, gy - obj.y) < 3;
                else if (obj.type === 'xmas_lantern')
                    hit = Math.hypot(gx - obj.x, gy - obj.y) < 2.5;
                else if ((obj as any).type === 'ring')
                    hit = Math.hypot(gx - obj.x, gy - obj.y) < ((obj as any).radius ?? 2.5) + 1;
                if (hit) {
                    startDrag('object', i, obj.x, obj.y);
                    return;
                }
            }
            // Particle emitter drag
            const _mAny = m as any;
            if (_mAny.particleEmitters?.length) {
                for (let i = 0; i < _mAny.particleEmitters.length; i++) {
                    const em = _mAny.particleEmitters[i];
                    if (Math.hypot(gx - em.x, gy - em.y) < 2) {
                        startDrag('emitter', i, em.x, em.y);
                        return;
                    }
                }
            }
        }

        // Universal Shift+Click: delete nearest object / payload / particle emitter
        if (e.shiftKey) {
            const SNAP = 5;
            const m2 = getCurrentMission()!;
            // payloads
            let nPDist = SNAP, nPIdx = -1;
            (m2.payloads || []).forEach((p: any, i) => {
                const d = Math.hypot(gx - p.x, gy - p.y);
                if (d < nPDist) { nPDist = d; nPIdx = i; }
            });
            if (nPIdx >= 0) {
                m2.payloads.splice(nPIdx, 1);
                renderPayloadList(); drawMap(); notifyWorkbench();
                return;
            }
            // objects
            let nODist = SNAP, nOIdx = -1;
            m2.objects.forEach((o: any, i) => {
                const d = Math.hypot(gx - o.x, gy - o.y);
                if (d < nODist) { nODist = d; nOIdx = i; }
            });
            if (nOIdx >= 0) {
                m2.objects.splice(nOIdx, 1);
                if (state.selectedObjectIdx === nOIdx) state.selectedObjectIdx = null;
                renderObjectList(); drawMap(); notifyWorkbench();
                return;
            }
            // particle emitters
            const m2Any = m2 as any;
            if (m2Any.particleEmitters?.length) {
                let nEDist = SNAP, nEIdx = -1;
                m2Any.particleEmitters.forEach((em: any, i: number) => {
                    const d = Math.hypot(gx - em.x, gy - em.y);
                    if (d < nEDist) { nEDist = d; nEIdx = i; }
                });
                if (nEIdx >= 0) {
                    m2Any.particleEmitters.splice(nEIdx, 1);
                    drawMap(); notifyWorkbench();
                    return;
                }
            }
            // nothing found near cursor → fall through to paint (terrain/foliage erase)
        }

        state.selectedObjectIdx = null;
        state.selectedPayloadIdx = null;
        state.selectedUI = null;
        drawMap();
        if (state.currentTool === 'move') {
            state.isEditorDragging = true;
            state.lastMX = e.clientX;
            state.lastMY = e.clientY;
            canvas.style.cursor = 'grabbing';
        } else {
            state.isDrawing = true;
            paint(e);
        }
    };

    window.addEventListener('mousemove', e => {
        if (state.isDraggingItem) {
            if (Math.hypot(e.clientX - state.dragStartMX, e.clientY - state.dragStartMY) > 3) state.dragHasMoved = true;
            if (state.dragHasMoved) {
                const m = getCurrentMission()!;
                const tSize = (600 / m.gridSize) * state.zoom;
                const rect = canvas.getBoundingClientRect();
                const gx = (e.clientX - rect.left) / tSize + state.panX;
                const gy = (e.clientY - rect.top) / tSize + state.panY;
                if (state.dragItemType === 'payload')
                    Object.assign(m.payloads[state.dragItemIdx!], { x: Math.round(gx), y: Math.round(gy) });
                else if (state.dragItemType === 'object')
                    Object.assign(m.objects[state.dragItemIdx!], { x: Math.round(gx), y: Math.round(gy) });
                else if (state.dragItemType === 'emitter') {
                    const _em = (m as any).particleEmitters?.[state.dragItemIdx!];
                    if (_em) Object.assign(_em, { x: Math.round(gx), y: Math.round(gy) });
                }
                canvas.style.cursor = 'grabbing';
                drawMap();
            }
            return;
        }
        if (state.isEditorDragging) {
            const tSize = (600 / getCurrentMission()!.gridSize) * state.zoom;
            state.panX -= (e.clientX - state.lastMX) / tSize;
            state.panY -= (e.clientY - state.lastMY) / tSize;
            state.lastMX = e.clientX;
            state.lastMY = e.clientY;
            clampCamera();
            drawMap();
        } else if (state.isDrawing) {
            if (
                state.currentTool !== 'person' &&
                state.currentTool !== 'rescuer' &&
                state.currentTool !== 'crate' &&
                state.currentTool !== 'boat' &&
                state.currentTool !== 'pilot_boat' &&
                state.currentTool !== 'salvage_tug' &&
                state.currentTool !== 'supply_vessel' &&
                state.currentTool !== 'frigate' &&
                state.currentTool !== 'submarine' &&
                state.currentTool !== 'carrier' &&
                state.currentTool !== 'pad' &&
                state.currentTool !== 'lighthouse' &&
                state.currentTool !== 'research_platform' &&
                state.currentTool !== 'wind_turbine' &&
                state.currentTool !== 'plane_wreck' &&
                state.currentTool !== 'sailboat_broken' &&
                state.currentTool !== 'ornithopter_wreck' &&
                state.currentTool !== 'baywatch_car' &&
                state.currentTool !== 'baywatch_hq' &&
                state.currentTool !== 'baywatch_tower' &&
                state.currentTool !== 'concert_stage' &&
                state.currentTool !== 'festival_car' &&
                state.currentTool !== 'foliage'
            ) {
                paint(e);
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (state.isDraggingItem) {
            if (state.dragHasMoved) {
                const m = getCurrentMission()!;
                if (state.dragItemType === 'payload') {
                    const p = m.payloads[state.dragItemIdx!] as any;
                    const snapped = makePayload(p.type, p.x, p.y, m);
                    m.payloads[state.dragItemIdx!] = {
                        ...snapped,
                        ...(p.deliverTo ? { deliverTo: p.deliverTo } : {}),
                        ...(p.npcTarget ? { npcTarget: p.npcTarget } : {}),
                    } as any;
                    renderPayloadList();
                } else if (state.dragItemType === 'emitter') {
                    // emitters just need save + redraw, no list rebuild
                    notifyWorkbench();
                    broadcastPreview();
                } else {
                    renderObjectList();
                }
                notifyWorkbench();
                broadcastPreview();
            } else if (state.dragWasSelected) {
                // second click on already-selected item → deselect + close popup
                state.selectedPayloadIdx = null;
                state.selectedObjectIdx = null;
                hidePopup();
            } else if (!state.dragHasMoved && state.dragItemType === 'payload' && state.dragItemIdx !== null) {
                showPayloadPopup(state.dragItemIdx, state.dragStartMX, state.dragStartMY);
            } else if (!state.dragHasMoved && state.dragItemType === 'object' && state.dragItemIdx !== null) {
                const clickedObj = getCurrentMission()?.objects[state.dragItemIdx] as any;
                if (clickedObj?.type === 'ring')
                    showRingPopup(state.dragItemIdx, state.dragStartMX, state.dragStartMY);
            }
            state.isDraggingItem = false;
            state.dragItemType = null;
            state.dragItemIdx = null;
            state.dragHasMoved = false;
            updateCursor();
            drawMap();
            return;
        }
        if (state.isDrawing) {
            state.isDrawing = false;
            broadcastPreview();
        }
        if (state.isEditorDragging) {
            state.isEditorDragging = false;
            updateCursor();
        }
    });

    canvas.onwheel = e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const m = getCurrentMission()!;
        const tSize = (600 / m.gridSize) * state.zoom;
        const mx = e.clientX - rect.left,
            my = e.clientY - rect.top;
        const gx = mx / tSize + state.panX,
            gy = my / tSize + state.panY;
        const oldZoom = state.zoom;
        state.zoom = Math.max(1.0, Math.min(state.zoom + (e.deltaY < 0 ? 0.5 : -0.5), 15.0));
        if (state.zoom !== oldZoom) {
            const nSize = (600 / m.gridSize) * state.zoom;
            state.panX = gx - mx / nSize;
            state.panY = gy - my / nSize;
            clampCamera();
            drawMap();
        }
    };

    // Preview canvas interactions are handled in editor-preview.html / preview-main.ts

    // ── Export ─────────────────────────────────────────────────────────────────
    getEl('btn-export-campaign').onclick = () => {
        const savedIdx = state.curIdx;

        const data = state.campaign.map((m, i) => {
            const mAny = m as any;
            if (mAny.terrainRef !== undefined) {
                const { terrain, gridSize, sand, pavement, foliage, ...rest } = { ...mAny };
                return { ...rest, terrainRef: mAny.terrainRef };
            }
            state.curIdx = i;
            return {
                ...m,
                terrain: typeof m.terrain === 'string' ? m.terrain : compressTerrain(m.terrain),
                foliage: compressFoliage(
                    typeof mAny.foliage === 'string' ? decompressFoliage(mAny.foliage) : mAny.foliage || []
                ),
                ...(mAny.sand ? { sand: compressTerrain(mAny.sand) } : {}),
                ...(mAny.pavement ? { pavement: compressTerrain(mAny.pavement) } : {}),
            };
        });

        state.curIdx = savedIdx;

        const cSubDe = getEl<HTMLTextAreaElement>('c_sublines_de')
            .value.split('\n')
            .filter(l => l.trim());
        const cSubEn = getEl<HTMLTextAreaElement>('c_sublines_en')
            .value.split('\n')
            .filter(l => l.trim());
        const exportData = {
            type: getEl<HTMLSelectElement>('c_type').value || 'CSW_CAMPAIGN',
            campaignTitle: { de: getInput('c_title_de').value, en: getInput('c_title_en').value },
            campaignSublines: cSubDe.map((de, i) => ({ de, en: cSubEn[i] || '' })),
            levels: data,
        };
        getEl<HTMLTextAreaElement>('output').value = JSON.stringify(exportData);
        alert('Kampagne exportiert!');
    };

    // ── Import ─────────────────────────────────────────────────────────────────
    getEl('btn-import-campaign').onclick = () => {
        const raw = getEl<HTMLTextAreaElement>('output').value;
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const ct = parsed.campaignTitle;
            getInput('c_title_de').value = ct ? (typeof ct === 'string' ? ct : ct.de || '') : 'Imported Campaign';
            getInput('c_title_en').value = ct && typeof ct !== 'string' ? ct.en || '' : '';
            const cs: any[] = parsed.campaignSublines || [];
            getEl<HTMLTextAreaElement>('c_sublines_de').value = cs
                .map(s => (typeof s === 'string' ? s : s.de || ''))
                .join('\n');
            getEl<HTMLTextAreaElement>('c_sublines_en').value = cs
                .map(s => (typeof s === 'string' ? '' : s.en || ''))
                .join('\n');
            getEl<HTMLSelectElement>('c_type').value = parsed.type || 'CSW_CAMPAIGN';
            state.type = parsed.type;
            state.campaign = parsed.levels.map((m: any) => {
                if (m.terrainRef !== undefined) {
                    return { ...m, terrain: [] as any, gridSize: 0 } as Mission;
                }
                const base = {
                    ...m,
                    terrain: typeof m.terrain === 'string' ? decompressTerrain(m.terrain, m.gridSize) : m.terrain,
                    foliage: typeof m.foliage === 'string' ? decompressFoliage(m.foliage) : m.foliage || [],
                    ...(m.sand ? { sand: decompressTerrain(m.sand, m.gridSize) } : {}),
                    ...((m as any).pavement ? { pavement: decompressTerrain((m as any).pavement, m.gridSize) } : {}),
                } as Mission;
                delete (base as any).previewBase64;
                return base;
            });
            // Resolve terrainRefs to shared array references
            state.campaign.forEach((m: any) => {
                if (m.terrainRef !== undefined) {
                    const src = state.campaign[m.terrainRef] as any;
                    if (src) {
                        m.terrain = src.terrain;
                        m.gridSize = src.gridSize;
                        if (src.sand) m.sand = src.sand;
                        if (src.pavement) m.pavement = src.pavement;
                    }
                }
            });
            loadMission(0);
        } catch (e) {
            alert('Import Fehler!\n\n' + e);
        }
    };
};
