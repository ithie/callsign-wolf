import { state, getCurrentMission } from './state';
import type { EventTrigger, EventAction, MissionEvent } from '../../src/shared/types';

let _notify: (() => void) | null = null;
let _formOpen = false;
let _formObjectIdx: number | null = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export const initEventsEditor = (notify: () => void): void => {
    _notify = notify;
    const panel = document.getElementById('ui_events');
    if (!panel) return;
    panel.addEventListener('click', _handleClick);
    panel.addEventListener('change', (e: Event) => {
        const t = e.target as HTMLElement;
        if (t.id === 'ev_trig_type') _renderTriggerFields();
        if (t.classList.contains('ev-act-type')) _updateActionRow(t.closest('.ev-action-row') as HTMLElement);
    });
};

// ── Click dispatch ────────────────────────────────────────────────────────────

const _handleClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest('[data-ev]') as HTMLElement | null;
    if (!btn) return;
    e.stopPropagation();
    const m = getCurrentMission();
    if (!m) return;
    const action = btn.dataset['ev']!;

    if (action === 'add') {
        _formOpen = true;
        _formObjectIdx = state.selectedObjectIdx;
        _renderForm();
    } else if (action === 'delete') {
        const idx = parseInt(btn.dataset['evIdx'] ?? '-1');
        if (idx < 0) return;
        const events: MissionEvent[] = (m as any).events ?? [];
        events.splice(idx, 1);
        (m as any).events = events;
        _notify?.();
        renderEventsPanel(state.selectedObjectIdx);
    } else if (action === 'save') {
        _saveForm();
    } else if (action === 'cancel') {
        _formOpen = false;
        _formObjectIdx = null;
        renderEventsPanel(state.selectedObjectIdx);
    } else if (action === 'add-action') {
        _appendActionRow(state.selectedObjectIdx ?? 0);
    } else if (action === 'remove-action') {
        (btn.closest('.ev-action-row') as HTMLElement | null)?.remove();
    }
};

// ── Render: event list ────────────────────────────────────────────────────────

const _touchesObj = (ev: MissionEvent, idx: number): boolean => {
    const t = ev.trigger as any;
    if (t.objectIdx === idx || t.nearObjectIdx === idx) return true;
    return ev.actions.some((a: any) => a.objectIdx === idx);
};

const _trigLabel = (t: EventTrigger): string => {
    switch (t.type) {
        case 'time':            return `⏱ ${t.seconds}s`;
        case 'rescued':         return `🚁 rescued×${t.count}`;
        case 'objectReaches':   return `[${t.objectIdx}]→[${t.nearObjectIdx}] ≤${t.distance}`;
        case 'objectDestroyed': return `[${t.objectIdx}] zerstört`;
        case 'heliNear':        return `heli near [${t.objectIdx}] ≤${t.distance}`;
    }
};

const _actLabel = (a: EventAction): string => {
    switch (a.type) {
        case 'setOnFire':            return `fire[${a.objectIdx}]`;
        case 'setOnSmoke':           return `smoke[${a.objectIdx}]`;
        case 'destroy':              return `destroy[${a.objectIdx}]`;
        case 'startMoving':          return `move>[${a.objectIdx}]`;
        case 'stopMoving':           return `stop[${a.objectIdx}]`;
        case 'killAttachedPayloads': return `kill[${a.objectIdx}]`;
        case 'failMission':          return a.objectIdx !== undefined ? `fail[${a.objectIdx}]` : 'fail';
        case 'showMessage':          return 'msg';
        case 'setWindStr':           return `wind=${a.value}`;
    }
};

export const renderEventsPanel = (objectIdx: number | null): void => {
    const el = document.getElementById('ui_events');
    if (!el) return;
    if (_formOpen && _formObjectIdx === objectIdx) return; // user is editing
    if (_formOpen) { _formOpen = false; _formObjectIdx = null; }

    const m = getCurrentMission();
    const allEvents: MissionEvent[] = (m as any)?.events ?? [];
    const relevant = allEvents
        .map((ev, i) => ({ ev, i }))
        .filter(({ ev }) => objectIdx === null || _touchesObj(ev, objectIdx));

    let html = `<strong style="color:#fa0">EVENTS</strong>`;

    if (relevant.length === 0) {
        html += `<div style="color:#555;font-size:11px;margin:4px 0">—</div>`;
    } else {
        for (const { ev, i } of relevant) {
            const acts = ev.actions.map(_actLabel).join(' ');
            html += `<div style="margin:3px 0;background:#111;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:flex-start;gap:4px">`
                + `<span style="font-size:10px;flex:1;min-width:0">`
                + `<span style="color:#4af">${_trigLabel(ev.trigger)}</span>`
                + ` <span style="color:#fa8">${acts}</span></span>`
                + `<button data-ev="delete" data-ev-idx="${i}" style="background:#600;border:none;color:#f88;cursor:pointer;padding:0 4px;font-size:10px;flex-shrink:0">✕</button>`
                + `</div>`;
        }
    }

    html += `<button data-ev="add" style="width:100%;margin-top:6px;background:var(--accent);border:none;color:#000;cursor:pointer;padding:3px;font-size:11px">＋ Event</button>`;
    el.innerHTML = html;
};

