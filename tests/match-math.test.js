const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');

const near = (actual, expected, tolerance = 2e-13) => {
  assert.ok(Number.isFinite(actual), `Expected finite ${expected}; got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(expected), Number.MIN_VALUE), `${actual} != ${expected}`);
};

test('impedance entries retain exact supplied R and X, including ideal reactances', () => {
  for (const z0 of [25, 50, 75, 100]) {
    for (const x of [.1, .2, .3, 1, 2, 3, 5, 10, 15, 20, 30, 50, 70, 75, 100, 150, 300, 500, 1000, 5000, 10000, 100000]) {
      for (const sign of [-1, 1]) {
        const m = RF.complexMatch(0, sign * x, z0);
        assert.equal(m.r, 0); assert.equal(m.x, sign * x);
        assert.equal(m.gamma, 1); assert.equal(m.delivered, 0);
        assert.equal(m.vswr, Infinity); assert.equal(m.mloss, Infinity);
      }
    }
  }
  const example = RF.complexMatch(75, 35, 50);
  assert.equal(example.r, 75); assert.equal(example.x, 35);
  near(example.re, 0.2581602373887240356);
  near(example.im, 0.2077151335311572700);
  near(example.delivered, 0.8902077151335311573);
  near(example.vswr, 1.9910978439945495);
});

test('explicit unit polar magnitudes remain lossless at every integer phase', () => {
  for (let phase = -180; phase <= 180; phase++) {
    const m = RF.matchFromPolarGamma(1, phase, 50);
    assert.equal(m.gamma, 1, String(phase));
    assert.equal(m.delivered, 0, String(phase));
    assert.equal(m.vswr, Infinity, String(phase));
    assert.equal(m.mloss, Infinity, String(phase));
    assert.equal(m.r, phase === 0 ? Infinity : 0, String(phase));
  }
  for (const phase of [-720, -360, 0, 360, 720]) {
    const open = RF.matchFromPolarGamma(1, phase, 50);
    assert.equal(open.re, 1); assert.equal(open.im, 0); assert.equal(open.r, Infinity);
  }
  for (const phase of [-540, -180, 180, 540]) {
    const short = RF.matchFromPolarGamma(1, phase, 50);
    assert.equal(short.re, -1); assert.equal(short.im, 0);
    assert.equal(short.r, 0); assert.equal(short.x, 0);
  }
});

test('finite resistance and near-unit magnitudes are never snapped to ideal reactances', () => {
  for (const r of [1e-16, 1e-14, 1e-12, 1e-9, 1e-6]) {
    const m = RF.complexMatch(r, 5, 50);
    assert.equal(m.r, r); assert.equal(m.x, 5);
    near(m.delivered, 200 * r / ((r + 50) ** 2 + 25));
    assert.ok(Number.isFinite(m.vswr) && m.vswr > 1);
    assert.ok(Number.isFinite(m.mloss) && m.mloss > 0);
    assert.ok(m.rl > 0);
  }
  const gamma = 1 - Number.EPSILON;
  for (const phase of [-176, -90, 0, 38, 180]) {
    const m = RF.matchFromPolarGamma(gamma, phase, 50);
    assert.equal(m.gamma, gamma);
    assert.ok(m.delivered > 0); assert.ok(m.r > 0);
    assert.ok(Number.isFinite(m.vswr)); assert.ok(Number.isFinite(m.mloss));
  }
  const point = RF.matchFromComplexGamma(gamma, 0, 50);
  assert.equal(point.gamma, gamma); assert.ok(point.delivered > 0);
});

test('a known chart magnitude must agree with the supplied complex point', () => {
  const phase = -176 * Math.PI / 180;
  const m = RF.matchFromComplexGamma(Math.cos(phase), Math.sin(phase), 50, 1);
  assert.equal(m.r, 0); assert.equal(m.delivered, 0);
  for (const magnitude of [NaN, Infinity, -1, 1.01, .9]) {
    assert.equal(RF.matchFromComplexGamma(.6, .8, 50, magnitude), null);
  }
  for (const args of [[1.01, 0, 50], [.5, Infinity, 50], [.5, 0, 0]]) {
    assert.equal(RF.matchFromPolarGamma(...args), null);
  }
});

test('scaled impedance transforms retain finite results without squaring overflow', () => {
  const huge = RF.complexMatch(1e200, 0, 50);
  assert.equal(huge.r, 1e200); assert.equal(huge.x, 0);
  near(huge.vswr, 2e198); near(huge.delivered, 2e-198);
  near(huge.mloss, 1976.9897000433602);
  // Delivered power underflows here, while its logarithmic level is representable.
  near(RF.complexMatch(50, 1e200, 50).mloss, 3960);
  near(RF.complexMatch(50, 1e308, 50).mloss, 6120);
});

test('tiny mismatch losses survive conversion to reflection and back', () => {
  for (const loss of [1e-18, 1e-16, 1e-14]) {
    const gamma = RF.gammaFromMismatchLoss(loss);
    near(gamma, Math.sqrt(loss * Math.LN10 / 10));
    near(RF.mismatchLossFromGamma(gamma), loss);
  }
  assert.equal(RF.mismatchLossFromGamma(0), 0);
  assert.equal(RF.gammaFromMismatchLoss(0), 0);
});

test('perfect return loss gives zero ripple instead of an invalid result', () => {
  for (const [a, b] of [[Infinity, 0], [0, Infinity], [Infinity, Infinity], [Infinity, 20]]) {
    const ripple = RF.mismatchRipple(a, b);
    assert.equal(ripple.product, 0); assert.equal(ripple.up, 0);
    assert.equal(ripple.down, 0); assert.equal(ripple.peakToPeak, 0);
  }
  for (const invalid of [NaN, -Infinity, -1, null, '', 'Infinity']) {
    assert.equal(RF.mismatchRipple(invalid, 20), null);
    assert.equal(RF.mismatchRipple(20, invalid), null);
  }
  assert.equal(RF.mismatchRipple(0, 0).down, -Infinity);
});

test('number parsing rejects malformed mixed separators without changing supported notation', () => {
  for (const [text, expected] of [['1,000.5', 1000.5], ['1.000,5', 1000.5], ['-1,000,000.25e-3', -1000.00025], ['+1.000.000,25e-3', 1000.00025], ['0,250', .25], ['1e-3', .001]]) {
    assert.equal(RF.parseNumber(text), expected, text);
  }
  for (const text of ['1,2.3', '1.2,3', '1,23.4', '1.23,4', '1,,000.5', '1..000,5', '1234,000.5', '1,000.2.5', '1,000.5e']) {
    assert.ok(Number.isNaN(RF.parseNumber(text)), text);
  }
});
