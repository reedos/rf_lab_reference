(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id), n = id => Bench.read(id, ['z', 'x', 'phase'].includes(id));
  const fmt = RF.formatNumber;
  const metric = (k, v, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><dt>${k}</dt><dd>${v}</dd></div>`;
  const tint = Bench.tint;
  const textNum = id => { const v = $(id).value.trim(); return ['∞', 'Infinity'].includes(v) ? Infinity : ['-∞','-Infinity'].includes(v) ? -Infinity : n(id); };
  let source = 'z', chart = 'rl', result = null, ripple = null;
  let re = 0, im = 0;
  const svg = $('smith'), NS = 'http://www.w3.org/2000/svg';
  function pathOf(points) { return points.map((p, i) => `${i ? 'L' : 'M'}${(220 + p.re * 190).toFixed(3)},${(220 - p.im * 190).toFixed(3)}`).join(' '); }
  function buildSmith() {
    const curves = [];
    for (const r of [0, .2, .5, 1, 2, 5]) {
      const pts = [];
      for (let i = -160; i <= 160; i++) { const x = Math.tan(i / 161 * Math.PI / 2) * 5; pts.push(RF.complexMatch(r, x, 1)); }
      curves.push(`<path class="smith-grid" d="${pathOf(pts)}"/>`);
    }
    for (const x of [-5, -2, -1, -.5, -.2, .2, .5, 1, 2, 5]) {
      const pts = [];
      for (let i = 0; i <= 160; i++) pts.push(RF.complexMatch((Math.exp(i / 25) - 1) / 5, x, 1));
      curves.push(`<path class="smith-grid" d="${pathOf(pts)}"/>`);
    }
    svg.innerHTML = `<circle cx="220" cy="220" r="190" fill="var(--bg-inset)" stroke="var(--dim)"/>${curves.join('')}
      <path d="M30 220 H410" class="smith-grid"/>
      <text x="8" y="236">short</text><text x="402" y="236">open</text><text x="227" y="236">1</text>
      <text x="192" y="16">+jX</text><text x="192" y="435">−jX</text>
      <text x="97" y="216">0.2</text><text x="153" y="216">0.5</text><text x="283" y="216">2</text><text x="346" y="216">5</text>
      <line id="smith-vector" x1="220" y1="220" x2="220" y2="220" stroke="var(--port-out)" stroke-width="1.5"/>
      <circle id="smith-marker" cx="220" cy="220" r="6" fill="var(--port-out)" stroke="var(--bg)" stroke-width="2"/>`;
  }
  function drawRealChart() {
    const z0 = n('z0') > 0 ? n('z0') : 50;
    const min = chart === 'rl' ? -40 : chart === 'vswr' ? 1 : 0, max = chart === 'rl' ? 0 : chart === 'vswr' ? 10 : 3;
    const pts = [];
    const xpos = z => 52 + Math.log(z / (z0 / 20)) / Math.log(400) * 644;
    for (let i = 0; i <= 240; i++) {
      const z = z0 / 20 * 400 ** (i / 240), m = RF.complexMatch(z, 0, z0);
      const val = chart === 'rl' ? -m.rl : chart === 'vswr' ? m.vswr : m.mloss;
      pts.push(`${i ? 'L' : 'M'}${xpos(z)},${246 - (Math.max(min, Math.min(max, val)) - min) / (max - min) * 220}`);
    }
    let labels = '';
    for (const factor of [.05, .2, 1, 5, 20]) labels += `<text x="${xpos(z0 * factor)}" y="265" text-anchor="middle" fill="var(--muted)" font-size="11">${fmt(z0 * factor)} Ω</text>`;
    for (const v of [min, (min + max) / 2, max]) {
      const y = 246 - (v - min) / (max - min) * 220;
      labels += `<path d="M52 ${y} H696" stroke="var(--line-strong)"/><text x="44" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${v}</text>`;
    }
    $('chart').innerHTML = labels + `<path d="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    document.querySelectorAll('[data-chart]').forEach(b => b.classList.toggle('is-active', b.dataset.chart === chart));
  }
  function compute() {
    const z0 = n('z0');
    let m = null;
    if (source === 'z') m = RF.complexMatch(n('z'), n('x'), z0);
    else if (source === 'point') m = RF.matchFromComplexGamma(re, im, z0);
    else {
      let g = n('gamma');
      if (source === 'rl') { const rl = textNum('rl'); g = rl <= 0 ? (rl === -Infinity ? 0 : 10 ** (rl / 20)) : NaN; }
      if (source === 'vswr') g = textNum('vswr') === Infinity ? 1 : RF.gammaFromVswr(n('vswr'));
      if (source === 'mloss') g = textNum('mloss') === Infinity ? 1 : RF.gammaFromMismatchLoss(n('mloss'));
      const p = n('phase') * Math.PI / 180;
      if (g >= 0 && g <= 1 && Number.isFinite(p)) m = RF.matchFromComplexGamma(g * Math.cos(p), g * Math.sin(p), z0);
    }
    result = m;
    drawRealChart();
    if (!m) {
      $('match-status').textContent = 'Use R ≥ 0, finite reactance, Z₀ > 0, 0 ≤ |Γ| ≤ 1, S11 ≤ 0 dB, and VSWR ≥ 1.';
      $('match-status').className = 'status-error'; $('metrics').replaceChildren();
      $('real-solutions').textContent = '';
      $('smith-marker').setAttribute('visibility', 'hidden'); $('smith-vector').setAttribute('visibility', 'hidden');
      Bench.update({ valid: false, lines: ['Correct the inputs before calculating or saving. Passive impedances only.'] }); return;
    }
    re = m.re; im = m.im;
    $('match-status').textContent = m.gamma === 0 ? 'Perfect match. Reflection phase is undefined; 0° is used as the editing convention.' : m.r === Infinity ? 'Open circuit: Γ = +1.' : '';
    $('match-status').className = '';
    const values = {z:m.r, x:m.x, gamma:m.gamma, phase:m.phase, rl:-m.rl, vswr:m.vswr, mloss:m.mloss};
    for (const [id, value] of Object.entries(values)) if (!(source === 'z' && ['z','x'].includes(id)) && document.activeElement !== $(id)) Bench.setNumber(id, value, id === 'phase' ? 'deg' : ['rl','mloss'].includes(id) ? 'dB' : '', !(id === source || (source === 'gamma' && id === 'phase')));
    for (const id of ['smith-marker','smith-vector']) $(id).setAttribute('visibility', 'visible');
    $('smith-marker').setAttribute('cx', 220 + re * 190); $('smith-marker').setAttribute('cy', 220 - im * 190);
    $('smith-vector').setAttribute('x2', 220 + re * 190); $('smith-vector').setAttribute('y2', 220 - im * 190);
    const zText = m.r === Infinity ? 'Open' : `${fmt(m.r)} ${m.x < 0 ? '−' : '+'} j${fmt(Math.abs(m.x))} Ω`;
    $('real-solutions').textContent = `For this |Γ|, the two purely real solutions are Z₀ × VSWR = ${fmt(z0 * m.vswr)} Ω and Z₀ / VSWR = ${fmt(z0 / m.vswr)} Ω. These assume X = 0.`;
    $('metrics').innerHTML = metric('Load impedance', zText, 'port-out') + metric('Return loss', `${fmt(m.rl, 'dB')} dB`) + metric('VSWR', fmt(m.vswr)) +
      metric('Delivered fraction', `${fmt(m.delivered * 100)} %`) + metric('Γ real', fmt(re)) + metric('Γ imaginary', fmt(im));
    const q = new URLSearchParams({ z0: String(z0), from: source, re: String(re), im: String(im), chart,
      z: String(m.r), x: String(m.x), g: String(m.gamma), phase: String(m.phase),
      rl: String(-m.rl), vswr: String(m.vswr), ml: String(m.mloss), r1: Bench.raw('ripple-rl1'), r2: Bench.raw('ripple-rl2') });
    const rippleLines = computeRipple(m);
    history.replaceState(null, '', location.pathname + '?' + q);
    Bench.update({ valid: true, lines: ['Passive load, real positive reference impedance; matched source at the reference plane.',
      eq('Load and reference impedances', `${tint('out', 'Z')} &= R+jX \\\\ &= ${tint('out', tex(m.r))}+j(${tint('out', tex(m.x))})\\,\\Omega \\\\ ${tint('in', 'Z_0')} &= ${tint('in', tex(z0, 'Ω'))}`),
      eq('Complex reflection coefficient', `\\Gamma &= \\frac{${tint('out', 'Z')}-${tint('in', 'Z_0')}}{${tint('out', 'Z')}+${tint('in', 'Z_0')}}`, `${tex(re)}+j(${tex(im)})`),
      eq('Reflection magnitude', String.raw`|\Gamma| &= \sqrt{(\operatorname{Re}\Gamma)^2+(\operatorname{Im}\Gamma)^2}`, tex(m.gamma)),
      m.gamma === 0 ? 'Reflection phase is undefined at a perfect match; the editing convention is 0°.' : eq('Reflection phase', String.raw`\angle\Gamma &= \operatorname{atan2}(\operatorname{Im}\Gamma,\operatorname{Re}\Gamma)`, tex(m.phase, 'deg')),
      eq('S11 magnitude in dB', String.raw`S_{11,\mathrm{dB}} &= 20\log_{10}|\Gamma|`, tex(-m.rl, 'dB'), String.raw`20\log_{10}(${tex(m.gamma)})\,\mathrm{dB}`),
      eq('Return loss', String.raw`\mathrm{RL} &= -20\log_{10}|\Gamma|`, tex(m.rl, 'dB')),
      eq('Voltage standing-wave ratio', String.raw`\mathrm{VSWR} &= \frac{1+|\Gamma|}{1-|\Gamma|}`, tex(m.vswr), String.raw`\frac{1+${tex(m.gamma)}}{1-${tex(m.gamma)}}`),
      eq('Delivered power fraction', String.raw`\frac{P_{\mathrm{del}}}{P_{\mathrm{avs}}} &= 1-|\Gamma|^2`, tex(m.delivered * 100, '%')),
      eq('Mismatch loss', String.raw`L_{\mathrm m} &= -10\log_{10}(1-|\Gamma|^2)`, tex(m.mloss, 'dB')),
      ...rippleLines,
      'Magnitude edits retain the selected phase. The real-resistance reference curve uses zero reactance.'] });
  }
  // Two mismatches facing each other: the trace moves between 20 log10(1 ± |Γ1Γ2|).
  function computeRipple(m) {
    const blank = $('ripple-rl1').value.trim() === '';
    const rl1 = blank ? m.rl : Bench.read('ripple-rl1'), rl2 = Bench.read('ripple-rl2');
    ripple = RF.mismatchRipple(rl1, rl2);
    if (!ripple) {
      $('ripple-status').textContent = 'Enter return losses of 0 dB or more.'; $('ripple-status').className = 'status-error';
      $('ripple-metrics').replaceChildren(); return [];
    }
    $('ripple-status').textContent = ''; $('ripple-status').className = '';
    $('ripple-metrics').innerHTML = metric('Peak-to-peak ripple', `${fmt(ripple.peakToPeak, 'dB')} dB`, 'primary') +
      metric('Interaction |Γ₁Γ₂|', fmt(ripple.product)) +
      metric('Extremes', `+${fmt(ripple.up, 'dB')} / ${fmt(ripple.down, 'dB')} dB`) +
      metric('Return losses', `${fmt(rl1, 'dB')} dB${blank ? ' (this load)' : ''} and ${fmt(rl2, 'dB')} dB`);
    return [eq('Ripple between two mismatches', String.raw`|\Gamma_1\Gamma_2| &= 10^{-\mathrm{RL}_1/20}\,10^{-\mathrm{RL}_2/20} \\ \text{ripple} &= 20\log_{10}(1\pm|\Gamma_1\Gamma_2|)`,
      String.raw`+${tex(ripple.up, 'dB')}\ /\ ${tex(ripple.down, 'dB')},\ ${tex(ripple.peakToPeak, 'dB')}\ \text{peak to peak}`,
      String.raw`20\log_{10}(1\pm${tex(ripple.product)})`)];
  }
  function readQuery() {
    const q = new URLSearchParams(location.search);
    if (q.has('z0')) $('z0').value = q.get('z0');
    if (['rl','vswr','ml'].includes(q.get('chart'))) chart = q.get('chart');
    if (q.get('from') === 'point') { source = 'point'; re = RF.parseNumber(q.get('re')); im = RF.parseNumber(q.get('im')); return; }
    for (const [key,id] of Object.entries({z:'z',x:'x',g:'gamma',phase:'phase',rl:'rl',vswr:'vswr',ml:'mloss'})) if (q.has(key)) $(id).value = q.get(key);
    if (['z','rl','vswr','gamma','mloss'].includes(q.get('from'))) source = q.get('from');
    if (q.has('r1')) $('ripple-rl1').value = q.get('r1');
    if (q.has('r2')) $('ripple-rl2').value = q.get('r2');
    // Legacy scalar links had no reflection phase and selected a real solution.
    if (!q.has('phase')) $('phase').value = '0';
  }
  ['z', 'x'].forEach(id => $(id).addEventListener('input', () => { source = 'z'; compute(); }));
  ['gamma','phase','rl','vswr','mloss'].forEach(id => $(id).addEventListener('input', () => { source = id === 'phase' ? 'gamma' : id; compute(); }));
  $('z0').addEventListener('input', compute);
  ['ripple-rl1', 'ripple-rl2'].forEach(id => $(id).addEventListener('input', compute));
  document.querySelectorAll('[data-reference]').forEach(b => b.addEventListener('click', () => { Bench.setNumber('z0', Number(b.dataset.reference)); compute(); }));
  document.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => { source = 'z'; Bench.setNumber('z', Number(b.dataset.load)); Bench.setNumber('x', 0); compute(); }));
  document.querySelectorAll('[data-special]').forEach(b => b.addEventListener('click', () => { source = 'point'; re = b.dataset.special === 'open' ? 1 : b.dataset.special === 'short' ? -1 : 0; im = 0; compute(); }));
  document.querySelectorAll('[data-chart]').forEach(b => b.addEventListener('click', () => { chart = b.dataset.chart; compute(); }));
  function move(reNext, imNext) {
    const mag = Math.hypot(reNext, imNext);
    re = mag > 1 ? reNext / mag : reNext; im = mag > 1 ? imNext / mag : imNext;
    source = 'point'; compute();
  }
  function pointer(event) {
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const p = point.matrixTransform(svg.getScreenCTM().inverse());
    move((p.x - 220) / 190, (220 - p.y) / 190);
  }
  svg.addEventListener('pointerdown', event => { svg.setPointerCapture(event.pointerId); pointer(event); });
  svg.addEventListener('pointermove', event => { if (svg.hasPointerCapture(event.pointerId)) pointer(event); });
  svg.addEventListener('pointerup', event => { if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId); });
  svg.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const step = event.shiftKey ? .001 : .01;
    move(re + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), im + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0));
  });
  $('chart').addEventListener('click', event => {
    const p = $('chart').createSVGPoint(); p.x=event.clientX; p.y=event.clientY;
    const x=p.matrixTransform($('chart').getScreenCTM().inverse()).x;
    if (x < 52 || x > 696 || !(n('z0') > 0)) return;
    source = 'z'; Bench.setNumber('z', n('z0') / 20 * 400 ** ((x - 52)/644)); Bench.setNumber('x', 0); compute();
  });
  $('copy-link').addEventListener('click', () => { if (result) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => { if (result) Bench.copy(`Z₀ ${fmt(result.z0)} Ω | Z ${fmt(result.r)} + j(${fmt(result.x)}) Ω | Γ ${fmt(result.gamma)} ∠ ${result.gamma ? fmt(result.phase, 'deg') : 'undefined'}° | S11 ${fmt(-result.rl, 'dB')} dB | VSWR ${fmt(result.vswr)}`); });
  Bench.exports({ figureTitle: 'Smith chart', figure: () => [$('smith'), document.querySelector('.colour-key'), $('metrics')] });
  buildSmith(); readQuery(); compute();
})();
