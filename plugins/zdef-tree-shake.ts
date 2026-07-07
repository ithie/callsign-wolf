import type { Plugin } from 'vite';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

export const zdefTreeShakePlugin = (campaignsDir: string): Plugin => {
    const usedTypes = new Set<string>();

    return {
        name: 'zdef-tree-shake',
        enforce: 'pre',
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
            const stripped = code.replace(/\/\/[^\n]*/g, '');
            let zdefId: string | undefined;
            try {
                zdefId = (JSON.parse(stripped) as { id?: string }).id;
            } catch {
                return null;
            }
            if (zdefId && !usedTypes.has(zdefId)) {
                return { code: "export default {};", map: null };
            }
            return null;
        },
    };
};
