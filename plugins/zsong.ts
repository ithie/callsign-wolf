import type { Plugin } from 'vite';

export const zsongPlugin = (): Plugin => ({
    name: 'zsong',
    transform(code: string, id: string) {
        if (!id.endsWith('.zsong')) return null;
        return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
});
