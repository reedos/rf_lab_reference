(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex, tint = Bench.tint;
  const $ = id => document.getElementById(id);
  const fmt = RF.formatNumber;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const metric = (label, value, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><dt>${label}</dt><dd>${value}</dd></div>`;
  const KINDS = { dd: ['diff', 'diff'], sd: ['diff', 'se'], ds: ['se', 'diff'], ss: ['se', 'se'] };
  const TOPOLOGY_OF = { diff: { diff: 'dd', se: 'sd' }, se: { diff: 'ds', se: 'ss' } };
  const LABELS = { dd: 'Differential in, differential out', sd: 'Differential in, single-ended out', ds: 'Single-ended in, differential out', ss: 'Single-ended in, single-ended out' };
  const MODE_NAME = { d: 'differential', c: 'common', s: 'single-ended' };
  const PORT_COUNT = 4;
  let topology = 'dd', result = null, mapError = '';
  // Physical ports for each logical side; a single-ended side uses only the first.
  const mapping = { in: [1, 3], out: [2, 4] };
  // Single-ended entries keyed by "to,from" physical ports, kept as typed text.
  const cells = {};
  // A slightly unbalanced differential through path, keyed by physical port so the example
  // stays meaningful when the mapping changes.
  function exampleCell(i, j) {
    const inputSide = p => p === 1 || p === 3;
    if (i === j) return inputSide(i) ? { db: '-20', deg: '45' } : { db: '-18', deg: '-30' };
    if ((i === 2 && j === 1) || (i === 1 && j === 2)) return { db: '-1', deg: '-60' };
    if ((i === 4 && j === 3) || (i === 3 && j === 4)) return { db: '-1.2', deg: '-62' };
    if (inputSide(i) === inputSide(j)) return { db: '-40', deg: '0' };
    return { db: '-30', deg: '120' };
  }
  for (let i = 1; i <= PORT_COUNT; i++) for (let j = 1; j <= PORT_COUNT; j++) cells[`${i},${j}`] = exampleCell(i, j);
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
    const q = new URLSearchParams(location.search);
    for (const [key, side] of [['p1', 'in'], ['p2', 'out']]) {
      if (!q.has(key)) continue;
      const ports = q.get(key).split(',').map(Number);
      if (ports.length === 2 && ports.every(p => Number.isInteger(p) && p >= 1 && p <= PORT_COUNT)) mapping[side] = ports;
    }
    if (q.has('s')) {
      for (const tuple of q.get('s').split(';')) {
        const [i, j, db, deg] = tuple.split(',');
        const key = `${Number(i)},${Number(j)}`;
        if (Object.hasOwn(cells, key) && typeof db === 'string' && typeof deg === 'string' && db.length <= 24 && deg.length <= 24) cells[key] = { db, deg };
      }
    }
    if (Object.hasOwn(KINDS, q.get('t'))) topology = q.get('t'); else pullFromCard();
  }
  function writeQuery() {
    const q = new URLSearchParams({ t: topology, p1: mapping.in.join(','), p2: mapping.out.join(',') });
    q.set('s', usedPorts().flatMap(i => usedPorts().map(j => `${i},${j},${cells[`${i},${j}`].db},${cells[`${i},${j}`].deg}`)).join(';'));
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
  function renderGrid() {
    const ports = usedPorts();
    const head = `<thead><tr><th>to ↓ · from →</th>${ports.map(j => `<th>Port ${j}</th>`).join('')}</tr></thead>`;
    const body = ports.map(i => `<tr><th>Port ${i}</th>${ports.map(j => {
      const cell = cells[`${i},${j}`];
      return `<td><div class="s-cell"><input data-cell="${i},${j},db" value="${escape(cell.db)}" inputmode="text" autocomplete="off" spellcheck="false" aria-label="S${i}${j} level in dB"><span>dB</span><input data-cell="${i},${j},deg" value="${escape(cell.deg)}" inputmode="text" autocomplete="off" spellcheck="false" aria-label="S${i}${j} phase in degrees"><span>°</span></div></td>`;
    }).join('')}</tr>`).join('');
    $('s-grid').innerHTML = head + `<tbody>${body}</tbody>`;
  }

  // ---------- Diagram: the DUT with its physical ports grouped into logical ports.
  function renderDiagram() {
    const [kin, kout] = kinds();
    const s = sides();
    // Left ports: label ends at 164, wire 170 to 256, arrow head at 256..268. Right ports: wire
    // 412 to 510, arrow head to 510, label from 516. Braces at 100 and 580 with their labels outside.
    const port = (y, number, side, align) => (align === 'left'
      ? `<path class="wire" d="M170 ${y} H256"/><path class="head" d="M256 ${y - 6} L268 ${y} L256 ${y + 6} Z"/>`
      : `<path class="wire" d="M412 ${y} H498"/><path class="head" d="M498 ${y - 6} L510 ${y} L498 ${y + 6} Z"/>`) +
      `<text class="${side === 'in' ? 'in' : 'out'} port-label" x="${align === 'left' ? 164 : 516}" y="${y + 4}" text-anchor="${align === 'left' ? 'end' : 'start'}">Port ${number}</text>`;
    const group = (x, y1, y2, side, label, sub) => `<path class="brace brace-${side}" d="M${x} ${y1} V${y2} M${x - 6} ${y1} H${x + 6} M${x - 6} ${y2} H${x + 6}"/>` +
      `<text class="${side}" x="${x + (side === 'in' ? -10 : 10)}" y="${(y1 + y2) / 2 - 4}" text-anchor="${side === 'in' ? 'end' : 'start'}">${label}</text>` +
      `<text class="${side}" x="${x + (side === 'in' ? -10 : 10)}" y="${(y1 + y2) / 2 + 12}" text-anchor="${side === 'in' ? 'end' : 'start'}">${sub}</text>`;
    let svg = `<rect class="box" x="268" y="40" width="144" height="150" rx="10"/><text class="strong" x="312" y="110">DUT</text><text x="300" y="132">S<tspan class="port-sub">ij</tspan> single-ended</text>`;
    if (kin === 'diff') {
      svg += port(78, s[0].ports[0], 'in', 'left') + port(152, s[0].ports[1], 'in', 'left') +
        `<text x="254" y="70">+</text><text x="254" y="172">−</text>` + group(100, 78, 152, 'in', 'logical 1', 'd1 · c1');
    } else {
      svg += port(115, s[0].ports[0], 'in', 'left') + group(100, 100, 130, 'in', 'logical 1', 's1') +
        `<path class="wire" d="M250 190 H286 M258 198 H278 M264 206 H272"/><path class="wire" d="M268 178 V190"/>`;
    }
    if (kout === 'diff') {
      svg += port(78, s[1].ports[0], 'out', 'right') + port(152, s[1].ports[1], 'out', 'right') +
        `<text x="418" y="70">+</text><text x="418" y="172">−</text>` + group(580, 78, 152, 'out', 'logical 2', 'd2 · c2');
    } else {
      svg += port(115, s[1].ports[0], 'out', 'right') + group(580, 100, 130, 'out', 'logical 2', 's2') +
        `<path class="wire" d="M394 190 H430 M402 198 H422 M408 206 H416"/><path class="wire" d="M412 178 V190"/>`;
    }
    $('mixed-diagram').innerHTML = svg;
    $('mixed-diagram').setAttribute('aria-label', `${LABELS[topology]}: logical port 1 is ${s[0].ports.map(p => 'port ' + p).join(' and ')}, logical port 2 is ${s[1].ports.map(p => 'port ' + p).join(' and ')}`);
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
  const rect = z => `${tex(z.re)}${z.im < 0 ? '-' : '+'}j${tex(Math.abs(z.im))}`;
  const polar = v => v.mag > 0 ? `${tex(v.db, 'dB')}\\ \\angle\\ ${tex(v.deg, 'deg')}` : `-\\infty\\,\\mathrm{dB}`;
  function substitution(entry, S) {
    const c = Math.abs(entry.terms[0].coefficient);
    const prefix = Math.abs(c - 0.5) < 1e-9 ? '\\tfrac12' : Math.abs(c - Math.SQRT1_2) < 1e-9 ? '\\tfrac{1}{\\sqrt 2}' : '';
    const parts = entry.terms.map((t, k) => `${t.coefficient < 0 ? '-' : k ? '+' : ''}(${rect(S[t.i][t.j])})`);
    const per = Bench.narrow ? 1 : 2, groups = [];
    for (let i = 0; i < parts.length; i += per) groups.push(parts.slice(i, i + per).join(' '));
    const body = groups.join(' \\\\ &\\qquad ');
    return prefix ? `${prefix}\\bigl[${body}\\bigr]` : body;
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

  // ---------- Numbers
  function readMatrix() {
    const S = {}, bad = [];
    for (const i of usedPorts()) {
      S[i] = {};
      for (const j of usedPorts()) {
        const cell = cells[`${i},${j}`], db = RF.parseNumber(cell.db), deg = RF.parseZero(cell.deg);
        if (!Number.isFinite(db) || !Number.isFinite(deg)) { bad.push(`S${i}${j}`); continue; }
        S[i][j] = RF.fromPolar(db, deg);
      }
    }
    return { S, bad };
  }
  const show = v => v.mag > 0 ? `${fmt(v.db, 'dB')} dB ∠ ${fmt(v.deg, 'deg')}°` : '−∞ dB';
  function primaryName() {
    const [kin, kout] = kinds();
    return `S${kout === 'diff' ? 'd' : 's'}${kin === 'diff' ? 'd' : 's'}21`;
  }
  function invalid(message) {
    result = null;
    $('mixed-status').textContent = message; $('mixed-status').className = 'status-error';
    ['metrics', 'mm-head', 'mm-rows'].forEach(id => $(id).replaceChildren());
    Bench.update({ valid: false, lines: [message] });
  }
  function compute() {
    renderTopology(); renderDiagram(); renderTransform(); renderImpedances();
    if (mapError) { $('mapping-status').textContent = mapError; $('mapping-status').className = 'status-error'; $('mixed-equations').replaceChildren(); return invalid('Fix the port mapping first.'); }
    $('mapping-status').textContent = ''; $('mapping-status').className = '';
    const symbolic = RF.mixedMode(Object.fromEntries(usedPorts().map(i => [i, Object.fromEntries(usedPorts().map(j => [j, { re: 0, im: 0 }]))])), sides());
    renderEquations(symbolic);
    const { S, bad } = readMatrix();
    if (bad.length) return invalid(`Enter a finite level and phase for ${bad.join(', ')}. Blank phase means zero.`);
    result = RF.mixedMode(S, sides());
    if (!result) return invalid('The port mapping is not valid.');
    $('mixed-status').textContent = ''; $('mixed-status').className = '';
    const rows = result.rows, [kin, kout] = kinds();
    const modeLabel = r => `<span class="${r.side === 1 ? 'tint-in' : 'tint-out'}">${r.label}</span>`;
    $('mm-head').innerHTML = `<tr><th>to ↓ · from →</th>${rows.map(r => `<th>${modeLabel(r)}</th>`).join('')}</tr>`;
    const prime = primaryName();
    $('mm-rows').innerHTML = rows.map((r, ri) => `<tr><th>${modeLabel(r)}</th>${rows.map((c, ci) => {
      const entry = result.entries[ri * rows.length + ci];
      return `<td class="num${entry.name === prime ? ' is-primary' : ''}" title="${entry.name}">${show(entry.value)}</td>`;
    }).join('')}</tr>`).join('');
    const by = result.byName, primary = by[prime];
    const tiles = [metric(prime, show(primary.value), 'primary')];
    const reverse = by[`S${prime[2]}${prime[1]}12`];
    if (reverse) tiles.push(metric(reverse.name, show(reverse.value)));
    const inRefl = by[kin === 'diff' ? 'Sdd11' : 'Sss11'], outRefl = by[kout === 'diff' ? 'Sdd22' : 'Sss22'];
    tiles.push(metric(`${inRefl.name} · input return`, show(inRefl.value), 'port-in'), metric(`${outRefl.name} · output return`, show(outRefl.value), 'port-out'));
    if (kin === 'diff' && kout === 'diff') {
      tiles.push(metric('Scc21 · common-mode through', show(by.Scc21.value)),
        metric('Sdc21 · common in → differential out', show(by.Sdc21.value)),
        metric('Scd21 · differential in → common out', show(by.Scd21.value)),
        metric('Scd21 relative to Sdd21', primary.value.mag > 0 && by.Scd21.value.mag > 0 ? `${fmt(by.Scd21.value.db - primary.value.db, 'dB')} dB` : primary.value.mag > 0 ? 'no conversion' : 'undefined'));
    } else if (kin === 'diff') {
      tiles.push(metric('Ssc21 · common in → single-ended out', show(by.Ssc21.value)), metric('Scc11 · common-mode input return', show(by.Scc11.value)));
    } else if (kout === 'diff') {
      tiles.push(metric('Scs21 · single-ended in → common out', show(by.Scs21.value)), metric('Scc22 · common-mode output return', show(by.Scc22.value)));
    }
    $('metrics').innerHTML = tiles.join('');
    const featured = [prime, kin === 'diff' && kout === 'diff' ? 'Sdc21' : null, kin === 'diff' && kout === 'diff' ? 'Scd21' : null, inRefl.name].filter(Boolean);
    Bench.update({ valid: true, lines: [
      `${LABELS[topology]}. Logical port 1 is ${sides()[0].ports.map(p => 'port ' + p).join(' and ')}, logical port 2 is ${sides()[1].ports.map(p => 'port ' + p).join(' and ')}. The first port of a pair is its positive line.`,
      eq('Mode waves of a pair', `a_{\\mathrm d} &= \\frac{a_{+}-a_{-}}{\\sqrt 2} \\\\ a_{\\mathrm c} &= \\frac{a_{+}+a_{-}}{\\sqrt 2}`),
      eq('Transform', `S_{\\mathrm{mm}} &= T\\,S\\,T^{\\mathsf T}`),
      ...featured.map(name => { const entry = by[name]; return eq(entry.name, `${sym(entry)} &= ${formula(entry)}`, polar(entry.value), `${substitution(entry, S)} \\\\ &= ${rect(entry.value)}`); }),
      'Levels and phases were converted to rectangular form, combined with the coefficients above, and converted back. A result of −∞ dB means the combination cancelled exactly, which happens for an ideally balanced entry.',
      kin === 'diff' || kout === 'diff' ? 'Reference impedances: a differential mode sees twice the per-line reference and a common mode half of it. Both lines of a pair are assumed to share their reference.' : 'Both logical ports are single-ended, so the transform is the identity and the mixed-mode set is the two-port set.'
    ] });
    writeQuery();
  }

  // ---------- Events
  document.querySelectorAll('[data-topology]').forEach(button => button.addEventListener('click', () => {
    topology = button.dataset.topology; pushToCard(); validateMapping(); renderMapping(); renderGrid(); compute();
  }));
  function validateMapping() {
    mapError = RF.mixedModeRows(sides()) ? '' : 'Each analyzer port can appear only once across the logical ports.';
  }
  $('mapping').addEventListener('change', event => {
    const select = event.target.closest('select[data-side]');
    if (!select) return;
    mapping[select.dataset.side][Number(select.dataset.index)] = Number(select.value);
    validateMapping(); renderGrid(); compute();
  });
  $('s-grid').addEventListener('input', event => {
    const key = event.target.dataset.cell;
    if (!key) return;
    const [i, j, field] = key.split(',');
    cells[`${i},${j}`][field] = event.target.value;
    compute();
  });
  document.addEventListener('dut-change', () => { pullFromCard(); validateMapping(); renderMapping(); renderGrid(); compute(); });
  document.addEventListener('theme-change', compute);
  document.addEventListener('layout-change', compute);
  Dut.describe('the port topology on each side and the per-line references that set the mode impedances');
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (!result) return;
    const s = sides();
    Bench.copy(`Mixed-mode | ${LABELS[topology]} | logical 1 = port ${s[0].ports.join(', ')} | logical 2 = port ${s[1].ports.join(', ')}\n` +
      result.rows.map((r, ri) => result.rows.map((c, ci) => { const e = result.entries[ri * result.rows.length + ci]; return `${e.name} ${show(e.value)}`; }).join(' | ')).join('\n'));
  });
  Bench.exports({ figureTitle: 'Port mapping', figure: () => [$('mixed-diagram'), $('mixed-key'), $('mixed-caption'), $('metrics')],
    tableTitle: 'Mixed-mode set', tables: () => [$('mm-rows').closest('.chain-results')],
    equations: () => [$('mixed-transform'), $('mixed-equations'), $('mixed-impedances')] });
  readQuery(); pushToCard(); validateMapping(); renderMapping(); renderGrid(); compute();
})();
