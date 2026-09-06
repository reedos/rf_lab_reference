(function () {
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
    z0: document.getElementById("z0"),
    chips: Array.prototype.slice.call(document.querySelectorAll(".chip")),
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
    voppHint: document.querySelector("#field-vopp .field-label span:last-child"),
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
      seCap: "VNA drives DUT · matched to port Z₀",
      seSrcKicker: "Source",
      seSrcTitle: "VNA",
      seSrcSub: "stimulus",
      seLoadKicker: "Load",
      seLoadTitle: "DUT",
      seLoadSub: "SE input",
      seSrcPort: "Port 1",
      seLoadPort: "RF in",
      sePowerKicker: "Available",
      seLineNote: "matched DUT",
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
      voppHint: "at DUT if matched"
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
      seLineNote: "VNA load",
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
      voppHint: "at VNA port"
    }
  };

  const state = {
    drive: "se",
    path: "src",
    source: "dbm",
    dbm: 0,
    vopp: 0,
    z0: 50,
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
    const z = RF.parseNumber(q.get("z"));
    if (z > 0) state.z0 = z;
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
    }
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("m", state.drive);
    q.set("dir", state.path);
    q.set("z", String(state.z0));
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

  function currentZ() {
    const z = RF.parseNumber(els.z0.value);
    return z > 0 ? z : NaN;
  }

  function compute() {
    const z0 = currentZ();
    state.z0 = z0;
    if (!(z0 > 0)) {
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
      state.result = RF.fromVopp(state.vopp, z0, state.drive);
      state.dbm = RF.dbmOf(state.result);
    } else {
      if (!Number.isFinite(state.dbm)) {
        state.result = null;
        render(false);
        return;
      }
      state.result = RF.fromDbm(state.dbm, z0, state.drive);
      state.vopp = RF.voppOf(state.result);
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
    els.btnSe.setAttribute("aria-selected", state.drive === "se" ? "true" : "false");
    els.btnDiff.setAttribute("aria-selected", state.drive === "diff" ? "true" : "false");
    els.btnSrc.classList.toggle("is-active", state.path === "src");
    els.btnRx.classList.toggle("is-active", state.path === "rx");
    els.btnSrc.setAttribute("aria-selected", state.path === "src" ? "true" : "false");
    els.btnRx.setAttribute("aria-selected", state.path === "rx" ? "true" : "false");

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
    els.z0.value = Number.isFinite(state.z0) ? String(state.z0) : els.z0.value;

    els.chips.forEach(function (chip) {
      chip.classList.toggle("is-active", Number(chip.getAttribute("data-z")) === state.z0);
    });

    if (document.activeElement !== els.dbm) {
      els.dbm.value = ok ? RF.formatDbm(state.dbm, 2) : els.dbm.value;
    }
    if (document.activeElement !== els.vopp) {
      const shown = RF.voltsToUnit(state.vopp, state.unit);
      els.vopp.value = ok ? RF.trimFixed(shown, state.unit === "mV" ? 3 : 5) : els.vopp.value;
    }

    els.fieldDbm.classList.toggle("invalid", !ok && state.source === "dbm");
    els.fieldVopp.classList.toggle("invalid", !ok && state.source === "vopp");

    const r = state.result;
    if (!ok || !r) {
      els.metrics.innerHTML = metric("Status", "Enter a valid power, voltage, and Z₀");
      renderTable();
      return;
    }

    if (r.drive === "se") {
      els.metrics.innerHTML = [
        metric("V<sub>rms</sub>", RF.formatVoltage(r.vrms)),
        metric("V<sub>pk</sub>", RF.formatVoltage(r.vpk)),
        metric("I<sub>rms</sub>", RF.formatCurrent(r.irms)),
        metric("Power", RF.formatPowerWatts(r.watts))
      ].join("");
      els.seLineDbm.textContent = `${RF.formatDbm(r.dbm)} dBm`;
      els.seLineZ.textContent = `Port Z₀ ${RF.trimFixed(r.z0, 4)} Ω · ${copy.seLineNote}`;
      els.seNodeVopp.textContent = RF.formatVoltage(r.vpp);
      els.seNodePower.textContent = RF.formatPowerWatts(r.watts);
    } else {
      els.metrics.innerHTML = [
        metric("VOPP / line", RF.formatVoltage(r.vppSe)),
        metric("V<sub>rms</sub> diff", RF.formatVoltage(r.vrmsDiff)),
        metric("V<sub>rms</sub> / line", RF.formatVoltage(r.vrmsSe)),
        metric("I<sub>rms</sub> / line", RF.formatCurrent(r.irmsSe)),
        metric("P / port", `${RF.formatDbm(r.dbmPort)} dBm · ${RF.formatPowerWatts(r.wattsPort)}`),
        metric("P total", `${RF.formatDbm(r.dbmTotal)} dBm · ${RF.formatPowerWatts(r.wattsTotal)}`),
        metric("Z<sub>diff</sub>", `${RF.trimFixed(r.zDiff, 4)} Ω`),
        metric("V<sub>pk</sub> diff", RF.formatVoltage(r.vpkDiff))
      ].join("");
      const port = `${RF.formatDbm(r.dbmPort)} dBm`;
      const zLine = `Port Z₀ ${RF.trimFixed(r.z0, 4)} Ω`;
      els.diffP1Dbm.textContent = port;
      els.diffP2Dbm.textContent = port;
      els.diffP1Z.textContent = zLine;
      els.diffP2Z.textContent = zLine;
      els.diffNodeVopp.textContent = RF.formatVoltage(r.vppDiff);
      els.diffNodeZ.innerHTML = `Z<sub>diff</sub> ${RF.trimFixed(r.zDiff, 4)} Ω`;
    }
    renderTable();
  }

  function renderTable() {
    const z0 = state.z0 > 0 ? state.z0 : 50;
    els.refCaption.textContent = `${z0} Ω, CW sine`;
    els.refBody.innerHTML = CHEAT_DBM.map(function (dbm) {
      const se = RF.seFromDbm(dbm, z0);
      const diff = RF.diffFromPortDbm(dbm, z0);
      const sign = dbm > 0 ? `+${dbm}` : String(dbm);
      return `<tr>
        <td class="num">${sign}</td>
        <td class="num">${RF.formatVoltage(se.vpp)}</td>
        <td class="num">${RF.formatVoltage(diff.vppDiff)}</td>
        <td class="num">${RF.formatPowerWatts(se.watts)}</td>
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
    els.dbm.value = RF.formatDbm(state.dbm, 2);
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
      return `${dir} SE | ${RF.formatDbm(r.dbm)} dBm | port ${r.z0} Ω | ${RF.formatVoltage(r.vpp)} pk-pk`;
    }
    return `${dir} DIFF | ${RF.formatDbm(r.dbmPort)} dBm/port | port ${r.z0} Ω | ${RF.formatVoltage(r.vppDiff)} VOPP`;
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

  els.btnSe.addEventListener("click", function () { setDrive("se"); });
  els.btnDiff.addEventListener("click", function () { setDrive("diff"); });
  els.btnSrc.addEventListener("click", function () { state.path = "src"; compute(); });
  els.btnRx.addEventListener("click", function () { state.path = "rx"; compute(); });

  els.dbm.addEventListener("input", function () {
    state.source = "dbm";
    state.dbm = RF.parseNumber(els.dbm.value);
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
    state.vopp = RF.unitToVolts(RF.parseNumber(els.vopp.value), state.unit);
    compute();
  });
  els.vopp.addEventListener("focus", function (event) { event.target.select(); });

  els.voppUnit.addEventListener("change", function () {
    const next = els.voppUnit.value;
    if (state.source === "vopp") {
      const typed = RF.parseNumber(els.vopp.value);
      const volts = RF.unitToVolts(typed, state.unit);
      state.unit = next;
      if (Number.isFinite(volts)) state.vopp = volts;
    } else {
      state.unit = next;
    }
    compute();
  });

  els.z0.addEventListener("input", function () {
    compute();
  });
  els.z0.addEventListener("focus", function (event) { event.target.select(); });

  els.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      els.z0.value = chip.getAttribute("data-z");
      compute();
    });
  });

  els.dbmDec.addEventListener("click", function () { stepDbm(-1); });
  els.dbmInc.addEventListener("click", function () { stepDbm(1); });

  els.copyResult.addEventListener("click", function () {
    copyText(resultLine(), "Result copied");
    els.copyResult.classList.add("is-copied");
    window.setTimeout(function () { els.copyResult.classList.remove("is-copied"); }, 1200);
  });

  els.copyLink.addEventListener("click", function () {
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  els.z0.value = String(state.z0);
  els.voppUnit.value = state.unit;
  if (state.source === "dbm") {
    els.dbm.value = RF.formatDbm(state.dbm, 2);
  } else {
    els.vopp.value = RF.trimFixed(RF.voltsToUnit(state.vopp, state.unit), state.unit === "mV" ? 3 : 5);
  }
  compute();
})();
