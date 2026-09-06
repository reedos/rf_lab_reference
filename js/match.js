(function () {
  const RF = window.RF;
  const els = {
    rl: document.getElementById("rl"),
    vswr: document.getElementById("vswr"),
    gamma: document.getElementById("gamma"),
    mloss: document.getElementById("mloss"),
    metrics: document.getElementById("metrics"),
    copyResult: document.getElementById("copy-result"),
    copyLink: document.getElementById("copy-link"),
    toast: document.getElementById("toast")
  };

  const state = { source: "rl", rl: 20, result: null };
  let toastTimer = 0;

  function readQuery() {
    const q = new URLSearchParams(window.location.search);
    const src = q.get("from");
    if (src === "rl" || src === "vswr" || src === "gamma" || src === "mloss") state.source = src;
    const rl = RF.parseNumber(q.get("rl"));
    const vswr = RF.parseNumber(q.get("vswr"));
    const gamma = RF.parseNumber(q.get("g"));
    const mloss = RF.parseNumber(q.get("ml"));
    if (state.source === "vswr" && vswr >= 1) state.vswr = vswr;
    else if (state.source === "gamma" && gamma >= 0) state.gamma = gamma;
    else if (state.source === "mloss" && mloss >= 0) state.mloss = mloss;
    else if (Number.isFinite(rl)) state.rl = rl;
  }

  function writeQuery() {
    const q = new URLSearchParams();
    q.set("from", state.source);
    if (state.source === "vswr") q.set("vswr", String(state.vswr));
    else if (state.source === "gamma") q.set("g", String(state.gamma));
    else if (state.source === "mloss") q.set("ml", String(state.mloss));
    else q.set("rl", String(state.rl));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function metric(label, value) {
    return `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  }

  function compute() {
    let gamma = NaN;
    if (state.source === "rl") gamma = RF.gammaFromRl(state.rl);
    else if (state.source === "vswr") gamma = RF.gammaFromVswr(state.vswr);
    else if (state.source === "gamma") gamma = state.gamma;
    else gamma = RF.gammaFromMismatchLoss(state.mloss);

    if (!Number.isFinite(gamma) || gamma < 0) {
      state.result = null;
      els.metrics.innerHTML = metric("Status", "Enter RL, VSWR ≥ 1, |Γ| ≥ 0, or mismatch loss");
      return;
    }
    const m = RF.matchFromGamma(gamma);
    state.result = m;
    state.rl = m.rl;
    state.vswr = m.vswr;
    state.gamma = m.gamma;
    state.mloss = m.mloss;

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

    const deliveredPct = Number.isFinite(m.delivered) ? RF.trimFixed(100 * m.delivered, 2) + " %" : "—";
    els.metrics.innerHTML = [
      metric("Power delivered", deliveredPct),
      metric("Reflected fraction", Number.isFinite(m.gamma) ? RF.trimFixed(100 * m.gamma * m.gamma, 2) + " %" : "—"),
      metric("|S<sub>11</sub>| linear", RF.trimFixed(m.gamma, 4)),
      metric("VSWR", RF.formatVswr(m.vswr))
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
      navigator.clipboard.writeText(text).then(function () { showToast(ok); }).catch(function () { showToast("Copy failed"); });
      return;
    }
    showToast("Copy failed");
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

  els.copyResult.addEventListener("click", function () {
    const m = state.result;
    if (!m) return;
    copyText(
      `RL ${Number.isFinite(m.rl) ? m.rl.toFixed(2) : "∞"} dB | VSWR ${RF.formatVswr(m.vswr)} | |Γ| ${RF.trimFixed(m.gamma, 4)} | ML ${Number.isFinite(m.mloss) ? m.mloss.toFixed(3) : "∞"} dB`,
      "Result copied"
    );
  });
  els.copyLink.addEventListener("click", function () {
    writeQuery();
    copyText(window.location.href, "Link copied");
  });

  readQuery();
  compute();
})();
