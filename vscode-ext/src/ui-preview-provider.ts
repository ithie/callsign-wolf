import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as esbuild from 'esbuild';

// CSS-inject plugin: turns `import './foo.css'` into a <style> injection snippet.
const _cssInjectPlugin: esbuild.Plugin = {
    name: 'css-inject',
    setup(build) {
        build.onLoad({ filter: /\.css$/ }, args => {
            const css = fs.readFileSync(args.path, 'utf-8');
            return {
                contents: `const __el=document.createElement('style');__el.textContent=${JSON.stringify(css)};document.head.appendChild(__el);`,
                loader: 'js',
            };
        });
    },
};

// Preview-stubs plugin: redirects main.ts and storage.ts to lightweight stubs.
const _previewStubsPlugin = (root: string): esbuild.Plugin => ({
    name: 'preview-stubs',
    setup(build) {
        const mainReal    = path.join(root, 'src', 'game', 'main.ts');
        const mainStub    = path.join(root, 'src', 'game', 'main-stub.ts');
        const storageReal = path.join(root, 'src', 'game', 'storage.ts');
        const storageStub = path.join(root, 'src', 'game', 'storage-stub.ts');

        build.onResolve({ filter: /.*/ }, async args => {
            if (!args.resolveDir || args.path.startsWith('\0')) return null;
            const full = path.resolve(args.resolveDir, args.path);
            if (full === mainReal    || full === mainReal.replace(/\.ts$/, ''))    return { path: mainStub };
            if (full === storageReal || full === storageReal.replace(/\.ts$/, '')) return { path: storageStub };
            return null;
        });
    },
});

const _componentFromPath = (resourcePath: string): string => {
    const m = resourcePath.replace(/\\/g, '/').match(/\/game\/ui\/([^/]+)\//);
    return m ? m[1] : '';
};

export class UiPreviewProvider {
    private readonly _ctx: vscode.ExtensionContext;
    private readonly _root: string;
    private _panels = new Map<string, vscode.WebviewPanel>();

    constructor(ctx: vscode.ExtensionContext, root: string) {
        this._ctx = ctx;
        this._root = root;

        // Rebuild all open panels when any game source file changes.
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(path.join(root, 'src'), '**/*.ts'),
        );
        const rebuild = () => this._rebuildAll();
        watcher.onDidChange(rebuild, null, ctx.subscriptions);
        watcher.onDidCreate(rebuild, null, ctx.subscriptions);
        ctx.subscriptions.push(watcher);
    }

    openForActive(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { vscode.window.showInformationMessage('Kein aktiver Editor.'); return; }
        this.openForUri(editor.document.uri);
    }

    openForUri(uri: vscode.Uri): void {
        const component = _componentFromPath(uri.fsPath);
        if (!component) return;

        const uiTsPath = path.join(this._root, 'src', 'game', 'ui', component, `${component}.ui.ts`);
        if (!fs.existsSync(uiTsPath)) {
            this._showUnavailable(component);
            return;
        }

        const existing = this._panels.get(component);
        if (existing) {
            existing.reveal();
            this._rebuild(uiTsPath, existing.webview);
            return;
        }
        this._openPanel(component, uiTsPath);
    }

    private _openPanel(component: string, uiTsPath: string): void {
        const panel = vscode.window.createWebviewPanel(
            `zw.uiPreview.${component}`,
            `Preview: ${component}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true },
        );
        this._panels.set(component, panel);
        panel.onDidDispose(() => this._panels.delete(component), null, this._ctx.subscriptions);
        this._rebuild(uiTsPath, panel.webview);
    }

    private _rebuildAll(): void {
        for (const [component, panel] of this._panels) {
            const uiTsPath = path.join(this._root, 'src', 'game', 'ui', component, `${component}.ui.ts`);
            if (fs.existsSync(uiTsPath)) this._rebuild(uiTsPath, panel.webview);
        }
    }

    private _rebuild(uiTsPath: string, webview: vscode.Webview): void {
        void this._buildStory(uiTsPath).then(script => {
            webview.html = this._html(script);
        }).catch((e: unknown) => {
            webview.html = `<!doctype html><html><body><pre style="color:#f66;background:#0a0a0a;padding:20px;font-size:12px;white-space:pre-wrap">${String(e)}</pre></body></html>`;
        });
    }

    private async _buildStory(uiTsPath: string): Promise<string> {
        const uiDir = path.join(this._root, 'src', 'game', 'ui');
        const wrapper = [
            `import ${JSON.stringify(path.join(uiDir, 'base.css'))};`,
            `import ${JSON.stringify(path.join(uiDir, 'screens.css'))};`,
            `import ${JSON.stringify(path.join(uiDir, 'nav-screens.css'))};`,
            `import * as _s from ${JSON.stringify(uiTsPath)};`,
            `const _entries = Object.entries(_s).filter(([,v]) => typeof v === 'function');`,
            // Story-picker dropdown (only visible when >1 story)
            `const _sel = document.createElement('select');`,
            `_sel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:#0d1a0d;color:#9d9;border:1px solid #3a3;font-family:monospace;font-size:11px;padding:3px 8px;border-radius:2px;outline:none;cursor:pointer';`,
            `_entries.forEach(([name]) => { const o = document.createElement('option'); o.value = o.textContent = name; _sel.appendChild(o); });`,
            // Reset body and run chosen story
            `const _run = (name) => {`,
            `  document.body.innerHTML = '<canvas id="gameCanvas" style="display:none"></canvas>';`,
            `  if (_entries.length > 1) document.body.appendChild(_sel);`,
            `  const fn = _s[name]; if (typeof fn === 'function') fn();`,
            `};`,
            `_sel.addEventListener('change', () => _run(_sel.value));`,
            `const _init = (window.__PREVIEW_STORY && _s[window.__PREVIEW_STORY]) ? window.__PREVIEW_STORY : _entries[0]?.[0];`,
            `if (_init) { _sel.value = _init; _run(_init); }`,
        ].join('\n');

        const result = await esbuild.build({
            stdin: {
                contents: wrapper,
                resolveDir: path.dirname(uiTsPath),
                loader: 'js',
            },
            bundle: true,
            platform: 'browser',
            format: 'iife',
            write: false,
            loader: { '.zdef': 'json' },
            plugins: [_cssInjectPlugin, _previewStubsPlugin(this._root)],
            tsconfig: path.join(this._root, 'tsconfig.json'),
            define: {
                'import.meta.env.VITE_TARGET': '"web"',
                'import.meta.env.DEV': 'false',
                'import.meta.env.PROD': 'true',
            },
            logLevel: 'silent',
        });
        if (result.errors.length) throw new Error(result.errors.map(e => e.text).join('\n'));
        return result.outputFiles[0].text;
    }

    private _html(script: string): string {
        return `<!doctype html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:;" />
    <style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;background:#0a0a0a;overflow:hidden}</style>
</head>
<body>
    <canvas id="gameCanvas" style="display:none"></canvas>
    <script>${script}</script>
</body>
</html>`;
    }

    private _showUnavailable(component: string): void {
        const panel = vscode.window.createWebviewPanel(
            `zw.uiPreview.${component}`,
            `Preview: ${component}`,
            vscode.ViewColumn.Beside,
            { enableScripts: false },
        );
        panel.webview.html = `<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a"><div style="font-family:monospace;font-size:13px;color:#555;text-align:center">Kein Preview: ${component}.ui.ts nicht gefunden.</div></body></html>`;
    }
}
