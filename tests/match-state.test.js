const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./helpers/controller.cjs');

test('point-mode links restore both ripple settings for presets and moved points', () => {
  for (const preset of ['short', 'open', 'match', null]) {
    const page = boot('match');
    page.edit('ripple-rl1', '20'); page.edit('ripple-rl2', '30');
    if (preset) page.click('special', preset); else page.key('ArrowUp');
    const reload = boot('match', page.url);
    assert.equal(reload.valid, true);
    assert.equal(reload.get('ripple-rl1').value, '20');
    assert.equal(reload.get('ripple-rl2').value, '30');
    assert.equal(reload.get('ripple-metrics').innerHTML, page.get('ripple-metrics').innerHTML);
    assert.equal(reload.get('smith-marker').getAttribute('cx'), page.get('smith-marker').getAttribute('cx'));
    assert.equal(reload.get('smith-marker').getAttribute('cy'), page.get('smith-marker').getAttribute('cy'));
  }
});

test('a matched load has zero ripple including after the Match preset', () => {
  const page = boot('match');
  for (const initial of [true, false]) {
    if (!initial) { page.edit('z', 75); page.click('special', 'match'); }
    assert.equal(page.get('ripple-status').textContent, '');
    assert.match(page.get('ripple-metrics').innerHTML, /Peak-to-peak ripple<\/dt><dd>0 dB/);
    assert.match(page.get('ripple-metrics').innerHTML, /∞ dB \(this load\)/);
  }
});

test('invalid loads clear all dependent results and disable saving', () => {
  for (const [id, invalid] of [['z', '-1'], ['x', 'bad'], ['z0', '0'], ['gamma', '1.1']]) {
    const page = boot('match'); page.edit('z', 75);
    assert.match(page.get('ripple-metrics').innerHTML, /0.35 dB/);
    page.edit(id, invalid);
    assert.equal(page.valid, false);
    assert.equal(page.get('ripple-metrics').innerHTML, '');
    assert.equal(page.get('metrics').innerHTML, '');
    assert.match(page.get('ripple-status').textContent, /Correct the load/);
    assert.equal(page.get('smith-marker').getAttribute('visibility'), 'hidden');
    assert.equal(page.get('copy-link').disabled, true);
    assert.equal(page.get('copy-result').disabled, true);
  }
});

test('explicit infinite return losses represent a match and survive a shared link', () => {
  const page = boot('match'); page.edit('z', 75);
  page.edit('ripple-rl1', 'Infinity'); page.edit('ripple-rl2', '∞');
  assert.match(page.get('ripple-metrics').innerHTML, /Peak-to-peak ripple<\/dt><dd>0 dB/);
  assert.equal(boot('match', page.url).get('ripple-metrics').innerHTML, page.get('ripple-metrics').innerHTML);
  page.edit('ripple-rl1', '-Infinity');
  assert.equal(page.get('ripple-metrics').innerHTML, '');
});

test('pure reactance and explicit unit polar magnitude remain ideal lossless loads', () => {
  const page = boot('match'); page.edit('z', 0); page.edit('x', 5);
  assert.equal(page.read('z'), 0); assert.equal(page.read('x'), 5);
  assert.equal(page.read('gamma'), 1); assert.equal(page.read('vswr'), Infinity);
  assert.equal(page.read('mloss'), Infinity);
  page.edit('gamma', 1); page.edit('phase', -176);
  assert.equal(page.read('z'), 0); assert.equal(page.read('vswr'), Infinity);
  const reload = boot('match', page.url);
  assert.equal(reload.read('gamma'), 1); assert.equal(reload.read('vswr'), Infinity);
});

test('a chart point clipped to the unit circle preserves its boundary in a link', () => {
  const page = boot('match'); page.click('special', 'open'); page.key('ArrowUp');
  assert.equal(page.read('vswr'), Infinity); assert.equal(page.read('z'), 0);
  const reload = boot('match', page.url);
  assert.equal(reload.read('vswr'), Infinity); assert.equal(reload.read('z'), 0);
  page.key('ArrowLeft');
  assert.ok(Number.isFinite(page.read('vswr')));
  assert.ok(page.read('z') > 0);
});

test('ordinary scalar edits retain full-precision phase and links retain DUT context', () => {
  const page = boot('match', '#?zin=60&zout=80&dut=Test'); page.edit('x', 50);
  const phase = page.read('phase');
  assert.ok(Math.abs(phase - 63.43494882292201) < 1e-12);
  for (const [id, value] of [['rl', -20], ['vswr', 2], ['mloss', 1], ['gamma', .3]]) {
    page.edit(id, value); assert.ok(Math.abs(page.read('phase') - phase) < 1e-12);
  }
  const reload = boot('match', page.url);
  assert.ok(Math.abs(reload.read('phase') - phase) < 1e-12);
  assert.equal(reload.dut.get().zin, 60); assert.equal(reload.dut.get().zout, 80);
});
