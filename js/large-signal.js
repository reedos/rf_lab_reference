(function () {
  const RF = window.RF;
  const els = {
    body: document.body,
    tabs: Array.prototype.slice.call(document.querySelectorAll("[data-panel]")),
    panels: {
      twotone: document.getElementById("panel-twotone"),
      imd3: document.getElementById("panel-imd3"),
      p1db: document.getElementById("panel-p1db"),
      thd: document.getElementById("panel-thd")
    },
    btnSe: document.getElementById("btn-se"),
    btnDiff: document.getElementById("btn-diff"),
    z0: document.getElementById("z0"),
    chips: Array.prototype.slice.call(document.querySelectorAll("[data-z]")),
    toneScope: document.getElementById("tone-scope"),
    toneDbm: document.getElementById("tone-dbm"),
    toneDec: document.getElementById("tone-dec"),
    toneInc: document.getElementById("tone-inc"),
    ttMetrics: document.getElementById("tt-metrics"),
    imdTone: document.getElementById("imd-tone"),
    imdIm3: document.getElementById("imd-im3"),
    imdUnit: document.getElementById("imd-unit"),
    imdGain: document.getElementById("imd-gain"),
    imdMetrics: document.getElementById("imd-metrics"),
    p1Gain: document.getElementById("p1-gain"),
    p1Pin: document.getElementById("p1-pin"),
    p1Pout: document.getElementById("p1-pout"),
    p1Meas: document.getElementById("p1-meas"),
    p1Metrics: document.getElementById("p1-metrics"),
    thdFund: document.getElementById("thd-fund"),
    thdH2: document.getElementById("thd-h2"),
    thdH3: document.getElementById("thd-h3"),
    thdH4: document.getElementById("thd-h4"),
    thdH5: document.getElementById("thd-h5"),
    thdMetrics: document.getElementById("thd-metrics"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast")
  };

  const state = {
    panel: "twotone",
    drive: "se",
    z0: 50,
    toneDbm: -10,
    p1Source: "pin"
  };
  let lastLine = "";
  let toastTimer = 0;

  function metric(label, value) {
    return `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { els.toast.classList.remove("is-on"); }, 1600);
  }

  function copyText(text, ok) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast(ok); });
    }
  }

  function setPanel(name) {
    state.panel = name;
    Object.keys(els.panels).forEach(function (key) {
      els.panels[key].hidden = key !== name;
    });
    els.tabs.forEach(function (btn) {
      if (!btn.getAttribute("data-panel")) return;
      btn.classList.toggle("is-active", btn.getAttribute("data-panel") === name);
    });
    compute();
    writeQuery();
  }

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const panel = q.get("tab");
    if (panel && els.panels[panel]) state.panel = panel;
    if (q.get("m") === "diff" || q.get("m") === "se") state.drive = q.get("m");
    const z = RF.parseNumber(q.get("z"));
    if (z > 0) state.z0 = z;
    const t = RF.parseNumber(q.get("t"));
    if (Number.isFinite(t)) state.toneDbm = t;
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("tab", state.panel);
    q.set("m", state.drive);
    q.set("z", String(state.z0));
    q.set("t", String(state.toneDbm));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function computeTwoTone() {
    const z0 = RF.parseNumber(els.z0.value);
    state.z0 = z0;
    state.toneDbm = RF.parseNumber(els.toneDbm.value);
    els.body.setAttribute("data-drive", state.drive);
    els.btnSe.classList.toggle("is-active", state.drive === "se");
    els.btnDiff.classList.toggle("is-active", state.drive === "diff");
    els.toneScope.textContent = state.drive === "diff" ? "per port" : "into Z₀";
    els.chips.forEach(function (chip) {
      chip.classList.toggle("is-active", Number(chip.getAttribute("data-z")) === z0);
    });
    if (!(z0 > 0) || !Number.isFinite(state.toneDbm)) {
      els.ttMetrics.innerHTML = metric("Status", "Enter per-tone dBm and Z₀");
      lastLine = "";
      return;
    }
    const tt = RF.twoToneFromToneDbm(state.toneDbm, z0, state.drive);
    const rows = [
      metric("CW VOPP, one tone", RF.formatVoltage(tt.vppOne)),
      metric("Envelope VOPP", RF.formatVoltage(tt.vppEnv)),
      metric("Envelope V<sub>pk</sub>", RF.formatVoltage(tt.vpkEnv)),
      metric(tt.drive === "diff" ? "Per-port average" : "Average (2 tones)", `${RF.formatDbm(tt.dbmPortAvg)} dBm`),
      metric(tt.drive === "diff" ? "Per-port PEP" : "PEP", `${RF.formatDbm(tt.dbmPortPep)} dBm`)
    ];
    if (tt.drive === "diff") {
      rows.push(metric("Total average", `${RF.formatDbm(tt.dbmTotalAvg)} dBm`));
    }
    els.ttMetrics.innerHTML = rows.join("");
    lastLine = `2-tone ${state.drive.toUpperCase()} | ${RF.formatDbm(tt.dbmTone)} dBm/tone | env ${RF.formatVoltage(tt.vppEnv)} pk-pk | PEP ${RF.formatDbm(tt.dbmPortPep)} dBm/port`;
  }

  function computeImd() {
    const tone = RF.parseNumber(els.imdTone.value);
    const im3 = RF.parseNumber(els.imdIm3.value);
    const gain = RF.parseNumber(els.imdGain.value);
    let ip3 = null;
    if (els.imdUnit.value === "dbc") ip3 = RF.ip3FromDbc(tone, im3, gain);
    else ip3 = RF.ip3FromAbs(tone, im3, gain);
    if (!ip3) {
      els.imdMetrics.innerHTML = metric("Status", "Enter tone and IM3");
      lastLine = "";
      return;
    }
    els.imdMetrics.innerHTML = [
      metric("Δ (tone − IM3)", `${RF.trimFixed(ip3.delta, 2)} dB`),
      metric("IM3 absolute", `${RF.formatDbm(ip3.im3Dbm)} dBm`),
      metric("IIP3", `${RF.formatDbm(ip3.iip3)} dBm`),
      metric("OIP3", Number.isFinite(ip3.oip3) ? `${RF.formatDbm(ip3.oip3)} dBm` : "enter gain"),
      metric("IM3 dBc", `${RF.trimFixed(ip3.im3Dbc, 2)} dBc`),
      metric("Thumb OP1dB", Number.isFinite(ip3.p1dbThumb) ? `${RF.formatDbm(ip3.p1dbThumb)} dBm` : "—")
    ].join("");
    lastLine = `IMD3 | Ptone ${RF.formatDbm(ip3.pToneDbm)} dBm | IM3 ${RF.trimFixed(ip3.im3Dbc, 1)} dBc | IIP3 ${RF.formatDbm(ip3.iip3)} dBm` +
      (Number.isFinite(ip3.oip3) ? ` | OIP3 ${RF.formatDbm(ip3.oip3)} dBm` : "");
  }

  function computeP1() {
    const gain = RF.parseNumber(els.p1Gain.value);
    const pin = RF.parseNumber(els.p1Pin.value);
    const pout = RF.parseNumber(els.p1Pout.value);
    const meas = RF.parseNumber(els.p1Meas.value);
    let p1 = null;
    if (state.p1Source === "pout") p1 = RF.p1dbFromOutput(gain, pout);
    else p1 = RF.p1dbFromInput(gain, pin);
    if (!p1) {
      els.p1Metrics.innerHTML = metric("Status", "Enter G₀ and a P1dB");
      lastLine = "";
      return;
    }
    if (document.activeElement !== els.p1Pin) els.p1Pin.value = RF.formatDbm(p1.pin1dB, 2);
    if (document.activeElement !== els.p1Pout) els.p1Pout.value = RF.formatDbm(p1.pout1dB, 2);

    const rows = [
      metric("IP1dB", `${RF.formatDbm(p1.pin1dB)} dBm`),
      metric("OP1dB", `${RF.formatDbm(p1.pout1dB)} dBm`),
      metric("Linear P<sub>out</sub> at IP1dB", `${RF.formatDbm(p1.poutLinear)} dBm`),
      metric("Thumb OIP3", `${RF.formatDbm(p1.pout1dB + 10)} dBm`)
    ];
    const cmp = RF.compressionAt(gain, p1.pin1dB, meas);
    if (cmp) {
      rows.push(metric("Measured gain", `${RF.trimFixed(cmp.gainMeas, 2)} dB`));
      rows.push(metric("Compression", `${RF.trimFixed(cmp.compression, 2)} dB`));
    }
    els.p1Metrics.innerHTML = rows.join("");
    lastLine = `P1dB | G0 ${RF.trimFixed(p1.gainDb, 2)} dB | IP1dB ${RF.formatDbm(p1.pin1dB)} dBm | OP1dB ${RF.formatDbm(p1.pout1dB)} dBm`;
  }

  function computeThd() {
    const fund = RF.parseNumber(els.thdFund.value);
    const harmonics = [els.thdH2, els.thdH3, els.thdH4, els.thdH5].map(function (el) {
      return RF.parseNumber(el.value);
    });
    const thd = RF.thdFromDbc(harmonics);
    if (!thd.count) {
      els.thdMetrics.innerHTML = metric("Status", "Enter at least one harmonic in dBc");
      lastLine = "";
      return;
    }
    const h2 = harmonics[0];
    const rows = [
      metric("THD", `${RF.trimFixed(thd.percent, 3)} %`),
      metric("THD", Number.isFinite(thd.db) ? `${RF.trimFixed(thd.db, 2)} dB` : "—"),
      metric("Harmonics used", String(thd.count))
    ];
    if (Number.isFinite(fund) && Number.isFinite(h2)) {
      rows.push(metric("H2 absolute", `${RF.formatDbm(fund + h2)} dBm`));
    }
    els.thdMetrics.innerHTML = rows.join("");
    lastLine = `THD ${RF.trimFixed(thd.percent, 3)} % (${RF.trimFixed(thd.db, 1)} dB) | ${thd.count} harmonic(s)`;
  }

  function compute() {
    if (state.panel === "twotone") computeTwoTone();
    else if (state.panel === "imd3") computeImd();
    else if (state.panel === "p1db") computeP1();
    else computeThd();
  }

  document.querySelectorAll(".board > .board-toolbar [data-panel]").forEach(function (btn) {
    btn.addEventListener("click", function () { setPanel(btn.getAttribute("data-panel")); });
  });

  els.btnSe.addEventListener("click", function () { state.drive = "se"; compute(); writeQuery(); });
  els.btnDiff.addEventListener("click", function () { state.drive = "diff"; compute(); writeQuery(); });
  els.z0.addEventListener("input", compute);
  els.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      els.z0.value = chip.getAttribute("data-z");
      compute();
    });
  });
  els.toneDbm.addEventListener("input", compute);
  function stepTone(delta) {
    if (!Number.isFinite(state.toneDbm)) state.toneDbm = 0;
    state.toneDbm = Math.round((state.toneDbm + delta) * 100) / 100;
    els.toneDbm.value = RF.formatDbm(state.toneDbm, 2);
    compute();
  }
  els.toneDec.addEventListener("click", function () { stepTone(-1); });
  els.toneInc.addEventListener("click", function () { stepTone(1); });

  [els.imdTone, els.imdIm3, els.imdGain, els.imdUnit].forEach(function (el) {
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  els.p1Gain.addEventListener("input", compute);
  els.p1Pin.addEventListener("input", function () { state.p1Source = "pin"; compute(); });
  els.p1Pout.addEventListener("input", function () { state.p1Source = "pout"; compute(); });
  els.p1Meas.addEventListener("input", compute);

  [els.thdFund, els.thdH2, els.thdH3, els.thdH4, els.thdH5].forEach(function (el) {
    el.addEventListener("input", compute);
  });

  document.querySelectorAll("input").forEach(function (el) {
    el.addEventListener("focus", function (event) { event.target.select(); });
  });

  els.copyResult.addEventListener("click", function () { copyText(lastLine, "Result copied"); });
  els.copyLink.addEventListener("click", function () {
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  els.z0.value = String(state.z0);
  els.toneDbm.value = RF.formatDbm(state.toneDbm, 2);
  setPanel(state.panel);
})();
