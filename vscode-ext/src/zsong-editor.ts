import * as vscode from 'vscode';

interface ZsongDoc extends vscode.CustomDocument {
    content: string;
}

export class ZsongEditorProvider implements vscode.CustomEditorProvider<ZsongDoc> {
    private readonly _onChange = new vscode.EventEmitter<
        vscode.CustomDocumentContentChangeEvent<ZsongDoc>
    >();
    readonly onDidChangeCustomDocument = this._onChange.event;

    constructor(private readonly ctx: vscode.ExtensionContext) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<ZsongDoc> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return { uri, content: Buffer.from(bytes).toString('utf-8'), dispose: () => {} };
    }

    resolveCustomEditor(
        document: ZsongDoc,
        panel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): void {
        const trackerUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'tracker.js'),
        );
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
        };
        panel.webview.html = trackerHtml(panel.webview.cspSource, trackerUri);

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
        doc: ZsongDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(doc.uri, Buffer.from(doc.content, 'utf-8'));
    }

    async saveCustomDocumentAs(
        doc: ZsongDoc,
        dest: vscode.Uri,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(dest, Buffer.from(doc.content, 'utf-8'));
    }

    async revertCustomDocument(
        doc: ZsongDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        const bytes = await vscode.workspace.fs.readFile(doc.uri);
        doc.content = Buffer.from(bytes).toString('utf-8');
    }

    backupCustomDocument(
        _doc: ZsongDoc,
        backupCtx: vscode.CustomDocumentBackupContext,
        _cancel: vscode.CancellationToken,
    ): Thenable<vscode.CustomDocumentBackup> {
        return Promise.resolve({ id: backupCtx.destination.toString(), delete: async () => {} });
    }
}

const trackerHtml = (cspSource: string, trackerUri: vscode.Uri): string => `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src 'unsafe-inline';">
<title>ZSong Editor</title>
<style>
* { box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}
#toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--vscode-sideBar-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-widget-border, #333);
    position: sticky;
    top: 0;
    z-index: 10;
}
#toolbar label { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
#bpm {
    width: 56px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 2px 5px;
    border-radius: 2px;
    font-size: 12px;
}
button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 3px 10px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
}
button:hover { background: var(--vscode-button-hoverBackground); }
#step-display {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    min-width: 50px;
}
#sequencer-root { padding: 8px 0; }
.track-container {
    display: flex;
    align-items: flex-start;
    border-bottom: 1px solid var(--vscode-widget-border, #222);
    padding: 4px 0;
}
.track-controls {
    width: 160px;
    min-width: 160px;
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.track-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
}
.track-header strong { font-size: 11px; color: var(--vscode-foreground); }
.vol-slider { width: 60px; accent-color: #4a90d9; }
.track-controls select, .track-controls input[type="number"] {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 1px 3px;
    border-radius: 2px;
    width: 100%;
}
.synth-params {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
.synth-params select { width: 50px; }
.knob-row { display: flex; gap: 3px; margin-top: 2px; }
.grid {
    display: flex;
    align-items: center;
    flex: 1;
    overflow-x: auto;
    padding: 4px 4px;
    gap: 2px;
}
.cell {
    width: 14px;
    height: 14px;
    min-width: 14px;
    background: var(--vscode-input-background, #3a3a3a);
    border: 1px solid var(--vscode-widget-border, #444);
    border-radius: 2px;
    cursor: pointer;
}
.cell:hover { border-color: #4a90d9; }
.cell.active-drum { background: #4a90d9; border-color: #6aafee; }
.cell.playing { outline: 2px solid #e8c35a; }
.step-note {
    width: 44px;
    min-width: 44px;
    height: 22px;
    font-size: 10px;
    background: var(--vscode-input-background, #3a3a3a);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-widget-border, #444);
    border-radius: 2px;
    padding: 0 2px;
    cursor: pointer;
}
.step-note.has-note { background: #2a4a2a; border-color: #4a8a4a; color: #8fcc8f; }
.step-note.playing { outline: 2px solid #e8c35a; }
</style>
</head>
<body>
<div id="toolbar">
    <label>BPM</label>
    <input id="bpm" type="number" min="40" max="300" value="120">
    <button id="btn-play">▶ Play</button>
    <button id="btn-stop">■ Stop</button>
    <span id="step-display"></span>
</div>
<div id="sequencer-root"></div>
<script src="${trackerUri}"></script>
</body>
</html>`;
