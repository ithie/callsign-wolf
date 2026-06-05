import { state, getCurrentMission } from './state';
import { COLORS, getLandColor, getSandColor } from '@/shared/constants';

const canvas = document.getElementById('editorCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

export const drawMap = () => {
    const m = getCurrentMission();
    if (!m) return;

    ctx.clearRect(0, 0, 600, 600);
    const tSize = (600 / m.gridSize) * state.zoom;

    const pUI = document.getElementById('ui_pad') as HTMLElement;
    const cUI = document.getElementById('ui_carrier') as HTMLElement;
    const bUI = document.getElementById('ui_boat') as HTMLElement;
    const sUI = document.getElementById('ui_submarine') as HTMLElement;
    const wUI = document.getElementById('ui_wind') as HTMLElement;
    const wtUI = document.getElementById('ui_wt') as HTMLElement;
    const pwUI = document.getElementById('ui_plane_wreck') as HTMLElement;
    const sbUI = document.getElementById('ui_sailboat_broken') as HTMLElement;
    const owUI = document.getElementById('ui_ornithopter_wreck') as HTMLElement;

    if (pUI) pUI.style.display = 'none';
    if (cUI) cUI.style.display = 'none';
    if (bUI) bUI.style.display = 'none';
    if (sUI) sUI.style.display = 'none';
    if (wtUI) wtUI.style.display = 'none';
    if (wUI) wUI.style.display = 'none';
    if (pwUI) pwUI.style.display = 'none';
    if (sbUI) sbUI.style.display = 'none';
    if (owUI) owUI.style.display = 'none';

    // ── Terrain ────────────────────────────────────────────────────────────────
    for (let x = Math.floor(state.panX); x < Math.min(m.gridSize, state.panX + 600 / tSize + 1); x++) {
        for (let y = Math.floor(state.panY); y < Math.min(m.gridSize, state.panY + 600 / tSize + 1); y++) {
            const h = m.terrain[x][y];
            const isSand = h > 0 && ((m as any).sand?.[x]?.[y] ?? 0) > 0;
            ctx.fillStyle = h <= 0 ? COLORS.water : isSand ? getSandColor(h) : getLandColor(h, false);
            ctx.fillRect((x - state.panX) * tSize, (y - state.panY) * tSize, tSize + 1.5, tSize + 1.5);
        }
    }

    // ── Objects ────────────────────────────────────────────────────────────────
    m.objects.forEach((obj, idx) => {
        const isSelected = state.selectedObjectIdx === idx;
        const ox = (obj.x - state.panX) * tSize;
        const oy = (obj.y - state.panY) * tSize;

        if (obj.type === 'pad') {
            if (isSelected) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = COLORS.padStroke;
            }
            ctx.fillStyle = COLORS.padFill;
            ctx.fillRect(ox, oy, 7 * tSize, 7 * tSize);
            ctx.strokeStyle = COLORS.padStroke;
            ctx.strokeRect(ox, oy, 7 * tSize, 7 * tSize);
            ctx.fillStyle = COLORS.textLight;
            ctx.beginPath();
            ctx.arc(ox + 3.5 * tSize, oy + 3.5 * tSize, Math.max(4, tSize / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (m.spawnObject === 'pad') {
                ctx.fillStyle = COLORS.uiHighlight;
                ctx.font = 'bold 12px monospace';
                ctx.fillText('START', ox, oy - 5);
            }
            if (isSelected && pUI) {
                pUI.style.display = 'block';
                pUI.style.left = Math.min(600 - 150, Math.max(0, ox + 8 * tSize + 10)) + 'px';
                pUI.style.top = Math.min(600 - 100, Math.max(0, oy)) + 'px';
                const btn = document.getElementById('btn_spawn_pad');
                if (btn) btn.style.background = m.spawnObject === 'pad' ? COLORS.uiHighlight : 'var(--accent)';
            }
        } else if (obj.type === 'carrier' || obj.type === 'boat' || obj.type === 'pilot_boat' || obj.type === 'salvage_tug') {
            const isCarrier = obj.type === 'carrier';
            const rad = (obj.angle * Math.PI) / 180;

            // Path line / ellipse
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = isCarrier ? COLORS.carrierPath : '#4af';
            if (obj.path === 'straight') {
                ctx.beginPath();
                ctx.moveTo(ox, oy);
                ctx.lineTo(ox + Math.cos(rad) * 1000, oy + Math.sin(rad) * 1000);
                ctx.stroke();
            } else if (obj.path === 'circle') {
                const rX = obj.radius * tSize;
                const rY = rX * 0.8;
                const t0 = Math.atan2(-Math.cos(rad) / rX, Math.sin(rad) / rY);
                const centerGridX = obj.x - Math.cos(t0) * obj.radius;
                const centerGridY = obj.y - Math.sin(t0) * obj.radius * 0.8;
                const c_px = (centerGridX - state.panX) * tSize;
                const c_py = (centerGridY - state.panY) * tSize;
                ctx.beginPath();
                ctx.ellipse(c_px, c_py, rX, rY, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = isCarrier ? COLORS.carrierPath : '#4af';
                ctx.fillRect(c_px - 3, c_py - 3, 6, 6);
            }
            ctx.restore();

            // Ship body
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(rad);
            if (isSelected) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = COLORS.textLight;
            }

            if (isCarrier) {
                ctx.fillStyle = COLORS.carrierBase;
                ctx.fillRect(-8 * tSize, -3.5 * tSize, 16 * tSize, 7 * tSize);
                ctx.fillStyle = COLORS.carrierAccent;
                ctx.beginPath();
                ctx.moveTo(8 * tSize, 0);
                ctx.lineTo(5 * tSize, -3.5 * tSize);
                ctx.lineTo(5 * tSize, 3.5 * tSize);
                ctx.fill();
            } else if (obj.type === 'pilot_boat') {
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(-4 * tSize, -1.5 * tSize, 8 * tSize, 3 * tSize);
                ctx.fillStyle = '#eebb00';
                ctx.beginPath();
                ctx.moveTo(4 * tSize, 0);
                ctx.lineTo(2 * tSize, -1.5 * tSize);
                ctx.lineTo(2 * tSize, 1.5 * tSize);
                ctx.fill();
                // Cabin
                ctx.fillStyle = '#444';
                ctx.fillRect(-1.5 * tSize, -1 * tSize, 3 * tSize, 2 * tSize);
            } else if (obj.type === 'salvage_tug') {
                ctx.fillStyle = '#888';
                ctx.fillRect(-7 * tSize, -2.5 * tSize, 14 * tSize, 5 * tSize);
                ctx.fillStyle = '#aaa';
                ctx.beginPath();
                ctx.moveTo(7 * tSize, 0);
                ctx.lineTo(4 * tSize, -2.5 * tSize);
                ctx.lineTo(4 * tSize, 2.5 * tSize);
                ctx.fill();
                // Bridge
                ctx.fillStyle = '#eee';
                ctx.fillRect(1 * tSize, -1.5 * tSize, 4 * tSize, 3 * tSize);
            } else {
                // Sailboat: schlanker Rumpf
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.moveTo(5 * tSize, 0);
                ctx.lineTo(-4 * tSize, -2 * tSize);
                ctx.lineTo(-4 * tSize, 2 * tSize);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillRect(-4 * tSize, -0.3 * tSize, 9 * tSize, 0.6 * tSize);
                // Mast
                ctx.strokeStyle = '#bbb';
                ctx.lineWidth = Math.max(1, tSize * 0.3);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -6 * tSize);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;

            ctx.translate(0, 0);
            ctx.rotate(-rad);
            ctx.fillStyle = COLORS.textDark;
            ctx.font = 'bold 11px monospace';
            ctx.fillText(obj.speed + 'kn', -15, 4);
            if (m.spawnObject === obj.type) {
                ctx.fillStyle = COLORS.uiHighlight;
                ctx.fillText('START', -15, -15);
            }
            ctx.restore();

            // Floating UI panel
            if (isSelected) {
                const panel = isCarrier ? cUI : bUI;
                if (panel) {
                    panel.style.display = 'block';
                    panel.style.left = Math.min(600 - 180, Math.max(0, ox + 20)) + 'px';
                    panel.style.top = Math.min(600 - 200, Math.max(0, oy + 20)) + 'px';
                    // sync form fields
                    syncVesselUI(obj, isCarrier ? 'carrier' : 'boat');
                    if (isCarrier) {
                        const btn = document.getElementById('btn_spawn_carrier');
                        if (btn)
                            btn.style.background = m.spawnObject === 'carrier' ? COLORS.uiHighlight : 'var(--accent)';
                    }
                }
            }
        } else if (obj.type === 'submarine') {
            const rad = (obj.angle * Math.PI) / 180;
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#666';
            if (obj.path === 'straight') {
                ctx.beginPath();
                ctx.moveTo(ox, oy);
                ctx.lineTo(ox + Math.cos(rad) * 1000, oy + Math.sin(rad) * 1000);
                ctx.stroke();
            } else if (obj.path === 'circle') {
                const rX = obj.radius * tSize, rY = rX * 0.8;
                const t0 = Math.atan2(-Math.cos(rad) / rX, Math.sin(rad) / rY);
                const c_px = ((obj.x - Math.cos(t0) * obj.radius) - state.panX) * tSize;
                const c_py = ((obj.y - Math.sin(t0) * obj.radius * 0.8) - state.panY) * tSize;
                ctx.beginPath(); ctx.ellipse(c_px, c_py, rX, rY, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(rad);
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#aaa'; }
            // Hull
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.moveTo(6 * tSize, 0);
            ctx.lineTo(4 * tSize, -1.2 * tSize);
            ctx.lineTo(-5 * tSize, -1.2 * tSize);
            ctx.lineTo(-5.5 * tSize, 0);
            ctx.lineTo(-5 * tSize, 1.2 * tSize);
            ctx.lineTo(4 * tSize, 1.2 * tSize);
            ctx.closePath();
            ctx.fill();
            // Conning tower
            ctx.fillStyle = '#222';
            ctx.fillRect(0.5 * tSize, -0.5 * tSize, 1.8 * tSize, 1 * tSize);
            ctx.shadowBlur = 0;
            ctx.rotate(-rad);
            ctx.fillStyle = '#999';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(obj.speed + 'kn', -15, 4);
            ctx.restore();
            if (isSelected && sUI) {
                sUI.style.display = 'block';
                sUI.style.left = Math.min(600 - 180, Math.max(0, ox + 20)) + 'px';
                sUI.style.top = Math.min(600 - 150, Math.max(0, oy + 20)) + 'px';
                syncVesselUI(obj, 'submarine');
            }
        } else if (obj.type === 'lighthouse') {
            const lx = (obj.x + 0.5 - state.panX) * tSize;
            const ly = (obj.y + 0.5 - state.panY) * tSize;
            ctx.fillStyle = COLORS.lighthouseBase;
            ctx.beginPath();
            ctx.arc(lx, ly, tSize * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLORS.lighthouseLight;
            ctx.beginPath();
            ctx.arc(lx, ly, tSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else if (obj.type === 'research_platform') {
            const rx = (obj.x - state.panX) * tSize;
            const ry = (obj.y - state.panY) * tSize;
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#4af'; }
            // Pylon
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(rx - 0.4 * tSize, ry - 0.4 * tSize, 0.8 * tSize, 0.8 * tSize);
            // Main deck
            ctx.fillStyle = '#666';
            ctx.fillRect(rx - 1.5 * tSize, ry - 1.5 * tSize, 3 * tSize, 3 * tSize);
            // Helideck (offset to the left: x=-3.5..-1.5)
            ctx.fillStyle = '#2a8f2a';
            ctx.fillRect(rx - 3.5 * tSize, ry - 1.2 * tSize, 2 * tSize, 2.4 * tSize);
            // H marker on helideck
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.max(1, tSize * 0.2);
            ctx.beginPath();
            ctx.moveTo(rx - 3.1 * tSize, ry - 0.7 * tSize);
            ctx.lineTo(rx - 3.1 * tSize, ry + 0.7 * tSize);
            ctx.moveTo(rx - 2.4 * tSize, ry - 0.7 * tSize);
            ctx.lineTo(rx - 2.4 * tSize, ry + 0.7 * tSize);
            ctx.moveTo(rx - 3.1 * tSize, ry);
            ctx.lineTo(rx - 2.4 * tSize, ry);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (obj.type === 'wind_turbine') {
            const wx = (obj.x + 0.5 - state.panX) * tSize;
            const wy = (obj.y + 0.5 - state.panY) * tSize;
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#4f4'; }
            // Pole
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(wx, wy, tSize * 0.25, 0, Math.PI * 2);
            ctx.fill();
            // Blades (3)
            ctx.strokeStyle = '#eee';
            ctx.lineWidth = Math.max(1, tSize * 0.15);
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.lineTo(wx + Math.cos(a) * 3 * tSize, wy + Math.sin(a) * 3 * tSize);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
            if (isSelected && wtUI) {
                wtUI.style.display = 'block';
                wtUI.style.left = Math.min(600 - 140, Math.max(0, wx + 20)) + 'px';
                wtUI.style.top = Math.min(600 - 60, Math.max(0, wy + 20)) + 'px';
                const spinEl = document.getElementById('m_wt_spinning') as HTMLInputElement;
                if (spinEl) spinEl.checked = !!(obj as any).spinning;
            }
        } else if ((obj as any).type === 'plane_wreck') {
            const pw = obj as any;
            const ox = (pw.x + 0.5 - state.panX) * tSize;
            const oy = (pw.y + 0.5 - state.panY) * tSize;
            const rad = ((pw.angle ?? 0) * Math.PI) / 180;
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#fa0'; }
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(rad);
            // Scorch mark
            ctx.fillStyle = '#1a1612';
            ctx.beginPath();
            ctx.ellipse(0.3 * tSize, 0, 1.2 * tSize, 0.7 * tSize, 0, 0, Math.PI * 2);
            ctx.fill();
            // Fuselage
            ctx.fillStyle = '#d4c022';
            ctx.fillRect(-1.5 * tSize, -0.15 * tSize, 2.8 * tSize, 0.3 * tSize);
            // Wings (high-wing cross)
            ctx.fillRect(-0.4 * tSize, -1.2 * tSize, 0.35 * tSize, 2.4 * tSize);
            // Tail fin
            ctx.fillStyle = '#cc1e00';
            ctx.fillRect(-1.5 * tSize, -0.35 * tSize, 0.5 * tSize, 0.7 * tSize);
            ctx.restore();
            ctx.shadowBlur = 0;
            if (isSelected && pwUI) {
                pwUI.style.display = 'block';
                pwUI.style.left = Math.min(600 - 130, Math.max(0, ox + 20)) + 'px';
                pwUI.style.top = Math.min(600 - 60, Math.max(0, oy)) + 'px';
                const angleEl = document.getElementById('m_pw_angle') as HTMLInputElement;
                if (angleEl) angleEl.value = (pw.angle ?? 0).toString();
            }
        } else if ((obj as any).type === 'sailboat_broken') {
            const sb = obj as any;
            const ox = (sb.x + 0.5 - state.panX) * tSize;
            const oy = (sb.y + 0.5 - state.panY) * tSize;
            const rad = ((sb.angle ?? 0) * Math.PI) / 180;
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#fa0'; }
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(rad);
            // Hull
            ctx.fillStyle = '#933';
            ctx.beginPath();
            ctx.moveTo( 1.2 * tSize,  0);
            ctx.lineTo( 0.2 * tSize, -0.45 * tSize);
            ctx.lineTo(-1.0 * tSize, -0.35 * tSize);
            ctx.lineTo(-1.0 * tSize,  0.35 * tSize);
            ctx.lineTo( 0.2 * tSize,  0.45 * tSize);
            ctx.closePath();
            ctx.fill();
            // Deck
            ctx.fillStyle = '#a85';
            ctx.fillRect(-0.9 * tSize, -0.3 * tSize, 2.0 * tSize, 0.6 * tSize);
            // Mast stump
            ctx.fillStyle = '#aaa';
            ctx.fillRect(-0.35 * tSize, -0.05 * tSize, 0.1 * tSize, 0.1 * tSize);
            // Fallen mast (line across deck)
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = Math.max(1, tSize * 0.08);
            ctx.beginPath();
            ctx.moveTo(-0.3 * tSize, 0);
            ctx.lineTo( 1.1 * tSize,  0.35 * tSize);
            ctx.stroke();
            ctx.restore();
            ctx.shadowBlur = 0;
            if (isSelected && sbUI) {
                sbUI.style.display = 'block';
                sbUI.style.left = Math.min(600 - 130, Math.max(0, ox + 20)) + 'px';
                sbUI.style.top = Math.min(600 - 60, Math.max(0, oy)) + 'px';
                const angleEl = document.getElementById('m_sb_angle') as HTMLInputElement;
                if (angleEl) angleEl.value = (sb.angle ?? 0).toString();
            }
        } else if ((obj as any).type === 'ornithopter_wreck') {
            const ow = obj as any;
            const ox = (ow.x + 0.5 - state.panX) * tSize;
            const oy = (ow.y + 0.5 - state.panY) * tSize;
            const rad = ((ow.angle ?? 0) * Math.PI) / 180;
            if (isSelected) { ctx.shadowBlur = 10; ctx.shadowColor = '#fa0'; }
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(rad);
            // Scorch mark
            ctx.fillStyle = '#1a1612';
            ctx.beginPath();
            ctx.ellipse(0.3 * tSize, 0, 0.9 * tSize, 0.5 * tSize, 0, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillStyle = '#d0d0d0';
            ctx.fillRect(-1.4 * tSize, -0.2 * tSize, 2.1 * tSize, 0.4 * tSize);
            // Right wing (intact, flat)
            ctx.fillStyle = '#c8c8c8';
            ctx.beginPath();
            ctx.moveTo( 0.2 * tSize, -0.25 * tSize);
            ctx.lineTo(-0.5 * tSize, -0.22 * tSize);
            ctx.lineTo(-0.1 * tSize, -3.0 * tSize);
            ctx.lineTo( 0.1 * tSize, -3.0 * tSize);
            ctx.closePath();
            ctx.fill();
            // Left wing — just a torn root stump
            ctx.fillStyle = '#b8b8b8';
            ctx.beginPath();
            ctx.moveTo( 0.2 * tSize,  0.25 * tSize);
            ctx.lineTo(-0.3 * tSize,  0.22 * tSize);
            ctx.lineTo(-0.1 * tSize,  0.55 * tSize);
            ctx.lineTo( 0.15 * tSize, 0.5 * tSize);
            ctx.closePath();
            ctx.fill();
            // Jagged tear edge on stump
            ctx.strokeStyle = '#888';
            ctx.lineWidth = Math.max(1, tSize * 0.06);
            ctx.beginPath();
            ctx.moveTo(-0.3 * tSize, 0.22 * tSize);
            ctx.lineTo(-0.22 * tSize, 0.38 * tSize);
            ctx.lineTo(-0.1 * tSize, 0.55 * tSize);
            ctx.stroke();
            // Detached wing fragment lying nearby at an angle
            ctx.save();
            ctx.translate(-0.2 * tSize, 1.6 * tSize);
            ctx.rotate(0.4);
            ctx.fillStyle = '#b8b8b8';
            ctx.beginPath();
            ctx.moveTo(  0,             0);
            ctx.lineTo(-0.35 * tSize,  0.08 * tSize);
            ctx.lineTo(-0.1 * tSize,   2.0 * tSize);
            ctx.lineTo( 0.12 * tSize,  1.8 * tSize);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            // Cockpit — broken glass: outline + radiating cracks
            const cpx = 0.68 * tSize;
            const cpy = 0;
            ctx.strokeStyle = '#5a9db8';
            ctx.lineWidth = Math.max(1, tSize * 0.07);
            ctx.beginPath();
            ctx.ellipse(cpx, cpy, 0.22 * tSize, 0.15 * tSize, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#7aadcc';
            ctx.lineWidth = Math.max(1, tSize * 0.04);
            [0.3, 1.1, 1.9, 2.9, 3.8, 4.7, 5.6].forEach(a => {
                ctx.beginPath();
                ctx.moveTo(cpx, cpy);
                ctx.lineTo(cpx + Math.cos(a) * 0.2 * tSize, cpy + Math.sin(a) * 0.13 * tSize);
                ctx.stroke();
            });
            ctx.restore();
            ctx.shadowBlur = 0;
            if (isSelected && owUI) {
                owUI.style.display = 'block';
                owUI.style.left = Math.min(600 - 130, Math.max(0, ox + 20)) + 'px';
                owUI.style.top = Math.min(600 - 60, Math.max(0, oy)) + 'px';
                const angleEl = document.getElementById('m_ow_angle') as HTMLInputElement;
                if (angleEl) angleEl.value = (ow.angle ?? 0).toString();
            }
        }
    });

    // ── Payloads ───────────────────────────────────────────────────────────────
    const payloads = m.payloads || [];
    payloads.forEach((p, idx) => {
        const px = (p.x + 0.5 - state.panX) * tSize;
        const py = (p.y + 0.5 - state.panY) * tSize;
        const r = Math.max(5, tSize * 0.7);

        const isAttached = !!(p as any).attachTo;
        const isSelectedPayload = state.selectedPayloadIdx === idx;
        if (isSelectedPayload) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#fff';
        }
        if (p.type === 'person') {
            ctx.fillStyle = isAttached ? '#88ffcc' : '#ffe033';
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffe033';
            ctx.beginPath();
            ctx.arc(px, py - r * 0.65, r * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cc9900';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'rescuer') {
            ctx.fillStyle = isAttached ? '#88ddff' : '#ff6600';
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py - r * 0.65, r * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cc3300';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.stroke();
        } else if (p.type === 'crate') {
            const s = r * 0.85;
            ctx.fillStyle = isAttached ? '#44ccff' : '#ff8800';
            ctx.fillRect(px - s / 2, py - s / 2, s, s);
            ctx.strokeStyle = '#cc5500';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px - s / 2, py - s / 2, s, s);
            ctx.beginPath();
            ctx.moveTo(px - s / 2, py - s / 2);
            ctx.lineTo(px + s / 2, py + s / 2);
            ctx.moveTo(px + s / 2, py - s / 2);
            ctx.lineTo(px - s / 2, py + s / 2);
            ctx.strokeStyle = '#cc5500';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        // Move-mode indicator
        if (isSelectedPayload && state.moveMode) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(px, py, r * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, tSize * 0.55)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), px, py + r * 1.5);
        ctx.textAlign = 'left';
    });

    // ── Foliage (2D) ───────────────────────────────────────────────────────────
    const foliage = (m as any).foliage || [];
    const treeColors: Record<string, string> = { pine: '#1a5a1a', oak: '#2a6a1a', bush: '#3a7a2a', dead: '#6a4a2a' };
    foliage.forEach((f: any) => {
        const fx = (f.x - state.panX) * tSize;
        const fy = (f.y - state.panY) * tSize;
        const r = Math.max(3, tSize * 0.6 * (f.s || 1));
        ctx.fillStyle = treeColors[f.type] || '#1a5a1a';
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        if (f.type === 'dead') {
            ctx.strokeStyle = '#8a6a4a';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });

    // ── Wind compass ───────────────────────────────────────────────────────────
    const dirRad = (m.windDir * Math.PI) / 180;
    if (state.selectedUI === 'wind') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.windActive;
    }
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.arc(50, 50, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = state.selectedUI === 'wind' ? COLORS.windActive : COLORS.padStroke;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (m.windStr > 0) {
        const maxStr    = 10;
        const arrowLen  = (Math.min(m.windStr, maxStr) / maxStr) * 24;
        const tipX = 50 + Math.cos(dirRad) * arrowLen;
        const tipY = 50 + Math.sin(dirRad) * arrowLen;
        ctx.lineWidth = 1 + (m.windStr / maxStr) * 2.5;
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        // Arrowhead
        const headLen = 5, spread = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(dirRad - spread) * headLen, tipY - Math.sin(dirRad - spread) * headLen);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(dirRad + spread) * headLen, tipY - Math.sin(dirRad + spread) * headLen);
        ctx.stroke();
        // Speed label
        ctx.fillStyle = state.selectedUI === 'wind' ? COLORS.windActive : COLORS.padStroke;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`${m.windStr.toFixed(1)}`, 84, 54);
    }
    ctx.lineWidth = 1;
    if (state.selectedUI === 'wind' && wUI) wUI.style.display = 'block';
};

// Sync vessel settings from m.objects[idx] into the shared vessel UI panel
const syncVesselUI = (obj: any, kind: 'carrier' | 'boat' | 'submarine') => {
    const prefix = kind === 'carrier' ? 'carrier' : kind === 'submarine' ? 'submarine' : 'boat';
    const pathEl = document.getElementById(`m_${prefix}_path`) as HTMLSelectElement;
    const speedEl = document.getElementById(`m_${prefix}_speed`) as HTMLInputElement;
    const radiusEl = document.getElementById(`m_${prefix}_radius`) as HTMLInputElement;
    const angleEl = document.getElementById(`m_${prefix}_angle`) as HTMLInputElement;
    if (pathEl) pathEl.value = obj.path;
    if (speedEl) speedEl.value = obj.speed.toString();
    if (radiusEl) radiusEl.value = obj.radius.toString();
    if (angleEl) angleEl.value = obj.angle.toString();
};


