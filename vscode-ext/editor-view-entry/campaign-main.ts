export {};
declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = acquireVsCodeApi();

type CampaignData = Record<string, unknown>;

let campaign: CampaignData | null = null;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

const getPath = (obj: CampaignData, path: string): unknown =>
    path.split('.').reduce<unknown>((o, k) =>
        o == null ? undefined : (o as Record<string, unknown>)[isNaN(Number(k)) ? k : +k], obj);

const setPath = (obj: CampaignData, path: string, val: unknown): void => {
    const keys = path.split('.');
    let cur: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = isNaN(Number(keys[i])) ? keys[i] : +keys[i];
        cur = cur[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    cur[isNaN(Number(last)) ? last : +last] = val;
};

const scheduleNotify = (): void => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
        vscode.postMessage({ type: 'change', content: JSON.stringify(campaign, null, 2) });
    }, 300);
};

const onInput = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    const path = target.dataset['path'];
    if (!path || !campaign) return;
    const val = target.type === 'number' ? Number(target.value) : target.value;
    setPath(campaign, path, val);
    if (path.startsWith('levels.') && path.endsWith('.headline.de')) {
        const idx = +path.split('.')[1];
        const titles = document.querySelectorAll('.mission-name');
        if (titles[idx]) titles[idx].textContent = (val as string) || '—';
    }
    scheduleNotify();
};

const buildHtml = (): string => {
    if (!campaign) return '';
    const sub = (campaign['campaignSublines'] as unknown[] | undefined) ?? [];
    const levels = (campaign['levels'] as unknown[] | undefined) ?? [];

    const sublineRows = sub.map((_: unknown, i: number) =>
        '<div class="row">' +
            '<div class="field-group"><label>Subline ' + (i + 1) + ' (DE)</label><input data-path="campaignSublines.' + i + '.de"></div>' +
            '<div class="field-group"><label>Subline ' + (i + 1) + ' (EN)</label><input data-path="campaignSublines.' + i + '.en"></div>' +
        '</div>'
    ).join('');

    const missionItems = levels.map((lvl: unknown, i: number) => {
        const l = lvl as Record<string, unknown>;
        const subs = (l['sublines'] as unknown[] | undefined) ?? [];
        const headline = l['headline'] as Record<string, unknown> | undefined;
        const subRows = subs.map((_: unknown, j: number) =>
            '<div class="row">' +
                '<div class="field-group"><label>Subline ' + (j + 1) + ' (DE)</label><input data-path="levels.' + i + '.sublines.' + j + '.de"></div>' +
                '<div class="field-group"><label>Subline ' + (j + 1) + ' (EN)</label><input data-path="levels.' + i + '.sublines.' + j + '.en"></div>' +
            '</div>'
        ).join('');
        return '<div class="mission">' +
            '<div class="mission-toggle">' +
                '<span class="mission-num">' + (i + 1) + '</span>' +
                '<span class="mission-name">' + (headline && headline['de'] ? headline['de'] : '—') + '</span>' +
                '<span class="chevron">&#9658;</span>' +
            '</div>' +
            '<div class="mission-body" hidden>' +
                '<div class="row">' +
                    '<div class="field-group"><label>&#220;berschrift (DE)</label><input data-path="levels.' + i + '.headline.de"></div>' +
                    '<div class="field-group"><label>&#220;berschrift (EN)</label><input data-path="levels.' + i + '.headline.en"></div>' +
                '</div>' +
                subRows +
                '<div class="row">' +
                    '<div class="field-group"><label>Briefing (DE)</label><textarea data-path="levels.' + i + '.briefing.de" rows="3"></textarea></div>' +
                    '<div class="field-group"><label>Briefing (EN)</label><textarea data-path="levels.' + i + '.briefing.en" rows="3"></textarea></div>' +
                '</div>' +
                '<div class="field-group" style="max-width:110px"><label>Grid-Gr&#246;&#223;e</label><input type="number" data-path="levels.' + i + '.gridSize"></div>' +
            '</div>' +
        '</div>';
    }).join('');

    return '<span class="badge">' + (campaign['type'] as string) + '</span>' +
        '<h2>Kampagne</h2>' +
        '<div class="row">' +
            '<div class="field-group"><label>Titel (DE)</label><input data-path="campaignTitle.de"></div>' +
            '<div class="field-group"><label>Titel (EN)</label><input data-path="campaignTitle.en"></div>' +
        '</div>' +
        sublineRows +
        '<h2>Missionen</h2>' +
        missionItems;
};

const render = (): void => {
    const root = document.getElementById('root');
    if (!root) return;
    root.innerHTML = buildHtml();

    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-path]').forEach(el => {
        if (!campaign) return;
        const path = el.dataset['path'];
        if (path) el.value = String(getPath(campaign, path) ?? '');
        el.addEventListener('input', onInput);
    });

    root.querySelectorAll('.mission-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const body = toggle.nextElementSibling as HTMLElement | null;
            const chevron = toggle.querySelector('.chevron');
            if (!body) return;
            body.hidden = !body.hidden;
            if (chevron) chevron.textContent = body.hidden ? '▶' : '▼';
        });
    });
};

window.addEventListener('message', (e: MessageEvent<{ type: string; content?: string }>) => {
    if (e.data.type === 'load' && e.data.content !== undefined) {
        campaign = JSON.parse(e.data.content) as CampaignData;
        render();
    }
});

vscode.postMessage({ type: 'ready' });
