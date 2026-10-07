'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');
const near = (actual, expected, relative = 2e-12) => {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), Number.MIN_VALUE), `${actual} != ${expected}`);
};

test('mixed-mode identity preserves weak signals instead of imposing a -240 dB floor', () => {
  for (const amplitude of [1e-10, 1e-13, 1e-100, 1e-250]) {
    const S = { 1: { 1: { re: 0, im: 0 }, 2: { re: amplitude, im: -amplitude } },
      2: { 1: { re: amplitude, im: 0 }, 2: { re: 0, im: 0 } } };
    const result = RF.mixedMode(S, [{ ports: [1] }, { ports: [2] }]);
    near(result.byName.Sss21.value.re, amplitude);
    near(result.byName.Sss12.value.im, -amplitude);
    near(result.byName.Sss21.value.db, 20 * Math.log10(amplitude));
  }
});

test('balanced differential transmission retains weak signals and exact cancellations', () => {
  for (const amplitude of [1, 1e-13, 1e-200]) {
    const S = {};
    for (let i = 1; i <= 4; i++) {
      S[i] = {};
      for (let j = 1; j <= 4; j++) S[i][j] = { re: (i === 3 && j === 1) || (i === 4 && j === 2) ? amplitude : 0, im: 0 };
    }
    const result = RF.mixedMode(S, [{ ports: [1, 2] }, { ports: [3, 4] }]);
    near(result.byName.Sdd21.value.re, amplitude);
    assert.equal(result.byName.Scd21.value.mag, 0);
  }
});

test('harmonic correction remains finite at extreme ratios and reaches the RC asymptote', () => {
  for (const [f0, fc] of [[1e200, 1], [1e308, 1e-200], [1, 1e-200]]) {
    for (const n of [1, 2, 3, 10]) for (const poles of [1, 4]) {
      const actual = RF.bandLimitAttenuation(f0, fc, n, poles);
      if (n === 1) assert.equal(actual, 0);
      else near(actual, -20 * poles * Math.log10(n));
    }
    assert.ok(RF.bandLimitedThd([{ n: 2, dbc: -40 }], f0, fc, 1));
  }
  assert.equal(RF.bandLimitAttenuation(1e-200, 1e200, 2, 1), 0);
  for (const invalid of [0, -1, Infinity, NaN]) {
    assert.ok(Number.isNaN(RF.bandLimitAttenuation(invalid, 1, 2, 1)));
    assert.ok(Number.isNaN(RF.bandLimitAttenuation(1, invalid, 2, 1)));
  }
});

test('power conversions round-trip across 240 decades with relative error bounds', () => {
  for (let level = -1200; level <= 1200; level += 10) {
    const watts = RF.dbmToWatts(level);
    near(watts, Math.exp((level / 10 - 3) * Math.LN10));
    if (level === 0) assert.equal(RF.wattsToDbm(watts), 0);
    else near(RF.wattsToDbm(watts), level);
  }
  assert.equal(RF.wattsToDbm(0), -Infinity);
  assert.ok(Number.isNaN(RF.wattsToDbm(-1)));
});
