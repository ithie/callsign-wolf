"use strict";
(() => {
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
  var createSceneRenderer = (ctx2, iso2) => {
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
      ctx2.save();
      ctx2.strokeStyle = color ?? "rgba(0,255,100,0.85)";
      ctx2.lineWidth = 1.5;
      ctx2.setLineDash([4, 3]);
      ctx2.shadowColor = color ?? "#00ff66";
      ctx2.shadowBlur = 4;
      edges.forEach(([a, b]) => {
        ctx2.beginPath();
        ctx2.moveTo(sc[a].x, sc[a].y);
        ctx2.lineTo(sc[b].x, sc[b].y);
        ctx2.stroke();
      });
      ctx2.setLineDash([]);
      ctx2.restore();
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
              ctx2.beginPath();
              for (let i = 0; i < _fn; i++) {
                const _dx = _scratchPts[i].x - _fcx, _dy = _scratchPts[i].y - _fcy;
                const _d = Math.hypot(_dx, _dy) || 1;
                const _ex = _fcx + _dx * (1 + 0.5 / _d);
                const _ey = _fcy + _dy * (1 + 0.5 / _d);
                i === 0 ? ctx2.moveTo(_ex, _ey) : ctx2.lineTo(_ex, _ey);
              }
              ctx2.closePath();
              ctx2.fillStyle = (inst.colors && inst.colors[face.id]) ?? face.color;
              ctx2.fill();
              if (face.stroke) {
                ctx2.strokeStyle = face.stroke;
                ctx2.lineWidth = face.strokeWidth ?? 1;
                ctx2.stroke();
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
  var getTransformedPivots = (def, params) => {
    const result = /* @__PURE__ */ new Map();
    if (!def.parts?.length) return result;
    const getRotFn = _buildRotFnCache(def, params);
    for (const part of def.parts) {
      if (!part.rotate) continue;
      const parentFn = part.parent ? getRotFn(part.parent) : null;
      const pivot = parentFn ? parentFn([part.rotate.pivot])[0] : part.rotate.pivot;
      result.set(part.id, pivot);
    }
    return result;
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
        const { ctx: ctx2, isoFn, tileW } = drawCtx;
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
                ctx2.fillStyle = isOn ? light.color : light.colorOff ?? light.color;
                ctx2.beginPath();
                ctx2.arc(p.x, p.y, Math.max(1.2, radius * tileW / 64), 0, 7);
                ctx2.fill();
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
                ctx2.strokeStyle = face.color;
                ctx2.lineWidth = face.lineWidth ?? 1;
                ctx2.lineCap = "round";
                ctx2.beginPath();
                ctx2.moveTo(p0.x, p0.y);
                ctx2.lineTo(p1.x, p1.y);
                ctx2.stroke();
              }
            });
          }
        }
      }
      if (onBeforeFlush) onBeforeFlush(def.nodes.indexOf(topNode));
      renderer.flush(camX, camY);
    }
  };

  // ../src/game/models/objects/hangar.zdef
  var hangar_default = {
    id: "hangar",
    pivot: [0, 0, 0],
    collisionBoxes: [
      { id: "body", xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: 0, zMax: 2 }
    ],
    faces: [
      { id: "back_int", verts: [[2, -1, 0], [-2, -1, 0], [-2, -1, 2], [2, -1, 2]], color: "#888888" },
      { id: "right_int", verts: [[2, -1, 0], [2, 1, 0], [2, 1, 2], [2, -1, 2]], color: "#999999" },
      { id: "left_int", verts: [[-2, 1, 0], [-2, -1, 0], [-2, -1, 2], [-2, 1, 2]], color: "#aaaaaa" },
      { id: "back_ext", normal: [0, -1], verts: [[-2, -1, 0], [2, -1, 0], [2, -1, 2], [-2, -1, 2]], color: "#999999" },
      { id: "right_ext", normal: [1, 0], verts: [[2, 1, 0], [2, -1, 0], [2, -1, 2], [2, 1, 2]], color: "#aaaaaa" },
      { id: "left_ext", normal: [-1, 0], verts: [[-2, -1, 0], [-2, 1, 0], [-2, 1, 2], [-2, -1, 2]], color: "#cccccc" },
      { id: "cross_h", verts: [[0.1, -0.65, 0.01], [-0.1, -0.65, 0.01], [-0.1, 0.65, 0.01], [0.1, 0.65, 0.01]], color: "#ffcc00" },
      { id: "cross_v", verts: [[0.65, -0.1, 0.01], [-0.65, -0.1, 0.01], [-0.65, 0.1, 0.01], [0.65, 0.1, 0.01]], color: "#ffcc00" },
      { id: "gb1_side", verts: [[-1.9, -0.25, 0], [-1.6, -0.25, 0], [-1.6, -0.25, 0.45], [-1.9, -0.25, 0.45]], color: "#4a6230" },
      { id: "gb1_front", verts: [[-1.6, -0.55, 0], [-1.6, -0.25, 0], [-1.6, -0.25, 0.45], [-1.6, -0.55, 0.45]], color: "#3d5228" },
      { id: "gb1_top", verts: [[-1.9, -0.55, 0.45], [-1.6, -0.55, 0.45], [-1.6, -0.25, 0.45], [-1.9, -0.25, 0.45]], color: "#5a7238" },
      { id: "gb2_side", verts: [[-1.9, 0.3, 0], [-1.6, 0.3, 0], [-1.6, 0.3, 0.45], [-1.9, 0.3, 0.45]], color: "#4a6230" },
      { id: "gb2_front", verts: [[-1.6, 0, 0], [-1.6, 0.3, 0], [-1.6, 0.3, 0.45], [-1.6, 0, 0.45]], color: "#3d5228" },
      { id: "gb2_top", verts: [[-1.9, 0, 0.45], [-1.9, 0.3, 0.45], [-1.6, 0.3, 0.45], [-1.6, 0, 0.45]], color: "#5a7238" },
      { id: "yba_s0", verts: [[-1.62, -0.75, 0], [-1.685, -0.637, 0], [-1.685, -0.637, 0.45], [-1.62, -0.75, 0.45]], color: "#e8c020" },
      { id: "yba_s1", verts: [[-1.685, -0.637, 0], [-1.815, -0.637, 0], [-1.815, -0.637, 0.45], [-1.685, -0.637, 0.45]], color: "#e8c020" },
      { id: "yba_s5", verts: [[-1.685, -0.863, 0], [-1.62, -0.75, 0], [-1.62, -0.75, 0.45], [-1.685, -0.863, 0.45]], color: "#e8c020" },
      { id: "yba_top", verts: [[-1.62, -0.75, 0.45], [-1.685, -0.637, 0.45], [-1.815, -0.637, 0.45], [-1.88, -0.75, 0.45], [-1.815, -0.863, 0.45], [-1.685, -0.863, 0.45]], color: "#e8c020" },
      { id: "ybb_s0", verts: [[-1.62, 0.55, 0], [-1.685, 0.663, 0], [-1.685, 0.663, 0.45], [-1.62, 0.55, 0.45]], color: "#e8c020" },
      { id: "ybb_s1", verts: [[-1.685, 0.663, 0], [-1.815, 0.663, 0], [-1.815, 0.663, 0.45], [-1.685, 0.663, 0.45]], color: "#e8c020" },
      { id: "ybb_s5", verts: [[-1.685, 0.437, 0], [-1.62, 0.55, 0], [-1.62, 0.55, 0.45], [-1.685, 0.437, 0.45]], color: "#e8c020" },
      { id: "ybb_top", verts: [[-1.62, 0.55, 0.45], [-1.685, 0.663, 0.45], [-1.815, 0.663, 0.45], [-1.88, 0.55, 0.45], [-1.815, 0.437, 0.45], [-1.685, 0.437, 0.45]], color: "#e8c020" },
      { id: "roof", verts: [[2, -1, 2], [2, 1, 2], [-2, 1, 2], [-2, -1, 2]], color: "#dddddd" }
    ]
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

  // ../src/game/models/sailboat.zdef
  var sailboat_default = {
    id: "sailboat",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "hull",
        xMin: -1.1,
        xMax: 1.3,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0,
        zMax: 0.35
      },
      {
        id: "mast",
        xMin: -0.34,
        xMax: -0.26,
        yMin: -0.08,
        yMax: 0.08,
        zMin: 0.35,
        zMax: 3.2
      }
    ],
    faces: [
      {
        id: "keel",
        verts: [
          [
            1.3,
            0,
            0
          ],
          [
            0.2,
            -0.45,
            0
          ],
          [
            -1.1,
            -0.35,
            0
          ],
          [
            -1.1,
            0.35,
            0
          ],
          [
            0.2,
            0.45,
            0
          ]
        ],
        color: "#822"
      },
      {
        id: "stern",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            -1.1,
            -0.35,
            0
          ],
          [
            -1.1,
            0.35,
            0
          ],
          [
            -1.1,
            0.35,
            0.35
          ],
          [
            -1.1,
            -0.35,
            0.35
          ]
        ],
        color: "#ddd"
      },
      {
        id: "stbd_lower_bow",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.3,
            0,
            0
          ],
          [
            0.2,
            -0.45,
            0
          ],
          [
            0.2,
            -0.45,
            0.1
          ],
          [
            1.3,
            0,
            0.1
          ]
        ],
        color: "#a33"
      },
      {
        id: "stbd_lower_mid",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.2,
            -0.45,
            0
          ],
          [
            -1.1,
            -0.35,
            0
          ],
          [
            -1.1,
            -0.35,
            0.1
          ],
          [
            0.2,
            -0.45,
            0.1
          ]
        ],
        color: "#922"
      },
      {
        id: "stbd_upper_bow",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.3,
            0,
            0.1
          ],
          [
            0.2,
            -0.45,
            0.1
          ],
          [
            0.2,
            -0.45,
            0.35
          ],
          [
            1.3,
            0,
            0.35
          ]
        ],
        color: "#fff"
      },
      {
        id: "stbd_upper_mid",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.2,
            -0.45,
            0.1
          ],
          [
            -1.1,
            -0.35,
            0.1
          ],
          [
            -1.1,
            -0.35,
            0.35
          ],
          [
            0.2,
            -0.45,
            0.35
          ]
        ],
        color: "#eee"
      },
      {
        id: "port_bow",
        normal: [
          0,
          1
        ],
        verts: [
          [
            1.3,
            0,
            0
          ],
          [
            0.2,
            0.45,
            0
          ],
          [
            0.2,
            0.45,
            0.35
          ],
          [
            1.3,
            0,
            0.35
          ]
        ],
        color: "#eee"
      },
      {
        id: "port_mid",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.2,
            0.45,
            0
          ],
          [
            -1.1,
            0.35,
            0
          ],
          [
            -1.1,
            0.35,
            0.35
          ],
          [
            0.2,
            0.45,
            0.35
          ]
        ],
        color: "#ddd"
      },
      {
        id: "deck",
        verts: [
          [
            1.3,
            0,
            0.35
          ],
          [
            0.2,
            -0.45,
            0.35
          ],
          [
            -1.1,
            -0.35,
            0.35
          ],
          [
            -1.1,
            0.35,
            0.35
          ],
          [
            0.2,
            0.45,
            0.35
          ]
        ],
        color: "#b96",
        stroke: "#753"
      },
      {
        id: "mast",
        verts: [
          [
            -0.34,
            -0.04,
            0.35
          ],
          [
            -0.26,
            -0.04,
            0.35
          ],
          [
            -0.26,
            -0.04,
            3.2
          ],
          [
            -0.34,
            -0.04,
            3.2
          ]
        ],
        color: "#ddd"
      },
      {
        id: "mainsail",
        verts: [
          [
            -0.3,
            0,
            0.65
          ],
          [
            -0.3,
            0,
            3
          ],
          [
            -1.83,
            -0.47,
            0.65
          ]
        ],
        color: "rgba(255,255,250,0.95)",
        stroke: "#eee"
      },
      {
        id: "jib",
        verts: [
          [
            1.3,
            0,
            0.45
          ],
          [
            -0.3,
            0,
            2.7
          ],
          [
            -0.68,
            -0.12,
            0.55
          ]
        ],
        color: "rgba(245,245,245,0.90)"
      }
    ]
  };

  // ../src/game/models/coasthawk.zdef
  var coasthawk_default = {
    id: "coasthawk",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -3,
        xMax: 1.3,
        yMin: -0.5,
        yMax: 0.5,
        zMin: 0,
        zMax: 1.3
      }
    ],
    faces: [
      {
        id: "tail_rotor_bar",
        verts: [
          [
            -2.4,
            0.6,
            0.25
          ],
          [
            -2.4,
            -0.6,
            0.25
          ],
          [
            -2.4,
            -0.6,
            0.35
          ],
          [
            -2.4,
            0.6,
            0.35
          ]
        ],
        color: "#222222"
      },
      {
        id: "tail_fin",
        verts: [
          [
            -2.4,
            0,
            0.6
          ],
          [
            -2.9,
            0,
            1.3
          ],
          [
            -3,
            0,
            0.6
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "tail_boom",
        verts: [
          [
            -1.1,
            0.08,
            0.6
          ],
          [
            -2.4,
            0.08,
            0.6
          ],
          [
            -2.4,
            -0.08,
            0.6
          ],
          [
            -1.1,
            -0.08,
            0.6
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "fuselage",
        verts: [
          [
            1.3,
            0,
            0.3
          ],
          [
            0.4,
            -0.45,
            0.4
          ],
          [
            -1,
            -0.45,
            0.4
          ],
          [
            -1.1,
            0,
            0.6
          ],
          [
            -1,
            0.45,
            0.4
          ],
          [
            0.4,
            0.45,
            0.4
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "window_right",
        verts: [
          [
            0.3,
            -0.47,
            0.35
          ],
          [
            -0.6,
            -0.47,
            0.35
          ],
          [
            -0.6,
            -0.3,
            0.6
          ],
          [
            0.3,
            -0.3,
            0.6
          ]
        ],
        color: "#111111"
      },
      {
        id: "window_left",
        verts: [
          [
            0.3,
            0.47,
            0.35
          ],
          [
            -0.6,
            0.47,
            0.35
          ],
          [
            -0.6,
            0.3,
            0.6
          ],
          [
            0.3,
            0.3,
            0.6
          ]
        ],
        color: "#111111"
      },
      {
        id: "cockpit_nose",
        verts: [
          [
            1.3,
            0,
            0.3
          ],
          [
            0.6,
            0.4,
            0.6
          ],
          [
            0.6,
            -0.4,
            0.6
          ]
        ],
        color: "#111111"
      }
    ]
  };

  // ../src/game/models/dolphin.zdef
  var dolphin_default = {
    id: "dolphin",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -1.4,
        xMax: 0.98,
        yMin: -0.28,
        yMax: 0.28,
        zMin: 0,
        zMax: 0.84
      }
    ],
    faces: [
      {
        id: "fuselage",
        verts: [
          [
            0.98,
            0,
            0.14
          ],
          [
            0,
            -0.28,
            0.28
          ],
          [
            -0.56,
            0,
            0.35
          ],
          [
            0,
            0.28,
            0.28
          ]
        ],
        color: "#ff6600"
      },
      {
        id: "cockpit",
        verts: [
          [
            0.84,
            0,
            0.175
          ],
          [
            0.21,
            -0.21,
            0.42
          ],
          [
            0.21,
            0.21,
            0.42
          ]
        ],
        color: "#112233"
      },
      {
        id: "tail_fin",
        verts: [
          [
            -0.56,
            0,
            0.35
          ],
          [
            -1.26,
            0,
            0.84
          ],
          [
            -1.4,
            0,
            0.28
          ]
        ],
        color: "#ff6600"
      }
    ]
  };

  // ../src/game/models/atlas.zdef
  var atlas_default = {
    id: "atlas",
    pivot: [0, 0, 0],
    collisionBoxes: [
      { id: "body", xMin: -2.6, xMax: 2.8, yMin: -0.6, yMax: 0.6, zMin: 0, zMax: 1.8 }
    ],
    faces: [
      { id: "bottom", verts: [[1.8, 0.3, 0.15], [1.8, -0.3, 0.15], [-2, -0.3, 0.15], [-2, 0.3, 0.15]], color: "#ff6600" },
      { id: "side_left_lower", verts: [[1.8, 0.3, 0.15], [1.8, 0.6, 0.5], [-2, 0.6, 0.5], [-2, 0.3, 0.15]], color: "#ff6600" },
      { id: "side_right_lower", verts: [[1.8, -0.3, 0.15], [1.8, -0.6, 0.5], [-2, -0.6, 0.5], [-2, -0.3, 0.15]], color: "#ff6600" },
      { id: "side_left_upper_front", verts: [[1.8, 0.6, 0.5], [1.8, 0.3, 0.85], [1.4, 0.3, 0.85], [1.4, 0.6, 0.5]], color: "#ff6600" },
      { id: "side_left_upper_back", verts: [[0.9, 0.6, 0.5], [0.9, 0.3, 0.85], [-2, 0.3, 0.85], [-2, 0.6, 0.5]], color: "#ff6600" },
      { id: "side_right_upper_front", verts: [[1.8, -0.6, 0.5], [1.8, -0.3, 0.85], [1.4, -0.3, 0.85], [1.4, -0.6, 0.5]], color: "#ff6600" },
      { id: "side_right_upper_back", verts: [[0.9, -0.6, 0.5], [0.9, -0.3, 0.85], [-2, -0.3, 0.85], [-2, -0.6, 0.5]], color: "#ff6600" },
      { id: "tail_left", verts: [[-2, 0.6, 0.5], [-2, 0.3, 0.85], [-2.6, 0, 1.1], [-2.6, 0, 0.4]], color: "#ff6600" },
      { id: "tail_right", verts: [[-2, -0.6, 0.5], [-2, -0.3, 0.85], [-2.6, 0, 1.1], [-2.6, 0, 0.4]], color: "#ff6600" },
      { id: "chinook_nose_bottom", verts: [[1.8, -0.3, 0.15], [1.8, 0.3, 0.15], [2.4, 0.3, 0.15], [2.7, 0, 0.25], [2.4, -0.3, 0.15]], color: "#ff6600" },
      { id: "chinook_nose_lower_left", verts: [[1.8, 0.3, 0.15], [2.4, 0.3, 0.15], [2.4, 0.5, 0.5], [1.8, 0.6, 0.5]], color: "#ff6600" },
      { id: "chinook_nose_lower_right", verts: [[1.8, -0.3, 0.15], [1.8, -0.6, 0.5], [2.4, -0.5, 0.5], [2.4, -0.3, 0.15]], color: "#ff6600" },
      { id: "chinook_nose_front_under", verts: [[2.4, 0.3, 0.15], [2.7, 0, 0.25], [2.4, -0.3, 0.15], [2.4, -0.5, 0.5], [2.4, 0.5, 0.5]], color: "#ff6600" },
      { id: "chinook_nose_bump", verts: [[2.7, 0, 0.25], [2.4, 0.5, 0.5], [2.3, 0.3, 0.6], [2.3, -0.3, 0.6], [2.4, -0.5, 0.5]], color: "#ff6600" },
      { id: "cockpit_front", verts: [[2.3, 0.27, 0.6], [2.3, -0.27, 0.6], [1.8, -0.27, 0.85], [1.8, 0.27, 0.85]], color: "#111111" },
      { id: "cockpit_left", verts: [[2.4, 0.5, 0.5], [2.3, 0.33, 0.6], [1.8, 0.33, 0.85], [1.8, 0.6, 0.5]], color: "#111111" },
      { id: "cockpit_right", verts: [[2.4, -0.5, 0.5], [1.8, -0.6, 0.5], [1.8, -0.33, 0.85], [2.3, -0.33, 0.6]], color: "#111111" },
      { id: "cockpit_frame_left", verts: [[2.3, 0.33, 0.6], [2.3, 0.27, 0.6], [1.8, 0.27, 0.85], [1.8, 0.33, 0.85]], color: "#ff6600" },
      { id: "cockpit_frame_right", verts: [[2.3, -0.27, 0.6], [2.3, -0.33, 0.6], [1.8, -0.33, 0.85], [1.8, -0.27, 0.85]], color: "#ff6600" },
      { id: "window_left", verts: [[1.4, 0.6, 0.5], [0.9, 0.6, 0.5], [0.9, 0.3, 0.85], [1.4, 0.3, 0.85]], color: "#111111" },
      { id: "window_right", verts: [[1.4, -0.6, 0.5], [0.9, -0.6, 0.5], [0.9, -0.3, 0.85], [1.4, -0.3, 0.85]], color: "#111111" },
      { id: "fpylon_front", verts: [[1.8, 0.3, 0.85], [1.8, -0.3, 0.85], [1.5, 0, 1.15]], color: "#ff6600" },
      { id: "fpylon_right", verts: [[1.8, -0.3, 0.85], [1.2, -0.3, 0.85], [1.5, 0, 1.15]], color: "#ff6600" },
      { id: "fpylon_back", verts: [[1.2, -0.3, 0.85], [1.2, 0.3, 0.85], [1.5, 0, 1.15]], color: "#ff6600" },
      { id: "fpylon_left", verts: [[1.2, 0.3, 0.85], [1.8, 0.3, 0.85], [1.5, 0, 1.15]], color: "#ff6600" },
      { id: "tail_roof", verts: [[-2, 0.3, 0.85], [-2, -0.3, 0.85], [-2.6, 0, 1.1]], color: "#ff6600" },
      { id: "top", verts: [[1.8, 0.3, 0.85], [1.8, -0.3, 0.85], [-2, -0.3, 0.85], [-2, 0.3, 0.85]], color: "#ff6600" },
      { id: "rpylon_front", verts: [[-2, 0.3, 0.85], [-2, -0.3, 0.85], [-2.3, 0, 1.8]], color: "#ff6600" },
      { id: "rpylon_right", verts: [[-2, -0.3, 0.85], [-2.6, 0, 1.1], [-2.3, 0, 1.8]], color: "#ff6600" },
      { id: "rpylon_left", verts: [[-2.6, 0, 1.1], [-2, 0.3, 0.85], [-2.3, 0, 1.8]], color: "#ff6600" }
    ]
  };

  // ../src/game/models/objects/glider.zdef
  var glider_default = {
    id: "glider",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -1.65,
        xMax: 1,
        yMin: -3,
        yMax: 3,
        zMin: 0,
        zMax: 0.4
      }
    ],
    faces: [
      {
        id: "tail_fin",
        verts: [
          [
            -1.4,
            0.04,
            0.2
          ],
          [
            -1.65,
            0.04,
            0.2
          ],
          [
            -1.65,
            0.04,
            0.5
          ],
          [
            -1.4,
            0.04,
            0.32
          ]
        ],
        color: "#cc3300"
      },
      {
        id: "h_stab",
        verts: [
          [
            -1.35,
            -0.65,
            0.24
          ],
          [
            -1.35,
            0.65,
            0.24
          ],
          [
            -1.55,
            0.65,
            0.24
          ],
          [
            -1.55,
            -0.65,
            0.24
          ]
        ],
        color: "#eeeeee"
      },
      {
        id: "wing_right",
        verts: [
          [
            0.36,
            -0.1,
            0.27
          ],
          [
            0.03,
            -0.1,
            0.27
          ],
          [
            0.03,
            -3,
            0.28
          ],
          [
            0.36,
            -3,
            0.28
          ]
        ],
        color: "#e8e8e8"
      },
      {
        id: "fuselage",
        verts: [
          [
            1,
            0,
            0.2
          ],
          [
            0.55,
            -0.1,
            0.26
          ],
          [
            -1.2,
            -0.06,
            0.26
          ],
          [
            -1.65,
            0,
            0.22
          ],
          [
            -1.2,
            0.06,
            0.26
          ],
          [
            0.55,
            0.1,
            0.26
          ]
        ],
        color: "#f2f2f2"
      },
      {
        id: "wing_left",
        verts: [
          [
            0.36,
            0.1,
            0.27
          ],
          [
            0.36,
            3,
            0.28
          ],
          [
            0.03,
            3,
            0.28
          ],
          [
            0.03,
            0.1,
            0.27
          ]
        ],
        color: "#e8e8e8"
      },
      {
        id: "canopy",
        verts: [
          [
            0.7,
            0.07,
            0.26
          ],
          [
            0.7,
            -0.07,
            0.26
          ],
          [
            -0.16,
            -0.07,
            0.36
          ],
          [
            -0.16,
            0.07,
            0.36
          ]
        ],
        color: "#112244"
      }
    ]
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

  // ../src/game/models/ornithopter.zdef
  var ornithopter_default = {
    version: 2,
    id: "ornithopter_westwood_final_flat",
    label: "ornithopter_westwood_final_flat",
    static: false,
    movementType: "none",
    collisionBoxes: [
      { id: "hull_core", xMin: -0.8, xMax: 0.9, yMin: -0.35, yMax: 0.35, zMin: 0.1, zMax: 0.55 },
      { id: "tail_boom", xMin: -1.6, xMax: -0.8, yMin: -0.15, yMax: 0.15, zMin: 0.2, zMax: 0.5 }
    ],
    nodes: [
      {
        faces: [
          {
            id: "belly",
            verts: [[0.9, 0, 0.1], [0.4, 0.35, 0.1], [-0.8, 0.3, 0.1], [-0.8, -0.3, 0.1], [0.4, -0.35, 0.1]],
            color: "#bcbcbc"
          },
          {
            id: "side_l",
            verts: [[0.9, 0.15, 0.1], [0.5, 0.2, 0.45], [-0.8, 0.22, 0.45], [-0.8, 0.3, 0.1], [0.4, 0.35, 0.1]],
            color: "#dcdcdc"
          },
          {
            id: "side_r",
            verts: [[0.9, -0.15, 0.1], [0.4, -0.35, 0.1], [-0.8, -0.3, 0.1], [-0.8, -0.22, 0.45], [0.5, -0.2, 0.45]],
            color: "#dcdcdc"
          },
          {
            id: "top",
            verts: [[0.1, 0.25, 0.5], [0.1, -0.25, 0.5], [-0.8, -0.22, 0.45], [-0.8, 0.22, 0.45]],
            color: "#f2f2f2"
          },
          {
            id: "tail",
            verts: [[-0.8, 0.15, 0.45], [-0.8, -0.15, 0.45], [-1.6, 0, 0.5], [-1.6, 0, 0.2], [-0.8, 0, 0.1]],
            color: "#f2f2f2"
          },
          {
            id: "cockpit_f",
            verts: [[0.91, 0.15, 0.1], [0.91, -0.15, 0.1], [0.5, -0.2, 0.45], [0.5, 0.2, 0.45]],
            color: "#add8e6",
            shade: 1
          },
          {
            id: "cockpit_t",
            verts: [[0.5, 0.2, 0.45], [0.5, -0.2, 0.45], [0.1, -0.25, 0.5], [0.1, 0.25, 0.5]],
            color: "#add8e6",
            shade: 1
          }
        ],
        children: [
          {
            rotate: { pivot: [-0.2, 0.25, 0.48], axis: [1, 0, 0], param: "wingAngle" },
            faces: [
              {
                id: "wl_in",
                verts: [[0.2, 0.25, 0.48], [0.1, 2.5, 1.4], [-0.6, 2.5, 1.4], [-0.7, 0.22, 0.48]],
                color: "#ffffff"
              }
            ],
            children: [
              {
                rotate: { pivot: [-0.25, 2.5, 1.4], axis: [1, 0, 0], param: "wingTipAngle" },
                faces: [
                  {
                    id: "wl_out",
                    verts: [[0.1, 2.5, 1.4], [0, 3.8, 0.4], [-0.2, 3.8, 0.4], [-0.6, 2.5, 1.4]],
                    color: "#eeeeee"
                  }
                ]
              }
            ]
          },
          {
            rotate: { pivot: [-0.2, -0.25, 0.48], axis: [1, 0, 0], param: "wingAngleInv" },
            faces: [
              {
                id: "wr_in",
                verts: [[0.2, -0.25, 0.48], [-0.7, -0.22, 0.48], [-0.6, -2.5, 1.4], [0.1, -2.5, 1.4]],
                color: "#ffffff"
              }
            ],
            children: [
              {
                rotate: { pivot: [-0.25, -2.5, 1.4], axis: [1, 0, 0], param: "wingTipAngleInv" },
                faces: [
                  {
                    id: "wr_out",
                    verts: [[0.1, -2.5, 1.4], [-0.6, -2.5, 1.4], [-0.2, -3.8, 0.4], [0, -3.8, 0.4]],
                    color: "#eeeeee"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  // ../src/game/models/carrier_hull.zdef
  var carrier_hull_default = {
    id: "carrier_hull",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "hull",
        xMin: -8.7,
        xMax: 8.7,
        yMin: -4.2,
        yMax: 4.2,
        zMin: 0,
        zMax: 4.2
      }
    ],
    faces: [
      {
        id: "keel",
        verts: [
          [8.7, -2.52, 0],
          [8.7, 2.52, 0],
          [-8.7, 2.52, 0],
          [-8.7, -2.52, 0]
        ],
        color: "#0a0a14"
      },
      {
        id: "hull_bow",
        normal: [1, 0],
        verts: [
          [8.7, -2.52, 0],
          [8.7, 2.52, 0],
          [8.7, 4.2, 3.8],
          [8.7, -4.2, 3.8]
        ],
        color: "#2a3a4a"
      },
      {
        id: "hull_starboard",
        normal: [0, 1],
        verts: [
          [8.7, 2.52, 0],
          [-8.7, 2.52, 0],
          [-8.7, 4.2, 3.8],
          [8.7, 4.2, 3.8]
        ],
        color: "#3a4a5a"
      },
      {
        id: "hull_stern",
        normal: [-1, 0],
        verts: [
          [-8.7, 2.52, 0],
          [-8.7, -2.52, 0],
          [-8.7, -4.2, 3.8],
          [-8.7, 4.2, 3.8]
        ],
        color: "#2a3a4a"
      },
      {
        id: "hull_port",
        normal: [0, -1],
        verts: [
          [-8.7, -2.52, 0],
          [8.7, -2.52, 0],
          [8.7, -4.2, 3.8],
          [-8.7, -4.2, 3.8]
        ],
        color: "#223344"
      },
      {
        id: "deck_base",
        verts: [
          [8.7, -4.2, 3.8],
          [8.7, 4.2, 3.8],
          [-8.7, 4.2, 3.8],
          [-8.7, -4.2, 3.8]
        ],
        color: "#222222"
      },
      {
        id: "deck_bow",
        normal: [1, 0],
        verts: [
          [8.7, -4.2, 3.8],
          [8.7, 4.2, 3.8],
          [8.7, 4.2, 4.2],
          [8.7, -4.2, 4.2]
        ],
        color: "#2a2a33"
      },
      {
        id: "deck_starboard",
        normal: [0, 1],
        verts: [
          [8.7, 4.2, 3.8],
          [-8.7, 4.2, 3.8],
          [-8.7, 4.2, 4.2],
          [8.7, 4.2, 4.2]
        ],
        color: "#333333"
      },
      {
        id: "deck_stern",
        normal: [-1, 0],
        verts: [
          [-8.7, 4.2, 3.8],
          [-8.7, -4.2, 3.8],
          [-8.7, -4.2, 4.2],
          [-8.7, 4.2, 4.2]
        ],
        color: "#2a2a33"
      },
      {
        id: "deck_port",
        normal: [0, -1],
        verts: [
          [-8.7, -4.2, 3.8],
          [8.7, -4.2, 3.8],
          [8.7, -4.2, 4.2],
          [-8.7, -4.2, 4.2]
        ],
        color: "#222222"
      },
      {
        id: "flight_deck",
        verts: [
          [8.7, -4.2, 4.2],
          [8.7, 4.2, 4.2],
          [-8.7, 4.2, 4.2],
          [-8.7, -4.2, 4.2]
        ],
        color: "#3a3a44"
      },
      {
        id: "pad_bow",
        verts: [
          [5.9, -3.7, 4.21],
          [5.9, -0.9, 4.21],
          [3.1, -0.9, 4.21],
          [3.1, -3.7, 4.21]
        ],
        color: "#52526a"
      },
      {
        id: "pad_mid",
        verts: [
          [1.4, -3.7, 4.21],
          [1.4, -0.9, 4.21],
          [-1.4, -0.9, 4.21],
          [-1.4, -3.7, 4.21]
        ],
        color: "#52526a"
      },
      {
        id: "pad_stern",
        verts: [
          [-3.1, -3.7, 4.21],
          [-3.1, -0.9, 4.21],
          [-5.9, -0.9, 4.21],
          [-5.9, -3.7, 4.21]
        ],
        color: "#52526a"
      }
    ]
  };

  // ../src/game/models/carrier_tower.zdef
  var carrier_tower_default = {
    id: "carrier_tower",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "tower",
        xMin: -5.5,
        xMax: -1,
        yMin: 2.6,
        yMax: 4.1,
        zMin: 4.2,
        zMax: 6.7
      }
    ],
    faces: [
      {
        id: "tower_bow",
        normal: [1, 0],
        verts: [
          [-1, 2.6, 4.2],
          [-1, 4.1, 4.2],
          [-1, 4.1, 6.7],
          [-1, 2.6, 6.7]
        ],
        color: "#555555"
      },
      {
        id: "tower_starboard",
        normal: [0, 1],
        verts: [
          [-1, 4.1, 4.2],
          [-5.5, 4.1, 4.2],
          [-5.5, 4.1, 6.7],
          [-1, 4.1, 6.7]
        ],
        color: "#444444"
      },
      {
        id: "tower_stern",
        normal: [-1, 0],
        verts: [
          [-5.5, 2.6, 4.2],
          [-5.5, 4.1, 4.2],
          [-5.5, 4.1, 6.7],
          [-5.5, 2.6, 6.7]
        ],
        color: "#333333"
      },
      {
        id: "tower_port",
        normal: [0, -1],
        verts: [
          [-1, 2.6, 4.2],
          [-5.5, 2.6, 4.2],
          [-5.5, 2.6, 6.7],
          [-1, 2.6, 6.7]
        ],
        color: "#444444"
      },
      {
        id: "tower_roof",
        verts: [
          [-1, 2.6, 6.7],
          [-1, 4.1, 6.7],
          [-5.5, 4.1, 6.7],
          [-5.5, 2.6, 6.7]
        ],
        color: "#222222"
      }
    ]
  };

  // ../src/game/models/fuel_truck_chassis.zdef
  var fuel_truck_chassis_default = {
    id: "fuel_truck_chassis",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: 0,
        xMax: 2.2,
        yMin: -0.45,
        yMax: 0.45,
        zMin: 0,
        zMax: 0.85
      }
    ],
    faces: [
      {
        id: "ch_top",
        verts: [
          [
            0,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            0,
            0.45,
            0.3
          ]
        ],
        color: "#4a6a4a"
      },
      {
        id: "ch_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.2,
            -0.45,
            0
          ],
          [
            2.2,
            0.45,
            0
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ]
        ],
        color: "#4a6a4a"
      },
      {
        id: "ch_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0,
            0.45,
            0
          ],
          [
            0,
            -0.45,
            0
          ],
          [
            0,
            -0.45,
            0.3
          ],
          [
            0,
            0.45,
            0.3
          ]
        ],
        color: "#3a5a3a"
      },
      {
        id: "ch_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            0.45,
            0
          ],
          [
            0,
            0.45,
            0
          ],
          [
            0,
            0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ]
        ],
        color: "#2a4a2a"
      },
      {
        id: "ch_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0,
            -0.45,
            0
          ],
          [
            2.2,
            -0.45,
            0
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            0,
            -0.45,
            0.3
          ]
        ],
        color: "#2a4a2a"
      },
      {
        id: "wrl",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.25,
            -0.45,
            0
          ],
          [
            0.55,
            -0.45,
            0
          ],
          [
            0.55,
            -0.45,
            0.22
          ],
          [
            0.25,
            -0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      },
      {
        id: "wrr",
        normal: [
          0,
          1
        ],
        verts: [
          [
            0.25,
            0.45,
            0
          ],
          [
            0.55,
            0.45,
            0
          ],
          [
            0.55,
            0.45,
            0.22
          ],
          [
            0.25,
            0.45,
            0.22
          ]
        ],
        color: "#1a2e1a"
      }
    ],
    parts: [
      {
        id: "wheel_front_L",
        rotate: { pivot: [1.8, -0.45, 0.11], axis: [0, 0, 1], param: "steerAngle" },
        faces: [
          { id: "wfl", normal: [0, -1], verts: [[1.65, -0.45, 0], [1.95, -0.45, 0], [1.95, -0.45, 0.22], [1.65, -0.45, 0.22]], color: "#1a2e1a" }
        ]
      },
      {
        id: "wheel_front_R",
        rotate: { pivot: [1.8, 0.45, 0.11], axis: [0, 0, 1], param: "steerAngle" },
        faces: [
          { id: "wfr", normal: [0, 1], verts: [[1.65, 0.45, 0], [1.95, 0.45, 0], [1.95, 0.45, 0.22], [1.65, 0.45, 0.22]], color: "#1a2e1a" }
        ]
      }
    ]
  };

  // ../src/game/models/fuel_truck_tank.zdef
  var fuel_truck_tank_default = {
    id: "fuel_truck_tank",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "tk_top",
        verts: [
          [
            0.25,
            -0.38,
            1.06
          ],
          [
            1.4,
            -0.38,
            1.06
          ],
          [
            1.4,
            0.38,
            1.06
          ],
          [
            0.25,
            0.38,
            1.06
          ]
        ],
        color: "#cccccc"
      },
      {
        id: "tk_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            1.4,
            -0.38,
            0.3
          ],
          [
            1.4,
            0.38,
            0.3
          ],
          [
            1.4,
            0.38,
            1.06
          ],
          [
            1.4,
            -0.38,
            1.06
          ]
        ],
        color: "#aaaaaa"
      },
      {
        id: "tk_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            1.4,
            0.38,
            0.3
          ],
          [
            0.25,
            0.38,
            0.3
          ],
          [
            0.25,
            0.38,
            1.06
          ],
          [
            1.4,
            0.38,
            1.06
          ]
        ],
        color: "#999999"
      },
      {
        id: "tk_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            0.25,
            -0.38,
            0.3
          ],
          [
            1.4,
            -0.38,
            0.3
          ],
          [
            1.4,
            -0.38,
            1.06
          ],
          [
            0.25,
            -0.38,
            1.06
          ]
        ],
        color: "#bbbbbb"
      },
      {
        id: "tk_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            0.25,
            0.38,
            0.3
          ],
          [
            0.25,
            -0.38,
            0.3
          ],
          [
            0.25,
            -0.38,
            1.06
          ],
          [
            0.25,
            0.38,
            1.06
          ]
        ],
        color: "#aaaaaa"
      },
      {
        id: "tk_stripe",
        verts: [
          [
            0.3,
            -0.04,
            1.065
          ],
          [
            1.35,
            -0.04,
            1.065
          ],
          [
            1.35,
            0.04,
            1.065
          ],
          [
            0.3,
            0.04,
            1.065
          ]
        ],
        color: "#ff4400"
      }
    ]
  };

  // ../src/game/models/fuel_truck_cab.zdef
  var fuel_truck_cab_default = {
    id: "fuel_truck_cab",
    pivot: [
      0,
      0,
      0
    ],
    faces: [
      {
        id: "cab_top",
        verts: [
          [
            1.5,
            -0.45,
            0.85
          ],
          [
            2.2,
            -0.45,
            0.85
          ],
          [
            2.2,
            0.45,
            0.85
          ],
          [
            1.5,
            0.45,
            0.85
          ]
        ],
        color: "#6a9a6a",
        stroke: "#8aba8a"
      },
      {
        id: "cab_front",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.3
          ],
          [
            2.2,
            0.45,
            0.85
          ],
          [
            2.2,
            -0.45,
            0.85
          ]
        ],
        color: "#3a6a3a"
      },
      {
        id: "cab_win",
        normal: [
          1,
          0
        ],
        verts: [
          [
            2.201,
            -0.25,
            0.45
          ],
          [
            2.201,
            0.25,
            0.45
          ],
          [
            2.201,
            0.25,
            0.75
          ],
          [
            2.201,
            -0.25,
            0.75
          ]
        ],
        color: "#112233"
      },
      {
        id: "cab_right",
        normal: [
          0,
          1
        ],
        verts: [
          [
            2.2,
            0.45,
            0.3
          ],
          [
            1.5,
            0.45,
            0.3
          ],
          [
            1.5,
            0.45,
            0.85
          ],
          [
            2.2,
            0.45,
            0.85
          ]
        ],
        color: "#4a7a4a"
      },
      {
        id: "cab_left",
        normal: [
          0,
          -1
        ],
        verts: [
          [
            1.5,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.3
          ],
          [
            2.2,
            -0.45,
            0.85
          ],
          [
            1.5,
            -0.45,
            0.85
          ]
        ],
        color: "#5a8a5a"
      },
      {
        id: "cab_rear",
        normal: [
          -1,
          0
        ],
        verts: [
          [
            1.5,
            0.45,
            0.3
          ],
          [
            1.5,
            -0.45,
            0.3
          ],
          [
            1.5,
            -0.45,
            0.85
          ],
          [
            1.5,
            0.45,
            0.85
          ]
        ],
        color: "#3a5a3a"
      }
    ]
  };

  // ../src/game/models/carrier_car.zdef
  var carrier_car_default = {
    id: "carrier_car",
    pivot: [0, 0, 0],
    faces: [
      { id: "body_floor", verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, 0.36, 0], [-0.5, 0.36, 0]], color: "#888888" },
      { id: "body_L", normal: [-1, 0], verts: [[-0.5, 0.36, 0], [-0.5, -0.36, 0], [-0.5, -0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#666666" },
      { id: "body_back", normal: [0, -1], verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, -0.36, 0.15], [-0.5, -0.36, 0.15]], color: "#dddddd" },
      { id: "body_R", normal: [1, 0], verts: [[0.5, -0.36, 0], [0.5, 0.36, 0], [0.5, 0.36, 0.15], [0.5, -0.36, 0.15]], color: "#666666" },
      { id: "body_front", normal: [0, 1], verts: [[0.5, 0.36, 0], [-0.5, 0.36, 0], [-0.5, 0.36, 0.15], [0.5, 0.36, 0.15]], color: "#dddddd" },
      { id: "body_top", verts: [[-0.5, -0.36, 0.15], [0.5, -0.36, 0.15], [0.5, 0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#dddddd" },
      { id: "eq_floor", verts: [[0.28, -0.288, 0.15], [0.48, -0.288, 0.15], [0.48, -0.038, 0.15], [0.28, -0.038, 0.15]], color: "#aa0000" },
      { id: "eq_back", normal: [0, -1], verts: [[0.28, -0.288, 0.15], [0.48, -0.288, 0.15], [0.48, -0.288, 0.33], [0.28, -0.288, 0.33]], color: "#ee0000" },
      { id: "eq_R", normal: [1, 0], verts: [[0.48, -0.288, 0.15], [0.48, -0.038, 0.15], [0.48, -0.038, 0.33], [0.48, -0.288, 0.33]], color: "#880000" },
      { id: "eq_front", normal: [0, 1], verts: [[0.48, -0.038, 0.15], [0.28, -0.038, 0.15], [0.28, -0.038, 0.33], [0.48, -0.038, 0.33]], color: "#aa0000" },
      { id: "eq_L", normal: [-1, 0], verts: [[0.28, -0.038, 0.15], [0.28, -0.288, 0.15], [0.28, -0.288, 0.33], [0.28, -0.038, 0.33]], color: "#880000" },
      { id: "eq_top", verts: [[0.28, -0.288, 0.33], [0.48, -0.288, 0.33], [0.48, -0.038, 0.33], [0.28, -0.038, 0.33]], color: "#cc0000" },
      { id: "cab_floor", verts: [[-0.5, -0.36, 0.15], [0.25, -0.36, 0.15], [0.25, 0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#aaaaaa" },
      { id: "cab_L", normal: [-1, 0], verts: [[-0.5, 0.36, 0.15], [-0.5, -0.36, 0.15], [-0.5, -0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#666666" },
      { id: "cab_back", normal: [0, -1], verts: [[-0.5, -0.36, 0.15], [0.25, -0.36, 0.15], [0.25, -0.36, 0.37], [-0.5, -0.36, 0.37]], color: "#ffffff" },
      { id: "cab_R", normal: [1, 0], verts: [[0.25, -0.36, 0.15], [0.25, 0.36, 0.15], [0.25, 0.36, 0.37], [0.25, -0.36, 0.37]], color: "#666666" },
      { id: "cab_front", normal: [0, 1], verts: [[0.25, 0.36, 0.15], [-0.5, 0.36, 0.15], [-0.5, 0.36, 0.37], [0.25, 0.36, 0.37]], color: "#aaaaaa" },
      { id: "cab_top", verts: [[-0.5, -0.36, 0.37], [0.25, -0.36, 0.37], [0.25, 0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#eeeeee" },
      { id: "w_front_L", normal: [0, -1], verts: [[-0.425, -0.36, 0], [-0.275, -0.36, 0], [-0.275, -0.36, 0.25], [-0.425, -0.36, 0.25]], color: "#222222" },
      { id: "w_front_R", normal: [0, 1], verts: [[-0.275, 0.36, 0], [-0.425, 0.36, 0], [-0.425, 0.36, 0.25], [-0.275, 0.36, 0.25]], color: "#222222" }
    ],
    parts: [
      {
        id: "wheel_rear_L",
        rotate: { pivot: [0.35, -0.36, 0.125], axis: [0, 0, 1], param: "steerAngle" },
        faces: [
          { id: "w_rear_L", normal: [0, -1], verts: [[0.275, -0.36, 0], [0.425, -0.36, 0], [0.425, -0.36, 0.25], [0.275, -0.36, 0.25]], color: "#222222" }
        ]
      },
      {
        id: "wheel_rear_R",
        rotate: { pivot: [0.35, 0.36, 0.125], axis: [0, 0, 1], param: "steerAngle" },
        faces: [
          { id: "w_rear_R", normal: [0, 1], verts: [[0.425, 0.36, 0], [0.275, 0.36, 0], [0.275, 0.36, 0.25], [0.425, 0.36, 0.25]], color: "#222222" }
        ]
      }
    ]
  };

  // ../src/game/models/carrier_deck_tractor.zdef
  var carrier_deck_tractor_default = {
    id: "carrier_deck_tractor",
    pivot: [0, 0, 0],
    faces: [
      { id: "floor", verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, 0.36, 0], [-0.5, 0.36, 0]], color: "#b09000" },
      { id: "left", normal: [-1, 0], verts: [[-0.5, 0.36, 0], [-0.5, -0.36, 0], [-0.5, -0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#8a6c00" },
      { id: "back", normal: [0, -1], verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, -0.36, 0.37], [-0.5, -0.36, 0.37]], color: "#e0b800" },
      { id: "right", normal: [1, 0], verts: [[0.5, -0.36, 0], [0.5, 0.36, 0], [0.5, 0.36, 0.37], [0.5, -0.36, 0.37]], color: "#8a6c00" },
      { id: "front", normal: [0, 1], verts: [[0.5, 0.36, 0], [-0.5, 0.36, 0], [-0.5, 0.36, 0.37], [0.5, 0.36, 0.37]], color: "#b09000" },
      { id: "top", verts: [[-0.5, -0.36, 0.37], [0.5, -0.36, 0.37], [0.5, 0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#caa800" },
      { id: "wfl", normal: [0, -1], verts: [[-0.425, -0.36, 0], [-0.275, -0.36, 0], [-0.275, -0.36, 0.25], [-0.425, -0.36, 0.25]], color: "#222222" },
      { id: "wfr", normal: [0, 1], verts: [[-0.275, 0.36, 0], [-0.425, 0.36, 0], [-0.425, 0.36, 0.25], [-0.275, 0.36, 0.25]], color: "#222222" },
      { id: "wrl", normal: [0, -1], verts: [[0.275, -0.36, 0], [0.425, -0.36, 0], [0.425, -0.36, 0.25], [0.275, -0.36, 0.25]], color: "#222222" },
      { id: "wrr", normal: [0, 1], verts: [[0.425, 0.36, 0], [0.275, 0.36, 0], [0.275, 0.36, 0.25], [0.425, 0.36, 0.25]], color: "#222222" }
    ]
  };

  // editor-view-entry/zdef-main.ts
  var vscode = acquireVsCodeApi();
  var notifyTimer = null;
  var scheduleNotify = () => {
  };
  var TW = 64;
  var TH = 32;
  var SH = 25;
  var toDefCast = (raw) => raw;
  var PRESETS = {
    hangar: { def: toDefCast(hangar_default), label: "Hangar", isStatic: true, movementType: "none" },
    lighthouse: { def: toDefCast(lighthouse_default), label: "Lighthouse", isStatic: true, movementType: "none" },
    sailboat: { def: toDefCast(sailboat_default), label: "Sailboat", isStatic: false, movementType: "ship" },
    coasthawk: { def: toDefCast(coasthawk_default), label: "Coast-Hawk", isStatic: false, movementType: "heli" },
    dolphin: { def: toDefCast(dolphin_default), label: "Dolphin", isStatic: false, movementType: "heli" },
    atlas: { def: toDefCast(atlas_default), label: "Atlas", isStatic: false, movementType: "heli" },
    ornithopter: { def: toDefCast(ornithopter_default), label: "Ornithopter", isStatic: false, movementType: "heli" },
    glider: { def: toDefCast(glider_default), label: "Glider (ASK-21)", isStatic: false, movementType: "plane" },
    submarine: { def: toDefCast(submarine_default), label: "Submarine", isStatic: false, movementType: "ship" },
    carrier: { def: toDefCast(carrier_default), label: "Carrier (komplett)", isStatic: false, movementType: "ship" },
    carrier_hull: { def: toDefCast(carrier_hull_default), label: "Carrier Hull", isStatic: false, movementType: "ship" },
    carrier_tower: { def: toDefCast(carrier_tower_default), label: "Carrier Tower", isStatic: false, movementType: "ship" },
    fuel_truck_chassis: { def: toDefCast(fuel_truck_chassis_default), label: "Fuel Truck (Chassis)", isStatic: true, movementType: "none" },
    fuel_truck_tank: { def: toDefCast(fuel_truck_tank_default), label: "Fuel Truck (Tank)", isStatic: true, movementType: "none" },
    fuel_truck_cab: { def: toDefCast(fuel_truck_cab_default), label: "Fuel Truck (Cab)", isStatic: true, movementType: "none" },
    carrier_car: { def: toDefCast(carrier_car_default), label: "Carrier Car", isStatic: false, movementType: "auto" },
    carrier_deck_tractor: { def: toDefCast(carrier_deck_tractor_default), label: "Carrier Deck Tractor", isStatic: false, movementType: "auto" }
  };
  var state = {
    def: null,
    def2: null,
    meta: { label: "", isStatic: true, movementType: "none" },
    selectedFaceIdx: -1,
    selectedVertIdx: -1,
    activePart: null,
    partTestAngles: {},
    dirty: false,
    filename: null,
    selectedFragmentIdx: -1
  };
  var buildTestParams = () => {
    const p = {};
    for (const part of state.def?.parts ?? []) {
      if (part.rotate && state.partTestAngles[part.id] !== void 0)
        p[part.rotate.param] = state.partTestAngles[part.id];
    }
    return p;
  };
  var mkGrid = () => ({ visible: true, x: 0, y: 0, z: 0, selected: false });
  var grids = [mkGrid(), mkGrid(), mkGrid(), mkGrid()];
  var gridVs = [mkGrid(), mkGrid(), mkGrid(), mkGrid()];
  var getActiveFaces = () => {
    if (!state.def) return [];
    if (state.def2) {
      const result = [];
      const recurse = (nodes) => {
        for (const node of nodes ?? []) {
          for (const f of node.faces ?? []) {
            if (f.type !== "line") result.push(f);
          }
          if (node.children) recurse(node.children);
        }
      };
      recurse(state.def2.nodes ?? []);
      return result;
    }
    if (state.activePart) {
      const part = state.def.parts?.find((p) => p.id === state.activePart);
      return part?.faces ?? [];
    }
    return state.def.faces;
  };
  var PIVOT_COLORS = ["#ff6644", "#44bbff", "#44ff88", "#ffaa44", "#cc44ff"];
  var DEG = Math.PI / 180;
  var QUAD_DEFAULT_ANGLES = [225, 315, 135, 45];
  var GAME_VIEW_Q = 3;
  grids[GAME_VIEW_Q].visible = false;
  gridVs[GAME_VIEW_Q].visible = false;
  var quads = QUAD_DEFAULT_ANGLES.map((a, i) => ({
    angle: i === GAME_VIEW_Q ? 0 : a * DEG,
    defaultAngle: i === GAME_VIEW_Q ? 0 : a * DEG,
    cam: { x: 0, y: 0 },
    zoom: 3
  }));
  var activeQ = 0;
  var lockedQ = 0;
  var renderCx = 0;
  var renderCy = 0;
  var renderZoom = 3;
  var renderViewAngle = 225 * DEG;
  var renderCam = quads[0].cam;
  var area = document.getElementById("canvas-area");
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var positionResetButtons = () => {
    const qw = area.clientWidth / 2, qh = area.clientHeight / 2;
    document.querySelectorAll(".quad-reset").forEach((btn, q) => {
      btn.style.display = q === GAME_VIEW_Q ? "none" : "";
      btn.style.top = Math.floor(q / 2) * qh + 4 + "px";
      btn.style.left = q % 2 * qw + qw - 24 + "px";
    });
    document.querySelectorAll(".quad-grid-toggle").forEach((btn, q) => {
      btn.style.display = q === GAME_VIEW_Q ? "none" : "";
      btn.style.top = Math.floor(q / 2) * qh + 4 + "px";
      btn.style.left = q % 2 * qw + qw - 48 + "px";
    });
  };
  var resize = () => {
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
    positionResetButtons();
    draw();
  };
  new ResizeObserver(resize).observe(area);
  var iso = (wx, wy, wz, camX, camY, out) => {
    const x = renderCx + (wx - wy) * (TW * renderZoom / 2) - camX;
    const y = renderCy + (wx + wy) * (TH * renderZoom / 2) - wz * SH * renderZoom - camY;
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  };
  var SceneRenderer = createSceneRenderer(ctx, iso);
  var localToScreen = (lx, ly, lz) => {
    const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
    return iso(lx * cosA - ly * sinA, lx * sinA + ly * cosA, lz, renderCam.x, renderCam.y);
  };
  var drawGrid = (g) => {
    if (!g.visible) return;
    const H = 8, STEP = 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = g.selected ? "rgba(100,180,255,0.45)" : "rgba(100,140,180,0.22)";
    for (let yi = -H; yi <= H; yi += STEP) {
      const p0 = localToScreen(g.x - H, g.y + yi, g.z), p1 = localToScreen(g.x + H, g.y + yi, g.z);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let xi = -H; xi <= H; xi += STEP) {
      const p0 = localToScreen(g.x + xi, g.y - H, g.z), p1 = localToScreen(g.x + xi, g.y + H, g.z);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.strokeStyle = g.selected ? "rgba(120,200,255,0.75)" : "rgba(160,190,230,0.40)";
    ctx.lineWidth = 1.5;
    const ax0 = localToScreen(g.x - H, g.y, g.z), ax1 = localToScreen(g.x + H, g.y, g.z);
    ctx.beginPath();
    ctx.moveTo(ax0.x, ax0.y);
    ctx.lineTo(ax1.x, ax1.y);
    ctx.stroke();
    const ay0 = localToScreen(g.x, g.y - H, g.z), ay1 = localToScreen(g.x, g.y + H, g.z);
    ctx.beginPath();
    ctx.moveTo(ay0.x, ay0.y);
    ctx.lineTo(ay1.x, ay1.y);
    ctx.stroke();
    ctx.restore();
  };
  var drawGridV = (gv) => {
    if (!gv.visible) return;
    const H = 8, STEP = 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = gv.selected ? "rgba(255,160,100,0.45)" : "rgba(180,140,100,0.22)";
    for (let zi = -H; zi <= H; zi += STEP) {
      const p0 = localToScreen(gv.x - H, gv.y, gv.z + zi), p1 = localToScreen(gv.x + H, gv.y, gv.z + zi);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let xi = -H; xi <= H; xi += STEP) {
      const p0 = localToScreen(gv.x + xi, gv.y, gv.z - H), p1 = localToScreen(gv.x + xi, gv.y, gv.z + H);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.strokeStyle = gv.selected ? "rgba(255,180,120,0.75)" : "rgba(220,180,140,0.40)";
    ctx.lineWidth = 1.5;
    const ax0 = localToScreen(gv.x - H, gv.y, gv.z), ax1 = localToScreen(gv.x + H, gv.y, gv.z);
    ctx.beginPath();
    ctx.moveTo(ax0.x, ax0.y);
    ctx.lineTo(ax1.x, ax1.y);
    ctx.stroke();
    const az0 = localToScreen(gv.x, gv.y, gv.z - H), az1 = localToScreen(gv.x, gv.y, gv.z + H);
    ctx.beginPath();
    ctx.moveTo(az0.x, az0.y);
    ctx.lineTo(az1.x, az1.y);
    ctx.stroke();
    ctx.restore();
  };
  var drawDirectionArrow = () => {
    const z = 1.8;
    const shaft = localToScreen(0, 0, z), tip = localToScreen(3, 0, z);
    const w0 = localToScreen(2.4, 0.3, z), w1 = localToScreen(2.4, -0.3, z);
    ctx.strokeStyle = "rgba(0,220,255,0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shaft.x, shaft.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,220,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(w0.x, w0.y);
    ctx.lineTo(w1.x, w1.y);
    ctx.closePath();
    ctx.fill();
  };
  var drawPivotCircles = (params) => {
    if (!state.def?.parts) return;
    const pivots = getTransformedPivots(state.def, params);
    let colorIdx = 0;
    for (const part of state.def.parts) {
      if (!part.rotate) continue;
      const color = PIVOT_COLORS[colorIdx++ % PIVOT_COLORS.length];
      const pivot = pivots.get(part.id) ?? part.rotate.pivot;
      const [px, py, pz] = pivot;
      const pt = localToScreen(px, py, pz);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  var hitTestPivot = (mx, my, params = {}) => {
    if (!state.def?.parts) return null;
    const pivots = getTransformedPivots(state.def, params);
    for (const part of state.def.parts) {
      if (!part.rotate) continue;
      const pivot = pivots.get(part.id) ?? part.rotate.pivot;
      const [px, py, pz] = pivot;
      const pt = localToScreen(px, py, pz);
      if (Math.hypot(mx - pt.x, my - pt.y) < 9) return part.id;
    }
    return null;
  };
  var draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const qw = canvas.width / 2, qh = canvas.height / 2;
    const showCboxes = document.getElementById("show-cboxes").checked;
    for (let q = 0; q < 4; q++) {
      setRenderContext(q);
      const col = q % 2, row = Math.floor(q / 2);
      const ox = col * qw, oy = row * qh;
      const g = grids[q], gv = gridVs[q];
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, qw, qh);
      ctx.clip();
      if (state.def) {
        const testParams = buildTestParams();
        const activeFaces = getActiveFaces();
        if (state.def2) {
          const colors2 = {};
          if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
            colors2[activeFaces[state.selectedFaceIdx].id] = "#ffdd44";
          }
          SceneRenderer.debugCollision = showCboxes;
          renderNodes(state.def2, {}, { x: 0, y: 0, angle: renderViewAngle, colors: colors2 }, SceneRenderer, renderCam.x, renderCam.y, { ctx, isoFn: iso, tileW: TW * renderZoom });
        } else {
          const colors = {};
          if (state.activePart) {
            const ap = state.def.parts?.find((p) => p.id === state.activePart);
            if (ap) ap.faces.forEach((f) => {
              colors[f.id] = "#2d5c88";
            });
          }
          if (state.selectedFragmentIdx >= 0 && state.def.fragments?.[state.selectedFragmentIdx]) {
            const selFr = state.def.fragments[state.selectedFragmentIdx];
            const fragColor = _fragColors[state.selectedFragmentIdx % _fragColors.length];
            selFr.faceIds.forEach((id) => {
              colors[id] = fragColor;
            });
          }
          if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
            colors[activeFaces[state.selectedFaceIdx].id] = "#ffdd44";
          }
          const renderedDef = applyParts(state.def, testParams);
          SceneRenderer.debugCollision = showCboxes;
          SceneRenderer.add(renderedDef, { x: 0, y: 0, angle: renderViewAngle, colors });
          SceneRenderer.flush(renderCam.x, renderCam.y);
        }
        if (state.selectedFaceIdx >= 0) {
          const face = activeFaces[state.selectedFaceIdx];
          if (face && face.verts.length >= 2) {
            const pts = face.verts.map((v) => localToScreen(v[0], v[1], v[2]));
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        if (!state.meta.isStatic) drawDirectionArrow();
        if (state.selectedFaceIdx >= 0) {
          const face = activeFaces[state.selectedFaceIdx];
          if (face) {
            face.verts.forEach((v, i) => {
              const pt = localToScreen(v[0], v[1], v[2]);
              const sel = i === state.selectedVertIdx;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, sel ? 5 : 3.5, 0, Math.PI * 2);
              ctx.fillStyle = sel ? "#ff4444" : "#ffee00";
              ctx.fill();
              ctx.strokeStyle = sel ? "#fff" : "#888";
              ctx.lineWidth = 1;
              ctx.stroke();
            });
          }
        }
        drawPivotCircles(testParams);
        if (state.def?.rescueZones?.length) {
          const zoneColors = {
            pickup: "rgba(80,220,80,",
            dropoff: "rgba(80,140,255,",
            both: "rgba(255,180,60,"
          };
          for (const z of state.def.rescueZones) {
            const zz = z.z ?? 0;
            const c = zoneColors[z.role] || zoneColors["both"];
            const pts = [
              localToScreen(z.x - z.w, z.y - z.h, zz),
              localToScreen(z.x + z.w, z.y - z.h, zz),
              localToScreen(z.x + z.w, z.y + z.h, zz),
              localToScreen(z.x - z.w, z.y + z.h, zz)
            ];
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fillStyle = c + "0.18)";
            ctx.fill();
            ctx.strokeStyle = c + "0.8)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.restore();
          }
        }
        if (state.def?.landingZone) {
          const lz = state.def.landingZone;
          const pts = [
            localToScreen(lz.x - lz.w, lz.y - lz.h, lz.z),
            localToScreen(lz.x + lz.w, lz.y - lz.h, lz.z),
            localToScreen(lz.x + lz.w, lz.y + lz.h, lz.z),
            localToScreen(lz.x - lz.w, lz.y + lz.h, lz.z)
          ];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,80,80,0.15)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,80,80,0.85)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }
        if (gridDrag.active && gridDrag.snapFaceIdx >= 0) {
          const allFaces = [...state.def.faces];
          if (state.def.parts) state.def.parts.forEach((p) => allFaces.push(...p.faces));
          const snapFace = allFaces[gridDrag.snapFaceIdx];
          if (snapFace) {
            const sv = snapFace.verts[gridDrag.snapVertIdx];
            const spt = localToScreen(sv[0], sv[1], sv[2]);
            ctx.beginPath();
            ctx.arc(spt.x, spt.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = "#ffee00";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Kein Modell", ox + qw / 2, oy + qh / 2);
      }
      drawGrid(g);
      drawGridV(gv);
      const isGameView = q === GAME_VIEW_Q;
      const activeColor = isGameView ? "rgba(255,190,60,0.7)" : "rgba(100,180,255,0.55)";
      ctx.strokeStyle = q === activeQ ? activeColor : isGameView ? "rgba(255,180,50,0.2)" : "rgba(255,255,255,0.07)";
      ctx.lineWidth = q === activeQ ? 2 : 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, qw - 1, qh - 1);
      ctx.fillStyle = q === activeQ ? isGameView ? "rgba(255,200,80,0.9)" : "rgba(140,200,255,0.8)" : isGameView ? "rgba(255,180,50,0.4)" : "rgba(255,255,255,0.2)";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      if (isGameView) {
        ctx.fillText("SPIEL", ox + 6, oy + 14);
      } else {
        const deg = (Math.round(quads[q].angle * 180 / Math.PI) % 360 + 360) % 360;
        ctx.fillText(`${deg}\xB0`, ox + 6, oy + 14);
      }
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qw, 0);
    ctx.lineTo(qw, canvas.height);
    ctx.moveTo(0, qh);
    ctx.lineTo(canvas.width, qh);
    ctx.stroke();
  };
  var renderPartsList = () => {
    const sec = document.getElementById("parts-sec");
    const list = document.getElementById("parts-list");
    if (state.def2) {
      sec.style.display = "none";
      return;
    }
    if (!state.def?.parts?.length) {
      sec.style.display = "none";
      return;
    }
    sec.style.display = "";
    let colorIdx = 0;
    const allPartIds = state.def.parts.map((p) => p.id);
    list.innerHTML = state.def.parts.map((part) => {
      const isRotating = !!part.rotate;
      const color = isRotating ? PIVOT_COLORS[colorIdx++ % PIVOT_COLORS.length] : "var(--dim)";
      const angle = state.partTestAngles[part.id] ?? 0;
      const sliderRow = isRotating ? `
      <div class="part-slider-row">
        <input type="range" min="-3.14" max="3.14" step="0.02" value="${angle}" data-pid="${part.id}">
        <span class="part-slider-val" id="pval-${part.id}">${(angle * 180 / Math.PI).toFixed(0)}\xB0</span>
      </div>` : "";
      const parentOptions = allPartIds.filter((id) => id !== part.id).map((id) => `<option value="${id}" ${part.parent === id ? "selected" : ""}>${id}</option>`).join("");
      const parentRow = `
      <div class="part-parent-row">
        <span>parent</span>
        <select data-pid="${part.id}" class="part-parent-select">
          <option value="" ${!part.parent ? "selected" : ""}>\u2014</option>
          ${parentOptions}
        </select>
      </div>`;
      return `
      <div class="part-item ${state.activePart === part.id ? "active" : ""}" data-pid="${part.id}">
        <div class="part-header">
          <div class="part-dot" style="background:${color}"></div>
          <div class="part-name">${part.id}</div>
          <div class="part-info">${part.faces.length}f</div>
          ${isRotating ? '<div class="part-rotate-badge">\u21BA</div>' : ""}
        </div>${sliderRow}${parentRow}
      </div>`;
    }).join("");
    list.querySelectorAll(".part-header").forEach((el) => {
      el.addEventListener("click", () => {
        const pid = el.parentElement.dataset["pid"] ?? null;
        state.activePart = state.activePart === pid ? null : pid;
        if (state.activePart !== null) {
          state.selectedFaceIdx = -1;
          state.selectedVertIdx = -1;
        }
        renderPartsList();
        renderFaceList();
        renderFaceEditor();
        draw();
      });
    });
    list.querySelectorAll("input[type=range]").forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const pid = e.target.dataset["pid"];
        const val = parseFloat(e.target.value);
        state.partTestAngles[pid] = val;
        const valEl = document.getElementById(`pval-${pid}`);
        if (valEl) valEl.textContent = (val * 180 / Math.PI).toFixed(0) + "\xB0";
        draw();
      });
      slider.addEventListener("click", (e) => e.stopPropagation());
    });
    list.querySelectorAll("select.part-parent-select").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const pid = e.target.dataset["pid"];
        const val = e.target.value;
        const part = state.def.parts?.find((p) => p.id === pid);
        if (!part) return;
        if (val) {
          part.parent = val;
        } else {
          delete part.parent;
        }
        markDirty();
        draw();
      });
      sel.addEventListener("click", (e) => e.stopPropagation());
    });
  };
  var _def2FindFaceNode = (faceRef) => {
    if (!state.def2) return null;
    const search = (nodes) => {
      for (const node of nodes) {
        const idx = (node.faces ?? []).indexOf(faceRef);
        if (idx >= 0) return { node, localIdx: idx };
        if (node.children) {
          const r = search(node.children);
          if (r) return r;
        }
      }
      return null;
    };
    return search(state.def2.nodes);
  };
  var _def2MoveFace = (srcFlatIdx, dstFlatIdx) => {
    if (!state.def2) return;
    const allFaces = getActiveFaces();
    const srcFace = allFaces[srcFlatIdx];
    const dstFace = allFaces[dstFlatIdx];
    const srcFound = _def2FindFaceNode(srcFace);
    if (!srcFound) return;
    srcFound.node.faces.splice(srcFound.localIdx, 1);
    const dstFound = _def2FindFaceNode(dstFace);
    if (!dstFound) return;
    dstFound.node.faces.splice(dstFound.localIdx, 0, srcFace);
    state.selectedFaceIdx = getActiveFaces().indexOf(srcFace);
    markDirty();
    renderAll();
  };
  var _def2MoveFaceToNode = (srcFlatIdx, nodeIdx) => {
    if (!state.def2) return;
    const allFaces = getActiveFaces();
    const srcFace = allFaces[srcFlatIdx];
    const srcFound = _def2FindFaceNode(srcFace);
    if (!srcFound) return;
    const targetNode = state.def2.nodes[nodeIdx];
    if (!targetNode || srcFound.node === targetNode) return;
    srcFound.node.faces.splice(srcFound.localIdx, 1);
    if (!targetNode.faces) targetNode.faces = [];
    targetNode.faces.push(srcFace);
    state.selectedFaceIdx = getActiveFaces().indexOf(srcFace);
    markDirty();
    renderAll();
  };
  var renderFaceList = () => {
    const list = document.getElementById("face-list");
    const count = document.getElementById("face-count");
    const faces = getActiveFaces();
    if (!state.def || !faces.length) {
      list.innerHTML = state.def ? '<div class="empty">Part w\xE4hlen oder Fl\xE4che hinzuf\xFCgen</div>' : '<div class="empty">Kein Modell geladen</div>';
      count.textContent = "";
      return;
    }
    count.textContent = `(${faces.length})`;
    if (state.def2) {
      let html = "";
      let fi = 0;
      const buildFacesHtml = (node, depth) => {
        let h = "";
        for (const f of node.faces ?? []) {
          if (f.type === "line") continue;
          const idx = fi++;
          const indent = depth > 0 ? ` style="padding-left:${4 + depth * 10}px"` : "";
          h += `<div class="face-item${idx === state.selectedFaceIdx ? " active" : ""}" data-i="${idx}" draggable="true"${indent}><span class="drag-handle">\u283F</span><div class="face-swatch" style="background:${f.color}"></div><div class="face-id" title="${f.id ?? ""}">${f.id ?? "\u2014"}</div></div>`;
        }
        for (const child of node.children ?? []) h += buildFacesHtml(child, depth + 1);
        return h;
      };
      state.def2.nodes.forEach((node, ni) => {
        html += `<div class="node-group"><div class="node-header" data-ni="${ni}">Node ${ni}${node.rotate ? " \u21BB" : ""}</div><div class="node-faces" data-ni="${ni}">${buildFacesHtml(node, 0)}</div></div>`;
      });
      list.innerHTML = html;
      let dragSrcIdx = -1;
      list.querySelectorAll(".face-item").forEach((el) => {
        el.addEventListener("click", () => selectFace(parseInt(el.dataset["i"] ?? "0")));
        el.addEventListener("dragstart", (e) => {
          dragSrcIdx = parseInt(el.dataset["i"] ?? "-1");
          e.dataTransfer.effectAllowed = "move";
        });
        el.addEventListener("dragover", (e) => {
          e.preventDefault();
          el.classList.add("drag-over");
        });
        el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          el.classList.remove("drag-over");
          const dstIdx = parseInt(el.dataset["i"] ?? "-1");
          if (dragSrcIdx >= 0 && dragSrcIdx !== dstIdx) _def2MoveFace(dragSrcIdx, dstIdx);
          dragSrcIdx = -1;
        });
      });
      list.querySelectorAll(".node-header").forEach((el) => {
        el.addEventListener("dragover", (e) => {
          e.preventDefault();
          el.classList.add("drag-over");
        });
        el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
        el.addEventListener("drop", (e) => {
          e.preventDefault();
          el.classList.remove("drag-over");
          const ni = parseInt(el.dataset["ni"] ?? "0");
          if (dragSrcIdx >= 0) _def2MoveFaceToNode(dragSrcIdx, ni);
          dragSrcIdx = -1;
        });
      });
      return;
    }
    list.innerHTML = faces.map((f, i) => `
    <div class="face-item ${i === state.selectedFaceIdx ? "active" : ""}" data-i="${i}">
      <div class="face-swatch" style="background:${f.color}"></div>
      <div class="face-id" title="${f.id}">${f.id}</div>
    </div>`).join("");
    list.querySelectorAll(".face-item").forEach((el) => {
      el.addEventListener("click", () => selectFace(parseInt(el.dataset["i"] ?? "0")));
    });
  };
  var renderFaceEditor = () => {
    const sec = document.getElementById("face-editor");
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !state.def || !faces.length) {
      sec.style.display = "none";
      return;
    }
    const face = faces[state.selectedFaceIdx];
    if (!face) {
      sec.style.display = "none";
      return;
    }
    sec.style.display = "";
    document.getElementById("face-id-input").value = face.id;
    document.getElementById("face-color").value = toColorInput(face.color);
    document.getElementById("face-color-hex").value = face.color;
    const hasStroke = !!face.stroke;
    document.getElementById("face-has-stroke").checked = hasStroke;
    document.getElementById("face-stroke").value = toColorInput(face.stroke || "#aaaaaa");
    document.getElementById("face-stroke-hex").value = face.stroke || "#aaaaaa";
    document.getElementById("face-stroke-w").value = String(face.strokeWidth ?? 1);
    const hasNormal = Array.isArray(face.normal);
    document.getElementById("face-has-normal").checked = hasNormal;
    document.getElementById("face-nx").value = String(hasNormal ? face.normal[0] : 0);
    document.getElementById("face-ny").value = String(hasNormal ? face.normal[1] : 0);
    renderVertList(face);
  };
  var renderVertList = (face) => {
    const list = document.getElementById("vert-list");
    list.innerHTML = face.verts.map((v, i) => `
    <div class="vert-row ${i === state.selectedVertIdx ? "selected" : ""}" data-i="${i}">
      <span class="vi">V${i}</span>
      <input type="number" class="vx" step="0.01" value="${v[0].toFixed(3)}" style="width:52px">
      <input type="number" class="vy" step="0.01" value="${v[1].toFixed(3)}" style="width:52px">
      <input type="number" class="vz" step="0.01" value="${v[2].toFixed(3)}" style="width:52px">
    </div>`).join("");
    list.querySelectorAll(".vert-row").forEach((row) => {
      const i = parseInt(row.dataset["i"] ?? "0");
      row.addEventListener("click", () => {
        state.selectedVertIdx = i;
        renderFaceEditor();
        draw();
      });
      row.querySelector(".vx").addEventListener("input", (e) => {
        face.verts[i][0] = parseFloat(e.target.value) || 0;
        markDirty();
        draw();
      });
      row.querySelector(".vy").addEventListener("input", (e) => {
        face.verts[i][1] = parseFloat(e.target.value) || 0;
        markDirty();
        draw();
      });
      row.querySelector(".vz").addEventListener("input", (e) => {
        face.verts[i][2] = parseFloat(e.target.value) || 0;
        markDirty();
        draw();
      });
    });
  };
  var renderCboxList = () => {
    const list = document.getElementById("cbox-list");
    const boxes = state.def?.collisionBoxes;
    if (!boxes?.length) {
      list.innerHTML = '<div class="empty">\u2013</div>';
      return;
    }
    list.innerHTML = boxes.map((cb, i) => `
    <div class="cbox-block">
      <div class="row">
        <input type="text" class="cbi-id" data-i="${i}" value="${cb.id}" style="flex:1;font-size:10px">
        <button class="btn btn-sm btn-danger cbox-del" data-i="${i}">\u2715</button>
      </div>
      <div class="cbox-grid">
        <label>xMin/Max</label>
        <input type="number" step="0.1" value="${cb.xMin}" class="cbi" data-i="${i}" data-f="xMin">
        <input type="number" step="0.1" value="${cb.xMax}" class="cbi" data-i="${i}" data-f="xMax">
        <label>yMin/Max</label>
        <input type="number" step="0.1" value="${cb.yMin}" class="cbi" data-i="${i}" data-f="yMin">
        <input type="number" step="0.1" value="${cb.yMax}" class="cbi" data-i="${i}" data-f="yMax">
        <label>zMin/Max</label>
        <input type="number" step="0.1" value="${cb.zMin}" class="cbi" data-i="${i}" data-f="zMin">
        <input type="number" step="0.1" value="${cb.zMax}" class="cbi" data-i="${i}" data-f="zMax">
      </div>
    </div>`).join("");
    list.querySelectorAll(".cbi").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const t = e.target;
        boxes[+t.dataset["i"]][t.dataset["f"]] = parseFloat(t.value) || 0;
        markDirty();
        draw();
      });
    });
    list.querySelectorAll(".cbi-id").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const t = e.target;
        boxes[+t.dataset["i"]].id = t.value;
        markDirty();
      });
    });
    list.querySelectorAll(".cbox-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        boxes.splice(+btn.dataset["i"], 1);
        markDirty();
        renderCboxList();
        draw();
      });
    });
  };
  var renderZoneList = () => {
    const list = document.getElementById("zone-list");
    const zones = state.def?.rescueZones;
    if (!zones?.length) {
      list.innerHTML = '<div class="empty">\u2013</div>';
      return;
    }
    const roleLabel = { pickup: "\u2B06 Aufnehmen", dropoff: "\u2B07 Absetzen", both: "\u21C5 Beides" };
    list.innerHTML = zones.map((z, i) => `
    <div class="cbox-block">
      <div class="row">
        <select class="zone-role" data-i="${i}" style="flex:1;font-size:10px">
          ${["pickup", "dropoff", "both"].map((r) => `<option value="${r}"${z.role === r ? " selected" : ""}>${roleLabel[r]}</option>`).join("")}
        </select>
        <button class="btn btn-sm btn-danger zone-del" data-i="${i}">\u2715</button>
      </div>
      <div class="cbox-grid">
        <label>X</label>
        <input type="number" step="0.1" value="${z.x}" class="zi" data-i="${i}" data-f="x">
        <input type="number" step="0.1" value="${z.y}" class="zi" data-i="${i}" data-f="y">
        <label>W/H</label>
        <input type="number" step="0.1" value="${z.w}" class="zi" data-i="${i}" data-f="w">
        <input type="number" step="0.1" value="${z.h}" class="zi" data-i="${i}" data-f="h">
        <label>Z</label>
        <input type="number" step="0.05" value="${z.z ?? 0}" class="zi" data-i="${i}" data-f="z" style="grid-column:2">
      </div>
    </div>`).join("");
    list.querySelectorAll(".zi").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const t = e.target;
        zones[+t.dataset["i"]][t.dataset["f"]] = parseFloat(t.value) || 0;
        markDirty();
        draw();
      });
    });
    list.querySelectorAll(".zone-role").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        zones[+e.target.dataset["i"]].role = e.target.value;
        markDirty();
        draw();
      });
    });
    list.querySelectorAll(".zone-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        zones.splice(+btn.dataset["i"], 1);
        markDirty();
        renderZoneList();
        draw();
      });
    });
  };
  var renderLandingZone = () => {
    const panel = document.getElementById("landing-zone-panel");
    const btnAdd = document.getElementById("btn-add-landing");
    const btnRemove = document.getElementById("btn-remove-landing");
    const lz = state.def?.landingZone;
    if (!lz) {
      panel.innerHTML = '<div class="empty">\u2013</div>';
      btnAdd.style.display = "";
      btnRemove.style.display = "none";
      return;
    }
    btnAdd.style.display = "none";
    btnRemove.style.display = "";
    panel.innerHTML = `
    <div class="cbox-block"><div class="cbox-grid">
      <label>X</label>
      <input type="number" step="0.1" value="${lz.x}" class="lzi" data-f="x">
      <input type="number" step="0.1" value="${lz.y}" class="lzi" data-f="y">
      <label>W/H</label>
      <input type="number" step="0.1" value="${lz.w}" class="lzi" data-f="w">
      <input type="number" step="0.1" value="${lz.h}" class="lzi" data-f="h">
      <label>Z</label>
      <input type="number" step="0.05" value="${lz.z}" class="lzi" data-f="z" style="grid-column:2">
    </div></div>`;
    panel.querySelectorAll(".lzi").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const t = e.target;
        lz[t.dataset["f"]] = parseFloat(t.value) || 0;
        markDirty();
        draw();
      });
    });
  };
  var _getAllEditorFaces = () => {
    const result = [...state.def?.faces ?? []];
    for (const part of state.def?.parts ?? []) {
      result.push(...part.faces);
    }
    return result;
  };
  var _previewFrags = null;
  var _previewRafId = 0;
  var PREVIEW_GRAVITY = 0.018;
  var PREVIEW_MAX_AGE = 120;
  var _fragColors = ["#4af", "#fa4", "#4f8", "#f4a", "#a4f", "#ff4"];
  var renderFragmentList = () => {
    const sec = document.getElementById("fragments-sec");
    const list = document.getElementById("fragment-list");
    const playBtn = document.getElementById("btn-play-fragments");
    const resetBtn = document.getElementById("btn-reset-fragments");
    if (state.def2) {
      sec.style.display = "none";
      return;
    }
    sec.style.display = "";
    const frags = state.def?.fragments ?? [];
    const hasFrags = frags.length > 0;
    playBtn.style.display = hasFrags && !_previewFrags ? "" : "none";
    resetBtn.style.display = _previewFrags ? "" : "none";
    if (!frags.length) {
      list.innerHTML = '<div class="empty">\u2013</div>';
      return;
    }
    list.innerHTML = frags.map((fr, i) => {
      const color = _fragColors[i % _fragColors.length];
      const sel = i === state.selectedFragmentIdx;
      const faceCount = fr.faceIds.length;
      const allFaces = _getAllEditorFaces();
      const faceRows = sel ? allFaces.map((f, fi) => {
        const checked = fr.faceIds.includes(f.id) ? "checked" : "";
        return `<label class="frag-face-label"><input type="checkbox" class="frag-face-cb" data-fi="${fi}" ${checked}/>${f.id}</label>`;
      }).join("") : "";
      const pivot = fr.pivot;
      const imp = fr.impulse ?? [0, 0, 0];
      const detail = sel ? `
        <div class="cbox-grid" style="margin-top:4px">
            <label>Pivot</label>
            <input type="number" step="0.1" class="fri" data-f="px" value="${pivot[0].toFixed(2)}" style="width:44px">
            <input type="number" step="0.1" class="fri" data-f="py" value="${pivot[1].toFixed(2)}" style="width:44px">
            <label>Z</label>
            <input type="number" step="0.1" class="fri" data-f="pz" value="${pivot[2].toFixed(2)}" style="width:44px;grid-column:2">
            <label>Impuls</label>
            <input type="number" step="0.05" class="fri" data-f="ix" value="${imp[0].toFixed(2)}" style="width:44px">
            <input type="number" step="0.05" class="fri" data-f="iy" value="${imp[1].toFixed(2)}" style="width:44px">
            <label>Z</label>
            <input type="number" step="0.05" class="fri" data-f="iz" value="${imp[2].toFixed(2)}" style="width:44px;grid-column:2">
            <label>Torque</label>
            <input type="number" step="0.5" class="fri" data-f="torque" value="${(fr.torque ?? 0).toFixed(1)}" style="width:44px;grid-column:2">
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--dim)">Fl\xE4chen:</div>
        <div class="frag-faces-wrap">${faceRows}</div>` : "";
      return `<div class="frag-item ${sel ? "active" : ""}" data-fi="${i}">
            <div class="frag-header">
                <div class="part-dot" style="background:${color}"></div>
                <div class="part-name">${fr.id}</div>
                <div class="part-info">${faceCount}f</div>
                <button class="btn btn-sm btn-danger frag-del" data-fi="${i}" style="padding:0 4px">\u2715</button>
            </div>${detail}
        </div>`;
    }).join("");
    list.querySelectorAll(".frag-header").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".frag-del")) return;
        const fi = parseInt(el.parentElement.dataset["fi"] ?? "-1");
        state.selectedFragmentIdx = state.selectedFragmentIdx === fi ? -1 : fi;
        renderFragmentList();
        draw();
      });
    });
    list.querySelectorAll(".frag-del").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const fi = parseInt(btn.dataset["fi"] ?? "-1");
        state.def.fragments.splice(fi, 1);
        if (state.selectedFragmentIdx >= state.def.fragments.length) state.selectedFragmentIdx = -1;
        markDirty();
        renderFragmentList();
        draw();
      });
    });
    list.querySelectorAll(".fri").forEach((inp) => {
      inp.addEventListener("input", () => {
        const fi = state.selectedFragmentIdx;
        if (fi < 0 || !state.def?.fragments?.[fi]) return;
        const fr = state.def.fragments[fi];
        const f = inp.dataset["f"];
        const v = parseFloat(inp.value) || 0;
        if (f === "px") fr.pivot[0] = v;
        else if (f === "py") fr.pivot[1] = v;
        else if (f === "pz") fr.pivot[2] = v;
        else if (f === "ix") {
          if (!fr.impulse) fr.impulse = [0, 0, 0];
          fr.impulse[0] = v;
        } else if (f === "iy") {
          if (!fr.impulse) fr.impulse = [0, 0, 0];
          fr.impulse[1] = v;
        } else if (f === "iz") {
          if (!fr.impulse) fr.impulse = [0, 0, 0];
          fr.impulse[2] = v;
        } else if (f === "torque") fr.torque = v;
        markDirty();
        draw();
      });
      inp.addEventListener("click", (e) => e.stopPropagation());
    });
    list.querySelectorAll(".frag-face-cb").forEach((cb) => {
      cb.addEventListener("change", () => {
        const fi = state.selectedFragmentIdx;
        if (fi < 0 || !state.def?.fragments?.[fi]) return;
        const fr = state.def.fragments[fi];
        const faceIdx = parseInt(cb.dataset["fi"] ?? "-1");
        const face = _getAllEditorFaces()[faceIdx];
        if (!face) return;
        if (cb.checked) {
          if (!fr.faceIds.includes(face.id)) fr.faceIds.push(face.id);
        } else {
          fr.faceIds = fr.faceIds.filter((id) => id !== face.id);
        }
        markDirty();
        renderFragmentList();
      });
      cb.addEventListener("click", (e) => e.stopPropagation());
    });
  };
  var _buildPreviewFrags = () => {
    if (!state.def?.fragments?.length) return [];
    const result = [];
    for (const frag of state.def.fragments) {
      const [px, py, pz] = frag.pivot;
      const bakedFaces = [];
      const allEditorFaces = _getAllEditorFaces();
      for (const faceId of frag.faceIds) {
        const src = allEditorFaces.find((f) => f.id === faceId);
        if (!src) continue;
        const verts = src.verts.map((v) => [v[0] - px, v[1] - py, v[2] - pz]);
        bakedFaces.push({ ...src, verts });
      }
      if (!bakedFaces.length) continue;
      const [ix, iy, iz] = frag.impulse ?? [0, 0, 0];
      const torque = frag.torque ?? (Math.random() - 0.5) * 6;
      result.push({
        faces: bakedFaces,
        x: px,
        y: py,
        z: pz,
        vx: ix,
        vy: iy,
        vz: iz + 0.04 + Math.random() * 0.06,
        selfAngle: 0,
        rotSpeed: torque / (PREVIEW_MAX_AGE * 0.5),
        age: 0,
        maxAge: PREVIEW_MAX_AGE
      });
    }
    return result;
  };
  var _drawPreview = () => {
    if (!_previewFrags) return;
    for (const f of _previewFrags) {
      if (f.age >= f.maxAge) continue;
      const fragDef = { id: "_prev", faces: f.faces };
      SceneRenderer.add(fragDef, { x: f.x, y: f.y, z: f.z, angle: f.selfAngle });
    }
    SceneRenderer.flush(renderCam.x, renderCam.y);
  };
  var _stepPreview = () => {
    if (!_previewFrags) return;
    for (const f of _previewFrags) {
      if (f.age >= f.maxAge) continue;
      f.vz -= PREVIEW_GRAVITY;
      f.x += f.vx;
      f.y += f.vy;
      f.z += f.vz;
      f.selfAngle += f.rotSpeed;
      f.age++;
    }
    if (_previewFrags.every((f) => f.age >= f.maxAge)) stopPreview();
  };
  var stopPreview = () => {
    cancelAnimationFrame(_previewRafId);
    _previewFrags = null;
    const playBtn = document.getElementById("btn-play-fragments");
    const resetBtn = document.getElementById("btn-reset-fragments");
    if (playBtn) playBtn.style.display = "";
    if (resetBtn) resetBtn.style.display = "none";
    draw();
  };
  var _previewLoop = () => {
    _stepPreview();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const qw = canvas.width / 2, qh = canvas.height / 2;
    for (let q = 0; q < 4; q++) {
      setRenderContext(q);
      ctx.save();
      ctx.beginPath();
      ctx.rect(q % 2 * qw, Math.floor(q / 2) * qh, qw, qh);
      ctx.clip();
      _drawPreview();
      ctx.restore();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qw, 0);
    ctx.lineTo(qw, canvas.height);
    ctx.moveTo(0, qh);
    ctx.lineTo(canvas.width, qh);
    ctx.stroke();
    if (_previewFrags) _previewRafId = requestAnimationFrame(_previewLoop);
  };
  document.getElementById("btn-add-fragment").addEventListener("click", () => {
    if (!state.def) return;
    if (!state.def.fragments) state.def.fragments = [];
    const id = "frag_" + state.def.fragments.length;
    const selFace = state.selectedFaceIdx >= 0 ? state.def.faces[state.selectedFaceIdx] : null;
    state.def.fragments.push({
      id,
      faceIds: selFace ? [selFace.id] : [],
      pivot: [0, 0, 0]
    });
    state.selectedFragmentIdx = state.def.fragments.length - 1;
    markDirty();
    renderFragmentList();
    draw();
  });
  document.getElementById("btn-play-fragments").addEventListener("click", () => {
    if (!state.def?.fragments?.length) return;
    _previewFrags = _buildPreviewFrags();
    const playBtn = document.getElementById("btn-play-fragments");
    const resetBtn = document.getElementById("btn-reset-fragments");
    playBtn.style.display = "none";
    resetBtn.style.display = "";
    _previewRafId = requestAnimationFrame(_previewLoop);
  });
  document.getElementById("btn-reset-fragments").addEventListener("click", stopPreview);
  var renderAll = () => {
    renderPartsList();
    renderFaceList();
    renderFaceEditor();
    renderCboxList();
    renderZoneList();
    renderLandingZone();
    renderFragmentList();
    draw();
  };
  var selectFace = (i) => {
    state.selectedFaceIdx = i;
    state.selectedVertIdx = -1;
    renderFaceList();
    renderFaceEditor();
    draw();
  };
  var loadPreset = (key) => {
    const p = PRESETS[key];
    if (!p) return;
    fromJSON(JSON.stringify(p.def));
    state.meta = { label: p.label, isStatic: p.isStatic, movementType: p.movementType };
    state.dirty = false;
    state.filename = null;
    syncMetaToUI();
    renderAll();
  };
  var syncMetaToUI = () => {
    document.getElementById("meta-id").value = state.def ? state.def.id : "";
    document.getElementById("meta-label").value = state.meta.label;
    document.getElementById("r-static").checked = state.meta.isStatic;
    document.getElementById("r-moving").checked = !state.meta.isStatic;
    document.getElementById("move-type").value = state.meta.movementType;
    document.getElementById("move-type-row").style.opacity = state.meta.isStatic ? "0.4" : "1";
  };
  var toColorInput = (c) => {
    if (!c) return "#888888";
    if (c.startsWith("rgba")) {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
    }
    return c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7);
  };
  var markDirty = () => {
    state.dirty = true;
    scheduleNotify();
  };
  var getQuadrant = (mx, my) => (mx < canvas.width / 2 ? 0 : 1) + (my < canvas.height / 2 ? 0 : 2);
  var setRenderContext = (q) => {
    const qw = canvas.width / 2, qh = canvas.height / 2;
    renderCx = q % 2 * qw + qw / 2;
    renderCy = Math.floor(q / 2) * qh + qh / 2;
    renderZoom = quads[q].zoom;
    renderViewAngle = quads[q].angle;
    renderCam = quads[q].cam;
  };
  var hitTestGrid = (mx, my, g) => {
    if (!g.visible) return false;
    const H = 8;
    return pointInPolygon(mx, my, [
      localToScreen(g.x - H, g.y - H, g.z),
      localToScreen(g.x + H, g.y - H, g.z),
      localToScreen(g.x + H, g.y + H, g.z),
      localToScreen(g.x - H, g.y + H, g.z)
    ]);
  };
  var hitTestGridV = (mx, my, gv) => {
    if (!gv.visible) return false;
    const H = 8;
    return pointInPolygon(mx, my, [
      localToScreen(gv.x - H, gv.y, gv.z - H),
      localToScreen(gv.x + H, gv.y, gv.z - H),
      localToScreen(gv.x + H, gv.y, gv.z + H),
      localToScreen(gv.x - H, gv.y, gv.z + H)
    ]);
  };
  var syncGridUI = () => {
    const g = grids[activeQ], gv = gridVs[activeQ];
    document.getElementById("grid-x").value = g.x.toFixed(2);
    document.getElementById("grid-y").value = g.y.toFixed(2);
    document.getElementById("grid-z").value = g.z.toFixed(2);
    document.getElementById("grid-visible").checked = g.visible;
    document.getElementById("gridv-x").value = gv.x.toFixed(2);
    document.getElementById("gridv-y").value = gv.y.toFixed(2);
    document.getElementById("gridv-z").value = gv.z.toFixed(2);
    document.getElementById("gridv-visible").checked = gv.visible;
    const label = `(Ansicht ${activeQ + 1})`;
    document.getElementById("grid-q-label").textContent = label;
    document.getElementById("gridv-q-label").textContent = label;
  };
  var gridDrag = {
    active: false,
    moved: false,
    target: "floor",
    quadrant: 0,
    snapFaceIdx: -1,
    snapVertIdx: -1
  };
  var snapGrid = (q) => {
    const g = gridDrag.target === "wall" ? gridVs[q] : grids[q];
    if (!state.def) {
      gridDrag.snapFaceIdx = -1;
      gridDrag.snapVertIdx = -1;
      return;
    }
    const T = 0.35;
    let bestDist = Infinity, bestFi = -1, bestVi = -1;
    const allFaces = [...state.def.faces];
    if (state.def.parts) state.def.parts.forEach((p) => allFaces.push(...p.faces));
    for (let fi = 0; fi < allFaces.length; fi++) {
      for (let vi = 0; vi < allFaces[fi].verts.length; vi++) {
        const v = allFaces[fi].verts[vi];
        const d = Math.min(Math.abs(v[2] - g.z), Math.hypot(v[0] - g.x, v[1] - g.y));
        if (d < bestDist) {
          bestDist = d;
          bestFi = fi;
          bestVi = vi;
        }
      }
    }
    if (bestFi >= 0 && bestDist < T) {
      const v = allFaces[bestFi].verts[bestVi];
      if (Math.abs(v[2] - g.z) < T) g.z = v[2];
      if (Math.hypot(v[0] - g.x, v[1] - g.y) < T) {
        g.x = v[0];
        g.y = v[1];
      }
      gridDrag.snapFaceIdx = bestFi;
      gridDrag.snapVertIdx = bestVi;
    } else {
      gridDrag.snapFaceIdx = -1;
      gridDrag.snapVertIdx = -1;
    }
  };
  var pointInPolygon = (mx, my, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (yi > my !== yj > my && mx < (xj - xi) * (my - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  var faceCentroidDepth = (face) => {
    const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
    let d = 0;
    for (const v of face.verts) d += v[0] * cosA - v[1] * sinA + v[0] * sinA + v[1] * cosA;
    return d / face.verts.length;
  };
  var isDragging = false;
  var dragMoved = false;
  var lastMouse = { x: 0, y: 0 };
  var vertDrag = { active: false, vertIdx: -1, moved: false };
  var pivotDrag = { active: false, partId: null, moved: false };
  var hitTestVertex = (mx, my) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !state.def || !faces.length) return -1;
    const face = faces[state.selectedFaceIdx];
    if (!face) return -1;
    for (let i = 0; i < face.verts.length; i++) {
      const pt = localToScreen(face.verts[i][0], face.verts[i][1], face.verts[i][2]);
      if (Math.hypot(mx - pt.x, my - pt.y) < 8) return i;
    }
    return -1;
  };
  var syncVertRow = (face, i) => {
    const row = document.querySelector(`#vert-list .vert-row[data-i="${i}"]`);
    if (!row) return;
    const v = face.verts[i];
    row.querySelector(".vx").value = v[0].toFixed(3);
    row.querySelector(".vy").value = v[1].toFixed(3);
    row.querySelector(".vz").value = v[2].toFixed(3);
  };
  area.addEventListener("mousedown", (e) => {
    vertDrag.moved = false;
    pivotDrag.moved = false;
    gridDrag.moved = false;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    activeQ = getQuadrant(mx, my);
    lockedQ = activeQ;
    setRenderContext(lockedQ);
    const g = grids[lockedQ], gv = gridVs[lockedQ];
    const pid = hitTestPivot(mx, my, buildTestParams());
    if (pid && state.def?.parts?.find((p) => p.id === pid)?.rotate) {
      pivotDrag.active = true;
      pivotDrag.partId = pid;
      area.style.cursor = "ew-resize";
      lastMouse = { x: e.clientX, y: e.clientY };
      return;
    }
    const vi = hitTestVertex(mx, my);
    if (vi >= 0) {
      vertDrag.active = true;
      vertDrag.vertIdx = vi;
      area.style.cursor = "grabbing";
      if (state.selectedVertIdx !== vi) {
        state.selectedVertIdx = vi;
        renderFaceEditor();
        draw();
      }
    } else if (e.shiftKey && g.selected && g.visible && hitTestGrid(mx, my, g)) {
      gridDrag.active = true;
      gridDrag.target = "floor";
      gridDrag.quadrant = lockedQ;
      area.style.cursor = "grabbing";
    } else if (e.shiftKey && gv.selected && gv.visible && hitTestGridV(mx, my, gv)) {
      gridDrag.active = true;
      gridDrag.target = "wall";
      gridDrag.quadrant = lockedQ;
      area.style.cursor = "grabbing";
    } else {
      isDragging = true;
      dragMoved = false;
    }
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mouseup", () => {
    isDragging = false;
    vertDrag.active = false;
    pivotDrag.active = false;
    gridDrag.active = false;
    gridDrag.snapFaceIdx = -1;
    gridDrag.snapVertIdx = -1;
    area.style.cursor = "";
  });
  window.addEventListener("mousemove", (e) => {
    const dsx = e.clientX - lastMouse.x, dsy = e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };
    if (pivotDrag.active && pivotDrag.partId) {
      if (Math.abs(dsx) > 0) {
        state.partTestAngles[pivotDrag.partId] = (state.partTestAngles[pivotDrag.partId] ?? 0) + dsx * 0.015;
        pivotDrag.moved = true;
        const slider = document.querySelector(`#parts-list input[data-pid="${pivotDrag.partId}"]`);
        if (slider) {
          const val = state.partTestAngles[pivotDrag.partId];
          slider.value = String(val);
          const valEl = document.getElementById(`pval-${pivotDrag.partId}`);
          if (valEl) valEl.textContent = (val * 180 / Math.PI).toFixed(0) + "\xB0";
        }
        draw();
      }
      return;
    }
    if (vertDrag.active && state.selectedFaceIdx >= 0 && state.def) {
      setRenderContext(lockedQ);
      const face = getActiveFaces()[state.selectedFaceIdx];
      if (face && Math.abs(dsx) + Math.abs(dsy) > 0) {
        const v = face.verts[vertDrag.vertIdx];
        if (e.shiftKey) {
          v[2] -= dsy / (SH * renderZoom);
        } else {
          const tw2 = TW * renderZoom / 2, th2 = TH * renderZoom / 2;
          const dwx = (dsx / tw2 + dsy / th2) / 2, dwy = (dsy / th2 - dsx / tw2) / 2;
          const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
          v[0] += dwx * cosA + dwy * sinA;
          v[1] += -dwx * sinA + dwy * cosA;
        }
        vertDrag.moved = true;
        markDirty();
        syncVertRow(face, vertDrag.vertIdx);
        draw();
      }
      return;
    }
    if (gridDrag.active && Math.abs(dsx) + Math.abs(dsy) > 0) {
      setRenderContext(lockedQ);
      const g = gridDrag.target === "wall" ? gridVs[gridDrag.quadrant] : grids[gridDrag.quadrant];
      const tw2 = TW * renderZoom / 2;
      const dwx = dsx / tw2 / 2, dwy = -dsx / tw2 / 2;
      const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
      g.x += dwx * cosA + dwy * sinA;
      g.y += -dwx * sinA + dwy * cosA;
      g.z -= dsy / (SH * renderZoom);
      gridDrag.moved = true;
      snapGrid(gridDrag.quadrant);
      syncGridUI();
      draw();
      return;
    }
    if (isDragging) {
      if (Math.abs(dsx) + Math.abs(dsy) > 3) dragMoved = true;
      if (e.shiftKey && lockedQ !== GAME_VIEW_Q) {
        quads[lockedQ].angle = (quads[lockedQ].angle + dsx * 8e-3) % (Math.PI * 2);
        if (quads[lockedQ].angle < 0) quads[lockedQ].angle += Math.PI * 2;
      } else {
        quads[lockedQ].cam.x -= dsx;
        quads[lockedQ].cam.y -= dsy;
      }
      draw();
    }
  });
  area.addEventListener("mousemove", (e) => {
    if (vertDrag.active || isDragging || gridDrag.active || pivotDrag.active) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newQ = getQuadrant(mx, my);
    if (newQ !== activeQ) {
      activeQ = newQ;
      syncGridUI();
      draw();
    }
    setRenderContext(activeQ);
    if (hitTestVertex(mx, my) >= 0) {
      area.style.cursor = "grab";
      return;
    }
    if (hitTestPivot(mx, my, buildTestParams())) {
      area.style.cursor = "ew-resize";
      return;
    }
    const g = grids[activeQ], gv = gridVs[activeQ];
    if (g.visible && g.selected && e.shiftKey && hitTestGrid(mx, my, g)) {
      area.style.cursor = "grab";
      return;
    }
    if (gv.visible && gv.selected && e.shiftKey && hitTestGridV(mx, my, gv)) {
      area.style.cursor = "grab";
      return;
    }
    area.style.cursor = "";
  });
  area.addEventListener("click", (e) => {
    if (dragMoved || vertDrag.moved || gridDrag.moved || pivotDrag.moved) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setRenderContext(lockedQ);
    const g = grids[lockedQ], gv = gridVs[lockedQ];
    if (state.def) {
      const activeFaces = getActiveFaces();
      if (state.selectedFaceIdx >= 0) {
        const face = activeFaces[state.selectedFaceIdx];
        if (face) {
          for (let i = 0; i < face.verts.length; i++) {
            const pt = localToScreen(face.verts[i][0], face.verts[i][1], face.verts[i][2]);
            if (Math.hypot(mx - pt.x, my - pt.y) < 8) {
              state.selectedVertIdx = i;
              renderFaceEditor();
              draw();
              return;
            }
          }
        }
      }
      if (activeFaces.length) {
        const order = activeFaces.map((_, i) => i).sort((a, b) => faceCentroidDepth(activeFaces[b]) - faceCentroidDepth(activeFaces[a]));
        for (const i of order) {
          const f = activeFaces[i];
          if (f.normal) {
            const [nx, ny] = f.normal, cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
            if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
          }
          const pts = f.verts.map((v) => localToScreen(v[0], v[1], v[2]));
          if (pointInPolygon(mx, my, pts)) {
            selectFace(i);
            return;
          }
        }
      }
    }
    if (g.visible && hitTestGrid(mx, my, g)) {
      g.selected = true;
      draw();
      return;
    }
    if (gv.visible && hitTestGridV(mx, my, gv)) {
      gv.selected = true;
      draw();
      return;
    }
    if (g.selected) {
      g.selected = false;
      draw();
    } else if (gv.selected) {
      gv.selected = false;
      draw();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const g = grids[activeQ], gv = gridVs[activeQ];
      if (g.selected) {
        g.selected = false;
        draw();
      } else if (gv.selected) {
        gv.selected = false;
        draw();
      }
    }
  });
  area.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const q = getQuadrant(e.clientX - rect.left, e.clientY - rect.top);
    quads[q].zoom = Math.max(0.5, Math.min(20, quads[q].zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    draw();
  }, { passive: false });
  document.getElementById("preset-select").addEventListener("change", (e) => {
    const t = e.target;
    if (t.value) {
      loadPreset(t.value);
      t.value = "";
    }
  });
  document.getElementById("meta-id").addEventListener("input", (e) => {
    if (state.def) {
      state.def.id = e.target.value;
      markDirty();
    }
  });
  document.getElementById("meta-label").addEventListener("input", (e) => {
    state.meta.label = e.target.value;
    markDirty();
  });
  document.querySelectorAll('input[name="mobil"]').forEach((r) => {
    r.addEventListener("change", () => {
      state.meta.isStatic = document.getElementById("r-static").checked;
      document.getElementById("move-type-row").style.opacity = state.meta.isStatic ? "0.4" : "1";
      markDirty();
      draw();
    });
  });
  document.getElementById("move-type").addEventListener("change", (e) => {
    state.meta.movementType = e.target.value;
    markDirty();
  });
  document.getElementById("show-cboxes").addEventListener("change", () => draw());
  document.getElementById("face-id-input").addEventListener("input", (e) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].id = e.target.value;
    markDirty();
    renderFaceList();
  });
  var setupColorPair = (colorId, hexId, apply) => {
    document.getElementById(colorId).addEventListener("input", (e) => {
      const v = e.target.value;
      document.getElementById(hexId).value = v;
      apply(v);
    });
    document.getElementById(hexId).addEventListener("change", (e) => {
      const v = e.target.value.trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(v) || v.startsWith("rgba")) {
        document.getElementById(colorId).value = toColorInput(v);
        apply(v);
      }
    });
  };
  setupColorPair("face-color", "face-color-hex", (v) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].color = v;
    markDirty();
    renderFaceList();
    draw();
  });
  setupColorPair("face-stroke", "face-stroke-hex", (v) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    if (document.getElementById("face-has-stroke").checked) {
      faces[state.selectedFaceIdx].stroke = v;
      markDirty();
      draw();
    }
  });
  document.getElementById("face-has-stroke").addEventListener("change", (e) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].stroke = e.target.checked ? document.getElementById("face-stroke-hex").value || "#aaaaaa" : null;
    markDirty();
    draw();
  });
  document.getElementById("face-stroke-w").addEventListener("input", (e) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces[state.selectedFaceIdx].strokeWidth = parseFloat(e.target.value) || 1;
    markDirty();
    draw();
  });
  document.getElementById("face-has-normal").addEventListener("change", (e) => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    if (e.target.checked) {
      face.normal = [
        parseFloat(document.getElementById("face-nx").value) || 0,
        parseFloat(document.getElementById("face-ny").value) || 0
      ];
    } else {
      delete face.normal;
    }
    markDirty();
    draw();
  });
  ["face-nx", "face-ny"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      const faces = getActiveFaces();
      if (state.selectedFaceIdx < 0 || !faces.length || !document.getElementById("face-has-normal").checked) return;
      faces[state.selectedFaceIdx].normal = [
        parseFloat(document.getElementById("face-nx").value) || 0,
        parseFloat(document.getElementById("face-ny").value) || 0
      ];
      markDirty();
      draw();
    });
  });
  document.getElementById("btn-add-vert").addEventListener("click", () => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    face.verts.push([...face.verts[face.verts.length - 1] || [0, 0, 0]]);
    markDirty();
    renderFaceEditor();
    draw();
  });
  document.getElementById("btn-del-vert").addEventListener("click", () => {
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    const face = faces[state.selectedFaceIdx];
    if (face.verts.length <= 3) return;
    face.verts.pop();
    state.selectedVertIdx = Math.min(state.selectedVertIdx, face.verts.length - 1);
    markDirty();
    renderFaceEditor();
    draw();
  });
  document.getElementById("btn-del-face").addEventListener("click", () => {
    if (state.def2) {
      const allFaces = getActiveFaces();
      if (state.selectedFaceIdx < 0 || !allFaces.length) return;
      const found = _def2FindFaceNode(allFaces[state.selectedFaceIdx]);
      if (!found) return;
      found.node.faces.splice(found.localIdx, 1);
      const newFaces = getActiveFaces();
      state.selectedFaceIdx = Math.min(state.selectedFaceIdx, newFaces.length - 1);
      if (!newFaces.length) state.selectedFaceIdx = -1;
      state.selectedVertIdx = -1;
      markDirty();
      renderAll();
      return;
    }
    const faces = getActiveFaces();
    if (state.selectedFaceIdx < 0 || !faces.length) return;
    faces.splice(state.selectedFaceIdx, 1);
    state.selectedFaceIdx = Math.min(state.selectedFaceIdx, faces.length - 1);
    if (!faces.length) state.selectedFaceIdx = -1;
    state.selectedVertIdx = -1;
    markDirty();
    renderAll();
  });
  document.getElementById("btn-add-face").addEventListener("click", () => {
    if (!state.def) return;
    if (state.def2) {
      const allFaces = getActiveFaces();
      let targetNode = state.def2.nodes[0];
      if (state.selectedFaceIdx >= 0 && allFaces[state.selectedFaceIdx]) {
        const found = _def2FindFaceNode(allFaces[state.selectedFaceIdx]);
        if (found) targetNode = found.node;
      }
      if (!targetNode.faces) targetNode.faces = [];
      const newFace = { id: "face_" + allFaces.length, verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: "#1a4080" };
      targetNode.faces.push(newFace);
      state.selectedFaceIdx = getActiveFaces().indexOf(newFace);
      state.selectedVertIdx = -1;
      markDirty();
      renderAll();
      return;
    }
    const faces = getActiveFaces();
    faces.push({ id: "face_" + faces.length, verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: "#888888" });
    state.selectedFaceIdx = faces.length - 1;
    state.selectedVertIdx = -1;
    markDirty();
    renderAll();
  });
  document.getElementById("btn-add-cbox").addEventListener("click", () => {
    if (!state.def) return;
    if (!state.def.collisionBoxes) state.def.collisionBoxes = [];
    state.def.collisionBoxes.push({ id: "box_" + state.def.collisionBoxes.length, xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: 0, zMax: 1 });
    markDirty();
    renderCboxList();
    draw();
  });
  document.getElementById("btn-add-zone").addEventListener("click", () => {
    if (!state.def) return;
    if (!state.def.rescueZones) state.def.rescueZones = [];
    state.def.rescueZones.push({ x: 0, y: 0, w: 1.5, h: 1.5, z: 0, role: "both" });
    markDirty();
    renderZoneList();
    draw();
  });
  document.getElementById("btn-add-landing").addEventListener("click", () => {
    if (!state.def) return;
    state.def.landingZone = { x: 0, y: 0, w: 1.5, h: 1.5, z: 0 };
    markDirty();
    renderLandingZone();
    draw();
  });
  document.getElementById("btn-remove-landing").addEventListener("click", () => {
    if (!state.def) return;
    delete state.def.landingZone;
    markDirty();
    renderLandingZone();
    draw();
  });
  document.getElementById("grid-visible").addEventListener("change", (e) => {
    grids[activeQ].visible = e.target.checked;
    if (!grids[activeQ].visible) grids[activeQ].selected = false;
    draw();
  });
  document.getElementById("grid-x").addEventListener("input", (e) => {
    grids[activeQ].x = parseFloat(e.target.value) || 0;
    draw();
  });
  document.getElementById("grid-y").addEventListener("input", (e) => {
    grids[activeQ].y = parseFloat(e.target.value) || 0;
    draw();
  });
  document.getElementById("grid-z").addEventListener("input", (e) => {
    grids[activeQ].z = parseFloat(e.target.value) || 0;
    draw();
  });
  document.getElementById("gridv-visible").addEventListener("change", (e) => {
    gridVs[activeQ].visible = e.target.checked;
    if (!gridVs[activeQ].visible) gridVs[activeQ].selected = false;
    draw();
  });
  document.getElementById("gridv-x").addEventListener("input", (e) => {
    gridVs[activeQ].x = parseFloat(e.target.value) || 0;
    draw();
  });
  document.getElementById("gridv-y").addEventListener("input", (e) => {
    gridVs[activeQ].y = parseFloat(e.target.value) || 0;
    draw();
  });
  document.getElementById("gridv-z").addEventListener("input", (e) => {
    gridVs[activeQ].z = parseFloat(e.target.value) || 0;
    draw();
  });
  document.querySelectorAll(".quad-reset").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const q = parseInt(btn.dataset["q"] ?? "0");
      quads[q].angle = quads[q].defaultAngle;
      draw();
    });
  });
  document.querySelectorAll(".quad-grid-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const q = parseInt(btn.dataset["q"] ?? "0");
      const allOn = grids[q].visible || gridVs[q].visible;
      grids[q].visible = !allOn;
      gridVs[q].visible = !allOn;
      if (!grids[q].visible) grids[q].selected = false;
      if (!gridVs[q].visible) gridVs[q].selected = false;
      btn.classList.toggle("hidden", !grids[q].visible);
      syncGridUI();
      draw();
    });
  });
  var toJSON = () => {
    if (state.def2) {
      const out2 = {
        ...state.def2,
        label: state.meta.label,
        static: state.meta.isStatic,
        movementType: state.meta.movementType,
        collisionBoxes: state.def?.collisionBoxes ?? [],
        ...state.def?.rescueZones?.length ? { rescueZones: state.def.rescueZones } : {},
        ...state.def?.landingZone ? { landingZone: state.def.landingZone } : {}
      };
      return JSON.stringify(out2, null, 2);
    }
    const d = state.def;
    const out = {
      id: d.id,
      label: state.meta.label,
      static: state.meta.isStatic,
      movementType: state.meta.movementType,
      pivot: d.pivot || [0, 0, 0],
      faces: d.faces,
      collisionBoxes: d.collisionBoxes || []
    };
    if (d.parts?.length) out["parts"] = d.parts;
    if (d.fragments?.length) out["fragments"] = d.fragments;
    if (d.rescueZones?.length) out["rescueZones"] = d.rescueZones;
    if (d.landingZone) out["landingZone"] = d.landingZone;
    return JSON.stringify(out, null, 2);
  };
  var fromJSON = (content) => {
    const d = JSON.parse(content.replace(/\/\/[^\n]*/g, ""));
    if (d["version"] === 2) {
      state.def2 = d;
      state.def = {
        id: d["id"],
        faces: [],
        collisionBoxes: d["collisionBoxes"] || [],
        rescueZones: d["rescueZones"],
        landingZone: d["landingZone"]
      };
    } else {
      state.def2 = null;
      state.def = {
        id: d["id"],
        pivot: d["pivot"] || [0, 0, 0],
        faces: d["faces"] || [],
        collisionBoxes: d["collisionBoxes"] || [],
        parts: d["parts"],
        fragments: d["fragments"],
        rotateNodes: d["rotateNodes"],
        rescueZones: d["rescueZones"],
        landingZone: d["landingZone"]
      };
    }
    state.meta = {
      label: d["label"] || d["id"],
      isStatic: d["static"] !== false,
      movementType: d["movementType"] || "none"
    };
    state.selectedFaceIdx = -1;
    state.selectedVertIdx = -1;
    state.activePart = null;
    state.selectedFragmentIdx = -1;
    state.partTestAngles = {};
    state.dirty = false;
    syncMetaToUI();
    renderAll();
  };
  scheduleNotify = () => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      if (state.def) vscode.postMessage({ type: "change", content: toJSON() });
    }, 300);
  };
  window.addEventListener("message", (e) => {
    if (e.data.type === "load" && e.data.content !== void 0) fromJSON(e.data.content);
  });
  syncGridUI();
  draw();
  vscode.postMessage({ type: "ready" });
})();
//# sourceMappingURL=zdef.js.map
