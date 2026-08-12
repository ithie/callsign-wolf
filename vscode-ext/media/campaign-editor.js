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

  // ../src/game/scene-renderer.ts
  var _POOL_SIZE = 512;
  var _makeInst = () => ({
    def: null,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    colors: void 0,
    depth: 0,
    drawFn: null
  });
  var _scratchPts = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));
  var createSceneRenderer = (ctx, iso2) => {
    const _instances = [];
    const _pool = Array.from({ length: _POOL_SIZE }, _makeInst);
    let _poolNext = 0;
    const _drawCollisionBox = (camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) => {
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const wp = (lx, ly, lz) => ({
        x: wX + lx * cosA - ly * sinA,
        y: wY + lx * sinA + ly * cosA,
        z: lz
      });
      const corners = [
        wp(xMin, yMin, zMin),
        wp(xMax, yMin, zMin),
        wp(xMax, yMax, zMin),
        wp(xMin, yMax, zMin),
        wp(xMin, yMin, zMax),
        wp(xMax, yMin, zMax),
        wp(xMax, yMax, zMax),
        wp(xMin, yMax, zMax)
      ];
      const sc = corners.map((p) => iso2(p.x, p.y, p.z, camX, camY));
      const edges = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7]
      ];
      ctx.save();
      ctx.strokeStyle = color ?? "rgba(0,255,100,0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.shadowColor = color ?? "#00ff66";
      ctx.shadowBlur = 4;
      edges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(sc[a].x, sc[a].y);
        ctx.lineTo(sc[b].x, sc[b].y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    };
    const renderer = {
      drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) {
        _drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color);
      },
      add(def, { x, y, z = 0, angle = 0, colors, drawFn, depth: depthOverride } = {}) {
        const inst = _poolNext < _POOL_SIZE ? _pool[_poolNext++] : _makeInst();
        inst.def = def;
        inst.x = x;
        inst.y = y;
        inst.z = z;
        inst.angle = angle;
        inst.colors = colors;
        inst.depth = depthOverride ?? x + y;
        inst.drawFn = drawFn ?? null;
        _instances.push(inst);
      },
      flush(camX, camY) {
        _instances.sort((a, b) => a.depth - b.depth);
        for (const inst of _instances) {
          if (inst.def) {
            const def = inst.def;
            const pivot = def.pivot ?? [0, 0, 0];
            const cosA = Math.cos(inst.angle), sinA = Math.sin(inst.angle);
            const p0 = pivot[0], p1 = pivot[1], p2 = pivot[2];
            for (const face of def.faces) {
              if (face.normal) {
                const [nx, ny] = face.normal;
                if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
              }
              const verts = face.verts;
              for (let i = 0; i < verts.length; i++) {
                const lx = verts[i][0], ly = verts[i][1], lz = verts[i][2];
                const dx = lx - p0, dy = ly - p1;
                iso2(
                  dx * cosA - dy * sinA + inst.x,
                  dx * sinA + dy * cosA + inst.y,
                  lz - p2 + inst.z,
                  camX,
                  camY,
                  _scratchPts[i]
                );
              }
              let _fcx = 0, _fcy = 0;
              const _fn = verts.length;
              for (let i = 0; i < _fn; i++) {
                _fcx += _scratchPts[i].x;
                _fcy += _scratchPts[i].y;
              }
              _fcx /= _fn;
              _fcy /= _fn;
              ctx.beginPath();
              for (let i = 0; i < _fn; i++) {
                const _dx = _scratchPts[i].x - _fcx, _dy = _scratchPts[i].y - _fcy;
                const _d = Math.hypot(_dx, _dy) || 1;
                const _ex = _fcx + _dx * (1 + 0.5 / _d);
                const _ey = _fcy + _dy * (1 + 0.5 / _d);
                i === 0 ? ctx.moveTo(_ex, _ey) : ctx.lineTo(_ex, _ey);
              }
              ctx.closePath();
              ctx.fillStyle = (inst.colors && inst.colors[face.id]) ?? face.color;
              ctx.fill();
              if (face.stroke) {
                ctx.strokeStyle = face.stroke;
                ctx.lineWidth = face.strokeWidth ?? 1;
                ctx.stroke();
              }
            }
          }
          if (inst.drawFn) inst.drawFn(camX, camY);
        }
        _instances.length = 0;
        _poolNext = 0;
      }
    };
    return renderer;
  };

  // ../src/game/render.ts
  var iso = (vx, vy, h, cx, cy, { canvas, tileW, tileH, stepH }, out) => {
    let cv = canvas || document.getElementById("gameCanvas");
    const px = cv.width / 2 + (vx - vy) * (tileW / 2) - cx;
    const py = cv.height / 2 + (vx + vy) * (tileH / 2) - h * stepH - cy;
    if (out) {
      out.x = px;
      out.y = py;
      return out;
    }
    return { x: px, y: py };
  };
  var createIsoFn = (config) => (wx, wy, wz, cx, cy, out) => iso(wx, wy, wz, cx, cy, config, out);

  // ../src/game/def-utils.ts
  var _rotateVerts = (verts, pivot, axis, angle) => {
    const [px, py, pz] = pivot;
    const [ax, ay, az] = axis;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 1 - cos;
    return verts.map(([x, y, z]) => {
      const dx = x - px, dy = y - py, dz = z - pz;
      const dot = ax * dx + ay * dy + az * dz;
      return [
        px + dx * cos + (ay * dz - az * dy) * sin + ax * dot * t,
        py + dy * cos + (az * dx - ax * dz) * sin + ay * dot * t,
        pz + dz * cos + (ax * dy - ay * dx) * sin + az * dot * t
      ];
    });
  };
  var _buildRotFnCache = (def, params) => {
    const partMap = new Map(def.parts.map((p) => [p.id, p]));
    const cache = /* @__PURE__ */ new Map();
    const getRotFn = (partId) => {
      if (cache.has(partId)) return cache.get(partId);
      const part = partMap.get(partId);
      if (!part) {
        const identity = (v) => v;
        cache.set(partId, identity);
        return identity;
      }
      let fn;
      if (part.parent) {
        const parentFn = getRotFn(part.parent);
        if (part.rotate) {
          const angle = params[part.rotate.param] ?? 0;
          const tPivot = parentFn([part.rotate.pivot])[0];
          const { axis } = part.rotate;
          fn = (verts) => _rotateVerts(parentFn(verts), tPivot, axis, angle);
        } else {
          fn = parentFn;
        }
      } else if (part.rotate) {
        const angle = params[part.rotate.param] ?? 0;
        const { pivot, axis } = part.rotate;
        fn = (verts) => _rotateVerts(verts, pivot, axis, angle);
      } else {
        fn = (verts) => verts;
      }
      cache.set(partId, fn);
      return fn;
    };
    return getRotFn;
  };
  var applyParts = (def, params, opts) => {
    const extraFaces = [];
    if (def.parts?.length) {
      const getRotFn = _buildRotFnCache(def, params);
      for (const part of def.parts) {
        if (opts?.only && !opts.only.includes(part.id)) continue;
        const rotFn = getRotFn(part.id);
        for (const face of part.faces) {
          extraFaces.push({ ...face, verts: rotFn(face.verts) });
        }
      }
    }
    if (def.rotateNodes?.length) {
      for (const node of def.rotateNodes) {
        const angle = params[node.param] ?? 0;
        for (const face of node.faces) {
          extraFaces.push({ ...face, verts: _rotateVerts(face.verts, node.pivot, node.axis, angle) });
        }
      }
    }
    return { ...def, faces: [...def.faces, ...extraFaces] };
  };
  var _id2 = (v) => v;
  var _LIGHT = [-0.267, 0.535, 0.802];
  var _SHADE_AMB = 0.82;
  var _SHADE_DIFF = 0.18;
  var _autoShade = (verts) => {
    if (verts.length < 3) return 1;
    const ax = verts[1][0] - verts[0][0], ay = verts[1][1] - verts[0][1], az = verts[1][2] - verts[0][2];
    const bx = verts[2][0] - verts[0][0], by = verts[2][1] - verts[0][1], bz = verts[2][2] - verts[0][2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-9) return 1;
    const dot = (nx * _LIGHT[0] + ny * _LIGHT[1] + nz * _LIGHT[2]) / len;
    return _SHADE_AMB + _SHADE_DIFF * Math.max(0, dot);
  };
  var _applyShade = (hex, shade) => {
    if (Math.abs(shade - 1) < 2e-3) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((n >> 16 & 255) * shade));
    const g = Math.min(255, Math.round((n >> 8 & 255) * shade));
    const b = Math.min(255, Math.round((n & 255) * shade));
    return "#" + (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
  };
  var _rotNorm = (n, rotFn) => {
    const [[ox, oy], [nx, ny]] = rotFn([[0, 0, 0], [n[0], n[1], 0]]);
    const dx = nx - ox, dy = ny - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return len > 1e-9 ? [dx / len, dy / len] : n;
  };
  var _makeRotFn2 = (node, params, parentFn) => {
    const r = node.rotate;
    let angle;
    if (r.animate) {
      const t = Date.now() * r.animate.speed;
      angle = r.animate.type === "oscillate" ? (r.animate.amplitude ?? 1) * Math.sin(t) : t;
    } else {
      angle = params[r.param ?? ""] ?? 0;
    }
    const tPivot = parentFn([r.pivot])[0];
    return (verts) => _rotateVerts(parentFn(verts), tPivot, r.axis, angle);
  };
  var _collectNode = (node, params, parentFn, outFaces, outSpecial) => {
    const rotFn = node.rotate ? _makeRotFn2(node, params, parentFn) : parentFn;
    for (const face of node.faces ?? []) {
      if (face.type === "line") {
        const [v0, v1] = rotFn([face.verts[0], face.verts[1]]);
        outSpecial.push({ kind: "line", v0, v1, face });
      } else {
        const rotVerts = rotFn(face.verts);
        const shade = face.shade ?? _autoShade(rotVerts);
        const color = _applyShade(face.color, shade);
        const normal = face.normal ? _rotNorm(face.normal, rotFn) : void 0;
        outFaces.push({ ...face, verts: rotVerts, color, ...normal !== void 0 ? { normal } : {} });
      }
    }
    for (const light of node.lights ?? []) {
      const [rl] = rotFn([[light.x, light.y, light.z]]);
      outSpecial.push({ kind: "light", lx: rl[0], ly: rl[1], lz: rl[2], light });
    }
    for (const child of node.children ?? []) {
      _collectNode(child, params, rotFn, outFaces, outSpecial);
    }
  };
  var renderNodes = (def, params, instanceProps, renderer, camX, camY, drawCtx, onBeforeFlush) => {
    const { x: ix, y: iy, z: iz = 0, angle: iAngle = 0 } = instanceProps;
    const cosA = Math.cos(iAngle), sinA = Math.sin(iAngle);
    for (const topNode of def.nodes) {
      const faces = [];
      const special = [];
      _collectNode(topNode, params, _id2, faces, special);
      let baseDepth;
      if (topNode.depthAnchor) {
        const [dx, dy] = topNode.depthAnchor;
        baseDepth = ix + dx * cosA - dy * sinA + (iy + dx * sinA + dy * cosA);
        for (let fi = 0; fi < faces.length; fi++) {
          renderer.add({ id: def.id, faces: [faces[fi]] }, { ...instanceProps, depth: baseDepth + fi * 1e-7 });
        }
      } else {
        baseDepth = ix + iy;
        const cApS = cosA + sinA, cAmS = cosA - sinA;
        const sides = [];
        const tops = [];
        faces.forEach((face, fi) => {
          if (face.normal) {
            const verts = face.verts;
            let lcx = 0, lcy = 0;
            for (const v of verts) {
              lcx += v[0];
              lcy += v[1];
            }
            lcx /= verts.length;
            lcy /= verts.length;
            sides.push({ face, key: lcx * cApS + lcy * cAmS + fi * 1e-9 });
          } else {
            tops.push(face);
          }
        });
        sides.sort((a, b) => a.key - b.key);
        const allSorted = [...sides.map((e) => e.face), ...tops];
        for (let si = 0; si < allSorted.length; si++) {
          renderer.add({ id: def.id, faces: [allSorted[si]] }, { ...instanceProps, depth: baseDepth + si * 1e-7 });
        }
      }
      if (drawCtx) {
        const { ctx, isoFn, tileW } = drawCtx;
        for (const item of special) {
          if (item.kind === "light") {
            const { lx, ly, lz, light } = item;
            const wx = ix + lx * cosA - ly * sinA;
            const wy = iy + lx * sinA + ly * cosA;
            const wz = iz + lz;
            const blink = light.blink ?? false;
            const radius = light.radius ?? 2;
            renderer.add(null, {
              x: wx,
              y: wy,
              z: wz,
              drawFn: (cx, cy) => {
                const isOn = !blink || Math.floor(Date.now() / 500) % 2 === 0;
                const p = isoFn(wx, wy, wz, cx, cy);
                ctx.fillStyle = isOn ? light.color : light.colorOff ?? light.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1.2, radius * tileW / 64), 0, 7);
                ctx.fill();
              }
            });
          } else {
            const { v0, v1, face } = item;
            const wx0 = ix + v0[0] * cosA - v0[1] * sinA, wy0 = iy + v0[0] * sinA + v0[1] * cosA, wz0 = iz + v0[2];
            const wx1 = ix + v1[0] * cosA - v1[1] * sinA, wy1 = iy + v1[0] * sinA + v1[1] * cosA, wz1 = iz + v1[2];
            renderer.add(null, {
              x: (wx0 + wx1) / 2,
              y: (wy0 + wy1) / 2,
              z: (wz0 + wz1) / 2,
              drawFn: (cx, cy) => {
                const p0 = isoFn(wx0, wy0, wz0, cx, cy);
                const p1 = isoFn(wx1, wy1, wz1, cx, cy);
                ctx.strokeStyle = face.color;
                ctx.lineWidth = face.lineWidth ?? 1;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
              }
            });
          }
        }
      }
      if (onBeforeFlush) onBeforeFlush(def.nodes.indexOf(topNode));
      renderer.flush(camX, camY);
    }
  };

  // ../src/game/models/objects/lighthouse.zdef
  var lighthouse_default = {
    id: "lighthouse",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "base",
        xMin: -1,
        xMax: 1,
        yMin: -1,
        yMax: 1,
        zMin: 0,
        zMax: 0.4
      },
      {
        id: "tower",
        xMin: -0.45,
        xMax: 0.45,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0.4,
        zMax: 8.5
      }
    ],
    faces: [
      {
        id: "rock_e",
        verts: [
          [
            1,
            -0.2,
            0.14
          ],
          [
            2.2,
            -0.5,
            0.14
          ],
          [
            2.5,
            0.05,
            0.14
          ],
          [
            2.1,
            0.65,
            0.14
          ],
          [
            1.55,
            1,
            0.14
          ],
          [
            0.95,
            0.5,
            0.14
          ]
        ],
        color: "#585858",
        stroke: null
      },
      {
        id: "rock_ne",
        verts: [
          [
            0.5,
            0.9,
            0.11
          ],
          [
            1,
            1.4,
            0.11
          ],
          [
            0.5,
            2.3,
            0.11
          ],
          [
            -0.1,
            1.9,
            0.11
          ],
          [
            -0.2,
            1.1,
            0.11
          ]
        ],
        color: "#5a5a5a",
        stroke: null
      },
      {
        id: "rock_ne2",
        verts: [
          [
            0.85,
            1,
            0.17
          ],
          [
            1.5,
            1.05,
            0.17
          ],
          [
            1.7,
            1.7,
            0.17
          ],
          [
            1,
            2,
            0.17
          ],
          [
            0.55,
            1.6,
            0.17
          ]
        ],
        color: "#626262",
        stroke: null
      },
      {
        id: "rock_n",
        verts: [
          [
            -0.2,
            0.95,
            0.12
          ],
          [
            -0.05,
            1.85,
            0.12
          ],
          [
            -0.7,
            2.4,
            0.12
          ],
          [
            -1.5,
            2,
            0.12
          ],
          [
            -1.6,
            1.35,
            0.12
          ],
          [
            -0.9,
            0.85,
            0.12
          ]
        ],
        color: "#505050",
        stroke: null
      },
      {
        id: "rock_nw1",
        verts: [
          [
            -0.85,
            0.6,
            0.07
          ],
          [
            -1.8,
            0.7,
            0.07
          ],
          [
            -2.2,
            0.2,
            0.07
          ],
          [
            -1.95,
            -0.2,
            0.07
          ],
          [
            -1.1,
            0.1,
            0.07
          ]
        ],
        color: "#484848",
        stroke: null
      },
      {
        id: "rock_nw2",
        verts: [
          [
            -1,
            0.3,
            0.15
          ],
          [
            -1.7,
            0.5,
            0.15
          ],
          [
            -2.3,
            -0.05,
            0.15
          ],
          [
            -2,
            -0.7,
            0.15
          ],
          [
            -1.35,
            -0.6,
            0.15
          ],
          [
            -0.9,
            -0.3,
            0.15
          ]
        ],
        color: "#565656",
        stroke: null
      },
      {
        id: "rock_w",
        verts: [
          [
            -0.95,
            -0.35,
            0.09
          ],
          [
            -2,
            -0.3,
            0.09
          ],
          [
            -2.4,
            -0.6,
            0.09
          ],
          [
            -2.1,
            -1.1,
            0.09
          ],
          [
            -1.3,
            -0.8,
            0.09
          ],
          [
            -0.9,
            -0.55,
            0.09
          ]
        ],
        color: "#4e4e4e",
        stroke: null
      },
      {
        id: "rock_sw1",
        verts: [
          [
            -0.7,
            -0.6,
            0.16
          ],
          [
            -1.35,
            -0.9,
            0.16
          ],
          [
            -1.85,
            -1.5,
            0.16
          ],
          [
            -1.3,
            -2,
            0.16
          ],
          [
            -0.6,
            -1.7,
            0.16
          ],
          [
            -0.1,
            -1,
            0.16
          ]
        ],
        color: "#5c5c5c",
        stroke: null
      },
      {
        id: "rock_sw2",
        verts: [
          [
            -1,
            -1.4,
            0.2
          ],
          [
            -1.5,
            -1.35,
            0.2
          ],
          [
            -1.6,
            -1.9,
            0.2
          ],
          [
            -1,
            -2,
            0.2
          ],
          [
            -0.7,
            -1.6,
            0.2
          ]
        ],
        color: "#646464",
        stroke: null
      },
      {
        id: "rock_s",
        verts: [
          [
            0.1,
            -1,
            0.1
          ],
          [
            0.6,
            -1.6,
            0.1
          ],
          [
            1,
            -2.2,
            0.1
          ],
          [
            1.5,
            -1.7,
            0.1
          ],
          [
            1.2,
            -1.05,
            0.1
          ],
          [
            0.7,
            -0.85,
            0.1
          ]
        ],
        color: "#4c4c4c",
        stroke: null
      },
      {
        id: "rock_se",
        verts: [
          [
            0.9,
            -0.75,
            0.13
          ],
          [
            1.7,
            -0.65,
            0.13
          ],
          [
            2.3,
            -1.1,
            0.13
          ],
          [
            1.8,
            -1.9,
            0.13
          ],
          [
            0.9,
            -1.7,
            0.13
          ],
          [
            0.6,
            -1.1,
            0.13
          ]
        ],
        color: "#545454",
        stroke: null
      },
      {
        id: "rock_ese",
        verts: [
          [
            1.05,
            -0.35,
            0.08
          ],
          [
            1.8,
            -0.4,
            0.08
          ],
          [
            1.75,
            -0.9,
            0.08
          ],
          [
            1.2,
            -0.85,
            0.08
          ]
        ],
        color: "#5e5e5e",
        stroke: null
      },
      {
        id: "rock_na",
        verts: [
          [
            -0.5,
            0.95,
            0.22
          ],
          [
            -0.35,
            1.55,
            0.22
          ],
          [
            -0.75,
            1.65,
            0.22
          ],
          [
            -1.05,
            1.2,
            0.22
          ]
        ],
        color: "#686868",
        stroke: null
      },
      {
        id: "rock_et",
        verts: [
          [
            0.85,
            0.55,
            0.08
          ],
          [
            1.6,
            0.5,
            0.08
          ],
          [
            1.7,
            1.15,
            0.08
          ],
          [
            1.05,
            1.3,
            0.08
          ],
          [
            0.7,
            0.85,
            0.08
          ]
        ],
        color: "#4a4a4a",
        stroke: null
      },
      {
        id: "cap_z0.4",
        verts: [
          [
            1,
            0,
            0.4
          ],
          [
            0.98079,
            0.19509,
            0.4
          ],
          [
            0.92388,
            0.38268,
            0.4
          ],
          [
            0.83147,
            0.55557,
            0.4
          ],
          [
            0.70711,
            0.70711,
            0.4
          ],
          [
            0.55557,
            0.83147,
            0.4
          ],
          [
            0.38268,
            0.92388,
            0.4
          ],
          [
            0.19509,
            0.98079,
            0.4
          ],
          [
            0,
            1,
            0.4
          ],
          [
            -0.19509,
            0.98079,
            0.4
          ],
          [
            -0.38268,
            0.92388,
            0.4
          ],
          [
            -0.55557,
            0.83147,
            0.4
          ],
          [
            -0.70711,
            0.70711,
            0.4
          ],
          [
            -0.83147,
            0.55557,
            0.4
          ],
          [
            -0.92388,
            0.38268,
            0.4
          ],
          [
            -0.98079,
            0.19509,
            0.4
          ],
          [
            -1,
            0,
            0.4
          ],
          [
            -0.98079,
            -0.19509,
            0.4
          ],
          [
            -0.92388,
            -0.38268,
            0.4
          ],
          [
            -0.83147,
            -0.55557,
            0.4
          ],
          [
            -0.70711,
            -0.70711,
            0.4
          ],
          [
            -0.55557,
            -0.83147,
            0.4
          ],
          [
            -0.38268,
            -0.92388,
            0.4
          ],
          [
            -0.19509,
            -0.98079,
            0.4
          ],
          [
            0,
            -1,
            0.4
          ],
          [
            0.19509,
            -0.98079,
            0.4
          ],
          [
            0.38268,
            -0.92388,
            0.4
          ],
          [
            0.55557,
            -0.83147,
            0.4
          ],
          [
            0.70711,
            -0.70711,
            0.4
          ],
          [
            0.83147,
            -0.55557,
            0.4
          ],
          [
            0.92388,
            -0.38268,
            0.4
          ],
          [
            0.98079,
            -0.19509,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_0_z0",
        verts: [
          [
            1,
            0,
            0
          ],
          [
            0.98079,
            0.19509,
            0
          ],
          [
            0.98079,
            0.19509,
            0.4
          ],
          [
            1,
            0,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_1_z0",
        verts: [
          [
            0.98079,
            0.19509,
            0
          ],
          [
            0.92388,
            0.38268,
            0
          ],
          [
            0.92388,
            0.38268,
            0.4
          ],
          [
            0.98079,
            0.19509,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_2_z0",
        verts: [
          [
            0.92388,
            0.38268,
            0
          ],
          [
            0.83147,
            0.55557,
            0
          ],
          [
            0.83147,
            0.55557,
            0.4
          ],
          [
            0.92388,
            0.38268,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_3_z0",
        verts: [
          [
            0.83147,
            0.55557,
            0
          ],
          [
            0.70711,
            0.70711,
            0
          ],
          [
            0.70711,
            0.70711,
            0.4
          ],
          [
            0.83147,
            0.55557,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_4_z0",
        verts: [
          [
            0.70711,
            0.70711,
            0
          ],
          [
            0.55557,
            0.83147,
            0
          ],
          [
            0.55557,
            0.83147,
            0.4
          ],
          [
            0.70711,
            0.70711,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_5_z0",
        verts: [
          [
            0.55557,
            0.83147,
            0
          ],
          [
            0.38268,
            0.92388,
            0
          ],
          [
            0.38268,
            0.92388,
            0.4
          ],
          [
            0.55557,
            0.83147,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_6_z0",
        verts: [
          [
            0.38268,
            0.92388,
            0
          ],
          [
            0.19509,
            0.98079,
            0
          ],
          [
            0.19509,
            0.98079,
            0.4
          ],
          [
            0.38268,
            0.92388,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_7_z0",
        verts: [
          [
            0.19509,
            0.98079,
            0
          ],
          [
            0,
            1,
            0
          ],
          [
            0,
            1,
            0.4
          ],
          [
            0.19509,
            0.98079,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_8_z0",
        verts: [
          [
            0,
            1,
            0
          ],
          [
            -0.19509,
            0.98079,
            0
          ],
          [
            -0.19509,
            0.98079,
            0.4
          ],
          [
            0,
            1,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_9_z0",
        verts: [
          [
            -0.19509,
            0.98079,
            0
          ],
          [
            -0.38268,
            0.92388,
            0
          ],
          [
            -0.38268,
            0.92388,
            0.4
          ],
          [
            -0.19509,
            0.98079,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_10_z0",
        verts: [
          [
            -0.38268,
            0.92388,
            0
          ],
          [
            -0.55557,
            0.83147,
            0
          ],
          [
            -0.55557,
            0.83147,
            0.4
          ],
          [
            -0.38268,
            0.92388,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_11_z0",
        verts: [
          [
            -0.55557,
            0.83147,
            0
          ],
          [
            -0.70711,
            0.70711,
            0
          ],
          [
            -0.70711,
            0.70711,
            0.4
          ],
          [
            -0.55557,
            0.83147,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_28_z0",
        verts: [
          [
            0.70711,
            -0.70711,
            0
          ],
          [
            0.83147,
            -0.55557,
            0
          ],
          [
            0.83147,
            -0.55557,
            0.4
          ],
          [
            0.70711,
            -0.70711,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_29_z0",
        verts: [
          [
            0.83147,
            -0.55557,
            0
          ],
          [
            0.92388,
            -0.38268,
            0
          ],
          [
            0.92388,
            -0.38268,
            0.4
          ],
          [
            0.83147,
            -0.55557,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_30_z0",
        verts: [
          [
            0.92388,
            -0.38268,
            0
          ],
          [
            0.98079,
            -0.19509,
            0
          ],
          [
            0.98079,
            -0.19509,
            0.4
          ],
          [
            0.92388,
            -0.38268,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "side_31_z0",
        verts: [
          [
            0.98079,
            -0.19509,
            0
          ],
          [
            1,
            0,
            0
          ],
          [
            1,
            0,
            0.4
          ],
          [
            0.98079,
            -0.19509,
            0.4
          ]
        ],
        color: "#404040",
        stroke: null
      },
      {
        id: "cap_z3",
        verts: [
          [
            0.45,
            0,
            3
          ],
          [
            0.41575,
            0.17221,
            3
          ],
          [
            0.3182,
            0.3182,
            3
          ],
          [
            0.17221,
            0.41575,
            3
          ],
          [
            0,
            0.45,
            3
          ],
          [
            -0.17221,
            0.41575,
            3
          ],
          [
            -0.3182,
            0.3182,
            3
          ],
          [
            -0.41575,
            0.17221,
            3
          ],
          [
            -0.45,
            0,
            3
          ],
          [
            -0.41575,
            -0.17221,
            3
          ],
          [
            -0.3182,
            -0.3182,
            3
          ],
          [
            -0.17221,
            -0.41575,
            3
          ],
          [
            0,
            -0.45,
            3
          ],
          [
            0.17221,
            -0.41575,
            3
          ],
          [
            0.3182,
            -0.3182,
            3
          ],
          [
            0.41575,
            -0.17221,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_0_z0.4",
        verts: [
          [
            0.45,
            0,
            0.4
          ],
          [
            0.41575,
            0.17221,
            0.4
          ],
          [
            0.41575,
            0.17221,
            3
          ],
          [
            0.45,
            0,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_1_z0.4",
        verts: [
          [
            0.41575,
            0.17221,
            0.4
          ],
          [
            0.3182,
            0.3182,
            0.4
          ],
          [
            0.3182,
            0.3182,
            3
          ],
          [
            0.41575,
            0.17221,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_2_z0.4",
        verts: [
          [
            0.3182,
            0.3182,
            0.4
          ],
          [
            0.17221,
            0.41575,
            0.4
          ],
          [
            0.17221,
            0.41575,
            3
          ],
          [
            0.3182,
            0.3182,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_3_z0.4",
        verts: [
          [
            0.17221,
            0.41575,
            0.4
          ],
          [
            0,
            0.45,
            0.4
          ],
          [
            0,
            0.45,
            3
          ],
          [
            0.17221,
            0.41575,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_4_z0.4",
        verts: [
          [
            0,
            0.45,
            0.4
          ],
          [
            -0.17221,
            0.41575,
            0.4
          ],
          [
            -0.17221,
            0.41575,
            3
          ],
          [
            0,
            0.45,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_5_z0.4",
        verts: [
          [
            -0.17221,
            0.41575,
            0.4
          ],
          [
            -0.3182,
            0.3182,
            0.4
          ],
          [
            -0.3182,
            0.3182,
            3
          ],
          [
            -0.17221,
            0.41575,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_14_z0.4",
        verts: [
          [
            0.3182,
            -0.3182,
            0.4
          ],
          [
            0.41575,
            -0.17221,
            0.4
          ],
          [
            0.41575,
            -0.17221,
            3
          ],
          [
            0.3182,
            -0.3182,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_15_z0.4",
        verts: [
          [
            0.41575,
            -0.17221,
            0.4
          ],
          [
            0.45,
            0,
            0.4
          ],
          [
            0.45,
            0,
            3
          ],
          [
            0.41575,
            -0.17221,
            3
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "cap_z6",
        verts: [
          [
            0.45,
            0,
            6
          ],
          [
            0.41575,
            0.17221,
            6
          ],
          [
            0.3182,
            0.3182,
            6
          ],
          [
            0.17221,
            0.41575,
            6
          ],
          [
            0,
            0.45,
            6
          ],
          [
            -0.17221,
            0.41575,
            6
          ],
          [
            -0.3182,
            0.3182,
            6
          ],
          [
            -0.41575,
            0.17221,
            6
          ],
          [
            -0.45,
            0,
            6
          ],
          [
            -0.41575,
            -0.17221,
            6
          ],
          [
            -0.3182,
            -0.3182,
            6
          ],
          [
            -0.17221,
            -0.41575,
            6
          ],
          [
            0,
            -0.45,
            6
          ],
          [
            0.17221,
            -0.41575,
            6
          ],
          [
            0.3182,
            -0.3182,
            6
          ],
          [
            0.41575,
            -0.17221,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_0_z3",
        verts: [
          [
            0.45,
            0,
            3
          ],
          [
            0.41575,
            0.17221,
            3
          ],
          [
            0.41575,
            0.17221,
            6
          ],
          [
            0.45,
            0,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_1_z3",
        verts: [
          [
            0.41575,
            0.17221,
            3
          ],
          [
            0.3182,
            0.3182,
            3
          ],
          [
            0.3182,
            0.3182,
            6
          ],
          [
            0.41575,
            0.17221,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_2_z3",
        verts: [
          [
            0.3182,
            0.3182,
            3
          ],
          [
            0.17221,
            0.41575,
            3
          ],
          [
            0.17221,
            0.41575,
            6
          ],
          [
            0.3182,
            0.3182,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_3_z3",
        verts: [
          [
            0.17221,
            0.41575,
            3
          ],
          [
            0,
            0.45,
            3
          ],
          [
            0,
            0.45,
            6
          ],
          [
            0.17221,
            0.41575,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_4_z3",
        verts: [
          [
            0,
            0.45,
            3
          ],
          [
            -0.17221,
            0.41575,
            3
          ],
          [
            -0.17221,
            0.41575,
            6
          ],
          [
            0,
            0.45,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_5_z3",
        verts: [
          [
            -0.17221,
            0.41575,
            3
          ],
          [
            -0.3182,
            0.3182,
            3
          ],
          [
            -0.3182,
            0.3182,
            6
          ],
          [
            -0.17221,
            0.41575,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_14_z3",
        verts: [
          [
            0.3182,
            -0.3182,
            3
          ],
          [
            0.41575,
            -0.17221,
            3
          ],
          [
            0.41575,
            -0.17221,
            6
          ],
          [
            0.3182,
            -0.3182,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "side_15_z3",
        verts: [
          [
            0.41575,
            -0.17221,
            3
          ],
          [
            0.45,
            0,
            3
          ],
          [
            0.45,
            0,
            6
          ],
          [
            0.41575,
            -0.17221,
            6
          ]
        ],
        color: "#eeeeee",
        stroke: null
      },
      {
        id: "cap_z7",
        verts: [
          [
            0.45,
            0,
            7
          ],
          [
            0.41575,
            0.17221,
            7
          ],
          [
            0.3182,
            0.3182,
            7
          ],
          [
            0.17221,
            0.41575,
            7
          ],
          [
            0,
            0.45,
            7
          ],
          [
            -0.17221,
            0.41575,
            7
          ],
          [
            -0.3182,
            0.3182,
            7
          ],
          [
            -0.41575,
            0.17221,
            7
          ],
          [
            -0.45,
            0,
            7
          ],
          [
            -0.41575,
            -0.17221,
            7
          ],
          [
            -0.3182,
            -0.3182,
            7
          ],
          [
            -0.17221,
            -0.41575,
            7
          ],
          [
            0,
            -0.45,
            7
          ],
          [
            0.17221,
            -0.41575,
            7
          ],
          [
            0.3182,
            -0.3182,
            7
          ],
          [
            0.41575,
            -0.17221,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_0_z6",
        verts: [
          [
            0.45,
            0,
            6
          ],
          [
            0.41575,
            0.17221,
            6
          ],
          [
            0.41575,
            0.17221,
            7
          ],
          [
            0.45,
            0,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_1_z6",
        verts: [
          [
            0.41575,
            0.17221,
            6
          ],
          [
            0.3182,
            0.3182,
            6
          ],
          [
            0.3182,
            0.3182,
            7
          ],
          [
            0.41575,
            0.17221,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_2_z6",
        verts: [
          [
            0.3182,
            0.3182,
            6
          ],
          [
            0.17221,
            0.41575,
            6
          ],
          [
            0.17221,
            0.41575,
            7
          ],
          [
            0.3182,
            0.3182,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_3_z6",
        verts: [
          [
            0.17221,
            0.41575,
            6
          ],
          [
            0,
            0.45,
            6
          ],
          [
            0,
            0.45,
            7
          ],
          [
            0.17221,
            0.41575,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_4_z6",
        verts: [
          [
            0,
            0.45,
            6
          ],
          [
            -0.17221,
            0.41575,
            6
          ],
          [
            -0.17221,
            0.41575,
            7
          ],
          [
            0,
            0.45,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_5_z6",
        verts: [
          [
            -0.17221,
            0.41575,
            6
          ],
          [
            -0.3182,
            0.3182,
            6
          ],
          [
            -0.3182,
            0.3182,
            7
          ],
          [
            -0.17221,
            0.41575,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_14_z6",
        verts: [
          [
            0.3182,
            -0.3182,
            6
          ],
          [
            0.41575,
            -0.17221,
            6
          ],
          [
            0.41575,
            -0.17221,
            7
          ],
          [
            0.3182,
            -0.3182,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "side_15_z6",
        verts: [
          [
            0.41575,
            -0.17221,
            6
          ],
          [
            0.45,
            0,
            6
          ],
          [
            0.45,
            0,
            7
          ],
          [
            0.41575,
            -0.17221,
            7
          ]
        ],
        color: "#cc2222",
        stroke: null
      },
      {
        id: "cap_z8",
        verts: [
          [
            0.45,
            0,
            8
          ],
          [
            0.41575,
            0.17221,
            8
          ],
          [
            0.3182,
            0.3182,
            8
          ],
          [
            0.17221,
            0.41575,
            8
          ],
          [
            0,
            0.45,
            8
          ],
          [
            -0.17221,
            0.41575,
            8
          ],
          [
            -0.3182,
            0.3182,
            8
          ],
          [
            -0.41575,
            0.17221,
            8
          ],
          [
            -0.45,
            0,
            8
          ],
          [
            -0.41575,
            -0.17221,
            8
          ],
          [
            -0.3182,
            -0.3182,
            8
          ],
          [
            -0.17221,
            -0.41575,
            8
          ],
          [
            0,
            -0.45,
            8
          ],
          [
            0.17221,
            -0.41575,
            8
          ],
          [
            0.3182,
            -0.3182,
            8
          ],
          [
            0.41575,
            -0.17221,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_0_z7",
        verts: [
          [
            0.45,
            0,
            7
          ],
          [
            0.41575,
            0.17221,
            7
          ],
          [
            0.41575,
            0.17221,
            8
          ],
          [
            0.45,
            0,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_1_z7",
        verts: [
          [
            0.41575,
            0.17221,
            7
          ],
          [
            0.3182,
            0.3182,
            7
          ],
          [
            0.3182,
            0.3182,
            8
          ],
          [
            0.41575,
            0.17221,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_2_z7",
        verts: [
          [
            0.3182,
            0.3182,
            7
          ],
          [
            0.17221,
            0.41575,
            7
          ],
          [
            0.17221,
            0.41575,
            8
          ],
          [
            0.3182,
            0.3182,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_3_z7",
        verts: [
          [
            0.17221,
            0.41575,
            7
          ],
          [
            0,
            0.45,
            7
          ],
          [
            0,
            0.45,
            8
          ],
          [
            0.17221,
            0.41575,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_4_z7",
        verts: [
          [
            0,
            0.45,
            7
          ],
          [
            -0.17221,
            0.41575,
            7
          ],
          [
            -0.17221,
            0.41575,
            8
          ],
          [
            0,
            0.45,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_5_z7",
        verts: [
          [
            -0.17221,
            0.41575,
            7
          ],
          [
            -0.3182,
            0.3182,
            7
          ],
          [
            -0.3182,
            0.3182,
            8
          ],
          [
            -0.17221,
            0.41575,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_14_z7",
        verts: [
          [
            0.3182,
            -0.3182,
            7
          ],
          [
            0.41575,
            -0.17221,
            7
          ],
          [
            0.41575,
            -0.17221,
            8
          ],
          [
            0.3182,
            -0.3182,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      },
      {
        id: "side_15_z7",
        verts: [
          [
            0.41575,
            -0.17221,
            7
          ],
          [
            0.45,
            0,
            7
          ],
          [
            0.45,
            0,
            8
          ],
          [
            0.41575,
            -0.17221,
            8
          ]
        ],
        color: "#ffff88",
        stroke: null
      }
    ]
  };

  // ../src/game/models/objects/wind_turbine.zdef
  var wind_turbine_default = {
    id: "wind_turbine",
    label: "wind_turbine",
    static: true,
    movementType: "none",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "p_base_1",
        verts: [
          [
            0.12,
            0.05,
            0
          ],
          [
            0.12,
            -0.05,
            0
          ],
          [
            0.12,
            -0.05,
            2
          ],
          [
            0.12,
            0.05,
            2
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "p_base_2",
        verts: [
          [
            0.12,
            -0.05,
            0
          ],
          [
            0.05,
            -0.12,
            0
          ],
          [
            0.05,
            -0.12,
            2
          ],
          [
            0.12,
            -0.05,
            2
          ]
        ],
        color: "#eebb00"
      },
      {
        id: "p_base_3",
        verts: [
          [
            0.05,
            -0.12,
            0
          ],
          [
            -0.05,
            -0.12,
            0
          ],
          [
            -0.05,
            -0.12,
            2
          ],
          [
            0.05,
            -0.12,
            2
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "p_base_4",
        verts: [
          [
            -0.05,
            -0.12,
            0
          ],
          [
            -0.12,
            -0.05,
            0
          ],
          [
            -0.12,
            -0.05,
            2
          ],
          [
            -0.05,
            -0.12,
            2
          ]
        ],
        color: "#eebb00"
      },
      {
        id: "p_base_5",
        verts: [
          [
            -0.12,
            -0.05,
            0
          ],
          [
            -0.12,
            0.05,
            0
          ],
          [
            -0.12,
            0.05,
            2
          ],
          [
            -0.12,
            -0.05,
            2
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "p_base_6",
        verts: [
          [
            -0.12,
            0.05,
            0
          ],
          [
            -0.05,
            0.12,
            0
          ],
          [
            -0.05,
            0.12,
            2
          ],
          [
            -0.12,
            0.05,
            2
          ]
        ],
        color: "#eebb00"
      },
      {
        id: "p_base_7",
        verts: [
          [
            -0.05,
            0.12,
            0
          ],
          [
            0.05,
            0.12,
            0
          ],
          [
            0.05,
            0.12,
            2
          ],
          [
            -0.05,
            0.12,
            2
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "p_base_8",
        verts: [
          [
            0.05,
            0.12,
            0
          ],
          [
            0.12,
            0.05,
            0
          ],
          [
            0.12,
            0.05,
            2
          ],
          [
            0.05,
            0.12,
            2
          ]
        ],
        color: "#eebb00"
      }
    ],
    collisionBoxes: [
      {
        id: "pole",
        xMin: -0.15,
        xMax: 0.15,
        yMin: -0.15,
        yMax: 0.15,
        zMin: 0,
        zMax: 12
      },
      {
        id: "nacelle",
        xMin: -0.3,
        xMax: 0.5,
        yMin: -0.15,
        yMax: 0.15,
        zMin: 12,
        zMax: 12.35
      },
      {
        id: "rotor",
        xMin: 0.4,
        xMax: 0.65,
        yMin: -3.6,
        yMax: 3.6,
        zMin: 8.2,
        zMax: 16.2
      }
    ],
    parts: [
      {
        id: "pole",
        rotate: {
          pivot: [
            0,
            0,
            2
          ],
          axis: [
            0,
            1,
            0
          ],
          param: "poleAngle"
        },
        faces: [
          {
            id: "p_main_1",
            verts: [
              [
                0.12,
                0.05,
                2
              ],
              [
                0.12,
                -0.05,
                2
              ],
              [
                0.12,
                -0.05,
                12
              ],
              [
                0.12,
                0.05,
                12
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "p_main_2",
            verts: [
              [
                0.12,
                -0.05,
                2
              ],
              [
                0.05,
                -0.12,
                2
              ],
              [
                0.05,
                -0.12,
                12
              ],
              [
                0.12,
                -0.05,
                12
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "p_main_3",
            verts: [
              [
                0.05,
                -0.12,
                2
              ],
              [
                -0.05,
                -0.12,
                2
              ],
              [
                -0.05,
                -0.12,
                12
              ],
              [
                0.05,
                -0.12,
                12
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "p_main_4",
            verts: [
              [
                -0.05,
                -0.12,
                2
              ],
              [
                -0.12,
                -0.05,
                2
              ],
              [
                -0.12,
                -0.05,
                12
              ],
              [
                -0.05,
                -0.12,
                12
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "p_main_5",
            verts: [
              [
                -0.12,
                -0.05,
                2
              ],
              [
                -0.12,
                0.05,
                2
              ],
              [
                -0.12,
                0.05,
                12
              ],
              [
                -0.12,
                -0.05,
                12
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "p_main_6",
            verts: [
              [
                -0.12,
                0.05,
                2
              ],
              [
                -0.05,
                0.12,
                2
              ],
              [
                -0.05,
                0.12,
                12
              ],
              [
                -0.12,
                0.05,
                12
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "p_main_7",
            verts: [
              [
                -0.05,
                0.12,
                2
              ],
              [
                0.05,
                0.12,
                2
              ],
              [
                0.05,
                0.12,
                12
              ],
              [
                -0.05,
                0.12,
                12
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "p_main_8",
            verts: [
              [
                0.05,
                0.12,
                2
              ],
              [
                0.12,
                0.05,
                2
              ],
              [
                0.12,
                0.05,
                12
              ],
              [
                0.05,
                0.12,
                12
              ]
            ],
            color: "#f2f2f2"
          }
        ]
      },
      {
        id: "nacelle",
        parent: "pole",
        rotate: {
          pivot: [
            0.1,
            0,
            12
          ],
          axis: [
            0,
            1,
            0
          ],
          param: "nacelleAngle"
        },
        faces: [
          {
            id: "n_top",
            verts: [
              [
                0.5,
                0.12,
                12.3
              ],
              [
                0.5,
                -0.12,
                12.3
              ],
              [
                -0.3,
                -0.12,
                12.3
              ],
              [
                -0.3,
                0.12,
                12.3
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "n_front",
            normal: [
              1,
              0
            ],
            verts: [
              [
                0.5,
                -0.12,
                12
              ],
              [
                0.5,
                0.12,
                12
              ],
              [
                0.5,
                0.12,
                12.3
              ],
              [
                0.5,
                -0.12,
                12.3
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "n_back",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                -0.3,
                0.12,
                12
              ],
              [
                -0.3,
                -0.12,
                12
              ],
              [
                -0.3,
                -0.12,
                12.3
              ],
              [
                -0.3,
                0.12,
                12.3
              ]
            ],
            color: "#cccccc"
          },
          {
            id: "n_L",
            normal: [
              0,
              1
            ],
            verts: [
              [
                -0.3,
                0.12,
                12
              ],
              [
                0.5,
                0.12,
                12
              ],
              [
                0.5,
                0.12,
                12.3
              ],
              [
                -0.3,
                0.12,
                12.3
              ]
            ],
            color: "#f2f2f2"
          },
          {
            id: "n_R",
            normal: [
              0,
              -1
            ],
            verts: [
              [
                0.5,
                -0.12,
                12
              ],
              [
                -0.3,
                -0.12,
                12
              ],
              [
                -0.3,
                -0.12,
                12.3
              ],
              [
                0.5,
                -0.12,
                12.3
              ]
            ],
            color: "#e6e6e6"
          }
        ]
      },
      {
        id: "rotor_assembly",
        parent: "nacelle",
        rotate: {
          pivot: [
            0.51,
            0,
            12.15
          ],
          axis: [
            1,
            0,
            0
          ],
          param: "rotorAngle"
        },
        faces: [
          {
            id: "b1",
            verts: [
              [
                0.51,
                0.02,
                12.15
              ],
              [
                0.51,
                -0.02,
                12.15
              ],
              [
                0.51,
                -0.02,
                16.15
              ],
              [
                0.51,
                0.02,
                16.15
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "b2",
            verts: [
              [
                0.51,
                0.02,
                12.15
              ],
              [
                0.51,
                -0.02,
                12.15
              ],
              [
                0.51,
                3.4,
                10.15
              ],
              [
                0.51,
                3.5,
                10.15
              ]
            ],
            color: "#ffffff"
          },
          {
            id: "b3",
            verts: [
              [
                0.51,
                0.02,
                12.15
              ],
              [
                0.51,
                -0.02,
                12.15
              ],
              [
                0.51,
                -3.5,
                10.15
              ],
              [
                0.51,
                -3.4,
                10.15
              ]
            ],
            color: "#ffffff"
          }
        ]
      }
    ],
    rescueZones: [
      {
        x: 0.1,
        y: 0,
        w: 0.6,
        h: 0.2,
        role: "both",
        z: 12.15,
        dz: 2
      }
    ]
  };

  // ../src/game/models/objects/buoy.zdef
  var buoy_default = {
    id: "buoy",
    pivot: [0, 0, 0],
    faces: [
      { id: "body_f", normal: [1, 0], verts: [[0.14, -0.14, 0], [0.14, 0.14, 0], [0.05, 0.05, 0.44], [0.05, -0.05, 0.44]], color: "#dd3300" },
      { id: "body_r", normal: [0, 1], verts: [[-0.14, 0.14, 0], [0.14, 0.14, 0], [0.05, 0.05, 0.44], [-0.05, 0.05, 0.44]], color: "#cc2200" },
      { id: "stripe_f", normal: [1, 0], verts: [[0.142, -0.12, 0.14], [0.142, 0.12, 0.14], [0.142, 0.12, 0.22], [0.142, -0.12, 0.22]], color: "#ffffff" },
      { id: "stripe_r", normal: [0, 1], verts: [[-0.12, 0.142, 0.14], [0.12, 0.142, 0.14], [0.12, 0.142, 0.22], [-0.12, 0.142, 0.22]], color: "#eeeeee" },
      { id: "cap", verts: [[-0.05, -0.05, 0.44], [0.05, -0.05, 0.44], [0.05, 0.05, 0.44], [-0.05, 0.05, 0.44]], color: "#ffcc00" },
      { id: "tip_f", normal: [1, 0], verts: [[0.05, -0.05, 0.44], [0.05, 0.05, 0.44], [0.01, 0.01, 0.58], [0.01, -0.01, 0.58]], color: "#ffcc00" },
      { id: "tip_r", normal: [0, 1], verts: [[-0.05, 0.05, 0.44], [0.05, 0.05, 0.44], [0.01, 0.01, 0.58], [-0.01, 0.01, 0.58]], color: "#ffaa00" }
    ]
  };

  // ../src/game/models/objects/baywatch_car.zdef
  var baywatch_car_default = {
    id: "baywatch_pickup",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "chassis",
        xMin: -0.85,
        xMax: 0.935,
        yMin: -0.425,
        yMax: 0.425,
        zMin: 0,
        zMax: 0.8075
      }
    ],
    faces: [
      {
        id: "base_bottom",
        verts: [
          [
            -0.85,
            -0.408,
            0.085
          ],
          [
            0.935,
            -0.408,
            0.085
          ],
          [
            0.935,
            0.408,
            0.085
          ],
          [
            -0.85,
            0.408,
            0.085
          ]
        ],
        color: "#111111"
      },
      {
        id: "side_low_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.85,
            -0.408,
            0.085
          ],
          [
            0.935,
            -0.408,
            0.085
          ],
          [
            0.935,
            -0.408,
            0.187
          ],
          [
            -0.85,
            -0.408,
            0.187
          ]
        ],
        color: "#aa1a00"
      },
      {
        id: "side_low_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.935,
            0.408,
            0.085
          ],
          [
            -0.85,
            0.408,
            0.085
          ],
          [
            -0.85,
            0.408,
            0.187
          ],
          [
            0.935,
            0.408,
            0.187
          ]
        ],
        color: "#991400"
      },
      {
        id: "bumper_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.935,
            -0.408,
            0.068
          ],
          [
            0.935,
            0.408,
            0.068
          ],
          [
            0.935,
            0.408,
            0.17
          ],
          [
            0.935,
            -0.408,
            0.17
          ]
        ],
        color: "#222222"
      },
      {
        id: "bumper_b",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.85,
            0.408,
            0.068
          ],
          [
            -0.85,
            -0.408,
            0.068
          ],
          [
            -0.85,
            -0.408,
            0.17
          ],
          [
            -0.85,
            -0.408,
            0.17
          ]
        ],
        color: "#222222"
      },
      {
        id: "wh_rl_o",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.68,
            -0.425,
            0
          ],
          [
            -0.425,
            -0.425,
            0
          ],
          [
            -0.425,
            -0.425,
            0.204
          ],
          [
            -0.68,
            -0.425,
            0.204
          ]
        ],
        color: "#222222"
      },
      {
        id: "wh_rr_o",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.425,
            0.425,
            0
          ],
          [
            -0.68,
            0.425,
            0
          ],
          [
            -0.68,
            0.425,
            0.204
          ],
          [
            -0.425,
            0.425,
            0.204
          ]
        ],
        color: "#1a1a1a"
      },
      {
        id: "wh_fl_o",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.425,
            -0.425,
            0
          ],
          [
            0.68,
            -0.425,
            0
          ],
          [
            0.68,
            -0.425,
            0.204
          ],
          [
            0.425,
            -0.425,
            0.204
          ]
        ],
        color: "#222222"
      },
      {
        id: "wh_fr_o",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.68,
            0.425,
            0
          ],
          [
            0.425,
            0.425,
            0
          ],
          [
            0.425,
            0.425,
            0.204
          ],
          [
            0.68,
            0.425,
            0.204
          ]
        ],
        color: "#1a1a1a"
      },
      {
        id: "hood_top",
        verts: [
          [
            0.255,
            -0.408,
            0.442
          ],
          [
            0.85,
            -0.408,
            0.408
          ],
          [
            0.85,
            0.408,
            0.408
          ],
          [
            0.255,
            0.408,
            0.442
          ]
        ],
        color: "#f5c400"
      },
      {
        id: "grill_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.85,
            -0.408,
            0.187
          ],
          [
            0.85,
            0.408,
            0.187
          ],
          [
            0.85,
            0.408,
            0.408
          ],
          [
            0.85,
            -0.408,
            0.408
          ]
        ],
        color: "#e0b300"
      },
      {
        id: "grill_mesh",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.85085,
            -0.323,
            0.221
          ],
          [
            0.85085,
            0.323,
            0.221
          ],
          [
            0.85085,
            0.323,
            0.357
          ],
          [
            0.85085,
            -0.323,
            0.357
          ]
        ],
        color: "#222222"
      },
      {
        id: "headlight_l",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.85085,
            -0.391,
            0.289
          ],
          [
            0.85085,
            -0.3315,
            0.289
          ],
          [
            0.85085,
            -0.3315,
            0.357
          ],
          [
            0.85085,
            -0.391,
            0.357
          ]
        ],
        color: "#fffebb"
      },
      {
        id: "headlight_r",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.85085,
            0.3315,
            0.289
          ],
          [
            0.85085,
            0.391,
            0.289
          ],
          [
            0.85085,
            0.391,
            0.357
          ],
          [
            0.85085,
            0.3315,
            0.357
          ]
        ],
        color: "#fffebb"
      },
      {
        id: "body_side_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.255,
            -0.408,
            0.187
          ],
          [
            0.85,
            -0.408,
            0.187
          ],
          [
            0.85,
            -0.408,
            0.408
          ],
          [
            0.255,
            -0.408,
            0.442
          ]
        ],
        color: "#f5c400"
      },
      {
        id: "body_side_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.85,
            0.408,
            0.187
          ],
          [
            0.255,
            0.408,
            0.187
          ],
          [
            0.255,
            0.408,
            0.442
          ],
          [
            0.85,
            0.408,
            0.408
          ]
        ],
        color: "#d6ab00"
      },
      {
        id: "bed_floor",
        verts: [
          [
            -0.8075,
            -0.357,
            0.204
          ],
          [
            0.255,
            -0.357,
            0.204
          ],
          [
            0.255,
            0.357,
            0.204
          ],
          [
            -0.8075,
            0.357,
            0.204
          ]
        ],
        color: "#333333"
      },
      {
        id: "bed_wall_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.255,
            -0.357,
            0.204
          ],
          [
            0.255,
            0.357,
            0.204
          ],
          [
            0.255,
            0.357,
            0.442
          ],
          [
            0.255,
            -0.357,
            0.442
          ]
        ],
        color: "#d6ab00"
      },
      {
        id: "bed_side_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.85,
            -0.408,
            0.187
          ],
          [
            0.255,
            -0.408,
            0.187
          ],
          [
            0.255,
            -0.408,
            0.442
          ],
          [
            -0.85,
            -0.408,
            0.442
          ]
        ],
        color: "#f5c400"
      },
      {
        id: "bed_side_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.255,
            0.408,
            0.187
          ],
          [
            -0.85,
            0.408,
            0.187
          ],
          [
            -0.85,
            0.408,
            0.442
          ],
          [
            0.255,
            0.408,
            0.442
          ]
        ],
        color: "#d6ab00"
      },
      {
        id: "bed_tailgate",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.85,
            0.408,
            0.187
          ],
          [
            -0.85,
            -0.408,
            0.187
          ],
          [
            -0.85,
            -0.408,
            0.442
          ],
          [
            -0.85,
            0.408,
            0.442
          ]
        ],
        color: "#c29b00"
      },
      {
        id: "cab_back",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.425,
            0.3825,
            0.442
          ],
          [
            -0.425,
            -0.3825,
            0.442
          ],
          [
            -0.425,
            -0.3825,
            0.748
          ],
          [
            -0.425,
            0.3825,
            0.748
          ]
        ],
        color: "#c29b00"
      },
      {
        id: "cab_side_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.425,
            -0.3825,
            0.442
          ],
          [
            0.255,
            -0.3825,
            0.442
          ],
          [
            0.17,
            -0.3825,
            0.748
          ],
          [
            -0.425,
            -0.3825,
            0.748
          ]
        ],
        color: "#f5c400"
      },
      {
        id: "cab_side_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.255,
            0.3825,
            0.442
          ],
          [
            -0.425,
            0.3825,
            0.442
          ],
          [
            -0.425,
            0.3825,
            0.748
          ],
          [
            0.17,
            0.3825,
            0.748
          ]
        ],
        color: "#d6ab00"
      },
      {
        id: "cab_roof",
        verts: [
          [
            -0.425,
            -0.3825,
            0.748
          ],
          [
            0.17,
            -0.3825,
            0.748
          ],
          [
            0.17,
            0.3825,
            0.748
          ],
          [
            -0.425,
            0.3825,
            0.748
          ]
        ],
        color: "#f5c400"
      },
      {
        id: "windshield",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.255,
            -0.357,
            0.442
          ],
          [
            0.255,
            0.357,
            0.442
          ],
          [
            0.17,
            0.357,
            0.731
          ],
          [
            0.17,
            -0.357,
            0.731
          ]
        ],
        color: "#223344"
      },
      {
        id: "win_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.34,
            -0.38335,
            0.493
          ],
          [
            0.1275,
            -0.38335,
            0.493
          ],
          [
            0.085,
            -0.38335,
            0.714
          ],
          [
            -0.34,
            -0.38335,
            0.714
          ]
        ],
        color: "#223344"
      },
      {
        id: "win_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.1275,
            0.38335,
            0.493
          ],
          [
            -0.34,
            0.38335,
            0.493
          ],
          [
            -0.34,
            0.38335,
            0.714
          ],
          [
            0.085,
            0.38335,
            0.714
          ]
        ],
        color: "#1c2a38"
      },
      {
        id: "bar_base",
        verts: [
          [
            -0.17,
            -0.2975,
            0.7565
          ],
          [
            -0.085,
            -0.2975,
            0.7565
          ],
          [
            -0.085,
            0.2975,
            0.7565
          ],
          [
            -0.17,
            0.2975,
            0.7565
          ]
        ],
        color: "#222222"
      },
      {
        id: "light_l",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -0.085,
            -0.2125,
            0.7565
          ],
          [
            -0.085,
            -0.0425,
            0.7565
          ],
          [
            -0.085,
            -0.0425,
            0.799
          ],
          [
            -0.085,
            -0.2125,
            0.799
          ]
        ],
        color: "#ff3300"
      },
      {
        id: "light_r",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -0.085,
            0.0425,
            0.7565
          ],
          [
            -0.085,
            0.2125,
            0.7565
          ],
          [
            -0.085,
            0.2125,
            0.799
          ],
          [
            -0.085,
            0.0425,
            0.799
          ]
        ],
        color: "#ffee00"
      },
      {
        id: "surf1_top",
        verts: [
          [
            -0.765,
            -0.272,
            0.8075
          ],
          [
            0.425,
            -0.272,
            0.8075
          ],
          [
            0.425,
            -0.068,
            0.8075
          ],
          [
            -0.765,
            -0.068,
            0.8075
          ]
        ],
        color: "#ee2200",
        stroke: "#ff4422"
      },
      {
        id: "surf2_top",
        verts: [
          [
            -0.765,
            0.068,
            0.8075
          ],
          [
            0.425,
            0.068,
            0.8075
          ],
          [
            0.425,
            0.272,
            0.8075
          ],
          [
            -0.765,
            0.272,
            0.8075
          ]
        ],
        color: "#ee2200",
        stroke: "#ff4422"
      }
    ]
  };

  // ../src/game/models/objects/baywatch_hq.zdef
  var baywatch_hq_default = {
    id: "baywatch_hq",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "main",
        xMin: -2.2,
        xMax: 2.64,
        yMin: -1.44,
        yMax: 1.44,
        zMin: 0,
        zMax: 2.56
      }
    ],
    faces: [
      {
        id: "wall_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.2,
            -1.36,
            0.24
          ],
          [
            2.2,
            1.36,
            0.24
          ],
          [
            2.2,
            1.36,
            2.48
          ],
          [
            2.2,
            -1.36,
            2.48
          ]
        ],
        color: "#ece8dc"
      },
      {
        id: "wall_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -2.2,
            -1.36,
            0.24
          ],
          [
            2.2,
            -1.36,
            0.24
          ],
          [
            2.2,
            -1.36,
            2.48
          ],
          [
            -2.2,
            -1.36,
            2.48
          ]
        ],
        color: "#dcd8cc"
      },
      {
        id: "wall_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            1.36,
            0.24
          ],
          [
            -2.2,
            1.36,
            0.24
          ],
          [
            -2.2,
            1.36,
            2.48
          ],
          [
            2.2,
            1.36,
            2.48
          ]
        ],
        color: "#d0ccc0"
      },
      {
        id: "wall_b",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -2.2,
            1.36,
            0.24
          ],
          [
            -2.2,
            -1.36,
            0.24
          ],
          [
            -2.2,
            -1.36,
            2.48
          ],
          [
            -2.2,
            1.36,
            2.48
          ]
        ],
        color: "#ccc8bc"
      },
      {
        id: "stripe_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.202,
            -1.36,
            1.58
          ],
          [
            2.202,
            1.36,
            1.58
          ],
          [
            2.202,
            1.36,
            1.96
          ],
          [
            2.202,
            -1.36,
            1.96
          ]
        ],
        color: "#cc2200"
      },
      {
        id: "stripe_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -2.2,
            -1.362,
            1.58
          ],
          [
            2.2,
            -1.362,
            1.58
          ],
          [
            2.2,
            -1.362,
            1.96
          ],
          [
            -2.2,
            -1.362,
            1.96
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "stripe_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            1.362,
            1.58
          ],
          [
            -2.2,
            1.362,
            1.58
          ],
          [
            -2.2,
            1.362,
            1.96
          ],
          [
            2.2,
            1.362,
            1.96
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "roof",
        verts: [
          [
            -2.28,
            -1.44,
            2.48
          ],
          [
            2.28,
            -1.44,
            2.48
          ],
          [
            2.28,
            1.44,
            2.48
          ],
          [
            -2.28,
            1.44,
            2.48
          ]
        ],
        color: "#888880"
      },
      {
        id: "roof_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.28,
            -1.44,
            2.36
          ],
          [
            2.28,
            1.44,
            2.36
          ],
          [
            2.28,
            1.44,
            2.48
          ],
          [
            2.28,
            -1.44,
            2.48
          ]
        ],
        color: "#777870"
      },
      {
        id: "roof_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -2.28,
            -1.44,
            2.36
          ],
          [
            2.28,
            -1.44,
            2.36
          ],
          [
            2.28,
            -1.44,
            2.48
          ],
          [
            -2.28,
            -1.44,
            2.48
          ]
        ],
        color: "#666860"
      },
      {
        id: "win_fl",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.202,
            -1.24,
            0.56
          ],
          [
            2.202,
            -0.64,
            0.56
          ],
          [
            2.202,
            -0.64,
            1.46
          ],
          [
            2.202,
            -1.24,
            1.46
          ]
        ],
        color: "#223344"
      },
      {
        id: "win_fr",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.202,
            0.64,
            0.56
          ],
          [
            2.202,
            1.24,
            0.56
          ],
          [
            2.202,
            1.24,
            1.46
          ],
          [
            2.202,
            0.64,
            1.46
          ]
        ],
        color: "#223344"
      },
      {
        id: "door",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.202,
            -0.36,
            0.24
          ],
          [
            2.202,
            0.36,
            0.24
          ],
          [
            2.202,
            0.36,
            1.52
          ],
          [
            2.202,
            -0.36,
            1.52
          ]
        ],
        color: "#7a5030"
      },
      {
        id: "awning",
        verts: [
          [
            2.2,
            -0.52,
            1.58
          ],
          [
            2.64,
            -0.52,
            1.4
          ],
          [
            2.64,
            0.52,
            1.4
          ],
          [
            2.2,
            0.52,
            1.58
          ]
        ],
        color: "#cc2200"
      },
      {
        id: "awning_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.64,
            -0.52,
            1.26
          ],
          [
            2.64,
            0.52,
            1.26
          ],
          [
            2.64,
            0.52,
            1.4
          ],
          [
            2.64,
            -0.52,
            1.4
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "win_rl",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -1.1,
            1.362,
            0.56
          ],
          [
            1.1,
            1.362,
            0.56
          ],
          [
            1.1,
            1.362,
            1.46
          ],
          [
            -1.1,
            1.362,
            1.46
          ]
        ],
        color: "#223344"
      }
    ]
  };

  // ../src/game/models/objects/baywatch_tower.zdef
  var baywatch_tower_default = {
    id: "baywatch_tower",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "base",
        xMin: -1.1,
        xMax: 2.52,
        yMin: -0.9,
        yMax: 0.9,
        zMin: 0,
        zMax: 2.2
      },
      {
        id: "cabin",
        xMin: -0.6,
        xMax: 0.5,
        yMin: -0.6,
        yMax: 0.6,
        zMin: 2.2,
        zMax: 3.9
      }
    ],
    faces: [
      {
        id: "p_fl_1",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.92,
            -0.86,
            0.04
          ],
          [
            0.92,
            -0.66,
            0.04
          ],
          [
            0.92,
            -0.66,
            2.2
          ],
          [
            0.92,
            -0.86,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_fl_2",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.72,
            -0.66,
            0.04
          ],
          [
            0.92,
            -0.66,
            0.04
          ],
          [
            0.92,
            -0.66,
            2.2
          ],
          [
            0.72,
            -0.66,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_fr_1",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.92,
            0.66,
            0.04
          ],
          [
            0.92,
            0.86,
            0.04
          ],
          [
            0.92,
            0.86,
            2.2
          ],
          [
            0.92,
            0.66,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_fr_2",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.72,
            0.86,
            0.04
          ],
          [
            0.92,
            0.86,
            0.04
          ],
          [
            0.92,
            0.86,
            2.2
          ],
          [
            0.72,
            0.86,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_bl_1",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -0.72,
            -0.86,
            0.04
          ],
          [
            -0.72,
            -0.66,
            0.04
          ],
          [
            -0.72,
            -0.66,
            2.2
          ],
          [
            -0.72,
            -0.86,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_bl_2",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.92,
            -0.66,
            0.04
          ],
          [
            -0.72,
            -0.66,
            0.04
          ],
          [
            -0.72,
            -0.66,
            2.2
          ],
          [
            -0.92,
            -0.66,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_br_1",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -0.72,
            0.66,
            0.04
          ],
          [
            -0.72,
            0.86,
            0.04
          ],
          [
            -0.72,
            0.86,
            2.2
          ],
          [
            -0.72,
            0.66,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "p_br_2",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.92,
            0.86,
            0.04
          ],
          [
            -0.72,
            0.86,
            0.04
          ],
          [
            -0.72,
            0.86,
            2.2
          ],
          [
            -0.92,
            0.86,
            2.2
          ]
        ],
        color: "#2a2a2a"
      },
      {
        id: "plank1",
        verts: [
          [
            -1,
            -0.9,
            2.2
          ],
          [
            -0.6,
            -0.9,
            2.2
          ],
          [
            -0.6,
            0.9,
            2.2
          ],
          [
            -1,
            0.9,
            2.2
          ]
        ],
        color: "#8a8070"
      },
      {
        id: "plank2",
        verts: [
          [
            -0.56,
            -0.9,
            2.2
          ],
          [
            -0.16,
            -0.9,
            2.2
          ],
          [
            -0.16,
            0.9,
            2.2
          ],
          [
            -0.56,
            0.9,
            2.2
          ]
        ],
        color: "#827868"
      },
      {
        id: "plank3",
        verts: [
          [
            -0.12,
            -0.9,
            2.2
          ],
          [
            0.28,
            -0.9,
            2.2
          ],
          [
            0.28,
            0.9,
            2.2
          ],
          [
            -0.12,
            0.9,
            2.2
          ]
        ],
        color: "#8a8070"
      },
      {
        id: "plank4",
        verts: [
          [
            0.32,
            -0.9,
            2.2
          ],
          [
            0.72,
            -0.9,
            2.2
          ],
          [
            0.72,
            0.9,
            2.2
          ],
          [
            0.32,
            0.9,
            2.2
          ]
        ],
        color: "#827868"
      },
      {
        id: "plank5",
        verts: [
          [
            0.76,
            -0.9,
            2.2
          ],
          [
            1.2,
            -0.9,
            2.2
          ],
          [
            1.2,
            0.9,
            2.2
          ],
          [
            0.76,
            0.9,
            2.2
          ]
        ],
        color: "#8a8070"
      },
      {
        id: "deck_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -1,
            -0.9,
            2.08
          ],
          [
            1.2,
            -0.9,
            2.08
          ],
          [
            1.2,
            -0.9,
            2.2
          ],
          [
            -1,
            -0.9,
            2.2
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "deck_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            1.2,
            0.9,
            2.08
          ],
          [
            -1,
            0.9,
            2.08
          ],
          [
            -1,
            0.9,
            2.2
          ],
          [
            1.2,
            0.9,
            2.2
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "deck_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.2,
            -0.9,
            2.08
          ],
          [
            1.2,
            0.9,
            2.08
          ],
          [
            1.2,
            0.9,
            2.2
          ],
          [
            1.2,
            -0.9,
            2.2
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "deck_b",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -1,
            -0.9,
            2.08
          ],
          [
            -1,
            0.9,
            2.08
          ],
          [
            -1,
            0.9,
            2.2
          ],
          [
            -1,
            -0.9,
            2.2
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "stair_side_r",
        verts: [
          [
            1.2,
            0.3,
            2.2
          ],
          [
            1.36,
            0.3,
            2.2
          ],
          [
            1.36,
            0.3,
            1.92
          ],
          [
            1.52,
            0.3,
            1.92
          ],
          [
            1.52,
            0.3,
            1.64
          ],
          [
            1.68,
            0.3,
            1.64
          ],
          [
            1.68,
            0.3,
            1.36
          ],
          [
            1.84,
            0.3,
            1.36
          ],
          [
            1.84,
            0.3,
            1.08
          ],
          [
            2,
            0.3,
            1.08
          ],
          [
            2,
            0.3,
            0.8
          ],
          [
            2.16,
            0.3,
            0.8
          ],
          [
            2.16,
            0.3,
            0.52
          ],
          [
            2.32,
            0.3,
            0.52
          ],
          [
            2.32,
            0.3,
            0.24
          ],
          [
            2.48,
            0.3,
            0.24
          ],
          [
            2.48,
            0.3,
            0.16
          ],
          [
            1.2,
            0.3,
            0.16
          ]
        ],
        color: "#8a8070"
      },
      {
        id: "stair_side_l",
        verts: [
          [
            1.2,
            -0.3,
            2.2
          ],
          [
            1.36,
            -0.3,
            2.2
          ],
          [
            1.36,
            -0.3,
            1.92
          ],
          [
            1.52,
            -0.3,
            1.92
          ],
          [
            1.52,
            -0.3,
            1.64
          ],
          [
            1.68,
            -0.3,
            1.64
          ],
          [
            1.68,
            -0.3,
            1.36
          ],
          [
            1.84,
            -0.3,
            1.36
          ],
          [
            1.84,
            -0.3,
            1.08
          ],
          [
            2,
            -0.3,
            1.08
          ],
          [
            2,
            -0.3,
            0.8
          ],
          [
            2.16,
            -0.3,
            0.8
          ],
          [
            2.16,
            -0.3,
            0.52
          ],
          [
            2.32,
            -0.3,
            0.52
          ],
          [
            2.32,
            -0.3,
            0.24
          ],
          [
            2.48,
            -0.3,
            0.24
          ],
          [
            2.48,
            -0.3,
            0.16
          ],
          [
            1.2,
            -0.3,
            0.16
          ]
        ],
        color: "#8a8070"
      },
      {
        id: "step8_t",
        verts: [
          [
            1.2,
            -0.3,
            2.2
          ],
          [
            1.36,
            -0.3,
            2.2
          ],
          [
            1.36,
            0.3,
            2.2
          ],
          [
            1.2,
            0.3,
            2.2
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step8_f",
        verts: [
          [
            1.36,
            -0.3,
            2.12
          ],
          [
            1.36,
            0.3,
            2.12
          ],
          [
            1.36,
            0.3,
            2.2
          ],
          [
            1.36,
            -0.3,
            2.2
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step7_t",
        verts: [
          [
            1.36,
            -0.3,
            1.92
          ],
          [
            1.52,
            -0.3,
            1.92
          ],
          [
            1.52,
            0.3,
            1.92
          ],
          [
            1.36,
            0.3,
            1.92
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step7_f",
        verts: [
          [
            1.52,
            -0.3,
            1.84
          ],
          [
            1.52,
            0.3,
            1.84
          ],
          [
            1.52,
            0.3,
            1.92
          ],
          [
            1.52,
            -0.3,
            1.92
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step6_t",
        verts: [
          [
            1.52,
            -0.3,
            1.64
          ],
          [
            1.68,
            -0.3,
            1.64
          ],
          [
            1.68,
            0.3,
            1.64
          ],
          [
            1.52,
            0.3,
            1.64
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step6_f",
        verts: [
          [
            1.68,
            -0.3,
            1.56
          ],
          [
            1.68,
            0.3,
            1.56
          ],
          [
            1.68,
            0.3,
            1.64
          ],
          [
            1.68,
            -0.3,
            1.64
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step5_t",
        verts: [
          [
            1.68,
            -0.3,
            1.36
          ],
          [
            1.84,
            -0.3,
            1.36
          ],
          [
            1.84,
            0.3,
            1.36
          ],
          [
            1.68,
            0.3,
            1.36
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step5_f",
        verts: [
          [
            1.84,
            -0.3,
            1.28
          ],
          [
            1.84,
            0.3,
            1.28
          ],
          [
            1.84,
            0.3,
            1.36
          ],
          [
            1.84,
            -0.3,
            1.36
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step4_t",
        verts: [
          [
            1.84,
            -0.3,
            1.08
          ],
          [
            2,
            -0.3,
            1.08
          ],
          [
            2,
            0.3,
            1.08
          ],
          [
            1.84,
            0.3,
            1.08
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step4_f",
        verts: [
          [
            2,
            -0.3,
            1
          ],
          [
            2,
            0.3,
            1
          ],
          [
            2,
            0.3,
            1.08
          ],
          [
            2,
            -0.3,
            1.08
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step3_t",
        verts: [
          [
            2,
            -0.3,
            0.8
          ],
          [
            2.16,
            -0.3,
            0.8
          ],
          [
            2.16,
            0.3,
            0.8
          ],
          [
            2,
            0.3,
            0.8
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step3_f",
        verts: [
          [
            2.16,
            -0.3,
            0.72
          ],
          [
            2.16,
            0.3,
            0.72
          ],
          [
            2.16,
            0.3,
            0.8
          ],
          [
            2.16,
            -0.3,
            0.8
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step2_t",
        verts: [
          [
            2.16,
            -0.3,
            0.52
          ],
          [
            2.32,
            -0.3,
            0.52
          ],
          [
            2.32,
            0.3,
            0.52
          ],
          [
            2.16,
            0.3,
            0.52
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step2_f",
        verts: [
          [
            2.32,
            -0.3,
            0.44
          ],
          [
            2.32,
            0.3,
            0.44
          ],
          [
            2.32,
            0.3,
            0.52
          ],
          [
            2.32,
            -0.3,
            0.52
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "step1_t",
        verts: [
          [
            2.32,
            -0.3,
            0.24
          ],
          [
            2.48,
            -0.3,
            0.24
          ],
          [
            2.48,
            0.3,
            0.24
          ],
          [
            2.32,
            0.3,
            0.24
          ]
        ],
        color: "#9a9080"
      },
      {
        id: "step1_f",
        verts: [
          [
            2.48,
            -0.3,
            0.16
          ],
          [
            2.48,
            0.3,
            0.16
          ],
          [
            2.48,
            0.3,
            0.24
          ],
          [
            2.48,
            -0.3,
            0.24
          ]
        ],
        color: "#7a7060"
      },
      {
        id: "rail_solid_l",
        verts: [
          [
            -1,
            -0.9,
            2.2
          ],
          [
            1.2,
            -0.9,
            2.2
          ],
          [
            1.2,
            -0.9,
            2.48
          ],
          [
            -1,
            -0.9,
            2.48
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "rail_solid_r",
        verts: [
          [
            1.2,
            0.9,
            2.2
          ],
          [
            -1,
            0.9,
            2.2
          ],
          [
            -1,
            0.9,
            2.48
          ],
          [
            1.2,
            0.9,
            2.48
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "rail_f_left",
        verts: [
          [
            1.2,
            -0.9,
            2.2
          ],
          [
            1.2,
            -0.3,
            2.2
          ],
          [
            1.2,
            -0.3,
            2.48
          ],
          [
            1.2,
            -0.9,
            2.48
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "rail_f_right",
        verts: [
          [
            1.2,
            0.3,
            2.2
          ],
          [
            1.2,
            0.9,
            2.2
          ],
          [
            1.2,
            0.9,
            2.48
          ],
          [
            1.2,
            0.3,
            2.48
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "rail_b",
        normal: [
          1,
          0
        ],
        verts: [
          [
            -1,
            -0.9,
            2.2
          ],
          [
            -1,
            0.9,
            2.2
          ],
          [
            -1,
            0.9,
            2.48
          ],
          [
            -1,
            -0.9,
            2.48
          ]
        ],
        color: "#aa1800"
      },
      {
        id: "cab_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.6,
            -0.6,
            2.2
          ],
          [
            0.5,
            -0.6,
            2.2
          ],
          [
            0.5,
            -0.6,
            3.04
          ],
          [
            -0.6,
            -0.6,
            3.04
          ]
        ],
        color: "#dcd8cc"
      },
      {
        id: "cab_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.5,
            0.6,
            2.2
          ],
          [
            -0.6,
            0.6,
            2.2
          ],
          [
            -0.6,
            0.6,
            3.04
          ],
          [
            0.5,
            0.6,
            3.04
          ]
        ],
        color: "#ccc8bc"
      },
      {
        id: "cab_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.5,
            -0.6,
            2.2
          ],
          [
            0.5,
            0.6,
            2.2
          ],
          [
            0.5,
            0.6,
            3.04
          ],
          [
            0.5,
            -0.6,
            3.04
          ]
        ],
        color: "#ece8dc"
      },
      {
        id: "door",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.502,
            -0.2,
            2.2
          ],
          [
            0.502,
            0.2,
            2.2
          ],
          [
            0.502,
            0.2,
            2.76
          ],
          [
            0.502,
            -0.2,
            2.76
          ]
        ],
        color: "#7a5030"
      },
      {
        id: "win_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.2,
            0.602,
            2.44
          ],
          [
            0.3,
            0.602,
            2.44
          ],
          [
            0.3,
            0.602,
            2.84
          ],
          [
            -0.2,
            0.602,
            2.84
          ]
        ],
        color: "#223344"
      },
      {
        id: "buoy_body",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.3,
            0.605,
            2.42
          ],
          [
            0.5,
            0.605,
            2.42
          ],
          [
            0.5,
            0.605,
            2.78
          ],
          [
            0.3,
            0.605,
            2.78
          ]
        ],
        color: "#ff5500"
      },
      {
        id: "buoy_strap",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.3,
            0.607,
            2.57
          ],
          [
            0.5,
            0.607,
            2.57
          ],
          [
            0.5,
            0.607,
            2.63
          ],
          [
            0.3,
            0.607,
            2.63
          ]
        ],
        color: "#222222"
      },
      {
        id: "roof",
        verts: [
          [
            -0.7,
            -0.7,
            3.04
          ],
          [
            0.7,
            -0.7,
            3.04
          ],
          [
            0.7,
            0.7,
            3.04
          ],
          [
            -0.7,
            0.7,
            3.04
          ]
        ],
        color: "#cc2200"
      },
      {
        id: "pole",
        verts: [
          [
            -0.4,
            -0.01,
            3.04
          ],
          [
            -0.4,
            0.01,
            3.04
          ],
          [
            -0.4,
            0.01,
            3.88
          ],
          [
            -0.4,
            -0.01,
            3.88
          ]
        ],
        color: "#cccccc"
      }
    ]
  };

  // ../src/game/models/objects/concert_stage.zdef
  var concert_stage_default = {
    id: "concert_stage",
    pivot: [0, 0, 0],
    collisionBoxes: [
      { id: "platform", xMin: -1.5, xMax: 1.5, yMin: -2.5, yMax: 2.5, zMin: 0, zMax: 0.5 },
      { id: "backwall", xMin: 1.2, xMax: 1.6, yMin: -2.5, yMax: 2.5, zMin: 0.5, zMax: 4.5 },
      { id: "spk_l", xMin: -2, xMax: -1.4, yMin: -3, yMax: -2.5, zMin: 0.5, zMax: 2.6 },
      { id: "spk_r", xMin: -2, xMax: -1.4, yMin: 2.5, yMax: 3, zMin: 0.5, zMax: 2.6 }
    ],
    faces: [
      { id: "plat_top", verts: [[1.5, -2.5, 0.5], [1.5, 2.5, 0.5], [-1.5, 2.5, 0.5], [-1.5, -2.5, 0.5]], color: "#1e0e2a" },
      { id: "plat_front", normal: [-1, 0], verts: [[-1.5, -2.5, 0], [-1.5, 2.5, 0], [-1.5, 2.5, 0.5], [-1.5, -2.5, 0.5]], color: "#2a1040" },
      { id: "plat_side_l", normal: [0, -1], verts: [[-1.5, -2.5, 0], [1.5, -2.5, 0], [1.5, -2.5, 0.5], [-1.5, -2.5, 0.5]], color: "#1e0e30" },
      { id: "plat_side_r", normal: [0, 1], verts: [[1.5, 2.5, 0], [-1.5, 2.5, 0], [-1.5, 2.5, 0.5], [1.5, 2.5, 0.5]], color: "#200e34" },
      { id: "plat_back", normal: [1, 0], verts: [[1.5, 2.5, 0], [1.5, -2.5, 0], [1.5, -2.5, 0.5], [1.5, 2.5, 0.5]], color: "#1a0c28" },
      { id: "floor_a", verts: [[1.5, -2.3, 0.51], [1.5, -0.1, 0.51], [-1.5, -0.1, 0.51], [-1.5, -2.3, 0.51]], color: "#180a22" },
      { id: "floor_b", verts: [[1.5, 0.1, 0.51], [1.5, 2.3, 0.51], [-1.5, 2.3, 0.51], [-1.5, 0.1, 0.51]], color: "#180a22" },
      { id: "floor_mid", verts: [[1.5, -0.1, 0.51], [1.5, 0.1, 0.51], [-1.5, 0.1, 0.51], [-1.5, -0.1, 0.51]], color: "#2a1a3a" },
      { id: "mon_l", verts: [[-1.5, -2.4, 0.5], [-1.5, -1.8, 0.5], [-1.1, -1.8, 0.62], [-1.1, -2.4, 0.62]], color: "#0e0e16" },
      { id: "mon_l_f", normal: [-1, 0], verts: [[-1.5, -2.4, 0.5], [-1.1, -2.4, 0.62], [-1.1, -2.4, 0.5], [-1.5, -2.4, 0.5]], color: "#1a1a28" },
      { id: "mon_c", verts: [[-1.5, -0.3, 0.5], [-1.5, 0.3, 0.5], [-1.1, 0.3, 0.62], [-1.1, -0.3, 0.62]], color: "#0e0e16" },
      { id: "mon_r", verts: [[-1.5, 1.8, 0.5], [-1.5, 2.4, 0.5], [-1.1, 2.4, 0.62], [-1.1, 1.8, 0.62]], color: "#0e0e16" },
      { id: "col_fl_top", verts: [[-1.4, -2.6, 4.2], [-1.4, -2.4, 4.2], [-1.6, -2.4, 4.2], [-1.6, -2.6, 4.2]], color: "#2a3548" },
      { id: "col_fl_f", normal: [-1, 0], verts: [[-1.6, -2.6, 0.5], [-1.6, -2.4, 0.5], [-1.6, -2.4, 4.2], [-1.6, -2.6, 4.2]], color: "#3a4a5e" },
      { id: "col_fl_s", normal: [0, -1], verts: [[-1.6, -2.6, 0.5], [-1.4, -2.6, 0.5], [-1.4, -2.6, 4.2], [-1.6, -2.6, 4.2]], color: "#2f3f52" },
      { id: "col_fr_top", verts: [[-1.4, 2.4, 4.2], [-1.4, 2.6, 4.2], [-1.6, 2.6, 4.2], [-1.6, 2.4, 4.2]], color: "#2a3548" },
      { id: "col_fr_f", normal: [-1, 0], verts: [[-1.6, 2.4, 0.5], [-1.6, 2.6, 0.5], [-1.6, 2.6, 4.2], [-1.6, 2.4, 4.2]], color: "#3a4a5e" },
      { id: "col_fr_s", normal: [0, 1], verts: [[-1.4, 2.6, 0.5], [-1.6, 2.6, 0.5], [-1.6, 2.6, 4.2], [-1.4, 2.6, 4.2]], color: "#2f3f52" },
      { id: "col_bl_top", verts: [[1.4, -2.6, 4.2], [1.4, -2.4, 4.2], [1.6, -2.4, 4.2], [1.6, -2.6, 4.2]], color: "#2a3548" },
      { id: "col_bl_f", normal: [1, 0], verts: [[1.6, -2.4, 0.5], [1.6, -2.6, 0.5], [1.6, -2.6, 4.2], [1.6, -2.4, 4.2]], color: "#1e2d40" },
      { id: "col_bl_s", normal: [0, -1], verts: [[1.4, -2.6, 0.5], [1.6, -2.6, 0.5], [1.6, -2.6, 4.2], [1.4, -2.6, 4.2]], color: "#2f3f52" },
      { id: "col_br_top", verts: [[1.4, 2.4, 4.2], [1.4, 2.6, 4.2], [1.6, 2.6, 4.2], [1.6, 2.4, 4.2]], color: "#2a3548" },
      { id: "col_br_f", normal: [1, 0], verts: [[1.6, 2.6, 0.5], [1.6, 2.4, 0.5], [1.6, 2.4, 4.2], [1.6, 2.6, 4.2]], color: "#1e2d40" },
      { id: "col_br_s", normal: [0, 1], verts: [[1.6, 2.6, 0.5], [1.4, 2.6, 0.5], [1.4, 2.6, 4.2], [1.6, 2.6, 4.2]], color: "#2f3f52" },
      { id: "back_face", normal: [1, 0], verts: [[1.6, 2.5, 0.5], [1.6, -2.5, 0.5], [1.6, -2.5, 4.5], [1.6, 2.5, 4.5]], color: "#0c0016" },
      { id: "back_inner", normal: [-1, 0], verts: [[1.5, -2.5, 0.5], [1.5, 2.5, 0.5], [1.5, 2.5, 4.5], [1.5, -2.5, 4.5]], color: "#12003a" },
      { id: "back_top", verts: [[1.5, -2.5, 4.5], [1.5, 2.5, 4.5], [1.6, 2.5, 4.5], [1.6, -2.5, 4.5]], color: "#2a3548" },
      { id: "back_side_l", normal: [0, -1], verts: [[1.5, -2.5, 0.5], [1.6, -2.5, 0.5], [1.6, -2.5, 4.5], [1.5, -2.5, 4.5]], color: "#2a3548" },
      { id: "back_side_r", normal: [0, 1], verts: [[1.6, 2.5, 0.5], [1.5, 2.5, 0.5], [1.5, 2.5, 4.5], [1.6, 2.5, 4.5]], color: "#2a3548" },
      { id: "truss_f_top", verts: [[-1.6, -2.6, 4.2], [-1.6, 2.6, 4.2], [-1.4, 2.6, 4.2], [-1.4, -2.6, 4.2]], color: "#2a3548" },
      { id: "truss_f_f", normal: [-1, 0], verts: [[-1.6, -2.6, 4.1], [-1.6, 2.6, 4.1], [-1.6, 2.6, 4.2], [-1.6, -2.6, 4.2]], color: "#3a4a5e" },
      { id: "truss_m_top", verts: [[-0.1, -2.6, 4.2], [-0.1, 2.6, 4.2], [0.1, 2.6, 4.2], [0.1, -2.6, 4.2]], color: "#2a3548" },
      { id: "truss_b_top", verts: [[1.4, -2.6, 4.2], [1.4, 2.6, 4.2], [1.6, 2.6, 4.2], [1.6, -2.6, 4.2]], color: "#2a3548" },
      { id: "roof_top", verts: [[-2, -2.7, 4.3], [-2, 2.7, 4.3], [1.6, 2.7, 4.3], [1.6, -2.7, 4.3]], color: "#1a1a28" },
      { id: "roof_front", normal: [-1, 0], verts: [[-2, -2.7, 4.2], [-2, 2.7, 4.2], [-2, 2.7, 4.3], [-2, -2.7, 4.3]], color: "#222238" },
      { id: "roof_side_l", normal: [0, -1], verts: [[-2, -2.7, 4.2], [1.6, -2.7, 4.2], [1.6, -2.7, 4.3], [-2, -2.7, 4.3]], color: "#1e1e30" },
      { id: "roof_side_r", normal: [0, 1], verts: [[1.6, 2.7, 4.2], [-2, 2.7, 4.2], [-2, 2.7, 4.3], [1.6, 2.7, 4.3]], color: "#1e1e30" },
      { id: "spk_l_top", verts: [[-2, -3, 2.6], [-2, -2.5, 2.6], [-1.4, -2.5, 2.6], [-1.4, -3, 2.6]], color: "#111118" },
      { id: "spk_l_f", normal: [-1, 0], verts: [[-2, -3, 0.5], [-2, -2.5, 0.5], [-2, -2.5, 2.6], [-2, -3, 2.6]], color: "#1a1a28" },
      { id: "spk_l_s", normal: [0, -1], verts: [[-2, -3, 0.5], [-1.4, -3, 0.5], [-1.4, -3, 2.6], [-2, -3, 2.6]], color: "#141420" },
      { id: "spk_l_grill", normal: [-1, 0], verts: [[-2.01, -2.9, 0.8], [-2.01, -2.6, 0.8], [-2.01, -2.6, 2.3], [-2.01, -2.9, 2.3]], color: "#2a2a3a" },
      { id: "spk_r_top", verts: [[-2, 2.5, 2.6], [-2, 3, 2.6], [-1.4, 3, 2.6], [-1.4, 2.5, 2.6]], color: "#111118" },
      { id: "spk_r_f", normal: [-1, 0], verts: [[-2, 2.5, 0.5], [-2, 3, 0.5], [-2, 3, 2.6], [-2, 2.5, 2.6]], color: "#1a1a28" },
      { id: "spk_r_s", normal: [0, 1], verts: [[-1.4, 3, 0.5], [-2, 3, 0.5], [-2, 3, 2.6], [-1.4, 3, 2.6]], color: "#141420" },
      { id: "spk_r_inner", normal: [0, -1], verts: [[-2, 2.5, 0.5], [-1.4, 2.5, 0.5], [-1.4, 2.5, 2.6], [-2, 2.5, 2.6]], color: "#141420" },
      { id: "spk_r_grill", normal: [-1, 0], verts: [[-2.01, 2.6, 0.8], [-2.01, 2.9, 0.8], [-2.01, 2.9, 2.3], [-2.01, 2.6, 2.3]], color: "#2a2a3a" }
    ]
  };

  // ../src/game/models/objects/festival_tent.zdef
  var festival_tent_default = {
    id: "festival_tent",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -0.55,
        xMax: 0.55,
        yMin: -0.7,
        yMax: 0.7,
        zMin: 0,
        zMax: 1
      }
    ],
    palettes: {
      red: {
        slope_f: "#bb3018",
        slope_b: "#9a2412",
        gable_l: "#aa2a14",
        gable_r: "#aa2a14"
      },
      green: {
        slope_f: "#2a8030",
        slope_b: "#1e6624",
        gable_l: "#247028",
        gable_r: "#247028"
      }
    },
    faces: [
      {
        id: "floor",
        verts: [
          [
            0.55,
            -0.7,
            0.01
          ],
          [
            0.55,
            0.7,
            0.01
          ],
          [
            -0.55,
            0.7,
            0.01
          ],
          [
            -0.55,
            -0.7,
            0.01
          ]
        ],
        color: "#2a3820"
      },
      {
        id: "slope_f",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0,
            -0.7,
            1
          ],
          [
            -0.55,
            -0.7,
            0
          ],
          [
            -0.55,
            0.7,
            0
          ],
          [
            0,
            0.7,
            1
          ]
        ],
        color: "#2255aa"
      },
      {
        id: "slope_b",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0,
            -0.7,
            1
          ],
          [
            0.55,
            -0.7,
            0
          ],
          [
            0.55,
            0.7,
            0
          ],
          [
            0,
            0.7,
            1
          ]
        ],
        color: "#1a4488"
      },
      {
        id: "gable_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0,
            -0.7,
            1
          ],
          [
            -0.55,
            -0.7,
            0
          ],
          [
            0.55,
            -0.7,
            0
          ]
        ],
        color: "#1e4a99"
      },
      {
        id: "gable_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0,
            0.7,
            1
          ],
          [
            0.55,
            0.7,
            0
          ],
          [
            -0.55,
            0.7,
            0
          ]
        ],
        color: "#1e4a99"
      },
      {
        id: "ridge",
        verts: [
          [
            -0.03,
            -0.7,
            1
          ],
          [
            0.03,
            -0.7,
            1
          ],
          [
            0.03,
            0.7,
            1
          ],
          [
            -0.03,
            0.7,
            1
          ]
        ],
        color: "#dddddd"
      }
    ]
  };

  // ../src/game/models/objects/festival_tent_broken.zdef
  var festival_tent_broken_default = {
    id: "festival_tent_broken",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -0.7,
        xMax: 0.7,
        yMin: -0.7,
        yMax: 0.7,
        zMin: 0,
        zMax: 0.28
      }
    ],
    palettes: {
      red: {
        sheet_fl: "#aa2c18",
        sheet_fr: "#8c2010",
        sheet_bl: "#8c2010",
        sheet_br: "#aa2c18",
        ridge: "#ddddaa"
      },
      green: {
        sheet_fl: "#267830",
        sheet_fr: "#1a6022",
        sheet_bl: "#1a6022",
        sheet_br: "#267830",
        ridge: "#aaddaa"
      }
    },
    faces: [
      {
        id: "ground",
        verts: [
          [
            0.7,
            -0.7,
            0.02
          ],
          [
            0.7,
            0.7,
            0.02
          ],
          [
            -0.7,
            0.7,
            0.02
          ],
          [
            -0.7,
            -0.7,
            0.02
          ]
        ],
        color: "#2a2e1e"
      },
      {
        id: "sheet_fl",
        verts: [
          [
            -0.15,
            -0.7,
            0.25
          ],
          [
            -0.15,
            0,
            0.25
          ],
          [
            -0.7,
            0,
            0.04
          ],
          [
            -0.7,
            -0.7,
            0.04
          ]
        ],
        color: "#2050a0"
      },
      {
        id: "sheet_fr",
        verts: [
          [
            -0.15,
            0,
            0.25
          ],
          [
            -0.15,
            0.7,
            0.25
          ],
          [
            -0.7,
            0.7,
            0.04
          ],
          [
            -0.7,
            0,
            0.04
          ]
        ],
        color: "#1a4080"
      },
      {
        id: "sheet_bl",
        verts: [
          [
            0.7,
            -0.7,
            0.04
          ],
          [
            0.7,
            0,
            0.04
          ],
          [
            -0.15,
            0,
            0.25
          ],
          [
            -0.15,
            -0.7,
            0.25
          ]
        ],
        color: "#1a4080"
      },
      {
        id: "sheet_br",
        verts: [
          [
            0.7,
            0,
            0.04
          ],
          [
            0.7,
            0.7,
            0.04
          ],
          [
            -0.15,
            0.7,
            0.25
          ],
          [
            -0.15,
            0,
            0.25
          ]
        ],
        color: "#2050a0"
      },
      {
        id: "ridge",
        verts: [
          [
            -0.17,
            -0.7,
            0.27
          ],
          [
            -0.13,
            -0.7,
            0.27
          ],
          [
            -0.13,
            0.7,
            0.27
          ],
          [
            -0.17,
            0.7,
            0.27
          ]
        ],
        color: "#cccccc"
      }
    ]
  };

  // ../src/game/models/objects/festival_car.zdef
  var festival_car_default = {
    id: "festival_car",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "chassis",
        xMin: -0.9,
        xMax: 0.9,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0,
        zMax: 0.78
      }
    ],
    palettes: {
      black: {
        hood_top: "#1c1c24",
        grill: "#1c1c24",
        body_side_l: "#141420",
        body_side_r: "#181820",
        trunk: "#141420",
        trunk_r: "#181820",
        tailgate: "#141420",
        cab_back: "#141420",
        cab_side_l: "#141420",
        cab_side_r: "#181820",
        cab_roof: "#202028"
      },
      blue: {
        hood_top: "#1a4a8a",
        grill: "#1a4a8a",
        body_side_l: "#153d78",
        body_side_r: "#184484",
        trunk: "#153d78",
        trunk_r: "#184484",
        tailgate: "#153d78",
        cab_back: "#153d78",
        cab_side_l: "#153d78",
        cab_side_r: "#184484",
        cab_roof: "#1e5298"
      },
      red: {
        hood_top: "#c02020",
        grill: "#c02020",
        body_side_l: "#a81c1c",
        body_side_r: "#b81e1e",
        trunk: "#a81c1c",
        trunk_r: "#b81e1e",
        tailgate: "#a81c1c",
        cab_back: "#a81c1c",
        cab_side_l: "#a81c1c",
        cab_side_r: "#b81e1e",
        cab_roof: "#c82222"
      },
      yellow: {
        hood_top: "#d4a020",
        grill: "#d4a020",
        body_side_l: "#be9018",
        body_side_r: "#ca9a1c",
        trunk: "#be9018",
        trunk_r: "#ca9a1c",
        tailgate: "#be9018",
        cab_back: "#be9018",
        cab_side_l: "#be9018",
        cab_side_r: "#ca9a1c",
        cab_roof: "#daa822"
      }
    },
    faces: [
      {
        id: "base_bottom",
        verts: [
          [
            -0.9,
            -0.42,
            0.09
          ],
          [
            0.9,
            -0.42,
            0.09
          ],
          [
            0.9,
            0.42,
            0.09
          ],
          [
            -0.9,
            0.42,
            0.09
          ]
        ],
        color: "#111111"
      },
      {
        id: "side_low_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.9,
            -0.42,
            0.09
          ],
          [
            0.9,
            -0.42,
            0.09
          ],
          [
            0.9,
            -0.42,
            0.19
          ],
          [
            -0.9,
            -0.42,
            0.19
          ]
        ],
        color: "#222222"
      },
      {
        id: "side_low_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.9,
            0.42,
            0.09
          ],
          [
            -0.9,
            0.42,
            0.09
          ],
          [
            -0.9,
            0.42,
            0.19
          ],
          [
            0.9,
            0.42,
            0.19
          ]
        ],
        color: "#1a1a1a"
      },
      {
        id: "bumper_f",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.9,
            -0.42,
            0.07
          ],
          [
            0.9,
            0.42,
            0.07
          ],
          [
            0.9,
            0.42,
            0.18
          ],
          [
            0.9,
            -0.42,
            0.18
          ]
        ],
        color: "#222222"
      },
      {
        id: "bumper_b",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.9,
            0.42,
            0.07
          ],
          [
            -0.9,
            -0.42,
            0.07
          ],
          [
            -0.9,
            -0.42,
            0.18
          ],
          [
            -0.9,
            0.42,
            0.18
          ]
        ],
        color: "#222222"
      },
      {
        id: "wh_rl_o",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.72,
            -0.45,
            0
          ],
          [
            -0.44,
            -0.45,
            0
          ],
          [
            -0.44,
            -0.45,
            0.22
          ],
          [
            -0.72,
            -0.45,
            0.22
          ]
        ],
        color: "#1e1e1e"
      },
      {
        id: "wh_rr_o",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.44,
            0.45,
            0
          ],
          [
            -0.72,
            0.45,
            0
          ],
          [
            -0.72,
            0.45,
            0.22
          ],
          [
            -0.44,
            0.45,
            0.22
          ]
        ],
        color: "#181818"
      },
      {
        id: "wh_fl_o",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.44,
            -0.45,
            0
          ],
          [
            0.72,
            -0.45,
            0
          ],
          [
            0.72,
            -0.45,
            0.22
          ],
          [
            0.44,
            -0.45,
            0.22
          ]
        ],
        color: "#1e1e1e"
      },
      {
        id: "wh_fr_o",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.72,
            0.45,
            0
          ],
          [
            0.44,
            0.45,
            0
          ],
          [
            0.44,
            0.45,
            0.22
          ],
          [
            0.72,
            0.45,
            0.22
          ]
        ],
        color: "#181818"
      },
      {
        id: "hood_top",
        verts: [
          [
            0.3,
            -0.42,
            0.44
          ],
          [
            0.85,
            -0.42,
            0.4
          ],
          [
            0.85,
            0.42,
            0.4
          ],
          [
            0.3,
            0.42,
            0.44
          ]
        ],
        color: "#a0aab5"
      },
      {
        id: "grill",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.9,
            -0.42,
            0.18
          ],
          [
            0.9,
            0.42,
            0.18
          ],
          [
            0.9,
            0.42,
            0.4
          ],
          [
            0.9,
            -0.42,
            0.4
          ]
        ],
        color: "#a0aab5"
      },
      {
        id: "grill_mesh",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.901,
            -0.33,
            0.23
          ],
          [
            0.901,
            0.33,
            0.23
          ],
          [
            0.901,
            0.33,
            0.36
          ],
          [
            0.901,
            -0.33,
            0.36
          ]
        ],
        color: "#222222"
      },
      {
        id: "hdl",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.901,
            -0.4,
            0.28
          ],
          [
            0.901,
            -0.34,
            0.28
          ],
          [
            0.901,
            -0.34,
            0.36
          ],
          [
            0.901,
            -0.4,
            0.36
          ]
        ],
        color: "#fffebb"
      },
      {
        id: "hdr",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.901,
            0.34,
            0.28
          ],
          [
            0.901,
            0.4,
            0.28
          ],
          [
            0.901,
            0.4,
            0.36
          ],
          [
            0.901,
            0.34,
            0.36
          ]
        ],
        color: "#fffebb"
      },
      {
        id: "body_side_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.3,
            -0.42,
            0.19
          ],
          [
            0.85,
            -0.42,
            0.19
          ],
          [
            0.85,
            -0.42,
            0.4
          ],
          [
            0.3,
            -0.42,
            0.44
          ]
        ],
        color: "#8a949f"
      },
      {
        id: "body_side_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.85,
            0.42,
            0.19
          ],
          [
            0.3,
            0.42,
            0.19
          ],
          [
            0.3,
            0.42,
            0.44
          ],
          [
            0.85,
            0.42,
            0.4
          ]
        ],
        color: "#95a0aa"
      },
      {
        id: "trunk",
        verts: [
          [
            -0.85,
            -0.42,
            0.19
          ],
          [
            0.3,
            -0.42,
            0.19
          ],
          [
            0.3,
            -0.42,
            0.44
          ],
          [
            -0.85,
            -0.42,
            0.44
          ]
        ],
        color: "#8a949f"
      },
      {
        id: "trunk_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.3,
            0.42,
            0.19
          ],
          [
            -0.85,
            0.42,
            0.19
          ],
          [
            -0.85,
            0.42,
            0.44
          ],
          [
            0.3,
            0.42,
            0.44
          ]
        ],
        color: "#95a0aa"
      },
      {
        id: "tailgate",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.9,
            0.42,
            0.19
          ],
          [
            -0.9,
            -0.42,
            0.19
          ],
          [
            -0.9,
            -0.42,
            0.46
          ],
          [
            -0.9,
            0.42,
            0.46
          ]
        ],
        color: "#8a949f"
      },
      {
        id: "cab_back",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.4,
            0.39,
            0.44
          ],
          [
            -0.4,
            -0.39,
            0.44
          ],
          [
            -0.4,
            -0.39,
            0.75
          ],
          [
            -0.4,
            0.39,
            0.75
          ]
        ],
        color: "#8a949f"
      },
      {
        id: "cab_side_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.4,
            -0.42,
            0.44
          ],
          [
            0.3,
            -0.42,
            0.44
          ],
          [
            0.22,
            -0.42,
            0.75
          ],
          [
            -0.4,
            -0.42,
            0.75
          ]
        ],
        color: "#8a949f"
      },
      {
        id: "cab_side_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.3,
            0.42,
            0.44
          ],
          [
            -0.4,
            0.42,
            0.44
          ],
          [
            -0.4,
            0.42,
            0.75
          ],
          [
            0.22,
            0.42,
            0.75
          ]
        ],
        color: "#95a0aa"
      },
      {
        id: "cab_roof",
        verts: [
          [
            -0.4,
            -0.39,
            0.75
          ],
          [
            0.22,
            -0.39,
            0.75
          ],
          [
            0.22,
            0.39,
            0.75
          ],
          [
            -0.4,
            0.39,
            0.75
          ]
        ],
        color: "#aab4be"
      },
      {
        id: "windshield",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.3,
            -0.39,
            0.44
          ],
          [
            0.3,
            0.39,
            0.44
          ],
          [
            0.22,
            0.39,
            0.73
          ],
          [
            0.22,
            -0.39,
            0.73
          ]
        ],
        color: "#1e2d3e"
      },
      {
        id: "win_l",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -0.35,
            -0.4,
            0.49
          ],
          [
            0.18,
            -0.4,
            0.49
          ],
          [
            0.1,
            -0.4,
            0.7
          ],
          [
            -0.35,
            -0.4,
            0.7
          ]
        ],
        color: "#1e2d3e"
      },
      {
        id: "win_r",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.18,
            0.4,
            0.49
          ],
          [
            -0.35,
            0.4,
            0.49
          ],
          [
            -0.35,
            0.4,
            0.7
          ],
          [
            0.1,
            0.4,
            0.7
          ]
        ],
        color: "#1a2838"
      }
    ]
  };

  // ../src/game/models/objects/xmas_house_a.zdef
  var xmas_house_a_default = {
    id: "xmas_house_a",
    pivot: [0, 0, 0],
    chimneyPos: { x: 0.3, y: 0.075, z: 2.45 },
    rescueZones: [{ x: 0.3, y: 0.075, w: 0.3, h: 0.3, role: "deliver" }],
    faces: [
      { id: "rw_wall", normal: [1, 0], verts: [[0.75, -0.5, 0], [0.75, 0.5, 0], [0.75, 0.5, 1.25], [0.75, -0.5, 1.25]], color: "#c8a870" },
      { id: "rw_gable", verts: [[0.75, -0.5, 1.25], [0.75, 0.5, 1.25], [0.75, 0, 2]], color: "#c0a068" },
      { id: "rw_win", verts: [[0.755, -0.22, 0.45], [0.755, 0.22, 0.45], [0.755, 0.22, 0.9], [0.755, -0.22, 0.9]], color: "#ffe080" },
      { id: "sw_wall", normal: [0, 1], verts: [[-0.75, 0.5, 0], [0.75, 0.5, 0], [0.75, 0.5, 1.25], [-0.75, 0.5, 1.25]], color: "#e8d4a0" },
      { id: "sw_gable", verts: [[-0.75, 0.5, 1.25], [0.75, 0.5, 1.25], [0, 0.5, 2]], color: "#e0ca95" },
      { id: "sw_win", verts: [[-0.18, 0.505, 0.45], [0.18, 0.505, 0.45], [0.18, 0.505, 0.9], [-0.18, 0.505, 0.9]], color: "#ffe080" },
      { id: "sw_door", verts: [[-0.1, 0.505, 0], [0.1, 0.505, 0], [0.1, 0.505, 0.45], [-0.1, 0.505, 0.45]], color: "#6b3a1f" },
      { id: "roof_r", verts: [[0, -0.5, 2], [0, 0.5, 2], [0.75, 0.5, 1.25], [0.75, -0.5, 1.25]], color: "#8b3030" },
      { id: "roof_l", verts: [[0, -0.5, 2], [-0.75, -0.5, 1.25], [-0.75, 0.5, 1.25], [0, 0.5, 2]], color: "#7a2828" },
      { id: "snow_r", verts: [[0, -0.525, 2], [0, 0.525, 2], [0.775, 0.525, 1.24], [0.775, -0.525, 1.24]], color: "#dde8f5" },
      { id: "snow_l", verts: [[0, -0.525, 2], [-0.775, -0.525, 1.24], [-0.775, 0.525, 1.24], [0, 0.525, 2]], color: "#d8e5f2" },
      { id: "ch_right", normal: [1, 0], verts: [[0.4, 0, 1.65], [0.4, 0.15, 1.65], [0.4, 0.15, 2.45], [0.4, 0, 2.45]], color: "#777777" },
      { id: "ch_south", normal: [0, 1], verts: [[0.2, 0.15, 1.65], [0.4, 0.15, 1.65], [0.4, 0.15, 2.45], [0.2, 0.15, 2.45]], color: "#888888" },
      { id: "ch_top", verts: [[0.2, 0, 2.45], [0.4, 0, 2.45], [0.4, 0.15, 2.45], [0.2, 0.15, 2.45]], color: "#999999" }
    ],
    lights: [
      { id: "win_r", pos: [0.76, 0, 0.68], color: "#ffe080", glowColor: "rgba(255,220,80,0.18)", radius: 0.4, glowRadius: 1.2 },
      { id: "win_s", pos: [0, 0.51, 0.68], color: "#ffe080", glowColor: "rgba(255,220,80,0.18)", radius: 0.4, glowRadius: 1.2 }
    ]
  };

  // ../src/game/models/objects/xmas_house_b.zdef
  var xmas_house_b_default = {
    id: "xmas_house_b",
    pivot: [0, 0, 0],
    chimneyPos: { x: 0.4, y: 0.1, z: 2.75 },
    rescueZones: [{ x: 0.4, y: 0.1, w: 0.3, h: 0.3, role: "deliver" }],
    faces: [
      { id: "rw_wall", normal: [1, 0], verts: [[0.95, -0.65, 0], [0.95, 0.65, 0], [0.95, 0.65, 1.5], [0.95, -0.65, 1.5]], color: "#b8ccd8" },
      { id: "rw_gable", verts: [[0.95, -0.65, 1.5], [0.95, 0.65, 1.5], [0.95, 0, 2.4]], color: "#a8bcc8" },
      { id: "rw_win1", verts: [[0.955, -0.45, 0.5], [0.955, -0.15, 0.5], [0.955, -0.15, 1], [0.955, -0.45, 1]], color: "#ffe0a0" },
      { id: "rw_win2", verts: [[0.955, 0.15, 0.5], [0.955, 0.45, 0.5], [0.955, 0.45, 1], [0.955, 0.15, 1]], color: "#ffe0a0" },
      { id: "sw_wall", normal: [0, 1], verts: [[-0.95, 0.65, 0], [0.95, 0.65, 0], [0.95, 0.65, 1.5], [-0.95, 0.65, 1.5]], color: "#d4e0e8" },
      { id: "sw_gable", verts: [[-0.95, 0.65, 1.5], [0.95, 0.65, 1.5], [0, 0.65, 2.4]], color: "#ccd8e0" },
      { id: "sw_win", verts: [[-0.2, 0.655, 0.5], [0.2, 0.655, 0.5], [0.2, 0.655, 1], [-0.2, 0.655, 1]], color: "#ffe0a0" },
      { id: "sw_door", verts: [[-0.125, 0.655, 0], [0.125, 0.655, 0], [0.125, 0.655, 0.55], [-0.125, 0.655, 0.55]], color: "#4a2810" },
      { id: "sw_step", verts: [[-0.2, 0.7, 0], [0.2, 0.7, 0], [0.2, 0.65, 0.075], [-0.2, 0.65, 0.075]], color: "#aaaaaa" },
      { id: "roof_r", verts: [[0, -0.65, 2.4], [0, 0.65, 2.4], [0.95, 0.65, 1.5], [0.95, -0.65, 1.5]], color: "#2c5020" },
      { id: "roof_l", verts: [[0, -0.65, 2.4], [-0.95, -0.65, 1.5], [-0.95, 0.65, 1.5], [0, 0.65, 2.4]], color: "#243f18" },
      { id: "snow_r", verts: [[0, -0.675, 2.4], [0, 0.675, 2.4], [0.975, 0.675, 1.49], [0.975, -0.675, 1.49]], color: "#dde8f5" },
      { id: "snow_l", verts: [[0, -0.675, 2.4], [-0.975, -0.675, 1.49], [-0.975, 0.675, 1.49], [0, 0.675, 2.4]], color: "#d8e5f2" },
      { id: "ch_right", normal: [1, 0], verts: [[0.5, 0, 1.75], [0.5, 0.2, 1.75], [0.5, 0.2, 2.75], [0.5, 0, 2.75]], color: "#666666" },
      { id: "ch_south", normal: [0, 1], verts: [[0.3, 0.2, 1.75], [0.5, 0.2, 1.75], [0.5, 0.2, 2.75], [0.3, 0.2, 2.75]], color: "#777777" },
      { id: "ch_top", verts: [[0.3, 0, 2.75], [0.5, 0, 2.75], [0.5, 0.2, 2.75], [0.3, 0.2, 2.75]], color: "#888888" }
    ],
    lights: [
      { id: "win_r1", pos: [0.96, -0.3, 0.75], color: "#ffe0a0", glowColor: "rgba(255,220,120,0.15)", radius: 0.35, glowRadius: 1.1 },
      { id: "win_r2", pos: [0.96, 0.3, 0.75], color: "#ffe0a0", glowColor: "rgba(255,220,120,0.15)", radius: 0.35, glowRadius: 1.1 },
      { id: "win_s", pos: [0, 0.66, 0.75], color: "#ffe0a0", glowColor: "rgba(255,220,120,0.15)", radius: 0.35, glowRadius: 1.1 }
    ]
  };

  // ../src/game/models/objects/xmas_lantern.zdef
  var xmas_lantern_default = {
    id: "xmas_lantern",
    pivot: [0, 0, 0],
    faces: [
      { id: "pole_r", normal: [1, 0], verts: [[0.05, -0.05, 0], [0.05, 0.05, 0], [0.05, 0.05, 2.4], [0.05, -0.05, 2.4]], color: "#334455" },
      { id: "pole_f", normal: [0, -1], verts: [[-0.05, -0.05, 0], [0.05, -0.05, 0], [0.05, -0.05, 2.4], [-0.05, -0.05, 2.4]], color: "#445566" },
      { id: "head_r", normal: [1, 0], verts: [[0.18, -0.18, 2.4], [0.18, 0.18, 2.4], [0.18, 0.18, 2.85], [0.18, -0.18, 2.85]], color: "#334455" },
      { id: "head_f", normal: [0, -1], verts: [[-0.18, -0.18, 2.4], [0.18, -0.18, 2.4], [0.18, -0.18, 2.85], [-0.18, -0.18, 2.85]], color: "#445566" },
      { id: "head_t", verts: [[-0.18, -0.18, 2.85], [0.18, -0.18, 2.85], [0.18, 0.18, 2.85], [-0.18, 0.18, 2.85]], color: "#223344" },
      { id: "glass", verts: [[-0.14, -0.14, 2.42], [0.14, -0.14, 2.42], [0.14, 0.14, 2.42], [-0.14, 0.14, 2.42]], color: "#ffe8a0" },
      { id: "base", verts: [[-0.12, -0.12, 0], [0.12, -0.12, 0], [0.12, 0.12, 0], [-0.12, 0.12, 0]], color: "#223344" }
    ],
    lights: [
      { id: "glow", pos: [0, 0, 2.62], color: "#ffdd88", glowColor: "rgba(255,210,80,0.35)", radius: 1, glowRadius: 4, blinkHz: 0 }
    ]
  };

  // ../src/game/models/objects/sleigh.zdef
  var sleigh_default = {
    id: "sleigh",
    pivot: [0, 0, 0],
    faces: [
      { id: "run_top", verts: [[0.7, -0.35, 0.05], [0.7, 0.35, 0.05], [-0.7, 0.35, 0.05], [-0.7, -0.35, 0.05]], color: "#4a2c0a" },
      { id: "run_south", normal: [0, 1], verts: [[-0.7, 0.35, 0], [0.7, 0.35, 0], [0.7, 0.35, 0.05], [-0.7, 0.35, 0.05]], color: "#3a200a" },
      { id: "run_east", normal: [1, 0], verts: [[0.7, -0.35, 0], [0.7, 0.35, 0], [0.7, 0.35, 0.05], [0.7, -0.35, 0.05]], color: "#3a200a" },
      { id: "body_east", normal: [1, 0], verts: [[0.5, -0.3, 0.05], [0.5, 0.3, 0.05], [0.5, 0.3, 0.55], [0.5, -0.3, 0.55]], color: "#cc2222" },
      { id: "body_south", normal: [0, 1], verts: [[-0.5, 0.3, 0.05], [0.5, 0.3, 0.05], [0.5, 0.3, 0.55], [-0.5, 0.3, 0.55]], color: "#ee3333" },
      { id: "body_top", verts: [[-0.5, -0.3, 0.55], [0.5, -0.3, 0.55], [0.5, 0.3, 0.55], [-0.5, 0.3, 0.55]], color: "#882020" },
      { id: "back_wall", verts: [[-0.5, -0.3, 0.05], [-0.5, 0.3, 0.05], [-0.5, 0.3, 0.55], [-0.5, -0.3, 0.55]], color: "#aa1818" },
      { id: "trim_east", verts: [[0.505, -0.31, 0.52], [0.505, 0.31, 0.52], [0.505, 0.31, 0.58], [0.505, -0.31, 0.58]], color: "#ddaa00" },
      { id: "trim_south", verts: [[-0.505, 0.31, 0.52], [0.505, 0.31, 0.52], [0.505, 0.31, 0.58], [-0.505, 0.31, 0.58]], color: "#ddaa00" },
      { id: "seat", verts: [[-0.4, -0.25, 0.52], [0.4, -0.25, 0.52], [0.4, 0.25, 0.52], [-0.4, 0.25, 0.52]], color: "#5c3010" },
      { id: "curl_s", verts: [[-0.5, 0.35, 0.05], [-0.7, 0.35, 0.05], [-0.75, 0.35, 0.18], [-0.55, 0.35, 0.19]], color: "#3a200a" },
      { id: "curl_n", verts: [[-0.5, -0.35, 0.05], [-0.7, -0.35, 0.05], [-0.75, -0.35, 0.18], [-0.55, -0.35, 0.19]], color: "#3a200a" }
    ]
  };

  // ../src/game/models/objects/reindeer.zdef
  var reindeer_default = {
    id: "reindeer",
    pivot: [0, 0, 0],
    rescueZones: [{ x: 0, y: 0, w: 0.6, h: 0.4, role: "pickup" }],
    faces: [
      { id: "body_east", normal: [1, 0], verts: [[0.45, -0.18, 0.18], [0.45, 0.18, 0.18], [0.45, 0.18, 0.48], [0.45, -0.18, 0.48]], color: "#7a4520" },
      { id: "body_south", normal: [0, 1], verts: [[-0.45, 0.18, 0.18], [0.45, 0.18, 0.18], [0.45, 0.18, 0.48], [-0.45, 0.18, 0.48]], color: "#8b5228" },
      { id: "body_top", verts: [[-0.45, -0.18, 0.48], [0.45, -0.18, 0.48], [0.45, 0.18, 0.48], [-0.45, 0.18, 0.48]], color: "#7a4520" },
      { id: "belly", verts: [[-0.45, -0.18, 0.18], [0.45, -0.18, 0.18], [0.45, 0.18, 0.18], [-0.45, 0.18, 0.18]], color: "#c8906a" },
      { id: "leg_rf", verts: [[0.3, -0.15, 0], [0.38, -0.15, 0], [0.38, -0.15, 0.19], [0.3, -0.15, 0.19]], color: "#6a3818" },
      { id: "leg_lf", verts: [[0.3, 0.15, 0], [0.38, 0.15, 0], [0.38, 0.15, 0.19], [0.3, 0.15, 0.19]], color: "#6a3818" },
      { id: "leg_rb", verts: [[-0.3, -0.15, 0], [-0.22, -0.15, 0], [-0.22, -0.15, 0.19], [-0.3, -0.15, 0.19]], color: "#6a3818" },
      { id: "leg_lb", verts: [[-0.3, 0.15, 0], [-0.22, 0.15, 0], [-0.22, 0.15, 0.19], [-0.3, 0.15, 0.19]], color: "#6a3818" },
      { id: "neck", verts: [[0.45, -0.12, 0.35], [0.45, 0.12, 0.35], [0.58, 0.1, 0.45], [0.58, -0.1, 0.45]], color: "#7a4520" },
      { id: "head_east", normal: [1, 0], verts: [[0.55, -0.1, 0.43], [0.55, 0.1, 0.43], [0.55, 0.1, 0.58], [0.55, -0.1, 0.58]], color: "#7a4520" },
      { id: "head_south", normal: [0, 1], verts: [[0.45, 0.1, 0.43], [0.55, 0.1, 0.43], [0.55, 0.1, 0.58], [0.45, 0.1, 0.58]], color: "#8b5228" },
      { id: "snout", verts: [[0.55, -0.08, 0.44], [0.68, -0.06, 0.44], [0.68, 0.06, 0.44], [0.55, 0.08, 0.44]], color: "#c87050" },
      { id: "nose", verts: [[0.67, -0.04, 0.45], [0.72, -0.04, 0.45], [0.72, 0.04, 0.45], [0.67, 0.04, 0.45]], color: "#dd2020" },
      { id: "ant_r1", verts: [[0.52, -0.05, 0.58], [0.52, -0.05, 0.75], [0.62, -0.05, 0.82], [0.62, -0.05, 0.65]], color: "#5a3010" },
      { id: "ant_r2", verts: [[0.6, -0.05, 0.7], [0.6, -0.05, 0.8], [0.7, -0.05, 0.78], [0.7, -0.05, 0.68]], color: "#5a3010" },
      { id: "ant_l1", verts: [[0.52, 0.05, 0.58], [0.52, 0.05, 0.75], [0.62, 0.05, 0.82], [0.62, 0.05, 0.65]], color: "#5a3010" },
      { id: "ant_l2", verts: [[0.6, 0.05, 0.7], [0.6, 0.05, 0.8], [0.7, 0.05, 0.78], [0.7, 0.05, 0.68]], color: "#5a3010" }
    ]
  };

  // ../src/game/models/objects/volleyball_court.zdef
  var volleyball_court_default = {
    id: "volleyball_court",
    pivot: [0, 0, 0],
    faces: [
      {
        id: "sand",
        verts: [
          [-3, -1.5, 0],
          [3, -1.5, 0],
          [3, 1.5, 0],
          [-3, 1.5, 0]
        ],
        color: "#c8a56a",
        stroke: "#e8e4d0",
        strokeWidth: 1.5
      },
      {
        id: "center_line",
        verts: [
          [-0.06, -1.5, 0.01],
          [0.06, -1.5, 0.01],
          [0.06, 1.5, 0.01],
          [-0.06, 1.5, 0.01]
        ],
        color: "#d4c090",
        stroke: null
      },
      {
        id: "net",
        normal: [1, 0],
        verts: [
          [0.06, -1.8, 0],
          [0.06, 1.8, 0],
          [0.06, 1.8, 1.6],
          [0.06, -1.8, 1.6]
        ],
        color: "#b8b8b8",
        stroke: null
      }
    ]
  };

  // ../src/game/models/objects/hangar_tower.zdef
  var hangar_tower_default = {
    id: "hangar_tower",
    pivot: [0, 0, 0],
    faces: [
      { id: "base_front", normal: [1, 0], verts: [[0.675, -0.675, 0], [0.675, 0.675, 0], [0.675, 0.675, 0.375], [0.675, -0.675, 0.375]], color: "#888888" },
      { id: "base_left", normal: [0, 1], verts: [[-0.675, 0.675, 0], [0.675, 0.675, 0], [0.675, 0.675, 0.375], [-0.675, 0.675, 0.375]], color: "#999999" },
      { id: "base_top", verts: [[-0.675, -0.675, 0.375], [0.675, -0.675, 0.375], [0.675, 0.675, 0.375], [-0.675, 0.675, 0.375]], color: "#aaaaaa" },
      { id: "shaft_front", normal: [1, 0], verts: [[0.21, -0.21, 0.375], [0.21, 0.21, 0.375], [0.21, 0.21, 3.825], [0.21, -0.21, 3.825]], color: "#999999" },
      { id: "shaft_left", normal: [0, 1], verts: [[-0.21, 0.21, 0.375], [0.21, 0.21, 0.375], [0.21, 0.21, 3.825], [-0.21, 0.21, 3.825]], color: "#aaaaaa" },
      { id: "cab_front", normal: [1, 0], verts: [[0.21, -0.21, 3.825], [0.21, 0.21, 3.825], [0.57, 0.57, 4.875], [0.57, -0.57, 4.875]], color: "#888888" },
      { id: "cab_win_front_a", normal: [1, 0], verts: [[0.3435, -0.33, 4.2], [0.3435, -0.09, 4.2], [0.4725, -0.09, 4.575], [0.4725, -0.33, 4.575]], color: "#2a4e7a" },
      { id: "cab_win_front_b", normal: [1, 0], verts: [[0.3435, 0.09, 4.2], [0.3435, 0.33, 4.2], [0.4725, 0.33, 4.575], [0.4725, 0.09, 4.575]], color: "#2a4e7a" },
      { id: "cab_left", normal: [0, 1], verts: [[-0.21, 0.21, 3.825], [0.21, 0.21, 3.825], [0.57, 0.57, 4.875], [-0.57, 0.57, 4.875]], color: "#999999" },
      { id: "cab_win_left_a", normal: [0, 1], verts: [[-0.33, 0.3435, 4.2], [-0.09, 0.3435, 4.2], [-0.09, 0.4725, 4.575], [-0.33, 0.4725, 4.575]], color: "#2a4e7a" },
      { id: "cab_win_left_b", normal: [0, 1], verts: [[0.09, 0.3435, 4.2], [0.33, 0.3435, 4.2], [0.33, 0.4725, 4.575], [0.09, 0.4725, 4.575]], color: "#2a4e7a" },
      { id: "cab_top", verts: [[-0.57, -0.57, 4.875], [0.57, -0.57, 4.875], [0.57, 0.57, 4.875], [-0.57, 0.57, 4.875]], color: "#aaaaaa" },
      { id: "roof_front", normal: [1, 0], verts: [[0.645, -0.645, 4.875], [0.645, 0.645, 4.875], [0.645, 0.645, 4.995], [0.645, -0.645, 4.995]], color: "#666666" },
      { id: "roof_left", normal: [0, 1], verts: [[-0.645, 0.645, 4.875], [0.645, 0.645, 4.875], [0.645, 0.645, 4.995], [-0.645, 0.645, 4.995]], color: "#777777" },
      { id: "roof_top", verts: [[-0.645, -0.645, 4.995], [0.645, -0.645, 4.995], [0.645, 0.645, 4.995], [-0.645, 0.645, 4.995]], color: "#777777" },
      { id: "antenna_front", normal: [1, 0], verts: [[0.03, -0.03, 4.995], [0.03, 0.03, 4.995], [0.03, 0.03, 5.775], [0.03, -0.03, 5.775]], color: "#555555" },
      { id: "antenna_left", normal: [0, 1], verts: [[-0.03, 0.03, 4.995], [0.03, 0.03, 4.995], [0.03, 0.03, 5.775], [-0.03, 0.03, 5.775]], color: "#555555" },
      { id: "beacon", verts: [[-0.06, -0.06, 5.775], [0.06, -0.06, 5.775], [0.06, 0.06, 5.775], [-0.06, 0.06, 5.775]], color: "#ff2020" }
    ]
  };

  // ../src/game/models/objects/plane_wreck.zdef
  var plane_wreck_default = {
    id: "plane_wreck",
    pivot: [0, 0, 0],
    collisionBoxes: [
      {
        id: "body",
        xMin: -1.6,
        xMax: 1.4,
        yMin: -2.5,
        yMax: 2.4,
        zMin: 0,
        zMax: 0.65
      }
    ],
    faces: [
      {
        id: "scorch_main",
        verts: [
          [1.6, -1, 1e-3],
          [1.6, 0.5, 1e-3],
          [-0.5, 0.3, 1e-3],
          [-0.5, -1.2, 1e-3]
        ],
        color: "#1a1612"
      },
      {
        id: "scorch_trail",
        verts: [
          [-0.3, -1.8, 1e-3],
          [0.5, -2.2, 1e-3],
          [0.7, -1.5, 1e-3],
          [-0.1, -1.1, 1e-3]
        ],
        color: "#201e1a"
      },
      {
        id: "wing_left",
        verts: [
          [-0.05, 0.3, 0.01],
          [-0.45, 0.35, 0.01],
          [-0.7, 2.3, 0.01],
          [-0.15, 2.25, 0.01]
        ],
        color: "#d4c020"
      },
      {
        id: "wing_left_tip",
        verts: [
          [-0.15, 2.25, 0.012],
          [-0.7, 2.3, 0.012],
          [-0.85, 2.65, 0.012],
          [-0.1, 2.6, 0.012]
        ],
        color: "#cc1e00"
      },
      {
        id: "wing_right_inner",
        verts: [
          [-0.05, -0.3, 0.45],
          [-0.45, -0.35, 0.42],
          [-0.5, -1.2, 0.2],
          [-0.08, -1.1, 0.22]
        ],
        color: "#d4c020"
      },
      {
        id: "wing_right_outer",
        verts: [
          [-0.08, -1.1, 0.22],
          [-0.5, -1.2, 0.2],
          [-0.65, -2.5, 5e-3],
          [-0.08, -2.45, 5e-3]
        ],
        color: "#bfad18"
      },
      {
        id: "engine_cowling",
        verts: [
          [1.35, 0.12, 0.04],
          [1.35, -0.12, 0.04],
          [1, -0.22, 0.3],
          [1, 0.22, 0.3]
        ],
        color: "#2a2a2a"
      },
      {
        id: "fwd_fuselage",
        verts: [
          [1, 0.22, 0.3],
          [1, -0.22, 0.3],
          [-0.15, -0.27, 0.44],
          [-0.15, 0.27, 0.44]
        ],
        color: "#d6c822"
      },
      {
        id: "fwd_fuselage_side",
        verts: [
          [1, -0.22, 0.08],
          [1, -0.22, 0.3],
          [-0.15, -0.27, 0.44],
          [-0.15, -0.27, 0.1]
        ],
        color: "#c2b41c"
      },
      {
        id: "canopy",
        verts: [
          [0.85, 0.15, 0.44],
          [0.85, -0.15, 0.44],
          [-0.08, -0.25, 0.44],
          [-0.08, 0.25, 0.44]
        ],
        color: "#1a3350"
      },
      {
        id: "stripe",
        verts: [
          [0.85, -0.27, 0.28],
          [-0.1, -0.27, 0.28],
          [-0.1, -0.27, 0.36],
          [0.85, -0.27, 0.36]
        ],
        color: "#cc1e00"
      },
      {
        id: "rear_fuselage",
        verts: [
          [-0.15, 0.27, 0.44],
          [-0.15, -0.27, 0.44],
          [-1.5, -0.42, 0.26],
          [-1.5, 0.12, 0.26]
        ],
        color: "#d0c41e"
      },
      {
        id: "rear_fuselage_side",
        verts: [
          [-0.15, -0.27, 0.1],
          [-0.15, -0.27, 0.44],
          [-1.5, -0.42, 0.26],
          [-1.5, -0.42, 0.1]
        ],
        color: "#b8a41a"
      },
      {
        id: "tail_fin",
        verts: [
          [-1.05, -0.4, 0.26],
          [-1.5, -0.42, 0.26],
          [-1.5, -0.42, 0.66],
          [-1.05, -0.4, 0.5]
        ],
        color: "#cc1e00"
      },
      {
        id: "h_stab_l",
        verts: [
          [-1.1, -0.41, 0.27],
          [-1.4, -0.41, 0.27],
          [-1.4, -1, 0.27],
          [-1.1, -0.92, 0.27]
        ],
        color: "#d0c41e"
      },
      {
        id: "h_stab_r",
        verts: [
          [-1.1, 0.1, 0.27],
          [-1.4, 0.1, 0.27],
          [-1.4, 0.62, 0.27],
          [-1.1, 0.52, 0.27]
        ],
        color: "#d0c41e"
      },
      {
        id: "prop_blade",
        verts: [
          [1.42, 0.04, 3e-3],
          [1.42, -0.04, 3e-3],
          [1, -0.04, 3e-3],
          [0.95, 0.65, 3e-3]
        ],
        color: "#555"
      },
      {
        id: "debris",
        verts: [
          [0.4, -1.1, 3e-3],
          [0, -1.4, 3e-3],
          [-0.1, -1.1, 3e-3],
          [0.3, -0.9, 3e-3]
        ],
        color: "#b8a41a"
      }
    ]
  };

  // ../src/game/models/objects/sailboat_broken.zdef
  var sailboat_broken_default = {
    id: "sailboat_broken",
    pivot: [0, 0, 0],
    collisionBoxes: [
      {
        id: "hull",
        xMin: -1.1,
        xMax: 1.3,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0,
        zMax: 0.35
      }
    ],
    faces: [
      {
        id: "keel",
        verts: [
          [1.3, 0, 0],
          [0.2, -0.45, 0],
          [-1.1, -0.35, 0],
          [-1.1, 0.35, 0],
          [0.2, 0.45, 0]
        ],
        color: "#622"
      },
      {
        id: "stern",
        normal: [-1, 0],
        verts: [
          [-1.1, -0.35, 0],
          [-1.1, 0.35, 0],
          [-1.1, 0.35, 0.35],
          [-1.1, -0.35, 0.35]
        ],
        color: "#bbb"
      },
      {
        id: "stbd_lower_bow",
        normal: [0, -1],
        verts: [
          [1.3, 0, 0],
          [0.2, -0.45, 0],
          [0.2, -0.45, 0.1],
          [1.3, 0, 0.1]
        ],
        color: "#933"
      },
      {
        id: "stbd_lower_mid",
        normal: [0, -1],
        verts: [
          [0.2, -0.45, 0],
          [-1.1, -0.35, 0],
          [-1.1, -0.35, 0.1],
          [0.2, -0.45, 0.1]
        ],
        color: "#822"
      },
      {
        id: "stbd_upper_bow",
        normal: [0, -1],
        verts: [
          [1.3, 0, 0.1],
          [0.2, -0.45, 0.1],
          [0.2, -0.45, 0.35],
          [1.3, 0, 0.35]
        ],
        color: "#ddd"
      },
      {
        id: "stbd_upper_mid",
        normal: [0, -1],
        verts: [
          [0.2, -0.45, 0.1],
          [-1.1, -0.35, 0.1],
          [-1.1, -0.35, 0.35],
          [0.2, -0.45, 0.35]
        ],
        color: "#ccc"
      },
      {
        id: "port_bow",
        normal: [0, 1],
        verts: [
          [1.3, 0, 0],
          [0.2, 0.45, 0],
          [0.2, 0.45, 0.35],
          [1.3, 0, 0.35]
        ],
        color: "#ddd"
      },
      {
        id: "port_mid",
        normal: [0, 1],
        verts: [
          [0.2, 0.45, 0],
          [-1.1, 0.35, 0],
          [-1.1, 0.35, 0.35],
          [0.2, 0.45, 0.35]
        ],
        color: "#ccc"
      },
      {
        id: "deck",
        verts: [
          [1.3, 0, 0.35],
          [0.2, -0.45, 0.35],
          [-1.1, -0.35, 0.35],
          [-1.1, 0.35, 0.35],
          [0.2, 0.45, 0.35]
        ],
        color: "#a85",
        stroke: "#643"
      },
      {
        id: "mast_stump",
        verts: [
          [-0.34, -0.04, 0.35],
          [-0.26, -0.04, 0.35],
          [-0.26, -0.04, 0.65],
          [-0.34, -0.04, 0.65]
        ],
        color: "#aaa"
      },
      {
        id: "fallen_mast",
        verts: [
          [-0.34, -0.04, 0.35],
          [-0.26, -0.04, 0.35],
          [1.2, 0.35, 0.35],
          [1.28, 0.35, 0.35]
        ],
        color: "#bbb"
      },
      {
        id: "collapsed_sail",
        verts: [
          [-0.3, 0, 0.35],
          [0.9, 0.3, 0.35],
          [0.7, 0.42, 0.35],
          [-0.6, 0.15, 0.35]
        ],
        color: "rgba(230,230,220,0.7)",
        stroke: "#ccc"
      }
    ]
  };

  // ../src/game/models/research_platform.zdef
  var research_platform_default = {
    id: "research_platform",
    label: "research_platform",
    static: true,
    movementType: "none",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "pyl_F",
        normal: [
          1,
          0
        ],
        verts: [
          [
            0.4,
            -0.4,
            0
          ],
          [
            0.4,
            0.4,
            0
          ],
          [
            0.4,
            0.4,
            6
          ],
          [
            0.4,
            -0.4,
            6
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "pyl_B",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -0.4,
            0.4,
            0
          ],
          [
            -0.4,
            -0.4,
            0
          ],
          [
            -0.4,
            -0.4,
            6
          ],
          [
            -0.4,
            0.4,
            6
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "pyl_L",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -0.4,
            0.4,
            0
          ],
          [
            0.4,
            0.4,
            0
          ],
          [
            0.4,
            0.4,
            6
          ],
          [
            -0.4,
            0.4,
            6
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "pyl_R",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.4,
            -0.4,
            0
          ],
          [
            -0.4,
            -0.4,
            0
          ],
          [
            -0.4,
            -0.4,
            6
          ],
          [
            0.4,
            -0.4,
            6
          ]
        ],
        color: "#ffcc00"
      },
      {
        id: "deck_top",
        verts: [
          [
            1.5,
            1.5,
            6.5
          ],
          [
            1.5,
            -1.5,
            6.5
          ],
          [
            -1.5,
            -1.5,
            6.5
          ],
          [
            -1.5,
            1.5,
            6.5
          ]
        ],
        color: "#808080"
      },
      {
        id: "deck_F",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.5,
            -1.5,
            6
          ],
          [
            1.5,
            1.5,
            6
          ],
          [
            1.5,
            1.5,
            6.5
          ],
          [
            1.5,
            -1.5,
            6.5
          ]
        ],
        color: "#808080"
      },
      {
        id: "deck_B",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -1.5,
            1.5,
            6
          ],
          [
            -1.5,
            -1.5,
            6
          ],
          [
            -1.5,
            -1.5,
            6.5
          ],
          [
            -1.5,
            1.5,
            6.5
          ]
        ],
        color: "#808080"
      },
      {
        id: "deck_L",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -1.5,
            1.5,
            6
          ],
          [
            1.5,
            1.5,
            6
          ],
          [
            1.5,
            1.5,
            6.5
          ],
          [
            -1.5,
            1.5,
            6.5
          ]
        ],
        color: "#808080"
      },
      {
        id: "deck_R",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.5,
            -1.5,
            6
          ],
          [
            -1.5,
            -1.5,
            6
          ],
          [
            -1.5,
            -1.5,
            6.5
          ],
          [
            1.5,
            -1.5,
            6.5
          ]
        ],
        color: "#808080"
      },
      {
        id: "deck_bottom",
        verts: [
          [
            1.5,
            1.5,
            6
          ],
          [
            1.5,
            -1.5,
            6
          ],
          [
            -1.5,
            -1.5,
            6
          ],
          [
            -1.5,
            1.5,
            6
          ]
        ],
        color: "#808080"
      },
      {
        id: "heli_top",
        verts: [
          [
            -1.5,
            1.2,
            6.51
          ],
          [
            -1.5,
            -1.2,
            6.51
          ],
          [
            -3.5,
            -1.2,
            6.51
          ],
          [
            -3.5,
            1.2,
            6.51
          ]
        ],
        color: "#2a8f2a"
      },
      {
        id: "h_v1",
        verts: [
          [
            -2.2,
            0.5,
            6.52
          ],
          [
            -2.2,
            -0.5,
            6.52
          ],
          [
            -2.4,
            -0.5,
            6.52
          ],
          [
            -2.4,
            0.5,
            6.52
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "h_v2",
        verts: [
          [
            -2.6,
            0.5,
            6.52
          ],
          [
            -2.6,
            -0.5,
            6.52
          ],
          [
            -2.8,
            -0.5,
            6.52
          ],
          [
            -2.8,
            0.5,
            6.52
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "h_bar",
        verts: [
          [
            -2.2,
            0.1,
            6.53
          ],
          [
            -2.2,
            -0.1,
            6.53
          ],
          [
            -2.8,
            -0.1,
            6.53
          ],
          [
            -2.8,
            0.1,
            6.53
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_F1",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.1,
            -0.1,
            6.5
          ],
          [
            1.1,
            0.1,
            6.5
          ],
          [
            1.1,
            0.1,
            8.5
          ],
          [
            1.1,
            -0.1,
            8.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_F2",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.1,
            -0.1,
            8.5
          ],
          [
            1.1,
            0.1,
            8.5
          ],
          [
            1.1,
            0.1,
            10.5
          ],
          [
            1.1,
            -0.1,
            10.5
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_F3",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.1,
            -0.1,
            10.5
          ],
          [
            1.1,
            0.1,
            10.5
          ],
          [
            1.1,
            0.1,
            12.5
          ],
          [
            1.1,
            -0.1,
            12.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_F4",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.1,
            -0.1,
            12.5
          ],
          [
            1.1,
            0.1,
            12.5
          ],
          [
            1.1,
            0.1,
            15
          ],
          [
            1.1,
            -0.1,
            15
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_B1",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.9,
            0.1,
            6.5
          ],
          [
            0.9,
            -0.1,
            6.5
          ],
          [
            0.9,
            -0.1,
            8.5
          ],
          [
            0.9,
            0.1,
            8.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_B2",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.9,
            0.1,
            8.5
          ],
          [
            0.9,
            -0.1,
            8.5
          ],
          [
            0.9,
            -0.1,
            10.5
          ],
          [
            0.9,
            0.1,
            10.5
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_B3",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.9,
            0.1,
            10.5
          ],
          [
            0.9,
            -0.1,
            10.5
          ],
          [
            0.9,
            -0.1,
            12.5
          ],
          [
            0.9,
            0.1,
            12.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_B4",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.9,
            0.1,
            12.5
          ],
          [
            0.9,
            -0.1,
            12.5
          ],
          [
            0.9,
            -0.1,
            15
          ],
          [
            0.9,
            0.1,
            15
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_L1",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.9,
            0.1,
            6.5
          ],
          [
            1.1,
            0.1,
            6.5
          ],
          [
            1.1,
            0.1,
            8.5
          ],
          [
            0.9,
            0.1,
            8.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_L2",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.9,
            0.1,
            8.5
          ],
          [
            1.1,
            0.1,
            8.5
          ],
          [
            1.1,
            0.1,
            10.5
          ],
          [
            0.9,
            0.1,
            10.5
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_L3",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.9,
            0.1,
            10.5
          ],
          [
            1.1,
            0.1,
            10.5
          ],
          [
            1.1,
            0.1,
            12.5
          ],
          [
            0.9,
            0.1,
            12.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_L4",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.9,
            0.1,
            12.5
          ],
          [
            1.1,
            0.1,
            12.5
          ],
          [
            1.1,
            0.1,
            15
          ],
          [
            0.9,
            0.1,
            15
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_R1",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.1,
            -0.1,
            6.5
          ],
          [
            0.9,
            -0.1,
            6.5
          ],
          [
            0.9,
            -0.1,
            8.5
          ],
          [
            1.1,
            -0.1,
            8.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_R2",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.1,
            -0.1,
            8.5
          ],
          [
            0.9,
            -0.1,
            8.5
          ],
          [
            0.9,
            -0.1,
            10.5
          ],
          [
            1.1,
            -0.1,
            10.5
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_R3",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.1,
            -0.1,
            10.5
          ],
          [
            0.9,
            -0.1,
            10.5
          ],
          [
            0.9,
            -0.1,
            12.5
          ],
          [
            1.1,
            -0.1,
            12.5
          ]
        ],
        color: "#ffffff"
      },
      {
        id: "m_R4",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.1,
            -0.1,
            12.5
          ],
          [
            0.9,
            -0.1,
            12.5
          ],
          [
            0.9,
            -0.1,
            15
          ],
          [
            1.1,
            -0.1,
            15
          ]
        ],
        color: "#ff0000"
      },
      {
        id: "m_top",
        verts: [
          [
            1.1,
            0.1,
            15
          ],
          [
            1.1,
            -0.1,
            15
          ],
          [
            0.9,
            -0.1,
            15
          ],
          [
            0.9,
            0.1,
            15
          ]
        ],
        color: "#ffffff"
      }
    ],
    collisionBoxes: [
      {
        id: "pylon",
        xMin: -0.4,
        xMax: 0.4,
        yMin: -0.4,
        yMax: 0.4,
        zMin: 0,
        zMax: 6
      },
      {
        id: "deck",
        xMin: -1.5,
        xMax: 1.5,
        yMin: -1.5,
        yMax: 1.5,
        zMin: 6,
        zMax: 6.5
      },
      {
        id: "tower",
        xMin: 0.8,
        xMax: 1.2,
        yMin: -0.2,
        yMax: 0.2,
        zMin: 6.5,
        zMax: 15
      }
    ],
    rescueZones: [
      {
        x: -2.4,
        y: 0.1,
        w: 1.1,
        h: 1.2,
        role: "both",
        z: 0
      }
    ],
    landingZone: {
      x: -2.5,
      y: 0,
      w: 1,
      h: 1.2,
      z: 6.65
    }
  };

  // ../src/game/models/submarine.zdef
  var submarine_default = {
    id: "submarine",
    label: "submarine",
    static: true,
    movementType: "none",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "keel",
        verts: [
          [
            -4.5,
            -0.6,
            0
          ],
          [
            4.5,
            -0.6,
            0
          ],
          [
            4.5,
            0.6,
            0
          ],
          [
            -4.5,
            0.6,
            0
          ]
        ],
        color: "#020202"
      },
      {
        id: "deck_main",
        verts: [
          [
            -4.5,
            -0.7,
            0.25
          ],
          [
            4.5,
            -0.7,
            0.25
          ],
          [
            4.5,
            0.7,
            0.25
          ],
          [
            -4.5,
            0.7,
            0.25
          ]
        ],
        color: "#111111"
      },
      {
        id: "deck_bow",
        verts: [
          [
            4.5,
            -0.7,
            0.25
          ],
          [
            5.3,
            -0.28,
            0.25
          ],
          [
            5.6,
            0,
            0.25
          ],
          [
            5.3,
            0.28,
            0.25
          ],
          [
            4.5,
            0.7,
            0.25
          ]
        ],
        color: "#0e0e0e"
      },
      {
        id: "deck_stern",
        verts: [
          [
            -4.5,
            0.7,
            0.25
          ],
          [
            -4.5,
            -0.7,
            0.25
          ],
          [
            -5.2,
            -0.2,
            0.25
          ],
          [
            -5.2,
            0.2,
            0.25
          ]
        ],
        color: "#0e0e0e"
      },
      {
        id: "hull_starboard",
        normal: [
          0,
          1
        ],
        verts: [
          [
            4.5,
            0.7,
            0
          ],
          [
            -4.5,
            0.7,
            0
          ],
          [
            -4.5,
            0.7,
            0.25
          ],
          [
            4.5,
            0.7,
            0.25
          ]
        ],
        color: "#090909"
      },
      {
        id: "hull_port",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -4.5,
            -0.7,
            0
          ],
          [
            4.5,
            -0.7,
            0
          ],
          [
            4.5,
            -0.7,
            0.25
          ],
          [
            -4.5,
            -0.7,
            0.25
          ]
        ],
        color: "#060606"
      },
      {
        id: "bow_starboard",
        normal: [
          1,
          0
        ],
        verts: [
          [
            4.5,
            0.7,
            0
          ],
          [
            5.6,
            0,
            0
          ],
          [
            5.6,
            0,
            0.25
          ],
          [
            4.5,
            0.7,
            0.25
          ]
        ],
        color: "#0b0b0b"
      },
      {
        id: "bow_port",
        normal: [
          1,
          0
        ],
        verts: [
          [
            5.6,
            0,
            0
          ],
          [
            4.5,
            -0.7,
            0
          ],
          [
            4.5,
            -0.7,
            0.25
          ],
          [
            5.6,
            0,
            0.25
          ]
        ],
        color: "#080808"
      },
      {
        id: "stern_starboard",
        normal: [
          0,
          1
        ],
        verts: [
          [
            -4.5,
            0.7,
            0
          ],
          [
            -5.2,
            0.2,
            0
          ],
          [
            -5.2,
            0.2,
            0.25
          ],
          [
            -4.5,
            0.7,
            0.25
          ]
        ],
        color: "#060606"
      },
      {
        id: "stern_port",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            -5.2,
            -0.2,
            0
          ],
          [
            -4.5,
            -0.7,
            0
          ],
          [
            -4.5,
            -0.7,
            0.25
          ],
          [
            -5.2,
            -0.2,
            0.25
          ]
        ],
        color: "#050505"
      },
      {
        id: "tower_top",
        verts: [
          [
            0.8,
            -0.32,
            2.4
          ],
          [
            2.3,
            -0.32,
            2.4
          ],
          [
            2.3,
            0.32,
            2.4
          ],
          [
            0.8,
            0.32,
            2.4
          ]
        ],
        color: "#181818"
      },
      {
        id: "tower_bow",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.3,
            -0.32,
            0.25
          ],
          [
            2.3,
            0.32,
            0.25
          ],
          [
            2.3,
            0.32,
            2.4
          ],
          [
            2.3,
            -0.32,
            2.4
          ]
        ],
        color: "#0e0e0e"
      },
      {
        id: "tower_starboard",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.3,
            0.32,
            0.25
          ],
          [
            0.8,
            0.32,
            0.25
          ],
          [
            0.8,
            0.32,
            2.4
          ],
          [
            2.3,
            0.32,
            2.4
          ]
        ],
        color: "#0c0c0c"
      },
      {
        id: "tower_stern",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.8,
            0.32,
            0.25
          ],
          [
            0.8,
            -0.32,
            0.25
          ],
          [
            0.8,
            -0.32,
            2.4
          ],
          [
            0.8,
            0.32,
            2.4
          ]
        ],
        color: "#090909"
      },
      {
        id: "tower_port",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.8,
            -0.32,
            0.25
          ],
          [
            2.3,
            -0.32,
            0.25
          ],
          [
            2.3,
            -0.32,
            2.4
          ],
          [
            0.8,
            -0.32,
            2.4
          ]
        ],
        color: "#0b0b0b"
      },
      {
        id: "periscope",
        verts: [
          [
            1.49,
            -0.03,
            2.4
          ],
          [
            1.51,
            -0.03,
            2.4
          ],
          [
            1.51,
            -0.03,
            3.1
          ],
          [
            1.49,
            -0.03,
            3.1
          ]
        ],
        color: "#222222"
      }
    ],
    collisionBoxes: [
      {
        id: "hull",
        xMin: -5.2,
        xMax: 5.6,
        yMin: -0.7,
        yMax: 0.7,
        zMin: 0,
        zMax: 0.3
      },
      {
        id: "tower",
        xMin: 0.8,
        xMax: 2.3,
        yMin: -0.32,
        yMax: 0.32,
        zMin: 0.3,
        zMax: 2.4
      }
    ],
    rescueZones: [
      {
        x: -1.6,
        y: 0,
        w: 2,
        h: 0.7,
        z: 0.15,
        role: "both"
      }
    ]
  };

  // ../src/game/models/carrier.zdef
  var carrier_default = {
    version: 2,
    id: "carrier",
    collisionBoxes: [
      { id: "hull", xMin: -8.7, xMax: 8.7, yMin: -4.2, yMax: 4.2, zMin: 0, zMax: 4.2 },
      { id: "tower", xMin: -5.5, xMax: -1, yMin: 2.6, yMax: 4.1, zMin: 4.2, zMax: 6.7 }
    ],
    landingZone: { x: 0, y: 0, w: 16, h: 7, z: 4.2 },
    nodes: [
      {
        faces: [
          { id: "hull_bow", normal: [1, 0], verts: [[8.7, -2.52, 0], [8.7, 2.52, 0], [8.7, 4.2, 3.8], [8.7, -4.2, 3.8]], color: "#7b8998" },
          { id: "hull_starboard", normal: [0, 1], verts: [[8.7, 2.52, 0], [-8.7, 2.52, 0], [-8.7, 4.2, 3.8], [8.7, 4.2, 3.8]], color: "#7b8998" },
          { id: "hull_stern", normal: [-1, 0], verts: [[-8.7, 2.52, 0], [-8.7, -2.52, 0], [-8.7, -4.2, 3.8], [-8.7, 4.2, 3.8]], color: "#7b8998" },
          { id: "hull_port", normal: [0, -1], verts: [[-8.7, -2.52, 0], [8.7, -2.52, 0], [8.7, -4.2, 3.8], [-8.7, -4.2, 3.8]], color: "#7b8998" },
          { id: "deck_base", verts: [[8.7, -4.2, 3.8], [8.7, 4.2, 3.8], [-8.7, 4.2, 3.8], [-8.7, -4.2, 3.8]], color: "#222222" },
          { id: "deck_bow", normal: [1, 0], verts: [[8.7, -4.2, 3.8], [8.7, 4.2, 3.8], [8.7, 4.2, 4.2], [8.7, -4.2, 4.2]], color: "#222228" },
          { id: "deck_starboard", normal: [0, 1], verts: [[8.7, 4.2, 3.8], [-8.7, 4.2, 3.8], [-8.7, 4.2, 4.2], [8.7, 4.2, 4.2]], color: "#2a2a33" },
          { id: "deck_stern", normal: [-1, 0], verts: [[-8.7, 4.2, 3.8], [-8.7, -4.2, 3.8], [-8.7, -4.2, 4.2], [-8.7, 4.2, 4.2]], color: "#222228" },
          { id: "deck_port", normal: [0, -1], verts: [[-8.7, -4.2, 3.8], [8.7, -4.2, 3.8], [8.7, -4.2, 4.2], [-8.7, -4.2, 4.2]], color: "#2a2a33" },
          { id: "flight_deck", verts: [[8.7, -4.2, 4.2], [8.7, 4.2, 4.2], [-8.7, 4.2, 4.2], [-8.7, -4.2, 4.2]], color: "#3a3a44" },
          { id: "pad_bow", verts: [[5.9, -3.7, 4.21], [5.9, -0.9, 4.21], [3.1, -0.9, 4.21], [3.1, -3.7, 4.21]], color: "#52526a" },
          { id: "pad_mid", verts: [[1.4, -3.7, 4.21], [1.4, -0.9, 4.21], [-1.4, -0.9, 4.21], [-1.4, -3.7, 4.21]], color: "#52526a" },
          { id: "pad_stern", verts: [[-3.1, -3.7, 4.21], [-3.1, -0.9, 4.21], [-5.9, -0.9, 4.21], [-5.9, -3.7, 4.21]], color: "#52526a" }
        ]
      },
      {
        depthAnchor: [-3.25, 3.35],
        faces: [
          { id: "tower_bow", normal: [1, 0], verts: [[-1, 2.6, 4.2], [-1, 4.1, 4.2], [-1, 4.1, 6.7], [-1, 2.6, 6.7]], color: "#6e7a88" },
          { id: "tower_starboard", normal: [0, 1], verts: [[-1, 4.1, 4.2], [-5.5, 4.1, 4.2], [-5.5, 4.1, 6.7], [-1, 4.1, 6.7]], color: "#8898a8" },
          { id: "tower_stern", normal: [-1, 0], verts: [[-5.5, 2.6, 4.2], [-5.5, 4.1, 4.2], [-5.5, 4.1, 6.7], [-5.5, 2.6, 6.7]], color: "#6e7a88" },
          { id: "tower_port", normal: [0, -1], verts: [[-1, 2.6, 4.2], [-5.5, 2.6, 4.2], [-5.5, 2.6, 6.7], [-1, 2.6, 6.7]], color: "#8898a8" },
          { id: "tower_roof", verts: [[-1, 2.6, 6.7], [-1, 4.1, 6.7], [-5.5, 4.1, 6.7], [-5.5, 2.6, 6.7]], color: "#222222" }
        ],
        lights: [
          { x: -8.7, y: -4.2, z: 4.25, blink: true, color: "#ff0000", colorOff: "#550000", radius: 3 },
          { x: 8.7, y: -4.2, z: 4.25, blink: true, color: "#ff0000", colorOff: "#550000", radius: 3 },
          { x: 8.7, y: 4.2, z: 4.25, blink: true, color: "#ff0000", colorOff: "#550000", radius: 3 },
          { x: -8.7, y: 4.2, z: 4.25, blink: true, color: "#ff0000", colorOff: "#550000", radius: 3 }
        ],
        children: [
          {
            faces: [
              { id: "radar_mast", verts: [[-3.25, 3.335, 6.7], [-3.25, 3.365, 6.7], [-3.25, 3.365, 6.88], [-3.25, 3.335, 6.88]], color: "#888888" }
            ],
            children: [
              {
                faces: [
                  { id: "radar_arm", verts: [[-3.245, 3.13, 6.88], [-3.245, 3.57, 6.88], [-3.255, 3.57, 6.88], [-3.255, 3.13, 6.88]], color: "#cccccc" }
                ],
                rotate: {
                  pivot: [-3.25, 3.35, 6.88],
                  axis: [0, 0, 1],
                  animate: { type: "spin", speed: 2e-3 }
                }
              }
            ]
          },
          {
            faces: [
              { type: "line", verts: [[-3.25, 2.975, 6.7], [-3.25, 2.975, 7.3]], color: "#aaaaaa", lineWidth: 1.5 }
            ]
          }
        ]
      }
    ]
  };

  // ../src/game/models/frigate.zdef
  var frigate_default = {
    version: 2,
    id: "frigate",
    label: "Fregatte",
    static: false,
    movementType: "ship",
    pivot: [0, 0, 0],
    collisionBoxes: [
      { id: "hull", xMin: -8.5, xMax: 7, yMin: -2, yMax: 2, zMin: 0, zMax: 2 },
      { id: "superstructure", xMin: 0.5, xMax: 2.5, yMin: -1.4, yMax: 1.4, zMin: 2, zMax: 4 },
      { id: "hangar", xMin: -3.5, xMax: 0.5, yMin: -1.3, yMax: 1.3, zMin: 2, zMax: 3.3 },
      { id: "mast", xMin: 1.95, xMax: 2.05, yMin: -0.05, yMax: 0.05, zMin: 4, zMax: 6.5 }
    ],
    landingZone: { x: -6.1, y: 0, w: 4.5, h: 3.8, z: 2 },
    nodes: [
      {
        faces: [
          { id: "hull_bottom", verts: [[7, 0, 0], [2.5, 2, 0], [-8.5, 2, 0], [-8.5, -2, 0], [2.5, -2, 0]], color: "#5a6673" },
          { id: "hull_stern", normal: [-1, 0], verts: [[-8.5, 2, 0], [-8.5, -2, 0], [-8.5, -2, 2], [-8.5, 2, 2]], color: "#5a6673" },
          { id: "hull_starboard", normal: [0, 1], verts: [[2.5, 2, 0], [-8.5, 2, 0], [-8.5, 2, 2], [2.5, 2, 2]], color: "#5a6673" },
          { id: "hull_port", normal: [0, -1], verts: [[-8.5, -2, 0], [2.5, -2, 0], [2.5, -2, 2], [-8.5, -2, 2]], color: "#5a6673" },
          { id: "hull_bow_starboard", normal: [1, 0], verts: [[7, 0, 0], [2.5, 2, 0], [2.5, 2, 2], [7, 0, 2]], color: "#5a6673" },
          { id: "hull_bow_port", normal: [1, 0], verts: [[2.5, -2, 0], [7, 0, 0], [7, 0, 2], [2.5, -2, 2]], color: "#5a6673" },
          { id: "foredeck_bow", verts: [[7, 0, 2], [2.5, 2, 2], [2.5, -2, 2]], color: "#2a2a33" },
          { id: "deck", verts: [[2.5, 2, 2], [-8.5, 2, 2], [-8.5, -2, 2], [2.5, -2, 2]], color: "#2a2a33" },
          { id: "helipad_N", verts: [[-3.85, 1.9, 2.01], [-8.35, 1.9, 2.01], [-8.35, 1.7, 2.01], [-3.85, 1.7, 2.01]], color: "#ffffff" },
          { id: "helipad_S", verts: [[-3.85, -1.7, 2.01], [-8.35, -1.7, 2.01], [-8.35, -1.9, 2.01], [-3.85, -1.9, 2.01]], color: "#ffffff" },
          { id: "helipad_W", verts: [[-8.15, 1.9, 2.01], [-8.15, -1.9, 2.01], [-8.35, -1.9, 2.01], [-8.35, 1.9, 2.01]], color: "#ffffff" },
          { id: "helipad_E", verts: [[-3.85, 1.9, 2.01], [-3.85, -1.9, 2.01], [-4.05, -1.9, 2.01], [-4.05, 1.9, 2.01]], color: "#ffffff" }
        ]
      },
      {
        faces: [
          { id: "bridge_front", normal: [1, 0], verts: [[2.5, -1.4, 2], [2.5, 1.4, 2], [2.5, 1.4, 4], [2.5, -1.4, 4]], color: "#5a6673" },
          { id: "superstructure_starboard", normal: [0, 1], verts: [[2.5, 1.4, 2], [0.5, 1.4, 2], [0.5, 1.4, 4], [2.5, 1.4, 4]], color: "#5a6673" },
          { id: "superstructure_port", normal: [0, -1], verts: [[0.5, -1.4, 2], [2.5, -1.4, 2], [2.5, -1.4, 4], [0.5, -1.4, 4]], color: "#5a6673" },
          { id: "superstructure_back", normal: [-1, 0], verts: [[0.5, 1.4, 2], [0.5, -1.4, 2], [0.5, -1.4, 4], [0.5, 1.4, 4]], color: "#5a6673" },
          { id: "hangar_wall_back_L", normal: [-1, 0], verts: [[-3.5, 1.3, 3.3], [-3.5, 1, 3.3], [-3.5, 1, 2], [-3.5, 1.3, 2]], color: "#5a6673" },
          { id: "hangar_wall_back_R", normal: [-1, 0], verts: [[-3.5, -1, 3.3], [-3.5, -1.3, 3.3], [-3.5, -1.3, 2], [-3.5, -1, 2]], color: "#5a6673" },
          { id: "hangar_door", normal: [-1, 0], verts: [[-3.5, 1, 2], [-3.5, -1, 2], [-3.5, -1, 2.85], [-3.5, 1, 2.85]], color: "#111116" },
          { id: "hangar_door_interior", normal: [1, 0], verts: [[-3.4, -1, 2], [-3.4, 1, 2], [-3.4, 1, 2.85], [-3.4, -1, 2.85]], color: "#2a3038" },
          { id: "hangar_roof_lip", normal: [-1, 0], verts: [[-3.5, 1, 2.85], [-3.5, -1, 2.85], [-3.5, -1, 3.3], [-3.5, 1, 3.3]], color: "#5a6673" },
          { id: "hangar_starboard", normal: [0, 1], verts: [[0.5, 1.3, 2], [-3.5, 1.3, 2], [-3.5, 1.3, 3.3], [0.5, 1.3, 3.3]], color: "#5a6673" },
          { id: "hangar_port", normal: [0, -1], verts: [[-3.5, -1.3, 2], [0.5, -1.3, 2], [0.5, -1.3, 3.3], [-3.5, -1.3, 3.3]], color: "#5a6673" },
          { id: "hangar_roof", verts: [[0.5, -1.3, 3.3], [0.5, 1.3, 3.3], [-3.5, 1.3, 3.3], [-3.5, -1.3, 3.3]], color: "#222228" },
          { id: "superstructure_roof", verts: [[2.5, -1.4, 4], [2.5, 1.4, 4], [0.5, 1.4, 4], [0.5, -1.4, 4]], color: "#222228" },
          { id: "mast_fwd", verts: [[2.05, -0.05, 4], [2.05, 0.05, 4], [2.05, 0.05, 6.5], [2.05, -0.05, 6.5]], color: "#7a8898" },
          { id: "mast_stbd", verts: [[2.05, 0.05, 4], [1.95, 0.05, 4], [1.95, 0.05, 6.5], [2.05, 0.05, 6.5]], color: "#7a8898" },
          { id: "mast_port", verts: [[1.95, -0.05, 4], [2.05, -0.05, 4], [2.05, -0.05, 6.5], [1.95, -0.05, 6.5]], color: "#7a8898" },
          { id: "mast_aft", verts: [[1.95, 0.05, 4], [1.95, -0.05, 4], [1.95, -0.05, 6.5], [1.95, 0.05, 6.5]], color: "#7a8898" },
          { id: "mast_top", verts: [[2.05, -0.05, 6.5], [2.05, 0.05, 6.5], [1.95, 0.05, 6.5], [1.95, -0.05, 6.5]], color: "#7a8898" },
          { id: "hangar_mast_a_fwd", verts: [[0, 0.35, 3.4], [0, 0.5, 3.4], [0, 0.5, 4.3], [0, 0.35, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_a_stbd", verts: [[0, 0.5, 3.4], [-0.2, 0.5, 3.4], [-0.2, 0.5, 4.3], [0, 0.5, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_a_port", verts: [[-0.2, 0.35, 3.4], [0, 0.35, 3.4], [0, 0.35, 4.3], [-0.2, 0.35, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_a_aft", verts: [[-0.2, 0.5, 3.4], [-0.2, 0.35, 3.4], [-0.2, 0.35, 4.3], [-0.2, 0.5, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_a_top", verts: [[0, 0.35, 4.3], [0, 0.5, 4.3], [-0.2, 0.5, 4.3], [-0.2, 0.35, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_b_fwd", verts: [[-1.4, -0.5, 3.4], [-1.4, -0.35, 3.4], [-1.4, -0.35, 4.3], [-1.4, -0.5, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_b_stbd", verts: [[-1.4, -0.35, 3.4], [-1.6, -0.35, 3.4], [-1.6, -0.35, 4.3], [-1.4, -0.35, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_b_port", verts: [[-1.6, -0.5, 3.4], [-1.4, -0.5, 3.4], [-1.4, -0.5, 4.3], [-1.6, -0.5, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_b_aft", verts: [[-1.6, -0.35, 3.4], [-1.6, -0.5, 3.4], [-1.6, -0.5, 4.3], [-1.6, -0.35, 4.3]], color: "#7a8898" },
          { id: "hangar_mast_b_top", verts: [[-1.4, -0.5, 4.3], [-1.4, -0.35, 4.3], [-1.6, -0.35, 4.3], [-1.6, -0.5, 4.3]], color: "#7a8898" },
          { id: "bridge_windows", normal: [1, 0], verts: [[2.51, -1.4, 3.2], [2.51, 1.4, 3.2], [2.51, 1.4, 3.65], [2.51, -1.4, 3.65]], color: "#1a2530" }
        ]
      }
    ]
  };

  // ../src/game/models/supply_vessel.zdef
  var supply_vessel_default = {
    version: 2,
    id: "offshore_supply_vessel_v11_true_flat",
    collisionBoxes: [
      {
        id: "hull",
        xMin: -2.5,
        xMax: 3.2,
        yMin: -1.2,
        yMax: 1.2,
        zMin: 0,
        zMax: 1.2
      },
      {
        id: "superstructure",
        xMin: 1,
        xMax: 2.2,
        yMin: -0.8,
        yMax: 0.8,
        zMin: 1.2,
        zMax: 3.2
      }
    ],
    rescueZones: [
      { x: -0.7, y: 0, w: 1.8, h: 1, role: "pickup" }
    ],
    nodes: [
      {
        faces: [
          {
            id: "hull_bottom",
            verts: [
              [-3.5, 0, 0],
              [-3.2, 1.2, 0],
              [1, 1.2, 0],
              [2.2, 0.9, 0],
              [3, 0.4, 0],
              [3.4, 0, 0],
              [3, -0.4, 0],
              [2.2, -0.9, 0],
              [1, -1.2, 0],
              [-3.2, -1.2, 0]
            ],
            color: "#0d233a"
          },
          {
            id: "stern_mid",
            verts: [
              [
                -3.5,
                0,
                1.2
              ],
              [
                -3.5,
                0,
                0
              ],
              [
                -3.2,
                -1.2,
                0
              ],
              [
                -3.2,
                -1.2,
                1.2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "stern_L",
            verts: [
              [
                -3.2,
                1.2,
                1.2
              ],
              [
                -3.2,
                1.2,
                0
              ],
              [
                -3.5,
                0,
                0
              ],
              [
                -3.5,
                0,
                1.2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "hull_L_main",
            verts: [
              [
                -3.2,
                1.2,
                0
              ],
              [
                1,
                1.2,
                0
              ],
              [
                1,
                1.2,
                1.2
              ],
              [
                -3.2,
                1.2,
                1.2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "hull_R_main",
            verts: [
              [
                1,
                -1.2,
                0
              ],
              [
                -3.2,
                -1.2,
                0
              ],
              [
                -3.2,
                -1.2,
                1.2
              ],
              [
                1,
                -1.2,
                1.2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_L_seg1",
            verts: [
              [
                1,
                1.2,
                0
              ],
              [
                2.2,
                0.9,
                0
              ],
              [
                2.2,
                0.9,
                1.4
              ],
              [
                1,
                1.2,
                1.2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_R_seg1",
            verts: [
              [
                2.2,
                -0.9,
                0
              ],
              [
                1,
                -1.2,
                0
              ],
              [
                1,
                -1.2,
                1.2
              ],
              [
                2.2,
                -0.9,
                1.4
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_L_seg2",
            verts: [
              [
                2.2,
                0.9,
                0
              ],
              [
                3,
                0.4,
                0
              ],
              [
                3,
                0.4,
                1.7
              ],
              [
                2.2,
                0.9,
                1.4
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_R_seg2",
            verts: [
              [
                3,
                -0.4,
                0
              ],
              [
                2.2,
                -0.9,
                0
              ],
              [
                2.2,
                -0.9,
                1.4
              ],
              [
                3,
                -0.4,
                1.7
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_nose_L",
            verts: [
              [
                3,
                0.4,
                0
              ],
              [
                3.4,
                0,
                0
              ],
              [
                3,
                0,
                2
              ],
              [
                3,
                0.4,
                1.7
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "bow_nose_R",
            verts: [
              [
                3.4,
                0,
                0
              ],
              [
                3,
                -0.4,
                0
              ],
              [
                3,
                -0.4,
                1.7
              ],
              [
                3,
                0,
                2
              ]
            ],
            color: "#0d233a"
          },
          {
            id: "cargo_deck",
            verts: [
              [
                -3.2,
                1.2,
                1.2
              ],
              [
                1,
                1.2,
                1.2
              ],
              [
                1,
                -1.2,
                1.2
              ],
              [
                -3.2,
                -1.2,
                1.2
              ]
            ],
            color: "#4a4a4a"
          },
          {
            id: "deck_border_L",
            verts: [
              [
                1,
                1.2,
                1.2
              ],
              [
                2.2,
                0.9,
                1.4
              ],
              [
                3,
                0.4,
                1.7
              ],
              [
                3,
                0,
                2
              ],
              [
                3,
                -0.4,
                1.7
              ],
              [
                2.2,
                -0.9,
                1.4
              ],
              [
                1,
                -1.2,
                1.2
              ]
            ],
            color: "#3a3a3a"
          },
          {
            id: "cab_front_L",
            normal: [
              1,
              0.5
            ],
            verts: [
              [
                2.5,
                0,
                3.2
              ],
              [
                2.1,
                0.5,
                3.2
              ],
              [
                2.1,
                0.5,
                1.43
              ],
              [
                2.5,
                0,
                1.78
              ]
            ],
            color: "#f4f4f4"
          },
          {
            id: "cab_front_R",
            normal: [
              1,
              -0.5
            ],
            verts: [
              [
                2.1,
                -0.5,
                3.2
              ],
              [
                2.5,
                0,
                3.2
              ],
              [
                2.5,
                0,
                1.78
              ],
              [
                2.1,
                -0.5,
                1.43
              ]
            ],
            color: "#f4f4f4"
          },
          {
            id: "cab_side_L_1",
            normal: [
              0.5,
              1
            ],
            verts: [
              [
                2.1,
                0.5,
                3.2
              ],
              [
                1.4,
                0.9,
                3.2
              ],
              [
                1.4,
                0.9,
                1.25
              ],
              [
                2.1,
                0.5,
                1.43
              ]
            ],
            color: "#ebebeb"
          },
          {
            id: "cab_side_R_1",
            normal: [
              0.5,
              -1
            ],
            verts: [
              [
                1.4,
                -0.9,
                3.2
              ],
              [
                2.1,
                -0.5,
                3.2
              ],
              [
                2.1,
                -0.5,
                1.43
              ],
              [
                1.4,
                -0.9,
                1.25
              ]
            ],
            color: "#ebebeb"
          },
          {
            id: "cab_wall_L",
            normal: [
              0,
              1
            ],
            verts: [
              [
                1.4,
                0.9,
                3.2
              ],
              [
                0.2,
                0.9,
                3.2
              ],
              [
                0.2,
                0.9,
                1.2
              ],
              [
                1.4,
                0.9,
                1.25
              ]
            ],
            color: "#e2e2e2"
          },
          {
            id: "cab_wall_R",
            normal: [
              0,
              -1
            ],
            verts: [
              [
                0.2,
                -0.9,
                3.2
              ],
              [
                1.4,
                -0.9,
                3.2
              ],
              [
                1.4,
                -0.9,
                1.25
              ],
              [
                0.2,
                -0.9,
                1.2
              ]
            ],
            color: "#e2e2e2"
          },
          {
            id: "cab_back",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                0.2,
                -0.9,
                3.2
              ],
              [
                0.2,
                0.9,
                3.2
              ],
              [
                0.2,
                0.9,
                1.2
              ],
              [
                0.2,
                -0.9,
                1.2
              ]
            ],
            color: "#d5d5d5"
          },
          {
            id: "win_front_L",
            normal: [
              1,
              0.5
            ],
            verts: [
              [
                2.45,
                0,
                2.7
              ],
              [
                2.12,
                0.45,
                2.7
              ],
              [
                2.12,
                0.45,
                2.95
              ],
              [
                2.45,
                0,
                2.95
              ]
            ],
            color: "#1a2a3a"
          },
          {
            id: "win_front_R",
            normal: [
              1,
              -0.5
            ],
            verts: [
              [
                2.12,
                -0.45,
                2.7
              ],
              [
                2.45,
                0,
                2.7
              ],
              [
                2.45,
                0,
                2.95
              ],
              [
                2.12,
                -0.45,
                2.95
              ]
            ],
            color: "#1a2a3a"
          },
          {
            id: "win_side_L",
            normal: [
              0.5,
              1
            ],
            verts: [
              [
                2.08,
                0.48,
                2.7
              ],
              [
                1.42,
                0.88,
                2.7
              ],
              [
                1.42,
                0.88,
                2.95
              ],
              [
                2.08,
                0.48,
                2.95
              ]
            ],
            color: "#1a2a3a"
          },
          {
            id: "win_side_R",
            normal: [
              0.5,
              -1
            ],
            verts: [
              [
                1.42,
                -0.88,
                2.7
              ],
              [
                2.08,
                -0.48,
                2.7
              ],
              [
                2.08,
                -0.48,
                2.95
              ],
              [
                1.42,
                -0.88,
                2.95
              ]
            ],
            color: "#1a2a3a"
          },
          {
            id: "cab_roof",
            verts: [
              [
                2.5,
                0,
                3.2
              ],
              [
                2.1,
                0.5,
                3.2
              ],
              [
                1.4,
                0.9,
                3.2
              ],
              [
                0.2,
                0.9,
                3.2
              ],
              [
                0.2,
                -0.9,
                3.2
              ],
              [
                1.4,
                -0.9,
                3.2
              ],
              [
                2.1,
                -0.5,
                3.2
              ]
            ],
            color: "#ffcd07"
          },
          {
            id: "exhaust_L",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                0.1,
                0.5,
                1.2
              ],
              [
                0.1,
                0.7,
                1.2
              ],
              [
                0.1,
                0.7,
                3.8
              ],
              [
                0.1,
                0.5,
                3.8
              ]
            ],
            color: "#f9c907"
          },
          {
            id: "exhaust_R",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                0.1,
                -0.7,
                1.2
              ],
              [
                0.1,
                -0.5,
                1.2
              ],
              [
                0.1,
                -0.5,
                3.8
              ],
              [
                0.1,
                -0.7,
                3.8
              ]
            ],
            color: "#f9c907"
          }
        ],
        children: [
          {
            rotate: {
              pivot: [
                0.95,
                0,
                3.2
              ],
              axis: [
                0,
                0,
                1
              ],
              animate: {
                type: "spin",
                speed: 2e-3
              }
            },
            faces: [
              {
                id: "radar_blade",
                verts: [
                  [
                    1,
                    -0.4,
                    3.4
                  ],
                  [
                    1,
                    0.4,
                    3.4
                  ],
                  [
                    0.9,
                    0.4,
                    3.4
                  ],
                  [
                    0.9,
                    -0.4,
                    3.4
                  ]
                ],
                color: "#ffffff"
              }
            ]
          }
        ]
      }
    ]
  };

  // ../src/game/models/sar_boat.zdef
  var sar_boat_default = {
    version: 2,
    id: "pilot_boat_evo",
    collisionBoxes: [
      {
        id: "hull",
        xMin: -1.127,
        xMax: 1.225,
        yMin: -0.49,
        yMax: 0.49,
        zMin: 0,
        zMax: 0.49
      },
      {
        id: "cabin",
        xMin: -0.392,
        xMax: 0.245,
        yMin: -0.196,
        yMax: 0.196,
        zMin: 0.49,
        zMax: 0.98
      }
    ],
    nodes: [
      {
        faces: [
          {
            id: "stern_mid_under",
            verts: [
              [
                -1.127,
                0,
                0.245
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -0.98,
                -0.294,
                0
              ],
              [
                -0.98,
                -0.294,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "stern_L_under",
            verts: [
              [
                -0.98,
                0.49,
                0.245
              ],
              [
                -0.98,
                0.49,
                0
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -1.127,
                0,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "stern_R_under",
            verts: [
              [
                -0.98,
                -0.49,
                0.245
              ],
              [
                -0.98,
                -0.49,
                0
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -1.127,
                0,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "hull_L_under",
            verts: [
              [
                -0.98,
                0.49,
                0
              ],
              [
                0.245,
                0.49,
                0
              ],
              [
                0.245,
                0.49,
                0.245
              ],
              [
                -0.98,
                0.49,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "hull_R_under",
            verts: [
              [
                0.245,
                -0.49,
                0
              ],
              [
                -0.98,
                -0.49,
                0
              ],
              [
                -0.98,
                -0.49,
                0.245
              ],
              [
                0.245,
                -0.49,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "bow_L_1_under",
            verts: [
              [
                0.245,
                0.49,
                0
              ],
              [
                0.735,
                0.343,
                0
              ],
              [
                0.735,
                0.343,
                0.245
              ],
              [
                0.245,
                0.49,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "bow_R_1_under",
            verts: [
              [
                0.735,
                -0.343,
                0
              ],
              [
                0.245,
                -0.49,
                0
              ],
              [
                0.245,
                -0.49,
                0.245
              ],
              [
                0.735,
                -0.343,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "bow_tip_L_under",
            verts: [
              [
                0.735,
                0.343,
                0
              ],
              [
                1.225,
                0,
                0
              ],
              [
                1.225,
                0,
                0.245
              ],
              [
                0.735,
                0.343,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "bow_tip_R_under",
            verts: [
              [
                1.225,
                0,
                0
              ],
              [
                0.735,
                -0.343,
                0
              ],
              [
                0.735,
                -0.343,
                0.245
              ],
              [
                1.225,
                0,
                0.245
              ]
            ],
            color: "#d32f2f"
          },
          {
            id: "fender_stern_mid",
            verts: [
              [
                -1.127,
                0,
                0.49
              ],
              [
                -1.127,
                0,
                0.245
              ],
              [
                -0.98,
                -0.294,
                0.245
              ],
              [
                -0.98,
                -0.294,
                0.49
              ]
            ],
            color: "#222222"
          },
          {
            id: "fender_stern_L",
            verts: [
              [
                -0.98,
                0.49,
                0.49
              ],
              [
                -0.98,
                0.49,
                0.245
              ],
              [
                -1.127,
                0,
                0.245
              ],
              [
                -1.127,
                0,
                0.49
              ]
            ],
            color: "#222222"
          },
          {
            id: "fender_stern_R",
            verts: [
              [
                -0.98,
                -0.49,
                0.49
              ],
              [
                -0.98,
                -0.49,
                0.245
              ],
              [
                -1.127,
                0,
                0.245
              ],
              [
                -1.127,
                0,
                0.49
              ]
            ],
            color: "#222222"
          },
          {
            id: "fender_L",
            verts: [
              [
                -0.98,
                0.49,
                0.245
              ],
              [
                0.245,
                0.49,
                0.245
              ],
              [
                0.245,
                0.49,
                0.49
              ],
              [
                -0.98,
                0.49,
                0.49
              ]
            ],
            color: "#1a1a1a"
          },
          {
            id: "fender_R",
            verts: [
              [
                0.245,
                -0.49,
                0.245
              ],
              [
                -0.98,
                -0.49,
                0.245
              ],
              [
                -0.98,
                -0.49,
                0.49
              ],
              [
                0.245,
                -0.49,
                0.49
              ]
            ],
            color: "#1a1a1a"
          },
          {
            id: "fender_bow_L",
            verts: [
              [
                0.245,
                0.49,
                0.245
              ],
              [
                0.735,
                0.343,
                0.245
              ],
              [
                0.735,
                0.343,
                0.539
              ],
              [
                0.245,
                0.49,
                0.49
              ]
            ],
            color: "#222222"
          },
          {
            id: "fender_bow_R",
            verts: [
              [
                0.735,
                -0.343,
                0.245
              ],
              [
                0.245,
                -0.49,
                0.245
              ],
              [
                0.245,
                -0.49,
                0.49
              ],
              [
                0.735,
                -0.343,
                0.539
              ]
            ],
            color: "#222222"
          },
          {
            id: "fender_tip_L",
            verts: [
              [
                0.735,
                0.343,
                0.245
              ],
              [
                1.225,
                0,
                0.245
              ],
              [
                1.225,
                0,
                0.637
              ],
              [
                0.735,
                0.343,
                0.539
              ]
            ],
            color: "#2a2a2a"
          },
          {
            id: "fender_tip_R",
            verts: [
              [
                1.225,
                0,
                0.245
              ],
              [
                0.735,
                -0.343,
                0.245
              ],
              [
                0.735,
                -0.343,
                0.539
              ],
              [
                1.225,
                0,
                0.637
              ]
            ],
            color: "#2a2a2a"
          },
          {
            id: "deck_main",
            verts: [
              [
                -1.127,
                0,
                0.49
              ],
              [
                -0.98,
                0.49,
                0.49
              ],
              [
                0.245,
                0.49,
                0.49
              ],
              [
                0.245,
                -0.49,
                0.49
              ],
              [
                -0.98,
                -0.49,
                0.49
              ]
            ],
            color: "#444444"
          },
          {
            id: "deck_bow",
            verts: [
              [
                0.245,
                0.49,
                0.49
              ],
              [
                0.735,
                0.343,
                0.539
              ],
              [
                1.225,
                0,
                0.637
              ],
              [
                0.735,
                -0.343,
                0.539
              ],
              [
                0.245,
                -0.49,
                0.49
              ]
            ],
            color: "#3f3f3f"
          },
          {
            id: "cab_f_L",
            normal: [
              1,
              1
            ],
            verts: [
              [
                0.245,
                0,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                0.049,
                0.196,
                0.49
              ],
              [
                0.245,
                0,
                0.49
              ]
            ],
            color: "#d9d9d9"
          },
          {
            id: "cab_f_R",
            normal: [
              1,
              -1
            ],
            verts: [
              [
                0.049,
                -0.196,
                0.98
              ],
              [
                0.245,
                0,
                0.98
              ],
              [
                0.245,
                0,
                0.49
              ],
              [
                0.049,
                -0.196,
                0.49
              ]
            ],
            color: "#d9d9d9"
          },
          {
            id: "cab_l",
            normal: [
              0,
              1
            ],
            verts: [
              [
                -0.392,
                0.2695,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                0.049,
                0.196,
                0.49
              ],
              [
                -0.392,
                0.2695,
                0.49
              ]
            ],
            color: "#d9d9d9"
          },
          {
            id: "cab_r",
            normal: [
              0,
              -1
            ],
            verts: [
              [
                0.049,
                -0.196,
                0.98
              ],
              [
                -0.392,
                -0.2695,
                0.98
              ],
              [
                -0.392,
                -0.2695,
                0.49
              ],
              [
                0.049,
                -0.196,
                0.49
              ]
            ],
            color: "#d9d9d9"
          },
          {
            id: "cab_b",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                -0.392,
                -0.2695,
                0.98
              ],
              [
                -0.392,
                0.2695,
                0.98
              ],
              [
                -0.392,
                0.2695,
                0.49
              ],
              [
                -0.392,
                -0.2695,
                0.49
              ]
            ],
            color: "#d9d9d9"
          },
          {
            id: "door_b",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                -0.392,
                -0.0882,
                0.49
              ],
              [
                -0.392,
                -0.0882,
                0.8575
              ],
              [
                -0.392,
                0.0882,
                0.8575
              ],
              [
                -0.392,
                0.0882,
                0.49
              ]
            ],
            color: "#222222",
            stroke: "#111111"
          },
          {
            id: "win_f_L",
            normal: [
              1,
              1
            ],
            verts: [
              [
                0.1862,
                0.049,
                0.6615
              ],
              [
                0.1862,
                0.049,
                0.9065
              ],
              [
                0.0882,
                0.1372,
                0.9065
              ],
              [
                0.0882,
                0.1372,
                0.6615
              ]
            ],
            color: "#1a3a5c"
          },
          {
            id: "win_f_R",
            normal: [
              1,
              -1
            ],
            verts: [
              [
                0.0882,
                -0.1372,
                0.6615
              ],
              [
                0.0882,
                -0.1372,
                0.9065
              ],
              [
                0.1862,
                -0.049,
                0.9065
              ],
              [
                0.1862,
                -0.049,
                0.6615
              ]
            ],
            color: "#1a3a5c"
          },
          {
            id: "roof",
            verts: [
              [
                0.245,
                0,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                -0.392,
                0.2695,
                0.98
              ],
              [
                -0.392,
                -0.2695,
                0.98
              ],
              [
                0.049,
                -0.196,
                0.98
              ]
            ],
            color: "#ff5500"
          },
          {
            id: "exhaust_pipe",
            verts: [
              [
                -0.3675,
                0.049,
                1.176
              ],
              [
                -0.343,
                0.049,
                1.176
              ],
              [
                -0.294,
                0.049,
                0.98
              ],
              [
                -0.3185,
                0.049,
                0.98
              ]
            ],
            color: "#333333"
          },
          {
            id: "antenna_base",
            verts: [
              [
                -0.2842,
                588e-5,
                1.0094
              ],
              [
                -0.2842,
                -588e-5,
                1.0094
              ],
              [
                -0.2842,
                -588e-5,
                0.98
              ],
              [
                -0.2842,
                588e-5,
                0.98
              ]
            ],
            color: "#222222"
          },
          {
            id: "antenna_needle",
            verts: [
              [
                -0.4998,
                588e-5,
                1.6562
              ],
              [
                -0.4998,
                -588e-5,
                1.6562
              ],
              [
                -0.2695,
                -588e-5,
                1.0094
              ],
              [
                -0.2695,
                588e-5,
                1.0094
              ]
            ],
            color: "#111111"
          },
          {
            id: "radar_mast",
            verts: [
              [
                -0.1568,
                0.01225,
                1.0437
              ],
              [
                -0.1568,
                -0.01225,
                1.0437
              ],
              [
                -0.1568,
                -0.01225,
                0.98
              ],
              [
                -0.1568,
                0.01225,
                0.98
              ]
            ],
            color: "#999999"
          }
        ],
        children: [
          {
            rotate: {
              pivot: [
                -0.1568,
                0,
                1.0437
              ],
              axis: [
                0,
                0,
                1
              ],
              animate: {
                type: "spin",
                speed: 2e-3
              }
            },
            faces: [
              {
                id: "radar_arm",
                verts: [
                  [
                    -0.1029,
                    -0.07546,
                    0.73059
                  ],
                  [
                    -0.1029,
                    0.07546,
                    0.73059
                  ],
                  [
                    -0.11662,
                    0.07546,
                    0.73059
                  ],
                  [
                    -0.11662,
                    -0.07546,
                    0.73059
                  ]
                ],
                color: "#cccccc"
              }
            ]
          }
        ]
      }
    ]
  };

  // ../src/game/models/pilot_boat.zdef
  var pilot_boat_default = {
    version: 2,
    id: "pilot_boat_v8_final",
    collisionBoxes: [
      {
        id: "hull",
        xMin: -1.127,
        xMax: 1.225,
        yMin: -0.49,
        yMax: 0.49,
        zMin: 0,
        zMax: 0.49
      },
      {
        id: "cabin",
        xMin: -0.392,
        xMax: 0.196,
        yMin: -0.294,
        yMax: 0.294,
        zMin: 0.49,
        zMax: 0.98
      }
    ],
    nodes: [
      {
        faces: [
          {
            id: "stern_mid",
            verts: [
              [
                -1.127,
                0,
                0.49
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -0.98,
                -0.294,
                0
              ],
              [
                -0.98,
                -0.294,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "stern_L",
            verts: [
              [
                -0.98,
                0.49,
                0.49
              ],
              [
                -0.98,
                0.49,
                0
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -1.127,
                0,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "stern_R",
            verts: [
              [
                -0.98,
                -0.49,
                0.49
              ],
              [
                -0.98,
                -0.49,
                0
              ],
              [
                -1.127,
                0,
                0
              ],
              [
                -1.127,
                0,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "hull_L",
            verts: [
              [
                -0.98,
                0.49,
                0
              ],
              [
                0.245,
                0.49,
                0
              ],
              [
                0.245,
                0.49,
                0.49
              ],
              [
                -0.98,
                0.49,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "hull_R",
            verts: [
              [
                0.245,
                -0.49,
                0
              ],
              [
                -0.98,
                -0.49,
                0
              ],
              [
                -0.98,
                -0.49,
                0.49
              ],
              [
                0.245,
                -0.49,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "bow_L_1",
            verts: [
              [
                0.245,
                0.49,
                0
              ],
              [
                0.735,
                0.343,
                0
              ],
              [
                0.735,
                0.343,
                0.539
              ],
              [
                0.245,
                0.49,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "bow_R_1",
            verts: [
              [
                0.735,
                -0.343,
                0
              ],
              [
                0.245,
                -0.49,
                0
              ],
              [
                0.245,
                -0.49,
                0.539
              ],
              [
                0.735,
                -0.343,
                0.539
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "bow_tip_L",
            verts: [
              [
                0.735,
                0.343,
                0
              ],
              [
                1.225,
                0,
                0
              ],
              [
                1.225,
                0,
                0.637
              ],
              [
                0.735,
                0.343,
                0.539
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "bow_tip_R",
            verts: [
              [
                1.225,
                0,
                0
              ],
              [
                0.735,
                -0.343,
                0
              ],
              [
                0.735,
                -0.343,
                0.539
              ],
              [
                1.225,
                0,
                0.637
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "deck_main",
            verts: [
              [
                -1.127,
                0,
                0.49
              ],
              [
                -0.98,
                0.49,
                0.49
              ],
              [
                0.245,
                0.49,
                0.49
              ],
              [
                0.245,
                -0.49,
                0.49
              ],
              [
                -0.98,
                -0.49,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "deck_bow",
            verts: [
              [
                0.245,
                0.49,
                0.49
              ],
              [
                0.735,
                0.343,
                0.539
              ],
              [
                1.225,
                0,
                0.637
              ],
              [
                0.735,
                -0.343,
                0.539
              ],
              [
                0.245,
                -0.49,
                0.49
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "cab_f_L",
            normal: [
              1,
              1
            ],
            verts: [
              [
                0.196,
                0,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                0.049,
                0.196,
                0.49
              ],
              [
                0.196,
                0,
                0.49
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "cab_f_R",
            normal: [
              1,
              -1
            ],
            verts: [
              [
                0.049,
                -0.196,
                0.98
              ],
              [
                0.196,
                0,
                0.98
              ],
              [
                0.196,
                0,
                0.49
              ],
              [
                0.049,
                -0.196,
                0.49
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "cab_l",
            normal: [
              0,
              1
            ],
            verts: [
              [
                -0.392,
                0.294,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                0.049,
                0.196,
                0.49
              ],
              [
                -0.392,
                0.294,
                0.49
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "cab_r",
            normal: [
              0,
              -1
            ],
            verts: [
              [
                0.049,
                -0.196,
                0.98
              ],
              [
                -0.392,
                -0.294,
                0.98
              ],
              [
                -0.392,
                -0.294,
                0.49
              ],
              [
                0.049,
                -0.196,
                0.49
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "cab_b",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                -0.392,
                -0.294,
                0.98
              ],
              [
                -0.392,
                0.294,
                0.98
              ],
              [
                -0.392,
                0.294,
                0.49
              ],
              [
                -0.392,
                -0.294,
                0.49
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "door_b",
            normal: [
              -1,
              0
            ],
            verts: [
              [
                -0.392,
                -0.098,
                0.49
              ],
              [
                -0.392,
                -0.098,
                0.833
              ],
              [
                -0.392,
                0.098,
                0.833
              ],
              [
                -0.392,
                0.098,
                0.49
              ]
            ],
            color: "#664400",
            stroke: "#332200"
          },
          {
            id: "win_f_L",
            normal: [
              1,
              1
            ],
            verts: [
              [
                0.1519,
                0.049,
                0.686
              ],
              [
                0.1519,
                0.049,
                0.882
              ],
              [
                0.0931,
                0.1372,
                0.882
              ],
              [
                0.0931,
                0.1372,
                0.686
              ]
            ],
            color: "#336699"
          },
          {
            id: "win_f_R",
            normal: [
              1,
              -1
            ],
            verts: [
              [
                0.0931,
                -0.1372,
                0.686
              ],
              [
                0.0931,
                -0.1372,
                0.882
              ],
              [
                0.1519,
                -0.049,
                0.882
              ],
              [
                0.1519,
                -0.049,
                0.686
              ]
            ],
            color: "#336699"
          },
          {
            id: "roof",
            verts: [
              [
                0.196,
                0,
                0.98
              ],
              [
                0.049,
                0.196,
                0.98
              ],
              [
                -0.392,
                0.294,
                0.98
              ],
              [
                -0.392,
                -0.294,
                0.98
              ],
              [
                0.049,
                -0.196,
                0.98
              ]
            ],
            color: "#cc9900"
          },
          {
            id: "antenna_base",
            verts: [
              [
                -0.2842,
                588e-5,
                1.0094
              ],
              [
                -0.2842,
                -588e-5,
                1.0094
              ],
              [
                -0.2842,
                -588e-5,
                0.98
              ],
              [
                -0.2842,
                588e-5,
                0.98
              ]
            ],
            color: "#222222"
          },
          {
            id: "antenna_needle",
            verts: [
              [
                -0.4998,
                588e-5,
                1.6562
              ],
              [
                -0.4998,
                -588e-5,
                1.6562
              ],
              [
                -0.2695,
                -588e-5,
                1.0094
              ],
              [
                -0.2695,
                588e-5,
                1.0094
              ]
            ],
            color: "#111111"
          },
          {
            id: "radar_mast",
            verts: [
              [
                -0.1568,
                0.01225,
                1.0437
              ],
              [
                -0.1568,
                -0.01225,
                1.0437
              ],
              [
                -0.1568,
                -0.01225,
                0.98
              ],
              [
                -0.1568,
                0.01225,
                0.98
              ]
            ],
            color: "#999999"
          }
        ],
        children: [
          {
            rotate: {
              pivot: [
                -0.1568,
                0,
                1.0437
              ],
              axis: [
                0,
                0,
                1
              ],
              animate: {
                type: "spin",
                speed: 2e-3
              }
            },
            faces: [
              {
                id: "radar_arm",
                verts: [
                  [
                    -0.1029,
                    -0.07546,
                    0.73059
                  ],
                  [
                    -0.1029,
                    0.07546,
                    0.73059
                  ],
                  [
                    -0.11662,
                    0.07546,
                    0.73059
                  ],
                  [
                    -0.11662,
                    -0.07546,
                    0.73059
                  ]
                ],
                color: "#cccccc"
              }
            ]
          }
        ]
      }
    ]
  };

  // editor-view/render.ts
  var _DEF_MAP = {
    lighthouse: { def: lighthouse_default, v2: false },
    wind_turbine: { def: wind_turbine_default, v2: false },
    buoy: { def: buoy_default, v2: false },
    baywatch_car: { def: baywatch_car_default, v2: false },
    baywatch_hq: { def: baywatch_hq_default, v2: false },
    baywatch_tower: { def: baywatch_tower_default, v2: false },
    concert_stage: { def: concert_stage_default, v2: false },
    festival_tent: { def: festival_tent_default, v2: false },
    festival_tent_broken: { def: festival_tent_broken_default, v2: false },
    festival_car: { def: festival_car_default, v2: false },
    xmas_house_a: { def: xmas_house_a_default, v2: false },
    xmas_house_b: { def: xmas_house_b_default, v2: false },
    xmas_lantern: { def: xmas_lantern_default, v2: false },
    sleigh: { def: sleigh_default, v2: false },
    reindeer: { def: reindeer_default, v2: false },
    volleyball_court: { def: volleyball_court_default, v2: false },
    hangar_tower: { def: hangar_tower_default, v2: false },
    plane_wreck: { def: plane_wreck_default, v2: false },
    sailboat_broken: { def: sailboat_broken_default, v2: false },
    research_platform: { def: research_platform_default, v2: false },
    submarine: { def: submarine_default, v2: false },
    carrier: { def: carrier_default, v2: true },
    frigate: { def: frigate_default, v2: true },
    supply_vessel: { def: supply_vessel_default, v2: true },
    sar_boat: { def: sar_boat_default, v2: true },
    pilot_boat: { def: pilot_boat_default, v2: true }
  };
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
    state.zoom = 16 / BASE_HW;
    state.panX = gridSize / 2;
    state.panY = gridSize / 2;
  };
  var fitCamera = (gridSize) => {
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
    const defTW = hw * 2;
    const defIso = createIsoFn({ canvas, tileW: defTW, tileH: hh * 2, stepH: hw * 0.78 });
    const defCamX = canvas.width / 2 - ox;
    const defCamY = canvas.height / 2 - oy;
    const defDrawCtx = { ctx, isoFn: defIso, tileW: defTW };
    const _renderDEF = (def, v2, wx, wy, wz, angle, colors) => {
      const sr = createSceneRenderer(ctx, defIso);
      if (v2) {
        renderNodes(def, {}, { x: wx, y: wy, z: wz, angle }, sr, defCamX, defCamY, defDrawCtx);
      } else {
        sr.add(def, { x: wx, y: wy, z: wz, angle, colors });
      }
      sr.flush(defCamX, defCamY);
    };
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
      const objAngle = obj.angle ?? 0;
      const objAngleRad = objAngle * Math.PI / 180;
      const defEntry = obj.type !== "pad" ? _DEF_MAP[obj.type] : void 0;
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
          const tvSel = document.getElementById("pad_tower_variant");
          if (tvSel) tvSel.value = obj.towerVariant ?? "classic";
        }
      } else if (obj.type === "carrier" || obj.type === "boat" || obj.type === "pilot_boat" || obj.type === "sar_boat" || obj.type === "salvage_tug" || obj.type === "supply_vessel" || obj.type === "frigate") {
        const isCarrier = obj.type === "carrier";
        if (defEntry) {
          _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, wl, objAngleRad);
        } else {
          const color = obj.type === "pilot_boat" ? "#ffcc00" : obj.type === "sar_boat" ? "#d32f2f" : obj.type === "salvage_tug" ? "#888" : obj.type === "supply_vessel" ? "#0d233a" : obj.type === "frigate" ? "#5a6673" : "#ddd";
          const rad = Math.max(4, hw * 0.8);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rad, rad * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (isSel) {
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 2.2, "#fff");
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
        if (defEntry) {
          _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, wl, objAngleRad);
        } else {
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
        }
        _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.8, "#888");
        if (isSel) {
          _showObjPanel("ui_submarine");
          syncVesselUI(obj, "submarine");
        }
      } else if (obj.type === "lighthouse") {
        if (defEntry) {
          _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad);
        }
      } else if (obj.type === "research_platform") {
        if (defEntry) {
          _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad);
        }
      } else if (obj.type === "wind_turbine") {
        if (defEntry) {
          const d = defEntry.def;
          const baked = d.parts?.length ? applyParts(d, {}) : d;
          _renderDEF(baked, false, obj.x, obj.y, 0, objAngleRad);
        }
        if (isSel) {
          _showObjPanel("ui_wt");
          const spinEl = document.getElementById("m_wt_spinning");
          if (spinEl) spinEl.checked = !!obj.spinning;
        }
      } else {
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
        if (obj.type === "ring") {
          const rr = (obj.radius ?? 2.5) * hw;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rr, rr * 0.55, 0, 0, Math.PI * 2);
          ctx.strokeStyle = isSel ? "#fff" : "#FFD700";
          ctx.lineWidth = isSel ? 2.5 : 1.5;
          ctx.stroke();
        } else if (defEntry) {
          const colors = defEntry.def.palettes && obj.colorVariant ? defEntry.def.palettes[obj.colorVariant] : void 0;
          _renderDEF(defEntry.def, defEntry.v2, obj.x, obj.y, 0, objAngleRad, colors);
          if (obj.angle !== void 0) {
            _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.6, "rgba(255,255,255,0.5)");
          }
        } else {
          const typeColors = {
            ornithopter_wreck: "#d0d0d0"
          };
          const color = typeColors[obj.type] || "#aaa";
          const r = Math.max(3, hw * 0.65);
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
            _isoArrow(ctx, cx, cy, objAngle, hw, hh, hw * 1.6, "#fff");
          }
        }
        if (isSel && panelMap[obj.type]) {
          _showObjPanel(panelMap[obj.type]);
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
      if (isFire && (e.radius ?? 0) > 0) {
        const fireR = e.radius * hw;
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#ff8800";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.ellipse(ex, ey, fireR, fireR * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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
    const showEmitterPopup = (idx, cx, cy) => {
      const m = getCurrentMission();
      const mAny = m;
      const em = mAny.particleEmitters?.[idx];
      if (!em) return;
      const isFire = em.type === "fire";
      popup.innerHTML = "";
      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px";
      const title = document.createElement("span");
      title.style.fontWeight = "bold";
      title.textContent = isFire ? "\u{1F525} Feuer-Emitter" : "\u{1F4A8} Rauch-Emitter";
      const closeBtn = document.createElement("span");
      closeBtn.textContent = "\xD7";
      closeBtn.style.cssText = "cursor:pointer;color:#f55;font-weight:bold;font-size:16px;margin-left:12px";
      closeBtn.onclick = hidePopup;
      header.append(title, closeBtn);
      popup.appendChild(header);
      const makeRow = (label, value, step, min, max, color, onChange) => {
        const row = document.createElement("div");
        row.style.cssText = "margin:4px 0;display:flex;align-items:center;gap:6px";
        const lbl = document.createElement("span");
        lbl.style.cssText = `color:#aaa;min-width:60px;font-size:11px`;
        lbl.textContent = label;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = String(value);
        inp.step = String(step);
        inp.min = String(min);
        inp.max = String(max);
        inp.style.cssText = `flex:1;background:#111;color:${color};border:1px solid #444;font-family:monospace;font-size:11px;padding:2px 4px;width:60px`;
        inp.oninput = () => {
          const v = parseFloat(inp.value);
          if (!isNaN(v)) onChange(v);
        };
        row.append(lbl, inp);
        return row;
      };
      popup.appendChild(makeRow("Z-Offset:", em.zOffset ?? 0, 0.25, -5, 20, "#8fa", (v) => {
        em.zOffset = v || void 0;
        drawMap();
        notifyWorkbench();
        broadcastPreview();
      }));
      if (isFire) {
        popup.appendChild(makeRow("Radius:", em.radius ?? 0.18, 0.1, 0.1, 5, "#ff9", (v) => {
          em.radius = v;
          drawMap();
          notifyWorkbench();
          broadcastPreview();
        }));
      }
      const delBtn = document.createElement("button");
      delBtn.textContent = "\u{1F5D1} Emitter l\xF6schen";
      delBtn.style.cssText = "width:100%;background:#3a1a1a;border:1px solid #f55;color:#f55;font-size:11px;padding:5px;cursor:pointer;border-radius:3px;font-family:inherit;margin-top:8px";
      delBtn.onclick = () => {
        mAny.particleEmitters.splice(idx, 1);
        hidePopup();
        drawMap();
        notifyWorkbench();
        broadcastPreview();
      };
      popup.appendChild(delBtn);
      const vw = window.innerWidth, vh = window.innerHeight;
      popup.style.left = Math.min(cx + 6, vw - 200) + "px";
      popup.style.top = Math.min(cy + 6, vh - 180) + "px";
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
      state.zoom = Math.max(0.2, state.zoom - 0.5);
      clampCamera();
      drawMap();
    };
    getEl("btn-fit").onclick = () => {
      const m = getCurrentMission();
      if (m) {
        fitCamera(m.gridSize);
        clampCamera();
        drawMap();
      }
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
    document.getElementById("pad_tower_variant")?.addEventListener("change", (e) => {
      const m = getCurrentMission();
      if (!m) return;
      const pad = m.objects.find((o) => o.type === "pad");
      if (pad) pad.towerVariant = e.target.value;
      notifyWorkbench();
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
        case "volleyball_court":
          m.objects.push({ type: "volleyball_court", x: gx, y: gy, angle: 0 });
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
          { v: "festival_car", l: "\u{1F699} Festival-Auto" },
          { v: "volleyball_court", l: "\u{1F3D0} Volleyball" }
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
          else if (["lighthouse", "research_platform", "wind_turbine", "buoy"].includes(obj.type))
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
          else if (obj.type === "volleyball_court")
            hit = Math.hypot(gx - obj.x, gy - obj.y) < 6;
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
        } else if (!state.dragHasMoved && state.dragItemType === "emitter" && state.dragItemIdx !== null) {
          showEmitterPopup(state.dragItemIdx, state.dragStartMX, state.dragStartMY);
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
