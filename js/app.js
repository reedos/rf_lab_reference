(function () {
  const eq = Bench.equation, tex = Bench.tex, volts = Bench.voltage;
  const RF = window.RF;
  const CHEAT_DBM = [-20, -10, -6, -3, 0, 3, 6, 10];

  const els = {
    body: document.body,
    btnSe: document.getElementById("btn-se"),
    btnDiff: document.getElementById("btn-diff"),
    dbm: document.getElementById("dbm"),
    dbmLabel: document.getElementById("dbm-label"),
    dbmScope: document.getElementById("dbm-scope"),
    fieldDbm: document.getElementById("field-dbm"),
    vopp: document.getElementById("vopp"),
    voppLabel: document.getElementById("vopp-label"),
    fieldVopp: document.getElementById("field-vopp"),
    voppUnit: document.getElementById("vopp-unit"),
    zdut: document.getElementById("zdut"),
    metrics: document.getElementById("metrics"),
    refBody: document.getElementById("ref-body"),
    refCaption: document.getElementById("ref-caption"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast"),
    dbmDec: document.getElementById("dbm-dec"),
    dbmInc: document.getElementById("dbm-inc"),
    btnSrc: document.getElementById("btn-src"),
    btnRx: document.getElementById("btn-rx"),
    seCap: document.getElementById("se-cap"),
    seSrcKicker: document.getElementById("se-src-kicker"),
    seSrcTitle: document.getElementById("se-src-title"),
    seSrcSub: document.getElementById("se-src-sub"),
    seLoadKicker: document.getElementById("se-load-kicker"),
    seLoadTitle: document.getElementById("se-load-title"),
    seLoadSub: document.getElementById("se-load-sub"),
    seSrcPort: document.getElementById("se-src-port"),
    seLoadPort: document.getElementById("se-load-port"),
    sePowerKicker: document.getElementById("se-power-kicker"),
    diffCap: document.getElementById("diff-cap"),
    diffSrcKicker: document.getElementById("diff-src-kicker"),
    diffSrcTitle: document.getElementById("diff-src-title"),
    diffSrcSub: document.getElementById("diff-src-sub"),
    diffLoadKicker: document.getElementById("diff-load-kicker"),
    diffLoadTitle: document.getElementById("diff-load-title"),
    diffLoadSub: document.getElementById("diff-load-sub"),
    diffSrcP1: document.getElementById("diff-src-p1"),
    diffSrcP2: document.getElementById("diff-src-p2"),
    diffLoadP1: document.getElementById("diff-load-p1"),
    diffLoadP2: document.getElementById("diff-load-p2"),
    voppHint: document.getElementById("vopp-hint"),
    seSrcZ: document.getElementById("se-src-z"),
    seLoadZ: document.getElementById("se-load-z"),
    diffSrcZ: document.getElementById("diff-src-z"),
    diffLoadZ: document.getElementById("diff-load-z"),
    calc: document.getElementById("calc"),
    schematicSe: document.getElementById("schematic-se"),
    schematicDiff: document.getElementById("schematic-diff"),
    seLineDbm: document.getElementById("se-line-dbm"),
    seLineZ: document.getElementById("se-line-z"),
    seNodeVopp: document.getElementById("se-node-vopp"),
    seNodePower: document.getElementById("se-node-power"),
    diffP1Dbm: document.getElementById("diff-p1-dbm"),
    diffP2Dbm: document.getElementById("diff-p2-dbm"),
    diffP1Z: document.getElementById("diff-p1-z"),
    diffP2Z: document.getElementById("diff-p2-z"),
    diffNodeVopp: document.getElementById("diff-node-vopp"),
    diffNodeZ: document.getElementById("diff-node-z")
  };

  const PATH_COPY = {
    src: {
      seCap: "VNA drives DUT",
      seSrcKicker: "Source",
      seSrcTitle: "VNA",
      seSrcSub: "stimulus",
      seLoadKicker: "Load",
      seLoadTitle: "DUT",
      seLoadSub: "SE input",
      seSrcPort: "Port 1",
      seLoadPort: "RF in",
      sePowerKicker: "Available",
      seLineNote: "into DUT",
      diffCap: "VNA drives DUT · complementary 180°",
      diffSrcKicker: "Source",
      diffSrcTitle: "VNA",
      diffSrcSub: "balanced stimulus",
      diffLoadKicker: "Load",
      diffLoadTitle: "DUT",
      diffLoadSub: "diff input",
      diffSrcP1: "Port 1 <em>+</em>",
      diffSrcP2: "Port 2 <em>−</em>",
      diffLoadP1: "RF+",
      diffLoadP2: "RF−",
      dbmLabel: "Source power",
      dbmScopeSe: "available",
      dbmScopeDiff: "per port, available",
      voppHint: "at DUT · type to solve dBm"
    },
    rx: {
      seCap: "DUT drives VNA · voltage at the receiver port",
      seSrcKicker: "Source",
      seSrcTitle: "DUT",
      seSrcSub: "SE output",
      seLoadKicker: "Load",
      seLoadTitle: "VNA",
      seLoadSub: "receiver",
      seSrcPort: "RF out",
      seLoadPort: "Port 1",
      sePowerKicker: "Delivered",
      seLineNote: "into VNA",
      diffCap: "DUT drives VNA · complementary 180°",
      diffSrcKicker: "Source",
      diffSrcTitle: "DUT",
      diffSrcSub: "diff output",
      diffLoadKicker: "Load",
      diffLoadTitle: "VNA",
      diffLoadSub: "receivers",
      diffSrcP1: "RF+",
      diffSrcP2: "RF−",
      diffLoadP1: "Port 1 <em>+</em>",
      diffLoadP2: "Port 2 <em>−</em>",
      dbmLabel: "Receiver power",
      dbmScopeSe: "delivered",
      dbmScopeDiff: "per port, delivered",
      voppHint: "at VNA port · type to solve dBm"
    }
  };

  const state = {
    drive: "se",
    path: "src",
    source: "dbm",
    dbm: 0,
    vopp: 0,
    zvna: 50,
    zdut: 50,
    unit: "V",
    result: null
  };

  let toastTimer = 0;

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const drive = q.get("m");
    if (drive === "diff" || drive === "se") state.drive = drive;
    const path = q.get("dir");
    if (path === "rx" || path === "src") state.path = path;
    state.zvna = 50;
    const zd = RF.parseNumber(q.get("zd"));
    if (zd > 0) { state.zdut = zd; els.zdut.value = q.get("zd").trim(); }
    const unit = q.get("u");
    if (unit === "V" || unit === "mV") state.unit = unit;
    const src = q.get("from");
    if (src === "vopp" || src === "dbm") state.source = src;
    const dbm = RF.parseNumber(q.get("d"));
    const vopp = RF.parseNumber(q.get("v"));
    if (state.source === "vopp" && Number.isFinite(vopp) && vopp >= 0) {
      state.vopp = vopp;
    } else if (Number.isFinite(dbm)) {
      state.source = "dbm";
      state.dbm = dbm;
      els.dbm.value = q.get("d").trim();
    }
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("m", state.drive);
    q.set("dir", state.path);
    q.set("zd", String(state.zdut));
    q.set("from", state.source);
    q.set("u", state.unit);
    if (state.source === "vopp") {
      q.set("v", String(state.vopp));
    } else {
      q.set("d", String(state.dbm));
    }
    const next = `${window.location.pathname}?${q.toString()}`;
    window.history.replaceState(null, "", next);
  }

  function readZ(el) {
    const z = Bench.read(el);
    return z > 0 ? z : NaN;
  }

  function zLabel(name, ohms) {
    return name + " " + RF.formatNumber(ohms) + " Ω";
  }

  function compute() {
    state.zvna = 50;
    state.zdut = readZ(els.zdut);
    if (!(state.zdut > 0)) {
      state.result = null;
      render(false);
      return;
    }

    if (state.source === "vopp") {
      if (!(state.vopp >= 0) || !Number.isFinite(state.vopp)) {
        state.result = null;
        render(false);
        return;
      }
      state.result = RF.fromVoppPlane(state.vopp, state.zvna, state.zdut, state.drive, state.path);
      state.dbm = RF.dbmOf(state.result);
    } else {
      if (!Number.isFinite(state.dbm)) {
        state.result = null;
        render(false);
        return;
      }
      state.result = RF.fromDbmPlane(state.dbm, state.zvna, state.zdut, state.drive, state.path);
      state.vopp = RF.voppOf(state.result);
    }
    if (!state.result) {
      render(false);
      return;
    }
    if (![state.vopp, state.result.wattsAvailable, state.result.wattsDelivered, state.result.vocVpp].every(Number.isFinite) ||
        (state.source === 'dbm' && state.result.wattsAvailable === 0)) {
      state.result = null;
      render(false);
      return;
    }
    render(true);
    writeQuery();
  }

  function metric(label, value) {
    return `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function render(ok) {
    els.body.setAttribute("data-drive", state.drive);
    els.body.setAttribute("data-path", state.path);
    els.btnSe.classList.toggle("is-active", state.drive === "se");
    els.btnDiff.classList.toggle("is-active", state.drive === "diff");
    els.btnSe.setAttribute("aria-pressed", state.drive === "se" ? "true" : "false");
    els.btnDiff.setAttribute("aria-pressed", state.drive === "diff" ? "true" : "false");
    els.btnSrc.classList.toggle("is-active", state.path === "src");
    els.btnRx.classList.toggle("is-active", state.path === "rx");
    els.btnSrc.setAttribute("aria-pressed", state.path === "src" ? "true" : "false");
    els.btnRx.setAttribute("aria-pressed", state.path === "rx" ? "true" : "false");

    const isDiff = state.drive === "diff";
    const copy = PATH_COPY[state.path];
    els.schematicSe.hidden = isDiff;
    els.schematicDiff.hidden = !isDiff;
    els.schematicSe.classList.toggle("is-off", isDiff);
    els.schematicDiff.classList.toggle("is-off", !isDiff);

    els.seCap.textContent = copy.seCap;
    els.seSrcKicker.textContent = copy.seSrcKicker;
    els.seSrcTitle.textContent = copy.seSrcTitle;
    els.seSrcSub.textContent = copy.seSrcSub;
    els.seLoadKicker.textContent = copy.seLoadKicker;
    els.seLoadTitle.textContent = copy.seLoadTitle;
    els.seLoadSub.textContent = copy.seLoadSub;
    els.seSrcPort.textContent = copy.seSrcPort;
    els.seLoadPort.textContent = copy.seLoadPort;
    els.sePowerKicker.textContent = copy.sePowerKicker;
    els.diffCap.textContent = copy.diffCap;
    els.diffSrcKicker.textContent = copy.diffSrcKicker;
    els.diffSrcTitle.textContent = copy.diffSrcTitle;
    els.diffSrcSub.textContent = copy.diffSrcSub;
    els.diffLoadKicker.textContent = copy.diffLoadKicker;
    els.diffLoadTitle.textContent = copy.diffLoadTitle;
    els.diffLoadSub.textContent = copy.diffLoadSub;
    els.diffSrcP1.innerHTML = copy.diffSrcP1;
    els.diffSrcP2.innerHTML = copy.diffSrcP2;
    els.diffLoadP1.innerHTML = copy.diffLoadP1;
    els.diffLoadP2.innerHTML = copy.diffLoadP2;

    els.dbmLabel.textContent = copy.dbmLabel;
    els.dbmScope.textContent = isDiff ? copy.dbmScopeDiff : copy.dbmScopeSe;
    els.voppLabel.textContent = isDiff ? "VOPP (diff pk-pk)" : "VOPP (SE pk-pk)";
    if (els.voppHint) els.voppHint.textContent = copy.voppHint;

    els.voppUnit.value = state.unit;
    if (document.activeElement !== els.zdut && Number.isFinite(state.zdut)) {
      Bench.setNumber(els.zdut, state.zdut);
    }

    document.querySelectorAll(".chips[data-target='zdut'] .chip").forEach(function (chip) {
      chip.classList.toggle("is-active", Number(chip.getAttribute("data-z")) === state.zdut);
    });

    const zpTxt = zLabel("Z<sub>VNA</sub>", state.zvna);
    const zdTxt = zLabel("Z<sub>DUT</sub>", state.zdut);
    const leftZ = state.path === "src" ? zpTxt : zdTxt;
    const rightZ = state.path === "src" ? zdTxt : zpTxt;
    if (els.seSrcZ) els.seSrcZ.innerHTML = leftZ;
    if (els.seLoadZ) els.seLoadZ.innerHTML = rightZ;
    if (els.diffSrcZ) els.diffSrcZ.innerHTML = leftZ;
    if (els.diffLoadZ) els.diffLoadZ.innerHTML = rightZ;

    if (document.activeElement !== els.dbm) {
      if (ok) Bench.setNumber(els.dbm, state.dbm, 'dBm', state.source !== 'dbm');
    }
    if (document.activeElement !== els.vopp) {
      const shown = RF.voltsToUnit(state.vopp, state.unit);
      if (ok) Bench.setNumber(els.vopp, shown, state.unit, state.source !== 'vopp');
    }

    els.fieldDbm.classList.toggle("invalid", !ok && state.source === "dbm");
    els.fieldVopp.classList.toggle("invalid", !ok && state.source === "vopp");

    const r = state.result;
    if (!ok || !r) {
      els.metrics.innerHTML = metric("Status", "Enter finite dBm or nonnegative VOPP, plus a positive DUT impedance.");
      els.refBody.replaceChildren();
      els.refCaption.textContent = 'Enter valid inputs to show the reference table.';
      [els.seLineDbm, els.seNodeVopp, els.seNodePower, els.diffP1Dbm, els.diffP2Dbm, els.diffNodeVopp].forEach(el => el.textContent = '—');
      Bench.update({ valid: false, lines: ['Correct the power/voltage and impedance inputs before calculating or saving.'] });
      return;
    }

    const voppShow = RF.voppOf(r);
    const gammaTxt = Number.isFinite(r.gamma) ? RF.formatNumber(r.gamma) : "—";
    if (r.drive === "se") {
      els.metrics.innerHTML = [
        metric("V<sub>rms</sub> at load", RF.formatVoltage(r.vrmsSe)),
        metric("V<sub>pk</sub> at load", RF.formatVoltage(r.vpkSe)),
        metric("Available", `${RF.formatDbm(r.dbmAvailable)} dBm`),
        metric("Delivered", `${RF.formatDbm(r.dbmDelivered)} dBm`),
        metric("Γ", gammaTxt),
        metric("V<sub>oc</sub> pk-pk", RF.formatVoltage(r.vocVpp))
      ].join("");
      els.seLineDbm.textContent = `${RF.formatDbm(r.dbm)} dBm`;
      els.seLineZ.innerHTML = `Z<sub>S</sub> ${RF.formatNumber(r.zS)} Ω → Z<sub>L</sub> ${RF.formatNumber(r.zL)} Ω`;
      els.seNodeVopp.textContent = RF.formatVoltage(voppShow);
      els.seNodePower.textContent = RF.formatPowerWatts(state.path === "rx" ? r.wattsDelivered : r.wattsAvailable);
    } else {
      els.metrics.innerHTML = [
        metric("VOPP / line", RF.formatVoltage(r.vppSe)),
        metric("V<sub>rms</sub> diff", RF.formatVoltage(r.vrmsDiff)),
        metric("Available / port", `${RF.formatDbm(r.dbmAvailable)} dBm`),
        metric("Delivered / port", `${RF.formatDbm(r.dbmDelivered)} dBm`),
        metric("Γ (per side)", gammaTxt),
        metric("Z<sub>diff</sub> DUT", `${RF.formatNumber(r.zDiffDut)} Ω`)
      ].join("");
      const port = `${RF.formatDbm(r.dbm)} dBm`;
      els.diffP1Dbm.textContent = port;
      els.diffP2Dbm.textContent = port;
      // Both rails run from the source impedance to the load impedance. Splitting the two
      // labels across the rails read as though each rail had a different impedance.
      const railZ = `Z<sub>S</sub> ${RF.formatNumber(r.zS)} Ω → Z<sub>L</sub> ${RF.formatNumber(r.zL)} Ω`;
      els.diffP1Z.innerHTML = railZ;
      els.diffP2Z.innerHTML = railZ;
      els.diffNodeVopp.textContent = RF.formatVoltage(r.vppDiff);
      els.diffNodeZ.innerHTML = `Z<sub>diff</sub> DUT ${RF.formatNumber(r.zDiffDut)} Ω`;
    }
    Bench.update({ valid: true, lines: [
      'CW sinusoid with real positive source/load impedances. Differential drive uses two equal signals, 180° apart.',
      `Direction: ${state.path === 'src' ? 'VNA → DUT; power is available source power' : 'DUT → VNA; power is delivered receiver power'}. All powers below are per port.`,
      eq('Reference impedances', String.raw`Z_{\mathrm S} &= ${tex(r.zS, 'Ω')} \\ Z_{\mathrm L} &= ${tex(r.zL, 'Ω')}`),
      eq('Power conversion', String.raw`P &= 10^{P_{\mathrm{dBm}}/10}\times 10^{-3}\,\mathrm W`, tex(state.path === 'src' ? r.wattsAvailable : r.wattsDelivered, 'W'), String.raw`10^{${tex(r.dbm,'dBm',false)}/10}\times 10^{-3}\,\mathrm W`),
      ...(state.path === 'src' ? [
        eq('Open-circuit source voltage', String.raw`V_{\mathrm{oc,rms}} &= 2\sqrt{P_{\mathrm{avs}} Z_{\mathrm S}}`, volts(r.vocRms), String.raw`2\sqrt{${tex(r.wattsAvailable)}\times ${tex(r.zS)}}\,\mathrm V`),
        eq('Loaded RMS voltage', String.raw`V_{\mathrm{rms,L}} &= V_{\mathrm{oc,rms}}\frac{Z_{\mathrm L}}{Z_{\mathrm S}+Z_{\mathrm L}}`, volts(r.vrmsSe), String.raw`${tex(r.vocRms)}\frac{${tex(r.zL)}}{${tex(r.zS)}+${tex(r.zL)}}\,\mathrm V`)
      ] : [eq('Loaded RMS voltage', String.raw`V_{\mathrm{rms,L}} &= \sqrt{P_{\mathrm{del}} Z_{\mathrm L}}`, volts(r.vrmsSe), String.raw`\sqrt{${tex(r.wattsDelivered)}\times ${tex(r.zL)}}\,\mathrm V`)]),
      eq('Peak-to-peak voltage per line', String.raw`V_{\mathrm{pp,line}} &= 2\sqrt{2}\,V_{\mathrm{rms,L}}`, volts(r.vppSe)),
      eq('Voltage at the selected reference plane', r.drive === 'diff' ? String.raw`V_{\mathrm{pp,diff}} &= 2V_{\mathrm{pp,line}}` : String.raw`V_{\mathrm{pp}} &= V_{\mathrm{pp,line}}`, volts(RF.voppOf(r))),
      eq('Delivered power per port', String.raw`P_{\mathrm{del}} &= \frac{V_{\mathrm{rms,L}}^2}{Z_{\mathrm L}}`, tex(r.wattsDelivered, 'W'), String.raw`\frac{(${tex(r.vrmsSe)})^2}{${tex(r.zL)}}\,\mathrm W`),
      eq('Reflection coefficient', String.raw`\Gamma &= \frac{Z_{\mathrm L}-Z_{\mathrm S}}{Z_{\mathrm L}+Z_{\mathrm S}}`, tex(r.gamma), String.raw`\frac{${tex(r.zL)}-${tex(r.zS)}}{${tex(r.zL)}+${tex(r.zS)}}`),
      r.drive === 'diff' ? 'Total power across both ports is twice per-port power (+3.01 dB).' : 'The indicated voltage is at the load reference plane.'
    ] });
    renderTable();
  }

  function renderTable() {
    const zp = state.zvna > 0 ? state.zvna : 50;
    const zd = state.zdut > 0 ? state.zdut : 50;
    els.refCaption.textContent = `VNA→DUT, ZVNA ${zp} Ω, ZDUT ${zd} Ω`;
    els.refBody.innerHTML = CHEAT_DBM.map(function (dbm) {
      const se = RF.fromDbmPlane(dbm, zp, zd, "se", "src");
      const diff = RF.fromDbmPlane(dbm, zp, zd, "diff", "src");
      const sign = dbm > 0 ? `+${dbm}` : String(dbm);
      return `<tr>
        <td class="num">${sign}</td>
        <td class="num">${RF.formatVoltage(se.vppSe)}</td>
        <td class="num">${RF.formatVoltage(diff.vppDiff)}</td>
        <td class="num">${RF.formatDbm(se.dbmDelivered)} dBm del</td>
      </tr>`;
    }).join("");
  }

  function setDrive(drive) {
    state.drive = drive;
    compute();
  }

  function stepDbm(delta) {
    if (!Number.isFinite(state.dbm)) state.dbm = 0;
    state.source = "dbm";
    state.dbm = Math.round((state.dbm + delta) * 100) / 100;
    Bench.setNumber(els.dbm, state.dbm, 'dBm');
    compute();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-on");
    }, 1600);
  }

  function resultLine() {
    const r = state.result;
    if (!r) return "";
    const dir = state.path === "rx" ? "DUT→VNA" : "VNA→DUT";
    if (r.drive === "se") {
      return `${dir} SE | ${RF.formatDbm(r.dbm)} dBm | ZVNA ${RF.formatNumber(r.zvna)} Ω | ZDUT ${RF.formatNumber(r.zdut)} Ω | ${RF.formatVoltage(RF.voppOf(r))} pk-pk`;
    }
    return `${dir} DIFF | ${RF.formatDbm(r.dbmPort)} dBm/port | ZVNA ${RF.formatNumber(r.zvna)} Ω | ZDUT ${RF.formatNumber(r.zdut)} Ω | ${RF.formatVoltage(r.vppDiff)} VOPP`;
  }

  function copyText(text, okMessage) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(okMessage);
      }).catch(function () {
        fallbackCopy(text, okMessage);
      });
      return;
    }
    fallbackCopy(text, okMessage);
  }

  function fallbackCopy(text, okMessage) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      showToast(okMessage);
    } catch (err) {
      showToast("Copy failed");
    }
    document.body.removeChild(area);
  }

  els.calc.addEventListener("click", function (event) {
    const pathBtn = event.target.closest("[data-path]");
    if (pathBtn && els.calc.contains(pathBtn)) {
      event.preventDefault();
      state.path = pathBtn.getAttribute("data-path");
      compute();
      return;
    }
    const driveBtn = event.target.closest("[data-drive]");
    if (driveBtn && (driveBtn.id === "btn-se" || driveBtn.id === "btn-diff")) {
      event.preventDefault();
      setDrive(driveBtn.getAttribute("data-drive"));
    }
  });

  els.dbm.addEventListener("input", function () {
    state.source = "dbm";
    state.dbm = Bench.read(els.dbm);
    compute();
  });
  els.dbm.addEventListener("focus", function (event) { event.target.select(); });
  els.dbm.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 1;
      stepDbm(event.key === "ArrowUp" ? step : -step);
    }
  });

  els.vopp.addEventListener("input", function () {
    state.source = "vopp";
    state.vopp = RF.unitToVolts(Bench.read(els.vopp, true), state.unit);
    compute();
  });
  els.vopp.addEventListener("focus", function (event) { event.target.select(); });

  els.voppUnit.addEventListener("change", function () {
    const next = els.voppUnit.value;
    if (state.source === "vopp") {
      const typed = Bench.read(els.vopp, true);
      const volts = RF.unitToVolts(typed, state.unit);
      state.unit = next;
      if (Number.isFinite(volts)) state.vopp = volts;
    } else {
      state.unit = next;
    }
    compute();
  });

  els.zdut.addEventListener("input", compute);
  els.zdut.addEventListener("focus", function (event) { event.target.select(); });

  els.calc.addEventListener("click", function (event) {
    const chip = event.target.closest(".chip[data-z]");
    if (!chip) return;
    const group = chip.parentElement;
    if (!group || group.getAttribute("data-target") !== "zdut") return;
    Bench.setNumber(els.zdut, Number(chip.getAttribute("data-z")));
    compute();
  });

  els.dbmDec.addEventListener("click", function () { stepDbm(-1); });
  els.dbmInc.addEventListener("click", function () { stepDbm(1); });

  els.copyResult.addEventListener("click", function () {
    copyText(resultLine(), "Result copied");
    els.copyResult.classList.add("is-copied");
    window.setTimeout(function () { els.copyResult.classList.remove("is-copied"); }, 1200);
  });

  els.copyLink.addEventListener("click", function () {
    if (!Bench.valid) return;
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  Bench.setNumber(els.zdut, state.zdut);
  els.voppUnit.value = state.unit;
  if (state.source === "dbm") {
    Bench.setNumber(els.dbm, state.dbm, 'dBm');
  } else {
    els.vopp.value = String(RF.voltsToUnit(state.vopp, state.unit));
  }
  compute();
})();
