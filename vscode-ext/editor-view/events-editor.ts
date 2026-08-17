import { state, getCurrentMission } from './state';
import type { EventTrigger, EventAction, MissionEvent } from '../../src/shared/types';

let _notify: (() => void) | null = null;
let _formOpen = false;
let _formObjectIdx: number | null = null;
let _editIdx: number | null = null;

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
        _editIdx = null;
        _formObjectIdx = state.selectedObjectIdx;
        _renderForm();
    } else if (action === 'edit') {
        const idx = parseInt(btn.dataset['evIdx'] ?? '-1');
        const events: MissionEvent[] = (m as any).events ?? [];
        if (idx < 0 || !events[idx]) return;
        _formOpen = true;
        _editIdx = idx;
        _formObjectIdx = state.selectedObjectIdx;
        _renderForm(events[idx]);
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
        _editIdx = null;
        renderEventsPanel(state.selectedObjectIdx);
    } else if (action === 'add-action') {
        _appendActionRow(state.selectedObjectIdx ?? 0);
    } else if (action === 'remove-action') {
        (btn.closest('.ev-action-row') as HTMLElement | null)?.remove();
    }
};

// ── Type tables ───────────────────────────────────────────────────────────────

const _TRIG_TYPES = [
    ['objectReaches',   'Objekt erreicht Ziel'],
    ['objectDestroyed', 'Objekt zerstört'],
    ['heliNear',        'Heli in der Nähe'],
    ['time',            'Zeitverzögerung'],
    ['rescued',         'Gerettete Personen'],
] as const;

const _ACT_TYPES = [
    ['destroy',              'Zerstören'],
    ['setOnFire',            'In Brand setzen'],
    ['setOnSmoke',           'Rauch erzeugen'],
    ['startMoving',          'Bewegung starten'],
    ['stopMoving',           'Bewegung stoppen'],
    ['killAttachedPayloads', 'Payloads töten'],
    ['failMission',          'Mission ×'],
    ['showMessage',          'Nachricht anzeigen'],
    ['setWindStr',           'Wind setzen'],
] as const;

const _trigOpts = (sel?: string) =>
    _TRIG_TYPES.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');

const _actOpts = (sel?: string) =>
    _ACT_TYPES.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');

// ── Label helpers (list display) ──────────────────────────────────────────────

const _trigLabel = (t: EventTrigger): string => {
    switch (t.type) {
        case 'time':            return `⏱ Nach ${t.seconds}s`;
        case 'rescued':         return `🏁 Gerettet: ${t.count}`;
        case 'objectReaches':   return `[${t.objectIdx}] → [${t.nearObjectIdx}] ≤${t.distance}`;
        case 'objectDestroyed': return `[${t.objectIdx}] zerstört`;
        case 'heliNear':        return `Heli ≤${t.distance} von [${t.objectIdx}]`;
    }
};

const _actLabel = (a: EventAction): string => {
    switch (a.type) {
        case 'setOnFire':            return `Feuer [${a.objectIdx}]`;
        case 'setOnSmoke':           return `Rauch [${a.objectIdx}]`;
        case 'destroy':              return `Zerstören [${a.objectIdx}]`;
        case 'startMoving':          return `Start [${a.objectIdx}]`;
        case 'stopMoving':           return `Stop [${a.objectIdx}]`;
        case 'killAttachedPayloads': return `Kill [${a.objectIdx}]`;
        case 'failMission':          return a.objectIdx !== undefined ? `Mission × [${a.objectIdx}]` : 'Mission ×';
        case 'showMessage':          return '💬 Nachricht';
        case 'setWindStr':           return `Wind ${a.value}`;
    }
};

// ── Render: event list ────────────────────────────────────────────────────────

const _touchesObj = (ev: MissionEvent, idx: number): boolean => {
    const t = ev.trigger as any;
    if (t.objectIdx === idx || t.nearObjectIdx === idx) return true;
    return ev.actions.some((a: any) => a.objectIdx === idx);
};

