const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');
const near = (actual, expected, tol = 1e-12) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const VPP_0DBM_50 = 0.6324555320336759;

test('mixed-mode conversion follows the pairing and conserves power between modes', () => {
  const zero = { re: 0, im: 0 }, one = { re: 1, im: 0 };
  const S = {};
  for (const i of [1, 2, 3, 4]) { S[i] = {}; for (const j of [1, 2, 3, 4]) S[i][j] = zero; }
  S[2][1] = one; S[4][3] = one;
  const sides = [{ ports: [1, 3] }, { ports: [2, 4] }];
  let m = RF.mixedMode(S, sides);
  assert.deepEqual(m.rows.map(r => r.label), ['d1', 'd2', 'c1', 'c2']);
  near(m.byName.Sdd21.value.mag, 1); near(m.byName.Scc21.value.mag, 1);
  near(m.byName.Sdc21.value.mag, 0); near(m.byName.Scd21.value.mag, 0);
  assert.equal(m.byName.Sdc21.value.db, -Infinity);
  // The classic form: Sdd21 = (S21 - S23 - S41 + S43) / 2 for ports 1,3 in and 2,4 out.
  assert.deepEqual(m.byName.Sdd21.terms.map(t => [t.i, t.j, Number(t.coefficient.toFixed(6))]), [[2, 1, .5], [2, 3, -.5], [4, 1, -.5], [4, 3, .5]]);
  // Inverting one line turns the differential signal entirely into common mode.
  S[4][3] = { re: -1, im: 0 };
  m = RF.mixedMode(S, sides);
  near(m.byName.Sdd21.value.mag, 0); near(m.byName.Scd21.value.mag, 1);
  near(m.byName.Sdd21.value.mag ** 2 + m.byName.Scd21.value.mag ** 2, 1);
  // Three ports: a single-ended output sees the differential input through 1/sqrt 2.
  S[4][3] = one;
  m = RF.mixedMode(S, [{ ports: [1, 3] }, { ports: [2] }]);
  assert.deepEqual(m.rows.map(r => r.label), ['d1', 's2', 'c1']);
  near(m.byName.Ssd21.value.mag, Math.SQRT1_2); near(m.byName.Ssd21.value.db, -20 * Math.log10(Math.SQRT2));
  near(m.byName.Ssc21.value.mag, Math.SQRT1_2);
  m = RF.mixedMode(S, [{ ports: [1] }, { ports: [2, 4] }]);
  assert.deepEqual(m.rows.map(r => r.label), ['s1', 'd2', 'c2']);
  near(m.byName.Sds21.value.mag, Math.SQRT1_2);
  // Two single-ended ports are just the two-port parameters.
  m = RF.mixedMode(S, [{ ports: [1] }, { ports: [2] }]);
  assert.deepEqual(m.rows.map(r => r.label), ['s1', 's2']); near(m.byName.Sss21.value.mag, 1);
  // Phase and level round-trip through the polar helpers.
  const p = RF.toPolar(RF.fromPolar(-3, 45)); near(p.db, -3); near(p.deg, 45);
  assert.equal(RF.mixedMode(S, [{ ports: [1, 3] }, { ports: [3, 4] }]), null);
  assert.equal(RF.mixedMode(S, [{ ports: [1, 3] }, { ports: [2, 5] }]), null);
});

test('time-domain limits follow the step and the span', () => {
  const td = RF.timeDomain(10e6, 10e9 - 100e6);
  near(td.range, 100e-9, 1e-18); near(td.rangeOneWay, 50e-9, 1e-18); near(td.resolution, 1 / 9.9e9, 1e-24);
  assert.equal(RF.timeDomain(0, 1e9), null); assert.equal(RF.timeDomain(1e6, 0), null);
});

test('two mismatches ripple through the product of their reflections', () => {
  const r = RF.mismatchRipple(20, 20);
  near(r.product, 0.01); near(r.up, 20 * Math.log10(1.01)); near(r.down, 20 * Math.log10(0.99)); near(r.peakToPeak, r.up - r.down);
  near(RF.mismatchRipple(10, 10).peakToPeak, 20 * Math.log10(1.1 / 0.9));
  assert.equal(RF.mismatchRipple(0, 0).down, -Infinity);
  assert.equal(RF.mismatchRipple(-1, 20), null);
});

