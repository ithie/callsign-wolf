import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';

// DEFs in models/objects/ that are not campaign object types but must always be bundled
const _CORE_TYPES = new Set(['tower', 'hangar_tower', 'hangar']);

export const zdefTreeShakePlugin = (campaignsDir: string): Plugin => {
    const usedTypes = new Set<string>();

    return {
        name: 'zdef-tree-shake',
        enforce: 'pre',
        apply: 'build',
        buildStart() {
            usedTypes.clear();
            for (const file of readdirSync(campaignsDir).filter(f => f.endsWith('.zcampaign'))) {
                const data = JSON.parse(readFileSync(resolve(campaignsDir, file), 'utf-8'));
                for (const level of data.levels ?? []) {
                    for (const obj of [...(level.objects ?? []), ...(level.payloads ?? [])]) {
                        if (obj.type) usedTypes.add(obj.type as string);
                    }
                }
            }
        },
        transform(code: string, id: string) {
            if (!id.includes('/models/objects/') || !id.endsWith('.zdef')) return null;
            if (code.startsWith('export default')) return null;
            const stem = basename(id, '.zdef');
            if (_CORE_TYPES.has(stem) || usedTypes.has(stem)) return null;
            return { code: "export default {};", map: null };
        },
    };
};
