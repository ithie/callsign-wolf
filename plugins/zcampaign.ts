import type { Plugin } from 'vite';
import { basename } from 'path';
import { deflateRawSync } from 'zlib';

const COMPRESSED_PREFIX = '\x00';

const _compress = (s: string): string =>
    COMPRESSED_PREFIX + deflateRawSync(Buffer.from(s, 'utf-8')).toString('base64');

const compressTerrain = _compress;

export const zcampaignPlugin = (): Plugin => {
    let isBuild = false;
    return {
        name: 'zcampaign',
        configResolved(config) {
            isBuild = config.command === 'build';
        },
        transform(code: string, id: string) {
            if (!id.endsWith('.zcampaign')) return null;
            const data = JSON.parse(code);
            const key = basename(id, '.zcampaign');
            if (isBuild) {
                for (const level of data.levels ?? []) {
                    if (typeof level.terrain === 'string') level.terrain = compressTerrain(level.terrain);
                    if (typeof level.sand === 'string') level.sand = compressTerrain(level.sand);
                    if (typeof level.pavement === 'string') level.pavement = compressTerrain(level.pavement);
                    if (typeof level.foliage === 'string') level.foliage = _compress(level.foliage);
                    // Compress mission-only data (objects/payloads/events) — decompressed at launchMission
                    const _ops: Record<string, unknown> = {};
                    for (const k of ['objects', 'payloads', 'events'] as const) {
                        if (level[k]) { _ops[k] = level[k]; delete level[k]; }
                    }
                    if (Object.keys(_ops).length) level._ops = _compress(JSON.stringify(_ops));
                }
            }
            return { code: `export default ${JSON.stringify({ ...data, _key: key })};`, map: null };
        },
    };
};
