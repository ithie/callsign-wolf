import type { Plugin } from 'vite';

export const zcampaignPlugin = (): Plugin => ({
    name: 'zcampaign',
    transform(code: string, id: string) {
        if (!id.endsWith('.zcampaign')) return null;
        JSON.parse(code); // throw early on malformed JSON
        return { code: `export default ${code};`, map: null };
    },
});
