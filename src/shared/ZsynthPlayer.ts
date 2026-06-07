import { SongData, SynthConfig } from './tracker-types';

interface ActiveTrack {
    data: SongData;
    isPlaying: boolean;
    currentStep: number;
    gainNode: GainNode;
    nextNoteTime: number;
    stepMap: Record<number, Array<{ trackId: string; note: string }>>;
}

const ZsynthPlayer = {
    ctx: null as AudioContext | null,
    songs: {} as Record<string, SongData>,
    currentTrack: null as ActiveTrack | null,
    masterGain: null as GainNode | null,
    onStep: null as ((step: number) => void) | null,

    freqs: {
        B4: 493.88,
        Bb4: 466.16,
        A4: 440.0,
        Ab4: 415.3,
        G4: 392.0,
        Gb4: 369.99,
        F4: 349.23,
        E4: 329.63,
        Eb4: 311.13,
        D4: 293.66,
        Db4: 277.18,
        C4: 261.63,
        B3: 246.94,
        Bb3: 233.08,
        A3: 220.0,
        Ab3: 207.65,
        G3: 196.0,
        Gb3: 185.0,
        F3: 174.61,
        E3: 164.81,
        Eb3: 155.56,
        D3: 146.83,
        Db3: 138.59,
        C3: 130.81,
        B2: 123.47,
        Bb2: 116.54,
        A2: 110.0,
        Ab2: 103.83,
        G2: 98.0,
        Gb2: 92.5,
        F2: 87.31,
        E2: 82.41,
        Eb2: 77.78,
        D2: 73.42,
        Db2: 69.3,
        C2: 65.41,
        B1: 61.74,
        Bb1: 58.27,
        A1: 55.0,
        Ab1: 51.91,
        G1: 49.0,
        Gb1: 46.25,
        F1: 43.65,
        E1: 41.2,
        Eb1: 38.89,
        D1: 36.71,
        Db1: 34.65,
        C1: 32.7,
    } as Record<string, number>,

    init: (songList: Record<string, SongData>): void => {
        ZsynthPlayer.songs = songList;
        const _ensureCtx = () => {
            try {
                if (!ZsynthPlayer.ctx) {
                    ZsynthPlayer.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    ZsynthPlayer.masterGain = ZsynthPlayer.ctx.createGain();
                    ZsynthPlayer.masterGain.connect(ZsynthPlayer.ctx.destination);
                }
                if (ZsynthPlayer.ctx.state === 'suspended') ZsynthPlayer.ctx.resume();
            } catch {}
        };
        (window as any).__zsynthResume = _ensureCtx;
        document.addEventListener('touchstart', _ensureCtx, { passive: true });
        document.addEventListener('click', _ensureCtx, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') _ensureCtx();
        });
    },

    play: (key: string, volume: number = 1.0): void => {
        // Lazy-init: AudioContext created here (inside user gesture) starts as 'running' on iOS
        try {
            if (!ZsynthPlayer.ctx) {
                ZsynthPlayer.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                ZsynthPlayer.masterGain = ZsynthPlayer.ctx.createGain();
                ZsynthPlayer.masterGain.connect(ZsynthPlayer.ctx.destination);
            }

            const songData = ZsynthPlayer.songs[key];
            if (!songData) return;

            const stepMap: Record<number, Array<{ trackId: string; note: string }>> = {};
            for (const k in songData.activeData) {
                const sepIdx = k.lastIndexOf('-');
                const trackId = k.substring(0, sepIdx);
                const step = parseInt(k.substring(sepIdx + 1));
                const note = songData.activeData[k] as string;
                if (!stepMap[step]) stepMap[step] = [];
                stepMap[step].push({ trackId, note });
            }

            const _start = () => {
                const ctx = ZsynthPlayer.ctx!;
                const startTime = ctx.currentTime;

                if (ZsynthPlayer.currentTrack) {
                    const old = ZsynthPlayer.currentTrack;
                    old.gainNode.gain.setTargetAtTime(0, startTime, 0.015);
                    setTimeout(() => {
                        old.isPlaying = false;
                    }, 100);
                }

                const track: ActiveTrack = {
                    data: songData,
                    isPlaying: true,
                    currentStep: 0,
                    gainNode: ctx.createGain(),
                    nextNoteTime: startTime + 0.05,
                    stepMap,
                };

                track.gainNode.gain.setValueAtTime(0, startTime);
                track.gainNode.gain.setTargetAtTime(Math.max(0.0001, volume), startTime, 0.015);
                track.gainNode.connect(ZsynthPlayer.masterGain!);

                ZsynthPlayer.currentTrack = track;
                ZsynthPlayer.scheduler(track);
            };

            // AudioContext starts suspended on iOS until a user gesture — await resume before scheduling
            if (ZsynthPlayer.ctx.state === 'suspended') {
                ZsynthPlayer.ctx.resume().then(_start);
            } else {
                _start();
            }
        } catch {
            // nothing to do here
        }
    },

    scheduler: (track: ActiveTrack): void => {
        if (!ZsynthPlayer.ctx) return;

        const LOOKAHEAD = 0.1;
        const INTERVAL_MS = 25;

        const bpm = parseInt(track.data.bpm);
        const stepTime = 60 / bpm / 4;

        if (track.nextNoteTime === undefined) {
            track.nextNoteTime = ZsynthPlayer.ctx.currentTime + 0.05;
        }

        while (track.nextNoteTime < ZsynthPlayer.ctx.currentTime + LOOKAHEAD) {
            if (!track.isPlaying || ZsynthPlayer.currentTrack !== track) return;

            const sIdx = track.currentStep % 64;

            if (ZsynthPlayer.onStep) {
                ZsynthPlayer.onStep(sIdx);
            }

            const notes = track.stepMap[sIdx] || [];
            notes.forEach(({ trackId, note }) => {
                try {
                    const config = track.data.config[trackId] || { vol: 80 };
                    if (trackId.startsWith('synth')) {
                        ZsynthPlayer.playSynth(note, track.nextNoteTime, config, track.gainNode);
                    } else {
                        ZsynthPlayer.playDrum(note, track.nextNoteTime, config.vol / 100, track.gainNode);
                    }
                } catch { /* audio scheduling error — skip note, keep scheduler running */ }
            });

            track.currentStep++;
            track.nextNoteTime += stepTime;
        }

        setTimeout(() => ZsynthPlayer.scheduler(track), INTERVAL_MS);
    },

    playDrum: (type: string, time: number, vol: number, target: AudioNode): void => {
        if (!ZsynthPlayer.ctx) return;
        const ctx = ZsynthPlayer.ctx;
        const g = ctx.createGain();
        g.connect(target);

        if (type === 'CLAP') {
            const bufSize = Math.floor(ctx.sampleRate * 0.05);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 2800;
            bp.Q.value = 0.8;
            g.gain.setValueAtTime(Math.max(0.0001, vol * 0.9), time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
            src.connect(bp);
            bp.connect(g);
            src.start(time);
            src.stop(time + 0.05);
            return;
        }

        const osc = ctx.createOscillator();
        if (type === 'KICK') {
            g.gain.setValueAtTime(Math.max(0.0001, vol * 0.5), time);
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            osc.connect(g);
            osc.start(time);
            osc.stop(time + 0.2);
        } else if (type === 'HI-HAT') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, time);
            g.gain.setValueAtTime(Math.max(0.0001, vol * 0.35), time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
            osc.connect(g);
            osc.start(time);
            osc.stop(time + 0.05);
        } else {
            // SNARE
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, time);
            g.gain.setValueAtTime(Math.max(0.0001, vol * 0.5), time);
            g.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
            osc.connect(g);
            osc.start(time);
            osc.stop(time + 0.2);
        }
    },

    playSynth: (note: string, time: number, cfg: SynthConfig, target: AudioNode): void => {
        if (!ZsynthPlayer.ctx) return;

        const freq = ZsynthPlayer.freqs[note] || 220;

        const f = ZsynthPlayer.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(cfg.filter || 2000, time);

        const attack = cfg.attack ?? 0.02;
        const release = cfg.release ?? 0.3;
        const detune = cfg.detune ?? 0;
        const v = Math.max(0.0001, (cfg.vol / 100) * 0.2);

        const g = ZsynthPlayer.ctx.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(v, time + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);

        const osc = ZsynthPlayer.ctx.createOscillator();
        osc.type = cfg.wave || 'square';
        osc.frequency.setValueAtTime(freq || 220, time);

        if (detune !== 0) {
            const osc2 = ZsynthPlayer.ctx.createOscillator();
            osc2.type = cfg.wave || 'square';
            osc2.frequency.setValueAtTime(freq * Math.pow(2, detune / 1200), time);
            osc2.connect(f);
            osc2.start(time);
            osc2.stop(time + attack + release + 0.05);
        }

        osc.connect(f);
        f.connect(g);
        g.connect(target);
        osc.start(time);
        osc.stop(time + attack + release + 0.05);
    },

    stop: (): void => {
        if (ZsynthPlayer.currentTrack && ZsynthPlayer.ctx) {
            ZsynthPlayer.currentTrack.isPlaying = false;
            ZsynthPlayer.currentTrack.gainNode.gain.setTargetAtTime(0, ZsynthPlayer.ctx.currentTime, 0.05);
        }
    },
};

export default ZsynthPlayer;
