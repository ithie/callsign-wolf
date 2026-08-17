import * as vscode from 'vscode';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface CampaignDoc extends vscode.CustomDocument {
    content: string;
    normalizedContent: string;
    panel?: vscode.WebviewPanel;
    missionIndex: number;
}

const normalizeJson = (s: string): string => {
    try { return JSON.stringify(JSON.parse(s)); } catch { return s; }
};

export class CampaignEditorProvider implements vscode.CustomEditorProvider<CampaignDoc> {
    private _lastActiveDoc: CampaignDoc | undefined;

    /** Called by extension.ts to open preview for the currently active campaign */
    openPreviewForActive(): void {
        if (this._lastActiveDoc) openPreview(this._lastActiveDoc, this._lastActiveDoc.missionIndex);
    }
    private readonly _onChange = new vscode.EventEmitter<
        vscode.CustomDocumentContentChangeEvent<CampaignDoc>
    >();
    readonly onDidChangeCustomDocument = this._onChange.event;

    constructor(private readonly ctx: vscode.ExtensionContext) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<CampaignDoc> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString('utf-8');
        return { uri, content, normalizedContent: normalizeJson(content), missionIndex: 0, dispose: () => {} };
    }

    resolveCustomEditor(
        document: CampaignDoc,
        panel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): void {
        document.panel = panel;
        this._lastActiveDoc = document;

        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'campaign-editor.js'),
        );
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
        };

        const htmlPath = join(this.ctx.extensionUri.fsPath, 'media', 'campaign-editor.html');
        const raw = readFileSync(htmlPath, 'utf-8');
        const csp = `<meta http-equiv="Content-Security-Policy" ` +
            `content="default-src 'none'; script-src ${panel.webview.cspSource} 'unsafe-inline'; style-src 'unsafe-inline';">`;

        panel.webview.html = raw
            .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n        ${csp}`)
            .replace('</body>', `    <script src="${scriptUri}"></script>\n    </body>`);

        const songKeys = (() => {
            try {
                const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!ws) return [];
                const musicDir = join(ws, 'src', 'game', 'music');
                return readdirSync(musicDir)
                    .filter(f => f.endsWith('.zsong'))
                    .map(f => f.replace('.zsong', ''))
                    .sort();
            } catch { return []; }
        })();

        panel.webview.onDidReceiveMessage((msg: { type: string; content?: string; value?: number; path?: string }) => {
            if (msg.type === 'ready') {
                panel.webview.postMessage({ type: 'load', content: document.content, songKeys });
            } else if (msg.type === 'change' && msg.content !== undefined) {
                document.content = msg.content;
                if (normalizeJson(msg.content) !== document.normalizedContent) {
                    this._onChange.fire({ document });
                }
            } else if (msg.type === 'missionIndex' && msg.value !== undefined) {
                document.missionIndex = msg.value;
            } else if (msg.type === 'open-zdef' && msg.path) {
                const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (ws) {
                    const fileUri = vscode.Uri.file(join(ws, msg.path));
                    vscode.commands.executeCommand('vscode.open', fileUri);
                }
            }
        });
    }

    async saveCustomDocument(
        doc: CampaignDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(doc.uri, Buffer.from(doc.content, 'utf-8'));
        doc.normalizedContent = normalizeJson(doc.content);
    }

    async saveCustomDocumentAs(
        doc: CampaignDoc,
        dest: vscode.Uri,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(dest, Buffer.from(doc.content, 'utf-8'));
        doc.normalizedContent = normalizeJson(doc.content);
    }

    async revertCustomDocument(
        doc: CampaignDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        const bytes = await vscode.workspace.fs.readFile(doc.uri);
        doc.content = Buffer.from(bytes).toString('utf-8');
    }

    backupCustomDocument(
        _doc: CampaignDoc,
        backupCtx: vscode.CustomDocumentBackupContext,
        _cancel: vscode.CancellationToken,
    ): Thenable<vscode.CustomDocumentBackup> {
        return Promise.resolve({ id: backupCtx.destination.toString(), delete: async () => {} });
    }
}

const openPreview = (doc: CampaignDoc, missionIndex: number): void => {
    const filename = doc.uri.path.split('/').pop() ?? '';
    const campaignKey = filename.replace(/\.zcampaign$/i, '');
    const port = vscode.workspace.getConfiguration('zw').get<number>('devServerPort', 5173);
    const url = `http://localhost:${port}?preview=${encodeURIComponent(campaignKey)}&mission=${missionIndex}`;
    vscode.commands.executeCommand('simpleBrowser.show', url);
};