// ── Render: add form ──────────────────────────────────────────────────────────

const _trigOptions = [
    ['objectReaches',   'objectReaches'],
    ['objectDestroyed', 'objectDestroyed'],
    ['heliNear',        'heliNear'],
    ['time',            'time'],
    ['rescued',         'rescued'],
].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

const _actOptions = [
    ['destroy',              'destroy'],
    ['setOnFire',            'setOnFire'],
    ['setOnSmoke',           'setOnSmoke'],
    ['startMoving',          'startMoving'],
    ['stopMoving',           'stopMoving'],
    ['killAttachedPayloads', 'killAttached'],
    ['failMission',          'failMission'],
    ['showMessage',          'showMessage'],
    ['setWindStr',           'setWindStr'],
].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

const _triggerFieldsHTML = (trigType: string, defOidx: number): string => {
    const ni = (id: string, val: number, w = 40) =>
        `<input type="number" id="${id}" value="${val}" style="width:${w}px;font-size:10px">`;
    switch (trigType) {
        case 'time':            return `Sek: ${ni('ev_t_seconds', 5)}`;
        case 'rescued':         return `Anz: ${ni('ev_t_count', 1)}`;
        case 'objectReaches':   return `Obj: ${ni('ev_t_oidx', defOidx)} Near: ${ni('ev_t_nidx', defOidx)} Dist: ${ni('ev_t_dist', 8)}`;
        case 'objectDestroyed': return `Obj: ${ni('ev_t_oidx', defOidx)}`;
        case 'heliNear':        return `Obj: ${ni('ev_t_oidx', defOidx)} Dist: ${ni('ev_t_dist', 10)}`;
        default: return '';
    }
};

const _actionRowHTML = (defOidx: number): string =>
    `<div class="ev-action-row" style="display:flex;align-items:center;gap:2px;margin:2px 0">`
    + `<select class="ev-act-type" style="font-size:10px;flex:1">${_actOptions}</select>`
    + `<input class="ev-act-oidx" type="number" value="${defOidx}" style="width:30px;font-size:10px">`
    + `<input class="ev-act-val" type="number" value="1" step="0.1" style="width:30px;font-size:10px;display:none">`
    + `<span class="ev-act-msg" style="display:none;flex-direction:column;gap:2px">`
    + `<input class="ev-act-text-de" type="text" placeholder="DE (Pflicht)" style="width:110px;font-size:10px">`
    + `<input class="ev-act-text-en" type="text" placeholder="EN" style="width:110px;font-size:10px">`
    + `<input class="ev-act-text-fr" type="text" placeholder="FR" style="width:110px;font-size:10px">`
    + `<input class="ev-act-text-es" type="text" placeholder="ES" style="width:110px;font-size:10px">`
    + `<input class="ev-act-text-pt" type="text" placeholder="PT" style="width:110px;font-size:10px">`
    + `</span>`
    + `<button data-ev="remove-action" style="background:#400;border:none;color:#f88;cursor:pointer;padding:0 3px;font-size:10px;flex-shrink:0">✕</button>`
    + `</div>`;

const _renderForm = (): void => {
    const el = document.getElementById('ui_events');
    if (!el) return;
    const defOidx = state.selectedObjectIdx ?? 0;
    const firstTrig = 'objectReaches';
    el.innerHTML =
        `<strong style="color:#fa0">ADD EVENT</strong>`
        + `<div style="margin:5px 0;font-size:11px">`
        + `TRIGGER: <select id="ev_trig_type" style="width:130px;font-size:10px">${_trigOptions}</select>`
        + `<div id="ev_trig_fields" style="margin:3px 0">${_triggerFieldsHTML(firstTrig, defOidx)}</div>`
        + `</div>`
        + `<div style="font-size:10px;color:#aaa;margin:2px 0">ACTIONS:</div>`
        + `<div id="ev_action_list">${_actionRowHTML(defOidx)}</div>`
        + `<button data-ev="add-action" style="background:#333;border:none;color:#ccc;cursor:pointer;padding:2px 6px;font-size:10px;margin-top:2px">＋ Action</button>`
        + `<div style="margin-top:6px;display:flex;gap:4px">`
        + `<button data-ev="save" style="flex:1;background:var(--accent);border:none;color:#000;cursor:pointer;padding:3px;font-size:11px">Speichern</button>`
        + `<button data-ev="cancel" style="flex:1;background:#333;border:none;color:#ccc;cursor:pointer;padding:3px;font-size:11px">Abbrechen</button>`
        + `</div>`;
};

