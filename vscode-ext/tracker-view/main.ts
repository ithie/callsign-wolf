import ZsynthPlayer from '../../src/shared/ZsynthPlayer';
import { parseZsong, songToZsong } from '../../src/shared/zsong';
import { TRACK_DEFS, NOTES, INSTRUMENTS, STEPS, SongData, WaveType } from '../../src/shared/tracker-types';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────────────────────
let activeData: Record<string, string> = {};
const knobValues: Record<string, { attack: number; release: number; detune: number }> = {};
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

const KNOB_DEFS: { key: 'attack' | 'release' | 'detune'; label: string; min: number; max: number; default: number }[] = [
    { key: 'attack', label: 'ATK', min: 0.001, max: 0.3, default: 0.02 },
    { key: 'release', label: 'REL', min: 0.05, max: 1.5, default: 0.3 },
    { key: 'detune', label: 'DET', min: 0, max: 25, default: 0 },
];

// ── Canvas knob ───────────────────────────────────────────────────────────────
const drawKnob = (canvas: HTMLCanvasElement, value: number, min: number, max: number, label: string): void => {
    const ctx = canvas.getContext('2d')!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 4;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    ctx.beginPath(); ctx.arc(cx, cy - 4, r, startAngle, endAngle);
    ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 3; ctx.stroke();
    const t = (value - min) / (max - min);
    ctx.beginPath(); ctx.arc(cx, cy - 4, r, startAngle, startAngle + t * (endAngle - startAngle));
    ctx.strokeStyle = '#4a90d9'; ctx.lineWidth = 3; ctx.stroke();
    const angle = startAngle + t * (endAngle - startAngle);
    ctx.beginPath(); ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + Math.cos(angle) * (r - 2), cy - 4 + Math.sin(angle) * (r - 2));
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '8px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, cx, canvas.height - 1);
    ctx.fillStyle = '#ccc'; ctx.font = '7px -apple-system, sans-serif';
    ctx.fillText(value.toFixed(2), cx, cy + 8);
};

