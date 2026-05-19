import { state, createEmptyMission, getCurrentMission } from './state';
import { drawMap } from './render';
import { compressTerrain, decompressTerrain, compressFoliage, decompressFoliage } from '@/shared/utils';
import { Mission } from '@/shared/types';

// Overrideable callback — set by VS Code bridge to receive state changes
let _onStateChanged: (() => void) | null = null;
export const setOnStateChanged = (fn: (() => void) | null): void => { _onStateChanged = fn; };

// Notify the Electron workbench parent frame that editor state has changed
const notifyWorkbench = () => {
    if (window.parent !== window) window.parent.postMessage({ type: 'editor-state-changed' }, '*');
    _onStateChanged?.();
};

// Broadcast current mission to the preview window via BroadcastChannel
const previewChannel = new BroadcastChannel('zeewolf-editor');
const broadcastPreview = () => {
    const m = getCurrentMission();
    if (!m) return;
    previewChannel.postMessage({ type: 'mission-update', mission: m });
};
// Re-broadcast when the preview window signals it's ready
previewChannel.onmessage = e => {
    if (e.data.type === 'preview-ready') broadcastPreview();
};

const getEl = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const getInput = (id: string) => getEl<HTMLInputElement>(id);

// ── Payload-Liste ─────────────────────────────────────────────────────────────
export const renderPayloadList = () => {
    const m = getCurrentMission();
    const container = getEl('payload-list');
    if (!container || !m) { notifyWorkbench(); return; }
    container.innerHTML = '';
    const payloads = m.payloads || [];
    if (payloads.length === 0) {
        container.innerHTML = '<span style="color:#555;font-size:11px">Keine Payloads platziert</span>';
        return;
    }
    payloads.forEach((p, i) => {
        const pa = p as any;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin:3px 0';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px';
        const icon = p.type === 'person' ? '🟡' : p.type === 'rescuer' ? '🔵' : '🟠';
        const typeName = p.type === 'person' ? 'Person' : p.type === 'rescuer' ? 'Retter' : 'Crate';
        const label = document.createElement('span');
        label.style.flex = '1';
        const attach = pa.attachTo
            ? ` → ${pa.attachTo.objectType} #${pa.attachTo.objectIdx + 1}`
            : '';
        label.innerText = `${i + 1}. ${icon} ${typeName} @ (${p.x}, ${p.y})${attach}`;

        // NPC-Target Checkbox
        const npcLabel = document.createElement('label');
        npcLabel.style.cssText = 'display:flex;align-items:center;gap:2px;color:#8af;white-space:nowrap;cursor:pointer';
        const npcCb = document.createElement('input');
        npcCb.type = 'checkbox';
        npcCb.checked = !!pa.npcTarget;
        npcCb.onchange = () => { pa.npcTarget = npcCb.checked; drawMap(); };
        npcLabel.append(npcCb, 'NPC');

        // deliverTo — only for crates
        let deliverToEl: HTMLElement | null = null;
        if (p.type === 'crate') {
            const hasPad      = m.objects.some((o: any) => o.type === 'pad');
            const hasCarrier  = m.objects.some((o: any) => o.type === 'carrier');
            const hasSub      = m.objects.some((o: any) => o.type === 'submarine');

            const sel = document.createElement('select');
            sel.style.cssText = 'background:#222;color:#fa8;border:1px solid #555;font-size:10px;padding:1px 3px;cursor:pointer';
            const opts: Array<[string, string]> = [['', 'Ziel: –']];
            if (hasPad)     opts.push(['pad',       'Ziel: Pad']);
            if (hasCarrier) opts.push(['carrier',   'Ziel: Carrier']);
            if (hasSub)     opts.push(['submarine', 'Ziel: U-Boot']);
            opts.forEach(([val, lbl]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text  = lbl;
                if ((pa.deliverTo ?? '') === val) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.onchange = () => {
                pa.deliverTo = sel.value || undefined;
                notifyWorkbench();
            };
            deliverToEl = sel;
        }

        const btnDel = document.createElement('button');
        btnDel.innerText = 'X';
        btnDel.style.cssText = 'background:#822;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px';
        btnDel.onclick = () => { m.payloads.splice(i, 1); renderPayloadList(); drawMap(); };
        row.append(label, npcLabel, ...(deliverToEl ? [deliverToEl] : []), btnDel);
        wrap.appendChild(row);

        // localX / localY — only when attached to a vessel
        if (pa.attachTo) {
            const offsetRow = document.createElement('div');
            offsetRow.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;padding-left:12px;margin-top:2px';
            const makeOffsetInput = (axis: 'localX' | 'localY', axisLabel: string) => {
                const lbl = document.createElement('span');
                lbl.innerText = axisLabel + ':';
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '0.5';
                inp.value = String(pa.attachTo[axis] ?? 0);
                inp.style.cssText = 'width:48px;background:#222;color:#ddd;border:1px solid #444;padding:1px 3px;font-size:10px';
                inp.onchange = () => {
                    pa.attachTo[axis] = parseFloat(inp.value) || 0;
                    notifyWorkbench();
                    drawMap();
                };
                return [lbl, inp];
            };
            offsetRow.append(
                document.createTextNode('offset '),
                ...makeOffsetInput('localX', 'X'),
                ...makeOffsetInput('localY', 'Y'),
            );
            wrap.appendChild(offsetRow);
        }

        container.appendChild(wrap);
    });
    notifyWorkbench();
};

// ── Object-Liste (Carrier / Boats / Lighthouse) ───────────────────────────────
export const renderObjectList = () => {
    const m = getCurrentMission();
    const container = getEl('object-list');
    if (!container || !m) return;
    container.innerHTML = '';
    m.objects.forEach((obj, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;font-size:11px';
        const icons: Record<string, string> = { pad: '🟩', carrier: '🚢', boat: '⛵', pilot_boat: '🚤', salvage_tug: '🛳', submarine: '🤿', lighthouse: '🔦', research_platform: '🏗', wind_turbine: '🌀', plane_wreck: '✈️', sailboat_broken: '⛵', ornithopter_wreck: '🛸' };
        const label = document.createElement('span');
        label.style.flex = '1';
        label.innerText = `${icons[obj.type] || '?'} ${obj.type} @ (${obj.x}, ${obj.y})`;
        const btnDel = document.createElement('button');
        btnDel.innerText = 'X';
        btnDel.style.cssText = 'background:#822;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px';
        btnDel.onclick = () => {
            m.objects.splice(idx, 1);
            if (state.selectedObjectIdx === idx) state.selectedObjectIdx = null;
            renderObjectList();
            drawMap();
        };
        row.append(label, btnDel);
        container.appendChild(row);
    });
    notifyWorkbench();
};

// ── Foliage-Liste ─────────────────────────────────────────────────────────────
export const renderFoliageList = () => {
    const m = getCurrentMission();
    const container = getEl('foliage-list');
    const countEl = getEl('foliage-count');
    if (!container || !m) return;
    const foliage = (m as any).foliage || [];
    if (countEl) countEl.innerText = `(${foliage.length} Objekte)`;
    if (foliage.length === 0) {
        container.innerHTML = '<span style="color:#555">Keine Bäume platziert</span>';
        return;
    }
    const icons: Record<string, string> = { pine: '🌲', oak: '🌳', bush: '🌿', dead: '🪵' };
    const counts: Record<string, number> = {};
    foliage.forEach((f: any) => {
        counts[f.type] = (counts[f.type] || 0) + 1;
    });
    container.innerHTML = Object.entries(counts)
        .map(([type, n]) => `${icons[type] || '🌲'} ${type}: <strong style="color:#5f5">${n}</strong>`)
        .join(' &nbsp;|&nbsp; ');
    notifyWorkbench();
};
const _lsDe = (ls: string | { de: string; en?: string } | undefined): string =>
    !ls ? '' : typeof ls === 'string' ? ls : (ls.de || '');
const _lsEn = (ls: string | { de: string; en?: string } | undefined): string =>
    !ls ? '' : typeof ls === 'string' ? '' : (ls.en || '');

export const syncToData = () => {
    const m = getCurrentMission();
    if (!m) return;
    m.headline = { de: getInput('m_headline_de').value, en: getInput('m_headline_en').value };
    const subDe = getEl<HTMLTextAreaElement>('m_sublines_de').value.split('\n').filter(l => l.trim());
    const subEn = getEl<HTMLTextAreaElement>('m_sublines_en').value.split('\n').filter(l => l.trim());
    m.sublines = subDe.map((de, i) => ({ de, en: subEn[i] || '' }));
    m.briefing = { de: getEl<HTMLTextAreaElement>('m_briefing_de').value, en: getEl<HTMLTextAreaElement>('m_briefing_en').value };
    m.rain = getInput('m_rain').checked;
    m.night = getInput('m_night').checked;
    (m as any).waterLevel = parseFloat(getInput('m_water_level').value) || 0;
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
    const _boatTypes = new Set(['boat', 'pilot_boat', 'salvage_tug']);
    if (!obj || (kind === 'boat' ? !_boatTypes.has(obj.type) : obj.type !== kind)) return;
    const prefix = kind === 'carrier' ? 'carrier' : kind === 'submarine' ? 'submarine' : 'boat';
    obj.path = (document.getElementById(`m_${prefix}_path`) as HTMLSelectElement)?.value ?? obj.path;
    obj.speed = parseFloat((document.getElementById(`m_${prefix}_speed`) as HTMLInputElement)?.value) || 0;
    obj.radius = parseFloat((document.getElementById(`m_${prefix}_radius`) as HTMLInputElement)?.value) || 40;
    obj.angle = parseInt((document.getElementById(`m_${prefix}_angle`) as HTMLInputElement)?.value) || 0;
    drawMap();
    broadcastPreview();
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
    getInput('m_night').checked = m.night;
    getInput('m_water_level').value = ((m as any).waterLevel ?? 0).toString();
    getInput('m_wind_dir').value = m.windDir.toString();
    getInput('m_wind_str').value = m.windStr.toString();
    getInput('m_wind_var').checked = m.windVar;
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
const renderMissionList = () => {
    const container = getEl('mission-list');
    container.innerHTML = '';
    state.campaign.forEach((m, i) => {
        const div = document.createElement('div');
        div.className = 'mission-item' + (i === state.curIdx ? ' active' : '');
        const span = document.createElement('span');
        span.innerText = `${i + 1}. ${_lsDe(m.headline).substring(0, 18)}`;
        const controls = document.createElement('div');
        controls.className = 'm-controls';
        const btnUp = document.createElement('button');
        btnUp.innerText = '↑';
        btnUp.onclick = e => {
            e.stopPropagation();
            moveM(i, -1);
        };
        const btnDown = document.createElement('button');
        btnDown.innerText = '↓';
        btnDown.onclick = e => {
            e.stopPropagation();
            moveM(i, 1);
        };
        const btnDel = document.createElement('button');
        btnDel.innerText = 'X';
        btnDel.style.background = '#822';
        btnDel.onclick = e => {
            e.stopPropagation();
            delM(i);
        };
        controls.append(btnUp, btnDown, btnDel);
        div.append(span, controls);
        div.onclick = () => loadMission(i);
        container.appendChild(div);
    });
    notifyWorkbench();
};

const moveM = (i: number, dir: number) => {
    if (i + dir < 0 || i + dir >= state.campaign.length) return;
    [state.campaign[i], state.campaign[i + dir]] = [state.campaign[i + dir], state.campaign[i]];
    loadMission(i + dir);
};

const delM = (i: number) => {
    if (state.campaign.length <= 1) return;
    if (confirm('Mission wirklich löschen?')) {
        state.campaign.splice(i, 1);
        loadMission(Math.max(0, i - 1));
    }
};

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
        if (obj.type !== 'carrier' && obj.type !== 'boat' && obj.type !== 'submarine' && obj.type !== 'sailboat_broken') continue;
        const d = Math.hypot(gx - obj.x, gy - obj.y);
        if (d <= nearestDist) {
            nearestDist = d;
            nearestIdx = i;
        }
    }
    if (nearestIdx >= 0) {
        const obj = m.objects[nearestIdx] as any;
        return { type, x: gx, y: gy, attachTo: { objectType: obj.type as 'carrier' | 'boat' | 'submarine' | 'sailboat_broken', objectIdx: nearestIdx } };
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
                if (Math.hypot(dx, dy) <= state.brushRadius && m.terrain[gx + dx]) m.terrain[gx + dx][gy + dy] = h;
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
            // Remove nearest boat
            let nearestIdx = -1,
                nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'boat') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            });
            if (nearestIdx >= 0) m.objects.splice(nearestIdx, 1);
        } else {
            // Move nearest boat if close enough, otherwise add new
            let nearestIdx = -1,
                nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'boat') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            });
            if (nearestIdx >= 0) {
                m.objects[nearestIdx] = { ...m.objects[nearestIdx], x: gx, y: gy };
            } else {
                m.objects.push({ type: 'boat', x: gx, y: gy, angle: 0, path: 'circle', speed: 3, radius: 20 });
            }
        }
    } else if (state.currentTool === 'submarine') {
        if (e.shiftKey) {
            let nearestIdx = -1, nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'submarine') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
            });
            if (nearestIdx >= 0) m.objects.splice(nearestIdx, 1);
        } else {
            let nearestIdx = -1, nearestDist = 8;
            m.objects.forEach((o, i) => {
                if (o.type !== 'submarine') return;
                const d = Math.hypot(o.x - gx, o.y - gy);
                if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
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
                const h = m.terrain[Math.round(fx)]?.[Math.round(fy)] ?? -1;
                if (h <= 0.05) continue; // kein Wasser
                const scale = parseFloat(
                    (document.getElementById('foliage-scale') as HTMLInputElement)?.value || '1.0'
                );
                const type = (document.getElementById('foliage-type') as HTMLSelectElement)?.value || 'pine';
                foliage.push({ x: Math.round(fx * 10) / 10, y: Math.round(fy * 10) / 10, s: scale, type });
            }
        }
        renderFoliageList();
    }

    if (state.currentTool === 'terrain' || state.currentTool === 'flatten')
        smoothCoast(m, gx, gy, Math.ceil(state.brushRadius) + 2);

    renderObjectList();
    drawMap();
};

