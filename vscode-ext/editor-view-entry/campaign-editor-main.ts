export {};
declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

import styleContent from '../editor-view/style.css';
import { initUI, loadMission, syncToData, renderPayloadList, renderObjectList, renderFoliageList, setOnStateChanged } from '../editor-view/ui';
import { state } from '../editor-view/state';
import { compressTerrain, compressFoliage, decompressFoliage, decompressTerrain } from '../../src/shared/utils';

// Inject editor CSS
const styleEl = document.createElement('style');
styleEl.textContent = styleContent as unknown as string;
document.head.appendChild(styleEl);

let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let isLoading = true;
let _isTutorial = false;

const doExport = (): string | null => {
    const origAlert = window.alert;
    window.alert = () => {};
    (document.getElementById('btn-export-campaign') as HTMLButtonElement).click();
    window.alert = origAlert;
    return (document.getElementById('output') as HTMLTextAreaElement).value || null;
};

const doImport = (content: string): void => {
    (document.getElementById('output') as HTMLTextAreaElement).value = content;
    (document.getElementById('btn-import-campaign') as HTMLButtonElement).click();
};

const scheduleNotify = (): void => {
    (window as any).__onEditorStateChanged?.();
    if (_isTutorial && state.curIdx === 0) {
        loadMission(1);
        return;
    }
    if (notifyTimer) clearTimeout(notifyTimer);
    if (isLoading) return;
    vscode.postMessage({ type: 'missionIndex', value: state.curIdx });
    notifyTimer = setTimeout(() => {
        const content = doExport();
        if (content) vscode.postMessage({ type: 'change', content });
    }, 400);
};

// Wire up the state-changed callback before initUI so all changes are captured
setOnStateChanged(scheduleNotify);

initUI();
loadMission(0);

window.addEventListener('message', (e: MessageEvent<{ type: string; content?: string }>) => {
    if (e.data.type === 'load' && e.data.content !== undefined) {
        let campaignType = '';
        try { campaignType = (JSON.parse(e.data.content) as { type?: string }).type ?? ''; } catch { /* ignore */ }
        _isTutorial = campaignType === 'tutorial';
        doImport(e.data.content);
        isLoading = false;
        setTimeout(() => (window as any).__onEditorStateChanged?.(), 100);
    }
});

vscode.postMessage({ type: 'ready' });

// Expose for workbench bridge compatibility
(window as any).__editor = { state, getCurrentMission: () => state.campaign[state.curIdx], loadMission, syncToData, renderPayloadList, renderObjectList, renderFoliageList };
(window as any).__editorUtils = { compressTerrain, compressFoliage, decompressFoliage, decompressTerrain };