const makeKnob = (trackId: string, key: 'attack' | 'release' | 'detune', label: string, min: number, max: number, initVal: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 42; canvas.height = 42; canvas.style.cursor = 'ns-resize'; canvas.title = label;
    if (!knobValues[trackId]) knobValues[trackId] = { attack: 0.02, release: 0.3, detune: 0 };
    knobValues[trackId][key] = initVal;
    drawKnob(canvas, initVal, min, max, label);
    let startY = 0, startVal = initVal, dragging = false;
    canvas.addEventListener('mousedown', e => { dragging = true; startY = e.clientY; startVal = knobValues[trackId][key]; e.preventDefault(); });
    window.addEventListener('mousemove', e => {
        if (!dragging) return;
        const newVal = Math.min(max, Math.max(min, startVal + ((startY - e.clientY) / 150) * (max - min)));
        knobValues[trackId][key] = newVal;
        drawKnob(canvas, newVal, min, max, label);
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('dblclick', () => { knobValues[trackId][key] = initVal; drawKnob(canvas, initVal, min, max, label); });
    return canvas;
};

// ── Note options ──────────────────────────────────────────────────────────────
const NOTE_OPTIONS = NOTES.map(n => `<option value="${n}">${n}</option>`).join('');

// ── Build UI ──────────────────────────────────────────────────────────────────
const buildUI = (): void => {
    const root = document.getElementById('sequencer-root')!;
    root.innerHTML = '';
    TRACK_DEFS.forEach(track => {
        const container = document.createElement('div');
        container.className = 'track-container';

        const ctrl = document.createElement('div');
        ctrl.className = 'track-controls';
        ctrl.innerHTML = `
            <div class="track-header">
                <strong>${track.label}</strong>
                <input type="range" class="vol-slider" id="${track.id}-vol" min="0" max="100" value="80" title="Volume">
            </div>
            ${track.type === 'synth' ? `
                <select id="${track.id}-inst">
                    ${Object.entries(INSTRUMENTS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                    <option value="custom">— Custom —</option>
                </select>
                <div class="synth-params">
                    <select id="${track.id}-wave">
                        <option value="sawtooth">SAW</option>
                        <option value="square">SQR</option>
                        <option value="sine">SIN</option>
                        <option value="triangle">TRI</option>
                    </select>
                    <input type="number" id="${track.id}-filter" value="2000" style="width:55px" title="Filter Hz"> Hz
                </div>
                <div class="knob-row" id="knobs-${track.id}"></div>
            ` : ''}
        `;
        container.appendChild(ctrl);

        const grid = document.createElement('div');
        grid.className = track.type === 'drum' ? 'grid drum-grid' : 'grid synth-grid';

        if (track.type === 'drum') {
            for (let i = 0; i < STEPS; i++) {
                const key = `${track.id}-${i}`;
                const cell = document.createElement('div');
                cell.className = 'cell' + (activeData[key] ? ' active-drum' : '');
                cell.dataset.step = String(i);
                cell.id = key;
                cell.addEventListener('click', () => toggleDrum(cell, track.label, track.id));
                grid.appendChild(cell);
            }
        } else {
            for (let i = 0; i < STEPS; i++) {
                const key = `${track.id}-${i}`;
                const sel = document.createElement('select');
                sel.className = 'step-note' + (activeData[key] ? ' has-note' : '');
                sel.id = key;
                sel.dataset.step = String(i);
                sel.innerHTML = `<option value="">—</option>${NOTE_OPTIONS}`;
                sel.value = activeData[key] ?? '';
                sel.addEventListener('change', () => onNoteSelect(sel, track.id));
                grid.appendChild(sel);
            }
        }
        container.appendChild(grid);
        root.appendChild(container);

        if (track.type === 'synth') {
            const knobRow = document.getElementById(`knobs-${track.id}`);
            if (knobRow) {
                KNOB_DEFS.forEach(({ key, label, min, max, default: def }) => {
                    knobRow.appendChild(makeKnob(track.id, key, label, min, max, def));
                });
            }
            document.getElementById(`${track.id}-inst`)?.addEventListener('change', e => {
                applyPreset(track.id, (e.target as HTMLSelectElement).value);
                scheduleNotify();
            });
            ['wave', 'filter', 'vol'].forEach(field => {
                document.getElementById(`${track.id}-${field}`)?.addEventListener('change', () => scheduleNotify());
            });
        } else {
            document.getElementById(`${track.id}-vol`)?.addEventListener('change', () => scheduleNotify());
        }
    });
};

// ── Drum toggle ───────────────────────────────────────────────────────────────
const toggleDrum = (el: HTMLElement, drumLabel: string, trackId: string): void => {
    const key = el.id;
    if (activeData[key]) {
        delete activeData[key];
        el.classList.remove('active-drum');
    } else {
        activeData[key] = drumLabel;
        el.classList.add('active-drum');
        if (ZsynthPlayer.ctx && ZsynthPlayer.masterGain) {
            const vol = (document.getElementById(`${trackId}-vol`) as HTMLInputElement | null)?.valueAsNumber ?? 80;
            ZsynthPlayer.playDrum(drumLabel, 0, vol / 100, ZsynthPlayer.masterGain);
        }
    }
    scheduleNotify();
};

// ── Note select ───────────────────────────────────────────────────────────────
const onNoteSelect = (sel: HTMLSelectElement, trackId: string): void => {
    const step = sel.dataset.step!;
    const key = `${trackId}-${step}`;
    if (sel.value) {
        activeData[key] = sel.value;
        sel.classList.add('has-note');
        if (ZsynthPlayer.ctx && ZsynthPlayer.masterGain) {
            const vol = (document.getElementById(`${trackId}-vol`) as HTMLInputElement | null)?.valueAsNumber ?? 80;
            const wave = (document.getElementById(`${trackId}-wave`) as HTMLSelectElement | null)?.value as WaveType ?? 'square';
            const filter = (document.getElementById(`${trackId}-filter`) as HTMLInputElement | null)?.valueAsNumber ?? 2000;
            const kv = knobValues[trackId] ?? { attack: 0.02, release: 0.3, detune: 0 };
            ZsynthPlayer.playSynth(sel.value, 0, { vol, wave, filter, attack: kv.attack, release: kv.release, detune: kv.detune }, ZsynthPlayer.masterGain);
        }
    } else {
        delete activeData[key];
        sel.classList.remove('has-note');
    }
    scheduleNotify();
};

// ── Instrument preset ─────────────────────────────────────────────────────────
const applyPreset = (trackId: string, presetKey: string): void => {
    if (presetKey === 'custom') return;
    const p = INSTRUMENTS[presetKey];
    if (!p) return;
    (document.getElementById(`${trackId}-wave`) as HTMLSelectElement).value = p.wave;
    (document.getElementById(`${trackId}-filter`) as HTMLInputElement).value = String(p.filter);
    if (!knobValues[trackId]) knobValues[trackId] = { attack: 0.02, release: 0.3, detune: 0 };
    knobValues[trackId].attack = p.attack ?? 0.02;
    knobValues[trackId].release = p.release ?? 0.3;
    knobValues[trackId].detune = p.detune ?? 0;
    const knobRow = document.getElementById(`knobs-${trackId}`);
    if (knobRow) {
        KNOB_DEFS.forEach(({ key, min, max, label }, i) => {
            const canvas = knobRow.children[i] as HTMLCanvasElement;
            if (canvas) drawKnob(canvas, knobValues[trackId][key], min, max, label);
        });
    }
};

// ── Serialize / Deserialize ───────────────────────────────────────────────────
const getCurrentSong = (): SongData => {
    const bpm = (document.getElementById('bpm') as HTMLInputElement | null)?.value ?? '120';
    const config: Record<string, unknown> = {};
    TRACK_DEFS.forEach(t => {
        const vol = (document.getElementById(`${t.id}-vol`) as HTMLInputElement | null)?.value ?? '80';
        const entry: Record<string, unknown> = { vol };
        if (t.type === 'synth') {
            const kv = knobValues[t.id] ?? { attack: 0.02, release: 0.3, detune: 0 };
            entry['wave']    = (document.getElementById(`${t.id}-wave`) as HTMLSelectElement | null)?.value ?? 'square';
            entry['filter']  = (document.getElementById(`${t.id}-filter`) as HTMLInputElement | null)?.value ?? '2000';
            entry['inst']    = (document.getElementById(`${t.id}-inst`) as HTMLSelectElement | null)?.value ?? 'custom';
            entry['attack']  = kv.attack;
            entry['release'] = kv.release;
            entry['detune']  = kv.detune;
        }
        config[t.id] = entry;
    });
    return { bpm, activeData: { ...activeData }, config };
};

const loadSong = (text: string): void => {
    const raw = parseZsong(text);
    const bpmEl = document.getElementById('bpm') as HTMLInputElement | null;
    if (bpmEl) bpmEl.value = raw.bpm || '120';
    // Normalise old 3-part key format
    activeData = {};
    Object.entries(raw.activeData).forEach(([key, val]) => {
        const parts = key.split('-');
        if (parts.length >= 3) {
            activeData[`${parts[0]}-${parts[parts.length - 1]}`] = parts.slice(1, -1).join('-');
        } else {
            activeData[key] = String(val);
        }
    });
    buildUI();
    if (raw.config) {
        Object.entries(raw.config).forEach(([tid, conf]) => {
            const c = conf as Record<string, unknown>;
            const volEl = document.getElementById(`${tid}-vol`) as HTMLInputElement | null;
            if (volEl) volEl.value = String(c['vol'] ?? 80);
            if (tid.startsWith('synth')) {
                const instEl = document.getElementById(`${tid}-inst`) as HTMLSelectElement | null;
                const waveEl = document.getElementById(`${tid}-wave`) as HTMLSelectElement | null;
                const filtEl = document.getElementById(`${tid}-filter`) as HTMLInputElement | null;
                if (instEl) instEl.value = String(c['inst'] ?? 'custom');
                if (waveEl) waveEl.value = String(c['wave'] ?? 'square');
                if (filtEl) filtEl.value = String(c['filter'] ?? 2000);
                if (!knobValues[tid]) knobValues[tid] = { attack: 0.02, release: 0.3, detune: 0 };
                knobValues[tid].attack  = Number(c['attack']  ?? 0.02);
                knobValues[tid].release = Number(c['release'] ?? 0.3);
                knobValues[tid].detune  = Number(c['detune']  ?? 0);
                const knobRow = document.getElementById(`knobs-${tid}`);
                if (knobRow) {
                    KNOB_DEFS.forEach(({ key, min, max, label }, i) => {
                        const canvas = knobRow.children[i] as HTMLCanvasElement;
                        if (canvas) drawKnob(canvas, knobValues[tid][key], min, max, label);
                    });
                }
            }
        });
    }
};

// ── Notify VS Code ────────────────────────────────────────────────────────────
const scheduleNotify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
        vscode.postMessage({ type: 'change', content: songToZsong(getCurrentSong()) });
    }, 300);
};

// ── Controls ──────────────────────────────────────────────────────────────────
document.getElementById('btn-play')?.addEventListener('click', () => {
    ZsynthPlayer.init({ preview: getCurrentSong() });
    ZsynthPlayer.onStep = (step: number) => {
        document.querySelectorAll('.playing').forEach(c => c.classList.remove('playing'));
        document.querySelectorAll(`[data-step="${step}"]`).forEach(c => c.classList.add('playing'));
        const display = document.getElementById('step-display');
        if (display) display.textContent = `Step ${step + 1}`;
    };
    ZsynthPlayer.play('preview');
});
document.getElementById('btn-stop')?.addEventListener('click', () => {
    ZsynthPlayer.stop();
    document.querySelectorAll('.playing').forEach(c => c.classList.remove('playing'));
    const display = document.getElementById('step-display');
    if (display) display.textContent = '';
});
document.getElementById('bpm')?.addEventListener('change', () => scheduleNotify());

// ── VS Code message handler ───────────────────────────────────────────────────
window.addEventListener('message', e => {
    const msg = e.data as { type: string; content?: string };
    if (msg.type === 'load' && msg.content !== undefined) {
        loadSong(msg.content);
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────
buildUI();
vscode.postMessage({ type: 'ready' });
