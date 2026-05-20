import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { CampaignEditorProvider } from './campaign-editor';
import { ZsongEditorProvider } from './zsong-editor';
import { ZdefEditorProvider } from './zdef-editor';
import { ZsoundEditorProvider } from './zsound-editor';
import { UiPreviewProvider } from './ui-preview-provider';

let devServer: ChildProcess | null = null;
let uiWatcher: ChildProcess | null = null;

const startDevServer = (ctx: vscode.ExtensionContext): void => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;

    const out = vscode.window.createOutputChannel('Zeewolf Dev Server');
    ctx.subscriptions.push(out);

    devServer = spawn('npm', ['run', 'dev'], {
        cwd: root,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    devServer.stdout?.on('data', (d: Buffer) => out.append(d.toString()));
    devServer.stderr?.on('data', (d: Buffer) => out.append(d.toString()));

    devServer.on('exit', (code, signal) => {
        if (signal !== 'SIGTERM' && code !== null && code !== 0) {
            out.appendLine(`\n[Dev server exited with code ${code} — possibly already running on port 5173]`);
        }
        devServer = null;
    });

    ctx.subscriptions.push({ dispose: () => { devServer?.kill(); devServer = null; } });
};

// Runs esbuild --watch in vscode-ext/ so ui-preview.js rebuilds automatically.
// Only starts when the workspace actually contains vscode-ext/esbuild.mjs.
const startUiWatcher = (ctx: vscode.ExtensionContext): string | null => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return null;

    const extSrc = path.join(root, 'vscode-ext');
    if (!fs.existsSync(path.join(extSrc, 'esbuild.mjs'))) return null;

    uiWatcher = spawn('node', ['esbuild.mjs', '--watch'], {
        cwd: extSrc,
        shell: false,
        stdio: 'ignore',
    });

    uiWatcher.on('exit', () => { uiWatcher = null; });
    ctx.subscriptions.push({ dispose: () => { uiWatcher?.kill(); uiWatcher = null; } });

    return path.join(extSrc, 'media');
};

export const activate = (ctx: vscode.ExtensionContext): void => {
    startDevServer(ctx);

    startUiWatcher(ctx);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const campaignProvider = new CampaignEditorProvider(ctx);
    const uiPreviewProvider = new UiPreviewProvider(ctx, workspaceRoot);

    ctx.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'zeewolf.campaignEditor',
            campaignProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
        vscode.commands.registerCommand('zeewolf.openCampaignPreview', () => {
            campaignProvider.openPreviewForActive();
        }),
        vscode.commands.registerCommand('zeewolf.openUIPreview', () => {
            uiPreviewProvider.openForActive();
        }),
        vscode.window.registerCustomEditorProvider(
            'zeewolf.zsongEditor',
            new ZsongEditorProvider(ctx),
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
        vscode.window.registerCustomEditorProvider(
            'zeewolf.zdefEditor',
            new ZdefEditorProvider(ctx),
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
        vscode.window.registerCustomEditorProvider(
            'zeewolf.zsoundEditor',
            new ZsoundEditorProvider(ctx),
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );
};

export const deactivate = (): void => {
    devServer?.kill();
    uiWatcher?.kill();
};
