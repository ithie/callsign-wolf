import * as vscode from 'vscode';

interface ZsoundDoc extends vscode.CustomDocument {
    content: string;
}

export class ZsoundEditorProvider implements vscode.CustomEditorProvider<ZsoundDoc> {
    private readonly _onChange = new vscode.EventEmitter<
        vscode.CustomDocumentContentChangeEvent<ZsoundDoc>
    >();
    readonly onDidChangeCustomDocument = this._onChange.event;

    constructor(private readonly ctx: vscode.ExtensionContext) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken,
    ): Promise<ZsoundDoc> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return { uri, content: Buffer.from(bytes).toString('utf-8'), dispose: () => {} };
    }

    resolveCustomEditor(
        document: ZsoundDoc,
        panel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): void {
        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'zsound.js'),
        );
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'media')],
        };
        panel.webview.html = soundLabHtml(panel.webview.cspSource, scriptUri);

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
        doc: ZsoundDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(doc.uri, Buffer.from(doc.content, 'utf-8'));
    }

    async saveCustomDocumentAs(
        doc: ZsoundDoc,
        dest: vscode.Uri,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(dest, Buffer.from(doc.content, 'utf-8'));
    }

    async revertCustomDocument(
        doc: ZsoundDoc,
        _cancel: vscode.CancellationToken,
    ): Promise<void> {
        const bytes = await vscode.workspace.fs.readFile(doc.uri);
        doc.content = Buffer.from(bytes).toString('utf-8');
    }

    backupCustomDocument(
        _doc: ZsoundDoc,
        backupCtx: vscode.CustomDocumentBackupContext,
        _cancel: vscode.CancellationToken,
    ): Thenable<vscode.CustomDocumentBackup> {
        return Promise.resolve({ id: backupCtx.destination.toString(), delete: async () => {} });
    }
}

const soundLabHtml = (cspSource: string, scriptUri: vscode.Uri): string => `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src 'unsafe-inline';">
<title>Sound Lab</title>
<style>
* { box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0; padding: 0;
}
#toolbar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px;
    background: var(--vscode-sideBar-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-widget-border, #333);
    position: sticky; top: 0; z-index: 10;
}
#toolbar label { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 2px 5px; border-radius: 2px; font-size: 12px;
}
button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; padding: 3px 10px; border-radius: 2px; cursor: pointer; font-size: 12px;
}
button:hover { background: var(--vscode-button-hoverBackground); }
#params { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.param-group { display: none; flex-direction: column; gap: 6px; }
.param-group.visible { display: flex; }
.param-row { display: flex; align-items: center; gap: 8px; }
.param-row label {
    width: 140px; min-width: 140px;
    color: var(--vscode-descriptionForeground); font-size: 11px;
}
.param-row input[type="range"] { flex: 1; accent-color: #4a90d9; }
.param-row .val {
    width: 52px; text-align: right;
    color: var(--vscode-foreground); font-size: 11px; font-variant-numeric: tabular-nums;
}
.param-row select { width: 130px; }
#vis-wrap { padding: 8px 12px; display: flex; gap: 8px; flex-wrap: wrap; }
canvas { background: #111; border: 1px solid var(--vscode-widget-border, #333); border-radius: 2px; display: block; }
</style>
</head>
<body>
<div id="toolbar">
    <button id="btn-play">&#9654; Play</button>
    <button id="btn-stop">&#9632; Stop</button>
    <span id="status" style="font-size:11px;color:var(--vscode-descriptionForeground);margin-left:4px"></span>
</div>
<div id="params">
    <div class="param-group" id="pg-heli">
        <div class="param-row">
            <label>Blades</label>
            <select id="heli-blades">
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
            </select>
        </div>
        <div class="param-row">
            <label>Clip Amount</label>
            <input type="range" id="heli-clip" min="0.5" max="8" step="0.1" value="3">
            <span class="val" id="heli-clip-v">3.0</span>
        </div>
        <div class="param-row">
            <label>Filter Cut (Hz)</label>
            <input type="range" id="heli-filterCut" min="30" max="500" step="1" value="120">
            <span class="val" id="heli-filterCut-v">120</span>
        </div>
        <div class="param-row">
            <label>Filter Q</label>
            <input type="range" id="heli-filterQ" min="0.5" max="12" step="0.1" value="2.5">
            <span class="val" id="heli-filterQ-v">2.5</span>
        </div>
    </div>
    <div class="param-group" id="pg-ornithopter">
        <div class="param-row">
            <label>Flap Filter Freq (Hz)</label>
            <input type="range" id="orn-flapFiltFreq" min="200" max="2000" step="10" value="700">
            <span class="val" id="orn-flapFiltFreq-v">700</span>
        </div>
        <div class="param-row">
            <label>Flap Filter Q</label>
            <input type="range" id="orn-flapFiltQ" min="0.5" max="8" step="0.1" value="1.8">
            <span class="val" id="orn-flapFiltQ-v">1.8</span>
        </div>
        <div class="param-row">
            <label>LFO Freq (Hz)</label>
            <input type="range" id="orn-lfoFreq" min="0.5" max="6" step="0.05" value="1.1">
            <span class="val" id="orn-lfoFreq-v">1.10</span>
        </div>
        <div class="param-row">
            <label>LFO Gain</label>
            <input type="range" id="orn-lfoGain" min="0.05" max="0.9" step="0.01" value="0.45">
            <span class="val" id="orn-lfoGain-v">0.45</span>
        </div>
    </div>
    <div class="param-group" id="pg-wind">
        <div class="param-row">
            <label>Filter Cut (Hz)</label>
            <input type="range" id="wind-filterCut" min="50" max="1200" step="10" value="200">
            <span class="val" id="wind-filterCut-v">200</span>
        </div>
        <div class="param-row">
            <label>Filter Q</label>
            <input type="range" id="wind-filterQ" min="0.1" max="3" step="0.05" value="0.5">
            <span class="val" id="wind-filterQ-v">0.50</span>
        </div>
    </div>
    <div class="param-group" id="pg-birds">
        <div class="param-row">
            <label>Base Pitch (Hz)</label>
            <input type="range" id="birds-pitch" min="400" max="4000" step="50" value="1400">
            <span class="val" id="birds-pitch-v">1400</span>
        </div>
        <div class="param-row">
            <label>Call Rate (/s)</label>
            <input type="range" id="birds-rate" min="0.05" max="3" step="0.05" value="0.5">
            <span class="val" id="birds-rate-v">0.50</span>
        </div>
        <div class="param-row">
            <label>Bird Type</label>
            <select id="birds-birdType">
                <option value="songbird">Songbird</option>
                <option value="seagull">Seagull</option>
                <option value="crow">Crow</option>
            </select>
        </div>
    </div>
</div>
<div id="vis-wrap">
    <canvas id="cv-wave" width="400" height="80" title="Waveform"></canvas>
    <canvas id="cv-spec" width="400" height="80" title="Spectrum"></canvas>
</div>
<script src="${scriptUri}"></script>
</body>
</html>`;
