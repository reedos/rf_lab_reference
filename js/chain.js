(function () {
  'use strict';
  const eq = Bench.equation, tex = Bench.tex;
  const $ = id => document.getElementById(id), n = id => Bench.read(id);
  const fmt = RF.formatNumber, dbm = v => RF.formatDbm(v) + ' dBm';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric = (label, value) => `<div class="metric"><dt>${label}</dt><dd>${value}</dd></div>`;
  const scales = { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 };
  let bandwidthUnit = $('bandwidth-unit').value, result = null, loadError = '';
  let stages = [
    { name: 'DUT input · cable + pad', kind: 'passive', db: '3', temperature: '290', nf: '0', limit: '0' },
    { name: 'DUT output · amplifier', kind: 'active', db: '20', nf: '2', temperature: '290', limit: '10' },
    { name: 'Receiver · output pad', kind: 'passive', db: '6', temperature: '290', nf: '0', limit: '0' }
  ];
  function readQuery() {
    const q = new URLSearchParams(location.search);
    for (const id of ['source-power','bandwidth','source-temp']) if (q.has(id)) $(id).value = q.get(id);
    if (Object.hasOwn(scales, q.get('bandwidth-unit'))) $('bandwidth-unit').value = q.get('bandwidth-unit');
    bandwidthUnit = $('bandwidth-unit').value;
    if (q.has('stages')) {
      try {
        const data = JSON.parse(q.get('stages'));
        if (!Array.isArray(data) || data.length > 24 || !data.every(s => s && ['active','passive'].includes(s.kind) &&
            ['name','db','nf','temperature','limit'].every(key => typeof s[key] === 'string') && s.name.length <= 80)) throw new Error();
        stages = data;
      } catch (_) { loadError = 'This chain link could not be read. The example chain is shown; edit a value to start a new setup.'; }
    }
  }
  function writeQuery() {
    const q = new URLSearchParams();
    ['source-power','bandwidth','bandwidth-unit','source-temp'].forEach(id => q.set(id, Bench.raw(id)));
    q.set('stages', JSON.stringify(stages));
    history.replaceState(null, '', location.pathname + '?' + q);
  }
  function renderStages() {
    $('stages').innerHTML = stages.map((s, i) => `<section class="stage" data-index="${i}" aria-label="Stage ${i + 1}">
      <div class="stage-head"><strong>STAGE ${i + 1} · ${s.kind === 'passive' ? 'PASSIVE' : 'AMPLIFIER'}</strong><div class="stage-actions">
      <button class="ghost" type="button" data-action="up" aria-label="Move stage ${i + 1} up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="ghost" type="button" data-action="down" aria-label="Move stage ${i + 1} down" ${i === stages.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="ghost" type="button" data-action="remove" aria-label="Remove stage ${i + 1}">Remove</button></div></div><div class="work-fields">
      <label>Output connection<input data-key="name" maxlength="80" value="${escape(s.name)}" aria-label="Stage ${i + 1} output connection"></label>
      <label>${s.kind === 'passive' ? 'Loss (positive dB)' : 'Gain (dB)'}<input ${s.kind === 'passive' ? '' : 'data-signed '}placeholder="0" title="Blank is treated as zero dB" data-key="db" inputmode="decimal" value="${escape(s.db)}" aria-label="Stage ${i + 1} ${s.kind === 'passive' ? 'loss' : 'gain'}"></label>
      ${s.kind === 'passive' ? `<label>Physical temperature (K)<input data-key="temperature" inputmode="decimal" value="${escape(s.temperature)}" aria-label="Stage ${i + 1} temperature"></label>` : `<label>Noise figure (dB)<input data-key="nf" inputmode="decimal" value="${escape(s.nf)}" aria-label="Stage ${i + 1} noise figure"></label>`}
      <label>Limit at output (dBm, optional)<input data-signed data-key="limit" inputmode="decimal" value="${escape(s.limit)}" placeholder="No limit specified" aria-label="Stage ${i + 1} output limit"></label>
      </div></section>`).join('');
    $('add-active').disabled = $('add-passive').disabled = stages.length >= 24;
    Bench.enhance($('stages'));
  }
  function invalid(message) {
    result = null;
    $('chain-status').textContent = message; $('chain-status').className = 'status-error';
    ['power-path','power-rows','noise-rows','noise-bars','noise-metrics'].forEach(id => $(id).replaceChildren());
    Bench.update({ valid: false, lines: [message] });
  }
  function compute() {
    if (loadError) return invalid(loadError);
    const parsed = stages.map(s => ({ kind: s.kind, db: RF.parseZero(s.db), nf: RF.parseNumber(s.nf),
      temperature: RF.parseNumber(s.temperature), limit: s.limit.trim() === '' ? null : RF.parseNumber(s.limit) }));
    const bandwidth = n('bandwidth') * scales[$('bandwidth-unit').value], temperature = n('source-temp'), power = n('source-power');
    result = RF.cascade(parsed, power, bandwidth, temperature);
    if (!result) return invalid('Enter finite stage values, nonnegative passive loss/noise figure, and positive temperatures and bandwidth. Leave limits blank if unknown.');
    const exceeded = result.rows.filter(r => r.headroom !== null && r.headroom < 0).length;
    $('chain-status').className = exceeded ? 'over-limit' : '';
    $('chain-status').textContent = exceeded ? `${exceeded} connection${exceeded === 1 ? '' : 's'} exceed the specified CW signal-power limit.` :
      result.rows.some(r => r.headroom !== null) ? 'Estimated CW signal power is within the specified connection limits.' : 'No connection limits specified.';
    const node = (name, p, over) => `<div class="power-node ${over ? 'over-limit' : ''}"><span>${escape(name)}</span><strong>${dbm(p)}</strong></div>`;
    $('power-path').innerHTML = node('Source', power, false) + result.rows.map((r,i) => node(stages[i].name || `Stage ${i + 1}`, r.outputDbm, r.headroom !== null && r.headroom < 0)).join('');
    $('power-rows').innerHTML = result.rows.map((r, i) => `<tr class="${r.headroom !== null && r.headroom < 0 ? 'over-limit' : ''}"><td>${escape(stages[i].name || `Stage ${i + 1}`)}</td><td>${fmt(r.gainDb, 'dB')} dB</td><td>${dbm(r.outputDbm)}</td><td>${parsed[i].limit === null ? '—' : dbm(parsed[i].limit)}</td><td>${r.headroom === null ? 'Unspecified' : fmt(r.headroom, 'dB') + ' dB'}</td></tr>`).join('');
    $('noise-metrics').innerHTML = metric('Total gain', fmt(result.gainDb, 'dB') + ' dB') + metric('Cascaded noise figure', fmt(result.nf, 'dB') + ' dB') +
      metric('Equivalent input noise temp.', fmt(result.equivalentTemperature) + ' K') + metric('Input source noise', dbm(result.inputNoiseDbm)) +
      metric('Output noise', dbm(result.noiseDbm)) + metric('Output SNR', fmt(result.snr, 'dB') + ' dB');
    $('noise-rows').innerHTML = result.rows.map((r, i) => `<tr><td>${escape(stages[i].name || `Stage ${i + 1}`)}</td><td>${fmt(r.stageNf, 'dB')} dB</td><td>${fmt(r.nf, 'dB')} dB</td><td>${dbm(r.noiseDbm)}</td></tr>`).join('');
    const totalAdded = result.factor - 1;
    $('noise-bars').innerHTML = result.rows.map((r,i) => {
      const share = totalAdded > 0 ? r.contribution / totalAdded * 100 : 0;
      return `<div><div class="noise-bar-label"><span>${escape(stages[i].name || `Stage ${i + 1}`)}</span><span>${fmt(r.contribution * RF.T_REF)} K · ${fmt(share)}%</span></div><div class="noise-bar-track"><div class="noise-bar-fill" style="width:${Math.max(0,Math.min(100,share))}%"></div></div></div>`;
    }).join('') || '<p class="hint">No stages: only the input source noise is present.</p>';
    const lines = ['Matched stages at one frequency, small-signal CW power. Gains and noise figures are constant over equivalent noise bandwidth.',
      eq('Source conditions', String.raw`P_{\mathrm{src}} &= ${tex(power,'dBm')} \\ B &= ${tex(bandwidth,'Hz')} \\ T_{\mathrm{src}} &= ${tex(temperature,'K')} \\ T_0 &= 290\,\mathrm K`)];
    let previousGain = 1;
    result.rows.forEach((r,i) => {
      const s = parsed[i], f = 10 ** (r.stageNf / 10), g = 10 ** (r.gainDb / 10);
      lines.push(`Stage ${i + 1}: ${stages[i].name}`,
        eq('Output signal power', String.raw`P_{\mathrm{out},${i+1}} &= P_{\mathrm{src}}+\sum_{k=1}^{${i+1}}G_{k,\mathrm{dB}}`, tex(r.outputDbm,'dBm'), String.raw`${tex(power,'dBm',false)}+(${tex(r.cumulativeGainDb,'dB',false)})\,\mathrm{dBm}`),
        eq('Stage noise factor', s.kind === 'passive' ? String.raw`F_i &= 1+(10^{L_{i,\mathrm{dB}}/10}-1)\frac{T_i}{T_0}` : String.raw`F_i &= 10^{\mathrm{NF}_i/10}`, tex(f), s.kind === 'passive' ? String.raw`1+(10^{${tex(s.db,'dB',false)}/10}-1)\frac{${tex(s.temperature)}}{290}` : String.raw`10^{${tex(s.nf,'dB',false)}/10}`),
        eq('Linear power gain', String.raw`G_i &= 10^{G_{i,\mathrm{dB}}/10}`, tex(g)),
        eq('Added input noise factor', String.raw`\Delta F_i &= \frac{F_i-1}{\prod_{k<i}G_k}`, tex(r.contribution), String.raw`\frac{${tex(f)}-1}{${tex(previousGain)}}`));
      if (r.headroom !== null) lines.push(eq('Output headroom', String.raw`H_i &= P_{\mathrm{limit},i}-P_{\mathrm{out},i}`, tex(r.headroom,'dB'), String.raw`${tex(s.limit,'dBm',false)}-(${tex(r.outputDbm,'dBm',false)})\,\mathrm{dB}`));
      previousGain *= g;
    });
    lines.push('Cascade totals. Noise figure is referenced to 290 K; equivalent noise temperature is referred to the chain input.',
      eq('Friis noise factor', String.raw`F_{\mathrm{total}} &= 1+\sum_i\frac{F_i-1}{\prod_{k<i}G_k}`, tex(result.factor)),
      eq('Cascaded noise figure', String.raw`\mathrm{NF} &= 10\log_{10}F_{\mathrm{total}}`, tex(result.nf,'dB')),
      eq('Equivalent input noise temperature', String.raw`T_{\mathrm{eq}} &= (F_{\mathrm{total}}-1)T_0`, tex(result.equivalentTemperature,'K')),
      eq('Output noise power', String.raw`P_{\mathrm{n,out}} &= kB(T_{\mathrm{src}}+T_{\mathrm{eq}})G_{\mathrm{total}} \\ P_{\mathrm{n,out,dBm}} &= 10\log_{10}\frac{P_{\mathrm{n,out}}}{10^{-3}\,\mathrm W}`, tex(result.noiseDbm,'dBm')),
      eq('Output signal-to-noise ratio', String.raw`\mathrm{SNR}_{\mathrm{out}} &= P_{\mathrm{out,dBm}}-P_{\mathrm{n,out,dBm}}`, tex(result.snr,'dB'), String.raw`${tex(result.outputDbm,'dBm',false)}-(${tex(result.noiseDbm,'dBm',false)})\,\mathrm{dB}`),
      'Boltzmann constant k = 1.380649 × 10⁻²³ J/K. Linear gains and noise factors are power ratios.');
    Bench.update({ valid: true, lines }); writeQuery();
  }
  $('stages').addEventListener('input', event => {
    const key = event.target.dataset.key, el = event.target.closest('[data-index]');
    if (!key || !el) return;
    stages[Number(el.dataset.index)][key] = event.target.value; loadError = ''; compute();
  });
  $('stages').addEventListener('click', event => {
    const action = event.target.dataset.action, el = event.target.closest('[data-index]');
    if (!action || !el) return;
    const i = Number(el.dataset.index), next = action === 'up' ? i - 1 : i + 1;
    if (action === 'remove') stages.splice(i, 1);
    else if (next >= 0 && next < stages.length) [stages[i], stages[next]] = [stages[next], stages[i]];
    loadError = ''; renderStages(); compute();
  });
  ['passive','active'].forEach(kind => $('add-' + kind).addEventListener('click', () => {
    if (stages.length >= 24) return;
    stages.push({name:kind === 'passive' ? 'Passive output' : 'Amplifier output',kind,db:kind === 'passive' ? '3' : '10',nf:'2',temperature:'290',limit:''});
    loadError = ''; renderStages(); compute();
  }));
  ['source-power','bandwidth','source-temp'].forEach(id => $(id).addEventListener('input', () => { loadError = ''; compute(); }));
  $('bandwidth-unit').addEventListener('change', () => {
    const value = n('bandwidth');
    if (Number.isFinite(value)) Bench.setNumber('bandwidth', value * scales[bandwidthUnit] / scales[$('bandwidth-unit').value], $('bandwidth-unit').value, true);
    bandwidthUnit = $('bandwidth-unit').value; loadError = ''; compute();
  });
  $('copy-link').addEventListener('click', () => { if (result) Bench.copy(location.href); });
  $('copy-result').addEventListener('click', () => { if (result) Bench.copy(`CW power chain | Source ${dbm(n('source-power'))}\n` + result.rows.map((r,i) => `${stages[i].name}: ${dbm(r.outputDbm)}; limit ${stages[i].limit.trim() === '' ? 'unspecified' : dbm(RF.parseNumber(stages[i].limit))}; headroom ${r.headroom === null ? 'unspecified' : fmt(r.headroom, 'dB') + ' dB'}`).join('\n') + `\nGain ${fmt(result.gainDb, 'dB')} dB | NF ${fmt(result.nf, 'dB')} dB | B ${fmt(n('bandwidth'))} ${$('bandwidth-unit').value} | Tsource ${fmt(n('source-temp'))} K | Output noise ${dbm(result.noiseDbm)} | SNR ${fmt(result.snr, 'dB')} dB`); });
  readQuery(); renderStages(); compute();
})();
