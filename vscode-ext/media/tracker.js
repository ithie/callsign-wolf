"use strict";
(() => {
  // ../src/shared/ZsynthPlayer.ts
  var ZsynthPlayer = {
    ctx: null,
    songs: {},
    currentTrack: null,
    masterGain: null,
    onStep: null,
    freqs: {
      B4: 493.88,
      Bb4: 466.16,
      A4: 440,
      Ab4: 415.3,
      G4: 392,
      Gb4: 369.99,
      F4: 349.23,
      E4: 329.63,
      Eb4: 311.13,
      D4: 293.66,
      Db4: 277.18,
      C4: 261.63,
      B3: 246.94,
      Bb3: 233.08,
      A3: 220,
      Ab3: 207.65,
      G3: 196,
      Gb3: 185,
      F3: 174.61,
      E3: 164.81,
      Eb3: 155.56,
      D3: 146.83,
      Db3: 138.59,
      C3: 130.81,
      B2: 123.47,
      Bb2: 116.54,
      A2: 110,
      Ab2: 103.83,
      G2: 98,
      Gb2: 92.5,
      F2: 87.31,
      E2: 82.41,
      Eb2: 77.78,
      D2: 73.42,
      Db2: 69.3,
      C2: 65.41,
      B1: 61.74,
      Bb1: 58.27,
      A1: 55,
      Ab1: 51.91,
      G1: 49,
      Gb1: 46.25,
      F1: 43.65,
      E1: 41.2,
      Eb1: 38.89,
      D1: 36.71,
      Db1: 34.65,
      C1: 32.7
    },
    init: (songList) => {
      ZsynthPlayer.songs = songList;
      const _tryResume = () => {
        if (ZsynthPlayer.ctx?.state === "suspended") ZsynthPlayer.ctx.resume();
      };
      window.__zsynthResume = _tryResume;
      document.addEventListener("touchstart", _tryResume, { passive: true });
      document.addEventListener("click", _tryResume, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") _tryResume();
      });
    },
    play: (key, volume = 1) => {
      try {
        if (!ZsynthPlayer.ctx) {
          ZsynthPlayer.ctx = new (window.AudioContext || window.webkitAudioContext)();
          ZsynthPlayer.masterGain = ZsynthPlayer.ctx.createGain();
          ZsynthPlayer.masterGain.connect(ZsynthPlayer.ctx.destination);
        }
        const songData = ZsynthPlayer.songs[key];
        if (!songData) return;
        const stepMap = {};
        for (const k in songData.activeData) {
          const sepIdx = k.lastIndexOf("-");
          const trackId = k.substring(0, sepIdx);
          const step = parseInt(k.substring(sepIdx + 1));
          const note = songData.activeData[k];
          if (!stepMap[step]) stepMap[step] = [];
          stepMap[step].push({ trackId, note });
        }
        const _start = () => {
          const ctx = ZsynthPlayer.ctx;
          const startTime = ctx.currentTime;
          if (ZsynthPlayer.currentTrack) {
            const old = ZsynthPlayer.currentTrack;
            old.gainNode.gain.setTargetAtTime(0, startTime, 0.015);
            setTimeout(() => {
              old.isPlaying = false;
            }, 100);
          }
          const track = {
            data: songData,
            isPlaying: true,
            currentStep: 0,
            gainNode: ctx.createGain(),
            nextNoteTime: startTime + 0.05,
            stepMap
          };
          track.gainNode.gain.setValueAtTime(0, startTime);
          track.gainNode.gain.setTargetAtTime(Math.max(1e-4, volume), startTime, 0.015);
          track.gainNode.connect(ZsynthPlayer.masterGain);
          ZsynthPlayer.currentTrack = track;
          ZsynthPlayer.scheduler(track);
        };
        if (ZsynthPlayer.ctx.state === "suspended") {
          ZsynthPlayer.ctx.resume().then(_start);
        } else {
          _start();
        }
      } catch {
      }
    },
    scheduler: (track) => {
      if (!ZsynthPlayer.ctx) return;
      const LOOKAHEAD = 0.1;
      const INTERVAL_MS = 25;
      const bpm = parseInt(track.data.bpm);
      const stepTime = 60 / bpm / 4;
      if (track.nextNoteTime === void 0) {
        track.nextNoteTime = ZsynthPlayer.ctx.currentTime + 0.05;
      }
      while (track.nextNoteTime < ZsynthPlayer.ctx.currentTime + LOOKAHEAD) {
        if (!track.isPlaying || ZsynthPlayer.currentTrack !== track) return;
        const sIdx = track.currentStep % 64;
        if (ZsynthPlayer.onStep) {
          ZsynthPlayer.onStep(sIdx);
        }
        const notes = track.stepMap[sIdx] || [];
        notes.forEach(({ trackId, note }) => {
          const config = track.data.config[trackId] || { vol: 80 };
          if (trackId.startsWith("synth")) {
            ZsynthPlayer.playSynth(note, track.nextNoteTime, config, track.gainNode);
          } else {
            ZsynthPlayer.playDrum(note, track.nextNoteTime, config.vol / 100, track.gainNode);
          }
        });
        track.currentStep++;
        track.nextNoteTime += stepTime;
      }
      setTimeout(() => ZsynthPlayer.scheduler(track), INTERVAL_MS);
    },
    playDrum: (type, time, vol, target) => {
      if (!ZsynthPlayer.ctx) return;
      const ctx = ZsynthPlayer.ctx;
      const g = ctx.createGain();
      g.connect(target);
      if (type === "CLAP") {
        const bufSize = Math.floor(ctx.sampleRate * 0.05);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2800;
        bp.Q.value = 0.8;
        g.gain.setValueAtTime(vol * 0.9, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        src.connect(bp);
        bp.connect(g);
        src.start(time);
        src.stop(time + 0.05);
        return;
      }
      const osc = ctx.createOscillator();
      if (type === "KICK") {
        g.gain.setValueAtTime(vol * 0.5, time);
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        osc.connect(g);
        osc.start(time);
        osc.stop(time + 0.2);
      } else if (type === "HI-HAT") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, time);
        g.gain.setValueAtTime(vol * 0.35, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
        osc.connect(g);
        osc.start(time);
        osc.stop(time + 0.05);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(120, time);
        g.gain.setValueAtTime(vol * 0.5, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        osc.connect(g);
        osc.start(time);
        osc.stop(time + 0.2);
      }
    },
    playSynth: (note, time, cfg, target) => {
      if (!ZsynthPlayer.ctx) return;
      const freq = ZsynthPlayer.freqs[note] || 220;
      const f = ZsynthPlayer.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(cfg.filter || 2e3, time);
      const attack = cfg.attack ?? 0.02;
      const release = cfg.release ?? 0.3;
      const detune = cfg.detune ?? 0;
      const v = cfg.vol / 100 * 0.2;
      const g = ZsynthPlayer.ctx.createGain();
      g.gain.setValueAtTime(1e-4, time);
      g.gain.linearRampToValueAtTime(v, time + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, time + attack + release);
      const osc = ZsynthPlayer.ctx.createOscillator();
      osc.type = cfg.wave || "square";
      osc.frequency.setValueAtTime(freq || 220, time);
      f.type = "lowpass";
      f.frequency.setValueAtTime(cfg.filter || 2e3, time);
      if (detune !== 0) {
        const osc2 = ZsynthPlayer.ctx.createOscillator();
        osc2.type = cfg.wave || "square";
        osc2.frequency.setValueAtTime(freq * Math.pow(2, detune / 1200), time);
        osc2.connect(f);
        osc2.start(time);
        osc2.stop(time + attack + release + 0.05);
      }
      g.gain.setValueAtTime(1e-4, time);
      g.gain.linearRampToValueAtTime(v, time + 0.02);
      g.gain.exponentialRampToValueAtTime(1e-4, time + 0.3);
      osc.connect(f);
      f.connect(g);
      g.connect(target);
      osc.start(time);
      osc.stop(time + 0.4);
    },
    stop: () => {
      if (ZsynthPlayer.currentTrack && ZsynthPlayer.ctx) {
        ZsynthPlayer.currentTrack.isPlaying = false;
        ZsynthPlayer.currentTrack.gainNode.gain.setTargetAtTime(0, ZsynthPlayer.ctx.currentTime, 0.05);
      }
    }
  };
  var ZsynthPlayer_default = ZsynthPlayer;

  // ../src/shared/zsong.ts
  var DRUM_IDS = /* @__PURE__ */ new Set(["kick", "snare", "hat", "clap"]);
  var DRUM_LABEL = { kick: "KICK", snare: "SNARE", hat: "HI-HAT", clap: "CLAP" };
  var TRACK_ORDER = ["kick", "snare", "hat", "clap", "synth1", "synth2", "synth3", "synth4"];
  var parseZsong = (text) => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    let bpm = "120";
    const activeData2 = {};
    const config = {};
    let i = 0;
    if (lines[i]?.startsWith("bpm ")) {
      bpm = lines[i].slice(4).trim();
      i++;
    }
    while (i < lines.length) {
      const match = lines[i].match(/^\[(\w+)\](.*)/);
      if (!match) {
        i++;
        continue;
      }
      const trackId = match[1];
      const trackCfg = {};
      for (const m of (match[2] ?? "").matchAll(/(\w+)=(\S+)/g)) {
        const v = m[2];
        trackCfg[m[1]] = isNaN(Number(v)) ? v : Number(v);
      }
      config[trackId] = trackCfg;
      i++;
      if (i < lines.length && !lines[i].startsWith("[")) {
        const stepLine = lines[i];
        i++;
        if (DRUM_IDS.has(trackId)) {
          for (const s of stepLine.split(/\s+/).filter(Boolean))
            activeData2[`${trackId}-${s}`] = DRUM_LABEL[trackId];
        } else {
          for (const part of stepLine.split(/\s+/).filter(Boolean)) {
            const colon = part.indexOf(":");
            if (colon > 0) activeData2[`${trackId}-${part.slice(0, colon)}`] = part.slice(colon + 1);
          }
        }
      }
    }
    return { bpm, activeData: activeData2, config };
  };
  var songToZsong = (data) => {
    const lines = [`bpm ${data.bpm}`, ""];
    for (const trackId of TRACK_ORDER) {
      const cfg = data.config[trackId];
      const isDrum = DRUM_IDS.has(trackId);
      const steps = [];
      for (let s = 0; s < 64; s++) {
        const v = data.activeData[`${trackId}-${s}`];
        if (v !== void 0) steps.push(isDrum ? String(s) : `${s}:${v}`);
      }
      if (!cfg && !steps.length) continue;
      const cfgStr = cfg ? Object.entries(cfg).map(([k, v]) => `${k}=${v}`).join("  ") : "";
      lines.push(`[${trackId}]  ${cfgStr}`.trimEnd());
      if (steps.length) lines.push(steps.join(" "));
      lines.push("");
    }
    return lines.join("\n");
  };

  // ../src/shared/tracker-types.ts
  var STEPS = 64;
  var TRACK_DEFS = [
    { id: "kick", type: "drum", label: "KICK" },
    { id: "snare", type: "drum", label: "SNARE" },
    { id: "hat", type: "drum", label: "HI-HAT" },
    { id: "clap", type: "drum", label: "CLAP" },
    { id: "synth1", type: "synth", label: "SYNTH 1" },
    { id: "synth2", type: "synth", label: "SYNTH 2" },
    { id: "synth3", type: "synth", label: "SYNTH 3" },
    { id: "synth4", type: "synth", label: "SYNTH 4" }
  ];
  var INSTRUMENTS = {
    lead_square: {
      label: "LEAD Square",
      wave: "square",
      filter: 2500,
      attack: 0.01,
      release: 0.25,
      detune: 0
    },
    lead_saw: {
      label: "LEAD Saw",
      wave: "sawtooth",
      filter: 3e3,
      attack: 0.01,
      release: 0.2,
      detune: 0
    },
    supersaw: {
      label: "SUPERSAW",
      wave: "sawtooth",
      filter: 4e3,
      attack: 0.02,
      release: 0.35,
      detune: 8
    },
    bass_deep: {
      label: "BASS Deep",
      wave: "sine",
      filter: 400,
      attack: 0.01,
      release: 0.4,
      detune: 0
    },
    bass_gritty: {
      label: "BASS Gritty",
      wave: "sawtooth",
      filter: 600,
      attack: 0.01,
      release: 0.35,
      detune: 3
    },
    bass_wobble: {
      label: "BASS Wobble",
      wave: "sawtooth",
      filter: 500,
      attack: 0.05,
      release: 0.5,
      detune: 5
    },
    pluck: {
      label: "PLUCK",
      wave: "square",
      filter: 1200,
      attack: 5e-3,
      release: 0.15,
      detune: 0
    },
    pad_warm: {
      label: "PAD Warm",
      wave: "triangle",
      filter: 1800,
      attack: 0.12,
      release: 0.8,
      detune: 6
    },
    pad_cold: {
      label: "PAD Cold",
      wave: "square",
      filter: 1500,
      attack: 0.15,
      release: 1,
      detune: 4
    },
    arp_bright: {
      label: "ARP Bright",
      wave: "square",
      filter: 3500,
      attack: 5e-3,
      release: 0.1,
      detune: 0
    },
    organ: {
      label: "ORGAN",
      wave: "sine",
      filter: 5e3,
      attack: 0.03,
      release: 0.2,
      detune: 12
    }
  };
  var NOTES = [
    "B4",
    "Bb4",
    "A4",
    "Ab4",
    "G4",
    "Gb4",
    "F4",
    "E4",
    "Eb4",
    "D4",
    "Db4",
    "C4",
    "B3",
    "Bb3",
    "A3",
    "Ab3",
    "G3",
    "Gb3",
    "F3",
    "E3",
    "Eb3",
    "D3",
    "Db3",
    "C3",
    "B2",
    "Bb2",
    "A2",
    "Ab2",
    "G2",
    "Gb2",
    "F2",
    "E2",
    "Eb2",
    "D2",
    "Db2",
    "C2",
    "B1",
    "Bb1",
    "A1",
    "Ab1",
    "G1",
    "Gb1",
    "F1",
    "E1",
    "Eb1",
    "D1",
    "Db1",
    "C1"
  ];

  // editor-view-entry/main.ts
  var vscode = acquireVsCodeApi();
  var activeData = {};
  var knobValues = {};
  var notifyTimer = null;
  var KNOB_DEFS = [
    { key: "attack", label: "ATK", min: 1e-3, max: 0.3, default: 0.02 },
    { key: "release", label: "REL", min: 0.05, max: 1.5, default: 0.3 },
    { key: "detune", label: "DET", min: 0, max: 25, default: 0 }
  ];
  var drawKnob = (canvas, value, min, max, label) => {
    const ctx = canvas.getContext("2d");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 4;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    ctx.beginPath();
    ctx.arc(cx, cy - 4, r, startAngle, endAngle);
    ctx.strokeStyle = "#4a4a4a";
    ctx.lineWidth = 3;
    ctx.stroke();
    const t = (value - min) / (max - min);
    ctx.beginPath();
    ctx.arc(cx, cy - 4, r, startAngle, startAngle + t * (endAngle - startAngle));
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 3;
    ctx.stroke();
    const angle = startAngle + t * (endAngle - startAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + Math.cos(angle) * (r - 2), cy - 4 + Math.sin(angle) * (r - 2));
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "8px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, canvas.height - 1);
    ctx.fillStyle = "#ccc";
    ctx.font = "7px -apple-system, sans-serif";
    ctx.fillText(value.toFixed(2), cx, cy + 8);
  };
  var makeKnob = (trackId, key, label, min, max, initVal) => {
    const canvas = document.createElement("canvas");
    canvas.width = 42;
    canvas.height = 42;
    canvas.style.cursor = "ns-resize";
    canvas.title = label;
    if (!knobValues[trackId]) knobValues[trackId] = { attack: 0.02, release: 0.3, detune: 0 };
    knobValues[trackId][key] = initVal;
    drawKnob(canvas, initVal, min, max, label);
    let startY = 0, startVal = initVal, dragging = false;
    canvas.addEventListener("mousedown", (e) => {
      dragging = true;
      startY = e.clientY;
      startVal = knobValues[trackId][key];
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const newVal = Math.min(max, Math.max(min, startVal + (startY - e.clientY) / 150 * (max - min)));
      knobValues[trackId][key] = newVal;
      drawKnob(canvas, newVal, min, max, label);
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    canvas.addEventListener("dblclick", () => {
      knobValues[trackId][key] = initVal;
      drawKnob(canvas, initVal, min, max, label);
    });
    return canvas;
  };
  var NOTE_OPTIONS = NOTES.map((n) => `<option value="${n}">${n}</option>`).join("");
  var buildUI = () => {
    const root = document.getElementById("sequencer-root");
    root.innerHTML = "";
    TRACK_DEFS.forEach((track) => {
      const container = document.createElement("div");
      container.className = "track-container";
      const ctrl = document.createElement("div");
      ctrl.className = "track-controls";
      ctrl.innerHTML = `
            <div class="track-header">
                <strong>${track.label}</strong>
                <input type="range" class="vol-slider" id="${track.id}-vol" min="0" max="100" value="80" title="Volume">
            </div>
            ${track.type === "synth" ? `
                <select id="${track.id}-inst">
                    ${Object.entries(INSTRUMENTS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
                    <option value="custom">\u2014 Custom \u2014</option>
                </select>
                <div class="synth-params">
                    <select id="${track.id}-wave">
                        <option value="sawtooth">SAW</option>
                        <option value="square">SQR</option>
                        <option value="sine">SIN</option>
                        <option value="triangle">TRI</option>
                    </select>
                    <input type="number" id="${track.id}-filter" value="2000" style="width:55px" title="Filter Hz"> Hz
                </div>
                <div class="knob-row" id="knobs-${track.id}"></div>
            ` : ""}
        `;
      container.appendChild(ctrl);
      const grid = document.createElement("div");
      grid.className = track.type === "drum" ? "grid drum-grid" : "grid synth-grid";
      if (track.type === "drum") {
        for (let i = 0; i < STEPS; i++) {
          const key = `${track.id}-${i}`;
          const cell = document.createElement("div");
          cell.className = "cell" + (activeData[key] ? " active-drum" : "");
          cell.dataset.step = String(i);
          cell.id = key;
          cell.addEventListener("click", () => toggleDrum(cell, track.label, track.id));
          grid.appendChild(cell);
        }
      } else {
        for (let i = 0; i < STEPS; i++) {
          const key = `${track.id}-${i}`;
          const sel = document.createElement("select");
          sel.className = "step-note" + (activeData[key] ? " has-note" : "");
          sel.id = key;
          sel.dataset.step = String(i);
          sel.innerHTML = `<option value="">\u2014</option>${NOTE_OPTIONS}`;
          sel.value = activeData[key] ?? "";
          sel.addEventListener("change", () => onNoteSelect(sel, track.id));
          grid.appendChild(sel);
        }
      }
      container.appendChild(grid);
      root.appendChild(container);
      if (track.type === "synth") {
        const knobRow = document.getElementById(`knobs-${track.id}`);
        if (knobRow) {
          KNOB_DEFS.forEach(({ key, label, min, max, default: def }) => {
            knobRow.appendChild(makeKnob(track.id, key, label, min, max, def));
          });
        }
        document.getElementById(`${track.id}-inst`)?.addEventListener("change", (e) => {
          applyPreset(track.id, e.target.value);
          scheduleNotify();
        });
        ["wave", "filter", "vol"].forEach((field) => {
          document.getElementById(`${track.id}-${field}`)?.addEventListener("change", () => scheduleNotify());
        });
      } else {
        document.getElementById(`${track.id}-vol`)?.addEventListener("change", () => scheduleNotify());
      }
    });
  };
  var toggleDrum = (el, drumLabel, trackId) => {
    const key = el.id;
    if (activeData[key]) {
      delete activeData[key];
      el.classList.remove("active-drum");
    } else {
      activeData[key] = drumLabel;
      el.classList.add("active-drum");
      if (ZsynthPlayer_default.ctx && ZsynthPlayer_default.masterGain) {
        const vol = document.getElementById(`${trackId}-vol`)?.valueAsNumber ?? 80;
        ZsynthPlayer_default.playDrum(drumLabel, 0, vol / 100, ZsynthPlayer_default.masterGain);
      }
    }
    scheduleNotify();
  };
  var onNoteSelect = (sel, trackId) => {
    const step = sel.dataset.step;
    const key = `${trackId}-${step}`;
    if (sel.value) {
      activeData[key] = sel.value;
      sel.classList.add("has-note");
      if (ZsynthPlayer_default.ctx && ZsynthPlayer_default.masterGain) {
        const vol = document.getElementById(`${trackId}-vol`)?.valueAsNumber ?? 80;
        const wave = document.getElementById(`${trackId}-wave`)?.value ?? "square";
        const filter = document.getElementById(`${trackId}-filter`)?.valueAsNumber ?? 2e3;
        const kv = knobValues[trackId] ?? { attack: 0.02, release: 0.3, detune: 0 };
        ZsynthPlayer_default.playSynth(sel.value, 0, { vol, wave, filter, attack: kv.attack, release: kv.release, detune: kv.detune }, ZsynthPlayer_default.masterGain);
      }
    } else {
      delete activeData[key];
      sel.classList.remove("has-note");
    }
    scheduleNotify();
  };
  var applyPreset = (trackId, presetKey) => {
    if (presetKey === "custom") return;
    const p = INSTRUMENTS[presetKey];
    if (!p) return;
    document.getElementById(`${trackId}-wave`).value = p.wave;
    document.getElementById(`${trackId}-filter`).value = String(p.filter);
    if (!knobValues[trackId]) knobValues[trackId] = { attack: 0.02, release: 0.3, detune: 0 };
    knobValues[trackId].attack = p.attack ?? 0.02;
    knobValues[trackId].release = p.release ?? 0.3;
    knobValues[trackId].detune = p.detune ?? 0;
    const knobRow = document.getElementById(`knobs-${trackId}`);
    if (knobRow) {
      KNOB_DEFS.forEach(({ key, min, max, label }, i) => {
        const canvas = knobRow.children[i];
        if (canvas) drawKnob(canvas, knobValues[trackId][key], min, max, label);
      });
    }
  };
  var getCurrentSong = () => {
    const bpm = document.getElementById("bpm")?.value ?? "120";
    const config = {};
    TRACK_DEFS.forEach((t) => {
      const vol = document.getElementById(`${t.id}-vol`)?.value ?? "80";
      const entry = { vol };
      if (t.type === "synth") {
        const kv = knobValues[t.id] ?? { attack: 0.02, release: 0.3, detune: 0 };
        entry["wave"] = document.getElementById(`${t.id}-wave`)?.value ?? "square";
        entry["filter"] = document.getElementById(`${t.id}-filter`)?.value ?? "2000";
        entry["inst"] = document.getElementById(`${t.id}-inst`)?.value ?? "custom";
        entry["attack"] = kv.attack;
        entry["release"] = kv.release;
        entry["detune"] = kv.detune;
      }
      config[t.id] = entry;
    });
    return { bpm, activeData: { ...activeData }, config };
  };
  var loadSong = (text) => {
    const raw = parseZsong(text);
    const bpmEl = document.getElementById("bpm");
    if (bpmEl) bpmEl.value = raw.bpm || "120";
    activeData = {};
    Object.entries(raw.activeData).forEach(([key, val]) => {
      const parts = key.split("-");
      if (parts.length >= 3) {
        activeData[`${parts[0]}-${parts[parts.length - 1]}`] = parts.slice(1, -1).join("-");
      } else {
        activeData[key] = String(val);
      }
    });
    buildUI();
    if (raw.config) {
      Object.entries(raw.config).forEach(([tid, conf]) => {
        const c = conf;
        const volEl = document.getElementById(`${tid}-vol`);
        if (volEl) volEl.value = String(c["vol"] ?? 80);
        if (tid.startsWith("synth")) {
          const instEl = document.getElementById(`${tid}-inst`);
          const waveEl = document.getElementById(`${tid}-wave`);
          const filtEl = document.getElementById(`${tid}-filter`);
          if (instEl) instEl.value = String(c["inst"] ?? "custom");
          if (waveEl) waveEl.value = String(c["wave"] ?? "square");
          if (filtEl) filtEl.value = String(c["filter"] ?? 2e3);
          if (!knobValues[tid]) knobValues[tid] = { attack: 0.02, release: 0.3, detune: 0 };
          knobValues[tid].attack = Number(c["attack"] ?? 0.02);
          knobValues[tid].release = Number(c["release"] ?? 0.3);
          knobValues[tid].detune = Number(c["detune"] ?? 0);
          const knobRow = document.getElementById(`knobs-${tid}`);
          if (knobRow) {
            KNOB_DEFS.forEach(({ key, min, max, label }, i) => {
              const canvas = knobRow.children[i];
              if (canvas) drawKnob(canvas, knobValues[tid][key], min, max, label);
            });
          }
        }
      });
    }
  };
  var scheduleNotify = () => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      vscode.postMessage({ type: "change", content: songToZsong(getCurrentSong()) });
    }, 300);
  };
  document.getElementById("btn-play")?.addEventListener("click", () => {
    ZsynthPlayer_default.init({ preview: getCurrentSong() });
    ZsynthPlayer_default.onStep = (step) => {
      document.querySelectorAll(".playing").forEach((c) => c.classList.remove("playing"));
      document.querySelectorAll(`[data-step="${step}"]`).forEach((c) => c.classList.add("playing"));
      const display = document.getElementById("step-display");
      if (display) display.textContent = `Step ${step + 1}`;
    };
    ZsynthPlayer_default.play("preview");
  });
  document.getElementById("btn-stop")?.addEventListener("click", () => {
    ZsynthPlayer_default.stop();
    document.querySelectorAll(".playing").forEach((c) => c.classList.remove("playing"));
    const display = document.getElementById("step-display");
    if (display) display.textContent = "";
  });
  document.getElementById("bpm")?.addEventListener("change", () => scheduleNotify());
  window.addEventListener("message", (e) => {
    const msg = e.data;
    if (msg.type === "load" && msg.content !== void 0) {
      loadSong(msg.content);
    }
  });
  buildUI();
  vscode.postMessage({ type: "ready" });
})();
//# sourceMappingURL=tracker.js.map
