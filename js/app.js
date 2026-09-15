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
    voppHint: document.getElementById("vopp-hint"),
    calc: document.getElementById("calc"),
    colourKey: document.getElementById("colour-key"),
    schematic: document.getElementById("schematic"),
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

  // VNA → DUT looks at the DUT input, DUT → VNA at its output; that side of the shared card
  // is what this page edits and reads.
  const cardSide = () => state.path === 'src' ? 'in' : 'out';
  function pullFromCard() {
    const dut = Dut.get(), side = cardSide();
    state.drive = side === 'in' ? dut.din : dut.dout;
    state.zdut = side === 'in' ? dut.zin : dut.zout;
    Bench.setNumber(els.zdut, state.zdut);
  }
  function pushToCard() {
    const side = cardSide();
    Dut.set(side === 'in' ? { din: state.drive, zin: state.zdut } : { dout: state.drive, zout: state.zdut }, { silent: true });
  }

  function readQuery() {
    const q = LinkState.read();
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
    // A link without the page's own drive and impedance takes them from the DUT card.
    if (!q.has('m') && !q.has('zd')) pullFromCard();
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
    pushToCard();

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

  function metric(label, value, cls) {
    return `<div class="metric${cls ? ' ' + cls : ''}"><dt>${label}</dt><dd>${value}</dd></div>`;
  }
  const tint = Bench.tint, mark = Bench.mark;

  const railLabel = r => mark('in', `Z<sub>S</sub> ${RF.formatNumber(r.zS)} Ω`) + ' → ' +
    mark('out', `Z<sub>L</sub> ${RF.formatNumber(r.zL)} Ω`);

  // The block diagram, drawn from the state by the shared builder. Both rails of a differential
  // pair run from the source impedance to the load impedance, so both carry the same label.
  function diagramSpec(r, ok) {
    const copy = PATH_COPY[state.path], dash = '—';
    const zpTxt = zLabel("Z<sub>VNA</sub>", state.zvna), zdTxt = zLabel("Z<sub>DUT</sub>", state.zdut > 0 ? state.zdut : NaN);
    const leftZ = state.path === "src" ? zpTxt : zdTxt, rightZ = state.path === "src" ? zdTxt : zpTxt;
    const dbm = ok ? `${RF.formatDbm(r.dbm)} dBm` : dash, rail = ok ? railLabel(r) : '';
    const readout = (kicker, id, cls, value) => `<div class="node-readout"><span>${kicker}</span><strong id="${id}" class="${cls}">${value}</strong></div>`;
    if (state.drive !== "diff") {
      return { id: 'schematic-se', caption: copy.seCap, ariaLabel: 'Single-ended drive block diagram',
        blocks: [
          { kicker: copy.seSrcKicker, title: copy.seSrcTitle, sub: copy.seSrcSub, z: mark('in', leftZ), accent: 'in',
            foot: readout(copy.sePowerKicker, 'se-node-power', state.path === 'rx' ? 'tint-out' : 'tint-in', ok ? RF.formatPowerWatts(state.path === "rx" ? r.wattsDelivered : r.wattsAvailable) : dash) },
          { kicker: copy.seLoadKicker, title: copy.seLoadTitle, sub: copy.seLoadSub, z: mark('out', rightZ), accent: 'out',
            foot: readout('VOPP', 'se-node-vopp', 'tint-out', ok ? RF.formatVoltage(RF.voppOf(r)) : dash) + Bench.diagram.ground } ],
        buses: [{ rails: [{ tone: 'accent', left: { label: copy.seSrcPort }, right: { label: copy.seLoadPort },
          top: { html: dbm, id: 'se-line-dbm' }, bottom: { html: rail, id: 'se-line-z' } }] }] };
    }
    return { id: 'schematic-diff', caption: copy.diffCap, ariaLabel: 'Differential drive block diagram',
      blocks: [
        { kicker: copy.diffSrcKicker, title: copy.diffSrcTitle, sub: copy.diffSrcSub, z: mark('in', leftZ), accent: 'in', midcap: '180°' },
        { kicker: copy.diffLoadKicker, title: copy.diffLoadTitle, sub: copy.diffLoadSub, z: mark('out', rightZ), accent: 'out',
          foot: (Bench.narrow ? readout('VOPP', 'diff-node-vopp', 'tint-out', ok ? RF.formatVoltage(r.vppDiff) : dash) : '') +
            `<span id="diff-node-z">Z<sub>diff</sub> DUT ${ok ? RF.formatNumber(r.zDiffDut) : dash} Ω</span>` } ],
      buses: [{ rails: [
          { tone: 'plus', left: { label: copy.diffSrcP1 }, right: { label: copy.diffLoadP1 }, top: { html: dbm, id: 'diff-p1-dbm' }, bottom: { html: rail, id: 'diff-p1-z' } },
          { tone: 'minus', left: { label: copy.diffSrcP2 }, right: { label: copy.diffLoadP2 }, top: { html: dbm, id: 'diff-p2-dbm' }, bottom: { html: rail, id: 'diff-p2-z' } } ],
        brace: Bench.narrow ? null : { side: 'out', label: `<span class="callout-kicker">VOPP</span><strong id="diff-node-vopp" class="tint-out">${ok ? RF.formatVoltage(r.vppDiff) : dash}</strong>` } }] };
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
    Bench.diagram(els.schematic, diagramSpec(state.result, ok));

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

    if (els.colourKey) {
      const srcName = state.path === 'src' ? 'the VNA' : 'the DUT';
      const loadName = state.path === 'src' ? 'the DUT' : 'the VNA';
      els.colourKey.innerHTML =
        `<span class="key key-in">Z<sub>S</sub> · available power</span> source side, ${srcName}` +
        `<span class="key key-out">Z<sub>L</sub> · delivered power · loaded voltage</span> load side, ${loadName}` +
        `<span class="key">+ and − mark rail polarity, not a quantity</span>`;
    }

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
      Bench.update({ valid: false, lines: ['Correct the power/voltage and impedance inputs before calculating or saving.'] });
      return;
    }

    const voppShow = RF.voppOf(r);
    const gammaTxt = Number.isFinite(r.gamma) ? RF.formatNumber(r.gamma) : "—";
    if (r.drive === "se") {
      els.metrics.innerHTML = [
        metric("V<sub>rms</sub> at load", RF.formatVoltage(r.vrmsSe)),
        metric("V<sub>pk</sub> at load", RF.formatVoltage(r.vpkSe)),
        metric("Available", `${RF.formatDbm(r.dbmAvailable)} dBm`, 'port-in'),
        metric("Delivered", `${RF.formatDbm(r.dbmDelivered)} dBm`, 'port-out'),
        metric("Γ", gammaTxt),
        metric("V<sub>oc</sub> pk-pk", RF.formatVoltage(r.vocVpp))
      ].join("");
    } else {
      els.metrics.innerHTML = [
        metric("VOPP / line", RF.formatVoltage(r.vppSe)),
        metric("V<sub>rms</sub> diff", RF.formatVoltage(r.vrmsDiff)),
        metric("Available / port", `${RF.formatDbm(r.dbmAvailable)} dBm`, 'port-in'),
        metric("Delivered / port", `${RF.formatDbm(r.dbmDelivered)} dBm`, 'port-out'),
        metric("Γ (per side)", gammaTxt),
        metric("Z<sub>diff</sub> DUT", `${RF.formatNumber(r.zDiffDut)} Ω`)
      ].join("");
    }
    // Every substituted value carries its unit, and the chain runs in the direction the page
    // actually solved: from power when dBm was typed, from voltage when VOPP was.
    const zS = tint('in', 'Z_{\\mathrm S}'), zL = tint('out', 'Z_{\\mathrm L}');
    const zSv = tint('in', tex(r.zS, 'Ω')), zLv = tint('out', tex(r.zL, 'Ω'));
    const fromVoltage = state.source === 'vopp';
    const diff = r.drive === 'diff';
    const perPort = diff ? ' per port' : '';
    const powerName = state.path === 'src' ? 'P_{\\mathrm{avs}}' : 'P_{\\mathrm{del}}';
    const powerWatts = state.path === 'src' ? r.wattsAvailable : r.wattsDelivered;
    const fraction = r.gamma < 1 ? 1 - r.gamma * r.gamma : 0;
    const dbmFromWatts = eq('Power in dBm' + perPort,
      `P_{\\mathrm{dBm}} &= 10\\log_{10}\\frac{${powerName}}{10^{-3}\\,\\mathrm W}`,
      tex(r.dbm, 'dBm'), `10\\log_{10}\\frac{${tex(powerWatts, 'W')}}{10^{-3}\\,\\mathrm W}`);
    const wattsFromDbm = eq((state.path === 'src' ? 'Available source power' : 'Delivered receiver power') + perPort,
      `${powerName} &= 10^{P_{\\mathrm{dBm}}/10}\\times 10^{-3}\\,\\mathrm W`,
      tex(powerWatts, 'W'), `10^{${tex(r.dbm, 'dBm', false)}/10}\\times 10^{-3}\\,\\mathrm W`);
    const perLine = eq('Peak-to-peak voltage per line',
      `V_{\\mathrm{pp,line}} &= 2\\sqrt{2}\\,V_{\\mathrm{rms,L}}`,
      volts(r.vppSe), `2\\sqrt{2}\\times ${volts(r.vrmsSe)}`);
    const rmsFromLine = eq('RMS voltage at the load',
      `V_{\\mathrm{rms,L}} &= \\frac{V_{\\mathrm{pp,line}}}{2\\sqrt{2}}`,
      volts(r.vrmsSe), `\\frac{${volts(r.vppSe)}}{2\\sqrt{2}}`);
    const splitDiff = eq('Per-line voltage from the differential swing',
      `V_{\\mathrm{pp,line}} &= \\frac{V_{\\mathrm{pp,diff}}}{2}`,
      volts(r.vppSe), `\\frac{${volts(r.vppDiff)}}{2}`);
    const joinDiff = eq('Differential peak-to-peak voltage',
      `V_{\\mathrm{pp,diff}} &= 2\\,V_{\\mathrm{pp,line}}`,
      volts(r.vppDiff), `2\\times ${volts(r.vppSe)}`);
    const forward = state.path === 'src'
      ? [wattsFromDbm,
         eq('Open-circuit source voltage',
           `V_{\\mathrm{oc,rms}} &= 2\\sqrt{P_{\\mathrm{avs}}\\,${zS}}`,
           volts(r.vocRms), `2\\sqrt{${tex(r.wattsAvailable, 'W')}\\times ${zSv}}`),
         eq('RMS voltage at the load',
           `V_{\\mathrm{rms,L}} &= V_{\\mathrm{oc,rms}}\\frac{${zL}}{${zS}+${zL}}`,
           volts(r.vrmsSe), `${volts(r.vocRms)}\\times\\frac{${zLv}}{${zSv}+${zLv}}`),
         perLine]
      : [wattsFromDbm,
         eq('RMS voltage at the load',
           `V_{\\mathrm{rms,L}} &= \\sqrt{P_{\\mathrm{del}}\\,${zL}}`,
           volts(r.vrmsSe), `\\sqrt{${tex(r.wattsDelivered, 'W')}\\times ${zLv}}`),
         perLine];
    const reverse = state.path === 'src'
      ? [...(diff ? [splitDiff] : []), rmsFromLine,
         eq('Open-circuit source voltage from the loaded voltage',
           `V_{\\mathrm{oc,rms}} &= V_{\\mathrm{rms,L}}\\frac{${zS}+${zL}}{${zL}}`,
           volts(r.vocRms), `${volts(r.vrmsSe)}\\times\\frac{${zSv}+${zLv}}{${zLv}}`),
         eq('Available source power' + perPort,
           `P_{\\mathrm{avs}} &= \\frac{V_{\\mathrm{oc,rms}}^{2}}{4\\,${zS}}`,
           tex(r.wattsAvailable, 'W'), `\\frac{(${volts(r.vocRms)})^{2}}{4\\times ${zSv}}`),
         dbmFromWatts]
      : [...(diff ? [splitDiff] : []), rmsFromLine,
         eq('Delivered receiver power' + perPort,
           `P_{\\mathrm{del}} &= \\frac{V_{\\mathrm{rms,L}}^{2}}{${zL}}`,
           tex(r.wattsDelivered, 'W'), `\\frac{(${volts(r.vrmsSe)})^{2}}{${zLv}}`),
         dbmFromWatts];
    Bench.update({ valid: true, lines: [
      'CW sinusoid into real positive impedances. Z_VNA is the analyzer port at 50 Ω; Z_DUT is the DUT impedance at that plane, per side if differential. Differential drive is two equal signals 180° apart, so the differential voltage is twice the per-line voltage.',
      `Direction: ${state.path === 'src' ? 'VNA → DUT, so the level is available source power' : 'DUT → VNA, so the level is delivered receiver power'}. ${fromVoltage ? 'VOPP was typed, so the chain below runs from voltage to power.' : 'The level was typed, so the chain below runs from power to voltage.'}`,
      eq('Reference impedances',
        `${zS} &= ${zSv} \\\\ ${zL} &= ${zLv}` + (diff ? ` \\\\ Z_{\\mathrm{diff}} &= 2\\,${zL} = ${tint('out', tex(r.zDiffDut, 'Ω'))}` : '')),
      ...(fromVoltage ? reverse : forward),
      ...(diff && !fromVoltage ? [joinDiff] : []),
      ...(state.path === 'src' ? [eq('Delivered power' + perPort,
        `P_{\\mathrm{del}} &= \\frac{V_{\\mathrm{rms,L}}^{2}}{${zL}}`,
        tex(r.wattsDelivered, 'W'), `\\frac{(${volts(r.vrmsSe)})^{2}}{${zLv}}`)] : []),
      eq('Reflection coefficient at this plane',
        `\\Gamma &= \\frac{${zL}-${zS}}{${zL}+${zS}}`,
        tex(r.gamma), `\\frac{${zLv}-${zSv}}{${zLv}+${zSv}}`),
      eq('Fraction of the available power that is delivered',
        `\\frac{P_{\\mathrm{del}}}{P_{\\mathrm{avs}}} &= 1-|\\Gamma|^{2}`,
        `${tex(fraction * 100, '%')}\\ \\left(${tex(fraction > 0 ? 10 * Math.log10(fraction) : -Infinity, 'dB')}\\right)`,
        `1-(${tex(r.gamma)})^{2}`),
      ...(diff ? [eq('Total power across both ports',
        `P_{\\mathrm{total}} &= 2\\,P_{\\mathrm{port}}`,
        tex(state.path === 'src' ? r.dbmTotalAvailable : r.dbmTotalDelivered, 'dBm'),
        `${tex(r.dbm, 'dBm', false)}+10\\log_{10}2\\,\\mathrm{dBm}`)] : []),
      diff
        ? 'The differential voltage is across the pair, and the differential impedance is twice the per-side value.'
        : 'The voltage is at the load reference plane, which is the same node as the DUT when they are connected directly.'
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
        <td class="num">${RF.formatDbm(se.dbmDelivered)} dBm</td>
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
      pullFromCard();
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
    // The digits you typed stay put; the unit you pick says what they mean. When VOPP is the
    // solved field instead, compute() rewrites it in the new unit.
    state.unit = els.voppUnit.value;
    if (state.source === "vopp") state.vopp = RF.unitToVolts(Bench.read(els.vopp, true), state.unit);
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

  document.addEventListener('dut-change', function () { pullFromCard(); compute(); });
  document.addEventListener('layout-change', compute);
  Dut.describe('the input side (topology and Z per line) when the VNA drives the DUT, and the output side when the DUT drives the VNA');
  Bench.exports({ figureTitle: 'Drive schematic', figure: () => [document.querySelector('.schematic-stage'), els.colourKey, els.metrics], caption: resultLine });
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
