"use strict";
(() => {
  // ../src/game/scene-renderer.ts
  var _POOL_SIZE = 2048;
  var _makeInst = () => ({
    def: null,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    colors: void 0,
    depth: 0,
    drawFn: null,
    group: 0,
    box: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 },
    sx0: 0,
    sx1: 0,
    sy0: 0,
    sy1: 0
  });
  var _EPS = 1e-4;
  var _CELL = 96;
  var _behind = (a, b) => a.x1 <= b.x0 + _EPS || a.y1 <= b.y0 + _EPS || a.z1 <= b.z0 + _EPS;
  var sortByBoxes = (boxes, rects, keys, groups) => {
    const n = boxes.length;
    const base = Array.from({ length: n }, (_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
    const rank = new Array(n);
    base.forEach((idx, r) => {
      rank[idx] = r;
    });
    const preds = Array.from({ length: n }, () => []);
    const cells = /* @__PURE__ */ new Map();
    const cellKey = (cx, cy) => cx * 73856093 ^ cy * 19349663;
    for (let i = 0; i < n; i++) {
      const r = rects[i];
      const cx0 = Math.floor(r.sx0 / _CELL), cx1 = Math.floor(r.sx1 / _CELL);
      const cy0 = Math.floor(r.sy0 / _CELL), cy1 = Math.floor(r.sy1 / _CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const k = cellKey(cx, cy);
          const list = cells.get(k);
          if (list) list.push(i);
          else cells.set(k, [i]);
        }
      }
    }
    for (const [, list] of cells) {
      for (let a = 0; a < list.length; a++) {
        const i = list[a], ri = rects[i];
        for (let b = a + 1; b < list.length; b++) {
          const j = list[b], rj = rects[j];
          if (ri.sx1 <= rj.sx0 || rj.sx1 <= ri.sx0 || ri.sy1 <= rj.sy0 || rj.sy1 <= ri.sy0) continue;
          const ox = Math.max(ri.sx0, rj.sx0), oy = Math.max(ri.sy0, rj.sy0);
          const home = cellKey(Math.floor(ox / _CELL), Math.floor(oy / _CELL));
          if (cells.get(home) !== list) continue;
          if (groups[i] !== 0 && groups[i] === groups[j]) continue;
          const ib = _behind(boxes[i], boxes[j]);
          const jb = _behind(boxes[j], boxes[i]);
          if (ib && !jb) preds[j].push(i);
          else if (jb && !ib) preds[i].push(j);
        }
      }
    }
    const order = [];
    const mark = new Uint8Array(n);
    const visit = (start) => {
      const stack = [start];
      const iter = [0];
      mark[start] = 1;
      while (stack.length) {
        const top = stack[stack.length - 1];
        const p = preds[top];
        if (iter[iter.length - 1] === 0 && p.length > 1) p.sort((a, b) => rank[a] - rank[b]);
        const k = iter[iter.length - 1];
        if (k < p.length) {
          iter[iter.length - 1] = k + 1;
          const nxt = p[k];
          if (mark[nxt] === 0) {
            mark[nxt] = 1;
            stack.push(nxt);
            iter.push(0);
          }
          continue;
        }
        mark[top] = 2;
        order.push(top);
        stack.pop();
        iter.pop();
      }
    };
    for (const idx of base) if (mark[idx] === 0) visit(idx);
    return order;
  };
  var _scratchPts = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));
  var _scratchIso = { x: 0, y: 0 };
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
    const _defBox = (inst, out) => {
      const def = inst.def;
      const pivot = def.pivot ?? [0, 0, 0];
      const cosA = Math.cos(inst.angle), sinA = Math.sin(inst.angle);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const face of def.faces) {
        for (const v of face.verts) {
          const dx = v[0] - pivot[0], dy = v[1] - pivot[1];
          const wx = dx * cosA - dy * sinA + inst.x;
          const wy = dx * sinA + dy * cosA + inst.y;
          const wz = v[2] - pivot[2] + inst.z;
          if (wx < x0) x0 = wx;
          if (wx > x1) x1 = wx;
          if (wy < y0) y0 = wy;
          if (wy > y1) y1 = wy;
          if (wz < z0) z0 = wz;
          if (wz > z1) z1 = wz;
        }
      }
      if (x0 === Infinity) {
        x0 = x1 = inst.x;
        y0 = y1 = inst.y;
        z0 = z1 = inst.z;
      }
      out.x0 = x0;
      out.x1 = x1;
      out.y0 = y0;
      out.y1 = y1;
      out.z0 = z0;
      out.z1 = z1;
    };
    const _screenRect = (inst, camX, camY) => {
      const b = inst.box;
      let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
      for (let c = 0; c < 8; c++) {
        const p = iso2(c & 1 ? b.x1 : b.x0, c & 2 ? b.y1 : b.y0, c & 4 ? b.z1 : b.z0, camX, camY, _scratchIso);
        if (p.x < sx0) sx0 = p.x;
        if (p.x > sx1) sx1 = p.x;
        if (p.y < sy0) sy0 = p.y;
        if (p.y > sy1) sy1 = p.y;
      }
      inst.sx0 = sx0 - 2;
      inst.sx1 = sx1 + 2;
      inst.sy0 = sy0 - 2;
      inst.sy1 = sy1 + 2;
    };
    const _drawInstance = (inst, camX, camY) => {
      if (inst.def) {
        const def = inst.def;
        const pivot = def.pivot ?? [0, 0, 0];
        const cosA = Math.cos(inst.angle), sinA = Math.sin(inst.angle);
        const p0 = pivot[0], p1 = pivot[1], p2 = pivot[2];
        for (const face of def.faces) {
          if (face.normal) {
            const [nx, ny] = face.normal;
            if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) <= 0) continue;
          } else if (face.normal3d) {
            const [nx, ny, nz] = face.normal3d;
            if (nx * cosA - ny * sinA + (nx * sinA + ny * cosA) + nz <= 0) continue;
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
    };
    const renderer = {
      drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color) {
        _drawCollisionBox(camX, camY, wX, wY, angle, xMin, xMax, yMin, yMax, zMin, zMax, color);
      },
      add(def, { x, y, z = 0, angle = 0, colors, drawFn, depth: depthOverride, bounds, group } = {}) {
        const inst = _poolNext < _POOL_SIZE ? _pool[_poolNext++] : _makeInst();
        inst.def = def;
        inst.x = x;
        inst.y = y;
        inst.z = z;
        inst.angle = angle;
        inst.colors = colors;
        inst.depth = depthOverride ?? x + y;
        inst.drawFn = drawFn ?? null;
        inst.group = group ?? 0;
        if (bounds) Object.assign(inst.box, bounds);
        else if (def) _defBox(inst, inst.box);
        else Object.assign(inst.box, { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z });
        _instances.push(inst);
      },
      flush(camX, camY) {
        const n = _instances.length;
        for (const inst of _instances) _screenRect(inst, camX, camY);
        const order = sortByBoxes(
          _instances.map((i) => i.box),
          _instances,
          _instances.map((i) => i.depth),
          _instances.map((i) => i.group)
        );
        for (let k = 0; k < n; k++) _drawInstance(_instances[order[k]], camX, camY);
        _instances.length = 0;
        _poolNext = 0;
      }
    };
    return renderer;
  };
  var _nextGroup = 1;
  var newRenderGroup = () => {
    _nextGroup = _nextGroup >= 1073741823 ? 1 : _nextGroup + 1;
    return _nextGroup;
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
  var _computeFaceNormal = (verts) => {
    if (verts.length < 3) return null;
    const ax = verts[1][0] - verts[0][0], ay = verts[1][1] - verts[0][1], az = verts[1][2] - verts[0][2];
    const bx = verts[2][0] - verts[0][0], by = verts[2][1] - verts[0][1], bz = verts[2][2] - verts[0][2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-9) return null;
    return [nx / len, ny / len, nz / len];
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
  var COLLAPSE_PARAM = "__collapse";
  var COLLAPSE_DIR_PARAM = "__collapseDir";
  var COLLAPSE_WIND_PARAM = "__collapseWind";
  var COLLAPSE_BURST_PARAM = "__collapseBurst";
  var COLLAPSE_DROP = 0.92;
  var collapseEase = (t) => t * t * (3 - 2 * t);
  var _hash01 = (i) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  var _makeCollapseFn = (verts, c, idx) => {
    const { e, windDir, wind } = c;
    let cx = 0, cy = 0, minZ = Infinity;
    for (const v of verts) {
      cx += v[0];
      cy += v[1];
      if (v[2] < minZ) minZ = v[2];
    }
    cx /= verts.length;
    cy /= verts.length;
    const dir = wind > 0 ? windDir + (_hash01(idx) - 0.5) * Math.PI * 2 * (1 - 0.8 * wind) : _hash01(idx) * Math.PI * 2;
    const tilt = e * (0.2 + 0.35 * _hash01(idx + 17));
    const axis = [-Math.sin(dir), Math.cos(dir), 0];
    const pivot = [cx, cy, minZ];
    const squash = 1 - COLLAPSE_DROP * e;
    const spread = 1 + 0.15 * e;
    return (vs) => _rotateVerts(vs, pivot, axis, tilt).map(([x, y, z]) => [x * spread, y * spread, z * squash]);
  };
  var _makeBurstFn = (verts, c, idx) => {
    const { t, e } = c;
    let cx = 0, cy = 0, cz = 0;
    for (const v of verts) {
      cx += v[0];
      cy += v[1];
      cz += v[2];
    }
    cx /= verts.length;
    cy /= verts.length;
    cz /= verts.length;
    const out = 1 - Math.pow(1 - t, 3);
    const len = Math.hypot(cx, cy);
    const dirA = len > 0.05 ? Math.atan2(cy, cx) + (_hash01(idx) - 0.5) * 0.8 : _hash01(idx) * Math.PI * 2;
    const dist = out * (1 + 2 * _hash01(idx + 3));
    const dx = Math.cos(dirA) * dist, dy = Math.sin(dirA) * dist;
    const hop = Math.sin(Math.PI * t) * (0.6 + 1.2 * _hash01(idx + 5));
    const spinA = _hash01(idx + 7) * Math.PI * 2;
    const axis = [Math.cos(spinA), Math.sin(spinA), 0];
    const spin = out * (0.8 + 2 * _hash01(idx + 11));
    const pivot = [cx, cy, cz];
    const squash = 1 - COLLAPSE_DROP * e;
    return (vs) => _rotateVerts(vs, pivot, axis, spin).map(([x, y, z]) => [x + dx, y + dy, z * squash + hop]);
  };
  var _collectNode = (node, params, parentFn, outFaces, outSpecial, autoNormal = false, collapse) => {
    const nodeFn = node.rotate ? _makeRotFn2(node, params, parentFn) : parentFn;
    let rotFn = nodeFn;
    if (collapse && node.faces?.length) {
      const own = node.faces.flatMap((f) => nodeFn(f.verts));
      const cFn = _makeCollapseFn(own, collapse, collapse.idx++);
      rotFn = (verts) => cFn(nodeFn(verts));
    }
    for (const face of node.faces ?? []) {
      if (face.type === "line") {
        const [v0, v1] = rotFn([face.verts[0], face.verts[1]]);
        outSpecial.push({ kind: "line", v0, v1, face });
      } else {
        let rotVerts;
        if (collapse?.burst) {
          const base = nodeFn(face.verts);
          rotVerts = _makeBurstFn(base, collapse, collapse.idx++)(base);
        } else {
          rotVerts = rotFn(face.verts);
        }
        const shade = face.shade ?? _autoShade(rotVerts);
        const color = _applyShade(face.color, shade);
        const normal = face.normal ? _rotNorm(face.normal, rotFn) : void 0;
        const normal3d = autoNormal && normal === void 0 ? _computeFaceNormal(rotVerts) ?? void 0 : void 0;
        outFaces.push({
          ...face,
          verts: rotVerts,
          color,
          ...normal !== void 0 ? { normal } : {},
          ...normal3d !== void 0 ? { normal3d } : {}
        });
      }
    }
    for (const light of node.lights ?? []) {
      const [rl] = rotFn([[light.x, light.y, light.z]]);
      outSpecial.push({ kind: "light", lx: rl[0], ly: rl[1], lz: rl[2], light });
    }
    for (const child of node.children ?? []) {
      _collectNode(child, params, nodeFn, outFaces, outSpecial, autoNormal, collapse);
    }
  };
  var _collapseState = (params) => {
    const t = params[COLLAPSE_PARAM] ?? 0;
    if (t <= 0) return void 0;
    const wind = Math.max(0, Math.min(1, params[COLLAPSE_WIND_PARAM] ?? 0));
    return {
      t,
      e: collapseEase(t),
      idx: 0,
      windDir: params[COLLAPSE_DIR_PARAM] ?? 0,
      wind,
      burst: (params[COLLAPSE_BURST_PARAM] ?? 0) > 0
    };
  };
  var _hasRotate = (node) => !!node.rotate || (node.children ?? []).some(_hasRotate);
  var renderNodes = (def, params, instanceProps, renderer, drawCtx) => {
    const { x: ix, y: iy, z: iz = 0, angle: iAngle = 0 } = instanceProps;
    const cosA = Math.cos(iAngle), sinA = Math.sin(iAngle);
    const autoNormal = def.version === 3;
    const collapse = _collapseState(params);
    for (const topNode of def.nodes) {
      const faces = [];
      const special = [];
      _collectNode(topNode, params, _id2, faces, special, autoNormal, collapse);
      let baseDepth = ix + iy;
      if (topNode.depthAnchor) {
        const [dx, dy, dz = 0] = topNode.depthAnchor;
        baseDepth = ix + dx * cosA - dy * sinA + (iy + dx * sinA + dy * cosA) + (iz + dz);
      }
      if (collapse || _hasRotate(topNode)) {
        const cApS = cosA + sinA, cAmS = cosA - sinA;
        const allFaces = [];
        faces.forEach((face, fi) => {
          const verts = face.verts;
          let lcx = 0, lcy = 0, lcz = 0;
          for (const v of verts) {
            lcx += v[0];
            lcy += v[1];
            lcz += v[2];
          }
          lcx /= verts.length;
          lcy /= verts.length;
          lcz /= verts.length;
          allFaces.push({ face, key: lcx * cApS + lcy * cAmS + lcz + fi * 1e-9 });
        });
        allFaces.sort((a, b) => a.key - b.key);
        const group = newRenderGroup();
        for (let si = 0; si < allFaces.length; si++) {
          renderer.add({ id: def.id, faces: [allFaces[si].face] }, { ...instanceProps, depth: baseDepth + si * 1e-7, group });
        }
      } else if (faces.length) {
        renderer.add({ id: def.id, faces }, { ...instanceProps, depth: baseDepth });
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
              bounds: {
                x0: Math.min(wx0, wx1),
                x1: Math.max(wx0, wx1),
                y0: Math.min(wy0, wy1),
                y1: Math.max(wy0, wy1),
                z0: Math.min(wz0, wz1),
                z1: Math.max(wz0, wz1)
              },
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
    }
  };

  // ../src/game/models/objects/hangar.zdef
  var hangar_default = {
    version: 3,
    id: "hangar",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -2,
        xMax: 2,
        yMin: -1,
        yMax: 1,
        zMin: 0,
        zMax: 2
      }
    ],
    nodes: [
      {
        faces: [
          {
            id: "back_int",
            verts: [
              [
                2,
                -1,
                0
              ],
              [
                -2,
                -1,
                0
              ],
              [
                -2,
                -1,
                2
              ],
              [
                2,
                -1,
                2
              ]
            ],
            color: "#888888"
          },
          {
            id: "right_int",
            verts: [
              [
                2,
                -1,
                2
              ],
              [
                2,
                1,
                2
              ],
              [
                2,
                1,
                0
              ],
              [
                2,
                -1,
                0
              ]
            ],
            color: "#999999"
          },
          {
            id: "left_int",
            verts: [
              [
                -2,
                1,
                2
              ],
              [
                -2,
                -1,
                2
              ],
              [
                -2,
                -1,
                0
              ],
              [
                -2,
                1,
                0
              ]
            ],
            color: "#aaaaaa"
          },
          {
            id: "back_ext",
            verts: [
              [
                -2,
                -1,
                0
              ],
              [
                2,
                -1,
                0
              ],
              [
                2,
                -1,
                2
              ],
              [
                -2,
                -1,
                2
              ]
            ],
            color: "#999999"
          },
          {
            id: "right_ext",
            verts: [
              [
                2,
                1,
                2
              ],
              [
                2,
                -1,
                2
              ],
              [
                2,
                -1,
                0
              ],
              [
                2,
                1,
                0
              ]
            ],
            color: "#aaaaaa"
          },
          {
            id: "left_ext",
            verts: [
              [
                -2,
                -1,
                2
              ],
              [
                -2,
                1,
                2
              ],
              [
                -2,
                1,
                0
              ],
              [
                -2,
                -1,
                0
              ]
            ],
            color: "#cccccc"
          },
          {
            id: "cross_h",
            verts: [
              [
                0.1,
                -0.65,
                0.01
              ],
              [
                -0.1,
                -0.65,
                0.01
              ],
              [
                -0.1,
                0.65,
                0.01
              ],
              [
                0.1,
                0.65,
                0.01
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "cross_v",
            verts: [
              [
                0.65,
                -0.1,
                0.01
              ],
              [
                -0.65,
                -0.1,
                0.01
              ],
              [
                -0.65,
                0.1,
                0.01
              ],
              [
                0.65,
                0.1,
                0.01
              ]
            ],
            color: "#ffcc00"
          },
          {
            id: "gb1_side",
            verts: [
              [
                -1.9,
                -0.25,
                0
              ],
              [
                -1.6,
                -0.25,
                0
              ],
              [
                -1.6,
                -0.25,
                0.45
              ],
              [
                -1.9,
                -0.25,
                0.45
              ]
            ],
            color: "#4a6230"
          },
          {
            id: "gb1_front",
            verts: [
              [
                -1.6,
                -0.55,
                0
              ],
              [
                -1.6,
                -0.25,
                0
              ],
              [
                -1.6,
                -0.25,
                0.45
              ],
              [
                -1.6,
                -0.55,
                0.45
              ]
            ],
            color: "#3d5228"
          },
          {
            id: "gb1_top",
            verts: [
              [
                -1.9,
                -0.55,
                0.45
              ],
              [
                -1.6,
                -0.55,
                0.45
              ],
              [
                -1.6,
                -0.25,
                0.45
              ],
              [
                -1.9,
                -0.25,
                0.45
              ]
            ],
            color: "#5a7238"
          },
          {
            id: "gb2_side",
            verts: [
              [
                -1.9,
                0.3,
                0
              ],
              [
                -1.6,
                0.3,
                0
              ],
              [
                -1.6,
                0.3,
                0.45
              ],
              [
                -1.9,
                0.3,
                0.45
              ]
            ],
            color: "#4a6230"
          },
          {
            id: "gb2_front",
            verts: [
              [
                -1.6,
                0,
                0
              ],
              [
                -1.6,
                0.3,
                0
              ],
              [
                -1.6,
                0.3,
                0.45
              ],
              [
                -1.6,
                0,
                0.45
              ]
            ],
            color: "#3d5228"
          },
          {
            id: "gb2_top",
            verts: [
              [
                -1.9,
                0,
                0.45
              ],
              [
                -1.9,
                0.3,
                0.45
              ],
              [
                -1.6,
                0.3,
                0.45
              ],
              [
                -1.6,
                0,
                0.45
              ]
            ],
            color: "#5a7238"
          },
          {
            id: "yba_s0",
            verts: [
              [
                -1.62,
                -0.75,
                0
              ],
              [
                -1.685,
                -0.637,
                0
              ],
              [
                -1.685,
                -0.637,
                0.45
              ],
              [
                -1.62,
                -0.75,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "yba_s1",
            verts: [
              [
                -1.685,
                -0.637,
                0
              ],
              [
                -1.815,
                -0.637,
                0
              ],
              [
                -1.815,
                -0.637,
                0.45
              ],
              [
                -1.685,
                -0.637,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "yba_s5",
            verts: [
              [
                -1.685,
                -0.863,
                0
              ],
              [
                -1.62,
                -0.75,
                0
              ],
              [
                -1.62,
                -0.75,
                0.45
              ],
              [
                -1.685,
                -0.863,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "yba_top",
            verts: [
              [
                -1.62,
                -0.75,
                0.45
              ],
              [
                -1.685,
                -0.637,
                0.45
              ],
              [
                -1.815,
                -0.637,
                0.45
              ],
              [
                -1.88,
                -0.75,
                0.45
              ],
              [
                -1.815,
                -0.863,
                0.45
              ],
              [
                -1.685,
                -0.863,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "ybb_s0",
            verts: [
              [
                -1.62,
                0.55,
                0
              ],
              [
                -1.685,
                0.663,
                0
              ],
              [
                -1.685,
                0.663,
                0.45
              ],
              [
                -1.62,
                0.55,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "ybb_s1",
            verts: [
              [
                -1.685,
                0.663,
                0
              ],
              [
                -1.815,
                0.663,
                0
              ],
              [
                -1.815,
                0.663,
                0.45
              ],
              [
                -1.685,
                0.663,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "ybb_s5",
            verts: [
              [
                -1.685,
                0.437,
                0
              ],
              [
                -1.62,
                0.55,
                0
              ],
              [
                -1.62,
                0.55,
                0.45
              ],
              [
                -1.685,
                0.437,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "ybb_top",
            verts: [
              [
                -1.62,
                0.55,
                0.45
              ],
              [
                -1.685,
                0.663,
                0.45
              ],
              [
                -1.815,
                0.663,
                0.45
              ],
              [
                -1.88,
                0.55,
                0.45
              ],
              [
                -1.815,
                0.437,
                0.45
              ],
              [
                -1.685,
                0.437,
                0.45
              ]
            ],
            color: "#e8c020"
          },
          {
            id: "roof",
            verts: [
              [
                2,
                -1,
                2
              ],
              [
                2,
                1,
                2
              ],
              [
                -2,
                1,
                2
              ],
              [
                -2,
                -1,
                2
              ]
            ],
            color: "#dddddd"
          },
          {
            id: "roof_edge",
            verts: [
              [
                2,
                1,
                1.85
              ],
              [
                -2,
                1,
                1.85
              ],
              [
                -2,
                1,
                2
              ],
              [
                2,
                1,
                2
              ]
            ],
            color: "#555"
          }
        ]
      }
    ]
  };

  // ../src/game/models/objects/lighthouse.zdef
  var lighthouse_default = {
    version: 3,
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
    nodes: [
      {
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
      }
    ]
  };

  // ../src/game/models/sailboat.zdef
  var sailboat_default = {
    version: 3,
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
    nodes: [
      {
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
            verts: [
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
                -1.1,
                0.35,
                0
              ],
              [
                -1.1,
                -0.35,
                0
              ]
            ],
            color: "#ddd"
          },
          {
            id: "stbd_lower_bow",
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
                0
              ],
              [
                1.3,
                0,
                0
              ]
            ],
            color: "#a33"
          },
          {
            id: "stbd_lower_mid",
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
                0
              ],
              [
                0.2,
                -0.45,
                0
              ]
            ],
            color: "#922"
          },
          {
            id: "stbd_upper_bow",
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
            color: "#fff"
          },
          {
            id: "stbd_upper_mid",
            verts: [
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
                -0.35,
                0.1
              ],
              [
                0.2,
                -0.45,
                0.1
              ]
            ],
            color: "#eee"
          },
          {
            id: "port_bow",
            verts: [
              [
                1.3,
                0,
                0.35
              ],
              [
                0.2,
                0.45,
                0.35
              ],
              [
                0.2,
                0.45,
                0
              ],
              [
                1.3,
                0,
                0
              ]
            ],
            color: "#eee"
          },
          {
            id: "port_mid",
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
      }
    ]
  };

  // ../src/game/models/coasthawk.zdef
  var coasthawk_default = {
    version: 3,
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
    nodes: [
      {
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
      }
    ]
  };

  // ../src/game/models/dolphin.zdef
  var dolphin_default = {
    version: 3,
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
    nodes: [
      {
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
      }
    ]
  };

  // ../src/game/models/atlas.zdef
  var atlas_default = {
    version: 3,
    id: "atlas",
    pivot: [
      0,
      0,
      0
    ],
    collisionBoxes: [
      {
        id: "body",
        xMin: -2.6,
        xMax: 2.8,
        yMin: -0.6,
        yMax: 0.6,
        zMin: 0,
        zMax: 1.8
      }
    ],
    nodes: [
      {
        faces: [
          {
            id: "bottom",
            verts: [
              [
                1.8,
                0.3,
                0.15
              ],
              [
                1.8,
                -0.3,
                0.15
              ],
              [
                -2,
                -0.3,
                0.15
              ],
              [
                -2,
                0.3,
                0.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_left_lower",
            verts: [
              [
                1.8,
                0.3,
                0.15
              ],
              [
                1.8,
                0.6,
                0.5
              ],
              [
                -2,
                0.6,
                0.5
              ],
              [
                -2,
                0.3,
                0.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_right_lower",
            verts: [
              [
                1.8,
                -0.3,
                0.15
              ],
              [
                1.8,
                -0.6,
                0.5
              ],
              [
                -2,
                -0.6,
                0.5
              ],
              [
                -2,
                -0.3,
                0.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_left_upper_front",
            verts: [
              [
                1.8,
                0.6,
                0.5
              ],
              [
                1.8,
                0.3,
                0.85
              ],
              [
                1.4,
                0.3,
                0.85
              ],
              [
                1.4,
                0.6,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_left_upper_back",
            verts: [
              [
                0.9,
                0.6,
                0.5
              ],
              [
                0.9,
                0.3,
                0.85
              ],
              [
                -2,
                0.3,
                0.85
              ],
              [
                -2,
                0.6,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_right_upper_front",
            verts: [
              [
                1.8,
                -0.6,
                0.5
              ],
              [
                1.8,
                -0.3,
                0.85
              ],
              [
                1.4,
                -0.3,
                0.85
              ],
              [
                1.4,
                -0.6,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "side_right_upper_back",
            verts: [
              [
                0.9,
                -0.6,
                0.5
              ],
              [
                0.9,
                -0.3,
                0.85
              ],
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2,
                -0.6,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "tail_left",
            verts: [
              [
                -2,
                0.6,
                0.5
              ],
              [
                -2,
                0.3,
                0.85
              ],
              [
                -2.6,
                0,
                1.1
              ],
              [
                -2.6,
                0,
                0.4
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "tail_right",
            verts: [
              [
                -2,
                -0.6,
                0.5
              ],
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2.6,
                0,
                1.1
              ],
              [
                -2.6,
                0,
                0.4
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "chinook_nose_bottom",
            verts: [
              [
                1.8,
                -0.3,
                0.15
              ],
              [
                1.8,
                0.3,
                0.15
              ],
              [
                2.4,
                0.3,
                0.15
              ],
              [
                2.7,
                0,
                0.25
              ],
              [
                2.4,
                -0.3,
                0.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "chinook_nose_lower_left",
            verts: [
              [
                1.8,
                0.3,
                0.15
              ],
              [
                2.4,
                0.3,
                0.15
              ],
              [
                2.4,
                0.5,
                0.5
              ],
              [
                1.8,
                0.6,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "chinook_nose_lower_right",
            verts: [
              [
                1.8,
                -0.3,
                0.15
              ],
              [
                1.8,
                -0.6,
                0.5
              ],
              [
                2.4,
                -0.5,
                0.5
              ],
              [
                2.4,
                -0.3,
                0.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "chinook_nose_front_under",
            verts: [
              [
                2.4,
                0.3,
                0.15
              ],
              [
                2.7,
                0,
                0.25
              ],
              [
                2.4,
                -0.3,
                0.15
              ],
              [
                2.4,
                -0.5,
                0.5
              ],
              [
                2.4,
                0.5,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "chinook_nose_bump",
            verts: [
              [
                2.7,
                0,
                0.25
              ],
              [
                2.4,
                0.5,
                0.5
              ],
              [
                2.3,
                0.3,
                0.6
              ],
              [
                2.3,
                -0.3,
                0.6
              ],
              [
                2.4,
                -0.5,
                0.5
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "cockpit_front",
            verts: [
              [
                2.3,
                0.27,
                0.6
              ],
              [
                2.3,
                -0.27,
                0.6
              ],
              [
                1.8,
                -0.27,
                0.85
              ],
              [
                1.8,
                0.27,
                0.85
              ]
            ],
            color: "#111111"
          },
          {
            id: "cockpit_left",
            verts: [
              [
                2.4,
                0.5,
                0.5
              ],
              [
                2.3,
                0.33,
                0.6
              ],
              [
                1.8,
                0.33,
                0.85
              ],
              [
                1.8,
                0.6,
                0.5
              ]
            ],
            color: "#111111"
          },
          {
            id: "cockpit_right",
            verts: [
              [
                2.4,
                -0.5,
                0.5
              ],
              [
                1.8,
                -0.6,
                0.5
              ],
              [
                1.8,
                -0.33,
                0.85
              ],
              [
                2.3,
                -0.33,
                0.6
              ]
            ],
            color: "#111111"
          },
          {
            id: "cockpit_frame_left",
            verts: [
              [
                2.3,
                0.33,
                0.6
              ],
              [
                2.3,
                0.27,
                0.6
              ],
              [
                1.8,
                0.27,
                0.85
              ],
              [
                1.8,
                0.33,
                0.85
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "cockpit_frame_right",
            verts: [
              [
                2.3,
                -0.27,
                0.6
              ],
              [
                2.3,
                -0.33,
                0.6
              ],
              [
                1.8,
                -0.33,
                0.85
              ],
              [
                1.8,
                -0.27,
                0.85
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "window_left",
            verts: [
              [
                1.4,
                0.6,
                0.5
              ],
              [
                0.9,
                0.6,
                0.5
              ],
              [
                0.9,
                0.3,
                0.85
              ],
              [
                1.4,
                0.3,
                0.85
              ]
            ],
            color: "#111111"
          },
          {
            id: "window_right",
            verts: [
              [
                1.4,
                -0.6,
                0.5
              ],
              [
                0.9,
                -0.6,
                0.5
              ],
              [
                0.9,
                -0.3,
                0.85
              ],
              [
                1.4,
                -0.3,
                0.85
              ]
            ],
            color: "#111111"
          },
          {
            id: "fpylon_front",
            verts: [
              [
                1.8,
                0.3,
                0.85
              ],
              [
                1.8,
                -0.3,
                0.85
              ],
              [
                1.5,
                0,
                1.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "fpylon_right",
            verts: [
              [
                1.8,
                -0.3,
                0.85
              ],
              [
                1.2,
                -0.3,
                0.85
              ],
              [
                1.5,
                0,
                1.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "fpylon_back",
            verts: [
              [
                1.2,
                -0.3,
                0.85
              ],
              [
                1.2,
                0.3,
                0.85
              ],
              [
                1.5,
                0,
                1.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "fpylon_left",
            verts: [
              [
                1.2,
                0.3,
                0.85
              ],
              [
                1.8,
                0.3,
                0.85
              ],
              [
                1.5,
                0,
                1.15
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "tail_roof",
            verts: [
              [
                -2,
                0.3,
                0.85
              ],
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2.6,
                0,
                1.1
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "top",
            verts: [
              [
                1.8,
                0.3,
                0.85
              ],
              [
                1.8,
                -0.3,
                0.85
              ],
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2,
                0.3,
                0.85
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "rpylon_front",
            verts: [
              [
                -2,
                0.3,
                0.85
              ],
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2.3,
                0,
                1.8
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "rpylon_right",
            verts: [
              [
                -2,
                -0.3,
                0.85
              ],
              [
                -2.6,
                0,
                1.1
              ],
              [
                -2.3,
                0,
                1.8
              ]
            ],
            color: "#ff6600"
          },
          {
            id: "rpylon_left",
            verts: [
              [
                -2.6,
                0,
                1.1
              ],
              [
                -2,
                0.3,
                0.85
              ],
              [
                -2.3,
                0,
                1.8
              ]
            ],
            color: "#ff6600"
          }
        ]
      }
    ]
  };

  // ../src/game/models/objects/glider.zdef
  var glider_default = {
    version: 3,
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
    nodes: [
      {
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
      }
    ]
  };

  // ../src/game/models/submarine.zdef
  var submarine_default = {
    version: 3,
    id: "submarine",
    label: "submarine",
    static: true,
    movementType: "none",
    pivot: [
      0,
      0,
      0
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
    ],
    nodes: [
      {
        faces: [
          {
            id: "keel",
            verts: [
              [
                -4.5,
                0.6,
                0
              ],
              [
                4.5,
                0.6,
                0
              ],
              [
                4.5,
                -0.6,
                0
              ],
              [
                -4.5,
                -0.6,
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
            verts: [
              [
                4.5,
                0.7,
                0.25
              ],
              [
                5.6,
                0,
                0.25
              ],
              [
                5.6,
                0,
                0
              ],
              [
                4.5,
                0.7,
                0
              ]
            ],
            color: "#0b0b0b"
          },
          {
            id: "bow_port",
            verts: [
              [
                5.6,
                0,
                0.25
              ],
              [
                4.5,
                -0.7,
                0.25
              ],
              [
                4.5,
                -0.7,
                0
              ],
              [
                5.6,
                0,
                0
              ]
            ],
            color: "#080808"
          },
          {
            id: "stern_starboard",
            verts: [
              [
                -4.5,
                0.7,
                0.25
              ],
              [
                -5.2,
                0.2,
                0.25
              ],
              [
                -5.2,
                0.2,
                0
              ],
              [
                -4.5,
                0.7,
                0
              ]
            ],
            color: "#060606"
          },
          {
            id: "stern_port",
            verts: [
              [
                -5.2,
                -0.2,
                0.25
              ],
              [
                -4.5,
                -0.7,
                0.25
              ],
              [
                -4.5,
                -0.7,
                0
              ],
              [
                -5.2,
                -0.2,
                0
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
        depthAnchor: [
          -5.6,
          0
        ]
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
    version: 3,
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
    nodes: [
      {
        faces: [
          {
            id: "keel",
            verts: [
              [
                -8.7,
                -2.52,
                0
              ],
              [
                -8.7,
                2.52,
                0
              ],
              [
                8.7,
                2.52,
                0
              ],
              [
                8.7,
                -2.52,
                0
              ]
            ],
            color: "#0a0a14"
          },
          {
            id: "hull_bow",
            verts: [
              [
                8.7,
                -2.52,
                0
              ],
              [
                8.7,
                2.52,
                0
              ],
              [
                8.7,
                4.2,
                3.8
              ],
              [
                8.7,
                -4.2,
                3.8
              ]
            ],
            color: "#2a3a4a"
          },
          {
            id: "hull_starboard",
            verts: [
              [
                8.7,
                2.52,
                0
              ],
              [
                -8.7,
                2.52,
                0
              ],
              [
                -8.7,
                4.2,
                3.8
              ],
              [
                8.7,
                4.2,
                3.8
              ]
            ],
            color: "#3a4a5a"
          },
          {
            id: "hull_stern",
            verts: [
              [
                -8.7,
                2.52,
                0
              ],
              [
                -8.7,
                -2.52,
                0
              ],
              [
                -8.7,
                -4.2,
                3.8
              ],
              [
                -8.7,
                4.2,
                3.8
              ]
            ],
            color: "#2a3a4a"
          },
          {
            id: "hull_port",
            verts: [
              [
                -8.7,
                -2.52,
                0
              ],
              [
                8.7,
                -2.52,
                0
              ],
              [
                8.7,
                -4.2,
                3.8
              ],
              [
                -8.7,
                -4.2,
                3.8
              ]
            ],
            color: "#223344"
          },
          {
            id: "deck_base",
            verts: [
              [
                8.7,
                -4.2,
                3.8
              ],
              [
                8.7,
                4.2,
                3.8
              ],
              [
                -8.7,
                4.2,
                3.8
              ],
              [
                -8.7,
                -4.2,
                3.8
              ]
            ],
            color: "#222222"
          },
          {
            id: "deck_bow",
            verts: [
              [
                8.7,
                -4.2,
                3.8
              ],
              [
                8.7,
                4.2,
                3.8
              ],
              [
                8.7,
                4.2,
                4.2
              ],
              [
                8.7,
                -4.2,
                4.2
              ]
            ],
            color: "#2a2a33"
          },
          {
            id: "deck_starboard",
            verts: [
              [
                8.7,
                4.2,
                3.8
              ],
              [
                -8.7,
                4.2,
                3.8
              ],
              [
                -8.7,
                4.2,
                4.2
              ],
              [
                8.7,
                4.2,
                4.2
              ]
            ],
            color: "#333333"
          },
          {
            id: "deck_stern",
            verts: [
              [
                -8.7,
                4.2,
                3.8
              ],
              [
                -8.7,
                -4.2,
                3.8
              ],
              [
                -8.7,
                -4.2,
                4.2
              ],
              [
                -8.7,
                4.2,
                4.2
              ]
            ],
            color: "#2a2a33"
          },
          {
            id: "deck_port",
            verts: [
              [
                -8.7,
                -4.2,
                3.8
              ],
              [
                8.7,
                -4.2,
                3.8
              ],
              [
                8.7,
                -4.2,
                4.2
              ],
              [
                -8.7,
                -4.2,
                4.2
              ]
            ],
            color: "#222222"
          },
          {
            id: "flight_deck",
            verts: [
              [
                8.7,
                -4.2,
                4.2
              ],
              [
                8.7,
                4.2,
                4.2
              ],
              [
                -8.7,
                4.2,
                4.2
              ],
              [
                -8.7,
                -4.2,
                4.2
              ]
            ],
            color: "#3a3a44"
          },
          {
            id: "pad_bow",
            verts: [
              [
                5.9,
                -3.7,
                4.21
              ],
              [
                5.9,
                -0.9,
                4.21
              ],
              [
                3.1,
                -0.9,
                4.21
              ],
              [
                3.1,
                -3.7,
                4.21
              ]
            ],
            color: "#52526a"
          },
          {
            id: "pad_mid",
            verts: [
              [
                1.4,
                -3.7,
                4.21
              ],
              [
                1.4,
                -0.9,
                4.21
              ],
              [
                -1.4,
                -0.9,
                4.21
              ],
              [
                -1.4,
                -3.7,
                4.21
              ]
            ],
            color: "#52526a"
          },
          {
            id: "pad_stern",
            verts: [
              [
                -3.1,
                -3.7,
                4.21
              ],
              [
                -3.1,
                -0.9,
                4.21
              ],
              [
                -5.9,
                -0.9,
                4.21
              ],
              [
                -5.9,
                -3.7,
                4.21
              ]
            ],
            color: "#52526a"
          }
        ]
      }
    ]
  };

  // ../src/game/models/carrier_tower.zdef
  var carrier_tower_default = {
    version: 3,
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
    nodes: [
      {
        faces: [
          {
            id: "tower_bow",
            verts: [
              [
                -1,
                2.6,
                4.2
              ],
              [
                -1,
                4.1,
                4.2
              ],
              [
                -1,
                4.1,
                6.7
              ],
              [
                -1,
                2.6,
                6.7
              ]
            ],
            color: "#555555"
          },
          {
            id: "tower_starboard",
            verts: [
              [
                -1,
                4.1,
                4.2
              ],
              [
                -5.5,
                4.1,
                4.2
              ],
              [
                -5.5,
                4.1,
                6.7
              ],
              [
                -1,
                4.1,
                6.7
              ]
            ],
            color: "#444444"
          },
          {
            id: "tower_stern",
            verts: [
              [
                -5.5,
                2.6,
                6.7
              ],
              [
                -5.5,
                4.1,
                6.7
              ],
              [
                -5.5,
                4.1,
                4.2
              ],
              [
                -5.5,
                2.6,
                4.2
              ]
            ],
            color: "#333333"
          },
          {
            id: "tower_port",
            verts: [
              [
                -1,
                2.6,
                6.7
              ],
              [
                -5.5,
                2.6,
                6.7
              ],
              [
                -5.5,
                2.6,
                4.2
              ],
              [
                -1,
                2.6,
                4.2
              ]
            ],
            color: "#444444"
          },
          {
            id: "tower_roof",
            verts: [
              [
                -1,
                2.6,
                6.7
              ],
              [
                -1,
                4.1,
                6.7
              ],
              [
                -5.5,
                4.1,
                6.7
              ],
              [
                -5.5,
                2.6,
                6.7
              ]
            ],
            color: "#222222"
          }
        ]
      }
    ]
  };

  // ../src/game/models/fuel_truck.zdef
  var fuel_truck_default = {
    version: 3,
    id: "fuel_truck",
    label: "Fuel Truck",
    static: false,
    movementType: "auto",
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
    nodes: [
      {
        depthAnchor: [
          0,
          0,
          -3
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
            color: "#3a6a3a"
          },
          {
            id: "ch_front",
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
            color: "#3a6a3a"
          },
          {
            id: "ch_rear",
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
            color: "#3a6a3a"
          },
          {
            id: "ch_right",
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
            color: "#3a6a3a"
          },
          {
            id: "ch_left",
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
            color: "#3a6a3a"
          },
          {
            id: "wrl",
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
            verts: [
              [
                0.55,
                0.45,
                0
              ],
              [
                0.25,
                0.45,
                0
              ],
              [
                0.25,
                0.45,
                0.22
              ],
              [
                0.55,
                0.45,
                0.22
              ]
            ],
            color: "#1a2e1a"
          }
        ],
        children: [
          {
            rotate: {
              pivot: [
                1.8,
                -0.45,
                0.11
              ],
              axis: [
                0,
                0,
                1
              ],
              param: "steerAngle"
            },
            faces: [
              {
                id: "wfl",
                verts: [
                  [
                    1.65,
                    -0.45,
                    0
                  ],
                  [
                    1.95,
                    -0.45,
                    0
                  ],
                  [
                    1.95,
                    -0.45,
                    0.22
                  ],
                  [
                    1.65,
                    -0.45,
                    0.22
                  ]
                ],
                color: "#1a2e1a"
              }
            ]
          },
          {
            rotate: {
              pivot: [
                1.8,
                0.45,
                0.11
              ],
              axis: [
                0,
                0,
                1
              ],
              param: "steerAngle"
            },
            faces: [
              {
                id: "wfr",
                verts: [
                  [
                    1.95,
                    0.45,
                    0
                  ],
                  [
                    1.65,
                    0.45,
                    0
                  ],
                  [
                    1.65,
                    0.45,
                    0.22
                  ],
                  [
                    1.95,
                    0.45,
                    0.22
                  ]
                ],
                color: "#1a2e1a"
              }
            ]
          }
        ]
      },
      {
        depthAnchor: [
          0.675,
          0,
          0.62
        ],
        faces: [
          {
            id: "tk_side0",
            verts: [
              [
                0.25,
                0,
                0.94
              ],
              [
                1.1,
                0,
                0.94
              ],
              [
                1.1,
                0.16,
                0.8971
              ],
              [
                0.25,
                0.16,
                0.8971
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "tk_side1",
            verts: [
              [
                0.25,
                0.16,
                0.8971
              ],
              [
                1.1,
                0.16,
                0.8971
              ],
              [
                1.1,
                0.2771,
                0.78
              ],
              [
                0.25,
                0.2771,
                0.78
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "tk_side2",
            verts: [
              [
                0.25,
                0.2771,
                0.78
              ],
              [
                1.1,
                0.2771,
                0.78
              ],
              [
                1.1,
                0.32,
                0.62
              ],
              [
                0.25,
                0.32,
                0.62
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "tk_side3",
            verts: [
              [
                0.25,
                0.32,
                0.62
              ],
              [
                1.1,
                0.32,
                0.62
              ],
              [
                1.1,
                0.2771,
                0.46
              ],
              [
                0.25,
                0.2771,
                0.46
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side4",
            verts: [
              [
                0.25,
                0.2771,
                0.46
              ],
              [
                1.1,
                0.2771,
                0.46
              ],
              [
                1.1,
                0.16,
                0.3429
              ],
              [
                0.25,
                0.16,
                0.3429
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side5",
            verts: [
              [
                0.25,
                0.16,
                0.3429
              ],
              [
                1.1,
                0.16,
                0.3429
              ],
              [
                1.1,
                0,
                0.3
              ],
              [
                0.25,
                0,
                0.3
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side6",
            verts: [
              [
                0.25,
                0,
                0.3
              ],
              [
                1.1,
                0,
                0.3
              ],
              [
                1.1,
                -0.16,
                0.3429
              ],
              [
                0.25,
                -0.16,
                0.3429
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side7",
            verts: [
              [
                0.25,
                -0.16,
                0.3429
              ],
              [
                1.1,
                -0.16,
                0.3429
              ],
              [
                1.1,
                -0.2771,
                0.46
              ],
              [
                0.25,
                -0.2771,
                0.46
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side8",
            verts: [
              [
                0.25,
                -0.2771,
                0.46
              ],
              [
                1.1,
                -0.2771,
                0.46
              ],
              [
                1.1,
                -0.32,
                0.62
              ],
              [
                0.25,
                -0.32,
                0.62
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side9",
            verts: [
              [
                0.25,
                -0.32,
                0.62
              ],
              [
                1.1,
                -0.32,
                0.62
              ],
              [
                1.1,
                -0.2771,
                0.78
              ],
              [
                0.25,
                -0.2771,
                0.78
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_side10",
            verts: [
              [
                0.25,
                -0.2771,
                0.78
              ],
              [
                1.1,
                -0.2771,
                0.78
              ],
              [
                1.1,
                -0.16,
                0.8971
              ],
              [
                0.25,
                -0.16,
                0.8971
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "tk_side11",
            verts: [
              [
                0.25,
                -0.16,
                0.8971
              ],
              [
                1.1,
                -0.16,
                0.8971
              ],
              [
                1.1,
                0,
                0.94
              ],
              [
                0.25,
                0,
                0.94
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "tk_cap_front",
            verts: [
              [
                1.1,
                -0.16,
                0.8971
              ],
              [
                1.1,
                -0.2771,
                0.78
              ],
              [
                1.1,
                -0.32,
                0.62
              ],
              [
                1.1,
                -0.2771,
                0.46
              ],
              [
                1.1,
                -0.16,
                0.3429
              ],
              [
                1.1,
                0,
                0.3
              ],
              [
                1.1,
                0.16,
                0.3429
              ],
              [
                1.1,
                0.2771,
                0.46
              ],
              [
                1.1,
                0.32,
                0.62
              ],
              [
                1.1,
                0.2771,
                0.78
              ],
              [
                1.1,
                0.16,
                0.8971
              ],
              [
                1.1,
                0,
                0.94
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_cap_rear",
            verts: [
              [
                0.25,
                0,
                0.94
              ],
              [
                0.25,
                0.16,
                0.8971
              ],
              [
                0.25,
                0.2771,
                0.78
              ],
              [
                0.25,
                0.32,
                0.62
              ],
              [
                0.25,
                0.2771,
                0.46
              ],
              [
                0.25,
                0.16,
                0.3429
              ],
              [
                0.25,
                0,
                0.3
              ],
              [
                0.25,
                -0.16,
                0.3429
              ],
              [
                0.25,
                -0.2771,
                0.46
              ],
              [
                0.25,
                -0.32,
                0.62
              ],
              [
                0.25,
                -0.2771,
                0.78
              ],
              [
                0.25,
                -0.16,
                0.8971
              ]
            ],
            color: "#9a9a9a"
          },
          {
            id: "tk_stripe",
            verts: [
              [
                0.29,
                -0.09,
                0.945
              ],
              [
                1.06,
                -0.09,
                0.945
              ],
              [
                1.06,
                0.09,
                0.945
              ],
              [
                0.29,
                0.09,
                0.945
              ]
            ],
            color: "#ff4400"
          }
        ]
      },
      {
        depthAnchor: [
          1.3,
          0,
          0.51
        ],
        faces: [
          {
            id: "box_front",
            verts: [
              [
                1.5,
                -0.42,
                0.3
              ],
              [
                1.5,
                0.42,
                0.3
              ],
              [
                1.5,
                0.42,
                0.72
              ],
              [
                1.5,
                -0.42,
                0.72
              ]
            ],
            color: "#e8e8e8"
          },
          {
            id: "box_rear",
            verts: [
              [
                1.1,
                0.42,
                0.3
              ],
              [
                1.1,
                -0.42,
                0.3
              ],
              [
                1.1,
                -0.42,
                0.72
              ],
              [
                1.1,
                0.42,
                0.72
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "box_right",
            verts: [
              [
                1.5,
                0.42,
                0.3
              ],
              [
                1.1,
                0.42,
                0.3
              ],
              [
                1.1,
                0.42,
                0.72
              ],
              [
                1.5,
                0.42,
                0.72
              ]
            ],
            color: "#e8e8e8"
          },
          {
            id: "box_left",
            verts: [
              [
                1.1,
                -0.42,
                0.3
              ],
              [
                1.5,
                -0.42,
                0.3
              ],
              [
                1.5,
                -0.42,
                0.72
              ],
              [
                1.1,
                -0.42,
                0.72
              ]
            ],
            color: "#cfcfcf"
          },
          {
            id: "box_top",
            verts: [
              [
                1.1,
                -0.42,
                0.72
              ],
              [
                1.5,
                -0.42,
                0.72
              ],
              [
                1.5,
                0.42,
                0.72
              ],
              [
                1.1,
                0.42,
                0.72
              ]
            ],
            color: "#e8e8e8"
          },
          {
            id: "box_door_l1",
            type: "line",
            verts: [
              [
                1.1800000000000002,
                0.421,
                0.35
              ],
              [
                1.42,
                0.421,
                0.35
              ]
            ],
            color: "#8a8a8a",
            lineWidth: 1.2
          },
          {
            id: "box_door_l2",
            type: "line",
            verts: [
              [
                1.42,
                0.421,
                0.35
              ],
              [
                1.42,
                0.421,
                0.6599999999999999
              ]
            ],
            color: "#8a8a8a",
            lineWidth: 1.2
          },
          {
            id: "box_door_l3",
            type: "line",
            verts: [
              [
                1.42,
                0.421,
                0.6599999999999999
              ],
              [
                1.1800000000000002,
                0.421,
                0.6599999999999999
              ]
            ],
            color: "#8a8a8a",
            lineWidth: 1.2
          },
          {
            id: "box_door_l4",
            type: "line",
            verts: [
              [
                1.1800000000000002,
                0.421,
                0.6599999999999999
              ],
              [
                1.1800000000000002,
                0.421,
                0.35
              ]
            ],
            color: "#8a8a8a",
            lineWidth: 1.2
          },
          {
            id: "box_door_handle",
            type: "line",
            verts: [
              [
                1.25,
                0.421,
                0.5049999999999999
              ],
              [
                1.35,
                0.421,
                0.5049999999999999
              ]
            ],
            color: "#8a8a8a",
            lineWidth: 1.6
          }
        ]
      },
      {
        depthAnchor: [
          1.85,
          0,
          0.55
        ],
        faces: [
          {
            id: "cab_left",
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
                0.8
              ],
              [
                1.5,
                -0.45,
                0.8
              ]
            ],
            color: "#3a6a3a"
          },
          {
            id: "cab_right",
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
                0.8
              ],
              [
                2.2,
                0.45,
                0.8
              ]
            ],
            color: "#3a6a3a"
          },
          {
            id: "cab_front",
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
                0.8
              ],
              [
                2.2,
                -0.45,
                0.8
              ]
            ],
            color: "#3a6a3a"
          },
          {
            id: "cab_rear",
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
                0.8
              ],
              [
                1.5,
                0.45,
                0.8
              ]
            ],
            color: "#3a6a3a"
          },
          {
            id: "cab_roof",
            verts: [
              [
                2.2,
                -0.45,
                0.8
              ],
              [
                2.2,
                0.45,
                0.8
              ],
              [
                1.5,
                0.45,
                0.8
              ],
              [
                1.5,
                -0.45,
                0.8
              ]
            ],
            color: "#3a6a3a"
          },
          {
            id: "cab_win",
            verts: [
              [
                2.1990000000000003,
                -0.4,
                0.4
              ],
              [
                2.1990000000000003,
                0.4,
                0.4
              ],
              [
                2.1990000000000003,
                0.4,
                0.75
              ],
              [
                2.1990000000000003,
                -0.4,
                0.75
              ]
            ],
            color: "#112233"
          }
        ]
      }
    ]
  };

  // ../src/game/models/carrier_car.zdef
  var carrier_car_default = { id: "carrier_car", pivot: [0, 0, 0], collisionBoxes: [{ id: "chassis", xMin: -0.5, xMax: 0.5, yMin: -0.36, yMax: 0.36, zMin: 0, zMax: 0.37 }], faces: [{ id: "body_floor", verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, 0.36, 0], [-0.5, 0.36, 0]], color: "#888888" }, { id: "body_L", normal: [-1, 0], verts: [[-0.5, 0.36, 0], [-0.5, -0.36, 0], [-0.5, -0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#666666" }, { id: "body_back", normal: [0, -1], verts: [[-0.5, -0.36, 0], [0.5, -0.36, 0], [0.5, -0.36, 0.15], [-0.5, -0.36, 0.15]], color: "#dddddd" }, { id: "body_R", normal: [1, 0], verts: [[0.5, -0.36, 0], [0.5, 0.36, 0], [0.5, 0.36, 0.15], [0.5, -0.36, 0.15]], color: "#666666" }, { id: "body_front", normal: [0, 1], verts: [[0.5, 0.36, 0], [-0.5, 0.36, 0], [-0.5, 0.36, 0.15], [0.5, 0.36, 0.15]], color: "#dddddd" }, { id: "body_top", verts: [[-0.5, -0.36, 0.15], [0.5, -0.36, 0.15], [0.5, 0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#dddddd" }, { id: "eq_floor", verts: [[0.28, -0.288, 0.15], [0.48, -0.288, 0.15], [0.48, -0.038, 0.15], [0.28, -0.038, 0.15]], color: "#aa0000" }, { id: "eq_back", normal: [0, -1], verts: [[0.28, -0.288, 0.15], [0.48, -0.288, 0.15], [0.48, -0.288, 0.33], [0.28, -0.288, 0.33]], color: "#ee0000" }, { id: "eq_R", normal: [1, 0], verts: [[0.48, -0.288, 0.15], [0.48, -0.038, 0.15], [0.48, -0.038, 0.33], [0.48, -0.288, 0.33]], color: "#880000" }, { id: "eq_front", normal: [0, 1], verts: [[0.48, -0.038, 0.15], [0.28, -0.038, 0.15], [0.28, -0.038, 0.33], [0.48, -0.038, 0.33]], color: "#aa0000" }, { id: "eq_L", normal: [-1, 0], verts: [[0.28, -0.038, 0.15], [0.28, -0.288, 0.15], [0.28, -0.288, 0.33], [0.28, -0.038, 0.33]], color: "#880000" }, { id: "eq_top", verts: [[0.28, -0.288, 0.33], [0.48, -0.288, 0.33], [0.48, -0.038, 0.33], [0.28, -0.038, 0.33]], color: "#cc0000" }, { id: "cab_floor", verts: [[-0.5, -0.36, 0.15], [0.25, -0.36, 0.15], [0.25, 0.36, 0.15], [-0.5, 0.36, 0.15]], color: "#aaaaaa" }, { id: "cab_L", normal: [-1, 0], verts: [[-0.5, 0.36, 0.15], [-0.5, -0.36, 0.15], [-0.5, -0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#666666" }, { id: "cab_back", normal: [0, -1], verts: [[-0.5, -0.36, 0.15], [0.25, -0.36, 0.15], [0.25, -0.36, 0.37], [-0.5, -0.36, 0.37]], color: "#ffffff" }, { id: "cab_R", normal: [1, 0], verts: [[0.25, -0.36, 0.15], [0.25, 0.36, 0.15], [0.25, 0.36, 0.37], [0.25, -0.36, 0.37]], color: "#666666" }, { id: "cab_front", normal: [0, 1], verts: [[0.25, 0.36, 0.15], [-0.5, 0.36, 0.15], [-0.5, 0.36, 0.37], [0.25, 0.36, 0.37]], color: "#aaaaaa" }, { id: "cab_top", verts: [[-0.5, -0.36, 0.37], [0.25, -0.36, 0.37], [0.25, 0.36, 0.37], [-0.5, 0.36, 0.37]], color: "#eeeeee" }, { id: "w_front_L", normal: [0, -1], verts: [[-0.425, -0.36, 0], [-0.275, -0.36, 0], [-0.275, -0.36, 0.25], [-0.425, -0.36, 0.25]], color: "#222222" }, { id: "w_front_R", normal: [0, 1], verts: [[-0.275, 0.36, 0], [-0.425, 0.36, 0], [-0.425, 0.36, 0.25], [-0.275, 0.36, 0.25]], color: "#222222" }], parts: [{ id: "wheel_rear_L", rotate: { pivot: [0.35, -0.36, 0.125], axis: [0, 0, 1], param: "steerAngle" }, faces: [{ id: "w_rear_L", normal: [0, -1], verts: [[0.275, -0.36, 0], [0.425, -0.36, 0], [0.425, -0.36, 0.25], [0.275, -0.36, 0.25]], color: "#222222" }] }, { id: "wheel_rear_R", rotate: { pivot: [0.35, 0.36, 0.125], axis: [0, 0, 1], param: "steerAngle" }, faces: [{ id: "w_rear_R", normal: [0, 1], verts: [[0.425, 0.36, 0], [0.275, 0.36, 0], [0.275, 0.36, 0.25], [0.425, 0.36, 0.25]], color: "#222222" }] }] };

  // ../src/game/models/carrier_deck_tractor.zdef
  var carrier_deck_tractor_default = {
    version: 3,
    id: "carrier_deck_tractor",
    pivot: [
      0,
      0,
      0
    ],
    nodes: [
      {
        faces: [
          {
            id: "floor",
            verts: [
              [
                -0.5,
                0.36,
                0
              ],
              [
                0.5,
                0.36,
                0
              ],
              [
                0.5,
                -0.36,
                0
              ],
              [
                -0.5,
                -0.36,
                0
              ]
            ],
            color: "#b09000"
          },
          {
            id: "left",
            verts: [
              [
                -0.5,
                0.36,
                0
              ],
              [
                -0.5,
                -0.36,
                0
              ],
              [
                -0.5,
                -0.36,
                0.37
              ],
              [
                -0.5,
                0.36,
                0.37
              ]
            ],
            color: "#8a6c00"
          },
          {
            id: "back",
            verts: [
              [
                -0.5,
                -0.36,
                0
              ],
              [
                0.5,
                -0.36,
                0
              ],
              [
                0.5,
                -0.36,
                0.37
              ],
              [
                -0.5,
                -0.36,
                0.37
              ]
            ],
            color: "#e0b800"
          },
          {
            id: "right",
            verts: [
              [
                0.5,
                -0.36,
                0
              ],
              [
                0.5,
                0.36,
                0
              ],
              [
                0.5,
                0.36,
                0.37
              ],
              [
                0.5,
                -0.36,
                0.37
              ]
            ],
            color: "#8a6c00"
          },
          {
            id: "front",
            verts: [
              [
                0.5,
                0.36,
                0
              ],
              [
                -0.5,
                0.36,
                0
              ],
              [
                -0.5,
                0.36,
                0.37
              ],
              [
                0.5,
                0.36,
                0.37
              ]
            ],
            color: "#b09000"
          },
          {
            id: "top",
            verts: [
              [
                -0.5,
                -0.36,
                0.37
              ],
              [
                0.5,
                -0.36,
                0.37
              ],
              [
                0.5,
                0.36,
                0.37
              ],
              [
                -0.5,
                0.36,
                0.37
              ]
            ],
            color: "#caa800"
          },
          {
            id: "wfl",
            verts: [
              [
                -0.425,
                -0.36,
                0
              ],
              [
                -0.275,
                -0.36,
                0
              ],
              [
                -0.275,
                -0.36,
                0.25
              ],
              [
                -0.425,
                -0.36,
                0.25
              ]
            ],
            color: "#222222"
          },
          {
            id: "wfr",
            verts: [
              [
                -0.275,
                0.36,
                0
              ],
              [
                -0.425,
                0.36,
                0
              ],
              [
                -0.425,
                0.36,
                0.25
              ],
              [
                -0.275,
                0.36,
                0.25
              ]
            ],
            color: "#222222"
          },
          {
            id: "wrl",
            verts: [
              [
                0.275,
                -0.36,
                0
              ],
              [
                0.425,
                -0.36,
                0
              ],
              [
                0.425,
                -0.36,
                0.25
              ],
              [
                0.275,
                -0.36,
                0.25
              ]
            ],
            color: "#222222"
          },
          {
            id: "wrr",
            verts: [
              [
                0.425,
                0.36,
                0
              ],
              [
                0.275,
                0.36,
                0
              ],
              [
                0.275,
                0.36,
                0.25
              ],
              [
                0.425,
                0.36,
                0.25
              ]
            ],
            color: "#222222"
          }
        ]
      }
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
    fuel_truck: { def: toDefCast(fuel_truck_default), label: "Fuel Truck", isStatic: false, movementType: "auto" },
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
    filename: null
  };
  var wireframe = [false, false, false, false];
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
    document.querySelectorAll(".quad-wireframe-toggle").forEach((btn, q) => {
      btn.style.display = q === GAME_VIEW_Q ? "none" : "";
      btn.style.top = Math.floor(q / 2) * qh + 4 + "px";
      btn.style.left = q % 2 * qw + qw - 72 + "px";
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
      const _computeModelDepth = (faces) => {
        if (!faces.length) return 0;
        const cosA = Math.cos(renderViewAngle), sinA = Math.sin(renderViewAngle);
        let sum = 0;
        for (const f of faces) {
          let cx = 0, cy = 0;
          for (const v of f.verts) {
            cx += v[0];
            cy += v[1];
          }
          sum += cx / f.verts.length * cosA + cy / f.verts.length * sinA;
        }
        return sum / faces.length;
      };
      const _gridDepth = (grid) => grid.x * Math.cos(renderViewAngle) + grid.y * Math.sin(renderViewAngle);
      if (state.def) {
        const _md0 = _computeModelDepth(getActiveFaces());
        if (_gridDepth(g) <= _md0) drawGrid(g);
        if (_gridDepth(gv) <= _md0) drawGridV(gv);
      } else {
        drawGrid(g);
        drawGridV(gv);
      }
      if (state.def) {
        const testParams = buildTestParams();
        const activeFaces = getActiveFaces();
        if (state.def2) {
          const colors2 = {};
          if (state.selectedFaceIdx >= 0 && activeFaces[state.selectedFaceIdx]) {
            colors2[activeFaces[state.selectedFaceIdx].id] = "#ffdd44";
          }
          SceneRenderer.debugCollision = showCboxes;
          renderNodes(state.def2, {}, { x: 0, y: 0, angle: renderViewAngle, colors: colors2 }, SceneRenderer, { ctx, isoFn: iso, tileW: TW * renderZoom });
          SceneRenderer.flush(renderCam.x, renderCam.y);
        } else {
          const colors = {};
          if (state.activePart) {
            const ap = state.def.parts?.find((p) => p.id === state.activePart);
            if (ap) ap.faces.forEach((f) => {
              colors[f.id] = "#2d5c88";
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
      if (state.def) {
        const _md2 = _computeModelDepth(getActiveFaces());
        if (_gridDepth(g) > _md2) drawGrid(g);
        if (_gridDepth(gv) > _md2) drawGridV(gv);
      }
      if (wireframe[q] && state.def) {
        const _allFaces = getActiveFaces();
        ctx.save();
        ctx.strokeStyle = "rgba(180,220,255,0.45)";
        ctx.lineWidth = 0.7;
        for (const f of _allFaces) {
          if (!f.verts.length) continue;
          const pts = f.verts.map((v) => localToScreen(v[0], v[1], v[2]));
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
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
      <button class="face-del-btn" data-i="${i}" title="Fl\xE4che l\xF6schen">\u2715</button>
    </div>`).join("");
    list.querySelectorAll(".face-item").forEach((el) => {
      const i = parseInt(el.dataset["i"] ?? "0");
      el.addEventListener("click", (e) => {
        if (e.target.closest(".face-del-btn")) return;
        selectFace(i);
      });
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        selectFace(i);
        _showFaceCtxMenu(e.clientX, e.clientY, i);
      });
      const swatch = el.querySelector(".face-swatch");
      if (swatch) {
        swatch.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          selectFace(i);
          _showFaceCtxMenu(e.clientX, e.clientY - 10, i);
          setTimeout(() => {
            const picker = document.querySelector('.ctx-menu input[type="color"]');
            if (picker) picker.click();
          }, 50);
        });
      }
    });
    list.querySelectorAll(".face-del-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset["i"] ?? "0");
        const allFaces = getActiveFaces();
        allFaces.splice(i, 1);
        state.selectedFaceIdx = Math.min(state.selectedFaceIdx, allFaces.length - 1);
        if (!allFaces.length) state.selectedFaceIdx = -1;
        state.selectedVertIdx = -1;
        markDirty();
        renderAll();
      });
    });
  };
  var renderFaceEditor = () => {
    const sec = document.getElementById("vert-sec");
    const label = document.getElementById("vert-sec-label");
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
    label.textContent = face.id;
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
      <button class="vert-del-btn" data-i="${i}" title="Vertex l\xF6schen">\u2715</button>
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
      row.querySelector(".vert-del-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (face.verts.length <= 3) return;
        face.verts.splice(i, 1);
        state.selectedVertIdx = Math.min(state.selectedVertIdx, face.verts.length - 1);
        markDirty();
        renderFaceEditor();
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
  var renderLights = () => {
    const panel = document.getElementById("lights-panel");
    const lights = state.def?.lights;
    if (!lights?.length) {
      panel.innerHTML = '<div class="empty">\u2013</div>';
      return;
    }
    panel.innerHTML = lights.map((l, i) => `
    <div class="cbox-block" style="margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${l.color ?? "#fff"};border:1px solid #444;flex-shrink:0"></span>
        <span style="font-size:10px;opacity:0.6">[${l.pos.map((v) => v.toFixed(2)).join(", ")}]</span>
      </div>
      <div class="cbox-grid">
        <label>Hz</label>
        <input type="number" step="0.1" min="0" value="${l.blinkHz ?? ""}" class="li-hz" data-idx="${i}" placeholder="immer an" style="grid-column:2/4">
        <label>Phase</label>
        <input type="number" step="0.01" min="0" max="1" value="${l.phase ?? 0}" class="li-ph" data-idx="${i}" style="grid-column:2/4">
        <label>Duty</label>
        <input type="number" step="0.05" min="0.05" max="1" value="${l.dutyCycle ?? 0.5}" class="li-dc" data-idx="${i}" style="grid-column:2/4">
      </div>
    </div>`).join("");
    panel.querySelectorAll(".li-hz").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = parseInt(inp.dataset["idx"]);
        const v = parseFloat(inp.value);
        lights[idx].blinkHz = isNaN(v) || v <= 0 ? void 0 : v;
        markDirty();
      });
    });
    panel.querySelectorAll(".li-ph").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = parseInt(inp.dataset["idx"]);
        lights[idx].phase = Math.max(0, Math.min(1, parseFloat(inp.value) || 0));
        markDirty();
      });
    });
    panel.querySelectorAll(".li-dc").forEach((inp) => {
      inp.addEventListener("input", () => {
        const idx = parseInt(inp.dataset["idx"]);
        lights[idx].dutyCycle = Math.max(0.05, Math.min(1, parseFloat(inp.value) || 0.5));
        markDirty();
      });
    });
  };
  var renderAll = () => {
    renderPartsList();
    renderFaceList();
    renderFaceEditor();
    renderCboxList();
    renderZoneList();
    renderLandingZone();
    renderLights();
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
      _closeCtxMenu();
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
    const delIdx = state.selectedVertIdx >= 0 && state.selectedVertIdx < face.verts.length ? state.selectedVertIdx : face.verts.length - 1;
    face.verts.splice(delIdx, 1);
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
    faces.push({ id: "face_" + faces.length, verts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: "#1a70c8" });
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
  document.querySelectorAll(".quad-wireframe-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const q = parseInt(btn.dataset["q"] ?? "0");
      wireframe[q] = !wireframe[q];
      btn.classList.toggle("active", wireframe[q]);
      draw();
    });
  });
  document.getElementById("btn-clear-grid").addEventListener("click", () => {
    const g = grids[activeQ];
    g.visible = false;
    g.selected = false;
    g.x = 0;
    g.y = 0;
    g.z = 0;
    syncGridUI();
    draw();
  });
  document.getElementById("btn-clear-gridv").addEventListener("click", () => {
    const gv = gridVs[activeQ];
    gv.visible = false;
    gv.selected = false;
    gv.x = 0;
    gv.y = 0;
    gv.z = 0;
    syncGridUI();
    draw();
  });
  var _closeCtxMenu = () => {
    document.querySelectorAll(".ctx-menu").forEach((m) => m.remove());
  };
  var _showFaceCtxMenu = (clientX, clientY, faceIdx) => {
    _closeCtxMenu();
    const faces = getActiveFaces();
    const face = faces[faceIdx];
    if (!face) return;
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    const colorRow = document.createElement("div");
    colorRow.className = "ctx-menu-sub";
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = toColorInput(face.color);
    colorPicker.addEventListener("input", (e) => {
      face.color = e.target.value;
      markDirty();
      renderAll();
    });
    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Farbe";
    colorRow.appendChild(colorPicker);
    colorRow.appendChild(colorLabel);
    menu.appendChild(colorRow);
    const strokeRow = document.createElement("div");
    strokeRow.className = "ctx-menu-sub";
    const strokeCheck = document.createElement("input");
    strokeCheck.type = "checkbox";
    strokeCheck.checked = !!face.stroke;
    const strokePicker = document.createElement("input");
    strokePicker.type = "color";
    strokePicker.value = toColorInput(face.stroke || "#aaaaaa");
    strokePicker.style.display = face.stroke ? "" : "none";
    strokeCheck.addEventListener("change", (e) => {
      if (e.target.checked) {
        face.stroke = strokePicker.value;
        face.strokeWidth = face.strokeWidth ?? 1;
        strokePicker.style.display = "";
      } else {
        delete face.stroke;
        delete face.strokeWidth;
        strokePicker.style.display = "none";
      }
      markDirty();
      renderAll();
    });
    strokePicker.addEventListener("input", (e) => {
      if (face.stroke !== void 0) {
        face.stroke = e.target.value;
        markDirty();
        renderAll();
      }
    });
    const strokeLabel = document.createElement("label");
    strokeLabel.textContent = "Kontur";
    strokeRow.appendChild(strokeCheck);
    strokeRow.appendChild(strokeLabel);
    strokeRow.appendChild(strokePicker);
    menu.appendChild(strokeRow);
    const sep1 = document.createElement("div");
    sep1.className = "ctx-menu-sep";
    menu.appendChild(sep1);
    const normalCheck = document.createElement("div");
    normalCheck.className = "ctx-menu-sub";
    const normalToggle = document.createElement("input");
    normalToggle.type = "checkbox";
    normalToggle.checked = Array.isArray(face.normal);
    const nlabel = document.createElement("label");
    nlabel.textContent = "Normal";
    normalCheck.appendChild(normalToggle);
    normalCheck.appendChild(nlabel);
    menu.appendChild(normalCheck);
    const normalInputs = document.createElement("div");
    normalInputs.className = "ctx-menu-sub";
    normalInputs.style.display = normalToggle.checked ? "" : "none";
    ["nx", "ny"].forEach((lbl, idx) => {
      const l = document.createElement("label");
      l.textContent = lbl;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.1";
      inp.style.width = "46px";
      inp.value = String(Array.isArray(face.normal) ? face.normal[idx] : 0);
      inp.addEventListener("input", () => {
        if (!Array.isArray(face.normal)) face.normal = [0, 0];
        face.normal[idx] = parseFloat(inp.value) || 0;
        markDirty();
        renderAll();
      });
      normalInputs.appendChild(l);
      normalInputs.appendChild(inp);
    });
    menu.appendChild(normalInputs);
    normalToggle.addEventListener("change", (e) => {
      const inputs = normalInputs.querySelectorAll("input");
      if (e.target.checked) {
        face.normal = [parseFloat(inputs[0].value) || 0, parseFloat(inputs[1].value) || 0];
        normalInputs.style.display = "";
      } else {
        delete face.normal;
        normalInputs.style.display = "none";
      }
      markDirty();
      renderAll();
    });
    const sep2 = document.createElement("div");
    sep2.className = "ctx-menu-sep";
    menu.appendChild(sep2);
    const renameRow = document.createElement("div");
    renameRow.className = "ctx-menu-sub";
    const renameLabel = document.createElement("label");
    renameLabel.textContent = "ID:";
    const renameInput = document.createElement("input");
    renameInput.type = "text";
    renameInput.value = face.id;
    renameInput.addEventListener("input", (e) => {
      face.id = e.target.value;
      markDirty();
      renderFaceList();
      const secLabel = document.getElementById("vert-sec-label");
      if (secLabel) secLabel.textContent = face.id;
    });
    renameRow.appendChild(renameLabel);
    renameRow.appendChild(renameInput);
    menu.appendChild(renameRow);
    const sep3 = document.createElement("div");
    sep3.className = "ctx-menu-sep";
    menu.appendChild(sep3);
    const delItem = document.createElement("div");
    delItem.className = "ctx-menu-item danger";
    delItem.textContent = "\u2715 L\xF6schen";
    delItem.addEventListener("click", () => {
      faces.splice(faceIdx, 1);
      state.selectedFaceIdx = Math.min(state.selectedFaceIdx, faces.length - 1);
      if (!faces.length) state.selectedFaceIdx = -1;
      state.selectedVertIdx = -1;
      _closeCtxMenu();
      markDirty();
      renderAll();
    });
    menu.appendChild(delItem);
    document.body.appendChild(menu);
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = clientX, y = clientY;
    if (x + menu.offsetWidth > vw) x = vw - menu.offsetWidth - 4;
    if (y + menu.offsetHeight > vh) y = vh - menu.offsetHeight - 4;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    const onOutside = (e) => {
      if (!menu.contains(e.target)) {
        _closeCtxMenu();
        document.removeEventListener("mousedown", onOutside);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", onOutside), 0);
  };
  area.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setRenderContext(lockedQ);
    if (!state.def) return;
    const activeFaces = getActiveFaces();
    if (!activeFaces.length) return;
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
        _showFaceCtxMenu(e.clientX, e.clientY, i);
        return;
      }
    }
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
    if (d.rescueZones?.length) out["rescueZones"] = d.rescueZones;
    if (d.landingZone) out["landingZone"] = d.landingZone;
    if (d.lights?.length) out["lights"] = d.lights;
    return JSON.stringify(out, null, 2);
  };
  var fromJSON = (content) => {
    const d = JSON.parse(content.replace(/\/\/[^\n]*/g, ""));
    const version = d["version"];
    if (version === 2 || version === 3) {
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
        rotateNodes: d["rotateNodes"],
        rescueZones: d["rescueZones"],
        landingZone: d["landingZone"],
        lights: d["lights"]
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
