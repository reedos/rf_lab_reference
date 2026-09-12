(function () {
  const eq = Bench.equation, tex = Bench.tex, volts = Bench.voltage;
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
      btn.setAttribute("aria-selected", String(btn.getAttribute("data-panel") === name));
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
    savedIds.forEach(id => q.set(id, Bench.raw(id)));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function computeTwoTone() {
    const z0 = Bench.read(els.z0);
    state.z0 = z0;
    state.toneDbm = Bench.read(els.toneDbm);
    els.body.setAttribute("data-drive", state.drive);
    els.btnSe.classList.toggle("is-active", state.drive === "se");
    els.btnDiff.classList.toggle("is-active", state.drive === "diff");
    els.btnSe.setAttribute("aria-pressed", String(state.drive === "se"));
    els.btnDiff.setAttribute("aria-pressed", String(state.drive === "diff"));
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
    calculation = ['Two equal CW tones with matched real loads. Differential drive is complementary; voltage doubles relative to one line.',
      eq('Per-tone input and impedance', String.raw`P_{\mathrm{tone}} &= ${tex(state.toneDbm, 'dBm')} \\ Z_0 &= ${tex(z0, 'Ω')}`),
      eq('CW peak-to-peak voltage', String.raw`V_{\mathrm{pp,CW}} &= ${state.drive === 'diff' ? 4 : 2}\sqrt{2}\sqrt{10^{P_{\mathrm{tone}}/10}\times 10^{-3}Z_0}`, volts(tt.vppOne)),
      eq('Two-tone envelope voltage', String.raw`V_{\mathrm{pp,env}} &= 2V_{\mathrm{pp,CW}}`, volts(tt.vppEnv)),
      eq('Average power per port', String.raw`P_{\mathrm{avg}} &= P_{\mathrm{tone}}+10\log_{10}2`, tex(tt.dbmPortAvg, 'dBm'), String.raw`${tex(state.toneDbm, 'dBm', false)}+10\log_{10}2\,\mathrm{dBm}`),
      eq('Peak envelope power per port', String.raw`P_{\mathrm{PEP}} &= P_{\mathrm{tone}}+10\log_{10}4`, tex(tt.dbmPortPep, 'dBm')),
      'Peak envelope power is 3.01 dB above two-tone average power.'];
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
    const tone = Bench.read(els.imdTone), im3 = Bench.read(els.imdIm3), gain = Bench.read(els.imdGain, true);
    const plane = els.imdPlane.value, unit = els.imdUnit.value;
    const ip3 = RF.ip3Measurement(tone, im3, gain, plane, unit);
    if (!ip3 || (els.imdGain.value.trim() && !Number.isFinite(gain))) {
      els.imdMetrics.innerHTML = metric('Status', 'Enter valid tone and IM3 levels (IM3 ≤ tone). Blank gain means 0 dB; nonblank gain must be numeric.');
      return;
    }
    const number = v => Number.isFinite(v) ? RF.formatDbm(v) + ' dBm' : 'enter gain';
    els.imdMetrics.innerHTML = [metric('Δ (output tone − IM3)', RF.formatNumber(ip3.delta, 'dB') + ' dB'),
      metric('IM3 at output', number(ip3.im3Output)), metric('IIP3', number(ip3.iip3)), metric('OIP3', number(ip3.oip3)),
      metric('IM3 relative to output tone', RF.formatNumber(ip3.im3Dbc, 'dB') + ' dBc'),
      metric('Approx. OP1dB (cubic model)', number(ip3.oip3 - 10))].join('');
    calculation = ['Small-signal third-order extrapolation with two equal tones; IM3 is measured at the DUT output.',
      `Tone reference: DUT ${plane}. Absolute IM3 is output dBm; relative IM3 is dBc relative to one output tone.`,
      eq('Measured tone and gain', String.raw`P_{\mathrm{tone}} &= ${tex(tone, 'dBm')} \\ G &= ${tex(gain, 'dB')}`),
      eq('Tone-to-IM3 separation', unit === 'dbc' ? String.raw`\Delta &= -\mathrm{IM3}_{\mathrm{dBc}}` : String.raw`\Delta &= P_{\mathrm{out,tone}}-P_{\mathrm{out,IM3}}`, tex(ip3.delta, 'dB'), unit === 'dbc' ? String.raw`-(${tex(im3, 'dBc')})` : String.raw`${tex(ip3.outputTone,'dBm',false)}-(${tex(im3,'dBm',false)})\,\mathrm{dB}`),
      eq('Input third-order intercept', String.raw`\mathrm{IIP3} &= P_{\mathrm{in,tone}}+\frac{\Delta}{2}`, tex(ip3.iip3, 'dBm'), String.raw`${tex(plane === 'input' ? tone : tone-gain,'dBm',false)}+\frac{${tex(ip3.delta,'dB',false)}}{2}\,\mathrm{dBm}`),
      eq('Output third-order intercept', String.raw`\mathrm{OIP3} &= \mathrm{IIP3}+G`, tex(ip3.oip3, 'dBm')),
      eq('Approximate compression point', String.raw`\mathrm{OP1dB} &\approx \mathrm{OIP3}-10\,\mathrm{dB}`, tex(ip3.oip3-10, 'dBm')),
      'The compression-point estimate is a cubic-model rule of thumb, not a measurement.'];
    lastLine = `IMD3 | tones at DUT ${plane}: ${RF.formatNumber(tone, 'dB')} dBm | output IM3 ${RF.formatNumber(ip3.im3Dbc, 'dB')} dBc | IIP3 ${number(ip3.iip3)} | OIP3 ${number(ip3.oip3)}`;
  }

  function computeP1() {
    const gain = Bench.read(els.p1Gain, true);
    const pin = Bench.read(els.p1Pin);
    const pout = Bench.read(els.p1Pout);
    const meas = Bench.read(els.p1Meas);
    let p1 = null;
    if (state.p1Source === "pout") p1 = RF.p1dbFromOutput(gain, pout);
    else p1 = RF.p1dbFromInput(gain, pin);
    if (!p1 || !Number.isFinite(p1.pout1dB) || !Number.isFinite(p1.poutLinear) || (els.p1Meas.value.trim() && !Number.isFinite(meas))) {
      els.p1Metrics.innerHTML = metric("Status", "Enter G₀ and a P1dB");
      lastLine = "";
      return;
    }
    if (state.p1Source !== 'pin') Bench.setNumber(els.p1Pin, p1.pin1dB, 'dBm', true);
    if (state.p1Source !== 'pout') Bench.setNumber(els.p1Pout, p1.pout1dB, 'dBm', true);

    calculation = ['CW compression point; G₀ is small-signal power gain in dB.',
      eq('Output compression point', String.raw`\mathrm{OP1dB} &= \mathrm{IP1dB}+G_0-1\,\mathrm{dB}`, tex(p1.pout1dB, 'dBm'), String.raw`${tex(p1.pin1dB,'dBm',false)}+${tex(gain,'dB',false)}-1\,\mathrm{dBm}`),
      eq('Uncompressed output at IP1dB', String.raw`P_{\mathrm{out,linear}} &= \mathrm{IP1dB}+G_0`, tex(p1.poutLinear,'dBm')),
      eq('Approximate output intercept', String.raw`\mathrm{OIP3} &\approx \mathrm{OP1dB}+10\,\mathrm{dB}`, tex(p1.pout1dB+10,'dBm')),
      'The intercept estimate is a cubic-model rule of thumb, not a measured intercept.'];
    const rows = [
      metric("IP1dB", `${RF.formatDbm(p1.pin1dB)} dBm`),
      metric("OP1dB", `${RF.formatDbm(p1.pout1dB)} dBm`),
      metric("Linear P<sub>out</sub> at IP1dB", `${RF.formatDbm(p1.poutLinear)} dBm`),
      metric("Thumb OIP3", `${RF.formatDbm(p1.pout1dB + 10)} dBm`)
    ];
    const cmp = RF.compressionAt(gain, p1.pin1dB, meas);
    if (cmp) {
      calculation.push(eq('Measured compression', String.raw`C &= P_{\mathrm{in}}+G_0-P_{\mathrm{out,meas}}`, tex(cmp.compression,'dB'), String.raw`${tex(p1.pin1dB,'dBm',false)}+${tex(gain,'dB',false)}-(${tex(meas,'dBm',false)})\,\mathrm{dB}`));
      rows.push(metric("Measured gain", `${RF.formatNumber(cmp.gainMeas, 'dB')} dB`));
      rows.push(metric("Compression", `${RF.formatNumber(cmp.compression, 'dB')} dB`));
    }
    els.p1Metrics.innerHTML = rows.join("");
    lastLine = `P1dB | G0 ${RF.formatNumber(p1.gainDb, 'dB')} dB | IP1dB ${RF.formatDbm(p1.pin1dB)} dBm | OP1dB ${RF.formatDbm(p1.pout1dB)} dBm`;
  }

  function computeThd() {
    const fund = Bench.read(els.thdFund);
    const harmonics = [els.thdH2, els.thdH3, els.thdH4, els.thdH5].map(function (el) {
      return Bench.read(el);
    });
    const thd = RF.thdFromDbc(harmonics);
    if (!thd.count || !Number.isFinite(thd.percent) || (els.thdFund.value.trim() && !Number.isFinite(fund)) || harmonics.some((h, i) => [els.thdH2, els.thdH3, els.thdH4, els.thdH5][i].value.trim() && !Number.isFinite(h))) {
      els.thdMetrics.innerHTML = metric("Status", "Enter at least one harmonic in dBc");
      lastLine = "";
      return;
    }
    calculation = ['Harmonics are power ratios in dBc relative to the fundamental. Blank harmonics are omitted.',
      eq('Root-sum-square harmonic ratio', String.raw`r_{\mathrm{THD}} &= \sqrt{\sum_{n\ge 2}10^{H_n/10}}`, tex(thd.ratio), String.raw`\sqrt{${harmonics.filter(Number.isFinite).map(h => String.raw`10^{${tex(h,'dBc',false)}/10}`).join(' + ')}}`),
      eq('Total harmonic distortion', String.raw`\mathrm{THD}_{\%} &= 100\,r_{\mathrm{THD}}`, tex(thd.percent,'%')),
      eq('Distortion level', String.raw`\mathrm{THD}_{\mathrm{dB}} &= 20\log_{10}r_{\mathrm{THD}}`, tex(thd.db,'dB')),
      'Use a consistent power reference for every harmonic measurement. Receiver distortion is not removed.'];
    const h2 = harmonics[0];
    const rows = [
      metric("THD", `${RF.formatNumber(thd.percent)} %`),
      metric("THD", Number.isFinite(thd.db) ? `${RF.formatNumber(thd.db, 'dB')} dB` : "—"),
      metric("Harmonics used", String(thd.count))
    ];
    if (Number.isFinite(fund) && Number.isFinite(h2)) {
      rows.push(metric("H2 absolute", `${RF.formatDbm(fund + h2)} dBm`));
    }
    els.thdMetrics.innerHTML = rows.join("");
    lastLine = `THD ${RF.formatNumber(thd.percent)} % (${RF.formatNumber(thd.db, 'dB')} dB) | ${thd.count} harmonic(s)`;
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
      Bench.setNumber(els.z0, Number(chip.getAttribute("data-z")));
      compute();
    });
  });
  els.toneDbm.addEventListener("input", compute);
  function stepTone(delta) {
    if (!Number.isFinite(state.toneDbm)) state.toneDbm = 0;
    state.toneDbm = Math.round((state.toneDbm + delta) * 100) / 100;
    Bench.setNumber(els.toneDbm, state.toneDbm, 'dBm');
    compute();
  }
  els.toneDec.addEventListener("click", function () { stepTone(-1); });
  els.toneInc.addEventListener("click", function () { stepTone(1); });

  [els.imdTone, els.imdIm3, els.imdGain].forEach(function (el) {
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  els.imdUnit.addEventListener('change', function () {
    const measurement = RF.ip3Measurement(Bench.read(els.imdTone), Bench.read(els.imdIm3), Bench.read(els.imdGain, true), els.imdPlane.value, previousImdUnit);
    const value = measurement && (els.imdUnit.value === 'dbc' ? measurement.im3Dbc : measurement.im3Output);
    if (Number.isFinite(value)) Bench.setNumber(els.imdIm3, value, els.imdUnit.value === 'dbc' ? 'dBc' : 'dBm', true); else els.imdIm3.value = '';
    previousImdUnit = els.imdUnit.value; compute();
  });
  els.imdPlane.addEventListener('change', function () {
    const gain = Bench.read(els.imdGain, true), tone = Bench.read(els.imdTone);
    if (previousImdPlane !== els.imdPlane.value) {
      if (Number.isFinite(gain) && Number.isFinite(tone)) Bench.setNumber(els.imdTone, tone + (els.imdPlane.value === 'output' ? gain : -gain), 'dBm', true);
      else els.imdTone.value = '';
    }
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