test('the noise floor follows IF bandwidth and averaging and sets the trace noise', () => {
  const n = RF.noiseFloor({ floorRef: -120, ifbwRef: 10, ifbw: 1000, signal: -40 });
  near(n.floor, -100);
  near(n.snr, 60);
  near(n.traceNoiseDb, (20 / Math.LN10) * 1e-3 / Math.SQRT2);
  near(n.traceNoiseDeg, (180 / Math.PI) * 1e-3 / Math.SQRT2);
  near(n.ifbwFor(20), 1e7, 1e-3);
  near(RF.noiseFloor({ floorRef: -120, ifbwRef: 10, ifbw: 1000, averages: 10 }).floor, -110);
  near(RF.noiseFloor({ floorRef: -120, ifbwRef: 10, ifbw: 1000, averages: 16, signal: -60 }).ifbwFor(20), 16 * 1e5, 1e-6);
  assert.equal(RF.noiseFloor({ floorRef: -120, ifbwRef: 10, ifbw: 1000 }).snr, null);
  assert.equal(RF.noiseFloor({ floorRef: -120, ifbwRef: 0, ifbw: 1000 }), null);
  assert.equal(RF.noiseFloor({ floorRef: -120, ifbwRef: 10, ifbw: 1000, averages: 0.5 }), null);
});

test('0 dBm into 50 Ω gives textbook single-ended voltages', () => {
  const se0 = RF.seFromDbm(0, 50);
  near(se0.watts, 0.001, 1e-15);
  near(se0.vrms, Math.sqrt(0.05));
  near(se0.vpk, Math.sqrt(0.1));
  near(se0.vpp, VPP_0DBM_50);
  near(se0.irms, se0.vrms / 50, 1e-15);
  near(RF.seFromDbm(-10, 50).vpp, 0.2);
  near(RF.seFromDbm(-10, 50).vpk, 0.1);
  near(RF.seFromDbm(10, 50).vpp, 2);
  near(RF.seFromDbm(10, 50).vpk, 1);
  near(RF.seFromDbm(10, 50).mw, 10);
  near(RF.seFromDbm(0, 75).vrms / se0.vrms, Math.sqrt(75 / 50), 1e-12);
});

test('peak-to-peak voltage inverts back to dBm', () => {
  const se1v = RF.seFromVpp(1, 50);
  near(se1v.dbm, 10 * Math.log10(2.5));
  near(se1v.mw, 2.5);
  near(RF.seFromVpp(RF.seFromDbm(-7.3, 50).vpp, 50).dbm, -7.3);
  near(RF.fromVopp(0.2, 50, 'se').dbm, -10);
});

test('differential drive doubles voltage and total power', () => {
  const se0 = RF.seFromDbm(0, 50), diff0 = RF.diffFromPortDbm(0, 50);
  near(diff0.vppSe, se0.vpp);
  near(diff0.vppDiff, 2 * se0.vpp);
  near(diff0.vrmsDiff, 2 * se0.vrms);
  assert.equal(diff0.zDiff, 100);
  near(diff0.wattsTotal, 0.002, 1e-15);
  near(diff0.dbmTotal, 10 * Math.log10(2));
  near(diff0.dbmPort, 0);
  const diff1 = RF.diffFromVppDiff(1, 50);
  near(diff1.vppSe, 0.5);
  near(diff1.dbmPort, RF.seFromVpp(0.5, 50).dbm);
  near(diff1.vppDiff, 1);
  near(RF.diffFromVppDiff(RF.diffFromPortDbm(5, 75).vppDiff, 75).dbmPort, 5);
  const fromD = RF.fromDbm(-10, 50, 'se'), fromDd = RF.fromDbm(-10, 50, 'diff');
  assert.equal(RF.voppOf(fromD), fromD.vpp); assert.equal(RF.dbmOf(fromD), fromD.dbm);
  assert.equal(RF.voppOf(fromDd), fromDd.vppDiff); assert.equal(RF.dbmOf(fromDd), fromDd.dbmPort);
  near(RF.voppOf(fromDd), 0.4);
});

