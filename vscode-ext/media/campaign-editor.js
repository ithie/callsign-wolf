"use strict";
(() => {
  // editor-view/style.css
  var style_default = "/* src/editor/style.css */\n:root {\n    --accent: #5f5;\n    --bg: #181818;\n}\n\nbody {\n    background: var(--bg);\n    color: #fff;\n    font-family: monospace;\n    margin: 0;\n    overflow: hidden;\n}\n\ncanvas {\n    display: block;\n    image-rendering: pixelated;\n}\n\n/* \u2500\u2500 Editor wrapper: fills the canvas area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.editor-wrapper {\n    position: relative;\n    width: 100%;\n    height: 100%;\n    overflow: hidden;\n    background: #002244;\n}\n\n/* Hide the native cursor on the editor canvas \u2014 replaced by JS custom cursor */\n#editorCanvas {\n    cursor: none;\n    position: absolute;\n    inset: 0;\n    width: 100%;\n    height: 100%;\n}\n\n#previewCanvas {\n    border: 2px solid var(--accent);\n    background: #001122;\n    cursor: grab;\n}\n#previewCanvas:active { cursor: grabbing; }\n\n/* \u2500\u2500 Object property panels (live in sidebar #ed-obj-panel) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.floating-ui {\n    background: rgba(10, 10, 10, 0.0);\n    border-top: 1px solid #333;\n    padding: 10px 12px;\n    font-size: 12px;\n    color: #fff;\n    display: none;\n}\n.floating-ui input,\n.floating-ui select {\n    background: #000;\n    color: var(--accent);\n    border: 1px solid #444;\n    font-family: monospace;\n    margin: 2px 0;\n}\n.close-btn {\n    float: right;\n    cursor: pointer;\n    color: #f55;\n    font-weight: bold;\n    font-size: 16px;\n    margin-top: -5px;\n}\n";

  // editor-view/state.ts
  var createEmptyMission = (name = "Mission Alpha") => {
    const gs = 100;
    const grid = [];
    for (let x = 0; x <= gs; x++) {
      grid[x] = [];
      for (let y = 0; y <= gs; y++) grid[x][y] = -1;
    }
    return {
      headline: name,
      briefing: "Befehle f\xFCr diese Mission hier eintragen...",
      gridSize: gs,
      terrain: grid,
      objects: [{ type: "pad", x: 10, y: 10 }],
      spawnObject: "pad",
      objectives: [],
      payloads: [],
      foliage: [],
      rain: false,
      night: false,
      windDir: 45,
      windStr: 1,
      windVar: false
    };
  };
  var state = {
    type: "",
    campaign: [createEmptyMission()],
    curIdx: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    prevZoom: 1,
    prevPanX: 0,
    prevPanY: 0,
    currentTool: "move",
    brushRadius: 1.5,
    isCustomBrush: false,
    selectedUI: null,
    selectedObjectIdx: null,
    // index in m.objects for focused object
    selectedPayloadIdx: null,
    // index in m.payloads for focused payload
    moveMode: false,
    // M-Taste: nächster Klick verschiebt selektiertes Objekt
    payloadBrushType: null,
    foliageBrushType: "pine",
    isDrawing: false,
    isEditorDragging: false,
    isPrevDragging: false,
    lastMX: 0,
    lastMY: 0,
    isDraggingItem: false,
    dragItemType: null,
    dragItemIdx: null,
    dragHasMoved: false,
    dragWasSelected: false,
    dragStartMX: 0,
    dragStartMY: 0,
    dragOrigX: 0,
    dragOrigY: 0
  };
  var getCurrentMission = () => state.campaign[state.curIdx];

  // ../src/shared/constants.ts
  var COLORS = {
    water: "#004488",
    waterNight: "#001433",
    bgNight: "#000408",
    bgRain: "#001122",
    padStroke: "#5f5",
    padFill: "rgba(0, 255, 0, 0.4)",
    padNight: "#2a2",
    carrierBase: "#888",
    carrierNight: "#333",
    carrierAccent: "red",
    carrierPath: "orange",
    lighthouseBase: "#d22",
    lighthouseLight: "#fff",
    uiHighlight: "#ffcc00",
    windActive: "cyan",
    textLight: "#fff",
    textDark: "#000",
    shadow: "rgba(0, 0, 0, 0.5)"
  };
  var getSandColor = (height) => {
    const c = 35 + height * 15;
    return `rgb(${Math.min(240, c + 160)},${Math.min(215, c + 135)},${Math.min(140, c + 55)})`;
  };
  var getLandColor = (height, isNight) => {
    let r = 50 + height * 20;
    let g = 150 + height * 10;
    let b = 50;
    if (isNight) {
      r = Math.floor(r * 0.3);
      g = Math.floor(g * 0.4);
      b = Math.floor(b * 0.6);
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  // editor-view/render.ts
  var BASE_HW = 14;
  var HEIGHT_SCALE = 1.8;
  var _canvas = () => document.getElementById("editorCanvas");
  var isoHW = () => BASE_HW * state.zoom;
  var isoHH = () => BASE_HW * state.zoom * 0.5;
  var isoHS = () => HEIGHT_SCALE * state.zoom;
  var _ox = (c) => c.width / 2 - (state.panX - state.panY) * isoHW();
  var _oy = (c) => c.height * 0.35 - (state.panX + state.panY) * isoHH();
  var screenToGrid = (sx, sy) => {
    const c = _canvas();
    const hw = isoHW(), hh = isoHH(), ox = _ox(c), oy = _oy(c);
    const dx = sx - ox, dy = sy - oy;
    return { gx: (dx / hw + dy / hh) / 2, gy: (dy / hh - dx / hw) / 2 };
  };
  var centerCamera = (gridSize) => {
    const c = _canvas();
    const fitW = c.width / (gridSize * 2 * BASE_HW * 1.05);
    const fitH = c.height * 0.9 / (gridSize * BASE_HW * 1.05);
    state.zoom = Math.min(fitW, fitH);
    state.panX = gridSize / 2;
    state.panY = gridSize / 2;
  };
  var initIsoCanvas = () => {
    const canvas = _canvas();
    const resize = () => {
      const p = canvas.parentElement;
      canvas.width = p.offsetWidth;
      canvas.height = p.offsetHeight;
      drawMap();
    };
    new ResizeObserver(resize).observe(canvas.parentElement ?? canvas);
    resize();
  };
  var _showObjPanel = (id) => {
    const panel = document.getElementById("ed-obj-panel");
    const el = document.getElementById(id);
    if (panel) panel.style.display = "block";
    if (el) el.style.display = "block";
  };
  var _isoArrow = (ctx, cx, cy, angleDeg, hw, hh, len, color) => {
    const rad = angleDeg * Math.PI / 180;
    const wdx = Math.cos(rad), wdy = Math.sin(rad);
    const sdx = (wdx - wdy) * hw, sdy = (wdx + wdy) * hh;
    const mag = Math.hypot(sdx, sdy);
    const nx = sdx / mag * len, ny = sdy / mag * len;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, hw * 0.15);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + nx, cy + ny);
    ctx.stroke();
    const head = len * 0.35, spread = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + nx, cy + ny);
    ctx.lineTo(
      cx + nx - Math.cos(Math.atan2(ny, nx) - spread) * head,
      cy + ny - Math.sin(Math.atan2(ny, nx) - spread) * head
    );
    ctx.moveTo(cx + nx, cy + ny);
    ctx.lineTo(
      cx + nx - Math.cos(Math.atan2(ny, nx) + spread) * head,
      cy + ny - Math.sin(Math.atan2(ny, nx) + spread) * head
    );
    ctx.stroke();
  };
  var _isoDiamond = (ctx, sx, sy, hw, hh, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx, sy + 2 * hh);
    ctx.lineTo(sx - hw, sy + hh);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  var syncVesselUI = (obj, kind) => {
    const prefix = kind === "carrier" ? "carrier" : kind === "submarine" ? "submarine" : "boat";
    const g = (id) => document.getElementById(id);
    const pathEl = g(`m_${prefix}_path`);
    const speedEl = g(`m_${prefix}_speed`);
    const radiusEl = g(`m_${prefix}_radius`);
    const angleEl = g(`m_${prefix}_angle`);
    const nameEl = g(`m_${prefix}_name`);
    const exitEl = g(`m_${prefix}_exitWarning`);
    const radioEl = g(`m_${prefix}_radioSilent`);
    if (pathEl) pathEl.value = obj.path ?? "static";
    if (speedEl) speedEl.value = (obj.speed ?? 0).toString();
    if (radiusEl) radiusEl.value = (obj.radius ?? 40).toString();
    if (angleEl) angleEl.value = (obj.angle ?? 0).toString();
    if (nameEl) nameEl.value = obj.vesselName ?? "";
    if (exitEl) exitEl.checked = obj.exitWarning ?? false;
    if (radioEl) radioEl.checked = !(obj.radioSilent ?? false);
    if (kind === "boat") {
      const radioRow = document.getElementById("m_boat_radioSilent_row");
      if (radioRow) radioRow.style.display = obj.type === "frigate" ? "" : "none";
    }
  };
  var drawMap = () => {
    const canvas = _canvas();
    const ctx = canvas.getContext("2d");
    const m = getCurrentMission();
    if (!m) return;
    const objPanel = document.getElementById("ed-obj-panel");
    if (objPanel) objPanel.style.display = "none";
    document.querySelectorAll(".floating-ui").forEach((el) => {
      el.style.display = "none";
    });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const hw = isoHW(), hh = isoHH(), hs = isoHS();
    const ox = _ox(canvas), oy = _oy(canvas);
    const W = canvas.width, H = canvas.height;
    const gs = m.gridSize;
    const toSX = (gx, gy) => (gx - gy) * hw + ox;
    const toSY = (gx, gy) => (gx + gy) * hh + oy;
    const wl = m.waterLevel ?? 0;
    const isSnow = !!m.snow;
    const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([sx, sy]) => {
      const dx = sx - ox, dy = sy - oy;
      return { gx: (dx / hw + dy / hh) / 2, gy: (dy / hh - dx / hw) / 2 };
    });
    const M = 3;
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gx)) - M));
    const x1 = Math.min(gs, Math.ceil(Math.max(...corners.map((c) => c.gx)) + M));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.gy)) - M));
    const y1 = Math.min(gs, Math.ceil(Math.max(...corners.map((c) => c.gy)) + M));
    for (let d = x0 + y0; d <= x1 + y1 - 2; d++) {
      for (let gx = Math.max(x0, d - (y1 - 1)); gx <= Math.min(x1 - 2, d - y0); gx++) {
        const gy = d - gx;
        if (gy < y0 || gy >= y1 - 1) continue;
        const h0 = m.terrain[gx]?.[gy];
        const h1 = m.terrain[gx + 1]?.[gy];
        const h2 = m.terrain[gx + 1]?.[gy + 1];
        const h3 = m.terrain[gx]?.[gy + 1];
        if (h0 === void 0 || h1 === void 0 || h2 === void 0 || h3 === void 0) continue;
        const isWater = h0 <= wl;
        const isSand = !isWater && (m.sand?.[gx]?.[gy] ?? 0) > 0;
        const isPave = !isWater && (m.pavement?.[gx]?.[gy] ?? 0) > 0;
        const topColor = isWater ? isSnow ? "#0a3060" : COLORS.water : isPave ? "#6a6a72" : isSand ? getSandColor(h0) : isSnow ? `rgb(${190 + Math.floor(h0 * 8)},${205 + Math.floor(h0 * 7)},${220 + Math.floor(h0 * 6)})` : getLandColor(h0, false);
        const sx = toSX(gx, gy);
        const sy = toSY(gx, gy);
        ctx.beginPath();
        ctx.moveTo(sx, sy - h0 * hs);
        ctx.lineTo(sx + hw, sy + hh - h1 * hs);
        ctx.lineTo(sx, sy + 2 * hh - h2 * hs);
        ctx.lineTo(sx - hw, sy + hh - h3 * hs);
        ctx.closePath();
        ctx.fillStyle = topColor;
        ctx.fill();
        if (hw > 18) {
          ctx.strokeStyle = "rgba(0,0,0,0.08)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    const treeColors = {
      pine: "#1a5a1a",
      oak: "#2a6a1a",
      bush: "#3a7a2a",
      dead: "#6a4a2a",
      beach_umbrella: "#cc2200",
      beach_umbrella_tilted: "#cc2200",
      beach_lounger: "#d8cc90",
      beach_cooler: "#3366aa",
      beach_person: "#e8c090",
      swimmer: "#1a88cc"
    };
    const foliage = m.foliage || [];
    foliage.forEach((f) => {
      const { sx, sy } = { sx: toSX(f.x, f.y) + hw * 0.5, sy: toSY(f.x, f.y) + hh * 0.5 };
      const r = Math.max(2, hw * 0.45 * (f.s || 1));
      ctx.fillStyle = treeColors[f.type] || "#1a5a1a";
      ctx.beginPath();
      ctx.ellipse(sx, sy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    m.objects.forEach((obj, idx) => {
      const isSel = state.selectedObjectIdx === idx;
      const cx = toSX(obj.x + 0.5, obj.y + 0.5);
      const cy = toSY(obj.x + 0.5, obj.y + 0.5);
      if (isSel) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#fff";
      }
      if (obj.type === "pad") {
        const tl = { sx: toSX(obj.x, obj.y), sy: toSY(obj.x, obj.y) };
        const tr = { sx: toSX(obj.x + 7, obj.y), sy: toSY(obj.x + 7, obj.y) };
        const br = { sx: toSX(obj.x + 7, obj.y + 7), sy: toSY(obj.x + 7, obj.y + 7) };
        const bl = { sx: toSX(obj.x, obj.y + 7), sy: toSY(obj.x, obj.y + 7) };
        ctx.beginPath();
        ctx.moveTo(tl.sx, tl.sy);
        ctx.lineTo(tr.sx, tr.sy);
        ctx.lineTo(br.sx, br.sy);
        ctx.lineTo(bl.sx, bl.sy);
        ctx.closePath();
        ctx.fillStyle = COLORS.padFill + "cc";
        ctx.fill();
        ctx.strokeStyle = COLORS.padStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(9, hw * 1)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const midX = (tl.sx + br.sx) / 2, midY = (tl.sy + br.sy) / 2;
        ctx.fillText("H", midX, midY);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        if (m.spawnObject === "pad") _drawDolphin(ctx, midX, midY, 0, hw, hh);
        if (isSel) _showObjPanel("ui_pad");
        if (isSel) {
          const btn = document.getElementById("btn_spawn_pad");
          if (btn) btn.style.background = m.spawnObject === "pad" ? COLORS.uiHighlight : "var(--accent)";
        }
      } else if (obj.type === "carrier" || obj.type === "boat" || obj.type === "pilot_boat" || obj.type === "sar_boat" || obj.type === "salvage_tug" || obj.type === "supply_vessel" || obj.type === "frigate") {
        const isCarrier = obj.type === "carrier";
        const color = isCarrier ? COLORS.carrierBase : obj.type === "pilot_boat" ? "#ffcc00" : obj.type === "sar_boat" ? "#d32f2f" : obj.type === "salvage_tug" ? "#888" : obj.type === "supply_vessel" ? "#0d233a" : obj.type === "frigate" ? "#5a6673" : "#ddd";
        const rad = Math.max(4, hw * (isCarrier ? 1.4 : 0.8));
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        _isoArrow(ctx, cx, cy, obj.angle ?? 0, hw, hh, hw * 2.2, "#fff");
        if (obj.path === "circle") {
          const r = obj.radius ?? 40;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * hw, r * hh * 0.9, 0, 0, Math.PI * 2);
          ctx.strokeStyle = isCarrier ? COLORS.carrierPath + "88" : "#4af8";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (m.spawnObject === obj.type) _drawDolphin(ctx, cx, cy, 0, hw, hh);
        if (isSel) {
          _showObjPanel(isCarrier ? "ui_carrier" : "ui_boat");
          syncVesselUI(obj, isCarrier ? "carrier" : "boat");
          if (isCarrier) {
            const btn = document.getElementById("btn_spawn_carrier");
            if (btn) btn.style.background = m.spawnObject === "carrier" ? COLORS.uiHighlight : "var(--accent)";
          }
        }
      } else if (obj.type === "submarine") {
        const rad = Math.max(3, hw * 0.7);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#111c";
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = "#aaa";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        _isoArrow(ctx, cx, cy, obj.angle ?? 0, hw, hh, hw * 1.8, "#888");
        if (isSel) {
          _showObjPanel("ui_submarine");
          syncVesselUI(obj, "submarine");
        }
      } else if (obj.type === "lighthouse") {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(3, hw * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = COLORS.lighthouseBase;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, hw * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = COLORS.lighthouseLight;
        ctx.fill();
      } else if (obj.type === "research_platform") {
        const r = hw * 1.2;
        _isoDiamond(ctx, cx - hw * 0.5, cy - hh * 0.5, r, r * 0.5, "#666", "#4af");
        ctx.fillStyle = "#2a8f2a";
        ctx.fillRect(cx - r, cy - hh * 0.3, r * 0.8, hh * 0.6);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(7, hw * 0.55)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H", cx - r * 0.6, cy);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
      } else if (obj.type === "wind_turbine") {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, hw * 0.22), 0, Math.PI * 2);
        ctx.fillStyle = "#ccc";
        ctx.fill();
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = Math.max(1, hw * 0.12);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * hw * 2.2, cy + Math.sin(a) * hh * 2.2);
          ctx.stroke();
        }
        ctx.fillStyle = "#f22";
        ctx.beginPath();
        ctx.arc(cx, cy - hw * 0.3, Math.max(2, hw * 0.15), 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          _showObjPanel("ui_wt");
          const spinEl = document.getElementById("m_wt_spinning");
          if (spinEl) spinEl.checked = !!obj.spinning;
        }
      } else {
        const typeColors = {
          plane_wreck: "#d4c022",
          sailboat_broken: "#933",
          ornithopter_wreck: "#d0d0d0",
          baywatch_car: "#cc2200",
          baywatch_hq: "#cc2200",
          baywatch_tower: "#d8d0b8",
          concert_stage: "#7a2aee",
          festival_tent: "#2266cc",
          festival_tent_broken: "#6688aa",
          festival_car: "#9aabb5",
          xmas_house_a: "#aaddff",
          xmas_house_b: "#88bbee",
          xmas_lantern: "#ffee88",
          sleigh: "#ee3300",
          reindeer: "#cc8844",
          ring: "#FFD700"
        };
        const color = typeColors[obj.type] || "#aaa";
        const r = Math.max(3, hw * 0.65);
        if (obj.type === "ring") {
          const rr = (obj.radius ?? 2.5) * hw;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rr, rr * 0.55, 0, 0, Math.PI * 2);
          ctx.strokeStyle = isSel ? "#fff" : color;
          ctx.lineWidth = isSel ? 2.5 : 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = color + "cc";
          ctx.fill();
          if (isSel) {
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          if (obj.angle !== void 0) {
            _isoArrow(ctx, cx, cy, obj.angle, hw, hh, hw * 1.6, "#fff");
          }
        }
        const panelMap = {
          plane_wreck: "ui_plane_wreck",
          sailboat_broken: "ui_sailboat_broken",
          ornithopter_wreck: "ui_ornithopter_wreck",
          baywatch_car: "ui_baywatch_car",
          baywatch_hq: "ui_baywatch_hq",
          baywatch_tower: "ui_baywatch_tower",
          concert_stage: "ui_concert_stage",
          festival_tent: "ui_festival_tent",
          festival_tent_broken: "ui_festival_tent_broken",
          festival_car: "ui_festival_car",
          xmas_house_a: "ui_xmas_house",
          xmas_house_b: "ui_xmas_house",
          xmas_lantern: "ui_xmas_lantern",
          sleigh: "ui_sleigh",
          reindeer: "ui_reindeer"
        };
        if (isSel && panelMap[obj.type]) {
          _showObjPanel(panelMap[obj.type]);
          const angleId = obj.type === "xmas_house_a" || obj.type === "xmas_house_b" ? "m_xmas_house_angle" : obj.type === "festival_tent" ? "m_tent_angle" : obj.type === "festival_tent_broken" ? "m_tent_broken_angle" : obj.type === "festival_car" ? "m_fcar_angle" : `m_${obj.type.replace("_wreck", "_wreck").replace("baywatch_car", "bwc").replace("baywatch_hq", "").replace("baywatch_tower", "")}_angle`;
          const simpleId = {
            plane_wreck: "m_pw_angle",
            sailboat_broken: "m_sb_angle",
            ornithopter_wreck: "m_ow_angle",
            baywatch_car: "m_bwc_angle",
            xmas_lantern: "m_xmas_lantern_angle",
            sleigh: "m_sleigh_angle",
            reindeer: "m_reindeer_angle"
          };
          const aEl = document.getElementById(simpleId[obj.type] || "");
          if (aEl) aEl.value = (obj.angle ?? 0).toString();
          if (obj.type === "xmas_house_a" || obj.type === "xmas_house_b") {
            const typeSel = document.getElementById("m_xmas_house_type");
            if (typeSel) typeSel.value = obj.type;
          }
          if (obj.type === "festival_tent" || obj.type === "festival_tent_broken") {
            const cid = obj.type === "festival_tent" ? "m_tent_color" : "m_tent_broken_color";
            const cEl = document.getElementById(cid);
            if (cEl) cEl.value = obj.colorVariant ?? "";
            const aEl2 = document.getElementById(obj.type === "festival_tent" ? "m_tent_angle" : "m_tent_broken_angle");
            if (aEl2) aEl2.value = String(obj.angle ?? 0);
          }
          if (obj.type === "festival_car") {
            const cEl = document.getElementById("m_fcar_color");
            if (cEl) cEl.value = obj.colorVariant ?? "";
            const aEl2 = document.getElementById("m_fcar_angle");
            if (aEl2) aEl2.value = (obj.angle ?? 0).toString();
          }
        }
      }
      ctx.shadowBlur = 0;
      if (hw > 10) {
        ctx.fillStyle = isSel ? "#fff" : "rgba(255,255,255,0.65)";
        ctx.font = `${Math.max(8, hw * 0.7)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(obj.type, cx, cy - Math.max(6, hw * 0.9));
        ctx.textAlign = "left";
      }
    });
    const payloads = m.payloads || [];
    payloads.forEach((p, idx) => {
      const { sx: px, sy: py } = { sx: toSX(p.x + 0.5, p.y + 0.5), sy: toSY(p.x + 0.5, p.y + 0.5) };
      const r = Math.max(4, hw * 0.6);
      const isAtt = !!p.attachTo;
      const isSel = state.selectedPayloadIdx === idx;
      if (isSel) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#fff";
      }
      const colors = {
        person: [isAtt ? "#88ffcc" : "#ffe033", "#cc9900"],
        rescuer: [isAtt ? "#88ddff" : "#ff6600", "#cc3300"],
        reindeer: [isAtt ? "#eebb88" : "#cc8844", "#aa6622"],
        crate: [isAtt ? "#44ccff" : "#ff8800", "#cc5500"]
      };
      const [fill, stroke] = colors[p.type] || ["#aaa", "#888"];
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!p.npcTarget) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(7, hw * 0.5)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(String(idx + 1), px, py + r * 1.3);
        ctx.textAlign = "left";
      }
      ctx.shadowBlur = 0;
    });
    (m.particleEmitters || []).forEach((e) => {
      const ex = toSX(e.x + 0.5, e.y + 0.5);
      const ey = toSY(e.x + 0.5, e.y + 0.5);
      const r = Math.max(4, hw * 0.45);
      const isFire = e.type === "fire";
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = isFire ? "#ff6600" : "#888";
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 1.8, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = isFire ? "#ff4400" : "#666";
      ctx.beginPath();
      ctx.ellipse(ex, ey, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(8, hw * 0.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isFire ? "\u{1F525}" : "\u{1F4A8}", ex, ey);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
    _drawWindCompass(ctx, m, W - 60, 50);
    _drawMinimap(ctx, m, canvas, ox, oy, hw, hh);
  };
  var _drawDolphin = (ctx, cx, cy, _angleDeg, hw, hh) => {
    const s = Math.max(4, hw * 1.2);
    ctx.save();
    ctx.translate(cx, cy - hh * 1.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.4, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,200,50,0.18)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,200,50,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f90";
    ctx.fill();
    ctx.fillStyle = "#e80";
    ctx.fillRect(-s * 0.5, -s * 0.08, s * 0.45, s * 0.16);
    ctx.restore();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255,160,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 1.2);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  var _drawWindCompass = (ctx, m, x, y) => {
    if (!m) return;
    const dirRad = m.windDir * Math.PI / 180;
    const isSelWind = state.selectedUI === "wind";
    if (isSelWind) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.windActive ?? "#4fc";
      if (document.getElementById("ui_wind"))
        _showObjPanel("ui_wind");
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelWind ? COLORS.windActive ?? "#4fc" : COLORS.padStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (m.windStr > 0) {
      const str01 = Math.min(m.windStr, 10) / 10;
      const arrowL = 8 + Math.sqrt(str01) * 14;
      const tipX = x + Math.cos(dirRad) * arrowL;
      const tipY = y + Math.sin(dirRad) * arrowL;
      ctx.lineWidth = 1.5 + str01 * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      const hl = 5, spread = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(dirRad - spread) * hl, tipY - Math.sin(dirRad - spread) * hl);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(dirRad + spread) * hl, tipY - Math.sin(dirRad + spread) * hl);
      ctx.stroke();
      ctx.fillStyle = isSelWind ? COLORS.windActive ?? "#4fc" : COLORS.padStroke;
      ctx.font = "bold 9px monospace";
      ctx.fillText(`${m.windStr.toFixed(1)}`, x - 22, y + 38);
    }
  };
  var _drawMinimap = (ctx, m, canvas, ox, oy, hw, hh) => {
    if (!m) return;
    const MW = 160, MH = 100;
    const MX = canvas.width - MW - 8;
    const MY = canvas.height - MH - 8;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(MX - 1, MY - 1, MW + 2, MH + 2);
    const gs = m.gridSize;
    const ts = Math.min(MW / gs, MH / gs);
    const wl = m.waterLevel ?? 0;
    for (let gx = 0; gx < gs; gx++) {
      for (let gy = 0; gy < gs; gy++) {
        if (m.terrain[gx]?.[gy] === void 0) continue;
        const h = m.terrain[gx]?.[gy];
        if (h === void 0) continue;
        ctx.fillStyle = h <= wl ? COLORS.water : getLandColor(h, false);
        ctx.fillRect(MX + gx * ts, MY + gy * ts, ts + 0.5, ts + 0.5);
      }
    }
    m.objects.forEach((o) => {
      const mx = MX + (o.x + 0.5) * ts, my = MY + (o.y + 0.5) * ts;
      ctx.fillStyle = o.type === "pad" ? COLORS.padFill : o.type === "carrier" ? COLORS.carrierBase : "#4af";
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    });
    const W = canvas.width, H = canvas.height;
    const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([sx, sy]) => {
      const dx = sx - ox, dy = sy - oy;
      return {
        mx: MX + (dx / hw + dy / hh) / 2 * ts,
        my: MY + (dy / hh - dx / hw) / 2 * ts
      };
    });
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].mx, corners[0].my);
    corners.forEach((c) => ctx.lineTo(c.mx, c.my));
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(MX, MY, MW, MH);
  };

  // ../src/shared/utils.ts
  var FOLIAGE_ENCODE = { pine: "p", oak: "o", bush: "b", dead: "d", beach_umbrella: "u", beach_lounger: "l", beach_cooler: "c", beach_umbrella_tilted: "v", beach_person: "g", swimmer: "s" };
  var FOLIAGE_DECODE = { p: "pine", o: "oak", b: "bush", d: "dead", u: "beach_umbrella", l: "beach_lounger", c: "beach_cooler", v: "beach_umbrella_tilted", g: "beach_person", s: "swimmer" };
  var compressFoliage = (foliage) => {
    if (!foliage || foliage.length === 0) return "";
    return foliage.map((f) => {
      const t = FOLIAGE_ENCODE[f.type] || "p";
      const x = Math.round(f.x * 10);
      const y = Math.round(f.y * 10);
      const s = Math.round((f.s || 1) * 10);
      return `${t}${x},${y},${s}`;
    }).join("|");
  };
  var decompressFoliage = (str) => {
    if (!str) return [];
    return str.split("|").map((token) => {
      const type = FOLIAGE_DECODE[token[0]] || "pine";
      const [x, y, s] = token.slice(1).split(",").map(Number);
      return { type, x: x / 10, y: y / 10, s: s / 10 };
    });
  };
  var compressTerrain = (grid) => {
    const flat = [];
    grid.forEach((col) => col.forEach((v) => flat.push(Math.round(v * 10))));
    const res = [];
    let count = 1;
    let cur = flat[0];
    for (let i = 1; i < flat.length; i++) {
      if (flat[i] === cur) {
        count++;
      } else {
        res.push(count > 1 ? `${cur}x${count}` : cur);
        cur = flat[i];
        count = 1;
      }
    }
    res.push(count > 1 ? `${cur}x${count}` : cur);
    return res.join(",");
  };
  var decompressTerrain = (str, gridSize) => {
    const flat = [];
    str.split(",").forEach((t) => {
      if (t.includes("x")) {
        const [v, c] = t.split("x");
        for (let i = 0; i < parseInt(c, 10); i++) flat.push(parseInt(v, 10) / 10);
      } else {
        flat.push(parseInt(t, 10) / 10);
      }
    });
    const res = [];
    let k = 0;
    for (let x = 0; x <= gridSize; x++) {
      res[x] = [];
      for (let y = 0; y <= gridSize; y++) {
        res[x][y] = flat[k++];
      }
    }
    return res;
  };

  // editor-view/ui.ts
  var _onStateChanged = null;
  var setOnStateChanged = (fn) => {
    _onStateChanged = fn;
  };
  var notifyWorkbench = () => {
    if (window.parent !== window) window.parent.postMessage({ type: "editor-state-changed" }, "*");
    _onStateChanged?.();
  };
  var previewChannel = new BroadcastChannel("editor-preview");
  var broadcastPreview = () => {
    const m = getCurrentMission();
    if (!m) return;
    previewChannel.postMessage({ type: "mission-update", mission: m, heliType: m.heliOverride || void 0 });
  };
  previewChannel.onmessage = (e) => {
    if (e.data.type === "preview-ready") broadcastPreview();
  };
  var getEl = (id) => document.getElementById(id);
  var getInput = (id) => getEl(id);
  var renderPayloadList = () => notifyWorkbench();
  var renderObjectList = () => notifyWorkbench();
  var renderFoliageList = () => notifyWorkbench();
  var _lsDe = (ls) => !ls ? "" : typeof ls === "string" ? ls : ls.de || "";
  var _lsEn = (ls) => !ls ? "" : typeof ls === "string" ? "" : ls.en || "";
  var syncToData = () => {
    const m = getCurrentMission();
    if (!m) return;
    m.headline = { de: getInput("m_headline_de").value, en: getInput("m_headline_en").value };
    const subDe = getEl("m_sublines_de").value.split("\n").filter((l) => l.trim());
    const subEn = getEl("m_sublines_en").value.split("\n").filter((l) => l.trim());
    m.sublines = subDe.map((de, i) => ({ de, en: subEn[i] || "" }));
    m.briefing = {
      de: getEl("m_briefing_de").value,
      en: getEl("m_briefing_en").value
    };
    m.rain = getInput("m_rain").checked;
    m.snow = getInput("m_snow").checked;
    m.night = getInput("m_night").checked;
    m.padPayloadRefill = getInput("m_pad_payload_refill").checked || void 0;
    const _startOnboard = parseInt(getInput("m_start_onboard").value);
    m.startOnboard = _startOnboard > 0 ? _startOnboard : void 0;
    m.waterLevel = parseFloat(getInput("m_water_level").value) || 0;
    const _maxTime = parseFloat(getInput("m_max_time").value);
    m.maxTime = isFinite(_maxTime) && _maxTime > 0 ? _maxTime : void 0;
    const _heliOverride = getEl("m_heli_override").value;
    m.heliOverride = _heliOverride || void 0;
    m.windDir = parseInt(getInput("m_wind_dir").value) || 0;
    m.windStr = parseFloat(getInput("m_wind_str").value) || 0;
    m.windVar = getInput("m_wind_var").checked;
    m.gridSize = parseInt(getInput("m_grid_size").value) || 100;
    const npcCount = parseInt(getInput("m_npc_heli_count").value);
    m.npcHeliCount = npcCount > 0 ? npcCount : void 0;
    const npcType = getEl("m_npc_heli_type").value;
    m.npcHeliType = npcType !== "random" ? npcType : void 0;
    renderMissionList();
    drawMap();
    broadcastPreview();
    notifyWorkbench();
  };
  var syncVesselFromUI = (kind) => {
    const m = getCurrentMission();
    if (!m || state.selectedObjectIdx === null) return;
    const obj = m.objects[state.selectedObjectIdx];
    const _boatTypes = /* @__PURE__ */ new Set(["boat", "pilot_boat", "sar_boat", "salvage_tug", "supply_vessel", "frigate"]);
    if (!obj || (kind === "boat" ? !_boatTypes.has(obj.type) : obj.type !== kind)) return;
    const prefix = kind === "carrier" ? "carrier" : kind === "submarine" ? "submarine" : "boat";
    obj.path = document.getElementById(`m_${prefix}_path`)?.value ?? obj.path;
    obj.speed = parseFloat(document.getElementById(`m_${prefix}_speed`)?.value) || 0;
    obj.radius = parseFloat(document.getElementById(`m_${prefix}_radius`)?.value) || 40;
    obj.angle = parseInt(document.getElementById(`m_${prefix}_angle`)?.value) || 0;
    obj.vesselName = document.getElementById(`m_${prefix}_name`)?.value ?? "";
    obj.exitWarning = document.getElementById(`m_${prefix}_exitWarning`)?.checked ?? false;
    obj.radioSilent = !(document.getElementById(`m_${prefix}_radioSilent`)?.checked ?? true);
    drawMap();
    broadcastPreview();
    notifyWorkbench();
  };
  var loadMission = (idx) => {
    state.curIdx = idx;
    const m = getCurrentMission();
    if (!m) return;
    if (!m.payloads) m.payloads = [];
    if (!m.objects) m.objects = [];
    getInput("m_headline_de").value = _lsDe(m.headline);
    getInput("m_headline_en").value = _lsEn(m.headline);
    getEl("m_sublines_de").value = (m.sublines || []).map(_lsDe).join("\n");
    getEl("m_sublines_en").value = (m.sublines || []).map(_lsEn).join("\n");
    getEl("m_briefing_de").value = _lsDe(m.briefing);
    getEl("m_briefing_en").value = _lsEn(m.briefing);
    getInput("m_grid_size").value = m.gridSize.toString();
    getInput("m_rain").checked = m.rain;
    getInput("m_snow").checked = !!m.snow;
    getInput("m_night").checked = m.night;
    getInput("m_pad_payload_refill").checked = !!m.padPayloadRefill;
    getInput("m_start_onboard").value = (m.startOnboard ?? 0).toString();
    getInput("m_water_level").value = (m.waterLevel ?? 0).toString();
    getInput("m_max_time").value = m.maxTime != null ? m.maxTime.toString() : "";
    getEl("m_heli_override").value = m.heliOverride ?? "";
    getInput("m_wind_dir").value = (m.windDir ?? 0).toString();
    getInput("m_wind_str").value = (m.windStr ?? 0).toString();
    getInput("m_wind_var").checked = !!m.windVar;
    getInput("m_npc_heli_count").value = (m.npcHeliCount ?? 0).toString();
    getEl("m_npc_heli_type").value = m.npcHeliType ?? "random";
    state.selectedUI = null;
    state.selectedObjectIdx = null;
    centerCamera(m.gridSize);
    renderMissionList();
    renderPayloadList();
    renderObjectList();
    renderFoliageList();
    drawMap();
    broadcastPreview();
    notifyWorkbench();
  };
  var renderMissionList = () => notifyWorkbench();
  var clampCamera = () => {
    const m = getCurrentMission();
    if (!m) return;
    const margin = m.gridSize * 0.25;
    state.panX = Math.max(-margin, Math.min(state.panX, m.gridSize + margin));
    state.panY = Math.max(-margin, Math.min(state.panY, m.gridSize + margin));
  };
  var smoothCoast = (m, cx, cy, radius) => {
    for (let pass = 0; pass < 2; pass++) {
      for (let x = Math.max(1, cx - radius); x < Math.min(m.gridSize, cx + radius); x++) {
        for (let y = Math.max(1, cy - radius); y < Math.min(m.gridSize, cy + radius); y++) {
          const h = m.terrain[x][y];
          const neighbors = [
            m.terrain[x - 1]?.[y],
            m.terrain[x + 1]?.[y],
            m.terrain[x]?.[y - 1],
            m.terrain[x]?.[y + 1]
          ].filter((v) => v !== void 0);
          const maxN = Math.max(...neighbors), minN = Math.min(...neighbors);
          if (h > 0 && minN <= 0 && h > 4) m.terrain[x][y] = Math.round((h + minN) / 2 * 100) / 100;
          else if (h <= 0 && maxN > 4) m.terrain[x][y] = Math.round((h + maxN) / 2 * 100) / 100;
        }
      }
    }
  };
  var SNAP_RADIUS = 8;
  var makePayload = (type, gx, gy, m) => {
    let nearestIdx = -1, nearestDist = SNAP_RADIUS;
    for (let i = 0; i < m.objects.length; i++) {
      const obj = m.objects[i];
      if (obj.type !== "carrier" && obj.type !== "boat" && obj.type !== "sar_boat" && obj.type !== "submarine" && obj.type !== "sailboat_broken")
        continue;
      const d = Math.hypot(gx - obj.x, gy - obj.y);
      if (d <= nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    if (nearestIdx >= 0) {
      const obj = m.objects[nearestIdx];
      return {
        type,
        x: gx,
        y: gy,
        attachTo: {
          objectType: obj.type,
          objectIdx: nearestIdx
        }
      };
    }
    return { type, x: gx, y: gy };
  };
  var removeNearestPayload = (m, gx, gy, type) => {
    if (!m.payloads) return;
    let nearestIdx = -1, nearestDist = 3;
    m.payloads.forEach((p, i) => {
      if (p.type !== type) return;
      const d = Math.hypot(p.x - gx, p.y - gy);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    });
    if (nearestIdx >= 0) m.payloads.splice(nearestIdx, 1);
  };
  var paint = (e) => {
    const m = getCurrentMission();
    if (!m) return;
    const canvas = getEl("editorCanvas");
    const rect = canvas.getBoundingClientRect();
    const { gx: _gx, gy: _gy } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
    const gx = Math.floor(_gx);
    const gy = Math.floor(_gy);
    if (gx < 0 || gx >= m.gridSize || gy < 0 || gy >= m.gridSize) return;
    if (state.currentTool === "terrain") {
      const rad = Math.ceil(state.brushRadius);
      const targetHeight = e.shiftKey ? -1 : 10;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
          const dist = Math.hypot(dx, dy);
          const nx = gx + dx, ny = gy + dy;
          if (dist <= state.brushRadius && m.terrain[nx] && m.terrain[nx][ny] !== void 0) {
            const falloff = (Math.cos(dist / state.brushRadius * Math.PI) + 1) / 2;
            let newH = m.terrain[nx][ny] + (targetHeight - m.terrain[nx][ny]) * 0.05 * falloff;
            m.terrain[nx][ny] = Math.round(Math.max(-1, Math.min(15, newH)) * 100) / 100;
          }
        }
      }
    } else if (state.currentTool === "flatten") {
      const h = e.shiftKey ? -1 : 0.25;
      const rad = Math.ceil(state.brushRadius);
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
          const nx = gx + dx, ny = gy + dy;
          if (Math.hypot(dx, dy) <= state.brushRadius && m.terrain[nx] && ny >= 0 && ny <= m.gridSize) m.terrain[nx][ny] = h;
        }
      }
      if (e.shiftKey || h <= 0.1) {
        if (m.foliage) {
          m.foliage = m.foliage.filter(
            (f) => Math.hypot(f.x - gx, f.y - gy) > state.brushRadius
          );
        }
      }
    } else if (state.currentTool === "pad") {
      const existing = m.objects.findIndex((o) => o.type === "pad");
      if (e.shiftKey) {
        if (existing >= 0) m.objects.splice(existing, 1);
      } else {
        const newPad = { type: "pad", x: gx, y: gy };
        if (existing >= 0) m.objects[existing] = newPad;
        else m.objects.push(newPad);
      }
    } else if (state.currentTool === "carrier") {
      const existing = m.objects.findIndex((o) => o.type === "carrier");
      if (e.shiftKey) {
        if (existing >= 0) m.objects.splice(existing, 1);
      } else {
        const newCarrier = existing >= 0 ? { ...m.objects[existing], x: gx, y: gy } : {
          type: "carrier",
          x: gx,
          y: gy,
          angle: 0,
          path: "circle",
          speed: 5,
          radius: 40
        };
        if (existing >= 0) m.objects[existing] = newCarrier;
        else m.objects.push(newCarrier);
      }
    } else if (state.currentTool === "boat") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "boat") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 8) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "boat", x: gx, y: gy, angle: 0, path: "circle", speed: 3, radius: 20 });
      }
    } else if (state.currentTool === "submarine") {
      if (e.shiftKey) {
        let nearestIdx = -1, nearestDist = 8;
        m.objects.forEach((o, i) => {
          if (o.type !== "submarine") return;
          const d = Math.hypot(o.x - gx, o.y - gy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        });
        if (nearestIdx >= 0) m.objects.splice(nearestIdx, 1);
      } else {
        let nearestIdx = -1, nearestDist = 8;
        m.objects.forEach((o, i) => {
          if (o.type !== "submarine") return;
          const d = Math.hypot(o.x - gx, o.y - gy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        });
        if (nearestIdx >= 0) {
          m.objects[nearestIdx] = { ...m.objects[nearestIdx], x: gx, y: gy };
        } else {
          m.objects.push({ type: "submarine", x: gx, y: gy, angle: 0, path: "static", speed: 0, radius: 20 });
        }
      }
    } else if (state.currentTool === "lighthouse") {
      const existing = m.objects.findIndex((o) => o.type === "lighthouse");
      if (e.shiftKey) {
        if (existing >= 0) m.objects.splice(existing, 1);
      } else {
        const newLH = { type: "lighthouse", x: gx, y: gy };
        if (existing >= 0) m.objects[existing] = newLH;
        else m.objects.push(newLH);
      }
    } else if (state.currentTool === "pilot_boat") {
      if (e.shiftKey) {
        const ni = m.objects.findIndex((o) => o.type === "pilot_boat");
        if (ni >= 0) m.objects.splice(ni, 1);
      } else {
        m.objects.push({ type: "pilot_boat", x: gx, y: gy, angle: 0, path: "static", speed: 0, radius: 0 });
      }
    } else if (state.currentTool === "sar_boat") {
      if (e.shiftKey) {
        const ni = m.objects.reduce((best, o, i) => {
          if (o.type !== "sar_boat") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (ni && ni.d < 5) m.objects.splice(ni.i, 1);
      } else {
        m.objects.push({ type: "sar_boat", x: gx, y: gy, angle: 0, path: "static", speed: 0, radius: 0 });
      }
    } else if (state.currentTool === "salvage_tug") {
      if (e.shiftKey) {
        const ni = m.objects.findIndex((o) => o.type === "salvage_tug");
        if (ni >= 0) m.objects.splice(ni, 1);
      } else {
        m.objects.push({ type: "salvage_tug", x: gx, y: gy, angle: 0, path: "static", speed: 0, radius: 0 });
      }
    } else if (state.currentTool === "research_platform") {
      if (e.shiftKey) {
        const ni = m.objects.findIndex((o) => o.type === "research_platform");
        if (ni >= 0) m.objects.splice(ni, 1);
      } else {
        m.objects.push({ type: "research_platform", x: gx, y: gy });
      }
    } else if (state.currentTool === "wind_turbine") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "wind_turbine") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "wind_turbine", x: gx, y: gy });
      }
    } else if (state.currentTool === "plane_wreck") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "plane_wreck") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "plane_wreck", x: gx, y: gy, angle: 0 });
      }
    } else if (state.currentTool === "ornithopter_wreck") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "ornithopter_wreck") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "ornithopter_wreck", x: gx, y: gy, angle: 0 });
      }
    } else if (state.currentTool === "sailboat_broken") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "sailboat_broken") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "sailboat_broken", x: gx, y: gy, angle: 0 });
      }
    } else if (state.currentTool === "buoy") {
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== "buoy") return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: "buoy", x: gx, y: gy });
      }
    } else if (state.currentTool === "baywatch_car" || state.currentTool === "baywatch_hq" || state.currentTool === "baywatch_tower") {
      const bwType = state.currentTool;
      if (e.shiftKey) {
        const near = m.objects.reduce((best, o, i) => {
          if (o.type !== bwType) return best;
          const d = Math.hypot(o.x - gx, o.y - gy);
          return !best || d < best.d ? { d, i } : best;
        }, null);
        if (near && near.d < 5) m.objects.splice(near.i, 1);
      } else {
        m.objects.push({ type: bwType, x: gx, y: gy, angle: 0 });
      }
    } else if (state.currentTool === "person" || state.currentTool === "rescuer") {
      const t = state.currentTool;
      if (e.shiftKey) removeNearestPayload(m, gx, gy, t);
      else {
        if (!m.payloads) m.payloads = [];
        m.payloads.push(makePayload(t, gx, gy, m));
      }
      renderPayloadList();
    } else if (state.currentTool === "crate") {
      if (e.shiftKey) removeNearestPayload(m, gx, gy, "crate");
      else {
        if (!m.payloads) m.payloads = [];
        m.payloads.push(makePayload("crate", gx, gy, m));
      }
      renderPayloadList();
    } else if (state.currentTool === "festival_tent" || state.currentTool === "festival_tent_broken") {
      const baseType = state.currentTool;
      const colorSel = document.getElementById(baseType === "festival_tent_broken" ? "m_tent_broken_color" : "m_tent_color");
      const rad = Math.max(0.5, state.brushRadius);
      const count = Math.max(1, Math.round(rad * 0.5));
      const _VARIANTS = ["", "red", "green"];
      if (e.shiftKey) {
        m.objects = m.objects.filter((o) => o.type !== baseType || Math.hypot(o.x - gx, o.y - gy) > rad);
      } else {
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * rad;
          const fx = Math.round(gx + Math.cos(a) * d);
          const fy = Math.round(gy + Math.sin(a) * d);
          if (fx < 0 || fx >= m.gridSize || fy < 0 || fy >= m.gridSize) continue;
          if ((m.terrain[fx]?.[fy] ?? -1) <= 0.05) continue;
          const selColor = colorSel?.value;
          const variant = selColor === "random" || !selColor ? _VARIANTS[Math.floor(Math.random() * _VARIANTS.length)] : selColor;
          const angle = Math.round(Math.random() * 360);
          const obj = { type: baseType, x: fx, y: fy, angle };
          if (variant) obj.colorVariant = variant;
          m.objects.push(obj);
        }
      }
      notifyWorkbench();
    } else if (state.currentTool === "foliage") {
      if (!m.foliage) m.foliage = [];
      const foliage = m.foliage;
      if (e.shiftKey) {
        const rad = Math.max(0.5, state.brushRadius);
        m.foliage = foliage.filter((f) => Math.hypot(f.x - gx, f.y - gy) > rad);
      } else {
        const rad = Math.max(0.5, state.brushRadius);
        const count = Math.max(1, Math.round(rad * 0.8));
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * rad;
          const fx = gx + Math.cos(angle) * dist;
          const fy = gy + Math.sin(angle) * dist;
          if (fx < 0 || fx >= m.gridSize || fy < 0 || fy >= m.gridSize) continue;
          const type = document.getElementById("foliage-type")?.value || "pine";
          const h = m.terrain[Math.round(fx)]?.[Math.round(fy)] ?? -1;
          const isBeach = type === "beach_person" || type === "beach_umbrella" || type === "beach_umbrella_tilted" || type === "beach_lounger" || type === "beach_cooler";
          if (isBeach ? h < -3 : h <= 0.05) continue;
          const scale = parseFloat(
            document.getElementById("foliage-scale")?.value || "1.0"
          );
          foliage.push({ x: Math.round(fx * 10) / 10, y: Math.round(fy * 10) / 10, s: scale, type });
        }
      }
      renderFoliageList();
    } else if (state.currentTool === "sand") {
      const mSand = m;
      if (!mSand.sand)
        mSand.sand = Array.from({ length: m.gridSize + 1 }, () => new Array(m.gridSize + 1).fill(0));
      const val = e.shiftKey ? 0 : 1;
      const rad = Math.ceil(state.brushRadius);
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
          const nx = gx + dx, ny = gy + dy;
          if (Math.hypot(dx, dy) <= state.brushRadius && nx >= 0 && nx <= m.gridSize && ny >= 0 && ny <= m.gridSize) {
            mSand.sand[nx][ny] = val;
            if (val === 1 && m.terrain[nx]?.[ny] !== void 0 && m.terrain[nx][ny] > 0)
              m.terrain[nx][ny] = m.terrain[nx][ny] <= 0.6 ? 0.4 : 0.8;
          }
        }
      }
    } else if (state.currentTool === "pavement") {
      const mPav = m;
      if (!mPav.pavement)
        mPav.pavement = Array.from({ length: m.gridSize + 1 }, () => new Array(m.gridSize + 1).fill(0));
      const val = e.shiftKey ? 0 : 1;
      const rad = Math.ceil(state.brushRadius);
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dy = -rad; dy <= rad; dy++) {
          const nx = gx + dx, ny = gy + dy;
          if (nx >= 0 && nx <= m.gridSize && ny >= 0 && ny <= m.gridSize) {
            mPav.pavement[nx][ny] = val;
            if (val === 1 && m.terrain[nx]?.[ny] !== void 0 && m.terrain[nx][ny] > 0)
              m.terrain[nx][ny] = m.terrain[nx][ny] <= 0.6 ? 0.4 : 0.8;
          }
        }
      }
    }
    if (state.currentTool === "terrain" || state.currentTool === "flatten")
      smoothCoast(m, gx, gy, Math.ceil(state.brushRadius) + 2);
    renderObjectList();
    drawMap();
  };
  var initUI = () => {
    const popup = document.createElement("div");
    popup.style.cssText = "position:fixed;display:none;background:rgba(10,10,10,0.96);border:1px solid #5f5;padding:10px 12px;font-family:monospace;font-size:12px;color:#fff;border-radius:4px;z-index:9999;box-shadow:0 5px 20px rgba(0,0,0,0.8);min-width:170px";
    document.body.appendChild(popup);
    const hidePopup = () => {
      popup.style.display = "none";
    };
    const showPayloadPopup = (idx, cx, cy) => {
      const m = getCurrentMission();
      const pa = m.payloads[idx];
      const icon = pa.type === "person" ? "\u{1F7E1}" : pa.type === "rescuer" ? "\u{1F535}" : "\u{1F7E0}";
      const typeName = pa.type === "person" ? "Person" : pa.type === "rescuer" ? "Retter" : "Crate";
      popup.innerHTML = "";
      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px";
      const title = document.createElement("span");
      title.style.fontWeight = "bold";
      title.textContent = `${icon} ${typeName} #${idx + 1}`;
      const closeBtn = document.createElement("span");
      closeBtn.textContent = "\xD7";
      closeBtn.style.cssText = "cursor:pointer;color:#f55;font-weight:bold;font-size:16px;margin-left:12px";
      closeBtn.onclick = hidePopup;
      header.append(title, closeBtn);
      popup.appendChild(header);
      const deliverRow = document.createElement("div");
      deliverRow.style.cssText = "margin:4px 0;display:flex;align-items:center;gap:6px";
      const deliverLabel = document.createElement("span");
      deliverLabel.style.color = "#aaa";
      deliverLabel.textContent = "Ziel:";
      const deliverSel = document.createElement("select");
      deliverSel.style.cssText = "flex:1;background:#111;color:#5f5;border:1px solid #444;font-family:monospace;font-size:11px";
      const opts = [["", "\u2013"]];
      if (m.objects.some((o) => o.type === "pad")) opts.push(["pad", "Pad"]);
      if (m.objects.some((o) => o.type === "carrier")) opts.push(["carrier", "Carrier"]);
      if (m.objects.some((o) => o.type === "submarine")) opts.push(["submarine", "U-Boot"]);
      if (m.objects.some((o) => ["boat", "pilot_boat", "sar_boat", "salvage_tug", "supply_vessel", "frigate"].includes(o.type)))
        opts.push(["boat", "Boot"]);
      opts.forEach(([val, lbl]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.text = lbl;
        if ((pa.deliverTo ?? "") === val) opt.selected = true;
        deliverSel.appendChild(opt);
      });
      deliverSel.onchange = () => {
        pa.deliverTo = deliverSel.value || void 0;
        renderPayloadList();
        notifyWorkbench();
        broadcastPreview();
      };
      deliverRow.append(deliverLabel, deliverSel);
      popup.appendChild(deliverRow);
      const npcRow = document.createElement("div");
      npcRow.style.cssText = "margin:6px 0 2px";
      const npcLabel = document.createElement("label");
      npcLabel.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;color:#8af";
      const npcCb = document.createElement("input");
      npcCb.type = "checkbox";
      npcCb.checked = !!pa.npcTarget;
      npcCb.onchange = () => {
        pa.npcTarget = npcCb.checked || void 0;
        renderPayloadList();
        notifyWorkbench();
        broadcastPreview();
      };
      npcLabel.append(npcCb, "NPC-Ziel");
      npcRow.appendChild(npcLabel);
      popup.appendChild(npcRow);
      if (pa.type === "person") {
        const swimRow = document.createElement("div");
        swimRow.style.cssText = "margin:4px 0;display:flex;align-items:center;gap:6px";
        const swimLabel = document.createElement("span");
        swimLabel.style.color = "#aaa";
        swimLabel.textContent = "Outfit:";
        const swimSel = document.createElement("select");
        swimSel.style.cssText = "flex:1;background:#111;color:#8fa;border:1px solid #444;font-family:monospace;font-size:11px";
        const swimOpts = [
          ["", "auto"],
          ["true", "Badekleidung"],
          ["false", "Normalkleidung"]
        ];
        const curSwim = pa.swimwear === true ? "true" : pa.swimwear === false ? "false" : "";
        swimOpts.forEach(([val, lbl]) => {
          const opt = document.createElement("option");
          opt.value = val;
          opt.text = lbl;
          if (curSwim === val) opt.selected = true;
          swimSel.appendChild(opt);
        });
        swimSel.onchange = () => {
          if (swimSel.value === "true") pa.swimwear = true;
          else if (swimSel.value === "false") pa.swimwear = false;
          else delete pa.swimwear;
          renderPayloadList();
          notifyWorkbench();
          broadcastPreview();
        };
        swimRow.append(swimLabel, swimSel);
        popup.appendChild(swimRow);
      }
      const vw = window.innerWidth, vh = window.innerHeight;
      popup.style.left = Math.min(cx + 6, vw - 190) + "px";
      popup.style.top = Math.min(cy + 6, vh - 150) + "px";
      popup.style.display = "block";
    };
    const showRingPopup = (idx, cx, cy) => {
      const m = getCurrentMission();
      const ring = m.objects[idx];
      popup.innerHTML = "";
      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px";
      const title = document.createElement("span");
      title.style.fontWeight = "bold";
      title.textContent = `\u2B55 Ring #${m.objects.slice(0, idx + 1).filter((o) => o.type === "ring").length}`;
      const closeBtn = document.createElement("span");
      closeBtn.textContent = "\xD7";
      closeBtn.style.cssText = "cursor:pointer;color:#f55;font-weight:bold;font-size:16px;margin-left:12px";
      closeBtn.onclick = hidePopup;
      header.append(title, closeBtn);
      popup.appendChild(header);
      const makeRow = (label, value, step, min, max, onChange) => {
        const row = document.createElement("div");
        row.style.cssText = "margin:4px 0;display:flex;align-items:center;gap:6px";
        const lbl = document.createElement("span");
        lbl.style.cssText = "color:#aaa;min-width:55px;font-size:11px";
        lbl.textContent = label;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = String(value);
        inp.step = String(step);
        inp.min = String(min);
        inp.max = String(max);
        inp.style.cssText = "flex:1;background:#111;color:#FFD700;border:1px solid #444;font-family:monospace;font-size:11px;padding:2px 4px;width:60px";
        inp.oninput = () => {
          const v = parseFloat(inp.value);
          if (!isNaN(v)) onChange(v);
        };
        row.append(lbl, inp);
        return { row, inp };
      };
      const { row: angleRow, inp: angleInp } = makeRow("Winkel \xB0:", Math.round((ring.angle ?? 0) * 180 / Math.PI), 15, 0, 360, (v) => {
        ring.angle = v * Math.PI / 180;
        drawMap();
        notifyWorkbench();
        broadcastPreview();
      });
      popup.appendChild(angleRow);
      popup.appendChild(makeRow("H\xF6he z:", ring.z ?? 4, 0.5, 0.5, 20, (v) => {
        ring.z = v;
        notifyWorkbench();
        broadcastPreview();
      }).row);
      popup.appendChild(makeRow("Radius:", ring.radius ?? 2.5, 0.5, 1, 10, (v) => {
        ring.radius = v;
        drawMap();
        notifyWorkbench();
        broadcastPreview();
      }).row);
      const rotRow = document.createElement("div");
      rotRow.style.cssText = "display:flex;gap:4px;margin-top:6px";
      const mkRotBtn = (label, delta) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText = "flex:1;background:#1a3a5a;border:1px solid #4af;color:#4af;font-size:11px;padding:4px;cursor:pointer;border-radius:3px;font-family:inherit";
        b.onclick = () => {
          ring.angle = (((ring.angle ?? 0) + delta * Math.PI / 180) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          angleInp.value = String(Math.round(ring.angle * 180 / Math.PI));
          drawMap();
          notifyWorkbench();
          broadcastPreview();
        };
        return b;
      };
      rotRow.append(mkRotBtn("\u21BA \u221215\xB0", -15), mkRotBtn("\u21BB +15\xB0", 15));
      popup.appendChild(rotRow);
      const delBtn = document.createElement("button");
      delBtn.textContent = "\u{1F5D1} Ring l\xF6schen";
      delBtn.style.cssText = "width:100%;background:#3a1a1a;border:1px solid #f55;color:#f55;font-size:11px;padding:5px;cursor:pointer;border-radius:3px;font-family:inherit;margin-top:6px";
      delBtn.onclick = () => {
        m.objects.splice(idx, 1);
        const mAny = m;
        if (!m.objects.some((o) => o.type === "ring") && mAny.objectives)
          mAny.objectives = mAny.objectives.filter((o) => o.type !== "ring_all");
        hidePopup();
        renderObjectList();
        drawMap();
        notifyWorkbench();
        broadcastPreview();
      };
      popup.appendChild(delBtn);
      const vw = window.innerWidth, vh = window.innerHeight;
      popup.style.left = Math.min(cx + 6, vw - 190) + "px";
      popup.style.top = Math.min(cy + 6, vh - 200) + "px";
      popup.style.display = "block";
    };
    document.addEventListener("mousedown", (e) => {
      if (!popup.contains(e.target)) hidePopup();
    });
    getEl("btn-add-mission").onclick = () => {
      state.campaign.push(createEmptyMission());
      loadMission(state.campaign.length - 1);
    };
    getEl("btn-copy-mission").onclick = () => {
      const copy = JSON.parse(JSON.stringify(getCurrentMission()));
      copy.headline += " (Kopie)";
      state.campaign.push(copy);
      loadMission(state.campaign.length - 1);
    };
    const scaleInput = document.getElementById("foliage-scale");
    const scaleVal = document.getElementById("foliage-scale-val");
    if (scaleInput && scaleVal)
      scaleInput.oninput = () => {
        scaleVal.innerText = scaleInput.value;
      };
    const clearFoliageBtn = document.getElementById("btn-clear-foliage");
    if (clearFoliageBtn) {
      clearFoliageBtn.onclick = () => {
        const m = getCurrentMission();
        if (!m || !confirm("Alle B\xE4ume l\xF6schen?")) return;
        m.foliage = [];
        renderFoliageList();
        drawMap();
        broadcastPreview();
      };
    }
    document.querySelectorAll('input[name="tool"]').forEach((el) => {
      el.onchange = (e) => {
        state.currentTool = e.target.value;
        const foliageBar = getEl("foliage-type-bar");
        if (foliageBar) foliageBar.style.display = state.currentTool === "foliage" ? "block" : "none";
        updateCursor();
      };
    });
    document.querySelectorAll('input[name="brush"]').forEach((el) => {
      el.onchange = (e) => {
        const val = e.target.value;
        if (val === "custom") {
          state.isCustomBrush = true;
          state.brushRadius = parseFloat(getInput("m_custom_brush").value) || 8;
        } else {
          state.isCustomBrush = false;
          state.brushRadius = parseFloat(val);
        }
        updateCursor();
      };
    });
    getInput("m_custom_brush").oninput = () => {
      if (state.isCustomBrush) {
        state.brushRadius = parseFloat(getInput("m_custom_brush").value) || 8;
        updateCursor();
      }
    };
    getEl("btn-zoom-in").onclick = () => {
      state.zoom = Math.min(15, state.zoom + 0.5);
      clampCamera();
      drawMap();
    };
    getEl("btn-zoom-out").onclick = () => {
      state.zoom = Math.max(1, state.zoom - 0.5);
      clampCamera();
      drawMap();
    };
    getEl("btn-resize-map").onclick = () => {
      const m = getCurrentMission();
      if (!m) return;
      const newSize = parseInt(getInput("m_grid_size").value);
      const oldT = m.terrain;
      m.terrain = Array.from(
        { length: newSize + 1 },
        (_, x) => Array.from({ length: newSize + 1 }, (_2, y) => x <= m.gridSize && y <= m.gridSize ? oldT[x][y] : -1)
      );
      m.gridSize = newSize;
      clampCamera();
      drawMap();
      broadcastPreview();
    };
    const safeClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };
    safeClick("close-wind", () => {
      state.selectedUI = null;
      drawMap();
    });
    safeClick("close-carrier", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-pad", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-boat", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-submarine", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-wt", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-plane-wreck", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-sailboat-broken", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-ornithopter-wreck", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-baywatch-car", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-baywatch-hq", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-baywatch-tower", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-concert-stage", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-festival-tent", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-festival-tent-broken", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-festival-car", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-xmas-house", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-xmas-lantern", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-sleigh", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    safeClick("close-reindeer", () => {
      state.selectedObjectIdx = null;
      drawMap();
    });
    const wireAngle = (inputId, types) => {
      document.getElementById(inputId)?.addEventListener("input", () => {
        const m = getCurrentMission();
        if (!m || state.selectedObjectIdx === null) return;
        const obj = m.objects[state.selectedObjectIdx];
        if (!types.includes(obj?.type)) return;
        obj.angle = parseInt(document.getElementById(inputId).value) || 0;
        drawMap();
        broadcastPreview();
        notifyWorkbench();
      });
    };
    wireAngle("m_bwc_angle", ["baywatch_car"]);
    wireAngle("m_tent_angle", ["festival_tent"]);
    wireAngle("m_tent_broken_angle", ["festival_tent_broken"]);
    wireAngle("m_fcar_angle", ["festival_car"]);
    wireAngle("m_pw_angle", ["plane_wreck"]);
    wireAngle("m_sb_angle", ["sailboat_broken"]);
    wireAngle("m_ow_angle", ["ornithopter_wreck"]);
    wireAngle("m_xmas_house_angle", ["xmas_house_a", "xmas_house_b"]);
    wireAngle("m_xmas_lantern_angle", ["xmas_lantern"]);
    wireAngle("m_sleigh_angle", ["sleigh"]);
    wireAngle("m_reindeer_angle", ["reindeer"]);
    const wireTypeSelect = (selectId, types, useStartsWith = false) => {
      document.getElementById(selectId)?.addEventListener("change", () => {
        const m = getCurrentMission();
        if (!m || state.selectedObjectIdx === null) return;
        const obj = m.objects[state.selectedObjectIdx];
        const match = useStartsWith ? types.some((t) => obj?.type?.startsWith(t)) : types.includes(obj?.type);
        if (!match) return;
        const v = document.getElementById(selectId).value;
        if (v !== "random") obj.type = v;
        drawMap();
        broadcastPreview();
        notifyWorkbench();
      });
    };
    const wireColorVariant = (selectId, type) => {
      document.getElementById(selectId)?.addEventListener("change", () => {
        const m = getCurrentMission();
        if (!m || state.selectedObjectIdx === null) return;
        const obj = m.objects[state.selectedObjectIdx];
        if (obj?.type !== type) return;
        const v = document.getElementById(selectId).value;
        if (v === "random") return;
        if (v === "") delete obj.colorVariant;
        else obj.colorVariant = v;
        drawMap();
        broadcastPreview();
        notifyWorkbench();
      });
    };
    wireColorVariant("m_tent_color", "festival_tent");
    wireColorVariant("m_tent_broken_color", "festival_tent_broken");
    wireColorVariant("m_fcar_color", "festival_car");
    wireTypeSelect("m_xmas_house_type", ["xmas_house_a", "xmas_house_b"]);
    document.getElementById("m_wt_spinning")?.addEventListener("change", () => {
      const m = getCurrentMission();
      if (!m || state.selectedObjectIdx === null) return;
      const obj = m.objects[state.selectedObjectIdx];
      if (obj?.type !== "wind_turbine") return;
      obj.spinning = document.getElementById("m_wt_spinning").checked;
      drawMap();
      broadcastPreview();
    });
    safeClick("btn_spawn_pad", () => {
      getCurrentMission().spawnObject = "pad";
      drawMap();
    });
    safeClick("btn_spawn_carrier", () => {
      getCurrentMission().spawnObject = "carrier";
      drawMap();
    });
    ["carrier_path", "carrier_speed", "carrier_radius", "carrier_angle", "carrier_name"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("carrier"))
    );
    document.getElementById("m_carrier_exitWarning")?.addEventListener("change", () => syncVesselFromUI("carrier"));
    document.getElementById("m_carrier_radioSilent")?.addEventListener("change", () => syncVesselFromUI("carrier"));
    ["boat_path", "boat_speed", "boat_radius", "boat_angle", "boat_name"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("boat"))
    );
    document.getElementById("m_boat_exitWarning")?.addEventListener("change", () => syncVesselFromUI("boat"));
    document.getElementById("m_boat_radioSilent")?.addEventListener("change", () => syncVesselFromUI("boat"));
    ["submarine_path", "submarine_speed", "submarine_radius", "submarine_angle", "submarine_name"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("submarine"))
    );
    document.getElementById("m_submarine_exitWarning")?.addEventListener("change", () => syncVesselFromUI("submarine"));
    [
      "m_headline_de",
      "m_headline_en",
      "m_briefing_de",
      "m_briefing_en",
      "m_rain",
      "m_snow",
      "m_night",
      "m_water_level",
      "m_max_time",
      "m_heli_override",
      "m_wind_dir",
      "m_wind_str",
      "m_wind_var",
      "m_npc_heli_count",
      "m_npc_heli_type",
      "m_sublines_de",
      "m_sublines_en"
    ].forEach((id) => getEl(id)?.addEventListener("input", syncToData));
    const canvas = getEl("editorCanvas");
    const cursorEl = document.createElement("canvas");
    cursorEl.id = "brush-cursor";
    cursorEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:none;";
    document.body.appendChild(cursorEl);
    const cursorCtx = cursorEl.getContext("2d");
    const PAINT_TOOLS = /* @__PURE__ */ new Set(["terrain", "flatten", "foliage", "sand", "pavement"]);
    const POINT_TOOLS = /* @__PURE__ */ new Set([
      "pad",
      "carrier",
      "boat",
      "pilot_boat",
      "sar_boat",
      "salvage_tug",
      "supply_vessel",
      "frigate",
      "submarine",
      "lighthouse",
      "research_platform",
      "wind_turbine",
      "plane_wreck",
      "sailboat_broken",
      "ornithopter_wreck",
      "baywatch_car",
      "baywatch_hq",
      "baywatch_tower",
      "concert_stage",
      "festival_tent",
      "festival_tent_broken",
      "festival_car",
      "buoy",
      "xmas_house",
      "xmas_lantern",
      "sleigh",
      "reindeer",
      "person",
      "rescuer",
      "crate"
    ]);
    const dotColors = {
      pad: "#5f5",
      carrier: "#88aaff",
      boat: "#4af",
      submarine: "#888",
      frigate: "#6688bb",
      lighthouse: "#ffdd44",
      plane_wreck: "#aaa",
      sailboat_broken: "#b96",
      ornithopter_wreck: "#aaa",
      baywatch_car: "#cc2200",
      baywatch_hq: "#cc4400",
      baywatch_tower: "#cc4400",
      concert_stage: "#aa44ff",
      festival_tent: "#2266cc",
      festival_tent_broken: "#6688aa",
      festival_car: "#9aabb5",
      buoy: "#dd3300",
      xmas_house_a: "#aaddff",
      xmas_house_b: "#88bbee",
      xmas_lantern: "#ffdd44",
      sleigh: "#cc3333",
      reindeer: "#8b5228",
      person: "#ffe033",
      crate: "#ff8800"
    };
    const updateCursor = () => {
      const m = getCurrentMission();
      if (!m) return;
      const tool = state.currentTool;
      if (tool === "move") {
        cursorEl.style.display = "none";
        canvas.style.cursor = "grab";
        return;
      }
      canvas.style.cursor = "none";
      cursorEl.style.display = "block";
      if (PAINT_TOOLS.has(tool)) {
        const radiusPx = state.brushRadius * isoHW();
        const size = Math.ceil(radiusPx * 2 + 8);
        cursorEl.width = size;
        cursorEl.height = size;
        cursorCtx.clearRect(0, 0, size, size);
        cursorCtx.beginPath();
        cursorCtx.arc(size / 2, size / 2, radiusPx, 0, Math.PI * 2);
        cursorCtx.strokeStyle = "rgba(255,255,255,0.85)";
        cursorCtx.lineWidth = 1.5;
        cursorCtx.stroke();
        cursorCtx.beginPath();
        cursorCtx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
        cursorCtx.fillStyle = "rgba(255,255,255,0.9)";
        cursorCtx.fill();
        cursorCtx.beginPath();
        cursorCtx.arc(size / 2, size / 2, radiusPx, 0, Math.PI * 2);
        cursorCtx.fillStyle = tool === "flatten" ? "rgba(100,200,255,0.08)" : tool === "foliage" ? "rgba(50,200,50,0.1)" : tool === "sand" ? "rgba(212,180,80,0.12)" : tool === "pavement" ? "rgba(130,130,145,0.18)" : "rgba(255,160,0,0.08)";
        cursorCtx.fill();
      } else if (POINT_TOOLS.has(tool)) {
        const size = 32;
        cursorEl.width = size;
        cursorEl.height = size;
        cursorCtx.clearRect(0, 0, size, size);
        cursorCtx.strokeStyle = "rgba(255,255,255,0.9)";
        cursorCtx.lineWidth = 1.5;
        cursorCtx.beginPath();
        cursorCtx.moveTo(size / 2, 0);
        cursorCtx.lineTo(size / 2, size);
        cursorCtx.moveTo(0, size / 2);
        cursorCtx.lineTo(size, size / 2);
        cursorCtx.stroke();
        cursorCtx.beginPath();
        cursorCtx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
        cursorCtx.fillStyle = dotColors[tool] || "#fff";
        cursorCtx.fill();
      }
    };
    canvas.addEventListener("mousemove", (e) => {
      const size = parseInt(cursorEl.width) || 32;
      cursorEl.style.left = e.clientX - size / 2 + "px";
      cursorEl.style.top = e.clientY - size / 2 + "px";
      updateCursor();
    });
    canvas.addEventListener("mouseenter", () => {
      if (state.currentTool !== "move") {
        cursorEl.style.display = "block";
        updateCursor();
      }
    });
    canvas.addEventListener("mouseleave", () => {
      cursorEl.style.display = "none";
    });
    const updateMoveCursor = () => {
      if (state.moveMode) {
        canvas.style.cursor = "crosshair";
        cursorEl.style.display = "none";
      } else {
        updateCursor();
      }
    };
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "m" || e.key === "M") {
        if (state.selectedObjectIdx !== null || state.selectedPayloadIdx !== null) {
          state.moveMode = !state.moveMode;
          updateMoveCursor();
          drawMap();
        }
      }
      const PAN_STEP = 1.5;
      if (e.key === "ArrowLeft") {
        state.panX -= PAN_STEP;
        state.panY += PAN_STEP;
        clampCamera();
        drawMap();
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        state.panX += PAN_STEP;
        state.panY -= PAN_STEP;
        clampCamera();
        drawMap();
        e.preventDefault();
      }
      if (e.key === "ArrowUp") {
        state.panX -= PAN_STEP;
        state.panY -= PAN_STEP;
        clampCamera();
        drawMap();
        e.preventDefault();
      }
      if (e.key === "ArrowDown") {
        state.panX += PAN_STEP;
        state.panY += PAN_STEP;
        clampCamera();
        drawMap();
        e.preventDefault();
      }
      if (e.key === "Escape") {
        if (state.isDraggingItem) {
          const m = getCurrentMission();
          if (state.dragItemType === "payload")
            Object.assign(m.payloads[state.dragItemIdx], { x: state.dragOrigX, y: state.dragOrigY });
          else if (state.dragItemType === "object")
            Object.assign(m.objects[state.dragItemIdx], { x: state.dragOrigX, y: state.dragOrigY });
          state.isDraggingItem = false;
          state.dragItemType = null;
          state.dragItemIdx = null;
          state.dragHasMoved = false;
        }
        hidePopup();
        state.moveMode = false;
        state.selectedObjectIdx = null;
        state.selectedPayloadIdx = null;
        updateMoveCursor();
        drawMap();
      }
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    const ctxMenu = document.getElementById("ed-ctx-menu");
    let _ctxGx = 0, _ctxGy = 0;
    const hideCtxMenu = () => {
      if (ctxMenu) ctxMenu.style.display = "none";
    };
    const _placeItem = (type, gx, gy) => {
      const m = getCurrentMission();
      if (!m) return;
      const mAny = m;
      const _vesselBase = (t) => ({ type: t, x: gx, y: gy, angle: 0, path: "static", speed: 0, radius: 20 });
      switch (type) {
        case "pad": {
          const ei = m.objects.findIndex((o) => o.type === "pad");
          const n = { type: "pad", x: gx, y: gy };
          if (ei >= 0) m.objects[ei] = n;
          else m.objects.push(n);
          break;
        }
        case "lighthouse": {
          const ei = m.objects.findIndex((o) => o.type === "lighthouse");
          const n = { type: "lighthouse", x: gx, y: gy };
          if (ei >= 0) m.objects[ei] = n;
          else m.objects.push(n);
          break;
        }
        case "carrier": {
          const ei = m.objects.findIndex((o) => o.type === "carrier");
          const n = ei >= 0 ? { ...m.objects[ei], x: gx, y: gy } : { type: "carrier", x: gx, y: gy, angle: 0, path: "circle", speed: 5, radius: 40 };
          if (ei >= 0) m.objects[ei] = n;
          else m.objects.push(n);
          break;
        }
        case "research_platform":
          m.objects.push({ type: "research_platform", x: gx, y: gy });
          break;
        case "wind_turbine":
          m.objects.push({ type: "wind_turbine", x: gx, y: gy });
          break;
        case "plane_wreck":
          m.objects.push({ type: "plane_wreck", x: gx, y: gy, angle: 0 });
          break;
        case "sailboat_broken":
          m.objects.push({ type: "sailboat_broken", x: gx, y: gy, angle: 0 });
          break;
        case "ornithopter_wreck":
          m.objects.push({ type: "ornithopter_wreck", x: gx, y: gy, angle: 0 });
          break;
        case "baywatch_car":
          m.objects.push({ type: "baywatch_car", x: gx, y: gy, angle: 0 });
          break;
        case "baywatch_hq":
          m.objects.push({ type: "baywatch_hq", x: gx, y: gy });
          break;
        case "baywatch_tower":
          m.objects.push({ type: "baywatch_tower", x: gx, y: gy });
          break;
        case "concert_stage":
          m.objects.push({ type: "concert_stage", x: gx, y: gy });
          break;
        case "festival_tent": {
          const _tcs = document.getElementById("m_tent_color")?.value;
          const _tv = _tcs && _tcs !== "random" ? _tcs : ["", "red", "green"][Math.floor(Math.random() * 3)];
          const _to = { type: "festival_tent", x: gx, y: gy, angle: 0 };
          if (_tv) _to.colorVariant = _tv;
          m.objects.push(_to);
          break;
        }
        case "festival_tent_broken": {
          const _tbcs = document.getElementById("m_tent_broken_color")?.value;
          const _tbv = _tbcs && _tbcs !== "random" ? _tbcs : ["", "red", "green"][Math.floor(Math.random() * 3)];
          const _tbo = { type: "festival_tent_broken", x: gx, y: gy, angle: 0 };
          if (_tbv) _tbo.colorVariant = _tbv;
          m.objects.push(_tbo);
          break;
        }
        case "festival_car": {
          const _fcs = document.getElementById("m_fcar_color")?.value ?? "";
          const _fco = { type: "festival_car", x: gx, y: gy, angle: 0 };
          if (_fcs) _fco.colorVariant = _fcs;
          m.objects.push(_fco);
          break;
        }
        case "boat":
          m.objects.push({ ..._vesselBase("boat"), speed: 3 });
          break;
        case "pilot_boat":
          m.objects.push(_vesselBase("pilot_boat"));
          break;
        case "sar_boat":
          m.objects.push({ ..._vesselBase("sar_boat"), speed: 3 });
          break;
        case "salvage_tug":
          m.objects.push(_vesselBase("salvage_tug"));
          break;
        case "supply_vessel":
          m.objects.push(_vesselBase("supply_vessel"));
          break;
        case "frigate":
          m.objects.push({ ..._vesselBase("frigate"), speed: 3 });
          break;
        case "submarine":
          m.objects.push(_vesselBase("submarine"));
          break;
        case "person":
        case "rescuer":
        case "crate":
          if (!m.payloads) m.payloads = [];
          m.payloads.push(makePayload(type, gx, gy, m));
          renderPayloadList();
          break;
        case "smoke":
        case "fire":
          if (!mAny.particleEmitters) mAny.particleEmitters = [];
          mAny.particleEmitters.push({ type, x: gx, y: gy });
          break;
        case "ring":
          m.objects.push({ type: "ring", x: gx, y: gy, z: 4, radius: 2.5, angle: 0 });
          if (!mAny.objectives) mAny.objectives = [];
          if (!mAny.objectives.some((o) => o.type === "ring_all"))
            mAny.objectives.push({ type: "ring_all" });
          break;
      }
      renderObjectList();
      drawMap();
      notifyWorkbench();
      broadcastPreview();
    };
    if (ctxMenu) {
      const _CTX_GROUPS = [
        { cat: "Stat.", emoji: "\u{1F3D7}", items: [
          { v: "pad", l: "\u{1F7E9} Landepad" },
          { v: "lighthouse", l: "\u{1F526} Leuchtturm" },
          { v: "research_platform", l: "\u{1F3D7} Plattform" },
          { v: "ring", l: "\u2B55 Ring" }
        ] },
        { cat: "Fahr.", emoji: "\u{1F6A2}", items: [
          { v: "carrier", l: "\u{1F6A2} Tr\xE4ger" },
          { v: "boat", l: "\u26F5 Boot" },
          { v: "pilot_boat", l: "\u{1F6A4} Lotsenboot" },
          { v: "sar_boat", l: "\u{1F6E5} SAR-Boot" },
          { v: "salvage_tug", l: "\u{1F6F3} Schlepper" },
          { v: "supply_vessel", l: "\u{1F6A2} Versorgungsschiff" },
          { v: "frigate", l: "\u2693 Fregatte" },
          { v: "submarine", l: "\u{1F93F} U-Boot" }
        ] },
        { cat: "Deko", emoji: "\u{1F300}", items: [
          { v: "wind_turbine", l: "\u{1F300} Windrad" },
          { v: "plane_wreck", l: "\u2708\uFE0F Wrack" },
          { v: "sailboat_broken", l: "\u26F5 Segel (gek.)" },
          { v: "ornithopter_wreck", l: "\u{1F6F8} Orni-Wrack" },
          { v: "baywatch_car", l: "\u{1F697} BW-Auto" },
          { v: "baywatch_hq", l: "\u{1F3E0} BW-HQ" },
          { v: "baywatch_tower", l: "\u{1F5FC} Wachturm" },
          { v: "buoy", l: "\u{1F534} Boje" },
          { v: "concert_stage", l: "\u{1F3B8} B\xFChne" },
          { v: "festival_tent", l: "\u{1F3AA} Zelt" },
          { v: "festival_tent_broken", l: "\u{1F3AA} Zelt (kap.)" },
          { v: "festival_car", l: "\u{1F699} Festival-Auto" }
        ] },
        { cat: "Load", emoji: "\u{1F4E6}", items: [
          { v: "person", l: "\u{1F7E1} Person" },
          { v: "rescuer", l: "\u{1F535} Retter" },
          { v: "crate", l: "\u{1F7E0} Crate" }
        ] },
        { cat: "Ptcl", emoji: "\u2728", items: [
          { v: "smoke", l: "\u{1F4A8} Rauch" },
          { v: "fire", l: "\u{1F525} Feuer + Rauch" }
        ] }
      ];
      let _ctxTabIdx = 0;
      const renderCtxMenuContent = () => {
        const tabBar = ctxMenu.querySelector(".ctx-tabs");
        ctxMenu.innerHTML = "";
        const tabs = document.createElement("div");
        tabs.className = "ctx-tabs";
        tabs.style.cssText = "display:flex;border-bottom:1px solid #3a3a3a;background:#111";
        _CTX_GROUPS.forEach((g, gi) => {
          const t = document.createElement("button");
          t.textContent = g.cat;
          const isAct = gi === _ctxTabIdx;
          t.style.cssText = `flex:1;background:${isAct ? "#1a3a5a" : "none"};border:none;border-bottom:2px solid ${isAct ? "#4af" : "transparent"};color:${isAct ? "#4af" : "#888"};font-size:9px;padding:6px 2px 4px;cursor:pointer;font-family:inherit`;
          t.onmouseenter = () => {
            if (gi !== _ctxTabIdx) t.style.color = "#ccc";
          };
          t.onmouseleave = () => {
            if (gi !== _ctxTabIdx) t.style.color = "#888";
          };
          t.onclick = (ev) => {
            ev.stopPropagation();
            _ctxTabIdx = gi;
            renderCtxMenuContent();
          };
          tabs.appendChild(t);
        });
        ctxMenu.appendChild(tabs);
        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:6px";
        _CTX_GROUPS[_ctxTabIdx].items.forEach((item) => {
          const btn = document.createElement("button");
          btn.textContent = item.l;
          btn.style.cssText = "background:#1e1e1e;border:1px solid #3a3a3a;color:#ccc;font-size:11px;padding:5px 4px;cursor:pointer;border-radius:3px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
          btn.title = item.l.replace(/^.+? /, "");
          btn.onmouseenter = () => {
            btn.style.background = "#1a3a5a";
            btn.style.borderColor = "#4af";
            btn.style.color = "#fff";
          };
          btn.onmouseleave = () => {
            btn.style.background = "#1e1e1e";
            btn.style.borderColor = "#3a3a3a";
            btn.style.color = "#ccc";
          };
          btn.onclick = (ev) => {
            ev.stopPropagation();
            _placeItem(item.v, _ctxGx, _ctxGy);
            hideCtxMenu();
          };
          grid.appendChild(btn);
        });
        ctxMenu.appendChild(grid);
        if (tabBar) void tabBar;
      };
      renderCtxMenuContent();
      document.addEventListener("mousedown", (ev) => {
        if (!ctxMenu.contains(ev.target)) hideCtxMenu();
      });
      canvas.addEventListener("dblclick", (ev) => {
        const m = getCurrentMission();
        if (!m) return;
        const rect = canvas.getBoundingClientRect();
        const { gx: _cg, gy: _cd } = screenToGrid(ev.clientX - rect.left, ev.clientY - rect.top);
        _ctxGx = Math.floor(_cg);
        _ctxGy = Math.floor(_cd);
        if (_ctxGx < 0 || _ctxGx >= m.gridSize || _ctxGy < 0 || _ctxGy >= m.gridSize) return;
        state.selectedObjectIdx = null;
        state.selectedPayloadIdx = null;
        state.isDraggingItem = false;
        drawMap();
        renderCtxMenuContent();
        ctxMenu.style.left = ev.clientX + "px";
        ctxMenu.style.top = ev.clientY + "px";
        ctxMenu.style.display = "block";
        setTimeout(() => {
          const r = ctxMenu.getBoundingClientRect();
          if (r.right > window.innerWidth) ctxMenu.style.left = ev.clientX - r.width + "px";
          if (r.bottom > window.innerHeight) ctxMenu.style.top = ev.clientY - r.height + "px";
        }, 0);
      });
    }
    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const m = getCurrentMission();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { gx, gy } = screenToGrid(mx, my);
      if (Math.hypot(mx - 50, my - 50) < 30) {
        state.selectedUI = state.selectedUI === "wind" ? null : "wind";
        state.selectedObjectIdx = null;
        drawMap();
        return;
      }
      if (state.moveMode) {
        if (state.selectedObjectIdx !== null) {
          const obj = m.objects[state.selectedObjectIdx];
          obj.x = Math.floor(gx);
          obj.y = Math.floor(gy);
          renderObjectList();
        } else if (state.selectedPayloadIdx !== null) {
          const p = m.payloads[state.selectedPayloadIdx];
          const snapped = makePayload(p.type, Math.floor(gx), Math.floor(gy), m);
          m.payloads[state.selectedPayloadIdx] = {
            ...snapped,
            ...p.deliverTo ? { deliverTo: p.deliverTo } : {},
            ...p.npcTarget ? { npcTarget: p.npcTarget } : {}
          };
          renderPayloadList();
        }
        state.moveMode = false;
        updateMoveCursor();
        drawMap();
        return;
      }
      if (!e.shiftKey) {
        const startDrag = (type, idx, ox, oy) => {
          hidePopup();
          state.isDraggingItem = true;
          state.dragItemType = type;
          state.dragItemIdx = idx;
          state.dragHasMoved = false;
          state.dragWasSelected = type === "payload" ? state.selectedPayloadIdx === idx : state.selectedObjectIdx === idx;
          state.dragStartMX = e.clientX;
          state.dragStartMY = e.clientY;
          state.dragOrigX = ox;
          state.dragOrigY = oy;
          if (type === "payload") {
            state.selectedPayloadIdx = idx;
            state.selectedObjectIdx = null;
          } else if (type === "object") {
            state.selectedObjectIdx = idx;
            state.selectedPayloadIdx = null;
          } else {
            state.selectedObjectIdx = null;
            state.selectedPayloadIdx = null;
          }
          state.selectedUI = null;
          drawMap();
        };
        const payloads = m.payloads || [];
        for (let i = 0; i < payloads.length; i++) {
          const p = payloads[i];
          if (Math.hypot(gx - p.x, gy - p.y) < 2) {
            startDrag("payload", i, p.x, p.y);
            return;
          }
        }
        for (let i = 0; i < m.objects.length; i++) {
          const obj = m.objects[i];
          let hit = false;
          if (obj.type === "pad") hit = gx >= obj.x && gx <= obj.x + 8 && gy >= obj.y && gy <= obj.y + 8;
          else if (["carrier", "boat", "pilot_boat", "sar_boat", "salvage_tug", "supply_vessel", "frigate", "submarine"].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 6;
          else if (["lighthouse", "research_platform", "wind_turbine"].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 2;
          else if ([
            "plane_wreck",
            "sailboat_broken",
            "ornithopter_wreck",
            "baywatch_car",
            "baywatch_hq",
            "baywatch_tower",
            "concert_stage",
            "festival_tent",
            "festival_tent_broken",
            "festival_car",
            "xmas_house_a",
            "xmas_house_b",
            "sleigh",
            "reindeer"
          ].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 3;
          else if (obj.type === "xmas_lantern")
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 2.5;
          else if (obj.type === "ring")
            hit = Math.hypot(gx - obj.x, gy - obj.y) < (obj.radius ?? 2.5) + 1;
          if (hit) {
            startDrag("object", i, obj.x, obj.y);
            return;
          }
        }
        const _mAny = m;
        if (_mAny.particleEmitters?.length) {
          for (let i = 0; i < _mAny.particleEmitters.length; i++) {
            const em = _mAny.particleEmitters[i];
            if (Math.hypot(gx - em.x, gy - em.y) < 2) {
              startDrag("emitter", i, em.x, em.y);
              return;
            }
          }
        }
      }
      if (e.shiftKey) {
        const SNAP = 5;
        const m2 = getCurrentMission();
        let nPDist = SNAP, nPIdx = -1;
        (m2.payloads || []).forEach((p, i) => {
          const d = Math.hypot(gx - p.x, gy - p.y);
          if (d < nPDist) {
            nPDist = d;
            nPIdx = i;
          }
        });
        if (nPIdx >= 0) {
          m2.payloads.splice(nPIdx, 1);
          renderPayloadList();
          drawMap();
          notifyWorkbench();
          return;
        }
        let nODist = SNAP, nOIdx = -1;
        m2.objects.forEach((o, i) => {
          const d = Math.hypot(gx - o.x, gy - o.y);
          if (d < nODist) {
            nODist = d;
            nOIdx = i;
          }
        });
        if (nOIdx >= 0) {
          m2.objects.splice(nOIdx, 1);
          if (state.selectedObjectIdx === nOIdx) state.selectedObjectIdx = null;
          renderObjectList();
          drawMap();
          notifyWorkbench();
          return;
        }
        const m2Any = m2;
        if (m2Any.particleEmitters?.length) {
          let nEDist = SNAP, nEIdx = -1;
          m2Any.particleEmitters.forEach((em, i) => {
            const d = Math.hypot(gx - em.x, gy - em.y);
            if (d < nEDist) {
              nEDist = d;
              nEIdx = i;
            }
          });
          if (nEIdx >= 0) {
            m2Any.particleEmitters.splice(nEIdx, 1);
            drawMap();
            notifyWorkbench();
            return;
          }
        }
      }
      state.selectedObjectIdx = null;
      state.selectedPayloadIdx = null;
      state.selectedUI = null;
      drawMap();
      if (state.currentTool === "move") {
        state.isEditorDragging = true;
        state.lastMX = e.clientX;
        state.lastMY = e.clientY;
        canvas.style.cursor = "grabbing";
      } else {
        state.isDrawing = true;
        paint(e);
      }
    };
    window.addEventListener("mousemove", (e) => {
      if (state.isDraggingItem) {
        if (Math.hypot(e.clientX - state.dragStartMX, e.clientY - state.dragStartMY) > 3) state.dragHasMoved = true;
        if (state.dragHasMoved) {
          const m = getCurrentMission();
          const rect = canvas.getBoundingClientRect();
          const { gx, gy } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
          if (state.dragItemType === "payload")
            Object.assign(m.payloads[state.dragItemIdx], { x: Math.round(gx), y: Math.round(gy) });
          else if (state.dragItemType === "object")
            Object.assign(m.objects[state.dragItemIdx], { x: Math.round(gx), y: Math.round(gy) });
          else if (state.dragItemType === "emitter") {
            const _em = m.particleEmitters?.[state.dragItemIdx];
            if (_em) Object.assign(_em, { x: Math.round(gx), y: Math.round(gy) });
          }
          canvas.style.cursor = "grabbing";
          drawMap();
        }
        return;
      }
      if (state.isEditorDragging) {
        const dx = e.clientX - state.lastMX;
        const dy = e.clientY - state.lastMY;
        const hw = isoHW(), hh = isoHH();
        state.panX -= (dx / hw + dy / hh) / 2;
        state.panY -= (dy / hh - dx / hw) / 2;
        state.lastMX = e.clientX;
        state.lastMY = e.clientY;
        clampCamera();
        drawMap();
      } else if (state.isDrawing) {
        if (state.currentTool !== "person" && state.currentTool !== "rescuer" && state.currentTool !== "crate" && state.currentTool !== "boat" && state.currentTool !== "pilot_boat" && state.currentTool !== "salvage_tug" && state.currentTool !== "supply_vessel" && state.currentTool !== "frigate" && state.currentTool !== "submarine" && state.currentTool !== "carrier" && state.currentTool !== "pad" && state.currentTool !== "lighthouse" && state.currentTool !== "research_platform" && state.currentTool !== "wind_turbine" && state.currentTool !== "plane_wreck" && state.currentTool !== "sailboat_broken" && state.currentTool !== "ornithopter_wreck" && state.currentTool !== "baywatch_car" && state.currentTool !== "baywatch_hq" && state.currentTool !== "baywatch_tower" && state.currentTool !== "concert_stage" && state.currentTool !== "festival_car" && state.currentTool !== "foliage") {
          paint(e);
        }
      }
    });
    window.addEventListener("mouseup", () => {
      if (state.isDraggingItem) {
        if (state.dragHasMoved) {
          const m = getCurrentMission();
          if (state.dragItemType === "payload") {
            const p = m.payloads[state.dragItemIdx];
            const snapped = makePayload(p.type, p.x, p.y, m);
            m.payloads[state.dragItemIdx] = {
              ...snapped,
              ...p.deliverTo ? { deliverTo: p.deliverTo } : {},
              ...p.npcTarget ? { npcTarget: p.npcTarget } : {}
            };
            renderPayloadList();
          } else if (state.dragItemType === "emitter") {
            notifyWorkbench();
            broadcastPreview();
          } else {
            renderObjectList();
          }
          notifyWorkbench();
          broadcastPreview();
        } else if (state.dragWasSelected) {
          state.selectedPayloadIdx = null;
          state.selectedObjectIdx = null;
          hidePopup();
        } else if (!state.dragHasMoved && state.dragItemType === "payload" && state.dragItemIdx !== null) {
          showPayloadPopup(state.dragItemIdx, state.dragStartMX, state.dragStartMY);
        } else if (!state.dragHasMoved && state.dragItemType === "object" && state.dragItemIdx !== null) {
          const clickedObj = getCurrentMission()?.objects[state.dragItemIdx];
          if (clickedObj?.type === "ring")
            showRingPopup(state.dragItemIdx, state.dragStartMX, state.dragStartMY);
        }
        state.isDraggingItem = false;
        state.dragItemType = null;
        state.dragItemIdx = null;
        state.dragHasMoved = false;
        updateCursor();
        drawMap();
        return;
      }
      if (state.isDrawing) {
        state.isDrawing = false;
        broadcastPreview();
      }
      if (state.isEditorDragging) {
        state.isEditorDragging = false;
        updateCursor();
      }
    });
    canvas.onwheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { gx, gy } = screenToGrid(mx, my);
      const oldZoom = state.zoom;
      const factor = e.shiftKey ? 0.08 : 0.12;
      state.zoom = Math.max(0.2, Math.min(state.zoom * Math.exp(-e.deltaY * factor * 0.01), 20));
      if (state.zoom !== oldZoom) {
        const hw = isoHW(), hh = isoHH();
        const cx = canvas.width / 2, cy = canvas.height * 0.35;
        const A = (cx - mx) / hw + (gx - gy);
        const B = (cy - my) / hh + (gx + gy);
        state.panX = (A + B) / 2;
        state.panY = (B - A) / 2;
        clampCamera();
        drawMap();
      }
    };
    getEl("btn-export-campaign").onclick = () => {
      const savedIdx = state.curIdx;
      const data = state.campaign.map((m, i) => {
        const mAny = m;
        if (mAny.terrainRef !== void 0) {
          const { terrain, gridSize, sand, pavement, foliage, ...rest } = { ...mAny };
          return { ...rest, terrainRef: mAny.terrainRef };
        }
        state.curIdx = i;
        return {
          ...m,
          terrain: typeof m.terrain === "string" ? m.terrain : compressTerrain(m.terrain),
          foliage: compressFoliage(
            typeof mAny.foliage === "string" ? decompressFoliage(mAny.foliage) : mAny.foliage || []
          ),
          ...mAny.sand ? { sand: compressTerrain(mAny.sand) } : {},
          ...mAny.pavement ? { pavement: compressTerrain(mAny.pavement) } : {}
        };
      });
      state.curIdx = savedIdx;
      const cSubDe = getEl("c_sublines_de").value.split("\n").filter((l) => l.trim());
      const cSubEn = getEl("c_sublines_en").value.split("\n").filter((l) => l.trim());
      const exportData = {
        type: getEl("c_type").value || "CSW_CAMPAIGN",
        campaignTitle: { de: getInput("c_title_de").value, en: getInput("c_title_en").value },
        campaignSublines: cSubDe.map((de, i) => ({ de, en: cSubEn[i] || "" })),
        levels: data
      };
      getEl("output").value = JSON.stringify(exportData);
      alert("Kampagne exportiert!");
    };
    getEl("btn-import-campaign").onclick = () => {
      const raw = getEl("output").value;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const ct = parsed.campaignTitle;
        getInput("c_title_de").value = ct ? typeof ct === "string" ? ct : ct.de || "" : "Imported Campaign";
        getInput("c_title_en").value = ct && typeof ct !== "string" ? ct.en || "" : "";
        const cs = parsed.campaignSublines || [];
        getEl("c_sublines_de").value = cs.map((s) => typeof s === "string" ? s : s.de || "").join("\n");
        getEl("c_sublines_en").value = cs.map((s) => typeof s === "string" ? "" : s.en || "").join("\n");
        getEl("c_type").value = parsed.type || "CSW_CAMPAIGN";
        state.type = parsed.type;
        state.campaign = parsed.levels.map((m) => {
          if (m.terrainRef !== void 0) {
            return { ...m, terrain: [], gridSize: 0 };
          }
          const base = {
            ...m,
            terrain: typeof m.terrain === "string" ? decompressTerrain(m.terrain, m.gridSize) : m.terrain,
            foliage: typeof m.foliage === "string" ? decompressFoliage(m.foliage) : m.foliage || [],
            ...m.sand ? { sand: decompressTerrain(m.sand, m.gridSize) } : {},
            ...m.pavement ? { pavement: decompressTerrain(m.pavement, m.gridSize) } : {}
          };
          delete base.previewBase64;
          return base;
        });
        state.campaign.forEach((m) => {
          if (m.terrainRef !== void 0) {
            const src = state.campaign[m.terrainRef];
            if (src) {
              m.terrain = src.terrain;
              m.gridSize = src.gridSize;
              if (src.sand) m.sand = src.sand;
              if (src.pavement) m.pavement = src.pavement;
            }
          }
        });
        loadMission(0);
      } catch (e) {
        alert("Import Fehler!\n\n" + e);
      }
    };
    initIsoCanvas();
  };

  // editor-view-entry/campaign-editor-main.ts
  var vscode = acquireVsCodeApi();
  var styleEl = document.createElement("style");
  styleEl.textContent = style_default;
  document.head.appendChild(styleEl);
  var notifyTimer = null;
  var isLoading = true;
  var _isTutorial = false;
  var doExport = () => {
    const origAlert = window.alert;
    window.alert = () => {
    };
    document.getElementById("btn-export-campaign").click();
    window.alert = origAlert;
    return document.getElementById("output").value || null;
  };
  var doImport = (content) => {
    document.getElementById("output").value = content;
    document.getElementById("btn-import-campaign").click();
  };
  var scheduleNotify = () => {
    window.__onEditorStateChanged?.();
    if (_isTutorial && state.curIdx === 0) {
      loadMission(1);
      return;
    }
    if (notifyTimer) clearTimeout(notifyTimer);
    if (isLoading) return;
    vscode.postMessage({ type: "missionIndex", value: state.curIdx });
    notifyTimer = setTimeout(() => {
      const content = doExport();
      if (content) vscode.postMessage({ type: "change", content });
    }, 400);
  };
  setOnStateChanged(scheduleNotify);
  initUI();
  loadMission(0);
  window.addEventListener("message", (e) => {
    if (e.data.type === "load" && e.data.content !== void 0) {
      let campaignType = "";
      try {
        campaignType = JSON.parse(e.data.content).type ?? "";
      } catch {
      }
      _isTutorial = campaignType === "tutorial";
      doImport(e.data.content);
      isLoading = false;
      setTimeout(() => window.__onEditorStateChanged?.(), 100);
    }
  });
  vscode.postMessage({ type: "ready" });
  window.__editor = { state, getCurrentMission: () => state.campaign[state.curIdx], loadMission, syncToData, renderPayloadList, renderObjectList, renderFoliageList };
  window.__editorUtils = { compressTerrain, compressFoliage, decompressFoliage, decompressTerrain };
})();
//# sourceMappingURL=campaign-editor.js.map
