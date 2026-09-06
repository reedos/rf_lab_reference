(function () {
  const RF = window.RF;
  const els = {
    rl: document.getElementById("rl"),
    vswr: document.getElementById("vswr"),
    gamma: document.getElementById("gamma"),
    mloss: document.getElementById("mloss"),
    z0: document.getElementById("z0"),
    z: document.getElementById("z"),
    metrics: document.getElementById("metrics"),
    chart: document.getElementById("chart"),
    chartCap: document.getElementById("chart-cap"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast"),
    calc: document.getElementById("calc")
  };

  const PLOT = { left: 52, right: 696, top: 18, bottom: 246, width: 644, height: 228 };
  const state = {
    source: "z",
    z0: 50,
    z: 50,
    chart: "rl",
    result: null,
    zHigh: 50,
    zLow: 50
  };
  let toastTimer = 0;

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const z0 = RF.parseNumber(q.get("z0"));
    if (z0 > 0) state.z0 = z0;
    const src = q.get("from");
    if (src === "rl" || src === "vswr" || src === "gamma" || src === "mloss" || src === "z") {
      state.source = src;
    }
    const chart = q.get("chart");
    if (chart === "rl" || chart === "vswr" || chart === "ml") state.chart = chart;
    const z = RF.parseNumber(q.get("z"));
    const rl = RF.parseNumber(q.get("rl"));
    const vswr = RF.parseNumber(q.get("vswr"));
    const gamma = RF.parseNumber(q.get("g"));
    const mloss = RF.parseNumber(q.get("ml"));
    if (state.source === "vswr" && vswr >= 1) state.vswr = vswr;
    else if (state.source === "gamma" && gamma >= 0) state.gamma = gamma;
    else if (state.source === "mloss" && mloss >= 0) state.mloss = mloss;
    else if (state.source === "rl" && Number.isFinite(rl)) state.rl = rl;
    else if (z > 0) {
      state.source = "z";
      state.z = z;
    }
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("z0", String(state.z0));
    q.set("from", state.source);
    q.set("chart", state.chart);
    if (state.source === "z") q.set("z", String(state.z));
    else if (state.source === "vswr") q.set("vswr", String(state.vswr));
    else if (state.source === "gamma") q.set("g", String(state.gamma));
    else if (state.source === "mloss") q.set("ml", String(state.mloss));
    else q.set("rl", String(state.rl));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function metric(label, value) {
    return `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function zFromVswr(vswr, z0, high) {
    if (!(vswr >= 1) || !(z0 > 0)) return NaN;
    return high ? z0 * vswr : z0 / vswr;
  }

  function yValue(m) {
    if (state.chart === "vswr") return m.vswr;
    if (state.chart === "ml") return m.mloss;
    return m.rl;
  }

  function yRange() {
    if (state.chart === "vswr") return { min: 1, max: 10, log: false, nice: [1, 2, 3, 5, 10] };
    if (state.chart === "ml") return { min: 0, max: 3, log: false, nice: [0, 0.5, 1, 2, 3] };
    return { min: 0, max: 40, log: false, nice: [0, 10, 20, 30, 40] };
  }

  function xToSvg(z, zMin, zMax) {
    const t = (Math.log(z) - Math.log(zMin)) / (Math.log(zMax) - Math.log(zMin));
    return PLOT.left + t * PLOT.width;
  }

  function svgToZ(x, zMin, zMax) {
    const t = (x - PLOT.left) / PLOT.width;
    return Math.exp(Math.log(zMin) + t * (Math.log(zMax) - Math.log(zMin)));
  }

  function yToSvg(v, range) {
    const c = Math.min(range.max, Math.max(range.min, v));
    const t = (c - range.min) / (range.max - range.min);
    return PLOT.bottom - t * PLOT.height;
  }

  function drawChart(z0, zMark, gamma) {
    if (!els.chart) return;
    const zMin = z0 / 20;
    const zMax = z0 * 20;
    const range = yRange();
    const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#f3b63a";
    const grid = "rgba(255,255,255,0.08)";
    const muted = "#8b929e";
    const n = 96;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const z = Math.exp(Math.log(zMin) + (Math.log(zMax) - Math.log(zMin)) * i / (n - 1));
      const g = Math.abs(RF.reflection(z, z0));
      const m = RF.matchFromGamma(g);
      const yv = yValue(m);
      if (!Number.isFinite(yv)) continue;
      pts.push([xToSvg(z, zMin, zMax), yToSvg(yv, range)]);
    }
    const d = pts.map(function (p, i) {
      return (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2);
    }).join(" ");

    const xTicks = [z0 / 10, z0 / 5, z0 / 2, z0, z0 * 2, z0 * 5, z0 * 10].filter(function (z) {
      return z >= zMin && z <= zMax;
    });
    let gridXml = "";
    xTicks.forEach(function (z) {
      const x = xToSvg(z, zMin, zMax);
      gridXml += `<line x1="${x}" y1="${PLOT.top}" x2="${x}" y2="${PLOT.bottom}" stroke="${grid}"/>`;
      const label = z >= 100 ? String(Math.round(z)) : RF.trimFixed(z, 2);
      gridXml += `<text x="${x}" y="${PLOT.bottom + 16}" text-anchor="middle" fill="${muted}">${label}</text>`;
    });
    range.nice.forEach(function (v) {
      const y = yToSvg(v, range);
      gridXml += `<line x1="${PLOT.left}" y1="${y}" x2="${PLOT.right}" y2="${y}" stroke="${grid}"/>`;
      gridXml += `<text x="${PLOT.left - 8}" y="${y + 4}" text-anchor="end" fill="${muted}">${v}</text>`;
    });

    let marker = "";
    if (zMark > 0) {
      const zClip = Math.min(zMax, Math.max(zMin, zMark));
      const xm = xToSvg(zClip, zMin, zMax);
      const g = Math.abs(gamma);
      const m = RF.matchFromGamma(g);
      const ym = yToSvg(yValue(m), range);
      marker = `<line x1="${xm}" y1="${PLOT.top}" x2="${xm}" y2="${PLOT.bottom}" stroke="${accent}" stroke-dasharray="4 4"/>
        <circle cx="${xm}" cy="${ym}" r="5" fill="${accent}"/>`;
    }

    const yTitle = state.chart === "vswr" ? "VSWR" : state.chart === "ml" ? "ML dB" : "RL dB";
    els.chart.innerHTML = `
      <rect x="${PLOT.left}" y="${PLOT.top}" width="${PLOT.width}" height="${PLOT.height}" fill="none" stroke="${grid}"/>
      ${gridXml}
      <path d="${d}" fill="none" stroke="${accent}" stroke-width="2"/>
      ${marker}
      <text x="${(PLOT.left + PLOT.right) / 2}" y="274" text-anchor="middle" fill="${muted}">Z (Ω)</text>
      <text x="14" y="${(PLOT.top + PLOT.bottom) / 2}" text-anchor="middle" fill="${muted}" transform="rotate(-90 14 ${(PLOT.top + PLOT.bottom) / 2})">${yTitle}</text>
    `;
    els.chartCap.innerHTML = `vs real Z, Z<sub>0</sub> = ${RF.trimFixed(z0, 4)} Ω`;
  }

  function compute() {
    const z0 = RF.parseNumber(els.z0.value);
    state.z0 = z0 > 0 ? z0 : NaN;
    let gamma = NaN;
    if (state.source === "z") {
      const z = RF.parseNumber(els.z.value);
      state.z = z;
      if (z > 0 && z0 > 0) gamma = Math.abs(RF.reflection(z, z0));
    } else if (state.source === "rl") gamma = RF.gammaFromRl(state.rl);
    else if (state.source === "vswr") gamma = RF.gammaFromVswr(state.vswr);
    else if (state.source === "gamma") gamma = state.gamma;
    else gamma = RF.gammaFromMismatchLoss(state.mloss);

    document.querySelectorAll(".chips").forEach(function (group) {
      const target = group.getAttribute("data-target");
      const value = target === "z" ? state.z : state.z0;
      group.querySelectorAll(".chip").forEach(function (chip) {
        chip.classList.toggle("is-active", Number(chip.getAttribute("data-z")) === value);
      });
    });
    document.querySelectorAll("[data-chart]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-chart") === state.chart);
    });

    if (!(z0 > 0) || !Number.isFinite(gamma) || gamma < 0) {
      state.result = null;
      els.metrics.innerHTML = metric("Status", "Enter Z, RL, VSWR, |Γ|, or mismatch loss");
      drawChart(z0 > 0 ? z0 : 50, NaN, NaN);
      return;
    }

    const m = RF.matchFromGamma(gamma);
    state.result = m;
    state.rl = m.rl;
    state.vswr = m.vswr;
    state.gamma = m.gamma;
    state.mloss = m.mloss;
    state.zHigh = zFromVswr(m.vswr, z0, true);
    state.zLow = zFromVswr(m.vswr, z0, false);
    if (state.source !== "z") {
      const prev = RF.parseNumber(els.z.value);
      const useLow = prev > 0 && state.zLow > 0 && state.zHigh > 0 &&
        Math.abs(Math.log(prev) - Math.log(state.zLow)) < Math.abs(Math.log(prev) - Math.log(state.zHigh));
      state.z = useLow ? state.zLow : state.zHigh;
    }

    if (document.activeElement !== els.rl) {
      els.rl.value = Number.isFinite(m.rl) ? RF.trimFixed(m.rl, 2) : "∞";
    }
    if (document.activeElement !== els.vswr) {
      els.vswr.value = Number.isFinite(m.vswr) ? RF.trimFixed(m.vswr, 3) : "∞";
    }
    if (document.activeElement !== els.gamma) {
      els.gamma.value = RF.trimFixed(m.gamma, 4);
    }
    if (document.activeElement !== els.mloss) {
      els.mloss.value = Number.isFinite(m.mloss) ? RF.trimFixed(m.mloss, 3) : "∞";
    }
    if (document.activeElement !== els.z && Number.isFinite(state.z)) {
      els.z.value = RF.trimFixed(state.z, 4);
    }

    const signed = (state.z > 0 && z0 > 0) ? RF.reflection(state.z, z0) : m.gamma;
    els.metrics.innerHTML = [
      metric("Z high", Number.isFinite(state.zHigh) ? `${RF.trimFixed(state.zHigh, 3)} Ω` : "—"),
      metric("Z low", Number.isFinite(state.zLow) ? `${RF.trimFixed(state.zLow, 3)} Ω` : "—"),
      metric("Γ signed", RF.trimFixed(signed, 4)),
      metric("Power delivered", Number.isFinite(m.delivered) ? RF.trimFixed(100 * m.delivered, 2) + " %" : "—")
    ].join("");
    drawChart(z0, state.z, signed);
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

  function bind(id, source, assign) {
    const el = els[id];
    el.addEventListener("input", function () {
      state.source = source;
      assign(RF.parseNumber(el.value));
      compute();
    });
    el.addEventListener("focus", function (event) { event.target.select(); });
  }

  bind("rl", "rl", function (v) { state.rl = v; });
  bind("vswr", "vswr", function (v) { state.vswr = v; });
  bind("gamma", "gamma", function (v) { state.gamma = v; });
  bind("mloss", "mloss", function (v) { state.mloss = v; });
  els.z.addEventListener("input", function () {
    state.source = "z";
    compute();
  });
  els.z0.addEventListener("input", compute);
  els.z.addEventListener("focus", function (event) { event.target.select(); });
  els.z0.addEventListener("focus", function (event) { event.target.select(); });

  els.calc.addEventListener("click", function (event) {
    const chartBtn = event.target.closest("[data-chart]");
    if (chartBtn) {
      state.chart = chartBtn.getAttribute("data-chart");
      compute();
      return;
    }
    const chip = event.target.closest(".chip[data-z]");
    if (!chip) return;
    const target = chip.parentElement.getAttribute("data-target");
    if (target === "z0") {
      els.z0.value = chip.getAttribute("data-z");
    } else if (target === "z") {
      els.z.value = chip.getAttribute("data-z");
      state.source = "z";
    }
    compute();
  });

  els.chart.addEventListener("click", function (event) {
    const z0 = state.z0;
    if (!(z0 > 0)) return;
    const rect = els.chart.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 720;
    if (x < PLOT.left || x > PLOT.right) return;
    const z = svgToZ(x, z0 / 20, z0 * 20);
    els.z.value = RF.trimFixed(z, 4);
    state.source = "z";
    compute();
  });

  els.copyResult.addEventListener("click", function () {
    const m = state.result;
    if (!m) return;
    copyText(
      `Z ${RF.trimFixed(state.z, 3)} Ω vs Z0 ${RF.trimFixed(state.z0, 3)} Ω | RL ${Number.isFinite(m.rl) ? m.rl.toFixed(2) : "∞"} dB | VSWR ${RF.formatVswr(m.vswr)} | Γ ${RF.trimFixed(m.gamma, 4)}`,
      "Result copied"
    );
  });
  els.copyLink.addEventListener("click", function () {
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  els.z0.value = String(state.z0);
  if (state.source === "z") els.z.value = String(state.z);
  compute();
})();
