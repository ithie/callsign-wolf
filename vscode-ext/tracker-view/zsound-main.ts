export {};
declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

let actx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animId: number | null = null;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let birdTimer: ReturnType<typeof setTimeout> | null = null;

interface HeliParams { type: 'heli'; blades: number; clip: number; filterCut: number; filterQ: number; }
interface OrnParams { type: 'ornithopter'; flapFiltFreq: number; flapFiltQ: number; lfoFreq: number; lfoGain: number; }
interface WindParams { type: 'wind'; filterCut: number; filterQ: number; }
interface BirdsParams { type: 'birds'; pitch: number; rate: number; birdType: string; }
type SoundParams = HeliParams | OrnParams | WindParams | BirdsParams;

const buildCurve = (clip: number): Float32Array<ArrayBuffer> => {
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 255 - 1;
        c[i] = Math.max(-1, Math.min(1, x * (1 + clip * 8)));
    }
    return c;
};

const makeNoiseBuf = (ctx: AudioContext): AudioBuffer => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
};

const stopAll = (): void => {
    if (birdTimer) { clearTimeout(birdTimer); birdTimer = null; }
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (actx) { try { actx.close(); } catch (_) { /* closed */ } actx = null; analyser = null; }
    const status = document.getElementById('status');
    if (status) status.textContent = '';
    clearCanvases();
};

const clearCanvases = (): void => {
    (['cv-wave', 'cv-spec'] as const).forEach(id => {
        const cv = document.getElementById(id) as HTMLCanvasElement | null;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        if (ctx) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cv.width, cv.height); }
    });
};

const getParams = (): SoundParams => {
    const type = (document.getElementById('type-sel') as HTMLSelectElement).value as SoundParams['type'];
    if (type === 'heli') return {
        type: 'heli',
        blades: parseInt((document.getElementById('heli-blades') as HTMLSelectElement).value, 10),
        clip: parseFloat((document.getElementById('heli-clip') as HTMLInputElement).value),
        filterCut: parseFloat((document.getElementById('heli-filterCut') as HTMLInputElement).value),
        filterQ: parseFloat((document.getElementById('heli-filterQ') as HTMLInputElement).value),
    };
    if (type === 'ornithopter') return {
        type: 'ornithopter',
        flapFiltFreq: parseFloat((document.getElementById('orn-flapFiltFreq') as HTMLInputElement).value),
        flapFiltQ: parseFloat((document.getElementById('orn-flapFiltQ') as HTMLInputElement).value),
        lfoFreq: parseFloat((document.getElementById('orn-lfoFreq') as HTMLInputElement).value),
        lfoGain: parseFloat((document.getElementById('orn-lfoGain') as HTMLInputElement).value),
    };
    if (type === 'wind') return {
        type: 'wind',
        filterCut: parseFloat((document.getElementById('wind-filterCut') as HTMLInputElement).value),
        filterQ: parseFloat((document.getElementById('wind-filterQ') as HTMLInputElement).value),
    };
    return {
        type: 'birds',
        pitch: parseFloat((document.getElementById('birds-pitch') as HTMLInputElement).value),
        rate: parseFloat((document.getElementById('birds-rate') as HTMLInputElement).value),
        birdType: (document.getElementById('birds-birdType') as HTMLSelectElement).value,
    };
};

