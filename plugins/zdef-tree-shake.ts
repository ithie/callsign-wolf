import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';

export const zdefTreeShakePlugin = (campaignsDir: string): Plugin => {
    const usedTypes = new Set<string>();

    const _scanSrcForZdefImports = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = resolve(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'campaigns') _scanSrcForZdefImports(full);
            } else if (entry.name.endsWith('.ts')) {
                const src = readFileSync(full, 'utf-8');
                for (const m of src.matchAll(/\/models\/objects\/([^'"]+)\.zdef/g)) {
                    usedTypes.add(m[1]);
                }
            }
        }
    };

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
            _scanSrcForZdefImports(resolve(campaignsDir, '..'));
        },
        transform(code: string, id: string) {
            if (!id.includes('/models/objects/') || !id.endsWith('.zdef')) return null;
            if (code.startsWith('export default')) return null;
            const stem = basename(id, '.zdef');
            if (!usedTypes.has(stem)) {
                return { code: "export default {};", map: null };
            }
            return null;
        },
    };
};
