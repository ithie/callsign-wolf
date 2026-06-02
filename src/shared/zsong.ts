import type { SongData } from './tracker-types';

const DRUM_IDS = new Set(['kick', 'snare', 'hat', 'clap']);
const DRUM_LABEL: Record<string, string> = { kick: 'KICK', snare: 'SNARE', hat: 'HI-HAT', clap: 'CLAP' };
const TRACK_ORDER = ['kick', 'snare', 'hat', 'clap', 'synth1', 'synth2', 'synth3', 'synth4'];

export const parseZsong = (text: string): SongData => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    let bpm = '120';
    const activeData: Record<string, string> = {};
    const config: Record<string, any> = {};

    let i = 0;
    if (lines[i]?.startsWith('bpm ')) { bpm = lines[i].slice(4).trim(); i++; }

    while (i < lines.length) {
        const match = lines[i].match(/^\[(\w+)\](.*)/);
        if (!match) { i++; continue; }

        const trackId = match[1];
        const trackCfg: Record<string, any> = {};
        for (const m of (match[2] ?? '').matchAll(/(\w+)=(\S+)/g)) {
            const v = m[2];
            trackCfg[m[1]] = isNaN(Number(v)) ? v : Number(v);
        }
        config[trackId] = trackCfg;
        i++;

        if (i < lines.length && !lines[i].startsWith('[')) {
            const stepLine = lines[i];
            i++;
            if (DRUM_IDS.has(trackId)) {
                for (const s of stepLine.split(/\s+/).filter(Boolean))
                    activeData[`${trackId}-${s}`] = DRUM_LABEL[trackId]!;
            } else {
                for (const part of stepLine.split(/\s+/).filter(Boolean)) {
                    const colon = part.indexOf(':');
                    if (colon > 0) activeData[`${trackId}-${part.slice(0, colon)}`] = part.slice(colon + 1);
                }
            }
        }
    }

    return { bpm, activeData, config };
};

export const songToZsong = (data: SongData): string => {
    const lines: string[] = [`bpm ${data.bpm}`, ''];

    for (const trackId of TRACK_ORDER) {
        const cfg = data.config[trackId];
        const isDrum = DRUM_IDS.has(trackId);

        const steps: string[] = [];
        for (let s = 0; s < 64; s++) {
            const v = data.activeData[`${trackId}-${s}`];
            if (v !== undefined) steps.push(isDrum ? String(s) : `${s}:${v}`);
        }

        if (!cfg && !steps.length) continue;

        const cfgStr = cfg ? Object.entries(cfg).map(([k, v]) => `${k}=${v}`).join('  ') : '';
        lines.push((`[${trackId}]  ${cfgStr}`).trimEnd());
        if (steps.length) lines.push(steps.join(' '));
        lines.push('');
    }

    return lines.join('\n');
};
