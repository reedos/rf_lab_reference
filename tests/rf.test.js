const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');
const near = (actual, expected, tol = 1e-12) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const VPP_0DBM_50 = 0.6324555320336759;

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
