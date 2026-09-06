(function () {
  const RF = window.RF;
  const els = {
    er: document.getElementById("er"),
    vf: document.getElementById("vf"),
    freq: document.getElementById("freq"),
    freqUnit: document.getElementById("freq-unit"),
    length: document.getElementById("length"),
    lenUnit: document.getElementById("len-unit"),
    delay: document.getElementById("delay"),
    delayUnit: document.getElementById("delay-unit"),
    degrees: document.getElementById("degrees"),
    metrics: document.getElementById("metrics"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast"),
    chips: Array.prototype.slice.call(document.querySelectorAll(".chip"))
  };

  const state = {
    source: "length",
    er: 1,
    freq: 1e9,
    lengthM: 0.1,
    delayS: 0,
    degrees: 0
  };
  let toastTimer = 0;
  let erSource = "er";

  function freqToHz(value, unit) {
    if (unit === "GHz") return value * 1e9;
    if (unit === "MHz") return value * 1e6;
    if (unit === "kHz") return value * 1e3;
    return value;
  }

  function hzToUnit(hz, unit) {
    if (unit === "GHz") return hz / 1e9;
    if (unit === "MHz") return hz / 1e6;
    if (unit === "kHz") return hz / 1e3;
    return hz;
  }

  function lengthToM(value, unit) {
    if (unit === "mm") return value / 1000;
    if (unit === "cm") return value / 100;
    if (unit === "in") return value * 0.0254;
    return value;
  }

  function mToLength(m, unit) {
    if (unit === "mm") return m * 1000;
    if (unit === "cm") return m * 100;
    if (unit === "in") return m / 0.0254;
    return m;
  }

  function delayToS(value, unit) {
    if (unit === "ps") return value * 1e-12;
    if (unit === "ns") return value * 1e-9;
    if (unit === "µs") return value * 1e-6;
    return value;
  }

  function sToDelay(s, unit) {
    if (unit === "ps") return s * 1e12;
    if (unit === "ns") return s * 1e9;
    if (unit === "µs") return s * 1e6;
    return s;
  }

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const er = RF.parseNumber(q.get("er"));
    if (er > 0) state.er = er;
    const f = RF.parseNumber(q.get("f"));
    const fu = q.get("fu");
    if (f > 0) {
      if (fu) els.freqUnit.value = fu;
      state.freq = freqToHz(f, els.freqUnit.value);
      els.freq.value = String(f);
    }
    const src = q.get("from");
    if (src === "length" || src === "delay" || src === "degrees") state.source = src;
    const L = RF.parseNumber(q.get("L"));
    if (L > 0) {
      const lu = q.get("lu");
      if (lu) els.lenUnit.value = lu;
      state.lengthM = lengthToM(L, els.lenUnit.value);
    }
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("er", String(state.er));
    q.set("f", els.freq.value);
    q.set("fu", els.freqUnit.value);
    q.set("from", state.source);
    q.set("L", els.length.value);
    q.set("lu", els.lenUnit.value);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function metric(label, value) {
    return `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function formatLen(m) {
    if (!Number.isFinite(m)) return "—";
    if (m < 0.01) return `${RF.trimFixed(m * 1000, 3)} mm`;
    if (m < 1) return `${RF.trimFixed(m * 100, 3)} cm`;
    return `${RF.trimFixed(m, 4)} m`;
  }

  function formatTime(s) {
    if (!Number.isFinite(s)) return "—";
    if (s < 1e-9) return `${RF.trimFixed(s * 1e12, 3)} ps`;
    if (s < 1e-6) return `${RF.trimFixed(s * 1e9, 3)} ns`;
    return `${RF.trimFixed(s * 1e6, 3)} µs`;
  }

  function compute() {
    const er = RF.parseNumber(els.er.value);
    const vf = RF.parseNumber(els.vf.value);
    if (erSource === "er" && er > 0) {
      state.er = er;
      if (document.activeElement !== els.vf) els.vf.value = RF.trimFixed(RF.vfFromEr(er), 4);
    } else if (erSource === "vf" && vf > 0) {
      state.er = RF.erFromVf(vf);
      if (document.activeElement !== els.er) els.er.value = RF.trimFixed(state.er, 4);
    }

    const fVal = RF.parseNumber(els.freq.value);
    state.freq = freqToHz(fVal, els.freqUnit.value);

    if (state.source === "length") {
      state.lengthM = lengthToM(RF.parseNumber(els.length.value), els.lenUnit.value);
    } else if (state.source === "delay") {
      state.delayS = delayToS(RF.parseNumber(els.delay.value), els.delayUnit.value);
      state.lengthM = RF.lengthFromDelay(state.delayS, state.er);
    } else {
      state.degrees = RF.parseNumber(els.degrees.value);
      state.lengthM = RF.lengthFromDegrees(state.degrees, state.freq, state.er);
    }

    state.delayS = RF.delayFromLength(state.lengthM, state.er);
    state.degrees = RF.degreesFromLength(state.lengthM, state.freq, state.er);
    const lambda = RF.guidedWavelength(state.freq, state.er);
    const ok = state.er > 0 && state.freq > 0 && Number.isFinite(state.lengthM);

    if (document.activeElement !== els.length) {
      const shown = mToLength(state.lengthM, els.lenUnit.value);
      els.length.value = ok ? RF.trimFixed(shown, 4) : els.length.value;
    }
    if (document.activeElement !== els.delay) {
      const shown = sToDelay(state.delayS, els.delayUnit.value);
      els.delay.value = ok ? RF.trimFixed(shown, 4) : els.delay.value;
    }
    if (document.activeElement !== els.degrees) {
      els.degrees.value = ok ? RF.trimFixed(state.degrees, 3) : els.degrees.value;
    }

    els.chips.forEach(function (chip) {
      chip.classList.toggle("is-active", Math.abs(Number(chip.getAttribute("data-er")) - state.er) < 0.05);
    });

    if (!ok) {
      els.metrics.innerHTML = metric("Status", "Enter frequency, εr, and a length, delay, or angle");
      return;
    }

    els.metrics.innerHTML = [
      metric("λ<sub>g</sub>", formatLen(lambda)),
      metric("λ<sub>g</sub>/2", formatLen(lambda / 2)),
      metric("λ<sub>g</sub>/4", formatLen(lambda / 4)),
      metric("v<sub>p</sub>", `${RF.trimFixed(RF.C_LIGHT * RF.vfFromEr(state.er) / 1e8, 3)} × 10⁸ m/s`)
    ].join("");
    writeQuery();
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

  function selectOnFocus(el) {
    el.addEventListener("focus", function (event) { event.target.select(); });
  }

  els.er.addEventListener("input", function () { erSource = "er"; compute(); });
  els.vf.addEventListener("input", function () { erSource = "vf"; compute(); });
  els.freq.addEventListener("input", compute);
  els.freqUnit.addEventListener("change", compute);
  els.length.addEventListener("input", function () { state.source = "length"; compute(); });
  els.lenUnit.addEventListener("change", function () { state.source = "length"; compute(); });
  els.delay.addEventListener("input", function () { state.source = "delay"; compute(); });
  els.delayUnit.addEventListener("change", function () { state.source = "delay"; compute(); });
  els.degrees.addEventListener("input", function () { state.source = "degrees"; compute(); });

  [els.er, els.vf, els.freq, els.length, els.delay, els.degrees].forEach(selectOnFocus);

  els.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      erSource = "er";
      els.er.value = chip.getAttribute("data-er");
      compute();
    });
  });

  els.copyResult.addEventListener("click", function () {
    copyText(
      `${hzToUnit(state.freq, els.freqUnit.value)} ${els.freqUnit.value} | εr ${RF.trimFixed(state.er, 3)} | ${formatLen(state.lengthM)} | ${formatTime(state.delayS)} | ${RF.trimFixed(state.degrees, 2)}°`,
      "Result copied"
    );
  });
  els.copyLink.addEventListener("click", function () {
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  els.er.value = String(state.er);
  compute();
})();
