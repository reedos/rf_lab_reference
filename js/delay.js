(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id), n = id => Bench.read(id, ['length','delay','degrees','phase-p1','phase-p2','phase-turns','skew-length'].includes(id));
  const scales = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9, m: 1, cm: .01, mm: .001, in: .0254, mil: 2.54e-5, 'µm': 1e-6, ns: 1e-9, ps: 1e-12, 'µs': 1e-6 };
  const fmt = RF.formatNumber;
  const show = (v, unit) => fmt(v, unit) + ' ' + unit;
  const freqText = hz => {
    if (!Number.isFinite(hz)) return '—';
    const [scale, unit] = hz >= 1e12 ? [1e12, 'THz'] : hz >= 1e9 ? [1e9, 'GHz'] : hz >= 1e6 ? [1e6, 'MHz'] : hz >= 1e3 ? [1e3, 'kHz'] : [1, 'Hz'];
    return fmt(hz / scale) + ' ' + unit;
  };
  const metric = (key, value, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><dt>${key}</dt><dd>${value}</dd></div>`;
  let source = 'length', dielectric = 'er', current = null, slope = null, skew = null;

  const phaseIds = ['phase-f1', 'phase-f2', 'phase-p1', 'phase-p2', 'phase-turns', 'phase-mode'];
  const skewIds = ['skew-length', 'skew-unit', 'skew-target'];
  function readQuery() {
    const q = new URLSearchParams(location.search);
    if (q.has('er')) $('er').value = q.get('er');
    const entries = { f: 'freq', fu: 'freq-unit', L: 'length', lu: 'len-unit', t: 'delay', tu: 'delay-unit', a: 'degrees' };
    for (const [key, id] of Object.entries(entries)) if (q.has(key)) {
      const el = $(id), v = q.get(key);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === v)) el.value = v;
    }
    if (['length', 'delay', 'degrees'].includes(q.get('from'))) source = q.get('from');
    // Old links stored only length, even when delay or angle was the driver.
    if ((source === 'delay' && !q.has('t')) || (source === 'degrees' && !q.has('a'))) source = 'length';
    for (const id of phaseIds) if (q.has(id)) {
      if (id !== 'phase-mode' || ['transmission', 'reflection'].includes(q.get(id))) $(id).value = q.get(id);
    }
    for (const id of skewIds) if (q.has(id)) {
      const el = $(id), value = q.get(id);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === value)) el.value = value;
    }
  }
  function writeQuery() {
    const q = new URLSearchParams({ er: String(current.er), f: Bench.raw('freq'), fu: $('freq-unit').value,
      from: source, L: Bench.raw('length'), lu: $('len-unit').value,
      t: Bench.raw('delay'), tu: $('delay-unit').value, a: Bench.raw('degrees') });
    phaseIds.forEach(id => q.set(id, Bench.raw(id)));
    skewIds.forEach(id => q.set(id, Bench.raw(id)));
    history.replaceState(null, '', location.pathname + '?' + q);
  }
  function compute() {
    const raw = dielectric === 'er' ? n('er') : n('vf');
    const er = dielectric === 'er' ? raw : RF.erFromVf(raw);
    const validDielectric = Number.isFinite(raw) && (dielectric === 'er' ? raw >= 1 : raw > 0 && raw <= 1);
    const f = n('freq') * scales[$('freq-unit').value];
    const length = source === 'length' ? n('length') * scales[$('len-unit').value] :
      source === 'delay' ? RF.lengthFromDelay(n('delay') * scales[$('delay-unit').value], er) : RF.lengthFromDegrees(n('degrees'), f, er);
    const delay = RF.delayFromLength(length, er), degrees = RF.degreesFromLength(length, f, er);
    const lambda = RF.guidedWavelength(f, er);
    const ok = validDielectric && f > 0 && length >= 0 && [f, length, delay, degrees, lambda].every(Number.isFinite);
    if (!ok) {
      current = null; slope = null;
      $('metrics').innerHTML = metric('Status', 'Enter positive frequency, εeff ≥ 1 (0 &lt; VF ≤ 1), and nonnegative length, delay, or angle.');
      $('phase-metrics').replaceChildren(); $('delay-interpretation').textContent = '';
      $('phase-use').disabled = true;
      skew = null; $('skew-metrics').replaceChildren();
      $('skew-status').className = 'status-error';
      $('skew-status').textContent = 'Correct the line inputs above to evaluate skew.';
      $('phase-status').textContent = 'Correct the line inputs above to estimate length.';
      Bench.update({ valid: false, lines: ['Correct the line inputs before calculating or saving.'] });
      return;
    }
    current = { er, f, length, delay, degrees, lambda };
    if (dielectric === 'er') Bench.setNumber('vf', RF.vfFromEr(er), '', true); else Bench.setNumber('er', er, '', true);
    if (source !== 'length') Bench.setNumber('length', length / scales[$('len-unit').value], $('len-unit').value, true);
    if (source !== 'delay') Bench.setNumber('delay', delay / scales[$('delay-unit').value], $('delay-unit').value, true);
    if (source !== 'degrees') Bench.setNumber('degrees', degrees, 'deg', true);
    document.querySelectorAll('[data-er]').forEach(b => b.classList.toggle('is-active', Math.abs(Number(b.dataset.er) - er) < 1e-9));
    $('metrics').innerHTML = metric('One-way delay', show(delay * 1e9, 'ns'), 'primary') +
      metric('Guided wavelength', show(lambda * 1000, 'mm')) + metric('Half wavelength', show(lambda * 500, 'mm')) + metric('Quarter wavelength', show(lambda * 250, 'mm')) +
      metric('Propagation velocity', show(RF.C_LIGHT * RF.vfFromEr(er) / 1e8, '× 10⁸ m/s')) +
      metric('Reflection trace delay', show(delay * 2e9, 'ns'));
    $('delay-interpretation').textContent = `At ${fmt(f / 1e6)} MHz, transmission phase is ${fmt(-degrees, 'deg')}° and reflection phase is ${fmt(-2 * degrees, 'deg')}° (unwrapped propagation phase). Physical one-way port extension: ${fmt(delay * 1e9)} ns.`;
    const skewOk = computeSkew(er, f);
    slope = RF.phaseDelay(n('phase-f1') * 1e6, n('phase-f2') * 1e6, n('phase-p1'), n('phase-p2'), n('phase-turns'), $('phase-mode').value, RF.vfFromEr(er));
    const slopeOk = slope && [slope.traceDelay, slope.length].every(Number.isFinite);
    $('phase-metrics').innerHTML = slopeOk ? metric('Unwrapped phase change', show(slope.deltaPhase, 'deg')) + metric('Measured trace delay', show(slope.traceDelay * 1e9, 'ns')) +
      metric('Estimated one-way delay', show(slope.oneWayDelay * 1e9, 'ns')) + metric(slope.length < 0 ? 'Signed length estimate' : 'Estimated length', show(slope.length * 1000, 'mm')) : '';
    $('phase-status').textContent = !slopeOk ? 'Use increasing positive frequencies, finite phase values, and an integer number of extra turns.' :
      slope.length < 0 ? 'Negative delay: check unwrapping or DUT dispersion. This estimate cannot be applied as a physical cable length.' : 'Estimate assumes the measured phase slope comes from the line.';
    $('phase-use').disabled = !slopeOk || slope.length < 0;
    const lines = [
      'Uniform, nondispersive line. Use the effective permittivity or measured velocity factor for the line. Phase is in degrees.',
      eq('Velocity factor', String.raw`\mathrm{VF} &= \frac{1}{\sqrt{\varepsilon_{\mathrm{eff}}}}`, tex(RF.vfFromEr(er)), String.raw`\frac{1}{\sqrt{${tex(er)}}}`),
      eq('Guided wavelength', String.raw`\lambda_{\mathrm g} &= \frac{c}{f\sqrt{\varepsilon_{\mathrm{eff}}}}`, tex(lambda * 1000, 'mm'), String.raw`\frac{299792458}{(${tex(f)})\sqrt{${tex(er)}}}\,\mathrm m`),
      eq('One-way delay', String.raw`\tau &= \frac{\ell\sqrt{\varepsilon_{\mathrm{eff}}}}{c}`, tex(delay * 1e9, 'ns'), String.raw`\frac{${tex(length)}\sqrt{${tex(er)}}}{299792458}\,\mathrm s`),
      eq('Electrical angle', String.raw`\theta &= 360 f\tau`, tex(degrees, 'deg'), String.raw`360\times (${tex(f)})\times (${tex(delay)})\,{}^\circ`),
      eq('Transmission propagation phase', String.raw`\phi_{21} &= -\theta`, tex(-degrees, 'deg')),
      eq('Reflection propagation phase', String.raw`\phi_{11} &= -2\theta`, tex(-2 * degrees, 'deg'))
    ];
    if (skew) lines.push('Intra-pair skew. A length mismatch delays one half of the pair; the differential signal is scaled and the remainder appears as common mode.',
      eq('Skew from the length mismatch', String.raw`\Delta t &= \frac{\Delta \ell \sqrt{\varepsilon_{\mathrm{eff}}}}{c}`, tex(skew.skew * 1e12, 'ps'), String.raw`\frac{${tex(skew.length)}\sqrt{${tex(er)}}}{299792458}\,\mathrm s`),
      eq('Phase error at the measurement frequency', String.raw`\Delta\phi &= 360 f \Delta t`, tex(skew.degrees, 'deg')),
      eq('Differential response', String.raw`|S_{dd21}| &= \cos(\pi f \Delta t) = \cos\!\left(\tfrac{\Delta\phi}{2}\right)`, tex(skew.differentialDb, 'dB')),
      eq('Common-mode conversion', String.raw`|S_{cd21}| &= \sin(\pi f \Delta t) = \sin\!\left(\tfrac{\Delta\phi}{2}\right)`, tex(skew.commonDb, 'dB')),
      eq('Power is conserved between the modes', String.raw`|S_{dd21}|^{2}+|S_{cd21}|^{2} &= 1`),
      'Skew dissipates nothing. It moves energy from the differential mode into the common mode, which is why it shows up as radiation and as lost common-mode rejection long before it shows up as insertion loss.');
    if (slopeOk) lines.push('Phase-slope estimate. The number of extra turns is supplied by the user; two points alone cannot determine unwrapping.',
      eq('Unwrapped phase change', String.raw`\Delta\phi &= \phi_2-\phi_1+360N`, tex(slope.deltaPhase, 'deg'), String.raw`${tex(n('phase-p2'), 'deg')}-(${tex(n('phase-p1'), 'deg')})+360\times ${n('phase-turns')}\,{}^\circ`),
      eq('Measured trace delay', String.raw`\tau_{\mathrm{trace}} &= -\frac{\Delta\phi}{360(f_2-f_1)}`, tex(slope.traceDelay * 1e9, 'ns'), String.raw`-\frac{${tex(slope.deltaPhase, 'deg', false)}}{360\times (${tex((n('phase-f2')-n('phase-f1'))*1e6)})}\,\mathrm s`),
      eq('Physical one-way delay', String.raw`\tau_{\mathrm{one\,way}} &= \frac{\tau_{\mathrm{trace}}}{${$('phase-mode').value === 'reflection' ? 2 : 1}}`, tex(slope.oneWayDelay * 1e9, 'ns')),
      eq('Estimated length', String.raw`\ell &= c\,\mathrm{VF}\,\tau_{\mathrm{one\,way}}`, tex(slope.length * 1000, 'mm')));
    else lines.push('Phase-slope inputs are invalid. Correct them before saving the setup.');
    Bench.update({ valid: Boolean(slopeOk && skewOk), lines });
    if (slopeOk && skewOk) writeQuery();
  }
  // Skew is evaluated against the same dielectric and frequency as the rest of the page.
  function computeSkew(er, f) {
    const mismatch = n('skew-length'), scale = scales[$('skew-unit').value];
    const [mode, target] = $('skew-target').value.split(':'), limit = Number(target);
    skew = Number.isFinite(mismatch) ? RF.pairSkew(mismatch * scale, er, f) : null;
    const budget = RF.skewBudget(limit, mode, er, f);
    if (!skew || !budget) {
      skew = null; $('skew-metrics').replaceChildren();
      $('skew-status').className = 'status-error';
      $('skew-status').textContent = 'Enter a finite length mismatch. Blank means no mismatch.';
      return false;
    }
    const unit = $('skew-unit').value, allowed = show(budget.length / scale, unit);
    const within = mode === 'common' ? skew.commonDb <= limit : skew.differentialDb >= limit;
    $('skew-metrics').innerHTML =
      metric('Common-mode conversion', show(skew.commonDb, 'dB'), 'primary') +
      metric('Skew', show(skew.skew * 1e12, 'ps')) +
      metric('Phase error at ' + freqText(f), show(skew.degrees, 'deg')) +
      metric('Fraction of a period', show(skew.cycles * 100, '%')) +
      metric('Differential response', show(skew.differentialDb, 'dB')) +
      metric('First null', skew.nullFrequency === Infinity ? 'None, the halves are matched' : freqText(skew.nullFrequency)) +
      metric('Budget for this limit', allowed + ' · ' + show(budget.skew * 1e12, 'ps'));
    $('skew-status').className = within && !skew.beyondNull ? '' : 'over-limit';
    $('skew-status').textContent = skew.beyondNull
      ? 'The mismatch is more than half a period at this frequency, so the response has already passed through a null and come back. Treat these numbers as a warning, not a working point.'
      : within
        ? 'Within the limit: up to ' + allowed + ' of mismatch meets this target at ' + freqText(f) + '.'
        : 'Over the limit: reduce the mismatch to ' + allowed + ' or less to meet this target at ' + freqText(f) + '.';
    return true;
  }
  ['length', 'delay', 'degrees'].forEach(id => $(id).addEventListener('input', () => { source = id; compute(); }));
  ['skew-length', 'skew-target'].forEach(id => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', compute));
  ['er', 'vf'].forEach(id => $(id).addEventListener('input', () => { dielectric = id; compute(); }));
  $('freq').addEventListener('input', compute);
  // Picking a unit keeps the digits that are there and changes what they mean, the way an
  // analyzer's unit keys do. A field that is solved from another is rewritten by compute() in
  // the new unit, so its physical value is preserved without any conversion here.
  ['freq-unit', 'len-unit', 'delay-unit', 'skew-unit'].forEach(id => $(id).addEventListener('change', compute));
  phaseIds.forEach(id => $(id).addEventListener(id === 'phase-mode' ? 'change' : 'input', compute));
  document.querySelectorAll('[data-er]').forEach(b => b.addEventListener('click', () => { dielectric = 'er'; Bench.setNumber('er', Number(b.dataset.er)); compute(); }));
  $('phase-use').addEventListener('click', () => {
    if (!slope || slope.length < 0) return;
    source = 'length'; Bench.setNumber('length', slope.length / scales[$('len-unit').value], $('len-unit').value, true); compute();
  });
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (current && Bench.valid) Bench.copy(`${fmt(current.f / 1e6)} MHz | εeff ${fmt(current.er)} | ${fmt(current.length * 1000)} mm | one-way ${fmt(current.delay * 1e9)} ns | ${fmt(current.degrees)}°\nPhase slope (${$('phase-mode').value}): ${fmt(slope.deltaPhase, 'deg')}° | trace ${fmt(slope.traceDelay * 1e9)} ns | estimated one-way length ${fmt(slope.length * 1000)} mm`);
  });
  Bench.exports({ figureTitle: 'Results', figureLabel: 'Copy tiles', figure: () => [$('metrics'), $('phase-metrics'), $('skew-metrics')] });
  readQuery(); compute();
})();