export const renderEventsPanel = (objectIdx: number | null): void => {
    const el = document.getElementById('ui_events');
    if (!el) return;
    if (_formOpen && _formObjectIdx === objectIdx) return;
    if (_formOpen) { _formOpen = false; _formObjectIdx = null; _editIdx = null; }

    const m = getCurrentMission();
    const allEvents: MissionEvent[] = (m as any)?.events ?? [];
    const relevant = allEvents
        .map((ev, i) => ({ ev, i }))
        .filter(({ ev }) => objectIdx === null || _touchesObj(ev, objectIdx));

    const S = 'style="';
    let html = `<div ${S}font-size:10px;font-weight:700;color:var(--accent);letter-spacing:0.06em;margin-bottom:5px">EVENTS</div>`;

    for (const { ev, i } of relevant) {
        const acts = ev.actions.map(_actLabel).join('  ·  ');
        html += `<div ${S}margin:3px 0;background:#111;border:1px solid #1e1e1e;padding:4px 6px;border-radius:3px">`
            + `<div ${S}display:flex;justify-content:space-between;align-items:flex-start;gap:3px">`
            + `<div ${S}flex:1;min-width:0">`
            + `<div ${S}font-size:10px;color:#4af;margin-bottom:2px">${_trigLabel(ev.trigger)}</div>`
            + `<div ${S}font-size:9px;color:#fa8;line-height:1.4">${acts}</div>`
            + `</div>`
            + `<div ${S}display:flex;gap:2px;flex-shrink:0;margin-left:4px">`
            + `<button data-ev="edit" data-ev-idx="${i}" ${S}background:#223;border:1px solid #335;color:#88f;cursor:pointer;padding:1px 5px;font-size:10px;border-radius:2px">✏</button>`
            + `<button data-ev="delete" data-ev-idx="${i}" ${S}background:#400;border:1px solid #622;color:#f88;cursor:pointer;padding:1px 5px;font-size:10px;border-radius:2px">✕</button>`
            + `</div></div></div>`;
    }

    if (relevant.length === 0) {
        html += `<div ${S}color:#444;font-size:10px;margin:4px 0;text-align:center">—</div>`;
    }

    html += `<button data-ev="add" ${S}width:100%;margin-top:5px;background:var(--accent);border:none;color:#000;cursor:pointer;padding:4px;font-size:11px;font-weight:700;border-radius:2px">＋ Event</button>`;
    el.innerHTML = html;
};

// ── Render: form ──────────────────────────────────────────────────────────────

const _objRef = (): string => {
    const objs = getCurrentMission()?.objects;
    if (!objs?.length) return '';
    const MAX = 14;
    const items = objs.slice(0, MAX).map((o, i) =>
        `<span style="color:#555;white-space:nowrap">[${i}]<span style="color:#444">${o.type}</span></span>`
    ).join(' ');
    const more = objs.length > MAX ? `<span style="color:#333"> +${objs.length - MAX}</span>` : '';
    return `<div style="font-size:9px;background:#080808;border:1px solid #1a1a1a;padding:3px 6px;border-radius:3px;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:3px;line-height:1.6">${items}${more}</div>`;
};

const _SI = 'font-size:10px;background:#0a0a0a;border:1px solid #2a2a2a;color:#ccc;padding:2px 4px;border-radius:2px';
const _ST = `${_SI};width:108px`;

const _numInp = (id: string, val: number | string, w = 42) =>
    `<input type="number" id="${id}" value="${val}" style="width:${w}px;${_SI}">`;

const _frow = (label: string, content: string) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">`
    + `<span style="font-size:9px;color:#666;min-width:108px;text-align:right">${label}</span>`
    + `${content}</div>`;

const _triggerFieldsHTML = (trigType: string, defOidx: number, t?: EventTrigger): string => {
    const tv = t as any;
    switch (trigType) {
        case 'time':          return _frow('Sekunden:', _numInp('ev_t_seconds', tv?.seconds ?? 5));
        case 'rescued':       return _frow('Anzahl:', _numInp('ev_t_count', tv?.count ?? 1));
        case 'objectReaches': return [
            _frow('Quell-Objekt Nr:', _numInp('ev_t_oidx', tv?.objectIdx ?? defOidx)),
            _frow('Ziel-Objekt Nr:', _numInp('ev_t_nidx', tv?.nearObjectIdx ?? defOidx)),
            _frow('Max. Distanz:', _numInp('ev_t_dist', tv?.distance ?? 8)
                + `<span style="font-size:9px;color:#555;margin-left:3px">Tiles</span>`),
        ].join('');
        case 'objectDestroyed': return _frow('Objekt Nr:', _numInp('ev_t_oidx', tv?.objectIdx ?? defOidx));
        case 'heliNear': return [
            _frow('Objekt Nr:', _numInp('ev_t_oidx', tv?.objectIdx ?? defOidx)),
            _frow('Max. Distanz:', _numInp('ev_t_dist', tv?.distance ?? 10)
                + `<span style="font-size:9px;color:#555;margin-left:3px">Tiles</span>`),
        ].join('');
        default: return '';
    }
};

const _ACT_WITH_OBJ = ['destroy','setOnFire','setOnSmoke','startMoving','stopMoving','killAttachedPayloads','failMission'];