test('voltage units and number parsing', () => {
  near(RF.voltsToUnit(VPP_0DBM_50, 'mV'), 632.4555320336759, 1e-9);
  near(RF.unitToVolts(200, 'mV'), 0.2);
  assert.equal(RF.parseNumber(' -10.5 '), -10.5);
  assert.equal(RF.parseNumber('0,2'), 0.2);
  assert.ok(Number.isNaN(RF.parseNumber('')));
  assert.ok(Number.isNaN(RF.parseNumber('-')));
});

test('unmatched VNA and DUT impedances split available and delivered power', () => {
  const m50 = RF.fromDbmPlane(0, 50, 50, 'se', 'src');
  near(m50.vppSe, VPP_0DBM_50); near(m50.dbmAvailable, 0); near(m50.dbmDelivered, 0); near(m50.gamma, 0);
  const m100 = RF.fromDbmPlane(0, 50, 100, 'se', 'src');
  near(m100.gamma, 1 / 3);
  near(m100.vrmsSe, Math.sqrt(0.05) * (4 / 3));
  near(m100.dbmDelivered, 10 * Math.log10(8 / 9));
  near(RF.fromVoppPlane(m100.vppSe, 50, 100, 'se', 'src').dbmAvailable, 0);
  const rx = RF.fromDbmPlane(0, 50, 100, 'se', 'rx');
  near(rx.vppSe, VPP_0DBM_50); near(rx.dbmDelivered, 0); near(rx.gamma, (50 - 100) / 150);
  near(RF.fromVoppPlane(VPP_0DBM_50, 50, 100, 'se', 'rx').dbmDelivered, 0);
  const dsrc = RF.fromDbmPlane(0, 50, 50, 'diff', 'src');
  near(dsrc.vppDiff, 2 * VPP_0DBM_50);
  near(RF.fromVoppPlane(dsrc.vppDiff, 50, 50, 'diff', 'src').dbmPort, 0);
});

test('scalar match quantities agree with known values and round-trip', () => {
  const m20 = RF.matchFromGamma(RF.gammaFromRl(20));
  near(m20.gamma, 0.1); near(m20.vswr, 1.222222222222222); near(m20.mloss, -10 * Math.log10(0.99));
  near(RF.gammaFromVswr(1.5), 0.2);
  near(RF.rlFromGamma(RF.gammaFromVswr(RF.vswrFromGamma(0.1))), 20);
});

test('P1dB, compression, THD and two-tone envelope', () => {
  const p1 = RF.p1dbFromInput(20, -10);
  near(p1.pout1dB, 9);
  near(RF.p1dbFromOutput(20, 9).pin1dB, -10);
  const cmp = RF.compressionAt(20, -10, 8.5);
  near(cmp.poutLinear, 10); near(cmp.compression, 1.5);
  near(RF.thdFromDbc([-40]).percent, 1); near(RF.thdFromDbc([-40]).db, -40);
  near(RF.thdFromDbc([-40, -40]).ratio, Math.SQRT2 / 100);
  const tt = RF.twoToneFromToneDbm(0, 50, 'se');
  near(tt.dbmPortPep, RF.DB_6); near(tt.dbmPortAvg, RF.DB_3); near(tt.vppEnv, 2 * tt.vppOne);
  const ttd = RF.twoToneFromToneDbm(0, 50, 'diff');
  near(ttd.vppEnv, 2 * ttd.vppOne); near(ttd.dbmTotalAvg, RF.DB_3 + RF.DB_3);
});

test('wavelength, delay and electrical length', () => {
  near(RF.vfFromEr(4), 0.5);
  near(RF.erFromVf(0.7), 1 / 0.49);
  near(RF.guidedWavelength(1e9, 1), RF.C_LIGHT / 1e9, 1e-9);
  near(RF.delayFromLength(RF.C_LIGHT * 1e-9, 1), 1e-9, 1e-18);
  near(RF.degreesFromLength(RF.guidedWavelength(2e9, 1) / 4, 2e9, 1), 90, 1e-9);
});
