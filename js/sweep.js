(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id);
  const fmt = RF.formatNumber, freq = hz => RF.formatFrequency(hz).text;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric = (label, value) => `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  const scales = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
  const PRESETS = {
    wide: [{ start: '100 MHz', stop: '10 GHz', step: '10 MHz' }],
    decades: [
      { start: '10 kHz', stop: '90 kHz', step: '10 kHz' }, { start: '100 kHz', stop: '900 kHz', step: '100 kHz' },
      { start: '1 MHz', stop: '9 MHz', step: '1 MHz' }, { start: '10 MHz', stop: '90 MHz', step: '10 MHz' },
      { start: '100 MHz', stop: '10 GHz', step: '100 MHz' }]
  };
  const optionIds = ['unit', 'mode', 'limit', 'ifbw', 'jump', 'g-start', 'g-stop', 'g-mult', 'g-tail', 'g-tail-step', 'p-start', 'p-stop', 'p-step', 'p-points'];
  let segments = PRESETS.wide.map(s => ({ ...s })), powerSource = 'step', result = null, power = null, loadError = '';
  function readQuery() {
    const q = new URLSearchParams(location.search);
    for (const id of optionIds) if (q.has(id)) {
      const el = $(id), value = q.get(id);
      if (el.tagName !== 'SELECT' || Array.from(el.options).some(o => o.value === value)) el.value = value;
    }
    if (q.get('pfrom') === 'points') powerSource = 'points';
    if (q.has('segments')) {
      try {
        const data = JSON.parse(q.get('segments'));
        if (!Array.isArray(data) || !data.length || data.length > 100 ||
            !data.every(s => s && ['start', 'stop', 'step'].every(key => typeof s[key] === 'string' && s[key].length <= 40))) throw new Error();
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
    $('segments').innerHTML = segments.map((s, i) => `<div class="segment" data-index="${i}" role="group" aria-label="Segment ${i + 1}"><span class="segment-index">${i + 1}</span>
      <label>Start<input data-key="start" value="${escape(s.start)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Segment ${i + 1} start frequency"></label>
      <label>Stop<input data-key="stop" value="${escape(s.stop)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Segment ${i + 1} stop frequency"></label>
      <label>Step<input data-key="step" value="${escape(s.step)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Segment ${i + 1} step"></label>
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
    if (b.kind === 'gap') return `Gap of ${freq(b.gap)} (wider than either step)`;
    return `Contiguous, ${freq(b.gap)} to next point`;
  }
  function invalidSweep(message) {
    result = null;
    $('sweep-status').textContent = message; $('sweep-status').className = 'status-error';
    ['sweep-rows', 'boundary-rows', 'sweep-metrics'].forEach(id => $(id).replaceChildren());
  }
  function computeSweep() {
    if (loadError) return invalidSweep(loadError);
    const scale = scales[$('unit').value];
    const parsed = segments.map(s => ({ start: RF.parseFrequency(s.start, scale), stop: RF.parseFrequency(s.stop, scale), step: RF.parseFrequency(s.step, scale) }));
    const limitBlank = $('limit').value.trim() === '', ifbwBlank = $('ifbw').value.trim() === '';
    const maxPoints = limitBlank ? null : Bench.read('limit'), ifbw = ifbwBlank ? null : RF.parseFrequency($('ifbw').value, 1), jumpLimit = Bench.read('jump'), mode = $('mode').value;
    if ((maxPoints !== null && !(Number.isInteger(maxPoints) && maxPoints > 0)) || (ifbw !== null && !(ifbw > 0)) || !(jumpLimit > 1)) {
      return invalidSweep('Point limit must be a positive whole number, IF bandwidth positive, and the step-ratio flag above 1.');
    }
    result = RF.segmentedSweep(parsed, { maxPoints, ifbw, jumpLimit, mode });
    if (!result) return invalidSweep('Each segment needs a positive start, a stop at or above it, and a positive step. Use a unit or SI prefix such as 10k, 100 MHz, or 2.4G.');
    const sharp = result.boundaries.filter(b => b.sharp).length, broken = result.boundaries.filter(b => b.kind !== 'contiguous').length;
    const notes = [];
    if (result.inexact) notes.push(`${result.inexact} segment${result.inexact === 1 ? '' : 's'} do not land on the stop frequency`);
    if (broken) notes.push(`${broken} boundar${broken === 1 ? 'y has' : 'ies have'} a gap, overlap, or duplicate point`);
    if (sharp) notes.push(`${sharp} boundar${sharp === 1 ? 'y changes' : 'ies change'} ${mode === 'relative' ? 'the relative step Δf/f at the segment start' : 'the step size'} by more than ${fmt(result.jumpLimit)}×`);
    if (result.headroom !== null && result.headroom < 0) notes.push(`the total exceeds the ${result.maxPoints}-point limit by ${-result.headroom}`);
    $('sweep-status').className = notes.length ? 'over-limit' : '';
    $('sweep-status').textContent = notes.length ? `Check: ${notes.join('; ')}.` : `Segments are contiguous, ${mode === 'relative' ? 'repeat their relative spacing pattern' : 'change step size evenly'}, and land exactly on their stop frequencies.`;
    $('sweep-rows').innerHTML = result.rows.map((r, i) => `<tr class="${r.exact ? '' : 'over-limit'}"><td>${i + 1}</td><td>${freq(r.start)}</td><td>${freq(r.stop)}</td><td>${freq(r.step)}</td><td>${r.points}</td><td>${freq(r.lastPoint)}${r.exact ? '' : ` · use ${freq(r.stepCeil)} for ${r.pointsCeil} points`}</td><td>${fmt(r.fractionalStart * 100)} → ${fmt(r.fractionalStop * 100)} %</td><td>${fmt(r.decadePoints)}</td><td>${fmt(r.pointsPerDecadeStart)} → ${fmt(r.pointsPerDecadeStop)}</td></tr>`).join('');
    $('boundary-rows').innerHTML = result.boundaries.length ? result.boundaries.map(b => `<tr class="${b.sharp || b.kind !== 'contiguous' ? 'over-limit' : ''}"><td>${freq(b.frequency)}</td><td>${boundaryText(b)}</td><td class="${mode === 'absolute' && b.sharp ? 'over-limit' : ''}">${fmt(b.stepRatio)}×</td><td class="${mode === 'relative' && b.sharp ? 'over-limit' : ''}">${fmt(b.patternRatio)}×</td><td>${b.sharp ? (mode === 'relative' ? 'Pattern change' : 'Sharp step change') : b.kind !== 'contiguous' ? 'Fix boundary' : 'OK'}</td></tr>`).join('')
      : '<tr><td colspan="5">One segment: no boundaries to check.</td></tr>';
    $('sweep-metrics').innerHTML = metric('Total points', String(result.points)) + metric('Span', `${freq(result.first)} → ${freq(result.last)}`) +
      metric('Points per decade', result.decadePoints.min === result.decadePoints.max ? fmt(result.decadePoints.min) : `${fmt(result.decadePoints.min)} to ${fmt(result.decadePoints.max)} by segment`) +
      metric('Point limit', result.maxPoints === null ? 'None specified' : `${result.maxPoints} · ${result.headroom >= 0 ? `${result.headroom} spare` : `<span class="over-limit">${-result.headroom} over</span>`}`) +
      metric('Minimum sweep time', result.ifbw === null ? 'Enter IF bandwidth' : `≈ ${seconds(result.sweepTime)}`) +
      metric('Log sweep, same coverage', `${result.log.finePoints} points at the finest Δf/f (${fmt(result.log.fine * 100)} %)`) +
      metric('Log sweep, coarsest', `${result.log.coarsePoints} points at ${fmt(result.log.coarse * 100)} %`);
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
    $('power-metrics').innerHTML = metric('Points', String(power.points)) + metric('Step', `${fmt(power.step, 'dB')} dB`) +
      metric('Span', `${fmt(power.span, 'dB')} dB`) + metric('Last point', `${fmt(power.lastPoint, 'dBm')} dBm`);
  }
  function compute() {
    computeSweep(); computePower();
    const valid = Boolean(result && power);
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
      result.ifbw === null ? 'Enter an IF bandwidth to estimate the minimum sweep time.' : eq('Minimum sweep time', String.raw`t_{\min} &\approx \frac{N}{\mathrm{IFBW}}`, tex(result.sweepTime, 's'), String.raw`\frac{${tex(result.points)}}{${tex(result.ifbw, 'Hz', false)}}\,\mathrm s`),
      eq('Log sweep with the same relative spacing', String.raw`N_{\log} &= \left\lceil\frac{\ln(f_{\mathrm{last}}/f_{\mathrm{first}})}{\ln(1+r)}\right\rceil+1`, String.raw`${tex(result.log.finePoints)}\text{ for } r=${tex(result.log.fine)},\ ${tex(result.log.coarsePoints)}\text{ for } r=${tex(result.log.coarse)}`),
      `Boundaries are compared by ${mode === 'relative' ? 'relative step at each segment start, which is smooth for a repeating decade pattern' : 'absolute step size'}.`,
      'Sweep time excludes band crossings, source settling, and dwell. Instrument segment limits, point limits, and IF bandwidth per segment are set on the analyzer.',
      eq('Power sweep points', String.raw`N_{P} &= \frac{P_{\mathrm{stop}}-P_{\mathrm{start}}}{\Delta P}+1`, tex(power.points), String.raw`\frac{${tex(power.stop, 'dBm', false)}-(${tex(power.start, 'dBm', false)})}{${tex(power.step, 'dB', false)}}+1`)
    ] : ['Correct the sweep inputs before calculating or saving.'];
    Bench.update({ valid, lines });
    if (valid) writeQuery();
  }
  $('segments').addEventListener('input', event => {
    const key = event.target.dataset.key, el = event.target.closest('[data-index]');
    if (!key || !el) return;
    segments[Number(el.dataset.index)][key] = event.target.value; loadError = ''; compute();
  });
  $('segments').addEventListener('click', event => {
    const el = event.target.closest('[data-index]');
    if (!el || event.target.dataset.action !== 'remove' || segments.length === 1) return;
    segments.splice(Number(el.dataset.index), 1); loadError = ''; renderSegments(); compute();
  });
  $('add-segment').addEventListener('click', () => {
    if (segments.length >= 100) return;
    const last = segments[segments.length - 1];
    segments.push({ start: last.stop, stop: '', step: last.step }); loadError = ''; renderSegments(); compute();
    const added = $('segments').lastElementChild.querySelector('[data-key="stop"]'); if (added) added.focus();
  });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    segments = PRESETS[b.dataset.preset].map(s => ({ ...s })); loadError = ''; renderSegments(); compute();
  }));
  ['unit', 'mode', 'limit', 'ifbw', 'jump'].forEach(id => $(id).addEventListener(['unit', 'mode'].includes(id) ? 'change' : 'input', () => { loadError = ''; compute(); }));
  ['g-start', 'g-stop', 'g-mult', 'g-tail', 'g-tail-step'].forEach(id => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => { $('generate-status').textContent = ''; if (Bench.valid) writeQuery(); }));
  $('generate').addEventListener('click', () => {
    const scale = scales[$('unit').value], tailBlank = $('g-tail').value.trim() === '';
    const table = RF.logTable(RF.parseFrequency($('g-start').value, scale), RF.parseFrequency($('g-stop').value, scale), Number($('g-mult').value),
      tailBlank ? NaN : RF.parseFrequency($('g-tail').value, scale), tailBlank ? NaN : RF.parseFrequency($('g-tail-step').value, scale));
    if (!table) { $('generate-status').textContent = 'Enter start < stop, and if a tail is used, a tail start between them with a positive tail step.'; $('generate-status').className = 'status-error'; return; }
    segments = table.map(s => ({ start: freq(s.start), stop: freq(s.stop), step: freq(s.step) })); loadError = '';
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
      result.rows.map((r, i) => `Segment ${i + 1}: ${freq(r.start)} → ${freq(r.stop)} step ${freq(r.step)} = ${r.points} points${r.exact ? '' : ' (ends at ' + freq(r.lastPoint) + ')'}`).join('\n') +
      (result.boundaries.length ? '\n' + result.boundaries.map(b => `Boundary ${freq(b.frequency)}: ${boundaryText(b)}, step ratio ${fmt(b.stepRatio)}×, Δf/f-at-start ratio ${fmt(b.patternRatio)}×${b.sharp ? ' (flagged)' : ''}`).join('\n') : '') +
      `\nPower sweep | ${fmt(power.start, 'dBm')} → ${fmt(power.stop, 'dBm')} dBm step ${fmt(power.step, 'dB')} dB = ${power.points} points`);
  });
  readQuery(); renderSegments(); compute();
})();
