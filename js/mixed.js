(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex, tint = Bench.tint;
  const $ = id => document.getElementById(id);
  const KINDS = { dd: ['diff', 'diff'], sd: ['diff', 'se'], ds: ['se', 'diff'], ss: ['se', 'se'] };
  const TOPOLOGY_OF = { diff: { diff: 'dd', se: 'sd' }, se: { diff: 'ds', se: 'ss' } };
  const LABELS = { dd: 'Differential in, differential out', sd: 'Differential in, single-ended out', ds: 'Single-ended in, differential out', ss: 'Single-ended in, single-ended out' };
  const MODE_NAME = { d: 'differential', c: 'common', s: 'single-ended' };
  const PORT_COUNT = 4;
  let topology = 'dd', result = null, mapError = '';
  // Physical ports for each logical side; a single-ended side uses only the first.
  const mapping = { in: [1, 3], out: [2, 4] };
  const kinds = () => KINDS[topology];
  const sides = () => {
    const [kin, kout] = kinds();
    return [{ ports: kin === 'diff' ? mapping.in.slice(0, 2) : [mapping.in[0]] }, { ports: kout === 'diff' ? mapping.out.slice(0, 2) : [mapping.out[0]] }];
  };
  const usedPorts = () => sides().flatMap(side => side.ports).slice().sort((a, b) => a - b);

  function pullFromCard() {
    const dut = Dut.get();
    topology = TOPOLOGY_OF[dut.din][dut.dout];
  }
  function pushToCard() {
    const [kin, kout] = kinds();
    Dut.set({ din: kin, dout: kout }, { silent: true });
  }
  function readQuery() {
    const q = LinkState.read();
    for (const [key, side] of [['p1', 'in'], ['p2', 'out']]) {
      if (!q.has(key)) continue;
      const ports = q.get(key).split(',').map(Number);
      if (ports.length === 2 && ports.every(p => Number.isInteger(p) && p >= 1 && p <= PORT_COUNT)) mapping[side] = ports;
    }
    if (Object.hasOwn(KINDS, q.get('t'))) topology = q.get('t'); else pullFromCard();
  }
  function writeQuery() {
    const q = new URLSearchParams({ t: topology, p1: mapping.in.join(','), p2: mapping.out.join(',') });
    history.replaceState(null, '', location.pathname + '?' + q);
  }

  // ---------- Controls
  function renderMapping() {
    const [kin, kout] = kinds();
    const select = (side, index, label, cls) => {
      const options = Array.from({ length: PORT_COUNT }, (_, k) => `<option value="${k + 1}"${mapping[side][index] === k + 1 ? ' selected' : ''}>Port ${k + 1}</option>`).join('');
      return `<label class="${cls}"><span>${label}</span><select data-side="${side}" data-index="${index}" aria-label="${label}">${options}</select></label>`;
    };
    $('mapping').innerHTML =
      (kin === 'diff' ? select('in', 0, 'Logical port 1, positive line', 'tint-in') + select('in', 1, 'Logical port 1, negative line', 'tint-in') : select('in', 0, 'Logical port 1, single-ended', 'tint-in')) +
      (kout === 'diff' ? select('out', 0, 'Logical port 2, positive line', 'tint-out') + select('out', 1, 'Logical port 2, negative line', 'tint-out') : select('out', 0, 'Logical port 2, single-ended', 'tint-out'));
  }
  function renderTopology() {
    document.querySelectorAll('[data-topology]').forEach(button => {
      const active = button.dataset.topology === topology;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
  }
  // ---------- Diagram: the DUT with its physical ports grouped into logical ports.
  function renderDiagram() {
    const [kin, kout] = kinds();
    const s = sides();
    const mark = Bench.mark;
    const name = Bench.narrow ? 'P' : 'Port ';
    const rails = (ports, dutSide, side) => ports.length === 2
      ? [{ tone: 'neutral', [dutSide]: { label: mark(side, `${name}${ports[0]} +`) } }, { tone: 'neutral', [dutSide]: { label: mark(side, `${name}${ports[1]} −`) } }]
      : [{ tone: 'neutral', [dutSide]: { label: mark(side, `${name}${ports[0]}`) }, ground: true }];
    Bench.diagram($('mixed-diagram'), { id: 'mixed-figure', caption: LABELS[topology], midWide: true,
      ariaLabel: `${LABELS[topology]}: logical port 1 is ${s[0].ports.map(p => 'port ' + p).join(' and ')}, logical port 2 is ${s[1].ports.map(p => 'port ' + p).join(' and ')}`,
      blocks: [
        { kicker: 'Input side', title: 'Logical 1', sub: kin === 'diff' ? 'd1 · c1' : 's1', accent: 'in' },
        { kicker: 'Four-port', title: 'DUT', sub: 'S<sub>ij</sub> single-ended' },
        { kicker: 'Output side', title: 'Logical 2', sub: kout === 'diff' ? 'd2 · c2' : 's2', accent: 'out' } ],
      buses: [
        { rails: rails(s[0].ports, 'right', 'in'), brace: kin === 'diff' ? { side: 'in', label: 'a<sub>d1</sub> · a<sub>c1</sub>' } : null },
        { rails: rails(s[1].ports, 'left', 'out'), brace: kout === 'diff' ? { side: 'out', label: 'b<sub>d2</sub> · b<sub>c2</sub>' } : null } ] });
    $('mixed-key').innerHTML = `<span class="key key-in">logical port 1 · ${s[0].ports.map(p => 'port ' + p).join(', ')}</span> the input side` +
      `<span class="key key-out">logical port 2 · ${s[1].ports.map(p => 'port ' + p).join(', ')}</span> the output side` +
      `<span class="key">wires, boxes and arrows carry no value</span>`;
    $('mixed-caption').textContent = `${LABELS[topology]} · ${kin === 'diff' ? `port ${s[0].ports[0]} is the positive input line and port ${s[0].ports[1]} the negative` : `port ${s[0].ports[0]} is the input`}; ${kout === 'diff' ? `port ${s[1].ports[0]} is the positive output line and port ${s[1].ports[1]} the negative` : `port ${s[1].ports[0]} is the output`}.`;
  }

  // ---------- Algebra
  const sym = entry => `S_{\\mathrm{${entry.to.mode}${entry.from.mode}}${entry.to.side}${entry.from.side}}`;
  const sideTint = (side, latex) => tint(side === 1 ? 'in' : 'out', latex);
  function formula(entry) {
    const c = Math.abs(entry.terms[0].coefficient);
    const prefix = Math.abs(c - 0.5) < 1e-9 ? '\\tfrac12' : Math.abs(c - Math.SQRT1_2) < 1e-9 ? '\\tfrac{1}{\\sqrt 2}' : '';
    const body = entry.terms.map((t, k) => `${t.coefficient < 0 ? '-' : k ? '+' : ''}S_{${t.i}${t.j}}`).join(' ');
    return prefix ? `${prefix}\\left(${body}\\right)` : body;
  }
  function renderTransform() {
    const rows = RF.mixedModeRows(sides());
    if (!rows) return;
    const ports = sides().flatMap(side => side.ports);
    const weight = (r, p) => { const found = r.weights.find(x => x.port === p); return found ? found.w : undefined; };
    const cell = w => w === undefined ? '0' : Math.abs(Math.abs(w) - Math.SQRT1_2) < 1e-9 ? (w < 0 ? '-' : '') + '\\tfrac{1}{\\sqrt2}' : (w < 0 ? '-' : '') + '1';
    const matrix = rows.map(r => ports.map(p => cell(weight(r, p))).join(' & ')).join(' \\\\ ');
    const waves = rows.map(r => {
      const parts = r.weights;
      const body = parts.map(({ port, w }, k) => `${w < 0 ? '-' : k ? '+' : ''}a_{${port}}`).join('');
      return `a_{${sideTint(r.side, `\\mathrm{${r.mode}}${r.side}`)}} &= ${parts.length === 2 ? `\\frac{${body}}{\\sqrt 2}` : body}`;
    }).join(' \\\\ ');
    const parts = [`\\begin{aligned} ${waves} \\end{aligned}`, `T = \\begin{bmatrix} ${matrix} \\end{bmatrix}`, `S_{\\mathrm{mm}} = T\\,S\\,T^{\\mathsf T}`];
    Bench.math($('mixed-transform'), Bench.narrow ? `\\begin{gathered} ${parts.join(' \\\\[8pt] ')} \\end{gathered}` : parts.join(' \\qquad '), true);
    $('mixed-transform').setAttribute('data-latex', `T = [${matrix}]`);
  }
  function renderEquations(m) {
    const groups = new Map();
    for (const entry of m.entries) {
      const key = entry.to.mode + entry.from.mode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const host = $('mixed-equations');
    host.replaceChildren();
    for (const [key, entries] of groups) {
      const block = document.createElement('div');
      block.className = 'gain-result'; block.tabIndex = 0; block.setAttribute('role', 'region');
      const title = `${MODE_NAME[key[1]]} in, ${MODE_NAME[key[0]]} out`;
      block.setAttribute('aria-label', title);
      const label = document.createElement('p'); label.className = 'equation-group'; label.textContent = title.charAt(0).toUpperCase() + title.slice(1);
      const math = document.createElement('div');
      block.append(label, math); host.append(block);
      Bench.math(math, `\\begin{aligned} ${entries.map(e => `${sym(e)} &= ${formula(e)}`).join(' \\\\ ')} \\end{aligned}`, true);
    }
  }
  function renderImpedances() {
    const dut = Dut.get(), [kin, kout] = kinds();
    const lines = [];
    const side = (label, z, kind) => {
      const z0 = tint(label === 1 ? 'in' : 'out', tex(z, 'Ω'));
      if (kind === 'diff') lines.push(`Z_{\\mathrm d${label}} &= 2\\,Z_{0,${label}} = ${z0}\\times 2 = ${tint(label === 1 ? 'in' : 'out', tex(2 * z, 'Ω'))} \\\\ Z_{\\mathrm c${label}} &= \\tfrac12\\,Z_{0,${label}} = ${tint(label === 1 ? 'in' : 'out', tex(z / 2, 'Ω'))}`);
      else lines.push(`Z_{\\mathrm s${label}} &= Z_{0,${label}} = ${z0}`);
    };
    side(1, dut.zin, kin); side(2, dut.zout, kout);
    Bench.math($('mixed-impedances'), `\\begin{aligned} ${lines.join(' \\\\ ')} \\end{aligned}`, true);
  }

  // ---------- Output
  const plainFormula = entry => {
    const c = Math.abs(entry.terms[0].coefficient);
    const prefix = Math.abs(c - 0.5) < 1e-9 ? '1/2 ' : Math.abs(c - Math.SQRT1_2) < 1e-9 ? '1/√2 ' : '';
    const body = entry.terms.map((t, k) => `${t.coefficient < 0 ? '-' : k ? '+' : ''}S${t.i}${t.j}`).join(' ');
    return prefix ? `${prefix}(${body})` : body;
  };
  function transmissionName() {
    const [kin, kout] = kinds();
    return `S${kout === 'diff' ? 'd' : 's'}${kin === 'diff' ? 'd' : 's'}21`;
  }
  function compute() {
    renderTopology(); renderDiagram(); renderTransform(); renderImpedances();
    if (mapError) {
      result = null;
      $('mapping-status').textContent = mapError; $('mapping-status').className = 'status-error';
      $('mixed-equations').replaceChildren();
      Bench.update({ valid: false, lines: [mapError] });
      return;
    }
    $('mapping-status').textContent = ''; $('mapping-status').className = '';
    // The transform depends only on the port mapping, so a zero matrix carries the algebra.
    const zeros = Object.fromEntries(usedPorts().map(i => [i, Object.fromEntries(usedPorts().map(j => [j, { re: 0, im: 0 }]))]));
    result = RF.mixedMode(zeros, sides());
    renderEquations(result);
    const [kin, kout] = kinds();
    const through = result.byName[transmissionName()];
    Bench.update({ valid: true, lines: [
      `${LABELS[topology]}. Logical port 1 is ${sides()[0].ports.map(p => 'port ' + p).join(' and ')}, logical port 2 is ${sides()[1].ports.map(p => 'port ' + p).join(' and ')}. The first port of a pair is its positive line.`,
      eq('Mode waves of a pair', `a_{\\mathrm d} &= \\frac{a_{+}-a_{-}}{\\sqrt 2} \\\\ a_{\\mathrm c} &= \\frac{a_{+}+a_{-}}{\\sqrt 2}`),
      eq('Transform', `S_{\\mathrm{mm}} &= T\\,S\\,T^{\\mathsf T}`),
      eq(through.name, `${sym(through)} &= ${formula(through)}`),
      kin === 'diff' || kout === 'diff'
        ? 'A differential mode sees twice the per-line reference impedance and a common mode half of it. Both lines of a pair share their reference.'
        : 'Both logical ports are single-ended, so the transform is the identity and the mixed-mode set is the two-port set.'
    ] });
    writeQuery();
  }

  // ---------- Events
  document.querySelectorAll('[data-topology]').forEach(button => button.addEventListener('click', () => {
    topology = button.dataset.topology; pushToCard(); validateMapping(); renderMapping(); compute();
  }));
  function validateMapping() {
    mapError = RF.mixedModeRows(sides()) ? '' : 'Each analyzer port can appear only once across the logical ports.';
  }
  $('mapping').addEventListener('change', event => {
    const select = event.target.closest('select[data-side]');
    if (!select) return;
    mapping[select.dataset.side][Number(select.dataset.index)] = Number(select.value);
    validateMapping(); compute();
  });
  document.addEventListener('dut-change', () => { pullFromCard(); validateMapping(); renderMapping(); compute(); });
  document.addEventListener('theme-change', compute);
  document.addEventListener('layout-change', compute);
  Dut.describe('the port topology on each side and the per-line references that set the mode impedances');
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (!result) return;
    const s = sides();
    Bench.copy(`Mixed-mode | ${LABELS[topology]} | logical 1 = port ${s[0].ports.join(', ')} | logical 2 = port ${s[1].ports.join(', ')}\n` +
      result.entries.map(entry => `${entry.name} = ${plainFormula(entry)}`).join('\n'));
  });
  Bench.exports({ figureTitle: 'Port mapping', figure: () => [$('mixed-diagram'), $('mixed-key'), $('mixed-caption')],
    equations: () => [$('mixed-transform'), $('mixed-equations'), $('mixed-impedances')] });
  readQuery(); pushToCard(); validateMapping(); renderMapping(); compute();
})();
