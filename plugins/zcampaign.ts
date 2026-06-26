import type { Plugin } from 'vite';
import { basename } from 'path';

export const zcampaignPlugin = (): Plugin => ({
    name: 'zcampaign',
    transform(code: string, id: string) {
        if (!id.endsWith('.zcampaign')) return null;
        const data = JSON.parse(code); // throw early on malformed JSON
        const key = basename(id, '.zcampaign');
        return { code: `export default ${JSON.stringify({ ...data, _key: key })};`, map: null };
    },
});
