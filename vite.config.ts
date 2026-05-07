import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import type { Plugin } from 'vite';
import { zsongPlugin } from './plugins/zsong';
import { zdefPlugin } from './plugins/zdef';
import { makeSingleFile } from './plugins/make-single-file';

const GZIP_WARN_THRESHOLD = 500 * 1024; // 500 kB

const bundleSizeGuard = (): Plugin => ({
    name: 'bundle-size-guard',
    closeBundle() {
        const outFile = resolve(__dirname, 'dist/index.html');
        let raw: Buffer;
        try {
            raw = readFileSync(outFile);
        } catch {
            return;
        }
        const gzipped = gzipSync(raw).length;
        const kb = (gzipped / 1024).toFixed(1);
        if (gzipped > GZIP_WARN_THRESHOLD) {
            console.warn(
                `\n⚠  Bundle size warning: dist/index.html is ${kb} kB gzipped (threshold: ${GZIP_WARN_THRESHOLD / 1024} kB)\n`
            );
        } else {
            console.info(`✓  Bundle size: dist/index.html ${kb} kB gzipped`);
        }
    },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

const isApp = process.env.VITE_TARGET === 'app';

const mpStub = resolve(__dirname, 'src/game/multiplayer/mp-stub.ts');
const mpGameStub = resolve(__dirname, 'src/game/mp-game-stub.ts');
const whatsNewStub = resolve(__dirname, 'src/game/ui/whats-new/whats-new-stub.ts');
const storageWebStub = resolve(__dirname, 'src/game/storage-web.ts');

const injectAppCsp = (): Plugin => ({
    name: 'inject-app-csp',
    transformIndexHtml: html =>
        html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:; media-src *;" />`
        ),
});

export default defineConfig(() => {
    return {
        define: { __APP_VERSION__: JSON.stringify(version) },
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                ...(isApp
                    ? {
                          [resolve(__dirname, 'src/game/multiplayer/mp-state')]: mpStub,
                          [resolve(__dirname, 'src/game/multiplayer/sync')]: mpStub,
                          [resolve(__dirname, 'src/game/multiplayer/mp-mission')]: mpStub,
                          [resolve(__dirname, 'src/game/ui/mp-lobby/mp-lobby')]: mpStub,
                          [resolve(__dirname, 'src/game/mp-game')]: mpGameStub,
                          [resolve(__dirname, 'src/game/ui/whats-new/whats-new')]: whatsNewStub,
                      }
                    : {
                          [resolve(__dirname, 'src/game/storage')]: storageWebStub,
                      }),
            },
        },
        base: isApp ? './' : '/callsign-wolf/',
        plugins: [zsongPlugin(), zdefPlugin(), makeSingleFile(), bundleSizeGuard(), ...(isApp ? [injectAppCsp()] : [])],
        build: {
            outDir: 'dist/',

            emptyOutDir: false,

            rollupOptions: {
                input: resolve(__dirname, 'index.html'),
                output: {
                    inlineDynamicImports: true,
                },
            },
            assetsInlineLimit: 100000000,
        },
    };
});
