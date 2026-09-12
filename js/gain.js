(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id);
  const fmt = RF.formatNumber;
  const metric = (key, value) => `<div class="metric"><dt>${key}</dt><dd>${value}</dd></div>`;
  // Each side keeps its own differential and single-ended value, so switching topology
  // never reinterprets a number that was entered for the other mode.
  const store = { d1: 100, s1: 50, d2: 100, s2: 50 };
  const PORTS = {
    dd: { in: 'd1', out: 'd2' },
    sd: { in: 'd1', out: 's2' },
    ds: { in: 's1', out: 'd2' }
  };
  const LABELS = {
    d1: 'Input reference Z<sub>d1</sub>, differential (Ω)', s1: 'Input reference Z<sub>s1</sub>, single-ended (Ω)',
    d2: 'Output reference Z<sub>d2</sub>, differential (Ω)', s2: 'Output reference Z<sub>s2</sub>, single-ended (Ω)'
  };
  const SYMBOLS = { d1: 'Z_{d1}', s1: 'Z_{s1}', d2: 'Z_{d2}', s2: 'Z_{s2}' };
  const ARIA = {
    d1: 'Input differential reference impedance in ohms', s1: 'Input single-ended reference impedance in ohms',
    d2: 'Output differential reference impedance in ohms', s2: 'Output single-ended reference impedance in ohms'
  };
  let topology = 'dd', result = null;

  function readQuery() {
    const q = new URLSearchParams(location.search);
    if (Object.hasOwn(PORTS, q.get('t'))) topology = q.get('t');
    for (const key of Object.keys(store)) {
      const value = RF.parseNumber(q.get(key));
      if (value > 0) store[key] = value;
    }
  }
  function writeQuery() {
    const q = new URLSearchParams({ t: topology });
    for (const key of Object.keys(store)) q.set(key, String(store[key]));
    history.replaceState(null, '', location.pathname + '?' + q);
  }
  function applyTopology() {
    const ports = PORTS[topology];
    document.querySelectorAll('[data-topology]').forEach(button => {
      const active = button.dataset.topology === topology;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    // SVG elements do not implement the hidden property, so toggle the attribute itself.
    for (const key of ['dd', 'sd', 'ds']) {
      const svg = $('diagram-' + key);
      if (key === topology) svg.removeAttribute('hidden'); else svg.setAttribute('hidden', '');
    }
    $('text-z1').innerHTML = LABELS[ports.in];
    $('text-z2').innerHTML = LABELS[ports.out];
    $('z1').setAttribute('aria-label', ARIA[ports.in]);
    $('z2').setAttribute('aria-label', ARIA[ports.out]);
    $('z1').value = String(store[ports.in]);
    $('z2').value = String(store[ports.out]);
  }
  function compute() {
    const ports = PORTS[topology];
    const z1 = Bench.read('z1'), z2 = Bench.read('z2');
    if (z1 > 0) store[ports.in] = z1;
    if (z2 > 0) store[ports.out] = z2;
    result = RF.gainConversion(topology, z1, z2);
    if (!result) {
      $('gain-status').textContent = 'Enter a positive reference impedance for each port.';
      $('gain-status').className = 'status-error';
      $('metrics').replaceChildren(); $('gain-equation').replaceChildren(); $('gain-note').textContent = '';
      Bench.update({ valid: false, lines: ['Correct the reference impedances before calculating or saving.'] });
      return;
    }
    $('gain-status').textContent = ''; $('gain-status').className = '';
    const spec = result.spec, inSym = SYMBOLS[ports.in], outSym = SYMBOLS[ports.out];
    const parameter = spec.parameter;
    // Headline conclusion, rendered as algebra with the entered impedances substituted.
    Bench.math($('gain-equation'), String.raw`\begin{aligned}
      A_{v} &= ${parameter}\sqrt{\frac{${outSym}}{${inSym}}}
        = ${parameter}\sqrt{\frac{${tex(result.z2, 'Ω')}}{${tex(result.z1, 'Ω')}}}
        = ${tex(result.factor)}\,${parameter} \\[4pt]
      20\log_{10}|A_{v}| &= 20\log_{10}|${parameter}| + 10\log_{10}\frac{${outSym}}{${inSym}}
        = 20\log_{10}|${parameter}| ${result.db < 0 ? '-' : '+'}\ ${tex(Math.abs(result.db), 'dB')}
    \end{aligned}`, true);
    const sign = result.db > 0 ? '+' : result.db < 0 ? '−' : '';
    $('metrics').innerHTML = [
      metric('Topology', spec.label),
      metric('Voltage conversion factor', fmt(result.factor)),
      metric('Add to the parameter in dB', `${sign}${fmt(Math.abs(result.db), 'dB')} dB`),
      metric('Power gain', `|${spec.plain}|², unchanged by the impedances`),
      metric('Impedance ratio', `${fmt(result.ratio)} = ${fmt(result.z2)} Ω / ${fmt(result.z1)} Ω`),
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
      'That form needs the input reflection as well, and reduces to the line above when the input is matched.',
      result.perLine1 !== null || result.perLine2 !== null
        ? 'A differential reference impedance is twice the per-line value only for an uncoupled pair. A real coupled pair has twice its odd-mode impedance, which is lower.'
        : 'Both ports are single-ended here, so no differential reference is involved.'
    ] });
    writeQuery();
  }
  function renderDerivation() {
    Bench.math($('derivation-waves'), String.raw`a_1 = \frac{V_1^{+}}{\sqrt{Z_1}},\qquad b_2 = \frac{V_2^{-}}{\sqrt{Z_2}},\qquad S_{21} = \left.\frac{b_2}{a_1}\right|_{a_2=0}`, true);
    Bench.math($('derivation-ratio'), String.raw`\frac{V_2^{-}}{V_1^{+}} = \frac{b_2\sqrt{Z_2}}{a_1\sqrt{Z_1}} = S_{21}\sqrt{\frac{Z_2}{Z_1}}`, true);
    Bench.math($('derivation-gain'), String.raw`A_{v} = \frac{V_2}{V_1^{+}} = S_{21}\sqrt{\frac{Z_2}{Z_1}} \qquad\Longrightarrow\qquad |A_{v}|_{\mathrm{dB}} = |S_{21}|_{\mathrm{dB}} + 10\log_{10}\frac{Z_2}{Z_1}`, true);
    Bench.math($('derivation-power'), String.raw`\frac{P_2}{P_{\mathrm{avs}}} = \frac{|V_2|^{2}/Z_2}{|V_1^{+}|^{2}/Z_1} = \left|S_{21}\sqrt{\frac{Z_2}{Z_1}}\right|^{2}\frac{Z_1}{Z_2} = |S_{21}|^{2}`, true);
    Bench.math($('derivation-terminal'), String.raw`V_1 = V_1^{+}\left(1+S_{11}\right) \qquad\Longrightarrow\qquad \frac{V_2}{V_1} = \frac{S_{21}}{1+S_{11}}\sqrt{\frac{Z_2}{Z_1}}`, true);
  }
  document.querySelectorAll('[data-topology]').forEach(button => button.addEventListener('click', () => {
    topology = button.dataset.topology; applyTopology(); compute();
  }));
  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const standard = button.dataset.preset === 'standard';
    Object.assign(store, standard ? { d1: 100, s1: 50, d2: 100, s2: 50 } : { d1: 200, s1: 50, d2: 200, s2: 50 });
    applyTopology(); compute();
  }));
  ['z1', 'z2'].forEach(id => $(id).addEventListener('input', compute));
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (!result) return;
    const sign = result.db > 0 ? '+' : result.db < 0 ? '-' : '';
    Bench.copy(`${result.spec.label} | ${result.spec.plain} | Z1 ${fmt(result.z1)} Ω | Z2 ${fmt(result.z2)} Ω\n` +
      `Voltage gain = ${result.spec.plain} × ${fmt(result.factor)} (${sign}${fmt(Math.abs(result.db), 'dB')} dB); power gain |${result.spec.plain}|² is unchanged`);
  });
  readQuery(); applyTopology(); renderDerivation(); compute();
})();
