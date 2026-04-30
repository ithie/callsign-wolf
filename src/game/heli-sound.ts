// ── Heli Sound Synthesis ────────────────────────────────────────────────────

const BLADES: Record<string, number> = {
    dolphin: 4,
    coasthawk: 4,
    atlas: 3,
};

const NOMINAL_RPM = 220;

// Presets per heli type: [clipAmount, filterCutHz, filterQ]
const PRESETS: Record<string, [number, number, number]> = {
    dolphin: [3.0, 120, 2.5],
    coasthawk: [3.0, 110, 2.5],
    atlas: [4.0, 90, 3.0],
};

interface HeliSoundNodes {
    actx: AudioContext;
    // helicopter rotor path (undefined for ornithopter)
    osc?: OscillatorNode;
    shaper?: WaveShaperNode;
    filt?: BiquadFilterNode;
    rotorGain?: GainNode;
    // ornithopter wing-flap path (undefined for helicopters)
    flapLFO?: OscillatorNode;
    flapLFOGain?: GainNode;
    flapNoiseSrc?: AudioBufferSourceNode;
    flapFilt?: BiquadFilterNode;
    flapEnv?: GainNode;
    // shared
    master: GainNode;
    windSrc: AudioBufferSourceNode;
    windFilt: BiquadFilterNode;
    windGain: GainNode;
}

let _nodes: HeliSoundNodes | null = null;
let _sfxEnabled = true;

export const isSfxEnabled = (): boolean => _sfxEnabled;

export const setSfxEnabled = (enabled: boolean): void => {
    _sfxEnabled = enabled;
    if (_nodes && !enabled) {
        _nodes.master.gain.setTargetAtTime(0, _nodes.actx.currentTime, 0.1);
    }
};

const _buildCurve = (clipAmount: number): Float32Array<ArrayBuffer> => {
    const n = 256;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        curve[i] = Math.max(-1, Math.min(1, x * (1 + clipAmount * 8)));
    }
    return curve;
};

const _makeWindPath = (actx: AudioContext, master: GainNode) => {
    const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const windSrc = actx.createBufferSource();
    windSrc.buffer = buf; windSrc.loop = true;
    const windFilt = actx.createBiquadFilter();
    windFilt.type = 'lowpass'; windFilt.frequency.value = 200; windFilt.Q.value = 0.5;
    const windGain = actx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilt); windFilt.connect(windGain); windGain.connect(master);
    windSrc.start();
    return { windSrc, windFilt, windGain };
};

export const initHeliSound = (heliType: string): void => {
    stopHeliSound();

    const actx = new AudioContext();
    const master = actx.createGain();
    master.gain.value = 0;
    master.connect(actx.destination);
    const wind = _makeWindPath(actx, master);

    if (heliType === 'ornithopter') {
        // Wing-flap synthesis: noise → bandpass → LFO amplitude modulation
        const noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const flapNoiseSrc = actx.createBufferSource();
        flapNoiseSrc.buffer = noiseBuf; flapNoiseSrc.loop = true;

        const flapFilt = actx.createBiquadFilter();
        flapFilt.type = 'bandpass'; flapFilt.frequency.value = 700; flapFilt.Q.value = 1.8;

        // Amplitude envelope driven by LFO: gain oscillates [0.05 … 0.95]
        const flapEnv = actx.createGain();
        flapEnv.gain.value = 0.5;

        const flapLFO = actx.createOscillator();
        flapLFO.type = 'sine'; flapLFO.frequency.value = 1.1;

        const flapLFOGain = actx.createGain();
        flapLFOGain.gain.value = 0.45;

        flapLFO.connect(flapLFOGain);
        flapLFOGain.connect(flapEnv.gain);
        flapNoiseSrc.connect(flapFilt);
        flapFilt.connect(flapEnv);
        flapEnv.connect(master);

        flapNoiseSrc.start(); flapLFO.start();
        _nodes = { actx, master, flapLFO, flapLFOGain, flapNoiseSrc, flapFilt, flapEnv, ...wind };
        return;
    }

    const blades = BLADES[heliType] ?? 4;
    if (blades === 0) { _nodes = { actx, master, ...wind }; return; }

    const [clipAmount, filterCut, filterQ] = PRESETS[heliType] ?? PRESETS['dolphin'];

    const osc = actx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = (NOMINAL_RPM / 60) * blades * 0.1;

    const shaper = actx.createWaveShaper();
    shaper.curve = _buildCurve(clipAmount);
    shaper.oversample = '4x';

    const filt = actx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = filterCut; filt.Q.value = filterQ;

    const rotorGain = actx.createGain();
    rotorGain.gain.value = 0.85;

    osc.connect(shaper); shaper.connect(filt); filt.connect(rotorGain); rotorGain.connect(master);
    osc.start();

    _nodes = { actx, osc, shaper, filt, rotorGain, master, ...wind };
};

export const updateHeliSound = (rotorRPM: number, engineOn: boolean, heliType: string, windSpeed: number, flapRate = 1.0): void => {
    if (!_nodes) return;
    const { actx, master, windGain } = _nodes;
    const t = actx.currentTime;

    // windSpeed = Math.hypot(G.wind.x, G.wind.y), max ~0.0005 at windStr=10
    windGain.gain.setTargetAtTime(Math.min(1, windSpeed * 2000) * 0.5, t, 0.3);

    if (heliType === 'ornithopter') {
        const { flapLFO, flapLFOGain } = _nodes;
        if (!flapLFO || !flapLFOGain) return;
        flapLFO.frequency.setTargetAtTime(1.1 * flapRate, t, 0.12);
        flapLFOGain.gain.setTargetAtTime(0.45 * Math.max(0.1, rotorRPM), t, 0.1);
        const targetVol = _sfxEnabled ? (engineOn ? 0.08 + 0.35 * rotorRPM : 0.04 * rotorRPM) : 0;
        master.gain.setTargetAtTime(targetVol, t, 0.06);
        return;
    }

    const { osc, filt } = _nodes;
    if (!osc || !filt) return;
    const blades = BLADES[heliType] ?? 4;
    const [, filterCut] = PRESETS[heliType] ?? PRESETS['dolphin'];
    const bpf = ((rotorRPM * NOMINAL_RPM) / 60) * blades;
    osc.frequency.setTargetAtTime(Math.max(1, bpf), t, 0.08);
    filt.frequency.setTargetAtTime(filterCut, t, 0.05);
    const targetVol = _sfxEnabled ? (engineOn ? 0.15 + 0.55 * rotorRPM : 0.1 * rotorRPM) : 0;
    master.gain.setTargetAtTime(targetVol, t, 0.06);
};

export const stopHeliSound = (): void => {
    if (!_nodes) return;
    const { actx, osc, flapLFO, flapNoiseSrc, windSrc, master } = _nodes;
    master.gain.setTargetAtTime(0, actx.currentTime, 0.15);
    setTimeout(() => {
        try {
            osc?.stop();
            flapLFO?.stop();
            flapNoiseSrc?.stop();
            windSrc.stop();
            actx.close();
        } catch (_) { /* already stopped */ }
    }, 600);
    _nodes = null;
};
