import type { Plugin } from 'vite';

const DRUM_IDS = new Set(['kick', 'snare', 'hat', 'clap']);
const DRUM_LABEL: Record<string, string> = { kick: 'KICK', snare: 'SNARE', hat: 'HI-HAT', clap: 'CLAP' };

const parseZsong = (text: string): object => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    let bpm = '120';
    const activeData: Record<string, string> = {};
    const config: Record<string, unknown> = {};

    let i = 0;
    if (lines[i]?.startsWith('bpm ')) { bpm = lines[i].slice(4).trim(); i++; }

    while (i < lines.length) {
        const match = lines[i].match(/^\[(\w+)\](.*)/);
        if (!match) { i++; continue; }

        const trackId = match[1];
        const trackCfg: Record<string, unknown> = {};
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
                    activeData[`${trackId}-${s}`] = DRUM_LABEL[trackId] ?? 'HIT';
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

export const zsongPlugin = (): Plugin => ({
    name: 'zsong',
    transform(code: string, id: string) {
        if (!id.endsWith('.zsong')) return null;
        return { code: `export default ${JSON.stringify(parseZsong(code))};`, map: null };
    },
});
