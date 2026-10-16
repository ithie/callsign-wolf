import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { zdefPlugin } from './plugins/zdef';

export default defineConfig({
    resolve: {
        alias: { '@': resolve(__dirname, 'src') },
    },
    plugins: [zdefPlugin()],
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
