import type { Plugin } from 'vite';
import { deflateRawSync } from 'zlib';
import { basename } from 'path';

const VIRTUAL_EXPAND = '\0zdef-expand';
const VIRTUAL_LOADER = '\0model-loader';

// Long key → short key (ZDEF1 + ZDEF2)
const C: Record<string, string> = {
    // ZDEF1
    axis: 'a', collisionBoxes: 'cb', color: 'c', faces: 'f',
    id: 'i', label: 'lb', movementType: 'mt', normal: 'n',
    param: 'pm', parent: 'pr', parts: 'pt', pivot: 'pv',
    rescueZones: 'rz', role: 'rl', rotate: 'ro', rotateNodes: 'rn',
    static: 'st', stroke: 'sk', verts: 'v',
    xMax: 'xx', xMin: 'xi', yMax: 'yx', yMin: 'yi', zMax: 'zx', zMin: 'zi',
    strokeWidth: 'sw', pos: 'ps',
    // ZDEF2
    nodes: 'nd', children: 'ch', lights: 'li', depthAnchor: 'da',
    animate: 'an', type: 'ty', speed: 'sp', amplitude: 'am',
    lineWidth: 'lw', fragments: 'fr', faceIds: 'fd', impulse: 'ip',
    torque: 'tq', colorOff: 'cf', blink: 'bk', radius: 'ra',
    landingZone: 'lz', palettes: 'pa', version: 've',
    glowColor: 'gc', glowRadius: 'gr', blinkHz: 'bh',
};

// Shared reverse-expand code used in both virtual modules
const _EXPAND_FN = (prefix: string) =>
    `const ${prefix}M={${Object.entries(C).map(([l, s]) => `${s}:'${l}'`).join(',')}};` +
    `const ${prefix}uv=a=>{const r=[];for(let i=0;i<a.length;i+=3)r.push([a[i],a[i+1],a[i+2]]);return r;};` +
    `const ${prefix}e=v=>Array.isArray(v)?v.map(${prefix}e):v&&typeof v==='object'?` +
    `Object.fromEntries(Object.entries(v).map(([k,u])=>{const K=${prefix}M[k]??k;` +
    `return[K,K==='verts'?${prefix}uv(u):${prefix}e(u)];})):v;`;

// virtual:zdef-expand — synchronous expand used in dev mode
const EXPAND_SRC = _EXPAND_FN('') + `export const expandZdef=e;`;

// virtual:model-loader (build) — async decompress queues
const LOADER_SRC_BUILD =
    _EXPAND_FN('_') +
    `const _h=[];const _m=[];` +
    `export const _r=(s,d,h)=>{(h?_h:_m).push({s,d});};` +
    `const _dc=async q=>{await Promise.all(q.splice(0).map(async({s,d})=>{` +
    `const b=Uint8Array.from(atob(d.slice(1)),c=>c.charCodeAt(0));` +
    `const ds=new DecompressionStream('deflate-raw');` +
    `const t=await new Response(new Blob([b]).stream().pipeThrough(ds)).text();` +
    `Object.assign(s,_e(JSON.parse(t)));` +
    `}));};` +
    `export const decompressHelis=()=>_dc(_h);` +
    `export const decompressMissionAssets=()=>_dc(_m);`;

// virtual:model-loader (dev) — all no-ops; ZDEFs already expanded synchronously
const LOADER_SRC_DEV =
    `export const _r=()=>{};` +
    `export const decompressHelis=()=>Promise.resolve();` +
    `export const decompressMissionAssets=()=>Promise.resolve();`;

const HELI_MODELS = new Set(['atlas', 'dolphin', 'ornithopter', 'coasthawk']);

const compress = (val: unknown, key?: string): unknown => {
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

export const zdefPlugin = (): Plugin => {
    let isBuild = false;
    return {
        name: 'zdef',
        configResolved(config) { isBuild = config.command === 'build'; },
        resolveId: id => {
            if (id === 'virtual:zdef-expand') return VIRTUAL_EXPAND;
            if (id === 'virtual:model-loader') return VIRTUAL_LOADER;
            return null;
        },
        load: id => {
            if (id === VIRTUAL_EXPAND) return EXPAND_SRC;
            if (id === VIRTUAL_LOADER) return isBuild ? LOADER_SRC_BUILD : LOADER_SRC_DEV;
            return null;
        },
        transform(code: string, id: string) {
            if (!id.endsWith('.zdef')) return null;
            // Already processed by tree-shake plugin (or another pass)
            if (code.startsWith('export default')) return null;
            const stripped = code.replace(/\/\/[^\n]*/g, '');
            const compressed = compress(JSON.parse(stripped));
            if (isBuild) {
                const json = JSON.stringify(compressed);
                const b64 = '\x00' + deflateRawSync(Buffer.from(json, 'utf-8')).toString('base64');
                const isHeli = HELI_MODELS.has(basename(id, '.zdef'));
                return {
                    code: `import{_r}from'virtual:model-loader';const _s={};_r(_s,${JSON.stringify(b64)},${isHeli});export default _s;`,
                    map: null,
                };
            }
            return {
                code: `import{expandZdef as _e}from'virtual:zdef-expand';export default _e(${JSON.stringify(compressed)});`,
                map: null,
            };
        },
    };
};
