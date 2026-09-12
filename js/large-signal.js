(function () {
  const eq = Bench.equation, tex = Bench.tex, volts = Bench.voltage;
  const RF = window.RF;
  const els = {
    body: document.body,
    tabs: Array.prototype.slice.call(document.querySelectorAll("[data-panel]")),
    panels: {
      twotone: document.getElementById("panel-twotone"),
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
    lsPlane: document.getElementById("ls-plane"),
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
    thdUnit: document.getElementById("thd-unit"),
    thdF0: document.getElementById("thd-f0"),
    thdFmax: document.getElementById("thd-fmax"),
    thdBandLow: document.getElementById("thd-band-low"),
    thdBandHigh: document.getElementById("thd-band-high"),
    thdFc: document.getElementById("thd-fc"),
    thdPoles: document.getElementById("thd-poles"),
    thdContam: document.getElementById("thd-contam"),
    thdStatus: document.getElementById("thd-status"),
    thdBandMetrics: document.getElementById("thd-band-metrics"),
    thdHarmonics: document.getElementById("thd-harmonics"),
    toneUnit: document.getElementById("tone-unit"),
    toneF1: document.getElementById("tone-f1"),
    toneF2: document.getElementById("tone-f2"),
    toneDelta: document.getElementById("tone-delta"),
    toneOrder: document.getElementById("tone-order"),
    toneBandLow: document.getElementById("tone-band-low"),
    toneBandHigh: document.getElementById("tone-band-high"),
    toneRbw: document.getElementById("tone-rbw"),
    toneLevel: document.getElementById("tone-level"),
    toneToi: document.getElementById("tone-toi"),
    tonePn: document.getElementById("tone-pn"),
    toneDanl: document.getElementById("tone-danl"),
    toneStatus: document.getElementById("tone-status"),
    toneMetrics: document.getElementById("tone-metrics"),
    toneRows: document.getElementById("tone-rows"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast")
  };

  const state = {
    panel: "twotone",
    drive: "se",
    z0: 50,
    toneDbm: -10,
    p1Source: "pin",
    toneSource: "delta"
  };
  let lastLine = "";
  let calculation = [];
  let previousImdUnit = 'dbc', previousImdPlane = 'input';
  const savedIds = ['imd-im3','imd-unit','ls-plane','imd-gain','p1-gain','p1-pin','p1-pout','p1-meas','thd-fund','thd-h2','thd-h3','thd-h4','thd-h5',
    'thd-unit','thd-f0','thd-fmax','thd-band-low','thd-band-high','thd-fc','thd-poles','thd-contam',
    'tone-unit','tone-f1','tone-f2','tone-delta','tone-order','tone-band-low','tone-band-high','tone-rbw','tone-level','tone-toi','tone-pn','tone-danl'];
  const freqScales = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
  const freqText = hz => RF.formatFrequency(hz).text;
  const yesNo = value => value === null ? '—' : value ? 'Yes' : 'No';
  // Optional fields: blank is allowed, but text that is present must parse.
  function optionalField(el, parse) {
    const text = el.value.trim();
    if (text === '') return { blank: true, value: null, ok: true };
    const value = parse(text);
    return { blank: false, value, ok: Number.isFinite(value) };
  }
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
    const requested = q.get("tab"), panel = requested === 'tones' || requested === 'imd3' ? 'twotone' : requested;
    if (panel && els.panels[panel]) state.panel = panel;
    if (q.get("m") === "diff" || q.get("m") === "se") state.drive = q.get("m");
    const z = RF.parseNumber(q.get("z"));
    if (z > 0) state.z0 = z;
    const t = RF.parseNumber(q.get("t")), legacyTone = RF.parseNumber(q.get("imd-tone"));
    if (Number.isFinite(t)) state.toneDbm = t;
    else if (Number.isFinite(legacyTone)) state.toneDbm = legacyTone;
    if (q.get('p1from') === 'pout') state.p1Source = 'pout';
    if (q.get('tonefrom') === 'f2') state.toneSource = 'f2';
    savedIds.forEach(id => {
      if (!q.has(id)) return;
      const el = document.getElementById(id), value = q.get(id);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === value)) el.value = value;
    });
    if (!q.has('ls-plane') && ['input', 'output'].includes(q.get('imd-plane'))) els.lsPlane.value = q.get('imd-plane');
    previousImdUnit = els.imdUnit.value;
    previousImdPlane = els.lsPlane.value;
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("tab", state.panel);
    q.set("m", state.drive);
    q.set("z", String(state.z0));
    q.set("t", String(state.toneDbm));
    q.set('p1from', state.p1Source);
    q.set('tonefrom', state.toneSource);
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
    els.toneScope.textContent = (state.drive === "diff" ? "per port" : "into Z₀") + ", at the DUT " + els.lsPlane.value;
    els.chips.forEach(function (chip) {
      chip.classList.toggle("is-active", Number(chip.getAttribute("data-z")) === z0);
    });
    if (!(z0 > 0) || !Number.isFinite(state.toneDbm)) {
      els.ttMetrics.innerHTML = metric("Status", "Enter per-tone dBm and Z₀");
      return '';
    }
    const tt = RF.twoToneFromToneDbm(state.toneDbm, z0, state.drive);
    if (!(tt.vppOne > 0) || !Number.isFinite(tt.vppEnv)) {
      els.ttMetrics.innerHTML = metric('Status', 'Power is outside the supported numeric range.');
      return '';
    }
    calculation.push('Two equal CW tones with matched real loads. Differential drive is complementary; voltage doubles relative to one line.',
      eq('Per-tone input and impedance', String.raw`P_{\mathrm{tone}} &= ${tex(state.toneDbm, 'dBm')} \\ Z_0 &= ${tex(z0, 'Ω')}`),
      eq('CW peak-to-peak voltage', String.raw`V_{\mathrm{pp,CW}} &= ${state.drive === 'diff' ? 4 : 2}\sqrt{2}\sqrt{10^{P_{\mathrm{tone}}/10}\times 10^{-3}Z_0}`, volts(tt.vppOne)),
      eq('Two-tone envelope voltage', String.raw`V_{\mathrm{pp,env}} &= 2V_{\mathrm{pp,CW}}`, volts(tt.vppEnv)),
      eq('Average power per port', String.raw`P_{\mathrm{avg}} &= P_{\mathrm{tone}}+10\log_{10}2`, tex(tt.dbmPortAvg, 'dBm'), String.raw`${tex(state.toneDbm, 'dBm', false)}+10\log_{10}2\,\mathrm{dBm}`),
      eq('Peak envelope power per port', String.raw`P_{\mathrm{PEP}} &= P_{\mathrm{tone}}+10\log_{10}4`, tex(tt.dbmPortPep, 'dBm')),
      'Peak envelope power is 3.01 dB above two-tone average power.');
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
    return `2-tone ${state.drive.toUpperCase()} | ${RF.formatDbm(tt.dbmTone)} dBm/tone at DUT ${els.lsPlane.value} | env ${RF.formatVoltage(tt.vppEnv)} pk-pk | PEP ${RF.formatDbm(tt.dbmPortPep)} dBm/port`;
  }

  function computeTones() {
    const scale = freqScales[els.toneUnit.value];
    const hz = text => RF.parseFrequency(text, scale);
    const f1 = hz(els.toneF1.value);
    const f2 = state.toneSource === 'delta' ? f1 + hz(els.toneDelta.value) : hz(els.toneF2.value);
    const fields = {
      bandLow: optionalField(els.toneBandLow, hz), bandHigh: optionalField(els.toneBandHigh, hz),
      rbw: optionalField(els.toneRbw, hz), level: optionalField(els.toneLevel, RF.parseNumber),
      toi: optionalField(els.toneToi, RF.parseNumber), pn: optionalField(els.tonePn, RF.parseNumber),
      danl: optionalField(els.toneDanl, RF.parseNumber)
    };
    const list = Object.values(fields);
    const fail = message => {
      els.toneStatus.textContent = message; els.toneStatus.className = 'status-error';
      els.toneMetrics.replaceChildren(); els.toneRows.replaceChildren();
      return '';
    };
    if (!list.every(field => field.ok)) return fail('Analyzer and passband entries must be numeric. Leave them blank if unknown.');
    if (fields.bandLow.blank !== fields.bandHigh.blank) return fail('Enter both passband edges, or leave both blank.');
    const band = fields.bandLow.blank ? null : { low: fields.bandLow.value, high: fields.bandHigh.value };
    if (band && !(band.high > band.low)) return fail('The passband high edge must be above the low edge.');
    const plan = RF.tonePlan(f1, f2, { maxOrder: Number(els.toneOrder.value), band,
      rbw: fields.rbw.blank ? null : fields.rbw.value,
      toneLevel: fields.level.blank ? NaN : fields.level.value,
      toi: fields.toi.blank ? NaN : fields.toi.value,
      phaseNoise: fields.pn.blank ? NaN : fields.pn.value,
      danl: fields.danl.blank ? NaN : fields.danl.value });
    if (!plan) return fail('Enter a positive f₁ and a spacing that puts f₂ above it. Use a unit or SI prefix such as 1G or 100 MHz.');
    if (state.toneSource === 'delta') { if (document.activeElement !== els.toneF2) els.toneF2.value = freqText(plan.f2); }
    else if (document.activeElement !== els.toneDelta) els.toneDelta.value = freqText(plan.delta);
    const dropped = plan.products.filter(p => !p.valid).length;
    els.toneStatus.className = dropped ? 'over-limit' : '';
    els.toneStatus.textContent = dropped ? `${dropped} low-side product${dropped === 1 ? '' : 's'} fall at or below zero frequency and are omitted; the spacing is a large fraction of f₁.` :
      plan.outOfBand ? `${plan.outOfBand} product${plan.outOfBand === 1 ? '' : 's'} fall outside the DUT passband.` : '';
    els.toneMetrics.innerHTML = [
      metric('Tone spacing Δ', freqText(plan.delta)),
      metric('Centre frequency', freqText(plan.center)),
      metric('IM3 lower · 2f₁−f₂', freqText(plan.im3Lower)),
      metric('IM3 upper · 2f₂−f₁', freqText(plan.im3Upper)),
      metric('IM3 pair span', `${freqText(plan.im3Span)} · 3Δ`),
      metric('Resolution bandwidth', plan.rbw === null ? `Use ≤ ${freqText(plan.rbwMax)}` :
        `${freqText(plan.rbw)} · ${plan.resolved ? 'resolves Δ' : `<span class="over-limit">too wide, use ≤ ${freqText(plan.rbwMax)}</span>`}`),
      metric('Envelope beat', `${freqText(plan.envelopeBeat)} · allow ≥ ${freqText(plan.envelopeBandwidth)} of video bandwidth`),
      metric('Measurable IM3 floor', plan.limit === null ? 'Enter analyzer limits' : `${RF.formatNumber(plan.limit.dbc, 'dBc')} dBc · ${plan.limit.source}`)
    ].join('');
    els.toneRows.innerHTML = plan.products.map(p => `<tr class="${p.valid ? (p.inBand === false ? 'over-limit' : '') : 'over-limit'}"><td>${p.order === 1 ? 'Tone' : p.order}</td><td>${p.label}</td><td>${p.valid ? freqText(p.frequency) : 'at or below 0 Hz'}</td><td>${p.valid ? RF.formatNumber((p.frequency - plan.f1) / plan.delta) + 'Δ' : '—'}</td><td>${yesNo(p.inBand)}</td></tr>`).join('');
    calculation.push('Two equal tones through a memoryless nonlinearity. Odd-order products land on a uniform grid of spacing Δ, so they stay near the tones; even-order products fall near DC and near the second harmonic.',
      eq('Tone spacing and centre', String.raw`\Delta &= f_2-f_1 = ${tex(plan.delta, 'Hz')} \\ f_{\mathrm c} &= \frac{f_1+f_2}{2} = ${tex(plan.center, 'Hz')}`),
      eq('Odd-order product grid', String.raw`f_{2k+1} &= f_1-k\Delta \ \text{and}\ f_2+k\Delta`, String.raw`${tex(plan.im3Lower, 'Hz')}\ \text{and}\ ${tex(plan.im3Upper, 'Hz')}\ (k=1)`),
      eq('IM3 pair span', String.raw`f_{\mathrm{span}} &= 3\Delta`, tex(plan.im3Span, 'Hz')),
      eq('Resolution bandwidth', String.raw`\mathrm{RBW} &\le \frac{\Delta}{10}`, tex(plan.rbwMax, 'Hz')),
      ...plan.floors.map(floor => eq(floor.source, floor.source === 'Analyzer third-order products' ?
        String.raw`\mathrm{IM3}_{\mathrm{SA}} &= 2(P_{\mathrm{tone}}-\mathrm{TOI})` : floor.source === 'Phase noise at Δ offset' ?
        String.raw`\mathrm{floor} &= \mathcal{L}(\Delta)+10\log_{10}\mathrm{RBW}` :
        String.raw`\mathrm{floor} &= \mathrm{DANL}+10\log_{10}\mathrm{RBW}-P_{\mathrm{tone}}`, tex(floor.dbc, 'dBc'))),
      plan.limit === null ? 'Enter a resolution bandwidth with an analyzer intercept, phase noise, or noise floor to estimate the measurable IM3 floor.' :
        `The highest floor wins: ${plan.limit.source.toLowerCase()} at ${RF.formatNumber(plan.limit.dbc, 'dBc')} dBc.`,
      'The envelope beats at Δ. A bias or video path narrower than several times Δ produces asymmetric IM3 sidebands, which is a memory effect rather than a measurement error.');
    return `Tone plan | f1 ${freqText(plan.f1)} | f2 ${freqText(plan.f2)} | Δ ${freqText(plan.delta)} | IM3 ${freqText(plan.im3Lower)} and ${freqText(plan.im3Upper)}` +
      (plan.limit === null ? '' : ` | floor ${RF.formatNumber(plan.limit.dbc, 'dBc')} dBc (${plan.limit.source})`);
  }

  function computeImd() {
    const tone = state.toneDbm, im3 = Bench.read(els.imdIm3), gain = Bench.read(els.imdGain, true);
    const plane = els.lsPlane.value, unit = els.imdUnit.value;
    const ip3 = RF.ip3Measurement(tone, im3, gain, plane, unit);
    if (!ip3 || (els.imdGain.value.trim() && !Number.isFinite(gain))) {
      els.imdMetrics.innerHTML = metric('Status', 'Enter valid tone and IM3 levels (IM3 ≤ tone). Blank gain means 0 dB; nonblank gain must be numeric.');
      return '';
    }
    const number = v => Number.isFinite(v) ? RF.formatDbm(v) + ' dBm' : 'enter gain';
    els.imdMetrics.innerHTML = [metric('Δ (output tone − IM3)', RF.formatNumber(ip3.delta, 'dB') + ' dB'),
      metric('IM3 at output', number(ip3.im3Output)), metric('IIP3', number(ip3.iip3)), metric('OIP3', number(ip3.oip3)),
      metric('IM3 relative to output tone', RF.formatNumber(ip3.im3Dbc, 'dB') + ' dBc'),
      metric('Approx. OP1dB (cubic model)', number(ip3.oip3 - 10))].join('');
    calculation.push('Small-signal third-order extrapolation with two equal tones; IM3 is measured at the DUT output.',
      `Tone reference: DUT ${plane}. Absolute IM3 is output dBm; relative IM3 is dBc relative to one output tone.`,
      eq('Measured tone and gain', String.raw`P_{\mathrm{tone}} &= ${tex(tone, 'dBm')} \\ G &= ${tex(gain, 'dB')}`),
      eq('Tone-to-IM3 separation', unit === 'dbc' ? String.raw`\Delta &= -\mathrm{IM3}_{\mathrm{dBc}}` : String.raw`\Delta &= P_{\mathrm{out,tone}}-P_{\mathrm{out,IM3}}`, tex(ip3.delta, 'dB'), unit === 'dbc' ? String.raw`-(${tex(im3, 'dBc')})` : String.raw`${tex(ip3.outputTone,'dBm',false)}-(${tex(im3,'dBm',false)})\,\mathrm{dB}`),
      eq('Input third-order intercept', String.raw`\mathrm{IIP3} &= P_{\mathrm{in,tone}}+\frac{\Delta}{2}`, tex(ip3.iip3, 'dBm'), String.raw`${tex(plane === 'input' ? tone : tone-gain,'dBm',false)}+\frac{${tex(ip3.delta,'dB',false)}}{2}\,\mathrm{dBm}`),
      eq('Output third-order intercept', String.raw`\mathrm{OIP3} &= \mathrm{IIP3}+G`, tex(ip3.oip3, 'dBm')),
      eq('Approximate compression point', String.raw`\mathrm{OP1dB} &\approx \mathrm{OIP3}-10\,\mathrm{dB}`, tex(ip3.oip3-10, 'dBm')),
      'The compression-point estimate is a cubic-model rule of thumb, not a measurement.');
    return `IMD3 | tones at DUT ${plane}: ${RF.formatNumber(tone, 'dB')} dBm | output IM3 ${RF.formatNumber(ip3.im3Dbc, 'dB')} dBc | IIP3 ${number(ip3.iip3)} | OIP3 ${number(ip3.oip3)}`;
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
    const harmonicEls = [els.thdH2, els.thdH3, els.thdH4, els.thdH5];
    const values = harmonicEls.map(el => Bench.read(el));
    const thd = RF.thdFromDbc(values);
    const badHarmonic = harmonicEls.some((el, i) => el.value.trim() && !Number.isFinite(values[i]));
    const clear = message => {
      els.thdMetrics.innerHTML = metric('Status', message);
      els.thdBandMetrics.replaceChildren(); els.thdHarmonics.replaceChildren();
      els.thdStatus.textContent = ''; lastLine = '';
    };
    if (!thd.count || !Number.isFinite(thd.percent) || (els.thdFund.value.trim() && !Number.isFinite(fund)) || badHarmonic) {
      return clear('Enter at least one harmonic in dBc');
    }
    const scale = freqScales[els.thdUnit.value];
    const hz = text => RF.parseFrequency(text, scale);
    const fields = {
      f0: optionalField(els.thdF0, hz), fmax: optionalField(els.thdFmax, hz),
      bandLow: optionalField(els.thdBandLow, hz), bandHigh: optionalField(els.thdBandHigh, hz),
      fc: optionalField(els.thdFc, hz), poles: optionalField(els.thdPoles, RF.parseNumber),
      contam: optionalField(els.thdContam, RF.parseNumber)
    };
    if (!Object.values(fields).every(field => field.ok)) return clear('Optional frequency and level entries must be numeric. Leave them blank if unknown.');
    if (fields.bandLow.blank !== fields.bandHigh.blank) return clear('Enter both passband edges, or leave both blank.');
    if (!fields.poles.blank && !(Number.isInteger(fields.poles.value) && fields.poles.value >= 1)) return clear('Poles must be a whole number of 1 or more.');
    if (!fields.fc.blank && fields.f0.blank) return clear('Enter the fundamental frequency to use the band-limit correction.');
    const band = fields.bandLow.blank ? null : { low: fields.bandLow.value, high: fields.bandHigh.value };
    if (band && !(band.high > band.low)) return clear('The passband high edge must be above the low edge.');
    const entered = values.map((value, i) => ({ n: i + 2, dbc: value })).filter(h => Number.isFinite(h.dbc));
    const poles = fields.poles.blank ? 1 : fields.poles.value;
    const plan = fields.f0.blank ? null : RF.harmonicPlan(fields.f0.value, 5, { instrumentMax: fields.fmax.blank ? null : fields.fmax.value, band });
    const limited = fields.fc.blank ? null : RF.bandLimitedThd(entered, fields.f0.value, fields.fc.value, poles);
    const contamination = fields.contam.blank ? null : RF.contaminationRange(fields.contam.value);
    const h2 = values[0];
    els.thdMetrics.innerHTML = [
      metric('THD', `${RF.formatNumber(thd.percent)} %`),
      metric('THD', Number.isFinite(thd.db) ? `${RF.formatNumber(thd.db, 'dB')} dB` : '—'),
      metric('Harmonics used', String(thd.count)),
      ...(Number.isFinite(fund) && Number.isFinite(h2) ? [metric('H2 absolute', `${RF.formatDbm(fund + h2)} dBm`)] : [])
    ].join('');
    const notes = [];
    if (plan) {
      const unreachable = plan.rows.filter(row => row.aboveInstrument).map(row => row.n);
      const outside = plan.rows.filter(row => row.n > 1 && row.inBand === false).map(row => row.n);
      if (unreachable.length) notes.push(`H${unreachable.join(', H')} above the analyzer's top frequency and cannot be measured; keep f₀ at or below ${freqText(plan.maxFundamental)} to reach the 5th.`);
      if (outside.length === plan.rows.filter(row => row.n > 1).length) notes.push('Every harmonic falls outside the DUT passband, so THD understates the nonlinearity by design. Use an in-band intermodulation measurement instead.');
      else if (outside.length) notes.push(`H${outside.join(', H')} fall outside the DUT passband.`);
    }
    if (limited) {
      const worst = limited.rows.reduce((a, b) => b.attenuation < a.attenuation ? b : a);
      notes.push(`The device rolloff hides up to ${RF.formatNumber(-worst.attenuation, 'dB')} dB on H${worst.n}.`);
    }
    els.thdStatus.className = notes.length ? 'over-limit' : '';
    els.thdStatus.textContent = notes.join(' ');
    els.thdBandMetrics.innerHTML = [
      ...(limited ? [
        metric('Measured THD', `${RF.formatNumber(limited.measured.percent)} %`),
        metric('Estimated intrinsic THD', `${RF.formatNumber(limited.intrinsic.percent)} %`),
        metric('Understated by', `${RF.formatNumber(limited.intrinsic.db - limited.measured.db, 'dB')} dB`)] : []),
      ...(contamination ? [metric('Contamination range',
        `+${RF.formatNumber(contamination.high, 'dB')} / ${contamination.low === -Infinity ? '−∞' : RF.formatNumber(contamination.low, 'dB')} dB`)] : []),
      ...(plan && !limited ? [metric('Highest harmonic in range', plan.highestMeasurable === null ? 'Enter the analyzer maximum' : `H${Math.max(1, plan.highestMeasurable)}`)] : [])
    ].join('');
    els.thdHarmonics.innerHTML = !plan ? '' : plan.rows.map(row => {
      const corrected = limited ? limited.rows.find(r => r.n === row.n) : null;
      const measured = entered.find(h => h.n === row.n);
      const flags = [row.aboveInstrument ? 'Above analyzer range' : '', row.inBand === false ? 'Outside DUT band' : ''].filter(Boolean).join('; ');
      return `<tr class="${row.aboveInstrument || row.inBand === false ? 'over-limit' : ''}"><td>${row.n === 1 ? 'f₀' : 'H' + row.n}</td><td>${freqText(row.frequency)}</td><td>${measured ? RF.formatNumber(measured.dbc, 'dBc') + ' dBc' : row.n === 1 ? 'reference' : '—'}</td><td>${corrected ? RF.formatNumber(corrected.attenuation, 'dB') + ' dB' : '—'}</td><td>${corrected ? RF.formatNumber(corrected.intrinsic, 'dBc') + ' dBc' : '—'}</td><td>${flags || 'OK'}</td></tr>`;
    }).join('');
    calculation = ['Harmonics are power ratios in dBc relative to the fundamental. Blank harmonics are omitted.',
      eq('Root-sum-square harmonic ratio', String.raw`r_{\mathrm{THD}} &= \sqrt{\sum_{n\ge 2}10^{H_n/10}}`, tex(thd.ratio), String.raw`\sqrt{${values.filter(Number.isFinite).map(h => String.raw`10^{${tex(h, 'dBc', false)}/10}`).join(' + ')}}`),
      eq('Total harmonic distortion', String.raw`\mathrm{THD}_{\%} &= 100\,r_{\mathrm{THD}}`, tex(thd.percent, '%')),
      eq('Distortion level', String.raw`\mathrm{THD}_{\mathrm{dB}} &= 20\log_{10}r_{\mathrm{THD}}`, tex(thd.db, 'dB')),
      ...(plan ? [eq('Harmonic frequencies', String.raw`f_n &= n f_0`, plan.rows.slice(1).map(row => tex(row.frequency, 'Hz')).join(',\\ '))] : []),
      ...(limited ? [
        `Band-limit correction for a ${poles}-pole rolloff at ${freqText(limited.fc)}. It assumes the nonlinearity precedes the band limit; a feedback amplifier moves the other way because loop gain also falls with frequency.`,
        eq('Harmonic attenuation', String.raw`A_n &= 10p\log_{10}\frac{1+(f_0/f_{\mathrm c})^2}{1+(nf_0/f_{\mathrm c})^2}`,
          limited.rows.map(row => String.raw`A_{${row.n}}=${tex(row.attenuation, 'dB')}`).join(',\\ ')),
        eq('Intrinsic harmonic level', String.raw`H_{n,\mathrm{intrinsic}} &= H_{n,\mathrm{measured}}-A_n`,
          limited.rows.map(row => tex(row.intrinsic, 'dBc')).join(',\\ ')),
        eq('Estimated intrinsic distortion', String.raw`\mathrm{THD}_{\mathrm{intrinsic}} &= ${tex(limited.intrinsic.percent, '%')}`, '', '')] : []),
      ...(contamination ? [
        'A source or receiver harmonic adds to the DUT harmonic with unknown phase, so the measured level sits inside this range.',
        eq('Contamination range', String.raw`\Delta_{\pm} &= 20\log_{10}(1\pm 10^{C/20})`,
          String.raw`+${tex(contamination.high, 'dB')}\ /\ ${tex(contamination.low, 'dB')}`)] : []),
      'Use a consistent power reference for every harmonic measurement. Receiver distortion is not removed.'];
    lastLine = `THD ${RF.formatNumber(thd.percent)} % (${RF.formatNumber(thd.db, 'dB')} dB) | ${thd.count} harmonic(s)` +
      (plan ? ` | f0 ${freqText(plan.f0)}` : '') +
      (limited ? ` | intrinsic ${RF.formatNumber(limited.intrinsic.percent)} % through a ${poles}-pole ${freqText(limited.fc)} rolloff` : '');
  }

  function compute() {
    lastLine = ''; calculation = [];
    if (state.panel === "twotone") {
      const parts = [computeTwoTone(), computeTones(), computeImd()];
      lastLine = parts.every(Boolean) ? parts.join('\n') : '';
    }
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

  [els.imdIm3, els.imdGain].forEach(function (el) {
    el.addEventListener("input", compute);
    el.addEventListener("change", compute);
  });

  els.imdUnit.addEventListener('change', function () {
    const measurement = RF.ip3Measurement(Bench.read(els.toneDbm), Bench.read(els.imdIm3), Bench.read(els.imdGain, true), els.lsPlane.value, previousImdUnit);
    const value = measurement && (els.imdUnit.value === 'dbc' ? measurement.im3Dbc : measurement.im3Output);
    if (Number.isFinite(value)) Bench.setNumber(els.imdIm3, value, els.imdUnit.value === 'dbc' ? 'dBc' : 'dBm', true); else els.imdIm3.value = '';
    previousImdUnit = els.imdUnit.value; compute();
  });
  els.lsPlane.addEventListener('change', function () {
    const gain = Bench.read(els.imdGain, true), tone = Bench.read(els.toneDbm);
    if (previousImdPlane !== els.lsPlane.value) {
      if (Number.isFinite(gain) && Number.isFinite(tone)) Bench.setNumber(els.toneDbm, tone + (els.lsPlane.value === 'output' ? gain : -gain), 'dBm', true);
      else els.toneDbm.value = '';
    }
    previousImdPlane = els.lsPlane.value; compute();
  });

  els.p1Gain.addEventListener("input", compute);
  els.p1Pin.addEventListener("input", function () { state.p1Source = "pin"; compute(); });
  els.p1Pout.addEventListener("input", function () { state.p1Source = "pout"; compute(); });
  els.p1Meas.addEventListener("input", compute);

  [els.thdFund, els.thdH2, els.thdH3, els.thdH4, els.thdH5, els.thdF0, els.thdFmax,
    els.thdBandLow, els.thdBandHigh, els.thdFc, els.thdPoles, els.thdContam].forEach(function (el) {
    el.addEventListener("input", compute);
  });
  els.thdUnit.addEventListener("change", compute);
  [els.toneF1, els.toneBandLow, els.toneBandHigh, els.toneRbw, els.toneLevel, els.toneToi, els.tonePn, els.toneDanl].forEach(function (el) {
    el.addEventListener("input", compute);
  });
  els.toneF2.addEventListener("input", function () { state.toneSource = "f2"; compute(); });
  els.toneDelta.addEventListener("input", function () { state.toneSource = "delta"; compute(); });
  [els.toneUnit, els.toneOrder].forEach(function (el) { el.addEventListener("change", compute); });

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
