const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./helpers/controller.cjs');
const setup = (stop, step) => '#?' + new URLSearchParams({ segments: JSON.stringify([
  { start: '1', stop, step, startUnit: 'GHz', stopUnit: 'GHz', stepUnit: 'GHz' }
]) });

test('one-point sweeps stay valid without claiming a time-domain transform', () => {
  for (const [stop, step] of [['1', '0.1'], ['1.1', '0.2']]) {
    const page = boot('sweep', setup(stop, step));
    assert.equal(page.valid, true);
    assert.match(page.get('spacing-metrics').innerHTML, /two distinct frequency points/);
    assert.match(page.get('sweep-rows').innerHTML, /<td>1<\/td>/);
    assert.ok(page.calculation.lines.some(line => typeof line === 'string' && /one-point/.test(line)));
    const restored = boot('sweep', page.url);
    assert.equal(restored.valid, true);
    assert.equal(restored.get('spacing-metrics').innerHTML, page.get('spacing-metrics').innerHTML);
    restored.click('preset', 'wide');
    assert.equal(restored.valid, true);
    assert.match(restored.get('spacing-metrics').innerHTML, /Time-domain range/);
  }
});

test('invalid sweep inputs clear dependent results and recover on a preset', () => {
  const page = boot('sweep');
  assert.equal(page.valid, true);
  page.edit('ifbw', '-1');
  assert.equal(page.valid, false);
  for (const id of ['sweep-metrics', 'spacing-metrics', 'timing-details', 'sweep-rows'])
    assert.equal(page.get(id).innerHTML, '');
  page.edit('ifbw', '1');
  page.click('preset', 'decades');
  assert.equal(page.valid, true);
  assert.match(page.get('sweep-metrics').innerHTML, /136/);
});

test('fractional power sweep keeps the final acquired point and round-trips its driver', () => {
  const page = boot('sweep');
  page.edit('p-start', '0'); page.edit('p-stop', '1'); page.edit('p-step', '0.3');
  assert.equal(page.valid, true);
  assert.match(page.get('power-status').textContent, /4 points end at 0.9 dBm/);
  assert.ok(page.calculation.lines.find(line => line.label === 'Power sweep points').latex.includes('\\lfloor'));
  const restored = boot('sweep', page.url);
  assert.equal(restored.valid, true);
  assert.equal(restored.get('power-metrics').innerHTML, page.get('power-metrics').innerHTML);
});

test('zero-span power sweeps never show division by zero in the calculation', () => {
  const page = boot('sweep');
  page.edit('p-start', '0'); page.edit('p-stop', '0'); page.edit('p-points', '1');
  assert.equal(page.valid, true);
  const equation = page.calculation.lines.find(line => line.label === 'Power sweep points');
  assert.doesNotMatch(equation.latex, /\\frac/);
  assert.match(equation.latex, /N_P &= 1/);
});

test('mixed-mode rejects duplicate physical ports and restores valid mappings', () => {
  const bad = boot('mixed', '#?t=dd&p1=1,3&p2=2,3');
  assert.equal(bad.valid, false);
  assert.match(bad.get('mapping-status').textContent, /only once/);
  for (const topology of ['dd', 'ds', 'sd', 'ss']) {
    const page = boot('mixed', '#?t=' + topology + '&p1=4,2&p2=3,1&zin=60&zout=75');
    assert.equal(page.valid, true);
    const restored = boot('mixed', page.url);
    assert.equal(restored.valid, true);
    assert.deepEqual(JSON.parse(JSON.stringify(restored.calculation)), JSON.parse(JSON.stringify(page.calculation)));
  }
});
