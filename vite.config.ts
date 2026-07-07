import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import type { Plugin } from 'vite';
import { zsongPlugin } from './plugins/zsong';
import { zdefPlugin } from './plugins/zdef';
import { zcampaignPlugin } from './plugins/zcampaign';
import { zdefTreeShakePlugin } from './plugins/zdef-tree-shake';
import { makeSingleFile } from './plugins/make-single-file';

const GZIP_WARN_THRESHOLD = 500 * 1024; // 500 kB

const swapEntry = (): Plugin => ({
    name: 'swap-entry',
    apply: 'build',
    transformIndexHtml: {
        order: 'pre',
        handler: html => (isApp ? html : html.replace('/src/game/game.ts', '/src/game/ui/promo/promo-entry.ts')),
    },
});

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

const storageWebStub = resolve(__dirname, 'src/game/storage-stub.ts');

const _appStubs: Record<string, string> = isApp
    ? {
          [resolve(__dirname, 'src/game/heli-sound')]: resolve(__dirname, 'src/game/heli-sound.app-stub.ts'),
          [resolve(__dirname, 'src/shared/ZsynthPlayer')]: resolve(__dirname, 'src/shared/ZsynthPlayer.app-stub.ts'),
      }
    : { [resolve(__dirname, 'src/game/storage')]: storageWebStub };

const stubsPlugin = (): Plugin => ({
    name: 'stubs',
    enforce: 'pre',
    resolveId(id, importer) {
        if (!importer || !id.startsWith('.')) return;
        const abs = resolve(dirname(importer), id).replace(/\.[jt]sx?$/, '');
        return _appStubs[abs];
    },
});

const injectAppCsp = (): Plugin => ({
    name: 'inject-app-csp',
    transformIndexHtml: html =>
        html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:; media-src *;" />`
        ),
});

export default defineConfig(({ command }) => {
    return {
        define: {
            __APP_VERSION__: JSON.stringify(version),
            __ORNI_SPAWN_RATE__: command === 'serve' ? 1 : 15,
        },
        resolve: {
            alias: { '@': resolve(__dirname, 'src') },
        },
        base: isApp ? './' : command === 'build' ? '/callsign-wolf/' : '/',
        plugins: [
            zsongPlugin(),
            zdefTreeShakePlugin(resolve(__dirname, 'src/game/campaigns')),
            zdefPlugin(),
            zcampaignPlugin(),
            makeSingleFile(),
            stubsPlugin(),
            swapEntry(),
            bundleSizeGuard(),
            ...(isApp ? [injectAppCsp()] : []),
        ],
        build: {
            outDir: 'dist/',

            emptyOutDir: false,

            rollupOptions: {
                input: { index: resolve(__dirname, 'index.html') },
                output: {
                    inlineDynamicImports: true,
                },
            },
            assetsInlineLimit: 100000000,
        },
    };
});
