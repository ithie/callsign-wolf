import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const KNOWN_COMPONENTS = new Set([
    'main-menu', 'briefing', 'campaign-select', 'mission-select', 'heli-select',
    'settings', 'legal-screen', 'cookie-banner', 'loading-screen', 'pause-overlay',
    'rankup', 'whats-new', 'credits-screen', 'touch-controls', 'mp-lobby',
]);

const componentFromPath = (resourcePath: string): string => {
    const normalized = resourcePath.replace(/\\/g, '/');
    const match = normalized.match(/\/game\/ui\/([^/]+)\//);
    return match ? match[1] : 'unknown';
};

export class UiPreviewProvider {
    private readonly _ctx: vscode.ExtensionContext;
    private readonly _mediaDir: string;
    private _panels = new Map<string, vscode.WebviewPanel>();

    constructor(ctx: vscode.ExtensionContext, workspaceMediaDir?: string) {
        this._ctx = ctx;
        // Prefer live workspace media dir (has auto-rebuilt bundle) over installed copy.
        this._mediaDir = workspaceMediaDir ?? path.join(ctx.extensionPath, 'media');
        this._watchBundle();
    }

    openForActive(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Kein aktiver Editor.');
            return;
        }
        this.openForUri(editor.document.uri);
    }

    openForUri(uri: vscode.Uri): void {
        const component = componentFromPath(uri.fsPath);
        const existing = this._panels.get(component);
        if (existing) {
            existing.reveal();
            existing.webview.html = this._buildHtml(existing.webview, component);
            return;
        }
        this._openPanel(component);
    }

    private _openPanel(component: string): void {
        const panel = vscode.window.createWebviewPanel(
            `zeewolf.uiPreview.${component}`,
            `Preview: ${component}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(this._mediaDir)],
                retainContextWhenHidden: true,
            },
        );

        this._panels.set(component, panel);
        panel.onDidDispose(() => this._panels.delete(component), null, this._ctx.subscriptions);
        panel.webview.html = this._buildHtml(panel.webview, component);
    }

    private _watchBundle(): void {
        const bundlePath = path.join(this._mediaDir, 'ui-preview.js');
        let debounce: ReturnType<typeof setTimeout> | null = null;
        const watcher = fs.watch(bundlePath, () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                for (const [component, panel] of this._panels) {
                    panel.webview.html = this._buildHtml(panel.webview, component);
                }
            }, 200);
        });
        this._ctx.subscriptions.push({ dispose: () => watcher.close() });
    }

    private _buildHtml(webview: vscode.Webview, component: string): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this._mediaDir, 'ui-preview.js'))
        );
        const csp = `default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: ${webview.cspSource}; font-src data:;`;

        const template = fs.readFileSync(path.join(this._mediaDir, 'ui-preview.html'), 'utf-8');
        return template
            .replace('{{CSP}}', csp)
            .replace('{{COMPONENT}}', component)
            .replace('{{SCRIPT_URI}}', scriptUri.toString());
    }
}
