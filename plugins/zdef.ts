import type { Plugin } from 'vite';

const VIRTUAL_ID = '\0zdef-expand';

const C: Record<string, string> = {
    axis: 'a', collisionBoxes: 'cb', color: 'c', faces: 'f',
    id: 'i', label: 'lb', movementType: 'mt', normal: 'n',
    param: 'pm', parent: 'pr', parts: 'pt', pivot: 'pv',
    rescueZones: 'rz', role: 'rl', rotate: 'ro', rotateNodes: 'rn',
    static: 'st', stroke: 'sk', verts: 'v',
    xMax: 'xx', xMin: 'xi', yMax: 'yx', yMin: 'yi', zMax: 'zx', zMin: 'zi',
};

// Runtime expander: reverse key map + unflatten verts ([x,y,z,...] → [[x,y,z],...])
const EXPAND_SRC =
    `const M={${Object.entries(C).map(([l, s]) => `${s}:'${l}'`).join(',')}};` +
    `const uv=a=>{const r=[];for(let i=0;i<a.length;i+=3)r.push([a[i],a[i+1],a[i+2]]);return r;};` +
    `const e=v=>Array.isArray(v)?v.map(e):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,u])=>{const K=M[k]??k;return[K,K==='verts'?uv(u):e(u)];})):v;` +
    `export const expandZdef=e;`;

const compress = (val: unknown, key?: string): unknown => {
    // Flatten verts: [[x,y,z],...] → [x,y,z,...]
    if (key === 'verts' && Array.isArray(val)) return (val as number[][]).flat();
    if (Array.isArray(val)) return val.map(v => compress(v));
    if (val && typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>))
            out[C[k] ?? k] = compress(v, k);
        return out;
    }
    return val;
};

export const zdefPlugin = (): Plugin => ({
    name: 'zdef',
    resolveId: id => (id === 'virtual:zdef-expand' ? VIRTUAL_ID : null),
    load: id => (id === VIRTUAL_ID ? EXPAND_SRC : null),
    transform(code: string, id: string) {
        if (!id.endsWith('.zdef')) return null;
        const compressed = JSON.stringify(compress(JSON.parse(code)));
        return {
            code: `import{expandZdef as _e}from'virtual:zdef-expand';export default _e(${compressed});`,
            map: null,
        };
    },
});