const play = (): void => {
    stopAll();
    const p = getParams();
    actx = new AudioContext();
    analyser = actx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.connect(actx.destination);
    const master = actx.createGain();
    master.gain.value = 0.7;
    master.connect(analyser);
    const status = document.getElementById('status');

    if (p.type === 'heli') {
        const freq = (220 / 60) * p.blades;
        const osc = actx.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        const shaper = actx.createWaveShaper();
        shaper.curve = buildCurve(p.clip); shaper.oversample = '4x';
        const filt = actx.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = p.filterCut; filt.Q.value = p.filterQ;
        osc.connect(shaper); shaper.connect(filt); filt.connect(master);
        osc.start();
        if (status) status.textContent = 'Rotor @ ' + freq.toFixed(1) + ' Hz';

    } else if (p.type === 'ornithopter') {
        const noiseSrc = actx.createBufferSource();
        noiseSrc.buffer = makeNoiseBuf(actx); noiseSrc.loop = true;
        const flapFilt = actx.createBiquadFilter();
        flapFilt.type = 'bandpass'; flapFilt.frequency.value = p.flapFiltFreq; flapFilt.Q.value = p.flapFiltQ;
        const flapEnv = actx.createGain(); flapEnv.gain.value = 0.5;
        const lfo = actx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = p.lfoFreq;
        const lfoGain = actx.createGain(); lfoGain.gain.value = p.lfoGain;
        lfo.connect(lfoGain); lfoGain.connect(flapEnv.gain);
        noiseSrc.connect(flapFilt); flapFilt.connect(flapEnv); flapEnv.connect(master);
        noiseSrc.start(); lfo.start();
        if (status) status.textContent = 'Flap @ ' + p.lfoFreq.toFixed(2) + ' Hz';

    } else if (p.type === 'wind') {
        const windSrc = actx.createBufferSource();
        windSrc.buffer = makeNoiseBuf(actx); windSrc.loop = true;
        const windFilt = actx.createBiquadFilter();
        windFilt.type = 'lowpass'; windFilt.frequency.value = p.filterCut; windFilt.Q.value = p.filterQ;
        windSrc.connect(windFilt); windFilt.connect(master);
        windSrc.start();
        if (status) status.textContent = 'Wind noise';

    } else if (p.type === 'birds') {
        scheduleBird(p, master);
        if (status) status.textContent = 'Birds @ ' + p.rate.toFixed(2) + '/s';
    }

    startVis();
};

const scheduleBird = (p: BirdsParams, master: GainNode): void => {
    if (!actx) return;
    chirp(p, master);
    const ms = 1000 / p.rate;
    birdTimer = setTimeout(() => scheduleBird(p, master), ms + (Math.random() - 0.5) * ms * 0.4);
};

const chirp = (p: BirdsParams, master: GainNode): void => {
    if (!actx) return;
    const t = actx.currentTime;
    const dur = p.birdType === 'seagull' ? 0.35 : p.birdType === 'crow' ? 0.2 : 0.12;
    const sweep = p.birdType === 'seagull' ? -200 : p.birdType === 'crow' ? -100 : 300;
    const osc = actx.createOscillator();
    osc.type = p.birdType === 'crow' ? 'square' : 'sine';
    osc.frequency.setValueAtTime(p.pitch, t);
    osc.frequency.linearRampToValueAtTime(p.pitch + sweep, t + dur);
    const env = actx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.6, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
};

const startVis = (): void => {
    if (!analyser) return;
    const cvW = document.getElementById('cv-wave') as HTMLCanvasElement;
    const cvS = document.getElementById('cv-spec') as HTMLCanvasElement;
    const cW = cvW.getContext('2d')!;
    const cS = cvS.getContext('2d')!;
    const bufLen = analyser.frequencyBinCount;
    const timeBuf = new Uint8Array(bufLen);
    const freqBuf = new Uint8Array(bufLen);
    const draw = (): void => {
        animId = requestAnimationFrame(draw);
        analyser!.getByteTimeDomainData(timeBuf);
        analyser!.getByteFrequencyData(freqBuf);
        cW.fillStyle = '#111'; cW.fillRect(0, 0, cvW.width, cvW.height);
        cW.strokeStyle = '#4a90d9'; cW.lineWidth = 1.5; cW.beginPath();
        const sliceW = cvW.width / bufLen;
        let x = 0;
        for (let i = 0; i < bufLen; i++) {
            const y = (timeBuf[i] / 128) * (cvW.height / 2);
            if (i === 0) cW.moveTo(x, y); else cW.lineTo(x, y);
            x += sliceW;
        }
        cW.stroke();
        cS.fillStyle = '#111'; cS.fillRect(0, 0, cvS.width, cvS.height);
        const barW = Math.max(1, (cvS.width / bufLen) * 2.5);
        let bx = 0;
        for (let j = 0; j < bufLen; j++) {
            const bh = (freqBuf[j] / 255) * cvS.height;
            cS.fillStyle = 'hsl(' + Math.floor((j / bufLen) * 240) + ',80%,50%)';
            cS.fillRect(bx, cvS.height - bh, barW - 1, bh);
            bx += barW;
            if (bx > cvS.width) break;
        }
    };
    draw();
};

