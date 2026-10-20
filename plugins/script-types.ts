import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';

// Campaign scripts (src/game/campaigns/<key>.script.ts), see docs/SCRIPTING.md:
//  - generates <key>.script-objects.ts (object names + types per mission) from the
//    .zcampaign, so a misspelled or missing name is a compile error;
//  - rejects imports of game internals from scripts.

const VESSEL_TYPES = new Set([
    'carrier', 'boat', 'pilot_boat', 'sar_boat', 'salvage_tug', 'supply_vessel', 'frigate', 'submarine',
]);
const PROP_TYPES = new Set(['buoy', 'reindeer', 'sleigh', 'xmas_candy_cane', 'xmas_tree']);
// No runtime object behind these — not addressable from scripts.
const UNSCRIPTED_TYPES = new Set(['pad', 'lighthouse', 'ornithopter_wreck', 'volleyball_court', 'ring']);

type _Named = { type: string; name?: string };
type _Level = { id?: string; objects?: _Named[]; payloads?: (_Named & { spawnOnboard?: boolean })[] };

const _tsType = (type: string, isPayload: boolean): string | null => {
    if (isPayload) return `Payload<'${type}'>`;
    if (UNSCRIPTED_TYPES.has(type)) return null;
    if (VESSEL_TYPES.has(type)) return `Vessel<'${type}'>`;
    if (type === 'wind_turbine') return 'WindTurbine';
    if (PROP_TYPES.has(type)) return `Prop<'${type}'>`;
    return `Structure<'${type}'>`;
};

const _typeName = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1) + 'Objects';

// Pure: .zcampaign data → contents of <key>.script-objects.ts.
export const generateScriptObjects = (key: string, campaign: { levels?: _Level[] }): string => {
    const used = new Set<string>();
    const apiTypes = new Set<string>();
    const missions: string[] = [];
    for (const level of campaign.levels ?? []) {
        if (!level.id) continue;
        if (used.has(level.id)) throw new Error(`${key}.zcampaign: mission id '${level.id}' is used twice`);
        used.add(level.id);
        const names = new Map<string, string>();
        const add = (n: _Named, isPayload: boolean): void => {
            if (!n.name) return;
            if (names.has(n.name)) throw new Error(`${key}.zcampaign, mission '${level.id}': name '${n.name}' is used twice`);
            const t = _tsType(n.type, isPayload);
            if (!t) return;
            names.set(n.name, t);
            apiTypes.add(t.replace(/<.*$/, ''));
        };
        (level.objects ?? []).forEach(o => add(o, false));
        (level.payloads ?? []).forEach(p => add(p, true));
        const body = [...names].map(([n, t]) => `        ${JSON.stringify(n)}: ${t};`).join('\n');
        missions.push(`    ${JSON.stringify(level.id)}: {${body ? `\n${body}\n    ` : ''}};`);
    }
    return [
        `// Generated from ${key}.zcampaign by plugins/script-types.ts — do not edit.`,
        ...(apiTypes.size ? [`import type { ${[...apiTypes].sort().join(', ')} } from '@/game/script';`, ''] : []),
        `export type ${_typeName(key)} = {`,
        ...missions,
        '};',
        '',
    ].join('\n');
};

// Writes the type file for every campaign that has a script. Only touches changed files.
export const writeScriptObjects = (campaignsDir: string): void => {
    for (const file of readdirSync(campaignsDir).filter(f => f.endsWith('.script.ts'))) {
        const key = file.slice(0, -'.script.ts'.length);
        const src = join(campaignsDir, `${key}.zcampaign`);
        if (!existsSync(src)) continue;
        const out = join(campaignsDir, `${key}.script-objects.ts`);
        const code = generateScriptObjects(key, JSON.parse(readFileSync(src, 'utf-8')));
        if (!existsSync(out) || readFileSync(out, 'utf-8') !== code) writeFileSync(out, code);
    }
};

const _IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

// Scripts may import the script API and files next to them — never game internals.
export const checkScriptImports = (code: string, file: string, campaignsDir: string): string[] => {
    const errors: string[] = [];
    for (const m of code.matchAll(_IMPORT_RE)) {
        const spec = m[1] ?? m[2] ?? m[3];
        if (spec === '@/game/script') continue;
        if (spec.startsWith('.') && resolve(dirname(file), spec).startsWith(campaignsDir)) continue;
        errors.push(`${basename(file)}: campaign scripts may only import '@/game/script' or files in src/game/campaigns/ (found '${spec}')`);
    }
    return errors;
};

export const scriptTypesPlugin = (campaignsDir: string): Plugin => ({
    name: 'script-types',
    buildStart() {
        writeScriptObjects(campaignsDir);
    },
    watchChange(id) {
        if (id.endsWith('.zcampaign') || id.endsWith('.script.ts')) writeScriptObjects(campaignsDir);
    },
    transform(code, id) {
        if (!id.startsWith(campaignsDir) || !id.endsWith('.script.ts')) return null;
        const errors = checkScriptImports(code, id, campaignsDir);
        if (errors.length) this.error(errors.join('\n'));
        return null;
    },
});
