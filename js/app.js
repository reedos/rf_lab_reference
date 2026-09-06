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
    dbmInc: document.getElementById("dbm-inc")
  };

  const state = {
    drive: "se",
    source: "dbm",
    dbm: 0,
    vopp: 0,
    z0: 50,
    unit: "mV",
    result: null
  };

  let toastTimer = 0;

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const drive = q.get("m");
    if (drive === "diff" || drive === "se") state.drive = drive;
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
    els.btnSe.classList.toggle("is-active", state.drive === "se");
    els.btnDiff.classList.toggle("is-active", state.drive === "diff");
    els.btnSe.setAttribute("aria-selected", state.drive === "se" ? "true" : "false");
    els.btnDiff.setAttribute("aria-selected", state.drive === "diff" ? "true" : "false");

    els.dbmScope.textContent = state.drive === "diff" ? "per port" : "into Z₀";
    els.voppLabel.textContent = state.drive === "diff" ? "VOPP (diff pk-pk)" : "VOPP (SE pk-pk)";

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
    if (r.drive === "se") {
      return `SE | ${RF.formatDbm(r.dbm)} dBm | ${r.z0} Ω | ${RF.formatVoltage(r.vpp)} pk-pk`;
    }
    return `DIFF | ${RF.formatDbm(r.dbmPort)} dBm/port | Z0 ${r.z0} Ω | ${RF.formatVoltage(r.vppDiff)} VOPP | ${RF.formatVoltage(r.vppSe)} / line`;
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