const _actionRowHTML = (defOidx: number, existing?: EventAction): string => {
    const type  = existing?.type ?? 'destroy';
    const ev    = existing as any;
    const oidx  = ev?.objectIdx ?? defOidx;
    const val   = ev?.value ?? 1;
    const textDe = typeof ev?.text === 'string' ? ev.text : (ev?.text?.de ?? '');
    const textEn = typeof ev?.text === 'object'  ? ev.text?.en ?? '' : '';
    const textFr = typeof ev?.text === 'object'  ? ev.text?.fr ?? '' : '';
    const textEs = typeof ev?.text === 'object'  ? ev.text?.es ?? '' : '';
    const textPt = typeof ev?.text === 'object'  ? ev.text?.pt ?? '' : '';

    const showOidx = _ACT_WITH_OBJ.includes(type);
    const showVal  = type === 'setWindStr';
    const showMsg  = type === 'showMessage';

    return `<div class="ev-action-row" style="display:flex;align-items:flex-start;gap:3px;margin:2px 0;background:#0c0c0c;padding:3px 4px;border-radius:3px;border:1px solid #1a1a1a">`
        + `<select class="ev-act-type" style="flex:1;min-width:0;${_SI}">${_actOpts(type)}</select>`
        + `<input class="ev-act-oidx" type="number" value="${oidx}" style="width:36px;${_SI};${showOidx ? '' : 'display:none'}">`
        + `<input class="ev-act-val" type="number" value="${val}" step="0.1" style="width:36px;${_SI};${showVal ? '' : 'display:none'}">`
        + `<span class="ev-act-msg" style="${showMsg ? 'display:flex' : 'display:none'};flex-direction:column;gap:2px">`
        + `<input class="ev-act-text-de" type="text" placeholder="DE" value="${textDe}" style="${_ST}">`
        + `<input class="ev-act-text-en" type="text" placeholder="EN" value="${textEn}" style="${_ST}">`
        + `<input class="ev-act-text-fr" type="text" placeholder="FR" value="${textFr}" style="${_ST}">`
        + `<input class="ev-act-text-es" type="text" placeholder="ES" value="${textEs}" style="${_ST}">`
        + `<input class="ev-act-text-pt" type="text" placeholder="PT" value="${textPt}" style="${_ST}">`
        + `</span>`
        + `<button data-ev="remove-action" style="background:#400;border:none;color:#f88;cursor:pointer;padding:1px 5px;font-size:10px;border-radius:2px;flex-shrink:0">✕</button>`
        + `</div>`;
};

const _renderForm = (existing?: MissionEvent): void => {
    const el = document.getElementById('ui_events');
    if (!el) return;
    const defOidx  = state.selectedObjectIdx ?? 0;
    const t        = existing?.trigger;
    const trigType = t?.type ?? 'objectReaches';
    const isEdit   = _editIdx !== null;

    const _sect = (title: string, right: string, content: string) =>
        `<div style="background:#0c0c0c;border:1px solid #1e1e1e;border-radius:4px;padding:5px 6px;margin-bottom:5px">`
        + `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`
        + `<span style="font-size:9px;font-weight:700;letter-spacing:0.08em;color:#555">${title}</span>`
        + `${right}</div>${content}</div>`;

    el.innerHTML =
        `<div style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:0.06em;margin-bottom:5px">${isEdit ? '✏ EVENT BEARBEITEN' : '⚡ NEUES EVENT'}</div>`
        + _objRef()
        + _sect('AUSLÖSER', '',
            `<select id="ev_trig_type" style="width:100%;${_SI};margin-bottom:5px">${_trigOpts(trigType)}</select>`
            + `<div id="ev_trig_fields">${_triggerFieldsHTML(trigType, defOidx, t)}</div>`)
        + _sect('AKTIONEN',
            `<button data-ev="add-action" style="background:#1e1e1e;border:1px solid #2a2a2a;color:#999;cursor:pointer;padding:1px 7px;font-size:10px;border-radius:2px">＋</button>`,
            `<div id="ev_action_list">${(existing?.actions?.length ? existing.actions : [undefined]).map(a => _actionRowHTML(defOidx, a)).join('')}</div>`)
        + `<div style="display:flex;gap:4px">`
        + `<button data-ev="save" style="flex:1;background:var(--accent);border:none;color:#000;cursor:pointer;padding:4px;font-size:11px;font-weight:700;border-radius:2px">✓ Speichern</button>`
        + `<button data-ev="cancel" style="background:#1e1e1e;border:1px solid #2a2a2a;color:#999;cursor:pointer;padding:4px 10px;font-size:11px;border-radius:2px">✕</button>`
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
    const oidx = row.querySelector('.ev-act-oidx') as HTMLElement | null;
    const val  = row.querySelector('.ev-act-val')  as HTMLElement | null;
    const msg  = row.querySelector('.ev-act-msg')  as HTMLElement | null;
    if (oidx) oidx.style.display = _ACT_WITH_OBJ.includes(type) ? '' : 'none';
    if (val)  val.style.display  = type === 'setWindStr'         ? '' : 'none';
    if (msg)  msg.style.display  = type === 'showMessage'        ? 'flex' : 'none';
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
            case 'failMission': actions.push(oidx >= 0 ? { type: 'failMission', objectIdx: oidx } : { type: 'failMission' }); break;
            case 'setWindStr':  actions.push({ type: 'setWindStr', value: val }); break;
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
    const newEvent: MissionEvent = { trigger, actions };
    if (_editIdx !== null && _editIdx < events.length) {
        events[_editIdx] = newEvent;
    } else {
        events.push(newEvent);
    }
    (m as any).events = events;
    _formOpen = false;
    _formObjectIdx = null;
    _editIdx = null;
    _notify?.();
    renderEventsPanel(state.selectedObjectIdx);
};