// ── Init ───────────────────────────────────────────────────────────────────────
export const initUI = () => {
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
    ['carrier_path', 'carrier_speed', 'carrier_radius', 'carrier_angle'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('carrier'))
    );
    ['boat_path', 'boat_speed', 'boat_radius', 'boat_angle'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('boat'))
    );
    ['submarine_path', 'submarine_speed', 'submarine_radius', 'submarine_angle'].forEach(id =>
        document.getElementById(`m_${id}`)?.addEventListener('input', () => syncVesselFromUI('submarine'))
    );

    // General sync
    [
        'm_headline_de', 'm_headline_en',
        'm_briefing_de', 'm_briefing_en',
        'm_rain',
        'm_night',
        'm_wind_dir',
        'm_wind_str',
        'm_wind_var',
        'm_npc_heli_count',
        'm_npc_heli_type',
        'm_sublines_de', 'm_sublines_en',
    ].forEach(id => getEl(id)?.addEventListener('input', syncToData));

    const canvas = getEl<HTMLCanvasElement>('editorCanvas');

    // ── Custom Cursor ──────────────────────────────────────────────────────────
    const cursorEl = document.createElement('canvas');
    cursorEl.id = 'brush-cursor';
    cursorEl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;display:none;';
    document.body.appendChild(cursorEl);
    const cursorCtx = cursorEl.getContext('2d')!;
    const PAINT_TOOLS = new Set(['terrain', 'flatten', 'foliage']);
    const POINT_TOOLS = new Set(['pad', 'carrier', 'boat', 'pilot_boat', 'salvage_tug', 'submarine', 'lighthouse', 'research_platform', 'wind_turbine', 'plane_wreck', 'sailboat_broken', 'ornithopter_wreck', 'person', 'rescuer', 'crate']);
    const dotColors: Record<string, string> = {
        pad: '#5f5',
        carrier: '#88aaff',
        boat: '#4af',
        submarine: '#888',
        lighthouse: '#ffdd44',
        plane_wreck: '#aaa',
        sailboat_broken: '#b96',
        ornithopter_wreck: '#aaa',
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
            state.moveMode = false;
            state.selectedObjectIdx = null;
            state.selectedPayloadIdx = null;
            updateMoveCursor();
            drawMap();
        }
    });

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
                p.x = Math.floor(gx);
                p.y = Math.floor(gy);
                // Snap prüfen nach Verschiebung
                const snapped = makePayload(p.type, p.x, p.y, m);
                m.payloads[state.selectedPayloadIdx] = { ...snapped };
                renderPayloadList();
            }
            state.moveMode = false;
            updateMoveCursor();
            drawMap();
            return;
        }

        // Click on existing object?
        if (!e.shiftKey) {
            // Erst Payloads prüfen (kleiner, leichter zu verfehlen)
            if (state.currentTool === 'person' || state.currentTool === 'rescuer' || state.currentTool === 'crate' || state.currentTool === 'move') {
                const payloads = m.payloads || [];
                for (let i = 0; i < payloads.length; i++) {
                    if (Math.hypot(gx - payloads[i].x, gy - payloads[i].y) < 2) {
                        state.selectedPayloadIdx = state.selectedPayloadIdx === i ? null : i;
                        state.selectedObjectIdx = null;
                        state.selectedUI = null;
                        drawMap();
                        return;
                    }
                }
            }
            for (let i = 0; i < m.objects.length; i++) {
                const obj = m.objects[i];
                let hit = false;
                if (obj.type === 'pad') hit = gx >= obj.x && gx <= obj.x + 8 && gy >= obj.y && gy <= obj.y + 8;
                else if (obj.type === 'carrier' || obj.type === 'boat' || obj.type === 'pilot_boat' || obj.type === 'salvage_tug' || obj.type === 'submarine') hit = Math.hypot(gx - obj.x, gy - obj.y) < 6;
                else if (obj.type === 'lighthouse' || obj.type === 'research_platform' || obj.type === 'wind_turbine') hit = Math.hypot(gx - obj.x, gy - obj.y) < 2;
                else if ((obj as any).type === 'plane_wreck' || (obj as any).type === 'sailboat_broken' || (obj as any).type === 'ornithopter_wreck') hit = Math.hypot(gx - (obj as any).x, gy - (obj as any).y) < 3;
                if (hit) {
                    state.selectedObjectIdx = state.selectedObjectIdx === i ? null : i;
                    state.selectedPayloadIdx = null;
                    state.selectedUI = null;
                    drawMap();
                    return;
                }
            }
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
                state.currentTool !== 'submarine' &&
                state.currentTool !== 'carrier' &&
                state.currentTool !== 'pad' &&
                state.currentTool !== 'lighthouse' &&
                state.currentTool !== 'research_platform' &&
                state.currentTool !== 'wind_turbine' &&
                state.currentTool !== 'plane_wreck' &&
                state.currentTool !== 'sailboat_broken' &&
                state.currentTool !== 'ornithopter_wreck' &&
                state.currentTool !== 'foliage'
            ) {
                paint(e);
            }
        }
    });

    window.addEventListener('mouseup', () => {
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
            state.curIdx = i;
            console.log('CURR', state.curIdx);
            return {
                ...m,
                terrain: typeof m.terrain === 'string' ? m.terrain : compressTerrain(m.terrain),
                foliage: compressFoliage(
                    typeof (m as any).foliage === 'string'
                        ? decompressFoliage((m as any).foliage)
                        : (m as any).foliage || []
                ),
            };
        });

        state.curIdx = savedIdx;

        const briefingSong = getEl<HTMLSelectElement>('c_music_briefing').value;
        const ingameSong   = getEl<HTMLSelectElement>('c_music_ingame').value;
        const cSubDe = getEl<HTMLTextAreaElement>('c_sublines_de').value.split('\n').filter(l => l.trim());
        const cSubEn = getEl<HTMLTextAreaElement>('c_sublines_en').value.split('\n').filter(l => l.trim());
        const exportData = {
            type: getEl<HTMLSelectElement>('c_type').value || 'ZEEWOLF_CAMPAIGN',
            campaignTitle: { de: getInput('c_title_de').value, en: getInput('c_title_en').value },
            campaignSublines: cSubDe.map((de, i) => ({ de, en: cSubEn[i] || '' })),
            ...(briefingSong || ingameSong ? { music: {
                ...(briefingSong ? { briefing: briefingSong } : {}),
                ...(ingameSong   ? { ingame:   ingameSong   } : {}),
            } } : {}),
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
            if (parsed.type === 'tutorial') {
                document.getElementById('editor-tutorial-guard')?.remove();
                const banner = document.createElement('div');
                banner.id = 'editor-tutorial-guard';
                banner.style.cssText =
                    'background:#6b0000;color:#fff;font-weight:bold;padding:10px 16px;' +
                    'margin-bottom:8px;border-radius:3px;border:1px solid #c00;font-size:13px;line-height:1.4;';
                banner.textContent =
                    'Tutorial-Kampagnen sind schreibgeschützt und können nicht im Editor bearbeitet werden.';
                getEl('output').insertAdjacentElement('beforebegin', banner);
                setTimeout(() => banner.remove(), 8000);
                return;
            }
            const ct = parsed.campaignTitle;
            getInput('c_title_de').value = ct ? (typeof ct === 'string' ? ct : (ct.de || '')) : 'Imported Campaign';
            getInput('c_title_en').value = ct && typeof ct !== 'string' ? (ct.en || '') : '';
            const cs: any[] = parsed.campaignSublines || [];
            getEl<HTMLTextAreaElement>('c_sublines_de').value = cs.map(s => typeof s === 'string' ? s : (s.de || '')).join('\n');
            getEl<HTMLTextAreaElement>('c_sublines_en').value = cs.map(s => typeof s === 'string' ? '' : (s.en || '')).join('\n');
            getEl<HTMLSelectElement>('c_type').value = parsed.type || 'ZEEWOLF_CAMPAIGN';
            getEl<HTMLSelectElement>('c_music_briefing').value = parsed.music?.briefing || '';
            getEl<HTMLSelectElement>('c_music_ingame').value   = parsed.music?.ingame   || '';
            state.type = parsed.type;
            state.campaign = parsed.levels.map((m: any) => {
                const base = {
                    ...m,
                    terrain: typeof m.terrain === 'string' ? decompressTerrain(m.terrain, m.gridSize) : m.terrain,
                    foliage: typeof m.foliage === 'string' ? decompressFoliage(m.foliage) : m.foliage || [],
                } as Mission;
                delete (base as any).previewBase64;
                return base;
            });
            loadMission(0);
        } catch (e) {
            alert('Import Fehler!\n\n' + e);
        }
    };
};
