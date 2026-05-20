"use strict";
(() => {
  // tracker-view/zsound-main.ts
  var vscode = acquireVsCodeApi();
  var _type = "heli";
  var actx = null;
  var analyser = null;
  var animId = null;
  var notifyTimer = null;
  var birdTimer = null;
  var buildCurve = (clip) => {
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i * 2 / 255 - 1;
      c[i] = Math.max(-1, Math.min(1, x * (1 + clip * 8)));
    }
    return c;
  };
  var makeNoiseBuf = (ctx) => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
  var stopAll = () => {
    if (birdTimer) {
      clearTimeout(birdTimer);
      birdTimer = null;
    }
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (actx) {
      try {
        actx.close();
      } catch (_) {
      }
      actx = null;
      analyser = null;
    }
    const status = document.getElementById("status");
    if (status) status.textContent = "";
    clearCanvases();
  };
  var clearCanvases = () => {
    ["cv-wave", "cv-spec"].forEach((id) => {
      const cv = document.getElementById(id);
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, cv.width, cv.height);
      }
    });
  };
  var getParams = () => {
    const type = _type;
    if (type === "heli") return {
      type: "heli",
      blades: parseInt(document.getElementById("heli-blades").value, 10),
      clip: parseFloat(document.getElementById("heli-clip").value),
      filterCut: parseFloat(document.getElementById("heli-filterCut").value),
      filterQ: parseFloat(document.getElementById("heli-filterQ").value)
    };
    if (type === "ornithopter") return {
      type: "ornithopter",
      flapFiltFreq: parseFloat(document.getElementById("orn-flapFiltFreq").value),
      flapFiltQ: parseFloat(document.getElementById("orn-flapFiltQ").value),
      lfoFreq: parseFloat(document.getElementById("orn-lfoFreq").value),
      lfoGain: parseFloat(document.getElementById("orn-lfoGain").value)
    };
    if (type === "wind") return {
      type: "wind",
      filterCut: parseFloat(document.getElementById("wind-filterCut").value),
      filterQ: parseFloat(document.getElementById("wind-filterQ").value)
    };
    return {
      type: "birds",
      pitch: parseFloat(document.getElementById("birds-pitch").value),
      rate: parseFloat(document.getElementById("birds-rate").value),
      birdType: document.getElementById("birds-birdType").value
    };
  };
  var play = () => {
    stopAll();
    const p = getParams();
    actx = new AudioContext();
    analyser = actx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.connect(actx.destination);
    const master = actx.createGain();
    master.gain.value = 0.7;
    master.connect(analyser);
    const status = document.getElementById("status");
    if (p.type === "heli") {
      const freq = 220 / 60 * p.blades;
      const osc = actx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const shaper = actx.createWaveShaper();
      shaper.curve = buildCurve(p.clip);
      shaper.oversample = "4x";
      const filt = actx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = p.filterCut;
      filt.Q.value = p.filterQ;
      osc.connect(shaper);
      shaper.connect(filt);
      filt.connect(master);
      osc.start();
      if (status) status.textContent = "Rotor @ " + freq.toFixed(1) + " Hz";
    } else if (p.type === "ornithopter") {
      const noiseSrc = actx.createBufferSource();
      noiseSrc.buffer = makeNoiseBuf(actx);
      noiseSrc.loop = true;
      const flapFilt = actx.createBiquadFilter();
      flapFilt.type = "bandpass";
      flapFilt.frequency.value = p.flapFiltFreq;
      flapFilt.Q.value = p.flapFiltQ;
      const flapEnv = actx.createGain();
      flapEnv.gain.value = 0.5;
      const lfo = actx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = p.lfoFreq;
      const lfoGain = actx.createGain();
      lfoGain.gain.value = p.lfoGain;
      lfo.connect(lfoGain);
      lfoGain.connect(flapEnv.gain);
      noiseSrc.connect(flapFilt);
      flapFilt.connect(flapEnv);
      flapEnv.connect(master);
      noiseSrc.start();
      lfo.start();
      if (status) status.textContent = "Flap @ " + p.lfoFreq.toFixed(2) + " Hz";
    } else if (p.type === "wind") {
      const windSrc = actx.createBufferSource();
      windSrc.buffer = makeNoiseBuf(actx);
      windSrc.loop = true;
      const windFilt = actx.createBiquadFilter();
      windFilt.type = "lowpass";
      windFilt.frequency.value = p.filterCut;
      windFilt.Q.value = p.filterQ;
      windSrc.connect(windFilt);
      windFilt.connect(master);
      windSrc.start();
      if (status) status.textContent = "Wind noise";
    } else if (p.type === "birds") {
      scheduleBird(p, master);
      if (status) status.textContent = "Birds @ " + p.rate.toFixed(2) + "/s";
    }
    startVis();
  };
  var scheduleBird = (p, master) => {
    if (!actx) return;
    chirp(p, master);
    const ms = 1e3 / p.rate;
    birdTimer = setTimeout(() => scheduleBird(p, master), ms + (Math.random() - 0.5) * ms * 0.4);
  };
  var chirp = (p, master) => {
    if (!actx) return;
    const t = actx.currentTime;
    const dur = p.birdType === "seagull" ? 0.35 : p.birdType === "crow" ? 0.2 : 0.12;
    const sweep = p.birdType === "seagull" ? -200 : p.birdType === "crow" ? -100 : 300;
    const osc = actx.createOscillator();
    osc.type = p.birdType === "crow" ? "square" : "sine";
    osc.frequency.setValueAtTime(p.pitch, t);
    osc.frequency.linearRampToValueAtTime(p.pitch + sweep, t + dur);
    const env = actx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.6, t + 0.01);
    env.gain.exponentialRampToValueAtTime(1e-3, t + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };
  var startVis = () => {
    if (!analyser) return;
    const cvW = document.getElementById("cv-wave");
    const cvS = document.getElementById("cv-spec");
    const cW = cvW.getContext("2d");
    const cS = cvS.getContext("2d");
    const bufLen = analyser.frequencyBinCount;
    const timeBuf = new Uint8Array(bufLen);
    const freqBuf = new Uint8Array(bufLen);
    const draw = () => {
      animId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(timeBuf);
      analyser.getByteFrequencyData(freqBuf);
      cW.fillStyle = "#111";
      cW.fillRect(0, 0, cvW.width, cvW.height);
      cW.strokeStyle = "#4a90d9";
      cW.lineWidth = 1.5;
      cW.beginPath();
      const sliceW = cvW.width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const y = timeBuf[i] / 128 * (cvW.height / 2);
        if (i === 0) cW.moveTo(x, y);
        else cW.lineTo(x, y);
        x += sliceW;
      }
      cW.stroke();
      cS.fillStyle = "#111";
      cS.fillRect(0, 0, cvS.width, cvS.height);
      const barW = Math.max(1, cvS.width / bufLen * 2.5);
      let bx = 0;
      for (let j = 0; j < bufLen; j++) {
        const bh = freqBuf[j] / 255 * cvS.height;
        cS.fillStyle = "hsl(" + Math.floor(j / bufLen * 240) + ",80%,50%)";
        cS.fillRect(bx, cvS.height - bh, barW - 1, bh);
        bx += barW;
        if (bx > cvS.width) break;
      }
    };
    draw();
  };
  var showGroup = (type) => {
    ["heli", "ornithopter", "wind", "birds"].forEach((t) => {
      const el = document.getElementById("pg-" + t);
      if (el) el.classList.toggle("visible", t === type);
    });
  };
  var bindSlider = (id, dec) => {
    const el = document.getElementById(id);
    const vEl = document.getElementById(id + "-v");
    if (!el || !vEl) return;
    el.addEventListener("input", () => {
      vEl.textContent = parseFloat(el.value).toFixed(dec);
      scheduleNotify();
    });
  };
  var scheduleNotify = () => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      vscode.postMessage({ type: "change", content: JSON.stringify(getParams()) });
    }, 300);
  };
  var loadData = (json) => {
    let p;
    try {
      p = JSON.parse(json);
    } catch (_) {
      return;
    }
    _type = p.type ?? "heli";
    showGroup(_type);
    const setSlider = (id, val, dec) => {
      if (val === void 0) return;
      const el = document.getElementById(id);
      const vEl = document.getElementById(id + "-v");
      if (el) {
        el.value = String(val);
        if (vEl) vEl.textContent = val.toFixed(dec);
      }
    };
    const setSel = (id, val) => {
      if (val === void 0) return;
      const el = document.getElementById(id);
      if (el) el.value = String(val);
    };
    if (p.type === "heli") {
      setSel("heli-blades", p.blades);
      setSlider("heli-clip", p.clip, 1);
      setSlider("heli-filterCut", p.filterCut, 0);
      setSlider("heli-filterQ", p.filterQ, 1);
    } else if (p.type === "ornithopter") {
      setSlider("orn-flapFiltFreq", p.flapFiltFreq, 0);
      setSlider("orn-flapFiltQ", p.flapFiltQ, 1);
      setSlider("orn-lfoFreq", p.lfoFreq, 2);
      setSlider("orn-lfoGain", p.lfoGain, 2);
    } else if (p.type === "wind") {
      setSlider("wind-filterCut", p.filterCut, 0);
      setSlider("wind-filterQ", p.filterQ, 2);
    } else if (p.type === "birds") {
      setSlider("birds-pitch", p.pitch, 0);
      setSlider("birds-rate", p.rate, 2);
      setSel("birds-birdType", p.birdType);
    }
  };
  document.getElementById("btn-play")?.addEventListener("click", play);
  document.getElementById("btn-stop")?.addEventListener("click", stopAll);
  bindSlider("heli-clip", 1);
  bindSlider("heli-filterCut", 0);
  bindSlider("heli-filterQ", 1);
  bindSlider("orn-flapFiltFreq", 0);
  bindSlider("orn-flapFiltQ", 1);
  bindSlider("orn-lfoFreq", 2);
  bindSlider("orn-lfoGain", 2);
  bindSlider("wind-filterCut", 0);
  bindSlider("wind-filterQ", 2);
  bindSlider("birds-pitch", 0);
  bindSlider("birds-rate", 2);
  document.getElementById("heli-blades")?.addEventListener("change", scheduleNotify);
  document.getElementById("birds-birdType")?.addEventListener("change", scheduleNotify);
  window.addEventListener("message", (e) => {
    if (e.data.type === "load" && e.data.content !== void 0) loadData(e.data.content);
  });
  clearCanvases();
  vscode.postMessage({ type: "ready" });
})();
//# sourceMappingURL=zsound.js.map
