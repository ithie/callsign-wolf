import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { zdefPlugin } from './plugins/zdef';
import { scriptTypesPlugin } from './plugins/script-types';

export default defineConfig({
    plugins: [zdefPlugin(), scriptTypesPlugin(resolve(__dirname, 'src/game/campaigns'))],
    resolve: {
        alias: { '@': resolve(__dirname, 'src') },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts'],
        },
    },
});
