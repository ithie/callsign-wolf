import type { Plugin } from 'vite';
import { basename } from 'path';
import { deflateRawSync } from 'zlib';

const COMPRESSED_PREFIX = '\x00';

const compressTerrain = (rle: string): string => {
    const buf = deflateRawSync(Buffer.from(rle, 'utf-8'));
    return COMPRESSED_PREFIX + buf.toString('base64');
};

export const zcampaignPlugin = (): Plugin => ({
    name: 'zcampaign',
    transform(code: string, id: string) {
        if (!id.endsWith('.zcampaign')) return null;
        const data = JSON.parse(code);
        const key = basename(id, '.zcampaign');
        for (const level of data.levels ?? []) {
            if (typeof level.terrain === 'string') level.terrain = compressTerrain(level.terrain);
            if (typeof level.sand === 'string') level.sand = compressTerrain(level.sand);
            if (typeof level.pavement === 'string') level.pavement = compressTerrain(level.pavement);
        }
        return { code: `export default ${JSON.stringify({ ...data, _key: key })};`, map: null };
    },
});