const _renderTriggerFields = (): void => {
    const sel = document.getElementById('ev_trig_type') as HTMLSelectElement | null;
    const div = document.getElementById('ev_trig_fields');
    if (!sel || !div) return;
    div.innerHTML = _triggerFieldsHTML(sel.value, state.selectedObjectIdx ?? 0);
};

const _updateActionRow = (row: HTMLElement | null): void => {
    if (!row) return;
    const type = (row.querySelector('.ev-act-type') as HTMLSelectElement)?.value;
    const objTypes = ['destroy','setOnFire','setOnSmoke','startMoving','stopMoving','killAttachedPayloads','failMission'];
    const oidx = row.querySelector('.ev-act-oidx') as HTMLElement | null;
    const val  = row.querySelector('.ev-act-val')  as HTMLElement | null;
    const msg  = row.querySelector('.ev-act-msg')  as HTMLElement | null;
    if (oidx) oidx.style.display = objTypes.includes(type) ? '' : 'none';
    if (val)  val.style.display  = type === 'setWindStr'   ? '' : 'none';
    if (msg)  msg.style.display  = type === 'showMessage'  ? 'flex' : 'none';
};

const _appendActionRow = (defOidx: number): void => {
    const list = document.getElementById('ev_action_list');
    if (!list) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = _actionRowHTML(defOidx);
    while (tmp.firstChild) list.appendChild(tmp.firstChild);
};

// ── Save form → mission ───────────────────────────────────────────────────────

const _saveForm = (): void => {
    const m = getCurrentMission();
    if (!m) return;

    const trigType = (document.getElementById('ev_trig_type') as HTMLSelectElement)?.value ?? '';
    const int = (id: string) => parseInt((document.getElementById(id) as HTMLInputElement)?.value ?? '0') || 0;
    const num = (id: string) => parseFloat((document.getElementById(id) as HTMLInputElement)?.value ?? '0') || 0;

    let trigger: EventTrigger;
    switch (trigType) {
        case 'time':            trigger = { type: 'time', seconds: num('ev_t_seconds') }; break;
        case 'rescued':         trigger = { type: 'rescued', count: int('ev_t_count') }; break;
        case 'objectReaches':   trigger = { type: 'objectReaches', objectIdx: int('ev_t_oidx'), nearObjectIdx: int('ev_t_nidx'), distance: num('ev_t_dist') }; break;
        case 'objectDestroyed': trigger = { type: 'objectDestroyed', objectIdx: int('ev_t_oidx') }; break;
        case 'heliNear':        trigger = { type: 'heliNear', objectIdx: int('ev_t_oidx'), distance: num('ev_t_dist') }; break;
        default: return;
    }

    const actions: EventAction[] = [];
    document.querySelectorAll<HTMLElement>('#ev_action_list .ev-action-row').forEach(row => {
        const type = (row.querySelector('.ev-act-type') as HTMLSelectElement)?.value ?? '';
        const oidx = parseInt((row.querySelector('.ev-act-oidx') as HTMLInputElement)?.value ?? '0') || 0;
        const val  = parseFloat((row.querySelector('.ev-act-val') as HTMLInputElement)?.value ?? '0') || 0;
        const de   = (row.querySelector('.ev-act-text-de') as HTMLInputElement)?.value.trim() ?? '';
        const en   = (row.querySelector('.ev-act-text-en') as HTMLInputElement)?.value.trim() ?? '';
        const fr   = (row.querySelector('.ev-act-text-fr') as HTMLInputElement)?.value.trim() ?? '';
        const es   = (row.querySelector('.ev-act-text-es') as HTMLInputElement)?.value.trim() ?? '';
        const pt   = (row.querySelector('.ev-act-text-pt') as HTMLInputElement)?.value.trim() ?? '';
        switch (type) {
            case 'setOnFire': case 'setOnSmoke': case 'destroy':
            case 'startMoving': case 'stopMoving': case 'killAttachedPayloads':
                actions.push({ type: type as 'destroy', objectIdx: oidx }); break;
            case 'failMission':  actions.push(oidx >= 0 ? { type: 'failMission', objectIdx: oidx } : { type: 'failMission' }); break;
            case 'setWindStr':   actions.push({ type: 'setWindStr', value: val }); break;
            case 'showMessage': {
                if (!en && !fr && !es && !pt) { actions.push({ type: 'showMessage', text: de }); break; }
                const text: { de: string; en?: string; fr?: string; es?: string; pt?: string } = { de };
                if (en) text.en = en; if (fr) text.fr = fr; if (es) text.es = es; if (pt) text.pt = pt;
                actions.push({ type: 'showMessage', text });
                break;
            }
        }
    });

    if (actions.length === 0) return;
    const events: MissionEvent[] = (m as any).events ?? [];
    events.push({ trigger, actions });
    (m as any).events = events;
    _formOpen = false;
    _formObjectIdx = null;
    _notify?.();
    renderEventsPanel(state.selectedObjectIdx);
};
