"use strict";
(() => {
  // editor-view/style.css
  var style_default = "/* src/editor/style.css */\n:root {\n    --accent: #5f5;\n    --bg: #181818;\n}\n\nbody {\n    background: var(--bg);\n    color: #fff;\n    font-family: monospace;\n    margin: 0;\n    overflow: auto;\n}\n\ncanvas {\n    display: block;\n    image-rendering: pixelated;\n}\n\n/* \u2500\u2500 Canvas containers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.canvas-container {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n}\n\n.canvas-header {\n    background: #111;\n    color: var(--accent);\n    border: 2px solid var(--accent);\n    border-bottom: none;\n    padding: 5px 10px;\n    box-sizing: border-box;\n    font-weight: bold;\n    font-size: 12px;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n}\n.header-2d { width: 604px; }\n.header-3d { width: 504px; }\n.canvas-hint { font-size: 10px; color: #aaa; font-weight: normal; }\n\n.editor-wrapper {\n    position: relative;\n    width: 600px;\n    height: 600px;\n    overflow: hidden;\n    border: 2px solid var(--accent);\n    background: #002244;\n    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);\n}\n\n/* Hide the native cursor on the editor canvas \u2014 replaced by JS custom cursor */\n#editorCanvas { cursor: none; }\n\n#previewCanvas {\n    border: 2px solid var(--accent);\n    background: #001122;\n    cursor: grab;\n}\n#previewCanvas:active { cursor: grabbing; }\n\n/* \u2500\u2500 Floating UI panels (Wind, Carrier, Pad, Boat) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.floating-ui {\n    position: absolute;\n    background: rgba(10, 10, 10, 0.95);\n    border: 1px solid var(--accent);\n    padding: 12px;\n    font-size: 12px;\n    color: #fff;\n    border-radius: 4px;\n    z-index: 100;\n    backdrop-filter: blur(8px);\n    display: none;\n    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.8);\n}\n.floating-ui input,\n.floating-ui select {\n    background: #000;\n    color: var(--accent);\n    border: 1px solid #444;\n    font-family: monospace;\n    margin: 2px 0;\n}\n.close-btn {\n    float: right;\n    cursor: pointer;\n    color: #f55;\n    font-weight: bold;\n    font-size: 16px;\n    margin-top: -5px;\n}\n";

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
  var canvas = document.getElementById("editorCanvas");
  var ctx = canvas.getContext("2d");
  var drawMap = () => {
    const m = getCurrentMission();
    if (!m) return;
    ctx.clearRect(0, 0, 600, 600);
    const tSize = 600 / m.gridSize * state.zoom;
    const pUI = document.getElementById("ui_pad");
    const cUI = document.getElementById("ui_carrier");
    const bUI = document.getElementById("ui_boat");
    const sUI = document.getElementById("ui_submarine");
    const wUI = document.getElementById("ui_wind");
    const wtUI = document.getElementById("ui_wt");
    const pwUI = document.getElementById("ui_plane_wreck");
    const sbUI = document.getElementById("ui_sailboat_broken");
    const owUI = document.getElementById("ui_ornithopter_wreck");
    const bwcUI = document.getElementById("ui_baywatch_car");
    const bwhUI = document.getElementById("ui_baywatch_hq");
    const bwtUI2 = document.getElementById("ui_baywatch_tower");
    if (pUI) pUI.style.display = "none";
    if (cUI) cUI.style.display = "none";
    if (bUI) bUI.style.display = "none";
    if (sUI) sUI.style.display = "none";
    if (wtUI) wtUI.style.display = "none";
    if (wUI) wUI.style.display = "none";
    if (pwUI) pwUI.style.display = "none";
    if (sbUI) sbUI.style.display = "none";
    if (owUI) owUI.style.display = "none";
    if (bwcUI) bwcUI.style.display = "none";
    if (bwhUI) bwhUI.style.display = "none";
    if (bwtUI2) bwtUI2.style.display = "none";
    const wl = m.waterLevel ?? 0;
    for (let x = Math.floor(state.panX); x < Math.min(m.gridSize, state.panX + 600 / tSize + 1); x++) {
      for (let y = Math.floor(state.panY); y < Math.min(m.gridSize, state.panY + 600 / tSize + 1); y++) {
        const h = m.terrain[x][y];
        const isSand = h > wl && (m.sand?.[x]?.[y] ?? 0) > 0;
        ctx.fillStyle = h <= wl ? COLORS.water : isSand ? getSandColor(h) : getLandColor(h, false);
        ctx.fillRect((x - state.panX) * tSize, (y - state.panY) * tSize, tSize + 1.5, tSize + 1.5);
      }
    }
    m.objects.forEach((obj, idx) => {
      const isSelected = state.selectedObjectIdx === idx;
      const ox = (obj.x - state.panX) * tSize;
      const oy = (obj.y - state.panY) * tSize;
      if (obj.type === "pad") {
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.padStroke;
        }
        ctx.fillStyle = COLORS.padFill;
        ctx.fillRect(ox, oy, 7 * tSize, 7 * tSize);
        ctx.strokeStyle = COLORS.padStroke;
        ctx.strokeRect(ox, oy, 7 * tSize, 7 * tSize);
        ctx.fillStyle = COLORS.textLight;
        ctx.beginPath();
        ctx.arc(ox + 3.5 * tSize, oy + 3.5 * tSize, Math.max(4, tSize / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (m.spawnObject === "pad") {
          ctx.fillStyle = COLORS.uiHighlight;
          ctx.font = "bold 12px monospace";
          ctx.fillText("START", ox, oy - 5);
        }
        if (isSelected && pUI) {
          pUI.style.display = "block";
          pUI.style.left = Math.min(600 - 150, Math.max(0, ox + 8 * tSize + 10)) + "px";
          pUI.style.top = Math.min(600 - 100, Math.max(0, oy)) + "px";
          const btn = document.getElementById("btn_spawn_pad");
          if (btn) btn.style.background = m.spawnObject === "pad" ? COLORS.uiHighlight : "var(--accent)";
        }
      } else if (obj.type === "carrier" || obj.type === "boat" || obj.type === "pilot_boat" || obj.type === "sar_boat" || obj.type === "salvage_tug") {
        const isCarrier = obj.type === "carrier";
        const rad = obj.angle * Math.PI / 180;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = isCarrier ? COLORS.carrierPath : "#4af";
        if (obj.path === "straight") {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(rad) * 1e3, oy + Math.sin(rad) * 1e3);
          ctx.stroke();
        } else if (obj.path === "circle") {
          const rX = obj.radius * tSize;
          const rY = rX * 0.8;
          const t0 = Math.atan2(-Math.cos(rad) / rX, Math.sin(rad) / rY);
          const centerGridX = obj.x - Math.cos(t0) * obj.radius;
          const centerGridY = obj.y - Math.sin(t0) * obj.radius * 0.8;
          const c_px = (centerGridX - state.panX) * tSize;
          const c_py = (centerGridY - state.panY) * tSize;
          ctx.beginPath();
          ctx.ellipse(c_px, c_py, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = isCarrier ? COLORS.carrierPath : "#4af";
          ctx.fillRect(c_px - 3, c_py - 3, 6, 6);
        }
        ctx.restore();
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(rad);
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.textLight;
        }
        if (isCarrier) {
          ctx.fillStyle = COLORS.carrierBase;
          ctx.fillRect(-8 * tSize, -3.5 * tSize, 16 * tSize, 7 * tSize);
          ctx.fillStyle = COLORS.carrierAccent;
          ctx.beginPath();
          ctx.moveTo(8 * tSize, 0);
          ctx.lineTo(5 * tSize, -3.5 * tSize);
          ctx.lineTo(5 * tSize, 3.5 * tSize);
          ctx.fill();
        } else if (obj.type === "pilot_boat") {
          ctx.fillStyle = "#ffcc00";
          ctx.fillRect(-1.61 * tSize, -0.7 * tSize, 2.32 * tSize, 1.4 * tSize);
          ctx.fillStyle = "#eebb00";
          ctx.beginPath();
          ctx.moveTo(0.71 * tSize, -0.7 * tSize);
          ctx.lineTo(1.75 * tSize, 0);
          ctx.lineTo(0.71 * tSize, 0.7 * tSize);
          ctx.fill();
          ctx.fillStyle = "#444";
          ctx.fillRect(-0.56 * tSize, -0.42 * tSize, 0.84 * tSize, 0.84 * tSize);
        } else if (obj.type === "sar_boat") {
          ctx.fillStyle = "#d32f2f";
          ctx.fillRect(-1.61 * tSize, -0.7 * tSize, 2.32 * tSize, 1.4 * tSize);
          ctx.fillStyle = "#b71c1c";
          ctx.beginPath();
          ctx.moveTo(0.71 * tSize, -0.7 * tSize);
          ctx.lineTo(1.75 * tSize, 0);
          ctx.lineTo(0.71 * tSize, 0.7 * tSize);
          ctx.fill();
          ctx.fillStyle = "#e6e6e6";
          ctx.fillRect(-0.56 * tSize, -0.28 * tSize, 0.91 * tSize, 0.56 * tSize);
        } else if (obj.type === "salvage_tug") {
          ctx.fillStyle = "#888";
          ctx.fillRect(-2.5 * tSize, -1.2 * tSize, 5.7 * tSize, 2.4 * tSize);
          ctx.fillStyle = "#aaa";
          ctx.beginPath();
          ctx.moveTo(3.2 * tSize, -1.2 * tSize);
          ctx.lineTo(3.8 * tSize, 0);
          ctx.lineTo(3.2 * tSize, 1.2 * tSize);
          ctx.fill();
          ctx.fillStyle = "#eee";
          ctx.fillRect(1 * tSize, -0.8 * tSize, 1.2 * tSize, 1.6 * tSize);
        } else {
          ctx.fillStyle = "#ddd";
          ctx.beginPath();
          ctx.moveTo(5 * tSize, 0);
          ctx.lineTo(-4 * tSize, -2 * tSize);
          ctx.lineTo(-4 * tSize, 2 * tSize);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillRect(-4 * tSize, -0.3 * tSize, 9 * tSize, 0.6 * tSize);
          ctx.strokeStyle = "#bbb";
          ctx.lineWidth = Math.max(1, tSize * 0.3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -6 * tSize);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.translate(0, 0);
        ctx.rotate(-rad);
        ctx.fillStyle = COLORS.textDark;
        ctx.font = "bold 11px monospace";
        ctx.fillText(obj.speed + "kn", -15, 4);
        if (m.spawnObject === obj.type) {
          ctx.fillStyle = COLORS.uiHighlight;
          ctx.fillText("START", -15, -15);
        }
        ctx.restore();
        if (isSelected) {
          const panel = isCarrier ? cUI : bUI;
          if (panel) {
            panel.style.display = "block";
            panel.style.left = Math.min(600 - 180, Math.max(0, ox + 20)) + "px";
            panel.style.top = Math.min(600 - 200, Math.max(0, oy + 20)) + "px";
            syncVesselUI(obj, isCarrier ? "carrier" : "boat");
            if (isCarrier) {
              const btn = document.getElementById("btn_spawn_carrier");
              if (btn)
                btn.style.background = m.spawnObject === "carrier" ? COLORS.uiHighlight : "var(--accent)";
            }
          }
        }
      } else if (obj.type === "submarine") {
        const rad = obj.angle * Math.PI / 180;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#666";
        if (obj.path === "straight") {
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(rad) * 1e3, oy + Math.sin(rad) * 1e3);
          ctx.stroke();
        } else if (obj.path === "circle") {
          const rX = obj.radius * tSize, rY = rX * 0.8;
          const t0 = Math.atan2(-Math.cos(rad) / rX, Math.sin(rad) / rY);
          const c_px = (obj.x - Math.cos(t0) * obj.radius - state.panX) * tSize;
          const c_py = (obj.y - Math.sin(t0) * obj.radius * 0.8 - state.panY) * tSize;
          ctx.beginPath();
          ctx.ellipse(c_px, c_py, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(rad);
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#aaa";
        }
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.moveTo(6 * tSize, 0);
        ctx.lineTo(4 * tSize, -1.2 * tSize);
        ctx.lineTo(-5 * tSize, -1.2 * tSize);
        ctx.lineTo(-5.5 * tSize, 0);
        ctx.lineTo(-5 * tSize, 1.2 * tSize);
        ctx.lineTo(4 * tSize, 1.2 * tSize);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(0.5 * tSize, -0.5 * tSize, 1.8 * tSize, 1 * tSize);
        ctx.shadowBlur = 0;
        ctx.rotate(-rad);
        ctx.fillStyle = "#999";
        ctx.font = "bold 11px monospace";
        ctx.fillText(obj.speed + "kn", -15, 4);
        ctx.restore();
        if (isSelected && sUI) {
          sUI.style.display = "block";
          sUI.style.left = Math.min(600 - 180, Math.max(0, ox + 20)) + "px";
          sUI.style.top = Math.min(600 - 150, Math.max(0, oy + 20)) + "px";
          syncVesselUI(obj, "submarine");
        }
      } else if (obj.type === "lighthouse") {
        const lx = (obj.x + 0.5 - state.panX) * tSize;
        const ly = (obj.y + 0.5 - state.panY) * tSize;
        ctx.fillStyle = COLORS.lighthouseBase;
        ctx.beginPath();
        ctx.arc(lx, ly, tSize * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.lighthouseLight;
        ctx.beginPath();
        ctx.arc(lx, ly, tSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === "research_platform") {
        const rx = (obj.x - state.panX) * tSize;
        const ry = (obj.y - state.panY) * tSize;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#4af";
        }
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(rx - 0.4 * tSize, ry - 0.4 * tSize, 0.8 * tSize, 0.8 * tSize);
        ctx.fillStyle = "#666";
        ctx.fillRect(rx - 1.5 * tSize, ry - 1.5 * tSize, 3 * tSize, 3 * tSize);
        ctx.fillStyle = "#2a8f2a";
        ctx.fillRect(rx - 3.5 * tSize, ry - 1.2 * tSize, 2 * tSize, 2.4 * tSize);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1, tSize * 0.2);
        ctx.beginPath();
        ctx.moveTo(rx - 3.1 * tSize, ry - 0.7 * tSize);
        ctx.lineTo(rx - 3.1 * tSize, ry + 0.7 * tSize);
        ctx.moveTo(rx - 2.4 * tSize, ry - 0.7 * tSize);
        ctx.lineTo(rx - 2.4 * tSize, ry + 0.7 * tSize);
        ctx.moveTo(rx - 3.1 * tSize, ry);
        ctx.lineTo(rx - 2.4 * tSize, ry);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (obj.type === "wind_turbine") {
        const wx = (obj.x + 0.5 - state.panX) * tSize;
        const wy = (obj.y + 0.5 - state.panY) * tSize;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#4f4";
        }
        ctx.fillStyle = "#ccc";
        ctx.beginPath();
        ctx.arc(wx, wy, tSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = Math.max(1, tSize * 0.15);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(a) * 3 * tSize, wy + Math.sin(a) * 3 * tSize);
          ctx.stroke();
        }
        ctx.fillStyle = "#ff2200";
        ctx.beginPath();
        ctx.arc(wx, wy - tSize * 0.35, Math.max(2, tSize * 0.18), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isSelected && wtUI) {
          wtUI.style.display = "block";
          wtUI.style.left = Math.min(600 - 140, Math.max(0, wx + 20)) + "px";
          wtUI.style.top = Math.min(600 - 60, Math.max(0, wy + 20)) + "px";
          const spinEl = document.getElementById("m_wt_spinning");
          if (spinEl) spinEl.checked = !!obj.spinning;
        }
      } else if (obj.type === "plane_wreck") {
        const pw = obj;
        const ox2 = (pw.x + 0.5 - state.panX) * tSize;
        const oy2 = (pw.y + 0.5 - state.panY) * tSize;
        const rad = (pw.angle ?? 0) * Math.PI / 180;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#fa0";
        }
        ctx.save();
        ctx.translate(ox2, oy2);
        ctx.rotate(rad);
        ctx.fillStyle = "#1a1612";
        ctx.beginPath();
        ctx.ellipse(0.3 * tSize, 0, 1.2 * tSize, 0.7 * tSize, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d4c022";
        ctx.fillRect(-1.5 * tSize, -0.15 * tSize, 2.8 * tSize, 0.3 * tSize);
        ctx.fillRect(-0.4 * tSize, -1.2 * tSize, 0.35 * tSize, 2.4 * tSize);
        ctx.fillStyle = "#cc1e00";
        ctx.fillRect(-1.5 * tSize, -0.35 * tSize, 0.5 * tSize, 0.7 * tSize);
        ctx.restore();
        ctx.shadowBlur = 0;
        if (isSelected && pwUI) {
          pwUI.style.display = "block";
          pwUI.style.left = Math.min(600 - 130, Math.max(0, ox2 + 20)) + "px";
          pwUI.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
          const angleEl = document.getElementById("m_pw_angle");
          if (angleEl) angleEl.value = (pw.angle ?? 0).toString();
        }
      } else if (obj.type === "sailboat_broken") {
        const sb = obj;
        const ox2 = (sb.x + 0.5 - state.panX) * tSize;
        const oy2 = (sb.y + 0.5 - state.panY) * tSize;
        const rad = (sb.angle ?? 0) * Math.PI / 180;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#fa0";
        }
        ctx.save();
        ctx.translate(ox2, oy2);
        ctx.rotate(rad);
        ctx.fillStyle = "#933";
        ctx.beginPath();
        ctx.moveTo(1.2 * tSize, 0);
        ctx.lineTo(0.2 * tSize, -0.45 * tSize);
        ctx.lineTo(-1 * tSize, -0.35 * tSize);
        ctx.lineTo(-1 * tSize, 0.35 * tSize);
        ctx.lineTo(0.2 * tSize, 0.45 * tSize);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#a85";
        ctx.fillRect(-0.9 * tSize, -0.3 * tSize, 2 * tSize, 0.6 * tSize);
        ctx.fillStyle = "#aaa";
        ctx.fillRect(-0.35 * tSize, -0.05 * tSize, 0.1 * tSize, 0.1 * tSize);
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = Math.max(1, tSize * 0.08);
        ctx.beginPath();
        ctx.moveTo(-0.3 * tSize, 0);
        ctx.lineTo(1.1 * tSize, 0.35 * tSize);
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
        if (isSelected && sbUI) {
          sbUI.style.display = "block";
          sbUI.style.left = Math.min(600 - 130, Math.max(0, ox2 + 20)) + "px";
          sbUI.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
          const angleEl = document.getElementById("m_sb_angle");
          if (angleEl) angleEl.value = (sb.angle ?? 0).toString();
        }
      } else if (obj.type === "ornithopter_wreck") {
        const ow = obj;
        const ox2 = (ow.x + 0.5 - state.panX) * tSize;
        const oy2 = (ow.y + 0.5 - state.panY) * tSize;
        const rad = (ow.angle ?? 0) * Math.PI / 180;
        if (isSelected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#fa0";
        }
        ctx.save();
        ctx.translate(ox2, oy2);
        ctx.rotate(rad);
        ctx.fillStyle = "#1a1612";
        ctx.beginPath();
        ctx.ellipse(0.3 * tSize, 0, 0.9 * tSize, 0.5 * tSize, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d0d0d0";
        ctx.fillRect(-1.4 * tSize, -0.2 * tSize, 2.1 * tSize, 0.4 * tSize);
        ctx.fillStyle = "#c8c8c8";
        ctx.beginPath();
        ctx.moveTo(0.2 * tSize, -0.25 * tSize);
        ctx.lineTo(-0.5 * tSize, -0.22 * tSize);
        ctx.lineTo(-0.1 * tSize, -3 * tSize);
        ctx.lineTo(0.1 * tSize, -3 * tSize);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#b8b8b8";
        ctx.beginPath();
        ctx.moveTo(0.2 * tSize, 0.25 * tSize);
        ctx.lineTo(-0.3 * tSize, 0.22 * tSize);
        ctx.lineTo(-0.1 * tSize, 0.55 * tSize);
        ctx.lineTo(0.15 * tSize, 0.5 * tSize);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#888";
        ctx.lineWidth = Math.max(1, tSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(-0.3 * tSize, 0.22 * tSize);
        ctx.lineTo(-0.22 * tSize, 0.38 * tSize);
        ctx.lineTo(-0.1 * tSize, 0.55 * tSize);
        ctx.stroke();
        ctx.save();
        ctx.translate(-0.2 * tSize, 1.6 * tSize);
        ctx.rotate(0.4);
        ctx.fillStyle = "#b8b8b8";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-0.35 * tSize, 0.08 * tSize);
        ctx.lineTo(-0.1 * tSize, 2 * tSize);
        ctx.lineTo(0.12 * tSize, 1.8 * tSize);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const cpx = 0.68 * tSize;
        const cpy = 0;
        ctx.strokeStyle = "#5a9db8";
        ctx.lineWidth = Math.max(1, tSize * 0.07);
        ctx.beginPath();
        ctx.ellipse(cpx, cpy, 0.22 * tSize, 0.15 * tSize, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#7aadcc";
        ctx.lineWidth = Math.max(1, tSize * 0.04);
        [0.3, 1.1, 1.9, 2.9, 3.8, 4.7, 5.6].forEach((a) => {
          ctx.beginPath();
          ctx.moveTo(cpx, cpy);
          ctx.lineTo(cpx + Math.cos(a) * 0.2 * tSize, cpy + Math.sin(a) * 0.13 * tSize);
          ctx.stroke();
        });
        ctx.restore();
        ctx.shadowBlur = 0;
        if (isSelected && owUI) {
          owUI.style.display = "block";
          owUI.style.left = Math.min(600 - 130, Math.max(0, ox2 + 20)) + "px";
          owUI.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
          const angleEl = document.getElementById("m_ow_angle");
          if (angleEl) angleEl.value = (ow.angle ?? 0).toString();
        }
      } else if (obj.type === "baywatch_car") {
        const bc = obj;
        const ox2 = (bc.x + 0.5 - state.panX) * tSize;
        const oy2 = (bc.y + 0.5 - state.panY) * tSize;
        const rad = (bc.angle ?? 0) * Math.PI / 180;
        if (isSelected) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#f44";
        }
        ctx.save();
        ctx.translate(ox2, oy2);
        ctx.rotate(rad);
        ctx.fillStyle = "#cc2200";
        ctx.fillRect(-0.85 * tSize, -0.425 * tSize, 1.785 * tSize, 0.85 * tSize);
        ctx.fillStyle = "#ff4422";
        ctx.fillRect(-0.5 * tSize, -0.6 * tSize, 1 * tSize, 0.55 * tSize);
        ctx.restore();
        ctx.shadowBlur = 0;
        if (isSelected && bwcUI) {
          bwcUI.style.display = "block";
          bwcUI.style.left = Math.min(600 - 140, Math.max(0, ox2 + 20)) + "px";
          bwcUI.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
          const el = document.getElementById("m_bwc_angle");
          if (el) el.value = (obj.angle ?? 0).toString();
        }
      } else if (obj.type === "baywatch_hq") {
        const bh = obj;
        const ox2 = (bh.x + 0.5 - state.panX) * tSize;
        const oy2 = (bh.y + 0.5 - state.panY) * tSize;
        if (isSelected) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#f44";
        }
        ctx.fillStyle = "#cc2200";
        ctx.fillRect(ox2 - 2.2 * tSize, oy2 - 1.44 * tSize, 4.84 * tSize, 2.88 * tSize);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(ox2 - 0.5 * tSize, oy2, 1 * tSize, 1.44 * tSize);
        ctx.fillStyle = "#dd3300";
        ctx.fillRect(ox2 - 2.2 * tSize, oy2 - 0.7 * tSize, 4.84 * tSize, 0.5 * tSize);
        ctx.shadowBlur = 0;
        if (isSelected && bwhUI) {
          bwhUI.style.display = "block";
          bwhUI.style.left = Math.min(600 - 140, Math.max(0, ox2 + 20)) + "px";
          bwhUI.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
        }
      } else if (obj.type === "baywatch_tower") {
        const bt = obj;
        const ox2 = (bt.x + 0.5 - state.panX) * tSize;
        const oy2 = (bt.y + 0.5 - state.panY) * tSize;
        if (isSelected) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#f44";
        }
        ctx.fillStyle = "#d8d0b8";
        ctx.fillRect(ox2 - 1.1 * tSize, oy2 - 0.9 * tSize, 3.62 * tSize, 1.8 * tSize);
        ctx.fillStyle = "#cc2200";
        ctx.fillRect(ox2 - 0.6 * tSize, oy2 - 0.6 * tSize, 1.1 * tSize, 1.2 * tSize);
        ctx.fillStyle = "#e8e8e8";
        ctx.fillRect(ox2 - 0.5 * tSize, oy2 - 0.5 * tSize, 0.9 * tSize, 1 * tSize);
        ctx.shadowBlur = 0;
        if (isSelected && bwtUI2) {
          bwtUI2.style.display = "block";
          bwtUI2.style.left = Math.min(600 - 140, Math.max(0, ox2 + 20)) + "px";
          bwtUI2.style.top = Math.min(600 - 60, Math.max(0, oy2)) + "px";
        }
      }
    });
    const payloads = m.payloads || [];
    payloads.forEach((p, idx) => {
      const px = (p.x + 0.5 - state.panX) * tSize;
      const py = (p.y + 0.5 - state.panY) * tSize;
      const r = Math.max(5, tSize * 0.7);
      const isAttached = !!p.attachTo;
      const isSelectedPayload = state.selectedPayloadIdx === idx;
      if (isSelectedPayload) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#fff";
      }
      if (p.type === "person") {
        ctx.fillStyle = isAttached ? "#88ffcc" : "#ffe033";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe033";
        ctx.beginPath();
        ctx.arc(px, py - r * 0.65, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#cc9900";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "rescuer") {
        ctx.fillStyle = isAttached ? "#88ddff" : "#ff6600";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py - r * 0.65, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#cc3300";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "crate") {
        const s = r * 0.85;
        ctx.fillStyle = isAttached ? "#44ccff" : "#ff8800";
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
        ctx.strokeStyle = "#cc5500";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px - s / 2, py - s / 2, s, s);
        ctx.beginPath();
        ctx.moveTo(px - s / 2, py - s / 2);
        ctx.lineTo(px + s / 2, py + s / 2);
        ctx.moveTo(px + s / 2, py - s / 2);
        ctx.lineTo(px - s / 2, py + s / 2);
        ctx.strokeStyle = "#cc5500";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (isSelectedPayload && state.moveMode) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(px, py, r * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!p.npcTarget) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(8, tSize * 0.55)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(String(idx + 1), px, py + r * 1.5);
        ctx.textAlign = "left";
      }
    });
    const foliage = m.foliage || [];
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
    foliage.forEach((f) => {
      const fx = (f.x - state.panX) * tSize;
      const fy = (f.y - state.panY) * tSize;
      const r = Math.max(3, tSize * 0.6 * (f.s || 1));
      ctx.fillStyle = treeColors[f.type] || "#1a5a1a";
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.fill();
      if (f.type === "dead") {
        ctx.strokeStyle = "#8a6a4a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    (m.particleEmitters || []).forEach((e) => {
      const ex = (e.x - state.panX) * tSize;
      const ey = (e.y - state.panY) * tSize;
      const r = Math.max(4, tSize * 0.5);
      const isFire = e.type === "fire";
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = isFire ? "#ff6600" : "#888888";
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = isFire ? "#ff4400" : "#666666";
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(8, tSize * 0.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isFire ? "\u{1F525}" : "\u{1F4A8}", ex, ey);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
    const dirRad = m.windDir * Math.PI / 180;
    if (state.selectedUI === "wind") {
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.windActive;
    }
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.arc(50, 50, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = state.selectedUI === "wind" ? COLORS.windActive : COLORS.padStroke;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (m.windStr > 0) {
      const maxStr = 10;
      const str01 = Math.min(m.windStr, maxStr) / maxStr;
      const arrowLen = 8 + Math.sqrt(str01) * 16;
      const tipX = 50 + Math.cos(dirRad) * arrowLen;
      const tipY = 50 + Math.sin(dirRad) * arrowLen;
      ctx.lineWidth = 1.5 + str01 * 2;
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      const headLen = 5, spread = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(dirRad - spread) * headLen, tipY - Math.sin(dirRad - spread) * headLen);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(dirRad + spread) * headLen, tipY - Math.sin(dirRad + spread) * headLen);
      ctx.stroke();
      ctx.fillStyle = state.selectedUI === "wind" ? COLORS.windActive : COLORS.padStroke;
      ctx.font = "bold 9px monospace";
      ctx.fillText(`${m.windStr.toFixed(1)}`, 84, 54);
    }
    ctx.lineWidth = 1;
    if (state.selectedUI === "wind" && wUI) wUI.style.display = "block";
  };
  var syncVesselUI = (obj, kind) => {
    const prefix = kind === "carrier" ? "carrier" : kind === "submarine" ? "submarine" : "boat";
    const pathEl = document.getElementById(`m_${prefix}_path`);
    const speedEl = document.getElementById(`m_${prefix}_speed`);
    const radiusEl = document.getElementById(`m_${prefix}_radius`);
    const angleEl = document.getElementById(`m_${prefix}_angle`);
    if (pathEl) pathEl.value = obj.path ?? "static";
    if (speedEl) speedEl.value = (obj.speed ?? 0).toString();
    if (radiusEl) radiusEl.value = (obj.radius ?? 40).toString();
    if (angleEl) angleEl.value = (obj.angle ?? 0).toString();
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
    previewChannel.postMessage({ type: "mission-update", mission: m });
  };
  previewChannel.onmessage = (e) => {
    if (e.data.type === "preview-ready") broadcastPreview();
  };
  var getEl = (id) => document.getElementById(id);
  var getInput = (id) => getEl(id);
  var renderPayloadList = () => {
    const m = getCurrentMission();
    const container = getEl("payload-list");
    if (!container || !m) {
      notifyWorkbench();
      return;
    }
    container.innerHTML = "";
    const payloads = m.payloads || [];
    if (payloads.length === 0) {
      container.innerHTML = '<span style="color:#555;font-size:11px">Keine Payloads platziert</span>';
      return;
    }
    payloads.forEach((p, i) => {
      const pa = p;
      const wrap = document.createElement("div");
      wrap.style.cssText = "margin:3px 0";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px";
      const icon = p.type === "person" ? "\u{1F7E1}" : p.type === "rescuer" ? "\u{1F535}" : "\u{1F7E0}";
      const typeName = p.type === "person" ? "Person" : p.type === "rescuer" ? "Retter" : "Crate";
      const label = document.createElement("span");
      label.style.flex = "1";
      const attach = pa.attachTo ? ` \u2192 ${pa.attachTo.objectType} #${pa.attachTo.objectIdx + 1}` : "";
      label.innerText = `${i + 1}. ${icon} ${typeName} @ (${p.x}, ${p.y})${attach}`;
      const npcLabel = document.createElement("label");
      npcLabel.style.cssText = "display:flex;align-items:center;gap:2px;color:#8af;white-space:nowrap;cursor:pointer";
      const npcCb = document.createElement("input");
      npcCb.type = "checkbox";
      npcCb.checked = !!pa.npcTarget;
      npcCb.onchange = () => {
        pa.npcTarget = npcCb.checked;
        drawMap();
      };
      npcLabel.append(npcCb, "NPC");
      let deliverToEl = null;
      if (p.type === "crate" || p.type === "person") {
        const sel = document.createElement("select");
        sel.style.cssText = "background:#222;color:#fa8;border:1px solid #555;font-size:10px;padding:1px 3px;cursor:pointer";
        const opts = [
          ["", "Ziel: \u2013"],
          ["pad", "Ziel: Pad"],
          ["carrier", "Ziel: Carrier"],
          ["submarine", "Ziel: U-Boot"],
          ["boat", "Ziel: Boot"]
        ];
        opts.forEach(([val, lbl]) => {
          const opt = document.createElement("option");
          opt.value = val;
          opt.text = lbl;
          if ((pa.deliverTo ?? "") === val) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => {
          pa.deliverTo = sel.value || void 0;
          notifyWorkbench();
        };
        deliverToEl = sel;
      }
      const btnDel = document.createElement("button");
      btnDel.innerText = "X";
      btnDel.style.cssText = "background:#822;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px";
      btnDel.onclick = () => {
        m.payloads.splice(i, 1);
        renderPayloadList();
        drawMap();
      };
      row.append(label, npcLabel, ...deliverToEl ? [deliverToEl] : [], btnDel);
      wrap.appendChild(row);
      if (pa.attachTo) {
        const offsetRow = document.createElement("div");
        offsetRow.style.cssText = "display:flex;align-items:center;gap:4px;font-size:10px;color:#aaa;padding-left:12px;margin-top:2px";
        const makeOffsetInput = (axis, axisLabel) => {
          const lbl = document.createElement("span");
          lbl.innerText = axisLabel + ":";
          const inp = document.createElement("input");
          inp.type = "number";
          inp.step = "0.5";
          inp.value = String(pa.attachTo[axis] ?? 0);
          inp.style.cssText = "width:48px;background:#222;color:#ddd;border:1px solid #444;padding:1px 3px;font-size:10px";
          inp.onchange = () => {
            pa.attachTo[axis] = parseFloat(inp.value) || 0;
            notifyWorkbench();
            drawMap();
          };
          return [lbl, inp];
        };
        offsetRow.append(
          document.createTextNode("offset "),
          ...makeOffsetInput("localX", "X"),
          ...makeOffsetInput("localY", "Y")
        );
        wrap.appendChild(offsetRow);
      }
      container.appendChild(wrap);
    });
    notifyWorkbench();
  };
  var renderObjectList = () => {
    const m = getCurrentMission();
    const container = getEl("object-list");
    if (!container || !m) return;
    container.innerHTML = "";
    m.objects.forEach((obj, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin:3px 0;font-size:11px";
      const icons = {
        pad: "\u{1F7E9}",
        carrier: "\u{1F6A2}",
        boat: "\u26F5",
        pilot_boat: "\u{1F6A4}",
        sar_boat: "\u{1F6E5}",
        salvage_tug: "\u{1F6F3}",
        submarine: "\u{1F93F}",
        lighthouse: "\u{1F526}",
        research_platform: "\u{1F3D7}",
        wind_turbine: "\u{1F300}",
        plane_wreck: "\u2708\uFE0F",
        sailboat_broken: "\u26F5",
        ornithopter_wreck: "\u{1F6F8}",
        baywatch_car: "\u{1F697}",
        baywatch_hq: "\u{1F3E0}",
        baywatch_tower: "\u{1F5FC}"
      };
      const label = document.createElement("span");
      label.style.flex = "1";
      label.innerText = `${icons[obj.type] || "?"} ${obj.type} @ (${obj.x}, ${obj.y})`;
      const btnDel = document.createElement("button");
      btnDel.innerText = "X";
      btnDel.style.cssText = "background:#822;color:#fff;border:none;padding:2px 6px;cursor:pointer;font-size:10px";
      btnDel.onclick = () => {
        m.objects.splice(idx, 1);
        if (state.selectedObjectIdx === idx) state.selectedObjectIdx = null;
        renderObjectList();
        drawMap();
      };
      row.append(label, btnDel);
      container.appendChild(row);
    });
    notifyWorkbench();
  };
  var renderFoliageList = () => {
    const m = getCurrentMission();
    const container = getEl("foliage-list");
    const countEl = getEl("foliage-count");
    if (!container || !m) return;
    const foliage = m.foliage || [];
    if (countEl) countEl.innerText = `(${foliage.length} Objekte)`;
    if (foliage.length === 0) {
      container.innerHTML = '<span style="color:#555">Keine B\xE4ume platziert</span>';
      return;
    }
    const icons = { pine: "\u{1F332}", oak: "\u{1F333}", bush: "\u{1F33F}", dead: "\u{1FAB5}" };
    const counts = {};
    foliage.forEach((f) => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    container.innerHTML = Object.entries(counts).map(([type, n]) => `${icons[type] || "\u{1F332}"} ${type}: <strong style="color:#5f5">${n}</strong>`).join(" &nbsp;|&nbsp; ");
    notifyWorkbench();
  };
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
    m.night = getInput("m_night").checked;
    m.waterLevel = parseFloat(getInput("m_water_level").value) || 0;
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
    const _boatTypes = /* @__PURE__ */ new Set(["boat", "pilot_boat", "sar_boat", "salvage_tug"]);
    if (!obj || (kind === "boat" ? !_boatTypes.has(obj.type) : obj.type !== kind)) return;
    const prefix = kind === "carrier" ? "carrier" : kind === "submarine" ? "submarine" : "boat";
    obj.path = document.getElementById(`m_${prefix}_path`)?.value ?? obj.path;
    obj.speed = parseFloat(document.getElementById(`m_${prefix}_speed`)?.value) || 0;
    obj.radius = parseFloat(document.getElementById(`m_${prefix}_radius`)?.value) || 40;
    obj.angle = parseInt(document.getElementById(`m_${prefix}_angle`)?.value) || 0;
    drawMap();
    broadcastPreview();
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
    getInput("m_night").checked = m.night;
    getInput("m_water_level").value = (m.waterLevel ?? 0).toString();
    getInput("m_wind_dir").value = (m.windDir ?? 0).toString();
    getInput("m_wind_str").value = (m.windStr ?? 0).toString();
    getInput("m_wind_var").checked = !!m.windVar;
    getInput("m_npc_heli_count").value = (m.npcHeliCount ?? 0).toString();
    getEl("m_npc_heli_type").value = m.npcHeliType ?? "random";
    state.selectedUI = null;
    state.selectedObjectIdx = null;
    renderMissionList();
    renderPayloadList();
    renderObjectList();
    renderFoliageList();
    drawMap();
    broadcastPreview();
    notifyWorkbench();
  };
  var renderMissionList = () => {
    const container = getEl("mission-list");
    container.innerHTML = "";
    state.campaign.forEach((m, i) => {
      const div = document.createElement("div");
      div.className = "mission-item" + (i === state.curIdx ? " active" : "");
      const span = document.createElement("span");
      span.innerText = `${i + 1}. ${_lsDe(m.headline).substring(0, 18)}`;
      const controls = document.createElement("div");
      controls.className = "m-controls";
      const btnUp = document.createElement("button");
      btnUp.innerText = "\u2191";
      btnUp.onclick = (e) => {
        e.stopPropagation();
        moveM(i, -1);
      };
      const btnDown = document.createElement("button");
      btnDown.innerText = "\u2193";
      btnDown.onclick = (e) => {
        e.stopPropagation();
        moveM(i, 1);
      };
      const btnDel = document.createElement("button");
      btnDel.innerText = "X";
      btnDel.style.background = "#822";
      btnDel.onclick = (e) => {
        e.stopPropagation();
        delM(i);
      };
      controls.append(btnUp, btnDown, btnDel);
      div.append(span, controls);
      div.onclick = () => loadMission(i);
      container.appendChild(div);
    });
    notifyWorkbench();
  };
  var moveM = (i, dir) => {
    if (i + dir < 0 || i + dir >= state.campaign.length) return;
    [state.campaign[i], state.campaign[i + dir]] = [state.campaign[i + dir], state.campaign[i]];
    loadMission(i + dir);
  };
  var delM = (i) => {
    if (state.campaign.length <= 1) return;
    if (confirm("Mission wirklich l\xF6schen?")) {
      state.campaign.splice(i, 1);
      loadMission(Math.max(0, i - 1));
    }
  };
  var clampCamera = () => {
    const m = getCurrentMission();
    if (!m) return;
    const tSize = 600 / m.gridSize * state.zoom;
    const viewGridW = 600 / tSize, viewGridH = 600 / tSize;
    state.panX = Math.max(0, Math.min(state.panX, m.gridSize - viewGridW));
    state.panY = Math.max(0, Math.min(state.panY, m.gridSize - viewGridH));
    if (viewGridW >= m.gridSize) state.panX = 0;
    if (viewGridH >= m.gridSize) state.panY = 0;
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
    const canvas2 = getEl("editorCanvas");
    const rect = canvas2.getBoundingClientRect();
    const tSize = 600 / m.gridSize * state.zoom;
    const gx = Math.floor((e.clientX - rect.left) / tSize + state.panX);
    const gy = Math.floor((e.clientY - rect.top) / tSize + state.panY);
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
          if (Math.hypot(dx, dy) <= state.brushRadius && m.terrain[gx + dx]) m.terrain[gx + dx][gy + dy] = h;
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
      if (m.objects.some((o) => ["boat", "pilot_boat", "sar_boat", "salvage_tug"].includes(o.type)))
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
      const vw = window.innerWidth, vh = window.innerHeight;
      popup.style.left = Math.min(cx + 6, vw - 190) + "px";
      popup.style.top = Math.min(cy + 6, vh - 120) + "px";
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
    document.getElementById("m_bwc_angle")?.addEventListener("input", () => {
      const m = getCurrentMission();
      if (!m || state.selectedObjectIdx === null) return;
      const obj = m.objects[state.selectedObjectIdx];
      if (obj?.type !== "baywatch_car") return;
      obj.angle = parseInt(document.getElementById("m_bwc_angle").value) || 0;
      drawMap();
      broadcastPreview();
    });
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
    ["carrier_path", "carrier_speed", "carrier_radius", "carrier_angle"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("carrier"))
    );
    ["boat_path", "boat_speed", "boat_radius", "boat_angle"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("boat"))
    );
    ["submarine_path", "submarine_speed", "submarine_radius", "submarine_angle"].forEach(
      (id) => document.getElementById(`m_${id}`)?.addEventListener("input", () => syncVesselFromUI("submarine"))
    );
    document.getElementById("m_pw_angle")?.addEventListener("input", () => {
      const m = getCurrentMission();
      if (!m || state.selectedObjectIdx === null) return;
      const obj = m.objects[state.selectedObjectIdx];
      if (obj?.type !== "plane_wreck") return;
      obj.angle = parseInt(document.getElementById("m_pw_angle").value) || 0;
      drawMap();
      broadcastPreview();
    });
    document.getElementById("m_sb_angle")?.addEventListener("input", () => {
      const m = getCurrentMission();
      if (!m || state.selectedObjectIdx === null) return;
      const obj = m.objects[state.selectedObjectIdx];
      if (obj?.type !== "sailboat_broken") return;
      obj.angle = parseInt(document.getElementById("m_sb_angle").value) || 0;
      drawMap();
      broadcastPreview();
    });
    document.getElementById("m_ow_angle")?.addEventListener("input", () => {
      const m = getCurrentMission();
      if (!m || state.selectedObjectIdx === null) return;
      const obj = m.objects[state.selectedObjectIdx];
      if (obj?.type !== "ornithopter_wreck") return;
      obj.angle = parseInt(document.getElementById("m_ow_angle").value) || 0;
      drawMap();
      broadcastPreview();
    });
    [
      "m_headline_de",
      "m_headline_en",
      "m_briefing_de",
      "m_briefing_en",
      "m_rain",
      "m_night",
      "m_water_level",
      "m_wind_dir",
      "m_wind_str",
      "m_wind_var",
      "m_npc_heli_count",
      "m_npc_heli_type",
      "m_sublines_de",
      "m_sublines_en"
    ].forEach((id) => getEl(id)?.addEventListener("input", syncToData));
    const canvas2 = getEl("editorCanvas");
    const cursorEl = document.createElement("canvas");
    cursorEl.id = "brush-cursor";
    cursorEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:none;";
    document.body.appendChild(cursorEl);
    const cursorCtx = cursorEl.getContext("2d");
    const PAINT_TOOLS = /* @__PURE__ */ new Set(["terrain", "flatten", "foliage", "sand"]);
    const POINT_TOOLS = /* @__PURE__ */ new Set([
      "pad",
      "carrier",
      "boat",
      "pilot_boat",
      "sar_boat",
      "salvage_tug",
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
      "person",
      "rescuer",
      "crate"
    ]);
    const dotColors = {
      pad: "#5f5",
      carrier: "#88aaff",
      boat: "#4af",
      submarine: "#888",
      lighthouse: "#ffdd44",
      plane_wreck: "#aaa",
      sailboat_broken: "#b96",
      ornithopter_wreck: "#aaa",
      baywatch_car: "#cc2200",
      baywatch_hq: "#cc4400",
      baywatch_tower: "#cc4400",
      person: "#ffe033",
      crate: "#ff8800"
    };
    const updateCursor = () => {
      const m = getCurrentMission();
      if (!m) return;
      const tool = state.currentTool;
      if (tool === "move") {
        cursorEl.style.display = "none";
        canvas2.style.cursor = "grab";
        return;
      }
      canvas2.style.cursor = "none";
      cursorEl.style.display = "block";
      if (PAINT_TOOLS.has(tool)) {
        const tSize = 600 / m.gridSize * state.zoom;
        const radiusPx = state.brushRadius * tSize;
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
        cursorCtx.fillStyle = tool === "flatten" ? "rgba(100,200,255,0.08)" : tool === "foliage" ? "rgba(50,200,50,0.1)" : tool === "sand" ? "rgba(212,180,80,0.12)" : "rgba(255,160,0,0.08)";
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
    canvas2.addEventListener("mousemove", (e) => {
      const size = parseInt(cursorEl.width) || 32;
      cursorEl.style.left = e.clientX - size / 2 + "px";
      cursorEl.style.top = e.clientY - size / 2 + "px";
      updateCursor();
    });
    canvas2.addEventListener("mouseenter", () => {
      if (state.currentTool !== "move") {
        cursorEl.style.display = "block";
        updateCursor();
      }
    });
    canvas2.addEventListener("mouseleave", () => {
      cursorEl.style.display = "none";
    });
    const updateMoveCursor = () => {
      if (state.moveMode) {
        canvas2.style.cursor = "crosshair";
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
    canvas2.addEventListener("contextmenu", (e) => e.preventDefault());
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
          { v: "research_platform", l: "\u{1F3D7} Plattform" }
        ] },
        { cat: "Fahr.", emoji: "\u{1F6A2}", items: [
          { v: "carrier", l: "\u{1F6A2} Tr\xE4ger" },
          { v: "boat", l: "\u26F5 Boot" },
          { v: "pilot_boat", l: "\u{1F6A4} Lotsenboot" },
          { v: "sar_boat", l: "\u{1F6E5} SAR-Boot" },
          { v: "salvage_tug", l: "\u{1F6F3} Schlepper" },
          { v: "submarine", l: "\u{1F93F} U-Boot" }
        ] },
        { cat: "Deko", emoji: "\u{1F300}", items: [
          { v: "wind_turbine", l: "\u{1F300} Windrad" },
          { v: "plane_wreck", l: "\u2708\uFE0F Wrack" },
          { v: "sailboat_broken", l: "\u26F5 Segel (gek.)" },
          { v: "ornithopter_wreck", l: "\u{1F6F8} Orni-Wrack" },
          { v: "baywatch_car", l: "\u{1F697} BW-Auto" },
          { v: "baywatch_hq", l: "\u{1F3E0} BW-HQ" },
          { v: "baywatch_tower", l: "\u{1F5FC} Wachturm" }
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
      canvas2.addEventListener("dblclick", (ev) => {
        const m = getCurrentMission();
        if (!m) return;
        const rect = canvas2.getBoundingClientRect();
        const tSize = 600 / m.gridSize * state.zoom;
        _ctxGx = Math.floor((ev.clientX - rect.left) / tSize + state.panX);
        _ctxGy = Math.floor((ev.clientY - rect.top) / tSize + state.panY);
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
    canvas2.onmousedown = (e) => {
      const rect = canvas2.getBoundingClientRect();
      const m = getCurrentMission();
      const tSize = 600 / m.gridSize * state.zoom;
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const gx = mx / tSize + state.panX, gy = my / tSize + state.panY;
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
          else if (["carrier", "boat", "pilot_boat", "sar_boat", "salvage_tug", "submarine"].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 6;
          else if (["lighthouse", "research_platform", "wind_turbine"].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 2;
          else if (["plane_wreck", "sailboat_broken", "ornithopter_wreck", "baywatch_car", "baywatch_hq", "baywatch_tower"].includes(obj.type))
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 3;
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
        canvas2.style.cursor = "grabbing";
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
          const tSize = 600 / m.gridSize * state.zoom;
          const rect = canvas2.getBoundingClientRect();
          const gx = (e.clientX - rect.left) / tSize + state.panX;
          const gy = (e.clientY - rect.top) / tSize + state.panY;
          if (state.dragItemType === "payload")
            Object.assign(m.payloads[state.dragItemIdx], { x: Math.round(gx), y: Math.round(gy) });
          else if (state.dragItemType === "object")
            Object.assign(m.objects[state.dragItemIdx], { x: Math.round(gx), y: Math.round(gy) });
          else if (state.dragItemType === "emitter") {
            const _em = m.particleEmitters?.[state.dragItemIdx];
            if (_em) Object.assign(_em, { x: Math.round(gx), y: Math.round(gy) });
          }
          canvas2.style.cursor = "grabbing";
          drawMap();
        }
        return;
      }
      if (state.isEditorDragging) {
        const tSize = 600 / getCurrentMission().gridSize * state.zoom;
        state.panX -= (e.clientX - state.lastMX) / tSize;
        state.panY -= (e.clientY - state.lastMY) / tSize;
        state.lastMX = e.clientX;
        state.lastMY = e.clientY;
        clampCamera();
        drawMap();
      } else if (state.isDrawing) {
        if (state.currentTool !== "person" && state.currentTool !== "rescuer" && state.currentTool !== "crate" && state.currentTool !== "boat" && state.currentTool !== "pilot_boat" && state.currentTool !== "salvage_tug" && state.currentTool !== "submarine" && state.currentTool !== "carrier" && state.currentTool !== "pad" && state.currentTool !== "lighthouse" && state.currentTool !== "research_platform" && state.currentTool !== "wind_turbine" && state.currentTool !== "plane_wreck" && state.currentTool !== "sailboat_broken" && state.currentTool !== "ornithopter_wreck" && state.currentTool !== "baywatch_car" && state.currentTool !== "baywatch_hq" && state.currentTool !== "baywatch_tower" && state.currentTool !== "foliage") {
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
    canvas2.onwheel = (e) => {
      e.preventDefault();
      const rect = canvas2.getBoundingClientRect();
      const m = getCurrentMission();
      const tSize = 600 / m.gridSize * state.zoom;
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const gx = mx / tSize + state.panX, gy = my / tSize + state.panY;
      const oldZoom = state.zoom;
      state.zoom = Math.max(1, Math.min(state.zoom + (e.deltaY < 0 ? 0.5 : -0.5), 15));
      if (state.zoom !== oldZoom) {
        const nSize = 600 / m.gridSize * state.zoom;
        state.panX = gx - mx / nSize;
        state.panY = gy - my / nSize;
        clampCamera();
        drawMap();
      }
    };
    getEl("btn-export-campaign").onclick = () => {
      const savedIdx = state.curIdx;
      const data = state.campaign.map((m, i) => {
        state.curIdx = i;
        const mAny = m;
        return {
          ...m,
          terrain: typeof m.terrain === "string" ? m.terrain : compressTerrain(m.terrain),
          foliage: compressFoliage(
            typeof mAny.foliage === "string" ? decompressFoliage(mAny.foliage) : mAny.foliage || []
          ),
          ...mAny.sand ? { sand: compressTerrain(mAny.sand) } : {}
        };
      });
      state.curIdx = savedIdx;
      const cSubDe = getEl("c_sublines_de").value.split("\n").filter((l) => l.trim());
      const cSubEn = getEl("c_sublines_en").value.split("\n").filter((l) => l.trim());
      const exportData = {
        type: getEl("c_type").value || "ZEEWOLF_CAMPAIGN",
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
        if (parsed.type === "tutorial") {
          document.getElementById("editor-tutorial-guard")?.remove();
          const banner = document.createElement("div");
          banner.id = "editor-tutorial-guard";
          banner.style.cssText = "background:#6b0000;color:#fff;font-weight:bold;padding:10px 16px;margin-bottom:8px;border-radius:3px;border:1px solid #c00;font-size:13px;line-height:1.4;";
          banner.textContent = "Tutorial-Kampagnen sind schreibgesch\xFCtzt und k\xF6nnen nicht im Editor bearbeitet werden.";
          getEl("output").insertAdjacentElement("beforebegin", banner);
          setTimeout(() => banner.remove(), 8e3);
          return;
        }
        const ct = parsed.campaignTitle;
        getInput("c_title_de").value = ct ? typeof ct === "string" ? ct : ct.de || "" : "Imported Campaign";
        getInput("c_title_en").value = ct && typeof ct !== "string" ? ct.en || "" : "";
        const cs = parsed.campaignSublines || [];
        getEl("c_sublines_de").value = cs.map((s) => typeof s === "string" ? s : s.de || "").join("\n");
        getEl("c_sublines_en").value = cs.map((s) => typeof s === "string" ? "" : s.en || "").join("\n");
        getEl("c_type").value = parsed.type || "ZEEWOLF_CAMPAIGN";
        state.type = parsed.type;
        state.campaign = parsed.levels.map((m) => {
          const base = {
            ...m,
            terrain: typeof m.terrain === "string" ? decompressTerrain(m.terrain, m.gridSize) : m.terrain,
            foliage: typeof m.foliage === "string" ? decompressFoliage(m.foliage) : m.foliage || [],
            ...m.sand ? { sand: decompressTerrain(m.sand, m.gridSize) } : {}
          };
          delete base.previewBase64;
          return base;
        });
        loadMission(0);
      } catch (e) {
        alert("Import Fehler!\n\n" + e);
      }
    };
  };

  // editor-view-entry/campaign-editor-main.ts
  var vscode = acquireVsCodeApi();
  var styleEl = document.createElement("style");
  styleEl.textContent = style_default;
  document.head.appendChild(styleEl);
  var notifyTimer = null;
  var isLoading = true;
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
    if (notifyTimer) clearTimeout(notifyTimer);
    if (isLoading) return;
    vscode.postMessage({ type: "missionIndex", value: state.curIdx });
    notifyTimer = setTimeout(() => {
      const content = doExport();
      if (content) vscode.postMessage({ type: "change", content });
    }, 400);
  };
  var _showTutorialLock = () => {
    document.body.innerHTML = "";
    const el = document.createElement("div");
    el.style.cssText = "display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;font-size:13px;color:#555;letter-spacing:2px;";
    el.textContent = "TUTORIAL KANN NICHT BEARBEITET WERDEN";
    document.body.appendChild(el);
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
      if (campaignType === "tutorial") {
        _showTutorialLock();
        isLoading = false;
        return;
      }
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