const showGroup = (type: string): void => {
    ['heli', 'ornithopter', 'wind', 'birds'].forEach(t => {
        const el = document.getElementById('pg-' + t);
        if (el) el.classList.toggle('visible', t === type);
    });
};

const bindSlider = (id: string, dec: number): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    const vEl = document.getElementById(id + '-v');
    if (!el || !vEl) return;
    el.addEventListener('input', () => {
        vEl.textContent = parseFloat(el.value).toFixed(dec);
        scheduleNotify();
    });
};

const scheduleNotify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
        vscode.postMessage({ type: 'change', content: JSON.stringify(getParams()) });
    }, 300);
};

const loadData = (json: string): void => {
    let p: SoundParams;
    try { p = JSON.parse(json) as SoundParams; } catch (_) { return; }
    const type = p.type ?? 'heli';
    (document.getElementById('type-sel') as HTMLSelectElement).value = type;
    showGroup(type);

    const setSlider = (id: string, val: number | undefined, dec: number): void => {
        if (val === undefined) return;
        const el = document.getElementById(id) as HTMLInputElement | null;
        const vEl = document.getElementById(id + '-v');
        if (el) { el.value = String(val); if (vEl) vEl.textContent = val.toFixed(dec); }
    };
    const setSel = (id: string, val: string | number | undefined): void => {
        if (val === undefined) return;
        const el = document.getElementById(id) as HTMLSelectElement | null;
        if (el) el.value = String(val);
    };

    if (p.type === 'heli') {
        setSel('heli-blades', p.blades);
        setSlider('heli-clip', p.clip, 1);
        setSlider('heli-filterCut', p.filterCut, 0);
        setSlider('heli-filterQ', p.filterQ, 1);
    } else if (p.type === 'ornithopter') {
        setSlider('orn-flapFiltFreq', p.flapFiltFreq, 0);
        setSlider('orn-flapFiltQ', p.flapFiltQ, 1);
        setSlider('orn-lfoFreq', p.lfoFreq, 2);
        setSlider('orn-lfoGain', p.lfoGain, 2);
    } else if (p.type === 'wind') {
        setSlider('wind-filterCut', p.filterCut, 0);
        setSlider('wind-filterQ', p.filterQ, 2);
    } else if (p.type === 'birds') {
        setSlider('birds-pitch', p.pitch, 0);
        setSlider('birds-rate', p.rate, 2);
        setSel('birds-birdType', p.birdType);
    }
};

(document.getElementById('type-sel') as HTMLSelectElement).addEventListener('change', function() {
    showGroup(this.value); scheduleNotify();
});
document.getElementById('btn-play')?.addEventListener('click', play);
document.getElementById('btn-stop')?.addEventListener('click', stopAll);

bindSlider('heli-clip', 1);
bindSlider('heli-filterCut', 0);
bindSlider('heli-filterQ', 1);
bindSlider('orn-flapFiltFreq', 0);
bindSlider('orn-flapFiltQ', 1);
bindSlider('orn-lfoFreq', 2);
bindSlider('orn-lfoGain', 2);
bindSlider('wind-filterCut', 0);
bindSlider('wind-filterQ', 2);
bindSlider('birds-pitch', 0);
bindSlider('birds-rate', 2);
(document.getElementById('heli-blades') as HTMLSelectElement | null)?.addEventListener('change', scheduleNotify);
(document.getElementById('birds-birdType') as HTMLSelectElement | null)?.addEventListener('change', scheduleNotify);

window.addEventListener('message', (e: MessageEvent<{ type: string; content?: string }>) => {
    if (e.data.type === 'load' && e.data.content !== undefined) loadData(e.data.content);
});

clearCanvases();
showGroup('heli');
vscode.postMessage({ type: 'ready' });
