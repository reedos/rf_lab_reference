const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./helpers/controller.cjs');
const near = (a, b) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-12, `${a} != ${b}`);

test('power controller agrees with loaded sine-wave voltage in both directions and topologies', () => {
  for (const drive of ['se', 'diff']) for (const direction of ['src', 'rx']) {
    const page = boot('index', `#?m=${drive}&dir=${direction}&zd=75&from=dbm&d=0`);
    const rms = direction === 'rx' ? Math.sqrt(.001 * 50) : 2 * Math.sqrt(.001 * 50) * 75 / 125;
    near(page.read('vopp'), rms * 2 * Math.SQRT2 * (drive === 'diff' ? 2 : 1));
    assert.equal(page.valid, true);
    const reload = boot('index', page.url);
    assert.equal(reload.get('metrics').innerHTML, page.get('metrics').innerHTML);
  }
});

test('power voltage units distinguish a driver from a solved field, including zero volts', () => {
  const page = boot('index', '#?m=se&dir=src&zd=50');
  const initialVolts = page.read('vopp'); page.edit('vopp-unit', 'mV');
  near(page.read('vopp'), initialVolts * 1000);
  near(page.read('dbm'), 0);
  page.edit('vopp', '100'); page.edit('vopp-unit', 'V');
  near(page.read('vopp'), 100);
  near(page.read('dbm'), 10 * Math.log10((100 / (2 * Math.SQRT2)) ** 2 / 50 / .001));
  page.edit('vopp', '0');
  assert.equal(page.valid, true); assert.equal(page.read('dbm'), -Infinity);
  const reload = boot('index', page.url);
  assert.equal(reload.valid, true); assert.equal(reload.read('vopp'), 0);
  page.edit('vopp', '-1');
  assert.equal(page.valid, false); assert.equal(page.get('ref-body').innerHTML, '');
});

test('gain topology changes preserve per-line impedance and scalar links preserve precision', () => {
  const page = boot('gain', '#?t=dd');
  page.edit('z1', '120.123456789'); page.edit('z2', '160.987654321');
  page.click('topology', 'sd');
  near(page.read('z1'), 120.123456789); near(page.read('z2'), 80.4938271605);
  page.click('topology', 'ds');
  near(page.read('z1'), 60.0617283945); near(page.read('z2'), 160.987654321);
  page.edit('s11-db', -10); page.edit('s11-deg', 90);
  assert.equal(page.valid, true);
  const reload = boot('gain', page.url);
  assert.equal(reload.get('metrics').innerHTML, page.get('metrics').innerHTML);
  near(reload.dut.get().zin, 60.0617283945); near(reload.dut.get().zout, 80.4938271605);
});

test('gain rejects incomplete reflection and invalid impedance without retaining solved metrics', () => {
  const page = boot('gain'); page.edit('s11-db', -10);
  assert.equal(page.valid, false); assert.equal(page.get('metrics').innerHTML, '');
  page.edit('s11-deg', 90); assert.equal(page.valid, true);
  page.edit('z1', -1);
  assert.equal(page.valid, false); assert.equal(page.get('metrics').innerHTML, '');
  assert.equal(page.get('gain-equation').textContent, '');
});

test('delay units and driver links retain exact propagation and phase slope', () => {
  const page = boot('delay'); page.edit('er', 4); page.edit('freq', 1); page.edit('freq-unit', 'GHz');
  page.edit('length', 100); page.edit('len-unit', 'mm');
  near(page.read('delay') * 1e-9, .1 * 2 / 299792458);
  near(page.read('degrees'), 360 * 1e9 * .1 * 2 / 299792458);
  page.edit('delay-unit', 'ps');
  near(page.read('delay'), .1 * 2 / 299792458 * 1e12);
  page.edit('degrees', '90.123456789');
  const reload = boot('delay', page.url);
  assert.equal(reload.get('metrics').innerHTML, page.get('metrics').innerHTML);
  assert.equal(reload.read('degrees'), 90.123456789);
  page.edit('phase-f1', 1000); page.edit('phase-f2', 1100);
  page.edit('phase-p1', 0); page.edit('phase-p2', -72); page.edit('phase-turns', 0);
  page.edit('phase-mode', 'reflection'); page.click('phase-use');
  near(page.read('length'), .149896229 * 1000);
});

test('delay invalid line inputs clear dependent slope and skew; negative slope cannot be applied', () => {
  const page = boot('delay'); page.edit('phase-p2', 36); page.edit('phase-p1', 0); page.edit('phase-turns', 0);
  assert.equal(page.get('phase-use').disabled, true);
  assert.match(page.get('phase-status').textContent, /Negative delay/);
  page.edit('er', 'bad');
  assert.equal(page.valid, false);
  assert.equal(page.get('phase-metrics').innerHTML, ''); assert.equal(page.get('skew-metrics').innerHTML, '');
  assert.equal(page.get('copy-link').disabled, true);
});

test('power-chain links restore stages and units and invalid inputs clear every dependent panel', () => {
  const stages = [{ name: 'Input', kind: 'passive', db: '3', temperature: '290', nf: '0', limit: '' },
    { name: 'Amplifier', kind: 'active', db: '20', temperature: '290', nf: '2', limit: '10' }];
  const query = new URLSearchParams({ stages: JSON.stringify(stages), 'source-power': '-20.123456789', bandwidth: '1.23456789', 'bandwidth-unit': 'MHz' });
  const page = boot('chain', '#?' + query);
  assert.equal(page.valid, true);
  const reload = boot('chain', page.url);
  for (const id of ['power-rows', 'noise-rows', 'noise-metrics', 'budget-metrics']) assert.equal(reload.get(id).innerHTML, page.get(id).innerHTML);
  page.edit('bandwidth', -1);
  assert.equal(page.valid, false);
  for (const id of ['power-path', 'power-rows', 'noise-rows', 'noise-bars', 'noise-metrics', 'budget-metrics']) assert.equal(page.get(id).innerHTML, '');
});

test('malformed stage links cannot silently substitute the example calculation', () => {
  const page = boot('chain', '#?stages=broken');
  assert.equal(page.valid, false); assert.match(page.get('chain-status').textContent, /could not be read/);
  assert.equal(page.get('noise-metrics').innerHTML, '');
  page.edit('source-power', -10); assert.equal(page.valid, true);
});
