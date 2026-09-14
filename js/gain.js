(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id);
  const fmt = RF.formatNumber;
  const metric = (key, value, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><dt>${key}</dt><dd>${value}</dd></div>`;
  // Each side keeps its own differential and single-ended value, so switching topology
  // never reinterprets a number that was entered for the other mode.
  const store = { d1: 100, s1: 50, d2: 100, s2: 50 };
  const PORTS = {
    dd: { in: 'd1', out: 'd2' },
    sd: { in: 'd1', out: 's2' },
    ds: { in: 's1', out: 'd2' },
    ss: { in: 's1', out: 's2' }
  };
  const TOPOLOGY_OF = { diff: { diff: 'dd', se: 'sd' }, se: { diff: 'ds', se: 'ss' } };
  // The shared DUT card holds one per-line value per side; a differential reference is twice it.
  function pullFromCard() {
    const dut = Dut.get();
    topology = TOPOLOGY_OF[dut.din][dut.dout];
    Object.assign(store, { d1: 2 * dut.zin, s1: dut.zin, d2: 2 * dut.zout, s2: dut.zout });
  }
  function pushToCard() {
    const spec = RF.GAIN_TOPOLOGIES[topology];
    Dut.set({ din: spec.input, dout: spec.output, zin: store.s1, zout: store.s2 }, { silent: true });
  }
  const LABELS = {
    d1: 'Input reference Z<sub>d1</sub>, differential (Ω)', s1: 'Input reference Z<sub>s1</sub>, single-ended (Ω)',
    d2: 'Output reference Z<sub>d2</sub>, differential (Ω)', s2: 'Output reference Z<sub>s2</sub>, single-ended (Ω)'
  };
  const SYMBOLS = { d1: 'Z_{d1}', s1: 'Z_{s1}', d2: 'Z_{d2}', s2: 'Z_{s2}' };
  const PLAIN = { d1: 'Zd1', s1: 'Zs1', d2: 'Zd2', s2: 'Zs2' };
  const VOLTS = { d1: 'Vd1⁺', s1: 'Vs1⁺', d2: 'Vd2', s2: 'Vs2' };
  const tint = Bench.tint;
  const ARIA = {
    d1: 'Input differential reference impedance in ohms', s1: 'Input single-ended reference impedance in ohms',
    d2: 'Output differential reference impedance in ohms', s2: 'Output single-ended reference impedance in ohms'
  };
  let topology = 'dd', result = null, terminal = null;

  function readQuery() {
    const q = new URLSearchParams(location.search);
    if (Object.hasOwn(PORTS, q.get('t'))) topology = q.get('t');
    for (const key of Object.keys(store)) {
      const value = RF.parseNumber(q.get(key));
      if (value > 0) store[key] = value;
    }
    if (!q.has('t') && !Object.keys(store).some(key => q.has(key))) pullFromCard();
    for (const id of ['s11-db', 's11-deg']) if (q.has(id)) $(id).value = q.get(id);
  }
  function writeQuery() {
    const q = new URLSearchParams({ t: topology });
    for (const key of Object.keys(store)) q.set(key, String(store[key]));
    for (const id of ['s11-db', 's11-deg']) q.set(id, Bench.raw(id));
    history.replaceState(null, '', location.pathname + '?' + q);
  }
  function applyTopology() {
    const ports = PORTS[topology];
    document.querySelectorAll('[data-topology]').forEach(button => {
      const active = button.dataset.topology === topology;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('text-z1').innerHTML = LABELS[ports.in];
    $('text-z2').innerHTML = LABELS[ports.out];
    $('z1').setAttribute('aria-label', ARIA[ports.in]);
    $('z2').setAttribute('aria-label', ARIA[ports.out]);
    $('z1').value = String(store[ports.in]);
    $('z2').value = String(store[ports.out]);
  }
  // Source, DUT and load, with a brace across a differential pair or a tap to ground for a
  // single-ended port, labelled with the voltage the conversion refers to.
  function renderDiagram(z1, z2) {
    const ports = PORTS[topology], spec = RF.GAIN_TOPOLOGIES[topology];
    const mark = Bench.mark;
    const pair = dutSide => [{ tone: 'neutral', [dutSide]: { label: '+' } }, { tone: 'neutral', [dutSide]: { label: '−' } }];
    const single = (side, label) => [{ tone: 'neutral', tap: { side, label } }];
    const subs = { d1: 'V<sub>d1</sub><sup>+</sup>', s1: 'V<sub>s1</sub><sup>+</sup>', d2: 'V<sub>d2</sub>', s2: 'V<sub>s2</sub>' };
    Bench.diagram($('gain-diagram'), { id: 'gain-figure', caption: spec.label, ariaLabel: `${spec.label}: source into DUT input, DUT output into load`,
      blocks: [
        { kicker: 'Port 1 reference', title: 'Source', sub: 'termination the parameter assumes', z: `<span class="tint-in" id="zin">${PLAIN[ports.in]} ${fmt(z1)} Ω</span>`, accent: 'in' },
        { kicker: 'Two-port', title: 'DUT', sub: spec.plain.replace(/^S(.+)$/, 'S<sub>$1</sub>') },
        { kicker: 'Port 2 reference', title: 'Load', sub: 'termination the parameter assumes', z: `<span class="tint-out" id="zout">${PLAIN[ports.out]} ${fmt(z2)} Ω</span>`, accent: 'out' } ],
      buses: [
        { rails: spec.input === 'diff' ? pair('right') : single('in', subs[ports.in]), brace: spec.input === 'diff' ? { side: 'in', label: subs[ports.in] } : null },
        { rails: spec.output === 'diff' ? pair('left') : single('out', subs[ports.out]), brace: spec.output === 'diff' ? { side: 'out', label: subs[ports.out] } : null } ] });
  }
  function readTerminal() {
    const dbText = $('s11-db').value.trim(), degText = $('s11-deg').value.trim();
    if (dbText === '' && degText === '') return { ok: true, value: null };
    if (dbText === '' || degText === '') return { ok: false, value: null, why: 'Enter both the magnitude and the phase of S11, or leave both blank.' };
    const value = RF.terminalCorrection(Bench.read('s11-db'), Bench.read('s11-deg'));
    return value ? { ok: true, value } : { ok: false, value: null, why: 'S11 must be a level at or below 0 dB with a finite phase.' };
  }
  function compute() {
    const ports = PORTS[topology];
    const z1 = Bench.read('z1'), z2 = Bench.read('z2');
    // Each side keeps its differential and single-ended values in step: one per-line value.
    if (z1 > 0) { store[ports.in] = z1; store[ports.in === 'd1' ? 's1' : 'd1'] = ports.in === 'd1' ? z1 / 2 : 2 * z1; }
    if (z2 > 0) { store[ports.out] = z2; store[ports.out === 'd2' ? 's2' : 'd2'] = ports.out === 'd2' ? z2 / 2 : 2 * z2; }
    pushToCard();
    const wanted = readTerminal();
    terminal = wanted.value;
    result = wanted.ok ? RF.gainConversion(topology, z1, z2) : null;
    if (!result) {
      $('gain-status').textContent = wanted.ok ? 'Enter a positive reference impedance for each port.' : wanted.why;
      $('gain-status').className = 'status-error';
      $('metrics').replaceChildren(); $('gain-equation').replaceChildren(); $('gain-note').textContent = '';
      $('diagram-key').replaceChildren();
      renderDiagram(store[ports.in], store[ports.out]);
      Bench.update({ valid: false, lines: ['Correct the reference impedances before calculating or saving.'] });
      return;
    }
    $('gain-status').textContent = ''; $('gain-status').className = '';
    const spec = result.spec;
    const inSym = tint('in', SYMBOLS[ports.in]), outSym = tint('out', SYMBOLS[ports.out]);
    const inVal = tint('in', tex(result.z1, 'Ω')), outVal = tint('out', tex(result.z2, 'Ω'));
    // The diagram carries the entered values and a caption that cannot contradict them.
    renderDiagram(result.z1, result.z2);
    $('diagram-key').innerHTML =
      `<span class="key key-in">${PLAIN[ports.in]} · ${VOLTS[ports.in]}</span> input reference and the incident wave` +
      `<span class="key key-out">${PLAIN[ports.out]} · ${VOLTS[ports.out]}</span> output reference and the voltage at the load` +
      `<span class="key">wires, boxes and arrows carry no value</span>`;
    $('diagram-caption').textContent = (result.db === 0
      ? `${spec.label} · ${PLAIN[ports.out]} = ${PLAIN[ports.in]}, so the voltage ratio equals the parameter.`
      : `${spec.label} · ${PLAIN[ports.out]} / ${PLAIN[ports.in]} = ${fmt(result.ratio)}, so the voltage ratio is ${fmt(Math.abs(result.db), 'dB')} dB ${result.db > 0 ? 'above' : 'below'} the parameter.`) +
      ` ${PLAIN[ports.in]} and ${PLAIN[ports.out]} are the terminations the parameter is referenced to, not the analyzer: a raw measurement is referenced to the analyzer's own ports, and after port-impedance conversion the references are the device's impedances.`;
    const parameter = spec.parameter;
    // Headline conclusion, rendered as algebra with the entered impedances substituted.
    // One line per identity on a desktop; one line per step on a phone.
    const step = Bench.narrow ? ' \\\\ &= ' : ' = ', plus = Bench.narrow ? ' \\\\ &\\quad + ' : ' + ';
    Bench.math($('gain-equation'), String.raw`\begin{aligned}
      A_{v} &= ${parameter}\sqrt{\frac{${outSym}}{${inSym}}}${step}${parameter}\sqrt{\frac{${outVal}}{${inVal}}}${step}${tex(result.factor)}\,${parameter} \\[4pt]
      20\log_{10}|A_{v}| &= 20\log_{10}|${parameter}|${plus}10\log_{10}\frac{${outSym}}{${inSym}}${step}20\log_{10}|${parameter}|${Bench.narrow ? plus.replace('+', '') : ' '}${result.db < 0 ? '-' : '+'}\ ${tex(Math.abs(result.db), 'dB')}
    \end{aligned}`, true);
    // The decibel figure is the same answer in the log domain, not a second factor, so it goes
    // on its own line as an equation rather than beside the linear factor.
    const dbLine = (symbol, db) => `<span class="metric-sub">20 log|${symbol}| = 20 log|${spec.plain}| ${db < 0 ? '−' : '+'} ${fmt(Math.abs(db), 'dB')} dB</span>`;
    $('metrics').innerHTML = [
      metric('Voltage gain', `${spec.plain} × ${fmt(result.factor)}${dbLine('A<sub>v</sub>', result.db)}`, 'primary'),
      metric('Topology', spec.label),
      metric('Input reference', `${PLAIN[ports.in]} ${fmt(result.z1)} Ω`, 'port-in'),
      metric('Output reference', `${PLAIN[ports.out]} ${fmt(result.z2)} Ω`, 'port-out'),
      metric('Power gain', `|${spec.plain}|², unchanged by the impedances`),
      metric('Impedance ratio', `${fmt(result.ratio)} = ${fmt(result.z2)} Ω / ${fmt(result.z1)} Ω`),
      ...(terminal ? [metric('Referred to the input terminal',
        terminal.degenerate ? 'Unbounded: S11 = −1 leaves no terminal voltage'
          : `${spec.plain} × ${fmt(result.factor / terminal.denominator)}${dbLine('V<sub>2</sub>/V<sub>1</sub>', result.db + terminal.db)}`)] : []),
      metric('Per line, if uncoupled', [
        result.perLine1 === null ? null : `in ${fmt(result.perLine1)} Ω`,
        result.perLine2 === null ? null : `out ${fmt(result.perLine2)} Ω`
      ].filter(Boolean).join(' · ') || 'Both ports single-ended')
    ].join('');
    $('gain-note').textContent = result.db === 0
      ? `The reference impedances are equal, so ${spec.plain} is already the voltage ratio. This is the case people generalise from, and it stops holding the moment the two ports differ.`
      : `A voltage ratio taken straight from ${spec.plain} would be wrong by ${fmt(Math.abs(result.db), 'dB')} dB here. The power ratio is unaffected.`;
    Bench.update({ valid: true, lines: [
      'Small-signal linear two-port. Both reference impedances are real and positive, and each port is terminated in its own reference impedance.',
      `Topology: ${spec.label}. A differential port behaves as an ordinary port with its own differential reference impedance.`,
      eq('Wave normalisation at each port', String.raw`a_1 &= \frac{V_1^{+}}{\sqrt{${inSym}}} \\ b_2 &= \frac{V_2^{-}}{\sqrt{${outSym}}}`),
      eq('Transmission parameter', String.raw`${parameter} &= \left.\frac{b_2}{a_1}\right|_{a_2=0}`),
      eq('Voltage ratio of the travelling waves', String.raw`\frac{V_2^{-}}{V_1^{+}} &= ${parameter}\sqrt{\frac{${outSym}}{${inSym}}}`, String.raw`${tex(result.factor)}\,${parameter}`),
      'A matched termination at port 2 leaves no reflected wave, so the total output voltage is the outgoing wave. A source of impedance Z₁ launches an incident wave equal to half its electromotive force, which is also the input terminal voltage when the input is matched.',
      eq('Voltage gain', String.raw`A_{v} &= \frac{V_2}{V_1^{+}} = ${parameter}\sqrt{\frac{${outSym}}{${inSym}}}`, String.raw`${tex(result.factor)}\,${parameter}`, String.raw`${parameter}\sqrt{\frac{${tex(result.z2, 'Ω')}}{${tex(result.z1, 'Ω')}}}`),
      eq('In decibels', String.raw`20\log_{10}|A_{v}| &= 20\log_{10}|${parameter}| + 10\log_{10}\frac{${outSym}}{${inSym}}`, tex(result.db, 'dB') + String.raw`\ \text{added}`),
      eq('Power ratio carries no impedance term', String.raw`\frac{P_2}{P_{\mathrm{avs}}} &= |${parameter}|^{2}`),
      'Squaring the magnitude cancels the normalisation, which is why the power ratio is the same whatever the reference impedances are, and the voltage ratio is not.',
      eq('Referred to the input terminal voltage', String.raw`\frac{V_2}{V_1} &= \frac{${parameter}}{1+S_{11}}\sqrt{\frac{${outSym}}{${inSym}}}`),
      terminal ? eq('Input terminal correction', String.raw`\left|1+S_{11}\right| &= \left|1+${tex(terminal.magnitude)}e^{j${tex(Bench.read('s11-deg'), 'deg')}}\right|`, tex(terminal.denominator), String.raw`\left|${tex(terminal.re)}+j(${tex(terminal.im)})\right|`)
        : 'That form needs the input reflection as well, and reduces to the line above when the input is matched.',
      terminal ? `With this reflection the terminal-referred gain is ${fmt(terminal.db, 'dB')} dB away from the incident-wave figure.` : '',
      result.perLine1 !== null || result.perLine2 !== null
        ? 'A differential reference impedance is twice the per-line value only for an uncoupled pair. A real coupled pair has twice its odd-mode impedance, which is lower.'
        : 'Both ports are single-ended here, so no differential reference is involved.'
    ] });
    writeQuery();
  }
  // Each identity is one line on a desktop; a phone gets the same algebra stacked.
  function renderDerivation() {
    const z1 = tint('in', 'Z_1'), z2 = tint('out', 'Z_2');
    const v1 = tint('in', 'V_1^{+}'), v2 = tint('out', 'V_2^{-}'), v2t = tint('out', 'V_2');
    const narrow = Bench.narrow;
    const stack = lines => narrow ? `\\begin{gathered} ${lines.join(' \\\\[6pt] ')} \\end{gathered}` : lines.join(' \\qquad ');
    const chain = parts => narrow ? `\\begin{aligned} ${parts[0]} ${parts.slice(1).map(p => '\\\\ &= ' + p).join(' ')} \\end{aligned}` : parts.join(' = ');
    const implies = (a, b) => narrow ? `\\begin{gathered} ${a} \\\\[6pt] ${b} \\end{gathered}` : `${a} \\qquad\\Longrightarrow\\qquad ${b}`;
    Bench.math($('derivation-waves'), stack([`a_1 = \\frac{${v1}}{\\sqrt{${z1}}}`, `b_2 = \\frac{${v2}}{\\sqrt{${z2}}}`, `S_{21} = \\left.\\frac{b_2}{a_1}\\right|_{a_2=0}`]), true);
    Bench.math($('derivation-ratio'), `\\frac{${v2}}{${v1}} = \\frac{b_2\\sqrt{${z2}}}{a_1\\sqrt{${z1}}} = S_{21}\\sqrt{\\frac{${z2}}{${z1}}}`, true);
    Bench.math($('derivation-gain'), implies(`A_{v} = \\frac{${v2t}}{${v1}} = S_{21}\\sqrt{\\frac{${z2}}{${z1}}}`, `|A_{v}|_{\\mathrm{dB}} = |S_{21}|_{\\mathrm{dB}} + 10\\log_{10}\\frac{${z2}}{${z1}}`), true);
    Bench.math($('derivation-power'), chain([`\\frac{P_2}{P_{\\mathrm{avs}}} ${narrow ? '&' : ''}= \\frac{|${v2t}|^{2}/${z2}}{|${v1}|^{2}/${z1}}`, `\\left|S_{21}\\sqrt{\\frac{${z2}}{${z1}}}\\right|^{2}\\frac{${z1}}{${z2}}`, `|S_{21}|^{2}`]), true);
    Bench.math($('derivation-terminal'), implies(`V_1 = ${v1}\\left(1+S_{11}\\right)`, `\\frac{${v2t}}{V_1} = \\frac{S_{21}}{1+S_{11}}\\sqrt{\\frac{${z2}}{${z1}}}`), true);
  }
  document.querySelectorAll('[data-topology]').forEach(button => button.addEventListener('click', () => {
    topology = button.dataset.topology; applyTopology(); compute();
  }));
  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const standard = button.dataset.preset === 'standard';
    Object.assign(store, standard ? { d1: 100, s1: 50, d2: 100, s2: 50 } : { d1: 200, s1: 50, d2: 200, s2: 50 });
    applyTopology(); compute();
  }));
  ['z1', 'z2', 's11-db', 's11-deg'].forEach(id => $(id).addEventListener('input', compute));
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (!result) return;
    const sign = result.db > 0 ? '+' : result.db < 0 ? '-' : '';
    Bench.copy(`${result.spec.label} | ${result.spec.plain} | Z1 ${fmt(result.z1)} Ω | Z2 ${fmt(result.z2)} Ω\n` +
      `Voltage gain = ${result.spec.plain} × ${fmt(result.factor)}; in decibels 20log|Av| = 20log|${result.spec.plain}| ${result.db < 0 ? '-' : '+'} ${fmt(Math.abs(result.db), 'dB')} dB; power gain |${result.spec.plain}|² is unchanged`);
  });
  document.addEventListener('dut-change', () => { pullFromCard(); applyTopology(); compute(); });
  document.addEventListener('theme-change', () => { renderDerivation(); compute(); });
  document.addEventListener('layout-change', () => { renderDerivation(); compute(); });
  Dut.describe('both sides: the topology picks the parameter, and each per-line impedance doubles for a differential reference');
  Bench.exports({ figureTitle: 'Port topology', figure: () => [$('gain-diagram'), $('diagram-key'), $('diagram-caption'), $('metrics')], equations: () => [$('gain-equation')] });
  readQuery(); applyTopology(); renderDerivation(); compute();
})();
