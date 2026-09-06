const RF = require("../js/rf.js");

let failed = 0;
let passed = 0;

function approx(actual, expected, tol, label) {
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(
    `FAIL  ${label}\n      expected ${expected}\n      actual   ${actual}`
  );
}

function eq(actual, expected, label) {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(
    `FAIL  ${label}\n      expected ${expected}\n      actual   ${actual}`
  );
}

// 0 dBm, 50 Ω, SE — textbook values
const se0 = RF.seFromDbm(0, 50);
approx(se0.watts, 0.001, 1e-15, "0 dBm = 1 mW");
approx(se0.vrms, Math.sqrt(0.05), 1e-12, "0 dBm @ 50 Ω Vrms");
approx(se0.vpk, Math.sqrt(0.1), 1e-12, "0 dBm @ 50 Ω Vpk");
approx(se0.vpp, 0.6324555320336759, 1e-12, "0 dBm @ 50 Ω Vpp");
approx(se0.irms, se0.vrms / 50, 1e-15, "Irms = Vrms / Z0");

// Round numbers at 50 Ω
const seM10 = RF.seFromDbm(-10, 50);
approx(seM10.vpp, 0.2, 1e-12, "-10 dBm @ 50 Ω = 200 mVpp");
approx(seM10.vpk, 0.1, 1e-12, "-10 dBm @ 50 Ω = 100 mVpk");

const se10 = RF.seFromDbm(10, 50);
approx(se10.vpp, 2, 1e-12, "10 dBm @ 50 Ω = 2 Vpp");
approx(se10.vpk, 1, 1e-12, "10 dBm @ 50 Ω = 1 Vpk");
approx(se10.mw, 10, 1e-12, "10 dBm = 10 mW");

// Inverse: 1 Vpp @ 50 Ω → 3.979400086720376 dBm
const se1v = RF.seFromVpp(1, 50);
approx(se1v.dbm, 10 * Math.log10(2.5), 1e-12, "1 Vpp @ 50 Ω dBm");
approx(se1v.mw, 2.5, 1e-12, "1 Vpp @ 50 Ω = 2.5 mW");

// Round-trip SE
const rtSe = RF.seFromVpp(RF.seFromDbm(-7.3, 50).vpp, 50);
approx(rtSe.dbm, -7.3, 1e-12, "SE dBm → Vpp → dBm");

// Differential: VOPP is 2× SE, total power +3.0103 dB
const diff0 = RF.diffFromPortDbm(0, 50);
approx(diff0.vppSe, se0.vpp, 1e-12, "diff per-line Vpp = SE Vpp");
approx(diff0.vppDiff, 2 * se0.vpp, 1e-12, "diff VOPP = 2 × SE Vpp");
approx(diff0.vrmsDiff, 2 * se0.vrms, 1e-12, "Vdiff_rms = 2 × Vse_rms");
approx(diff0.zDiff, 100, 0, "Zdiff = 2 × Z0");
approx(diff0.wattsTotal, 0.002, 1e-15, "two ports at 0 dBm = 2 mW");
approx(diff0.dbmTotal, 10 * Math.log10(2), 1e-12, "total = +3.01 dB");
approx(diff0.dbmPort, 0, 1e-12, "per-port dBm preserved");

// Inverse differential: 1 Vpp differential → 0.5 Vpp per line
const diff1 = RF.diffFromVppDiff(1, 50);
approx(diff1.vppSe, 0.5, 1e-12, "1 Vpp diff → 0.5 Vpp / line");
approx(diff1.dbmPort, RF.seFromVpp(0.5, 50).dbm, 1e-12, "diff inverse per-port dBm");
approx(diff1.vppDiff, 1, 1e-12, "diff VOPP preserved");

const rtDiff = RF.diffFromVppDiff(RF.diffFromPortDbm(5, 75).vppDiff, 75);
approx(rtDiff.dbmPort, 5, 1e-12, "diff dBm → VOPP → dBm @ 75 Ω");

// Unified helpers
const fromD = RF.fromDbm(-10, 50, "se");
eq(RF.voppOf(fromD), fromD.vpp, "voppOf SE");
eq(RF.dbmOf(fromD), fromD.dbm, "dbmOf SE");
const fromDd = RF.fromDbm(-10, 50, "diff");
eq(RF.voppOf(fromDd), fromDd.vppDiff, "voppOf diff");
eq(RF.dbmOf(fromDd), fromDd.dbmPort, "dbmOf diff");
approx(RF.voppOf(fromDd), 0.4, 1e-12, "-10 dBm diff @ 50 Ω = 400 mVpp");

const fromV = RF.fromVopp(0.2, 50, "se");
approx(fromV.dbm, -10, 1e-12, "fromVopp SE");

// 75 Ω check: same power, voltage scales with √(Z)
const se75 = RF.seFromDbm(0, 75);
approx(se75.vrms / se0.vrms, Math.sqrt(75 / 50), 1e-12, "Vrms scales √(Z)");

// Unit conversion
approx(RF.voltsToUnit(0.6324555320336759, "mV"), 632.4555320336759, 1e-9, "V → mV");
approx(RF.unitToVolts(200, "mV"), 0.2, 1e-12, "mV → V");

// parseNumber
eq(RF.parseNumber(" -10.5 "), -10.5, "parse spaced");
eq(RF.parseNumber("0,2"), 0.2, "parse comma decimal");
eq(Number.isNaN(RF.parseNumber("")), true, "parse empty");
eq(Number.isNaN(RF.parseNumber("-")), true, "parse lone minus");

if (failed) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`${passed} passed`);
