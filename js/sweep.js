(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id);
  const fmt = RF.formatNumber, freq = hz => RF.formatFrequency(hz).text;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric = (label, value, cls) => `<div class="metric${cls ? ' ' + cls : ''}"><dt>${label}</dt><dd>${value}</dd></div>`;
  const scales = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
  const segment = (start, startUnit, stop, stopUnit, step, stepUnit) => ({ start, startUnit, stop, stopUnit, step, stepUnit, enabled: true });
  // A segment can be parked without losing its values. Everything downstream, including the
  // boundary checks, sees only the enabled ones, so switching one off genuinely opens a gap.
  const isOn = s => s.enabled !== false;
  // The wide preset spans the DUT's range. 10 MHz steps when that gives a sensible count,
  // otherwise a round thousandth of the span.
  function wideStep(dut) {
    const span = dut.fmax - dut.fmin, tenMeg = span / 1e7;
    if (tenMeg >= 100 && tenMeg <= 20000) return { text: '10', unit: 'MHz' };
    const step = RF.formatFrequency(Number((span / 1000).toPrecision(1)));
    return { text: String(step.value), unit: step.unit };
  }
  function widePreset() {
    const dut = Dut.get(), step = wideStep(dut);
    return segment(dut.fminText, dut.fminUnit, dut.fmaxText, dut.fmaxUnit, step.text, step.unit);
  }
  function labelPresets() {
    const s = widePreset();
    document.querySelector('[data-preset="wide"]').textContent = `${s.start} ${s.startUnit}–${s.stop} ${s.stopUnit}, ${s.step} ${s.stepUnit}`;
  }
  function rangeFromCard() {
    const dut = Dut.get();
    $('g-tail').value = dut.fminText; $('g-tail-unit').value = dut.fminUnit;
    $('g-stop').value = dut.fmaxText; $('g-stop-unit').value = dut.fmaxUnit;
  }
  function coverage() {
    const dut = Dut.get();
    const low = result.first <= dut.fmin * (1 + 1e-9), high = result.last >= dut.fmax * (1 - 1e-9);
    if (low && high) return `Covered · ${freq(dut.fmin)} – ${freq(dut.fmax)}`;
    const gaps = [];
    if (!low) gaps.push(`starts ${freq(result.first - dut.fmin)} above ${freq(dut.fmin)}`);
    if (!high) gaps.push(`ends ${freq(dut.fmax - result.last)} below ${freq(dut.fmax)}`);
    return `<span class="over-limit">Not covered: ${gaps.join('; ')}</span>`;
  }
  const PRESETS = {
    get wide() { return [widePreset()]; },
    decades: [
      segment('10', 'kHz', '90', 'kHz', '10', 'kHz'), segment('100', 'kHz', '900', 'kHz', '100', 'kHz'),
      segment('1', 'MHz', '9', 'MHz', '1', 'MHz'), segment('10', 'MHz', '90', 'MHz', '10', 'MHz'),
      segment('100', 'MHz', '10', 'GHz', '100', 'MHz')]
  };
  const timeScales = { 'µs': 1e-6, ms: 1e-3, s: 1 };
  const overheadIds = ['point-overhead', 'segment-overhead'];
  const frequencyIds = ['ifbw', 'g-start', 'g-stop', 'g-tail', 'g-tail-step', 'nf-ref-bw'];
  const optionIds = ['mode', 'limit', 'jump', 'g-mult', 'p-start', 'p-stop', 'p-step', 'p-points', 'nf-ref', 'nf-avg', 'nf-signal']
    .concat(frequencyIds, frequencyIds.map(id => id + '-unit'), overheadIds, overheadIds.map(id => id + '-unit'));
  // Every frequency field carries its own unit; changing it keeps the physical value.
  const unitScale = el => scales[document.getElementById(el.id + '-unit').value];
  const readHz = el => RF.parseFrequency(el.value, unitScale(el));
  function bindUnit(id) {
    const el = $(id);
    $(id + '-unit').addEventListener('change', function () {
      el.value = RF.frequencyDigits(el.value);
      compute();
    });
  }
  const segmentUnit = (s, key) => Object.hasOwn(scales, s[key]) ? s[key] : 'MHz';
  let segments = PRESETS.wide, powerSource = 'step', result = null, power = null, noise = null, loadError = '', active = [];
  function readQuery() {
    const q = new URLSearchParams(location.search);
    for (const id of optionIds) if (q.has(id)) {
      const el = $(id), value = q.get(id);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === value)) el.value = value;
    }
    if (q.get('pfrom') === 'points') powerSource = 'points';
    if (!q.has('g-tail') && !q.has('g-stop')) rangeFromCard();
    if (q.has('segments')) {
      try {
        const data = JSON.parse(q.get('segments'));
        if (!Array.isArray(data) || !data.length || data.length > 100 ||
            !data.every(s => s && ['start', 'stop', 'step'].every(key => typeof s[key] === 'string' && s[key].length <= 40) &&
              ['startUnit', 'stopUnit', 'stepUnit'].every(key => s[key] === undefined || Object.hasOwn(scales, s[key])) &&
              (s.enabled === undefined || typeof s.enabled === 'boolean'))) throw new Error();
        segments = data;
      } catch (_) { loadError = 'This sweep link could not be read. The example sweep is shown; edit a value to start a new setup.'; }
    }
  }
  function writeQuery() {
    const q = new URLSearchParams();
    optionIds.forEach(id => q.set(id, Bench.raw(id)));
    q.set('pfrom', powerSource); q.set('segments', JSON.stringify(segments));
    history.replaceState(null, '', location.pathname + '?' + q);
  }
  function renderSegments() {
    const field = (s, i, key, label) => {
      const id = `seg${i}-${key}`, unit = segmentUnit(s, key + 'Unit');
      const options = Object.keys(scales).map(u => `<option value="${u}"${u === unit ? ' selected' : ''}>${u}</option>`).join('');
      return `<div class="quantity-field"><label for="${id}">${label}</label><div class="unit-pair">` +
        `<input id="${id}" data-key="${key}" value="${escape(s[key])}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Segment ${i + 1} ${label.toLowerCase()}">` +
        `<select data-key="${key}Unit" aria-label="Segment ${i + 1} ${label.toLowerCase()} unit">${options}</select></div></div>`;
    };
    $('segments').innerHTML = segments.map((s, i) => `<div class="segment${isOn(s) ? '' : ' is-off'}" data-index="${i}" role="group" aria-label="Segment ${i + 1}">
      <div class="segment-lead"><input type="checkbox" id="seg${i}-on" data-key="enabled" ${isOn(s) ? 'checked' : ''} aria-label="Include segment ${i + 1} in the sweep"><label class="segment-index" for="seg${i}-on">${i + 1}</label></div>
      ${field(s, i, 'start', 'Start')}${field(s, i, 'stop', 'Stop')}${field(s, i, 'step', 'Step')}
      <button class="ghost" type="button" data-action="remove" aria-label="Remove segment ${i + 1}" ${segments.length === 1 ? 'disabled' : ''}>Remove</button></div>`).join('');
    $('add-segment').disabled = segments.length >= 100;
  }
  function seconds(t) {
    if (!Number.isFinite(t)) return '—';
    return t >= 1 ? `${fmt(t)} s` : t >= 1e-3 ? `${fmt(t * 1e3)} ms` : `${fmt(t * 1e6)} µs`;
  }
  function boundaryText(b) {
    if (b.kind === 'overlap') return `Overlap of ${freq(-b.gap)}`;
    if (b.kind === 'duplicate') return 'Duplicate point: stop equals next start';
    if (b.kind === 'gap') return `Gap of ${freq(b.gap)}, wider than the ${freq(b.previousStep)} step before it`;
    return `Contiguous, ${freq(b.gap)} to next point`;
  }
  function invalidSweep(message) {
    result = null;
    $('sweep-status').textContent = message; $('sweep-status').className = 'status-error';
    ['sweep-rows', 'boundary-rows', 'sweep-metrics'].forEach(id => $(id).replaceChildren());
  }
  function computeSweep() {
    if (loadError) return invalidSweep(loadError);
    active = segments.map((s, i) => ({ s, i })).filter(({ s }) => isOn(s));
    if (!active.length) return invalidSweep('Every segment is switched off. Enable at least one to size the sweep.');
    const parsed = active.map(({ s }) => ({ start: RF.parseFrequency(s.start, scales[segmentUnit(s, 'startUnit')]),
      stop: RF.parseFrequency(s.stop, scales[segmentUnit(s, 'stopUnit')]), step: RF.parseFrequency(s.step, scales[segmentUnit(s, 'stepUnit')]) }));
    const limitBlank = $('limit').value.trim() === '', ifbwBlank = $('ifbw').value.trim() === '';
    const maxPoints = limitBlank ? null : Bench.read('limit'), ifbw = ifbwBlank ? null : readHz($('ifbw')), jumpLimit = Bench.read('jump'), mode = $('mode').value;
    const overhead = {};
    for (const id of overheadIds) {
      const text = $(id).value.trim();
      if (text === '') { overhead[id] = 0; continue; }
      const value = Bench.read(id) * timeScales[$(id + '-unit').value];
      if (!(value >= 0) || !Number.isFinite(value)) return invalidSweep('Overhead entries must be zero or a positive time. Leave them blank if unknown.');
      overhead[id] = value;
    }
    if ((maxPoints !== null && !(Number.isInteger(maxPoints) && maxPoints > 0)) || (ifbw !== null && !(ifbw > 0)) || !(jumpLimit > 1)) {
      return invalidSweep('Point limit must be a positive whole number, IF bandwidth positive, and the step-ratio flag above 1.');
    }
    result = RF.segmentedSweep(parsed, { maxPoints, ifbw, jumpLimit, mode,
      pointOverhead: overhead['point-overhead'], segmentOverhead: overhead['segment-overhead'] });
    if (!result) return invalidSweep('Each segment needs a positive start, a stop at or above it, and a positive step. Pick each unit beside its field.');
    const sharp = result.boundaries.filter(b => b.sharp).length, broken = result.boundaries.filter(b => b.kind !== 'contiguous').length;
    const notes = [];
    if (result.inexact) notes.push(`${result.inexact} ${result.inexact === 1 ? 'segment does' : 'segments do'} not land on the stop frequency`);
    if (broken) notes.push(`${broken} boundar${broken === 1 ? 'y has' : 'ies have'} a gap, overlap, or duplicate point`);
    if (sharp) notes.push(`${sharp} boundar${sharp === 1 ? 'y changes' : 'ies change'} ${mode === 'relative' ? 'the relative step Δf/f at the segment start' : 'the step size'} by more than ${fmt(result.jumpLimit)}×`);
    if (result.headroom !== null && result.headroom < 0) notes.push(`the total exceeds the ${result.maxPoints}-point limit by ${-result.headroom}`);
    const parked = segments.length - active.length;
    $('sweep-status').className = notes.length ? 'over-limit' : '';
    const parkedNote = parked ? ` ${parked} segment${parked === 1 ? ' is' : 's are'} switched off and excluded.` : '';
    $('sweep-status').textContent = (notes.length ? `Check: ${notes.join('; ')}.` : `Segments are contiguous, ${mode === 'relative' ? 'repeat their relative spacing pattern' : 'change step size evenly'}, and land exactly on their stop frequencies.`) + parkedNote;
    $('sweep-rows').innerHTML = result.rows.map((r, i) => `<tr class="${r.exact ? '' : 'over-limit'}"><td>${active[i].i + 1}</td><td>${freq(r.start)}</td><td>${freq(r.stop)}</td><td>${freq(r.step)}</td><td>${r.points}</td><td>${freq(r.lastPoint)}${r.exact ? '' : ` · use ${freq(r.stepCeil)} for ${r.pointsCeil} points`}</td><td>${fmt(r.fractionalStart * 100)} → ${fmt(r.fractionalStop * 100)} %</td><td>${fmt(r.decadePoints)}</td><td>${fmt(r.pointsPerDecadeStart)} → ${fmt(r.pointsPerDecadeStop)}</td></tr>`).join('');
    $('boundary-rows').innerHTML = result.boundaries.length ? result.boundaries.map(b => `<tr class="${b.sharp || b.kind !== 'contiguous' ? 'over-limit' : ''}"><td>${freq(b.frequency)}</td><td>${boundaryText(b)}</td><td class="${mode === 'absolute' && b.sharp ? 'over-limit' : ''}">${fmt(b.stepRatio)}×</td><td class="${mode === 'relative' && b.sharp ? 'over-limit' : ''}">${fmt(b.patternRatio)}×</td><td>${b.sharp ? (mode === 'relative' ? 'Pattern change' : 'Sharp step change') : b.kind !== 'contiguous' ? 'Fix boundary' : 'OK'}</td></tr>`).join('')
      : '<tr><td colspan="5">One segment: no boundaries to check.</td></tr>';
    $('sweep-metrics').innerHTML = metric('Total points', String(result.points) + (parked ? ` · ${active.length} of ${segments.length} segments` : ''), 'primary') + metric('Span', `${freq(result.first)} → ${freq(result.last)}`) + metric('DUT range', coverage()) +
      metric('Points per decade', result.decadePoints.min === result.decadePoints.max ? fmt(result.decadePoints.min) : `${fmt(result.decadePoints.min)} to ${fmt(result.decadePoints.max)} by segment`) +
      metric('Point limit', result.maxPoints === null ? 'None specified' : `${result.maxPoints} · ${result.headroom >= 0 ? `${result.headroom} spare` : `<span class="over-limit">${-result.headroom} over</span>`}`) +
      metric(result.overheadTime > 0 ? 'Estimated sweep time' : 'Minimum sweep time',
        Number.isFinite(result.sweepTimeTotal)
          ? `≈ ${seconds(result.sweepTimeTotal)}` + (result.overheadTime > 0 && Number.isFinite(result.sweepTime) ? ` · ${seconds(result.sweepTime)} dwell + ${seconds(result.overheadTime)} overhead` : '')
          : 'Enter IF bandwidth') +
      metric('Log sweep, same coverage', `${result.log.finePoints} points at the finest Δf/f (${fmt(result.log.fine * 100)} %)`) +
      metric('Log sweep, coarsest', `${result.log.coarsePoints} points at ${fmt(result.log.coarse * 100)} %`);
  }
  // The floor follows the sweep's IF bandwidth; without one there is nothing to place it at.
  function computeNoise() {
    noise = null;
    const status = $('noise-status'), metrics = $('noise-metrics');
    const ifbw = $('ifbw').value.trim() === '' ? null : readHz($('ifbw'));
    const blankRef = $('nf-ref').value.trim() === '', blankSignal = $('nf-signal').value.trim() === '';
    const averages = $('nf-avg').value.trim() === '' ? 1 : Bench.read('nf-avg');
    if (blankRef) { status.textContent = 'Enter the datasheet floor to place the noise floor.'; status.className = ''; metrics.replaceChildren(); return true; }
    if (ifbw === null) { status.textContent = 'Enter an IF bandwidth above to place the noise floor.'; status.className = ''; metrics.replaceChildren(); return true; }
    noise = RF.noiseFloor({ floorRef: Bench.read('nf-ref'), ifbwRef: readHz($('nf-ref-bw')), ifbw, averages, signal: blankSignal ? NaN : Bench.read('nf-signal') });
    if (!noise || (!blankSignal && !Number.isFinite(noise.signal)) || !Number.isInteger(averages)) {
      noise = null; status.textContent = 'The floor needs a finite level at a positive bandwidth, a whole-number averaging factor of 1 or more, and a finite receiver level if one is given.';
      status.className = 'status-error'; metrics.replaceChildren(); return false;
    }
    const tiles = [metric('Noise floor at this IF bandwidth', `${fmt(noise.floor, 'dBm')} dBm` + (noise.averages > 1 ? ` · ${noise.averages} averages` : ''))];
    if (noise.snr !== null) {
      const low = noise.snr < 20;
      tiles.push(metric('Margin above the floor', `<span class="${low ? 'over-limit' : ''}">${fmt(noise.snr, 'dB')} dB</span> at ${fmt(noise.signal, 'dBm')} dBm`),
        metric('Trace noise', `${fmt(noise.traceNoiseDb, 'dB')} dB rms · ${fmt(noise.traceNoiseDeg, 'deg')}° rms`),
        metric('IF bandwidth for 20 dB margin', noise.ifbwFor(20) >= noise.ifbw ? `up to ${freq(noise.ifbwFor(20))}` : `<span class="over-limit">${freq(noise.ifbwFor(20))}, narrower than set</span>`));
      status.className = low ? 'over-limit' : '';
      status.textContent = low ? `Only ${fmt(noise.snr, 'dB')} dB above the floor: expect about ${fmt(noise.traceNoiseDb, 'dB')} dB of trace noise. Narrow the IF bandwidth or add averaging.` : '';
    } else { status.textContent = ''; status.className = ''; }
    if (result && Number.isFinite(result.sweepTimeTotal) && noise.averages > 1) tiles.push(metric('Sweep time with averaging', `≈ ${seconds(result.sweepTimeTotal * noise.averages)} for ${noise.averages} sweeps`));
    metrics.innerHTML = tiles.join('');
    return true;
  }
  function computePower() {
    const start = Bench.read('p-start'), stop = Bench.read('p-stop');
    power = powerSource === 'points' ? RF.sweepStep(start, stop, Bench.read('p-points')) : RF.sweepPoints(start, stop, Bench.read('p-step'));
    if (!power) {
      $('power-status').textContent = 'Enter start ≤ stop in dBm with a positive step, or a whole number of points (2 or more).';
      $('power-status').className = 'status-error'; $('power-metrics').replaceChildren(); return;
    }
    if (powerSource !== 'step') Bench.setNumber('p-step', power.step, 'dB', true);
    if (powerSource !== 'points') Bench.setNumber('p-points', power.points, '', true);
    $('power-status').className = power.exact ? '' : 'over-limit';
    $('power-status').textContent = power.exact ? '' : `The step does not divide the span: ${power.points} points end at ${fmt(power.lastPoint, 'dBm')} dBm. Use ${fmt(power.stepCeil, 'dB')} dB for ${power.pointsCeil} points ending at the stop.`;
    $('power-metrics').innerHTML = metric('Points', String(power.points), 'primary') + metric('Step', `${fmt(power.step, 'dB')} dB`) +
      metric('Span', `${fmt(power.span, 'dB')} dB`) + metric('Last point', `${fmt(power.lastPoint, 'dBm')} dBm`);
  }
  function compute() {
    computeSweep(); computePower();
    const noiseOk = computeNoise();
    const valid = Boolean(result && power && noiseOk);
    const lines = valid ? [
      'Linear segments with equal steps. Points include both ends. A step that divides the span lands exactly on the stop frequency.',
      ...result.rows.flatMap((r, i) => [`Segment ${i + 1}: ${freq(r.start)} to ${freq(r.stop)} in ${freq(r.step)} steps.`,
        eq(`Segment ${i + 1} points`, String.raw`N_{${i + 1}} &= \frac{f_{\mathrm{stop}}-f_{\mathrm{start}}}{\Delta f}+1`, tex(r.points), String.raw`\frac{${tex(r.stop, 'Hz', false)}-${tex(r.start, 'Hz', false)}}{${tex(r.step, 'Hz', false)}}+1`),
        eq(`Segment ${i + 1} relative spacing`, String.raw`\frac{\Delta f}{f_{\mathrm{start}}} &= ${tex(r.fractionalStart * 100, '%')} \\ \frac{\Delta f}{f_{\mathrm{stop}}} &= ${tex(r.fractionalStop * 100, '%')}`),
        eq(`Segment ${i + 1} points per decade`, String.raw`D &= \frac{1}{\log_{10}(1+\Delta f/f)}`, String.raw`${tex(r.pointsPerDecadeStart)}\text{ at start},\ ${tex(r.pointsPerDecadeStop)}\text{ at stop}`),
        eq(`Segment ${i + 1} average points per decade`, String.raw`\bar D &= \frac{N}{\log_{10}(f_{\mathrm{next}}/f_{\mathrm{start}})}`, tex(r.decadePoints))]),
      ...result.boundaries.flatMap(b => [eq(`Boundary at ${freq(b.frequency)}`, String.raw`\frac{\Delta f_{${b.index + 1}}}{\Delta f_{${b.index}}} &= ${tex(b.stepRatio)} \\ \frac{(\Delta f/f_{\mathrm{start}})_{${b.index + 1}}}{(\Delta f/f_{\mathrm{start}})_{${b.index}}} &= ${tex(b.patternRatio)} \\ f_{\mathrm{start},${b.index + 1}}-f_{\mathrm{last},${b.index}} &= ${tex(b.gap, 'Hz')}`),
        b.sharp ? `${mode === 'relative' ? 'Relative spacing pattern' : 'Step size'} changes by more than ${fmt(result.jumpLimit)}× at ${freq(b.frequency)}.` : '']),
      eq('Total points', String.raw`N &= \sum_i N_i`, tex(result.points), result.rows.map(r => tex(r.points)).join('+')),
      result.ifbw === null ? 'Enter an IF bandwidth to estimate the sweep time.' : eq('Sweep time', String.raw`t &\approx \frac{N}{\mathrm{IFBW}} + N t_{\mathrm{point}} + S t_{\mathrm{seg}}`, tex(result.sweepTimeTotal, 's'), String.raw`\frac{${tex(result.points)}}{${tex(result.ifbw, 'Hz', false)}}+${tex(result.points)}(${tex(result.pointOverhead, 's', false)})+${tex(result.rows.length)}(${tex(result.segmentOverhead, 's', false)})\,\mathrm s`),
      eq('Log sweep with the same relative spacing', String.raw`N_{\log} &= \left\lceil\frac{\ln(f_{\mathrm{last}}/f_{\mathrm{first}})}{\ln(1+r)}\right\rceil+1`, String.raw`${tex(result.log.finePoints)}\text{ for } r=${tex(result.log.fine)},\ ${tex(result.log.coarsePoints)}\text{ for } r=${tex(result.log.coarse)}`),
      `Boundaries are compared by ${mode === 'relative' ? 'relative step at each segment start, which is smooth for a repeating decade pattern' : 'absolute step size'}.`,
      'Sweep time excludes band crossings, source settling, and dwell. Instrument segment limits, point limits, and IF bandwidth per segment are set on the analyzer.',
      eq('Power sweep points', String.raw`N_{P} &= \frac{P_{\mathrm{stop}}-P_{\mathrm{start}}}{\Delta P}+1`, tex(power.points), String.raw`\frac{${tex(power.stop, 'dBm', false)}-(${tex(power.start, 'dBm', false)})}{${tex(power.step, 'dB', false)}}+1`),
      ...(noise ? [
        eq('Noise floor at the working IF bandwidth', String.raw`P_{\mathrm{floor}} &= P_{\mathrm{ref}} + 10\log_{10}\frac{\mathrm{IFBW}}{\mathrm{IFBW}_{\mathrm{ref}}} - 10\log_{10}N`, tex(noise.floor, 'dBm'),
          String.raw`${tex(noise.floorRef, 'dBm', false)} + 10\log_{10}\frac{${tex(noise.ifbw, 'Hz', false)}}{${tex(noise.ifbwRef, 'Hz', false)}} - 10\log_{10}${tex(noise.averages)}\,\mathrm{dBm}`),
        ...(noise.snr !== null ? [
          eq('Margin above the floor', String.raw`\mathrm{SNR} &= P_{\mathrm{rx}} - P_{\mathrm{floor}}`, tex(noise.snr, 'dB'), String.raw`${tex(noise.signal, 'dBm', false)} - (${tex(noise.floor, 'dBm', false)})\,\mathrm{dB}`),
          eq('Trace noise from the in-phase noise component', String.raw`\sigma_{\mathrm{dB}} &\approx \frac{20}{\ln 10}\cdot\frac{10^{-\mathrm{SNR}/20}}{\sqrt 2} \\ \sigma_{\phi} &\approx \frac{180}{\pi}\cdot\frac{10^{-\mathrm{SNR}/20}}{\sqrt 2}`,
            String.raw`${tex(noise.traceNoiseDb, 'dB')}\ \text{rms},\ ${tex(noise.traceNoiseDeg, 'deg')}\ \text{rms}`),
          eq('Widest IF bandwidth for a 20 dB margin', String.raw`\mathrm{IFBW}_{20} &= \mathrm{IFBW}_{\mathrm{ref}}\,N\,10^{(P_{\mathrm{rx}} - P_{\mathrm{ref}} - 20)/10}`, tex(noise.ifbwFor(20), 'Hz'))] : []),
        'The floor scales as white noise in the IF filter and averaging is treated as coherent, so N sweeps buy 10 log10 N. Real receivers add a fixed residual at the narrowest bandwidths, and the datasheet figure is typically a specification at one frequency range.'
      ] : ['Enter the datasheet floor and an IF bandwidth to place the noise floor.'])
    ] : ['Correct the sweep inputs before calculating or saving.'];
    Bench.update({ valid, lines });
    if (valid) writeQuery();
  }
  $('segments').addEventListener('input', event => {
    const key = event.target.dataset.key, el = event.target.closest('[data-index]');
    if (!key || !el) return;
    const s = segments[Number(el.dataset.index)];
    if (key === 'enabled') {
      s.enabled = event.target.checked;
      el.classList.toggle('is-off', !s.enabled);
    } else if (key.endsWith('Unit')) {
      // The digits stay and the new unit decides what they mean, as everywhere else here.
      const base = key.slice(0, -4);
      s[key] = event.target.value;
      s[base] = RF.frequencyDigits(s[base]);
      const input = el.querySelector('[data-key="' + base + '"]');
      if (input) input.value = s[base];
    } else {
      s[key] = event.target.value;
    }
    loadError = ''; compute();
  });
  $('segments').addEventListener('click', event => {
    const el = event.target.closest('[data-index]');
    if (!el || event.target.dataset.action !== 'remove' || segments.length === 1) return;
    segments.splice(Number(el.dataset.index), 1); loadError = ''; renderSegments(); compute();
  });
  $('add-segment').addEventListener('click', () => {
    if (segments.length >= 100) return;
    const last = segments[segments.length - 1];
    segments.push(segment(last.stop, segmentUnit(last, 'stopUnit'), '', segmentUnit(last, 'stopUnit'), last.step, segmentUnit(last, 'stepUnit'))); loadError = ''; renderSegments(); compute();
    const added = $('segments').lastElementChild.querySelector('[data-key="stop"]'); if (added) added.focus();
  });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    segments = PRESETS[b.dataset.preset].map(s => ({ ...s })); loadError = ''; renderSegments(); compute();
  }));
  ['mode', 'limit', 'ifbw', 'jump', 'nf-ref', 'nf-avg', 'nf-signal'].concat(overheadIds, overheadIds.map(id => id + '-unit'))
    .forEach(id => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => { loadError = ''; compute(); }));
  frequencyIds.forEach(bindUnit);
  ['g-start', 'g-stop', 'g-mult', 'g-tail', 'g-tail-step'].forEach(id => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => { $('generate-status').textContent = ''; if (Bench.valid) writeQuery(); }));
  $('generate').addEventListener('click', () => {
    const tailBlank = $('g-tail').value.trim() === '';
    const table = RF.logTable(readHz($('g-start')), readHz($('g-stop')), Number($('g-mult').value),
      tailBlank ? NaN : readHz($('g-tail')), tailBlank ? NaN : readHz($('g-tail-step')));
    if (!table) { $('generate-status').textContent = 'Enter start < stop, and if a tail is used, a tail start between them with a positive tail step.'; $('generate-status').className = 'status-error'; return; }
    segments = table.map(row => {
      const parts = ['start', 'stop', 'step'].map(key => RF.formatFrequency(row[key]));
      return segment(String(parts[0].value), parts[0].unit, String(parts[1].value), parts[1].unit, String(parts[2].value), parts[2].unit);
    }); loadError = '';
    $('generate-status').className = ''; $('generate-status').textContent = `Generated ${table.length} segment${table.length === 1 ? '' : 's'}.`;
    renderSegments(); compute();
  });
  ['p-start', 'p-stop'].forEach(id => $(id).addEventListener('input', compute));
  $('p-step').addEventListener('input', () => { powerSource = 'step'; compute(); });
  $('p-points').addEventListener('input', () => { powerSource = 'points'; compute(); });
  $('copy-link').addEventListener('click', () => { if (Bench.valid) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => {
    if (!Bench.valid) return;
    Bench.copy(`Frequency sweep | ${result.points} points | ${freq(result.first)} → ${freq(result.last)}\n` +
      result.rows.map((r, i) => `Segment ${active[i].i + 1}: ${freq(r.start)} → ${freq(r.stop)} step ${freq(r.step)} = ${r.points} points${r.exact ? '' : ' (ends at ' + freq(r.lastPoint) + ')'}`).join('\n') +
      (result.boundaries.length ? '\n' + result.boundaries.map(b => `Boundary ${freq(b.frequency)}: ${boundaryText(b)}, step ratio ${fmt(b.stepRatio)}×, Δf/f-at-start ratio ${fmt(b.patternRatio)}×${b.sharp ? ' (flagged)' : ''}`).join('\n') : '') +
      `\nPower sweep | ${fmt(power.start, 'dBm')} → ${fmt(power.stop, 'dBm')} dBm step ${fmt(power.step, 'dB')} dB = ${power.points} points` +
      (noise ? `\nNoise floor | ${fmt(noise.floor, 'dBm')} dBm at ${freq(noise.ifbw)} IFBW, ${noise.averages} average${noise.averages === 1 ? '' : 's'}` +
        (noise.snr !== null ? ` | ${fmt(noise.snr, 'dB')} dB margin at ${fmt(noise.signal, 'dBm')} dBm | trace noise ${fmt(noise.traceNoiseDb, 'dB')} dB rms` : '') : ''));
  });
  document.addEventListener('dut-change', () => { labelPresets(); rangeFromCard(); $('generate-status').textContent = ''; compute(); });
  Dut.describe('the operating range: the linear tail and stop of the generated table, the wide preset, and the coverage check on the segment table');
  readQuery(); labelPresets(); renderSegments(); compute();
})();
