// The device under test, shared by every calculator. It lives in the page link only: no
// storage on the device, so it follows you between pages and into a copied link and is
// gone when the tab closes. Pages read it through Dut.get(), push their own edits back
// with Dut.set(), and hear card edits through the 'dut-change' event on document.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SCALES = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
  const KEYS = ['din', 'dout', 'zin', 'zout', 'fmin', 'fmax', 'dut'];
  const DEFAULTS = Object.freeze({ din: 'diff', dout: 'diff', zin: 50, zout: 50, fminText: '100', fminUnit: 'MHz', fmaxText: '10', fmaxUnit: 'GHz', name: '' });
  const state = { ...DEFAULTS };
  let fromUrl = false, uses = '';
  const hz = (text, unit) => RF.parseFrequency(text, SCALES[unit]);
  const topology = value => value === 'se' || value === 'diff' ? value : null;
  // "100MHz" in a link comes back as digits plus a unit so the card shows what was typed.
  function splitFrequency(raw) {
    const match = String(raw || '').trim().match(/^(.*?)\s*([kMG]?Hz)?$/);
    if (!match) return null;
    const unit = match[2] || 'Hz';
    return Object.hasOwn(SCALES, unit) && hz(match[1], unit) > 0 ? { text: RF.frequencyDigits(match[1]), unit } : null;
  }
  function readUrl() {
    const q = new URLSearchParams(location.search);
    fromUrl = KEYS.some(key => q.has(key));
    if (topology(q.get('din'))) state.din = q.get('din');
    if (topology(q.get('dout'))) state.dout = q.get('dout');
    for (const key of ['zin', 'zout']) { const value = RF.parseNumber(q.get(key)); if (value > 0 && Number.isFinite(value)) state[key] = value; }
    for (const key of ['fmin', 'fmax']) { const split = q.has(key) ? splitFrequency(q.get(key)) : null; if (split) { state[key + 'Text'] = split.text; state[key + 'Unit'] = split.unit; } }
    if (q.has('dut')) state.name = q.get('dut').slice(0, 40);
    if (!(hz(state.fmaxText, state.fmaxUnit) > hz(state.fminText, state.fminUnit))) {
      state.fminText = DEFAULTS.fminText; state.fminUnit = DEFAULTS.fminUnit; state.fmaxText = DEFAULTS.fmaxText; state.fmaxUnit = DEFAULTS.fmaxUnit;
    }
  }
  // Only what differs from the default goes into a link, so ordinary links stay short.
  function params() {
    const q = new URLSearchParams();
    if (state.din !== DEFAULTS.din) q.set('din', state.din);
    if (state.dout !== DEFAULTS.dout) q.set('dout', state.dout);
    if (state.zin !== DEFAULTS.zin) q.set('zin', String(state.zin));
    if (state.zout !== DEFAULTS.zout) q.set('zout', String(state.zout));
    for (const key of ['fmin', 'fmax']) {
      if (state[key + 'Text'] !== DEFAULTS[key + 'Text'] || state[key + 'Unit'] !== DEFAULTS[key + 'Unit']) q.set(key, state[key + 'Text'] + state[key + 'Unit']);
    }
    if (state.name) q.set('dut', state.name);
    return q;
  }
  function stamp(q) {
    KEYS.forEach(key => q.delete(key));
    params().forEach((value, key) => q.set(key, value));
    return q;
  }
  // Relative links stay relative, so a page on a subpath keeps working.
  function stampUrl(url) {
    const hashAt = url.indexOf('#'), hash = hashAt >= 0 ? url.slice(hashAt) : '', bare = hashAt >= 0 ? url.slice(0, hashAt) : url;
    const queryAt = bare.indexOf('?'), base = queryAt >= 0 ? bare.slice(0, queryAt) : bare;
    const search = stamp(new URLSearchParams(queryAt >= 0 ? bare.slice(queryAt + 1) : '')).toString();
    return base + (search ? '?' + search : '') + hash;
  }
  // Every page rewrites its own query from scratch, so the card rides along here rather than
  // depending on each page remembering to include it.
  const replaceState = history.replaceState.bind(history);
  history.replaceState = function (data, title, url) { return replaceState(data, title, typeof url === 'string' ? stampUrl(url) : url); };
  function get() {
    return { din: state.din, dout: state.dout, zin: state.zin, zout: state.zout, name: state.name,
      fmin: hz(state.fminText, state.fminUnit), fmax: hz(state.fmaxText, state.fmaxUnit),
      fminText: state.fminText, fminUnit: state.fminUnit, fmaxText: state.fmaxText, fmaxUnit: state.fmaxUnit, fromUrl };
  }
  function sideText(side) {
    const mode = state[side === 'in' ? 'din' : 'dout'], z = state[side === 'in' ? 'zin' : 'zout'];
    return `${mode === 'diff' ? 'Diff' : 'SE'} ${side} · ${RF.formatNumber(z)} Ω${mode === 'diff' ? '/line' : ''}`;
  }
  function rangeText() { return `${state.fminText} ${state.fminUnit} – ${state.fmaxText} ${state.fmaxUnit}`; }
  function renderSummary() {
    const el = $('dut-summary');
    if (!el) return;
    el.innerHTML = (state.name ? `<strong>${escape(state.name)}</strong> · ` : '') +
      `<span class="tint-in">${sideText('in')}</span> → <span class="tint-out">${sideText('out')}</span> · ${escape(rangeText())}`;
    document.querySelectorAll('[data-dut][data-value]').forEach(button => {
      const active = state[button.dataset.dut] === button.dataset.value;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    const usesEl = $('dut-uses');
    if (usesEl) usesEl.textContent = uses ? `This page uses ${uses}.` : 'This page does not take anything from the DUT card; it still travels with the link.';
    const reset = $('dut-reset');
    if (reset) reset.disabled = params().toString() === '';
  }
  function renderLinks() {
    document.querySelectorAll('nav a[href], a.wordmark[href], a[data-dut-link]').forEach(a => {
      const href = a.getAttribute('href');
      if (/^(https?:)?\/\//.test(href)) return;
      a.setAttribute('href', stampUrl(href));
    });
  }
  function renderUrl() { history.replaceState(null, '', location.pathname + location.search + location.hash); }
  function fill() {
    if (!$('dut-name')) return;
    $('dut-name').value = state.name;
    $('dut-zin').value = String(state.zin); $('dut-zout').value = String(state.zout);
    $('dut-fmin').value = state.fminText; $('dut-fmin-unit').value = state.fminUnit;
    $('dut-fmax').value = state.fmaxText; $('dut-fmax-unit').value = state.fmaxUnit;
  }
  function emit(source) { document.dispatchEvent(new CustomEvent('dut-change', { detail: { source, dut: get() } })); }
  // Pages call this with the fields they own. Invalid values are ignored, one by one.
  function set(partial, options) {
    const silent = options && options.silent;
    let changed = false;
    const apply = (key, value) => { if (state[key] !== value) { state[key] = value; changed = true; } };
    if (topology(partial.din)) apply('din', partial.din);
    if (topology(partial.dout)) apply('dout', partial.dout);
    if (partial.zin > 0 && Number.isFinite(partial.zin)) apply('zin', partial.zin);
    if (partial.zout > 0 && Number.isFinite(partial.zout)) apply('zout', partial.zout);
    if (typeof partial.name === 'string') apply('name', partial.name.slice(0, 40));
    for (const key of ['fmin', 'fmax']) {
      if (typeof partial[key + 'Text'] === 'string' && Object.hasOwn(SCALES, partial[key + 'Unit'])) {
        const text = RF.frequencyDigits(partial[key + 'Text']);
        if (hz(text, partial[key + 'Unit']) > 0) { apply(key + 'Text', text); apply(key + 'Unit', partial[key + 'Unit']); }
      }
    }
    if (!changed) return false;
    if (!document.activeElement || !document.activeElement.closest('.dut-card')) fill();
    renderSummary(); renderLinks(); renderUrl();
    if (!silent) emit('page');
    return true;
  }
  function describe(text) { uses = text; renderSummary(); }
  function readCard() {
    const status = $('dut-status');
    const zin = RF.parseNumber($('dut-zin').value), zout = RF.parseNumber($('dut-zout').value);
    const fmin = hz($('dut-fmin').value, $('dut-fmin-unit').value), fmax = hz($('dut-fmax').value, $('dut-fmax-unit').value);
    const problems = [];
    if (!(zin > 0 && Number.isFinite(zin))) problems.push('input impedance must be positive');
    if (!(zout > 0 && Number.isFinite(zout))) problems.push('output impedance must be positive');
    if (!(fmin > 0) || !(fmax > fmin)) problems.push('the range needs a positive start below its stop');
    status.textContent = problems.length ? 'Not applied: ' + problems.join('; ') + '.' : '';
    status.className = problems.length ? 'hint status-error' : 'hint';
    if (problems.length) return;
    const before = params().toString();
    Object.assign(state, { zin, zout, name: $('dut-name').value.trim().slice(0, 40),
      fminText: RF.frequencyDigits($('dut-fmin').value), fminUnit: $('dut-fmin-unit').value,
      fmaxText: RF.frequencyDigits($('dut-fmax').value), fmaxUnit: $('dut-fmax-unit').value });
    renderSummary(); renderLinks(); renderUrl();
    if (params().toString() !== before) emit('card');
  }
  function unitPair(id, label, text, unit) {
    const options = Object.keys(SCALES).map(u => `<option value="${u}"${u === unit ? ' selected' : ''}>${u}</option>`).join('');
    return `<div class="quantity-field"><label for="${id}">${label}</label><div class="unit-pair"><input id="${id}" value="${escape(text)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${label}"><select id="${id}-unit" aria-label="${label} unit">${options}</select></div></div>`;
  }
  function mount() {
    let host = $('dut-card');
    if (!host) { host = document.createElement('div'); host.id = 'dut-card'; const top = document.querySelector('header.top'); if (top) top.after(host); else document.body.prepend(host); }
    host.className = 'dut-card';
    host.setAttribute('aria-label', 'Device under test');
    const seg = key => ['se', 'diff'].map(value => `<button type="button" class="seg-btn" data-dut="${key}" data-value="${value}" aria-pressed="false">${value === 'se' ? 'Single-ended' : 'Differential'}</button>`).join('');
    host.innerHTML = `<details class="dut-details"><summary><span class="dut-kicker">DUT</span><span class="dut-summary" id="dut-summary"></span><span class="dut-edit">Edit</span></summary>
      <div class="dut-body">
        <div class="dut-grid">
          <label class="dut-name">Name (optional)<input id="dut-name" maxlength="40" placeholder="e.g. Driver rev B" autocomplete="off" aria-label="DUT name"></label>
          <div class="dut-side dut-side-in"><span class="dut-side-label tint-in">Input ports</span><div class="seg" role="group" aria-label="Input port topology">${seg('din')}</div><label>Z per line (Ω)<input id="dut-zin" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="DUT input reference impedance per line in ohms"></label></div>
          <div class="dut-side dut-side-out"><span class="dut-side-label tint-out">Output ports</span><div class="seg" role="group" aria-label="Output port topology">${seg('dout')}</div><label>Z per line (Ω)<input id="dut-zout" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="DUT output reference impedance per line in ohms"></label></div>
          <div class="dut-range">${unitPair('dut-fmin', 'Operating range from', state.fminText, state.fminUnit)}${unitPair('dut-fmax', 'to', state.fmaxText, state.fmaxUnit)}</div>
        </div>
        <p class="hint" id="dut-uses"></p>
        <p class="hint" id="dut-status" role="status"></p>
        <p class="hint">A differential port's reference is twice the per-line value, its common-mode reference half. The DUT travels in the page link between calculators and into a copied link; nothing is stored on this device.</p>
        <div class="toolbar"><button type="button" class="ghost" id="dut-reset">Reset to 50 Ω differential, 100 MHz – 10 GHz</button></div>
      </div></details>`;
    fill();
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-dut][data-value]');
      if (!button) return;
      if (state[button.dataset.dut] === button.dataset.value) return;
      state[button.dataset.dut] = button.dataset.value;
      renderSummary(); renderLinks(); renderUrl(); emit('card');
    });
    ['dut-name', 'dut-zin', 'dut-zout', 'dut-fmin', 'dut-fmax'].forEach(id => $(id).addEventListener('input', readCard));
    ['dut-fmin-unit', 'dut-fmax-unit'].forEach(id => $(id).addEventListener('change', () => {
      const field = $(id.replace('-unit', ''));
      field.value = RF.frequencyDigits(field.value);
      readCard();
    }));
    $('dut-reset').addEventListener('click', () => { Object.assign(state, DEFAULTS); fill(); readCard(); renderSummary(); renderLinks(); renderUrl(); emit('card'); });
    renderSummary(); renderLinks();
  }
  readUrl();
  window.Dut = { get, set, stamp, describe, DEFAULTS, refresh() { fill(); renderSummary(); renderLinks(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
