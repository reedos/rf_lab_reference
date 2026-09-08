(function () {
  'use strict';
  const page = location.pathname.split('/').pop() || 'index.html';
  const storageKey = 'rf-lab:setups:v1:' + page;
  let latest = { valid: false, lines: ['Enter valid inputs to show the calculation.'] };
  let detail, status, list, name, save, setups = [];
  // Exact computed values live separately from their rounded editable displays.
  const numbers = new WeakMap();
  const element = value => typeof value === 'string' ? document.getElementById(value) : value;
  function read(value, zero = false) {
    const el = element(value), cached = numbers.get(el);
    if (cached && el.value === cached.shown) return cached.exact;
    return zero ? RF.parseZero(el.value) : RF.parseNumber(el.value);
  }
  function raw(value) {
    const el = element(value), cached = numbers.get(el);
    return cached && el.value === cached.shown ? String(cached.exact) : el.value;
  }
  function setNumber(value, exact, unit) {
    const el = element(value), shown = RF.formatNumber(exact, unit);
    el.value = shown;
    numbers.set(el, { exact, shown });
  }
  function inputUnit(el) {
    if (['db', 'nf', 'limit'].includes(el.dataset.key)) return 'dB';
    if (['phase', 'degrees', 'phase-p1', 'phase-p2'].includes(el.id)) return 'deg';
    if (['dbm','tone-dbm','imd-tone','imd-im3','imd-gain','p1-gain','p1-pin','p1-pout','p1-meas','thd-fund','thd-h2','thd-h3','thd-h4','thd-h5','source-power','rl','mloss'].includes(el.id)) return 'dB';
    return '';
  }
  function compactInputs(container) {
    container.querySelectorAll('input').forEach(el => {
      if (el.id === 'setup-name' || el.dataset.key === 'name' || el.value.trim() === '') return;
      const exact = read(el);
      if (Number.isFinite(exact)) setNumber(el, exact, inputUnit(el));
    });
  }
  document.addEventListener('input', event => numbers.delete(event.target), true);
  document.addEventListener('focusout', event => {
    const el = event.target;
    if (el.tagName !== 'INPUT' || el.id === 'setup-name' || el.dataset.key === 'name' || !el.value.trim()) return;
    const exact = read(el);
    if (Number.isFinite(exact)) setNumber(el, exact, inputUnit(el));
  });
  function update(value) {
    latest = value;
    if (detail) detail.textContent = value.lines.join('\n');
    if (save) save.disabled = !value.valid;
    ['copy-result', 'copy-link'].forEach(id => { const button = document.getElementById(id); if (button) button.disabled = !value.valid; });
  }
  function say(message) { if (status) status.textContent = message; }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      say('Copied.');
    } catch (_) { say('Clipboard unavailable. Select and copy the address or calculation text.'); }
  }
  window.Bench = { update, copy, read, raw, setNumber, compactInputs, get valid() { return latest.valid; } };
  document.addEventListener('DOMContentLoaded', function () {
    const calc = document.getElementById('calc');
    if (!calc) return;
    compactInputs(calc);
    const area = document.createElement('section');
    area.className = 'bench-tools';
    area.setAttribute('aria-label', 'Calculation and saved setups');
    area.innerHTML = `<details class="calculation"><summary>Show calculation</summary><p class="hint">Linear results use four significant figures; dB values and angles use hundredths. Decimal places follow the selected unit. Calculations and saved links retain full precision. Displayed equations are rounded.</p><pre id="calculation-text"></pre></details>
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
    refresh(); update(latest);
  });
})();
