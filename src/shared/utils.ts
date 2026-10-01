const FOLIAGE_ENCODE: Record<string, string> = { pine: 'p', oak: 'o', bush: 'b', dead: 'd', beach_umbrella: 'u', beach_lounger: 'l', beach_cooler: 'c', beach_umbrella_tilted: 'v', beach_person: 'g', swimmer: 's', xmas_elf: 'x' };
const FOLIAGE_DECODE: Record<string, string> = { p: 'pine', o: 'oak', b: 'bush', d: 'dead', u: 'beach_umbrella', l: 'beach_lounger', c: 'beach_cooler', v: 'beach_umbrella_tilted', g: 'beach_person', s: 'swimmer', x: 'xmas_elf' };

// Format pro Baum: {type}{x*10},{y*10},{s*10}  →  z.B. "p123,87,10"
// Bäume getrennt durch "|"
export const compressFoliage = (foliage: { x: number; y: number; s: number; type: string }[]): string => {
    if (!foliage || foliage.length === 0) return '';
    return foliage
        .map(f => {
            const t = FOLIAGE_ENCODE[f.type] || 'p';
            const x = Math.round(f.x * 10);
            const y = Math.round(f.y * 10);
            const s = Math.round((f.s || 1.0) * 10);
            return `${t}${x},${y},${s}`;
        })
        .join('|');
};

export const decompressFoliage = (str: string): { x: number; y: number; s: number; type: string }[] => {
    if (!str) return [];
    return str.split('|').map(token => {
        const type = FOLIAGE_DECODE[token[0]] || 'pine';
        const [x, y, s] = token.slice(1).split(',').map(Number);
        return { type, x: x / 10, y: y / 10, s: s / 10 };
    });
};

export const compressTerrain = (grid: number[][]): string => {
    const flat: number[] = [];
    grid.forEach(col => col.forEach(v => flat.push(Math.round(v * 10))));

    const res: (string | number)[] = [];
    let count = 1;
    let cur = flat[0];

    for (let i = 1; i < flat.length; i++) {
        if (flat[i] === cur) {
            count++;
        } else {
            res.push(count > 1 ? `${cur}x${count}` : cur);
            cur = flat[i];
            count = 1;
        }
    }
    res.push(count > 1 ? `${cur}x${count}` : cur);
    return res.join(',');
};

export const decompressTerrain = (str: string, gridSize: number): number[][] => {
    const flat: number[] = [];
    str.split(',').forEach(t => {
        if (t.includes('x')) {
            const [v, c] = t.split('x');
            for (let i = 0; i < parseInt(c, 10); i++) flat.push(parseInt(v, 10) / 10);
        } else {
            flat.push(parseInt(t, 10) / 10);
        }
    });

    const res: number[][] = [];
    let k = 0;
    for (let x = 0; x <= gridSize; x++) {
        res[x] = [];
        for (let y = 0; y <= gridSize; y++) {
            res[x][y] = flat[k++];
        }
    }
    return res;
};
