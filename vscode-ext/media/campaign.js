"use strict";
(() => {
  // editor-view-entry/campaign-main.ts
  var vscode = acquireVsCodeApi();
  var campaign = null;
  var notifyTimer = null;
  var getPath = (obj, path) => path.split(".").reduce((o, k) => o == null ? void 0 : o[isNaN(Number(k)) ? k : +k], obj);
  var setPath = (obj, path, val) => {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = isNaN(Number(keys[i])) ? keys[i] : +keys[i];
      cur = cur[k];
    }
    const last = keys[keys.length - 1];
    cur[isNaN(Number(last)) ? last : +last] = val;
  };
  var scheduleNotify = () => {
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      vscode.postMessage({ type: "change", content: JSON.stringify(campaign, null, 2) });
    }, 300);
  };
  var onInput = (e) => {
    const target = e.target;
    const path = target.dataset["path"];
    if (!path || !campaign) return;
    const val = target.type === "number" ? Number(target.value) : target.value;
    setPath(campaign, path, val);
    if (path.startsWith("levels.") && path.endsWith(".headline.de")) {
      const idx = +path.split(".")[1];
      const titles = document.querySelectorAll(".mission-name");
      if (titles[idx]) titles[idx].textContent = val || "\u2014";
    }
    scheduleNotify();
  };
  var buildHtml = () => {
    if (!campaign) return "";
    const sub = campaign["campaignSublines"] ?? [];
    const levels = campaign["levels"] ?? [];
    const sublineRows = sub.map(
      (_, i) => '<div class="row"><div class="field-group"><label>Subline ' + (i + 1) + ' (DE)</label><input data-path="campaignSublines.' + i + '.de"></div><div class="field-group"><label>Subline ' + (i + 1) + ' (EN)</label><input data-path="campaignSublines.' + i + '.en"></div></div>'
    ).join("");
    const missionItems = levels.map((lvl, i) => {
      const l = lvl;
      const subs = l["sublines"] ?? [];
      const headline = l["headline"];
      const subRows = subs.map(
        (_, j) => '<div class="row"><div class="field-group"><label>Subline ' + (j + 1) + ' (DE)</label><input data-path="levels.' + i + ".sublines." + j + '.de"></div><div class="field-group"><label>Subline ' + (j + 1) + ' (EN)</label><input data-path="levels.' + i + ".sublines." + j + '.en"></div></div>'
      ).join("");
      return '<div class="mission"><div class="mission-toggle"><span class="mission-num">' + (i + 1) + '</span><span class="mission-name">' + (headline && headline["de"] ? headline["de"] : "\u2014") + '</span><span class="chevron">&#9658;</span></div><div class="mission-body" hidden><div class="row"><div class="field-group"><label>&#220;berschrift (DE)</label><input data-path="levels.' + i + '.headline.de"></div><div class="field-group"><label>&#220;berschrift (EN)</label><input data-path="levels.' + i + '.headline.en"></div></div>' + subRows + '<div class="row"><div class="field-group"><label>Briefing (DE)</label><textarea data-path="levels.' + i + '.briefing.de" rows="3"></textarea></div><div class="field-group"><label>Briefing (EN)</label><textarea data-path="levels.' + i + '.briefing.en" rows="3"></textarea></div></div><div class="field-group" style="max-width:110px"><label>Grid-Gr&#246;&#223;e</label><input type="number" data-path="levels.' + i + '.gridSize"></div></div></div>';
    }).join("");
    return '<span class="badge">' + campaign["type"] + '</span><h2>Kampagne</h2><div class="row"><div class="field-group"><label>Titel (DE)</label><input data-path="campaignTitle.de"></div><div class="field-group"><label>Titel (EN)</label><input data-path="campaignTitle.en"></div></div>' + sublineRows + "<h2>Missionen</h2>" + missionItems;
  };
  var render = () => {
    const root = document.getElementById("root");
    if (!root) return;
    root.innerHTML = buildHtml();
    root.querySelectorAll("[data-path]").forEach((el) => {
      if (!campaign) return;
      const path = el.dataset["path"];
      if (path) el.value = String(getPath(campaign, path) ?? "");
      el.addEventListener("input", onInput);
    });
    root.querySelectorAll(".mission-toggle").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const body = toggle.nextElementSibling;
        const chevron = toggle.querySelector(".chevron");
        if (!body) return;
        body.hidden = !body.hidden;
        if (chevron) chevron.textContent = body.hidden ? "\u25B6" : "\u25BC";
      });
    });
  };
  window.addEventListener("message", (e) => {
    if (e.data.type === "load" && e.data.content !== void 0) {
      campaign = JSON.parse(e.data.content);
      render();
    }
  });
  vscode.postMessage({ type: "ready" });
})();
//# sourceMappingURL=campaign.js.map
