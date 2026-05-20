import esbuild from 'esbuild';
import { mkdirSync, readFileSync } from 'fs';
import path from 'path';

mkdirSync('media', { recursive: true });

const watch = process.argv.includes('--watch');

// ── CSS inject plugin ──────────────────────────────────────────────────────
// Transforms `import './foo.css'` into a <style> injection snippet so that
// CSS works inside VS Code WebView panels without a separate stylesheet file.
const cssInjectPlugin = {
    name: 'css-inject',
    setup(build) {
        build.onLoad({ filter: /\.css$/ }, (args) => {
            const css = readFileSync(args.path, 'utf-8');
            return {
                contents: `
const __el = document.createElement('style');
__el.textContent = ${JSON.stringify(css)};
document.head.appendChild(__el);
`,
                loader: 'js',
            };
        });
    },
};

// ── Preview stubs plugin ───────────────────────────────────────────────────
// Redirects src/game/main and src/game/storage to lightweight stubs so that
// the UI preview bundle doesn't pull in ZsynthPlayer or Capacitor natives.
const ROOT = path.resolve('..');
const previewStubsPlugin = {
    name: 'preview-stubs',
    setup(build) {
        const mainReal = path.join(ROOT, 'src', 'game', 'main.ts');
        const mainStub = path.join(ROOT, 'src', 'game', 'main-stub.ts');
        const storageReal = path.join(ROOT, 'src', 'game', 'storage.ts');
        const storageStub = path.join(ROOT, 'src', 'game', 'storage-stub.ts');

        build.onResolve({ filter: /.*/ }, async (args) => {
            if (!args.resolveDir || args.path.startsWith('\0')) return null;
            const full = path.resolve(args.resolveDir, args.path);
            if (full === mainReal || full === mainReal.replace(/\.ts$/, '')) {
                return { path: mainStub };
            }
            if (full === storageReal || full === storageReal.replace(/\.ts$/, '')) {
                return { path: storageStub };
            }
            return null;
        });
    },
};

const extCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode', 'esbuild'],
    outfile: 'dist/extension.js',
    sourcemap: true,
    minify: false,
});

const trackerCtx = await esbuild.context({
    entryPoints: ['tracker-view/main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'media/tracker.js',
    sourcemap: true,
    minify: false,
});

const campaignCtx = await esbuild.context({
    entryPoints: ['tracker-view/campaign-main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'media/campaign.js',
    sourcemap: true,
    minify: false,
});

const campaignEditorCtx = await esbuild.context({
    entryPoints: ['tracker-view/campaign-editor-main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'media/campaign-editor.js',
    sourcemap: true,
    minify: false,
    loader: { '.css': 'text', '.zdef': 'json' },
    alias: { '@/shared': '../src/shared' },
    tsconfig: '../tsconfig.json',
});

const zsoundCtx = await esbuild.context({
    entryPoints: ['tracker-view/zsound-main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'media/zsound.js',
    sourcemap: true,
    minify: false,
});

const zdefCtx = await esbuild.context({
    entryPoints: ['tracker-view/zdef-main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'media/zdef.js',
    sourcemap: true,
    minify: false,
    loader: { '.zdef': 'json' },
    tsconfig: '../tsconfig.json',
});

if (watch) {
    await extCtx.watch();
    await trackerCtx.watch();
    await campaignCtx.watch();
    await campaignEditorCtx.watch();
    await zsoundCtx.watch();
    await zdefCtx.watch();
    console.log('Watching…');
} else {
    await Promise.all([extCtx.rebuild(), trackerCtx.rebuild(), campaignCtx.rebuild(), campaignEditorCtx.rebuild(), zsoundCtx.rebuild(), zdefCtx.rebuild()]);
    await Promise.all([extCtx.dispose(), trackerCtx.dispose(), campaignCtx.dispose(), campaignEditorCtx.dispose(), zsoundCtx.dispose(), zdefCtx.dispose()]);
}
