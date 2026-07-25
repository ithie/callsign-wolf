// iOS app build — all audio runs in Swift/AVAudioEngine via the heliSound bridge.

const _post = (msg: Record<string, unknown>): void => {
    (window as any).webkit?.messageHandlers?.heliSound?.postMessage(msg);
};

const _PRESETS: Record<string, { blades: number; clip: number; bpf: number; bpfQ: number; gain?: number }> = {
    dolphin:   { blades: 4, clip: 3.0, bpf: 120, bpfQ: 2.5, gain: 1.9 },
    coasthawk: { blades: 4, clip: 3.0, bpf: 110, bpfQ: 2.5 },
    atlas:     { blades: 3, clip: 4.0, bpf:  90, bpfQ: 3.0 },
};

let _sfxEnabled = true;

export const isSfxEnabled = (): boolean => _sfxEnabled;

export const setSfxEnabled = (enabled: boolean): void => {
    _sfxEnabled = enabled;
    _post({ action: 'setSfx', enabled });
};

export const playSfx = (freq: number, duration: number, gain = 0.15, type: OscillatorType = 'sine'): void => {
    _post({ action: 'sfx', freq, duration, gain, type });
};

export const initHeliSound = (heliType: string): void => {
    const p = _PRESETS[heliType];
    if (p) {
        _post({ action: 'init', heliType, blades: p.blades, clip: p.clip, bpf: p.bpf, bpfQ: p.bpfQ, ...(p.gain !== undefined ? { gain: p.gain } : {}) });
    } else {
        _post({ action: 'init', heliType });
    }
};

export const updateHeliSound = (
    rotorRPM: number,
    engineOn: boolean,
    heliType: string,
    windSpeed: number,
    flapRate = 1.0,
): void => {
    _post({ action: 'update', rpm: rotorRPM, engineOn, heliType, windSpeed, flapRate });
};

export const stopHeliSound = (): void => {
    _post({ action: 'stop' });
};
