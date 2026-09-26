const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./helpers/controller.cjs');

test('harmonic coverage says none when the fundamental is above the analyzer range', () => {
  const page = boot('large-signal', '#?tab=thd');
  page.edit('thd-f0', 2); page.edit('thd-fmax', 1);
  assert.equal(page.valid, true);
  assert.match(page.get('thd-band-metrics').innerHTML, /None; the fundamental is above the analyzer range/);
  assert.match(page.get('thd-status').textContent, /H1, H2, H3, H4, H5 above/);
  assert.doesNotMatch(page.get('thd-band-metrics').innerHTML, /<dd>H1<\/dd>/);
});

test('THD rejects supplied nonphysical frequencies instead of silently omitting corrections', () => {
  for (const [id, value] of [['thd-f0', 0], ['thd-f0', -1], ['thd-fmax', 0], ['thd-fmax', -1], ['thd-fc', 0], ['thd-fc', -1], ['thd-band-low', -1]]) {
    const page = boot('large-signal', '#?tab=thd');
    page.edit('thd-f0', 1); page.edit('thd-fmax', 10); page.edit('thd-fc', 2);
    page.edit('thd-band-low', .5); page.edit('thd-band-high', 1.5);
    assert.equal(page.valid, true);
    assert.ok(page.get('thd-band-metrics').innerHTML.length > 0);
    page.edit(id, value);
    assert.equal(page.valid, false, `${id}=${value}`);
    assert.equal(page.get('copy-link').disabled, true);
    assert.equal(page.get('thd-band-metrics').innerHTML, '');
    assert.equal(page.get('thd-harmonics').innerHTML, '');
  }
});

test('optional THD inputs may be blank, but overflow and invalid text disable saving', () => {
  const page = boot('large-signal', '#?tab=thd');
  assert.equal(page.valid, true);
  for (const id of ['thd-f0', 'thd-fmax', 'thd-fc', 'thd-contam', 'thd-h2']) {
    const p = boot('large-signal', '#?tab=thd'); p.edit(id, 'bad');
    assert.equal(p.valid, false, id);
  }
  const overflow = boot('large-signal', '#?tab=thd');
  overflow.edit('thd-contam', 10000);
  assert.equal(overflow.valid, false);
});

test('two-tone IM3 plane and unit changes retain the physical measurement and URL state', () => {
  const page = boot('large-signal');
  page.edit('tone-dbm', -10); page.edit('imd-gain', 20); page.edit('imd-im3', -40);
  assert.match(page.get('imd-metrics').innerHTML, /OIP3<\/dt><dd>30.00 dBm/);
  page.edit('imd-unit', 'dbm');
  assert.equal(page.read('imd-im3'), -30);
  page.edit('ls-plane', 'output');
  assert.equal(page.read('tone-dbm'), 10);
  assert.match(page.get('imd-metrics').innerHTML, /OIP3<\/dt><dd>30.00 dBm/);
  const reload = boot('large-signal', page.url);
  assert.equal(reload.get('imd-metrics').innerHTML, page.get('imd-metrics').innerHTML);
  page.edit('imd-gain', 'bad');
  assert.equal(page.valid, false);
  assert.equal(page.get('spectrum').innerHTML, '');
});

test('compression input and output drivers retain exact results across a shared link', () => {
  const page = boot('large-signal', '#?tab=p1db');
  page.edit('p1-gain', '20.123456789'); page.edit('p1-pout', '5.987654321');
  assert.ok(Math.abs(page.read('p1-pin') - (5.987654321 - 20.123456789 + 1)) < 1e-12);
  const reload = boot('large-signal', page.url);
  assert.equal(reload.read('p1-pin'), page.read('p1-pin'));
  assert.equal(reload.get('p1-metrics').innerHTML, page.get('p1-metrics').innerHTML);
  page.edit('p1-gain', 'bad'); assert.equal(page.valid, false);
});
