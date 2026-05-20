import { defineConfig } from 'vitest/config';
import { zdefPlugin } from './plugins/zdef';

export default defineConfig({
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
