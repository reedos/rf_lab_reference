(function () {
  'use strict';
  const page = location.pathname.split('/').pop() || 'index.html';
  const storageKey = 'rf-lab:setups:v1:' + page;
  const KATEX_VERSION = '0.18.7';
  // Port identity colours come from the stylesheet so there is never a second copy.
  // Read on every use, because the theme can change under a page and the colours with it.
  const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const PORT = { get in() { return token('--port-in', '#f3b63a'); }, get out() { return token('--port-out', '#4fd6c8'); } };
  // Wrap a LaTeX fragment so a quantity keeps its colour inside rendered algebra.
  const tint = (side, latex) => '\\textcolor{' + PORT[side] + '}{' + latex + '}';
  // Same idea for markup outside an equation.
  const mark = (side, html) => '<span class="tint-' + side + '">' + html + '</span>';
  let latest = { valid: false, lines: ['Enter valid inputs to show the calculation.'] };
  let detail, status, list, name, save, setups = [];
  let renderTimer = 0, katexLoading = null, katexFailed = false;
  // Exact computed values live separately from their rounded editable displays.
  const numbers = new WeakMap();
  const element = value => typeof value === 'string' ? document.getElementById(value) : value;
  function read(value, zero = false) {
    const el = element(value), cached = numbers.get(el);
    if (cached && el.value === cached.shown) return cached.exact;
    return zero ? RF.parseZero(el.value) : RF.parseNumber(el.value);
  }
  // Link values are canonical numbers even when the field text uses separators or exponents.
  function raw(value) {
    const el = element(value), cached = numbers.get(el);
    if (cached && el.value === cached.shown) return String(cached.exact);
    const parsed = RF.parseNumber(el.value);
    return Number.isFinite(parsed) ? String(parsed) : el.value;
  }
  // A driver field's text (typed by the user or restored from a link) is kept verbatim when it
  // already represents the exact value. Solved fields always show the rounded display.
  function setNumber(value, exact, unit, solved = false) {
    const el = element(value);
    const shown = !solved && el.value.trim() !== '' && RF.parseNumber(el.value) === exact ? el.value : RF.formatNumber(exact, unit);
    el.value = shown;
    numbers.set(el, { exact, shown });
  }
  document.addEventListener('input', event => numbers.delete(event.target), true);
  document.addEventListener('theme-change', () => scheduleRender());
  // Mobile decimal keypads have no minus key, so signed fields get their own toggle.
  function flipSign(el) {
    const text = el.value.trim();
    el.value = text === '' ? '-' : text.startsWith('-') ? text.slice(1) : '-' + text.replace(/^\+/, '');
    numbers.delete(el);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    // Pages select the whole field on focus, which would make the next keystroke
    // replace the sign we just applied. Put the caret after it instead.
    try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) { /* not a text input */ }
  }
  function enhance(root) {
    (root || document).querySelectorAll('input[data-signed]').forEach(el => {
      if (el.dataset.signed === 'ready') return;
      el.dataset.signed = 'ready';
      const wrap = document.createElement('span');
      wrap.className = 'signed-field';
      el.replaceWith(wrap);
      wrap.append(el);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sign';
      button.textContent = '±';
      button.tabIndex = -1;
      button.setAttribute('aria-label', 'Make ' + (el.getAttribute('aria-label') || 'this value') + ' positive or negative');
      button.addEventListener('click', () => flipSign(el));
      wrap.append(button);
    });
  }
  // Keep authored equations separate from prose and user-supplied labels.
  function tex(value, unit = '', withUnit = true) {
    let number = RF.formatNumber(value, unit).replace(/(-?)∞/, '$1\\infty').replace('—', '\\text{undefined}');
    number = number.replace(/e([+-]?\d+)$/, '\\times 10^{$1}');
    const units = { deg: '{}^\\circ', '%': '\\,\\%', 'Ω': '\\,\\Omega', 'µV': '\\,\\mu\\mathrm{V}' };
    return number + (unit && withUnit ? units[unit] || '\\,\\mathrm{' + unit + '}' : '');
  }
  function voltage(value) { const split = RF.splitVoltage(value); return tex(split.value, split.unit); }
  function equation(label, formula, result, substitution) {
    return { label, latex: '\\begin{aligned}' + formula +
      (substitution ? '\\\\ &= ' + substitution : '') +
      (result ? '\\\\ &\\approx ' + result : '') + '\\end{aligned}' };
  }
  function paragraph(text) { const p = document.createElement('p'); p.textContent = text; return p; }
  // KaTeX (about 300 KB with its stylesheet) is fetched the first time a calculation panel opens.
  function loadKatex() {
    if (window.katex) return Promise.resolve();
    if (!katexLoading) katexLoading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = `vendor/katex/katex.min.css?v=${KATEX_VERSION}`;
      const js = document.createElement('script');
      js.src = `vendor/katex/katex.min.js?v=${KATEX_VERSION}`;
      js.onload = resolve;
      js.onerror = () => { katexLoading = null; js.remove(); reject(new Error('KaTeX did not load')); };
      document.head.append(css, js);
    });
    return katexLoading;
  }
  // Pages whose subject is the algebra itself render equations in the body, not only
  // inside the calculation panel, so KaTeX is fetched on demand for those too.
  function math(el, latex, displayMode) {
    return loadKatex().then(function () {
      katex.render(latex, el, { displayMode: Boolean(displayMode), output: 'htmlAndMathml', throwOnError: true, trust: false, strict: 'error' });
    }).catch(function () { el.classList.add('equation-error'); el.textContent = 'Equation unavailable.'; });
  }
  function renderCalculation() {
    clearTimeout(renderTimer);
    if (!detail || !detail.closest('details').open) return;
    if (!window.katex && !katexFailed) {
      detail.replaceChildren(paragraph('Loading equation renderer…'));
      loadKatex().then(renderCalculation, () => { katexFailed = true; renderCalculation(); });
      return;
    }
    renderLines(latest.lines, detail);
  }
  function renderLines(lines, container) {
    container.replaceChildren();
    for (const line of lines) {
      if (!line) continue;
      if (typeof line === 'string') { container.append(paragraph(line)); continue; }
      const block = document.createElement('section'), label = document.createElement('h3'), math = document.createElement('div');
      block.className = 'equation'; label.textContent = line.label; math.className = 'equation-math';
      math.tabIndex = 0; math.setAttribute('role', 'region'); math.setAttribute('aria-label', line.label);
      try {
        if (katexFailed) throw new Error('unavailable');
        katex.render(line.latex, math, { displayMode: true, output: 'htmlAndMathml', throwOnError: true, trust: false, strict: 'error' });
      } catch (_) { math.classList.add('equation-error'); math.textContent = 'Equation unavailable. The calculator result is shown above.'; }
      block.append(label, math); container.append(block);
    }
  }
  // A fresh render of the current calculation, for an image; the panel itself is untouched.
  function calculationClone() {
    return loadKatex().then(() => { const box = document.createElement('div'); box.className = 'calculation-export'; renderLines(latest.lines, box); return box; });
  }
  // A table wider than its wrapper scrolls sideways; the wrapper says so with a fade on the
  // side that has more, which is the cue a phone otherwise lacks.
  const scrollers = () => document.querySelectorAll('.table-scroll, .chain-results');
  // A reference table gets its own scrolling frame so the heading above it stays put, and
  // every cell learns its column heading for the stacked phone layout.
  function dressTables() {
    document.querySelectorAll('.ref > table').forEach(table => {
      const frame = document.createElement('div'); frame.className = 'table-scroll';
      table.replaceWith(frame); frame.append(table);
    });
    document.querySelectorAll('table').forEach(table => {
      const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (!heads.length) return;
      table.querySelectorAll('tbody tr').forEach(row => Array.from(row.children).forEach((cell, i) => {
        if (heads[i] !== undefined && cell.getAttribute('data-label') !== heads[i]) cell.setAttribute('data-label', heads[i]);
      }));
    });
  }
  // Pages set some equations on one line for a desktop and several for a phone.
  const narrowMedia = matchMedia('(max-width: 700px)');
  narrowMedia.addEventListener('change', () => { document.dispatchEvent(new CustomEvent('layout-change', { detail: narrowMedia.matches })); scheduleRender(); });
  function markScroll(el) {
    const left = el.scrollLeft > 1, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const state = left && right ? 'left right' : left ? 'left' : right ? 'right' : '';
    if (state) el.setAttribute('data-scroll', state); else el.removeAttribute('data-scroll');
  }
  function markScrollAll() { scrollers().forEach(markScroll); }
  function watchScroll() {
    scrollers().forEach(el => {
      if (el.dataset.scrollWatched) return;
      el.dataset.scrollWatched = '1';
      el.addEventListener('scroll', () => markScroll(el), { passive: true });
      if (typeof ResizeObserver === 'function') new ResizeObserver(() => markScroll(el)).observe(el);
    });
    markScrollAll();
  }
  window.addEventListener('resize', markScrollAll);
  // Inputs fire on every keystroke; equation rendering is coalesced into one pass.
  function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(renderCalculation, 60); }
  function update(value) {
    latest = value;
    scheduleRender();
    if (save) save.disabled = !value.valid;
    ['copy-result', 'copy-link'].forEach(id => { const button = document.getElementById(id); if (button) button.disabled = !value.valid; });
    document.dispatchEvent(new CustomEvent('bench-valid', { detail: value.valid }));
    requestAnimationFrame(() => { dressTables(); watchScroll(); });
  }
  function say(message) { if (status) status.textContent = message; }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      say('Copied.');
    } catch (_) { say('Clipboard unavailable. Select and copy the address or calculation text.'); }
  }
  window.Bench = { update, copy, read, raw, setNumber, enhance, math, tex, voltage, equation, tint, mark, PORT, calculationClone, get valid() { return latest.valid; }, get narrow() { return narrowMedia.matches; } };
  document.addEventListener('DOMContentLoaded', function () {
    const calc = document.getElementById('calc');
    if (!calc) return;
    enhance(document);
    const area = document.createElement('section');
    area.className = 'bench-tools';
    area.setAttribute('aria-label', 'Calculation and saved setups');
    area.innerHTML = `<details class="calculation"><summary>Show calculation</summary><p class="hint">Linear results use four significant figures; dB values and angles use hundredths. Calculations and saved links retain full precision. Substituted values and results below are rounded.</p><div id="calculation-text"></div></details>
      <details class="saved-setups"><summary>Named setups <span class="muted">· saved on this device</span></summary>
      <div class="setup-controls"><label>Setup name<input id="setup-name" maxlength="80" placeholder="e.g. Receiver bench"></label>
      <button type="button" id="setup-save" class="copy">Save setup</button>
      <label>Saved setups<select id="setup-list"></select></label>
      <button type="button" id="setup-load" class="ghost">Load</button>
      <button type="button" id="setup-delete" class="ghost">Delete</button></div>
      <p class="hint">Saving the same name updates that setup. Setups are stored only in this browser; use Copy link to share.</p></details>
      <p id="bench-status" class="hint" role="status"></p>`;
    calc.after(area);
    detail = document.getElementById('calculation-text');
    detail.closest('details').addEventListener('toggle', renderCalculation);
    status = document.getElementById('bench-status');
    list = document.getElementById('setup-list');
    name = document.getElementById('setup-name');
    save = document.getElementById('setup-save');
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setups = stored.filter(s => s && typeof s.name === 'string' && typeof s.query === 'string' && s.query.startsWith('?')).slice(0, 50);
    } catch (_) { say('Saved setups are unavailable in this browser. Copy link still works.'); }
    function refresh() {
      list.replaceChildren(new Option('Choose a setup', ''));
      setups.forEach((s, i) => list.add(new Option(s.name, String(i))));
    }
    function persist(next) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); setups = next; refresh(); return true; }
      catch (_) { say('Could not save on this device. Use Copy link to keep this setup.'); return false; }
    }
    save.addEventListener('click', function () {
      if (!latest.valid) return say('Enter valid inputs before saving.');
      const label = name.value.trim();
      if (!label) return say('Enter a setup name.');
      const next = setups.filter(s => s.name !== label);
      if (next.length >= 50) return say('You have 50 setups for this calculator. Delete one first.');
      next.push({ name: label, query: location.search });
      if (persist(next)) say('Saved “' + label + '”.');
    });
    document.getElementById('setup-load').addEventListener('click', function () {
      if (list.value === '') return say('Choose a saved setup.');
      const item = setups[Number(list.value)];
      if (item) location.search = item.query;
    });
    document.getElementById('setup-delete').addEventListener('click', function () {
      if (list.value === '') return say('Choose a saved setup.');
      if (persist(setups.filter((_, i) => i !== Number(list.value)))) say('Setup deleted.');
    });
    refresh(); update(latest); dressTables(); watchScroll();
  });
})();
