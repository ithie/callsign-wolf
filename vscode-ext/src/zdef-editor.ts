import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ZdefDoc extends vscode.CustomDocument {
    content: string;
}

export class ZdefEditorProvider implements vscode.CustomEditorProvider<ZdefDoc> {
    private _lastActiveDoc: ZdefDoc | undefined;

    openRawForActive(): void {
        if (!this._lastActiveDoc) return;
        vscode.commands.executeCommand(
            'vscode.openWith',
            this._lastActiveDoc.uri,
            'default',
            { viewColumn: vscode.ViewColumn.Beside, preview: true },
        );
    }

    private readonly _onChange = new vscode.EventEmitter<
        vscode.CustomDocumentContentChangeEvent<ZdefDoc>
    >();
    readonly onDidChangeCustomDocument = this._onChange.event;

    constructor(private readonly ctx: vscode.ExtensionContext) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<ZdefDoc> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return { uri, content: Buffer.from(bytes).toString('utf-8'), dispose: () => {} };
    }

    resolveCustomEditor(
        document: ZdefDoc,
        panel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): void {
        this._lastActiveDoc = document;
        panel.onDidChangeViewState(e => { if (e.webviewPanel.active) this._lastActiveDoc = document; });

        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'zdef.js'),
        );
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
        };

        const htmlPath = join(this.ctx.extensionUri.fsPath, 'media', 'modeleditor.html');
        const raw = readFileSync(htmlPath, 'utf-8');

        // Strip the inline <script type="module">…</script> block and inject our bundle
        const stripped = raw.replace(/<script\s+type="module"[\s\S]*?<\/script>/, '');
        const csp = `<meta http-equiv="Content-Security-Policy" ` +
            `content="default-src 'none'; script-src ${panel.webview.cspSource}; style-src 'unsafe-inline';">`;
        panel.webview.html = stripped
            .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n        ${csp}`)
            .replace('</body>', `    <script src="${scriptUri}"></script>\n    </body>`);

        panel.webview.onDidReceiveMessage((msg: { type: string; content?: string }) => {
            if (msg.type === 'ready') {
                panel.webview.postMessage({ type: 'load', content: document.content });
            } else if (msg.type === 'change' && msg.content !== undefined) {
                document.content = msg.content;
                this._onChange.fire({ document });
            }
        });
    }

    async saveCustomDocument(
        doc: ZdefDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(doc.uri, Buffer.from(doc.content, 'utf-8'));
    }

    async saveCustomDocumentAs(
        doc: ZdefDoc,
        dest: vscode.Uri,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(dest, Buffer.from(doc.content, 'utf-8'));
    }

    async revertCustomDocument(
        doc: ZdefDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        const bytes = await vscode.workspace.fs.readFile(doc.uri);
        doc.content = Buffer.from(bytes).toString('utf-8');
    }

    backupCustomDocument(
        _doc: ZdefDoc,
        backupCtx: vscode.CustomDocumentBackupContext,
        _cancel: vscode.CancellationToken,
    ): Thenable<vscode.CustomDocumentBackup> {
        return Promise.resolve({ id: backupCtx.destination.toString(), delete: async () => {} });
    }
}
