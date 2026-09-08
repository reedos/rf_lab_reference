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
    imdPlane: document.getElementById("imd-plane"),
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
  let calculation = [];
  let previousImdUnit = 'dbc', previousImdPlane = 'input';
  const savedIds = ['imd-tone','imd-im3','imd-unit','imd-plane','imd-gain','p1-gain','p1-pin','p1-pout','p1-meas','thd-fund','thd-h2','thd-h3','thd-h4','thd-h5'];
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

  function copyText(text) { if (text && Bench.valid) Bench.copy(text); }

  function setPanel(name) {
    state.panel = name;
    Object.keys(els.panels).forEach(function (key) {
      els.panels[key].hidden = key !== name;
    });
    els.tabs.forEach(function (btn) {
      if (!btn.getAttribute("data-panel")) return;
      btn.classList.toggle("is-active", btn.getAttribute("data-panel") === name);
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-panel") === name));
    });
    compute();
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
    if (q.get('p1from') === 'pout') state.p1Source = 'pout';
    savedIds.forEach(id => {
      if (!q.has(id)) return;
      const el = document.getElementById(id), value = q.get(id);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === value)) el.value = value;
    });
    previousImdUnit = els.imdUnit.value;
    previousImdPlane = els.imdPlane.value;
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("tab", state.panel);
    q.set("m", state.drive);
    q.set("z", String(state.z0));
    q.set("t", String(state.toneDbm));
    q.set('p1from', state.p1Source);
    savedIds.forEach(id => q.set(id, document.getElementById(id).value));
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
    if (!(tt.vppOne > 0) || !Number.isFinite(tt.vppEnv)) {
      els.ttMetrics.innerHTML = metric('Status', 'Power is outside the supported numeric range.');
      return;
    }
    calculation = ['Two equal CW tones, matched real loads, complementary drive when differential.',
      `Per-tone power = ${state.toneDbm} dBm; Z₀ = ${z0} Ω per port.`,
      `Vpp,CW = 2√2 × √(10^(${state.toneDbm}/10)/1000 × ${z0})${state.drive === 'diff' ? ' × 2 (differential)' : ''} = ${RF.formatVoltage(tt.vppOne)}`,
      `Vpp,envelope = 2 × Vpp,CW = ${RF.formatVoltage(tt.vppEnv)}`,
      `Paverage = Ptone + 10 log₁₀2 = ${RF.formatDbm(tt.dbmPortAvg)} dBm per port`,
      `PEP = Ptone + 10 log₁₀4 = ${RF.formatDbm(tt.dbmPortPep)} dBm per port`,
      'Peak envelope power is 3.0103 dB above two-tone average power.'];
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
    const tone = RF.parseNumber(els.imdTone.value), im3 = RF.parseNumber(els.imdIm3.value), gain = RF.parseNumber(els.imdGain.value);
    const plane = els.imdPlane.value, unit = els.imdUnit.value;
    const ip3 = RF.ip3Measurement(tone, im3, gain, plane, unit);
    if (!ip3 || (els.imdGain.value.trim() && !Number.isFinite(gain))) {
      els.imdMetrics.innerHTML = metric('Status', 'Enter valid tone and IM3 levels (IM3 ≤ tone). Gain is required for input tones with absolute output IM3.');
      return;
    }
    const number = v => Number.isFinite(v) ? RF.formatDbm(v) + ' dBm' : 'enter gain';
    els.imdMetrics.innerHTML = [metric('Δ (output tone − IM3)', RF.trimFixed(ip3.delta, 3) + ' dB'),
      metric('IM3 at output', number(ip3.im3Output)), metric('IIP3', number(ip3.iip3)), metric('OIP3', number(ip3.oip3)),
      metric('IM3 relative to output tone', RF.trimFixed(ip3.im3Dbc, 3) + ' dBc'),
      metric('Approx. OP1dB (cubic model)', number(ip3.oip3 - 10))].join('');
    calculation = ['Small-signal third-order extrapolation; two equal tones, IM3 measured at DUT output.',
      `Tone reference: DUT ${plane}; each tone = ${tone} dBm. Gain = ${Number.isFinite(gain) ? gain + ' dB' : 'unspecified'}.`,
      unit === 'dbc' ? `Δ = −IM3(dBc) = −(${im3}) = ${ip3.delta} dB` : `Δ = Pout,tone − Pout,IM3 = ${ip3.outputTone} − (${im3}) = ${ip3.delta} dB`,
      `${plane === 'input' ? 'IIP3' : 'OIP3'} = Ptone + Δ/2 = ${tone} + ${ip3.delta}/2 = ${tone + ip3.delta / 2} dBm`,
      `IIP3 = ${number(ip3.iip3)}; OIP3 = IIP3 + gain = ${number(ip3.oip3)}`,
      'OP1dB ≈ OIP3 − 10 dB is only a cubic-model rule of thumb.'];
    lastLine = `IMD3 | tones at DUT ${plane}: ${tone} dBm | output IM3 ${ip3.im3Dbc} dBc | IIP3 ${number(ip3.iip3)} | OIP3 ${number(ip3.oip3)}`;
  }

  function computeP1() {
    const gain = RF.parseNumber(els.p1Gain.value);
    const pin = RF.parseNumber(els.p1Pin.value);
    const pout = RF.parseNumber(els.p1Pout.value);
    const meas = RF.parseNumber(els.p1Meas.value);
    let p1 = null;
    if (state.p1Source === "pout") p1 = RF.p1dbFromOutput(gain, pout);
    else p1 = RF.p1dbFromInput(gain, pin);
    if (!p1 || !Number.isFinite(p1.pout1dB) || !Number.isFinite(p1.poutLinear) || (els.p1Meas.value.trim() && !Number.isFinite(meas))) {
      els.p1Metrics.innerHTML = metric("Status", "Enter G₀ and a P1dB");
      lastLine = "";
      return;
    }
    if (state.p1Source !== 'pin') els.p1Pin.value = String(Number(p1.pin1dB.toPrecision(12)));
    if (state.p1Source !== 'pout') els.p1Pout.value = String(Number(p1.pout1dB.toPrecision(12)));

    calculation = ['CW compression point; G₀ is small-signal power gain in dB.',
      `OP1dB = IP1dB + G₀ − 1 = ${p1.pin1dB} + ${gain} − 1 = ${p1.pout1dB} dBm`,
      `Uncompressed output at IP1dB = ${p1.pin1dB} + ${gain} = ${p1.poutLinear} dBm`,
      'OIP3 ≈ OP1dB + 10 dB is an estimate, not a measured intercept.'];
    const rows = [
      metric("IP1dB", `${RF.formatDbm(p1.pin1dB)} dBm`),
      metric("OP1dB", `${RF.formatDbm(p1.pout1dB)} dBm`),
      metric("Linear P<sub>out</sub> at IP1dB", `${RF.formatDbm(p1.poutLinear)} dBm`),
      metric("Thumb OIP3", `${RF.formatDbm(p1.pout1dB + 10)} dBm`)
    ];
    const cmp = RF.compressionAt(gain, p1.pin1dB, meas);
    if (cmp) {
      calculation.push(`Compression = Pin + G₀ − Pout,measured = ${p1.pin1dB} + ${gain} − (${meas}) = ${cmp.compression} dB`);
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
    if (!thd.count || !Number.isFinite(thd.percent) || (els.thdFund.value.trim() && !Number.isFinite(fund)) || harmonics.some((h, i) => [els.thdH2, els.thdH3, els.thdH4, els.thdH5][i].value.trim() && !Number.isFinite(h))) {
      els.thdMetrics.innerHTML = metric("Status", "Enter at least one harmonic in dBc");
      lastLine = "";
      return;
    }
    calculation = ['Harmonics are power ratios in dBc relative to the fundamental; blank harmonics are omitted.',
      `THD ratio = √(Σ 10^(Hn/10)) = √(${harmonics.filter(Number.isFinite).map(h => `10^(${h}/10)`).join(' + ')}) = ${thd.ratio}`,
      `THD % = 100 × ratio = ${thd.percent}%`,
      `THD dB = 20 log₁₀(ratio) = ${thd.db} dB`,
      'Harmonic measurements must use a consistent power reference; receiver distortion is not removed.'];
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
    lastLine = ''; calculation = [];
    if (state.panel === "twotone") computeTwoTone();
    else if (state.panel === "imd3") computeImd();
    else if (state.panel === "p1db") computeP1();
    else computeThd();
    Bench.update({ valid: Boolean(lastLine), lines: lastLine ? calculation : ['Correct the active calculator inputs before saving or copying.'] });
    if (lastLine) writeQuery();
  }

  document.querySelectorAll(".board > .board-toolbar [data-panel]").forEach(function (btn) {
    btn.addEventListener("click", function () { setPanel(btn.getAttribute("data-panel")); });
  });

  els.btnSe.addEventListener("click", function () { state.drive = "se"; compute(); });
  els.btnDiff.addEventListener("click", function () { state.drive = "diff"; compute(); });
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

  [els.imdTone, els.imdIm3, els.imdGain].forEach(function (el) {
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  els.imdUnit.addEventListener('change', function () {
    const measurement = RF.ip3Measurement(RF.parseNumber(els.imdTone.value), RF.parseNumber(els.imdIm3.value), RF.parseNumber(els.imdGain.value), els.imdPlane.value, previousImdUnit);
    const value = measurement && (els.imdUnit.value === 'dbc' ? measurement.im3Dbc : measurement.im3Output);
    els.imdIm3.value = Number.isFinite(value) ? String(value) : '';
    previousImdUnit = els.imdUnit.value; compute();
  });
  els.imdPlane.addEventListener('change', function () {
    const gain = RF.parseNumber(els.imdGain.value), tone = RF.parseNumber(els.imdTone.value);
    if (previousImdPlane !== els.imdPlane.value) els.imdTone.value = Number.isFinite(gain) && Number.isFinite(tone) ? String(tone + (els.imdPlane.value === 'output' ? gain : -gain)) : '';
    previousImdPlane = els.imdPlane.value; compute();
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
    if (Bench.valid) { writeQuery(); copyText(window.location.href, "Link copied"); }
  });

  readQuery();
  els.z0.value = String(state.z0);
  els.toneDbm.value = String(state.toneDbm);
  setPanel(state.panel);
})();
