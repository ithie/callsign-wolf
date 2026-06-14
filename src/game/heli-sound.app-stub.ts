// iOS app build — all audio runs in Swift/AVAudioEngine via the heliSound bridge.

const _post = (msg: Record<string, unknown>): void => {
    (window as any).webkit?.messageHandlers?.heliSound?.postMessage(msg);
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
    _post({ action: 'init', heliType });
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
