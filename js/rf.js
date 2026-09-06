/**
 * RF power / voltage conversions for a CW sinusoid into a real, matched load.
 *
 * Single-ended:
 *   P_W  = 10^(dBm/10) / 1000
 *   Vrms = √(P_W · Z0)
 *   Vpk  = √2 · Vrms
 *   VOPP = 2√2 · Vrms
 *
 * Differential (true complementary drive, two ports):
 *   dBm is the VNA per-port available power into Z0
 *   VOPP_diff = 2 · VOPP_SE   (V+ − V−, peak-to-peak)
 *   Zdiff     = 2 · Z0
 *   P_total   = 2 · P_port    (+3.01 dB)
 */
(function (root) {
  const SQRT2 = Math.SQRT2;
  const TWO_SQRT2 = 2 * Math.SQRT2;
  const C_LIGHT = 299792458;
  const DB_3 = 10 * Math.log10(2);
  const DB_6 = 10 * Math.log10(4);

  function dbmToWatts(dbm) {
    return Math.pow(10, dbm / 10) / 1000;
  }

  function wattsToDbm(watts) {
    if (!(watts > 0) || !Number.isFinite(watts)) return NaN;
    return 10 * Math.log10(watts * 1000);
  }

  function wattsToVrms(watts, z0) {
    if (!(watts >= 0) || !(z0 > 0) || !Number.isFinite(watts) || !Number.isFinite(z0)) {
      return NaN;
    }
    return Math.sqrt(watts * z0);
  }

  function vrmsToWatts(vrms, z0) {
    if (!(z0 > 0) || !Number.isFinite(vrms) || !Number.isFinite(z0)) return NaN;
    return (vrms * vrms) / z0;
  }

  function vrmsToVpp(vrms) {
    return TWO_SQRT2 * vrms;
  }

  function vppToVrms(vpp) {
    return vpp / TWO_SQRT2;
  }

  function vrmsToVpk(vrms) {
    return vrms * SQRT2;
  }

  function seFromDbm(dbm, z0) {
    const watts = dbmToWatts(dbm);
    const vrms = wattsToVrms(watts, z0);
    return packSe(dbm, watts, vrms, vrmsToVpp(vrms), z0);
  }

  function seFromVpp(vpp, z0) {
    const vrms = vppToVrms(vpp);
    const watts = vrmsToWatts(vrms, z0);
    return packSe(wattsToDbm(watts), watts, vrms, vpp, z0);
  }

  function packSe(dbm, watts, vrms, vpp, z0) {
    return {
      drive: "se",
      dbm,
      watts,
      mw: watts * 1000,
      vrms,
      vpk: vrmsToVpk(vrms),
      vpp,
      irms: vrms / z0,
      z0
    };
  }

  function diffFromPortDbm(dbmPort, z0) {
    const se = seFromDbm(dbmPort, z0);
    return {
      drive: "diff",
      dbmPort,
      dbmTotal: wattsToDbm(2 * se.watts),
      wattsPort: se.watts,
      wattsTotal: 2 * se.watts,
      mwPort: se.mw,
      mwTotal: se.mw * 2,
      vrmsSe: se.vrms,
      vpkSe: se.vpk,
      vppSe: se.vpp,
      irmsSe: se.irms,
      vrmsDiff: 2 * se.vrms,
      vpkDiff: 2 * se.vpk,
      vppDiff: 2 * se.vpp,
      z0,
      zDiff: 2 * z0
    };
  }

  function diffFromVppDiff(vppDiff, z0) {
    return diffFromPortDbm(seFromVpp(vppDiff / 2, z0).dbm, z0);
  }

  function fromDbm(dbm, z0, drive) {
    return drive === "diff" ? diffFromPortDbm(dbm, z0) : seFromDbm(dbm, z0);
  }

  function fromVopp(vopp, z0, drive) {
    return drive === "diff" ? diffFromVppDiff(vopp, z0) : seFromVpp(vopp, z0);
  }

  function dbmOf(result) {
    return result.drive === "diff" ? result.dbmPort : result.dbm;
  }

  function voppOf(result) {
    if (result.drive === "diff") return result.vppDiff;
    return result.vpp != null ? result.vpp : result.vppSe;
  }

  function parseNumber(raw) {
    if (raw == null) return NaN;
    const text = String(raw).trim().replace(",", ".");
    if (text === "" || text === "-" || text === "." || text === "-.") return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  }

  function trimFixed(value, digits) {
    if (!Number.isFinite(value)) return "—";
    const rounded = value.toFixed(digits);
    return rounded.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function formatDbm(dbm, digits) {
    if (!Number.isFinite(dbm)) return "—";
    const n = digits == null ? (Math.abs(dbm) >= 100 ? 1 : 2) : digits;
    return Number(dbm).toFixed(n);
  }

  function splitVoltage(volts) {
    if (!Number.isFinite(volts)) return { value: NaN, unit: "V", text: "—" };
    const mag = Math.abs(volts);
    if (mag === 0) return { value: 0, unit: "V", text: "0 V" };
    if (mag < 1e-6) {
      const n = volts * 1e9;
      return { value: n, unit: "nV", text: `${trimFixed(n, 3)} nV` };
    }
    if (mag < 1e-3) {
      const n = volts * 1e6;
      return { value: n, unit: "µV", text: `${trimFixed(n, 3)} µV` };
    }
    if (mag < 1) {
      const n = volts * 1e3;
      return { value: n, unit: "mV", text: `${trimFixed(n, 3)} mV` };
    }
    return { value: volts, unit: "V", text: `${trimFixed(volts, 4)} V` };
  }

  function formatVoltage(volts) {
    return splitVoltage(volts).text;
  }

  function formatPowerWatts(watts) {
    if (!Number.isFinite(watts) || watts < 0) return "—";
    if (watts === 0) return "0 W";
    const mw = watts * 1000;
    if (mw < 1e-6) return `${trimFixed(mw * 1e9, 3)} pW`;
    if (mw < 1e-3) return `${trimFixed(mw * 1e6, 3)} nW`;
    if (mw < 1) return `${trimFixed(mw * 1e3, 3)} µW`;
    if (mw < 1000) return `${trimFixed(mw, 3)} mW`;
    return `${trimFixed(watts, 4)} W`;
  }

  function formatCurrent(amps) {
    if (!Number.isFinite(amps)) return "—";
    const mag = Math.abs(amps);
    if (mag === 0) return "0 A";
    if (mag < 1e-6) return `${trimFixed(amps * 1e9, 3)} nA`;
    if (mag < 1e-3) return `${trimFixed(amps * 1e6, 3)} µA`;
    if (mag < 1) return `${trimFixed(amps * 1e3, 3)} mA`;
    return `${trimFixed(amps, 4)} A`;
  }

  function voltsToUnit(volts, unit) {
    if (!Number.isFinite(volts)) return NaN;
    if (unit === "mV") return volts * 1000;
    if (unit === "µV" || unit === "uV") return volts * 1e6;
    return volts;
  }

  function unitToVolts(value, unit) {
    if (!Number.isFinite(value)) return NaN;
    if (unit === "mV") return value / 1000;
    if (unit === "µV" || unit === "uV") return value / 1e6;
    return value;
  }

  function reflection(zL, zS) {
    if (!(zL > 0) || !(zS > 0)) return NaN;
    return (zL - zS) / (zL + zS);
  }

  function vrmsAtLoadFromAvailable(pavs, zS, zL) {
    if (!(pavs >= 0) || !(zS > 0) || !(zL > 0)) return NaN;
    const voc = 2 * Math.sqrt(pavs * zS);
    return (voc * zL) / (zS + zL);
  }

  function availableFromVrmsAtLoad(vrms, zS, zL) {
    if (!(zS > 0) || !(zL > 0) || !Number.isFinite(vrms)) return NaN;
    const voc = (vrms * (zS + zL)) / zL;
    return (voc * voc) / (4 * zS);
  }

  function zsZl(path, zvna, zdut) {
    if (path === "rx") return { zS: zdut, zL: zvna };
    return { zS: zvna, zL: zdut };
  }

  function packInterface(vrmsSe, zvna, zdut, path, drive) {
    const zz = zsZl(path, zvna, zdut);
    const gamma = reflection(zz.zL, zz.zS);
    const pDel = vrmsToWatts(vrmsSe, zz.zL);
    const pAvs = availableFromVrmsAtLoad(vrmsSe, zz.zS, zz.zL);
    const vppSe = vrmsToVpp(vrmsSe);
    const vpkSe = vrmsToVpk(vrmsSe);
    const vocRms = vrmsSe * (zz.zS + zz.zL) / zz.zL;
    const primaryWatts = path === "rx" ? pDel : pAvs;
    const base = {
      path,
      drive,
      zvna,
      zdut,
      zS: zz.zS,
      zL: zz.zL,
      gamma,
      wattsAvailable: pAvs,
      wattsDelivered: pDel,
      dbmAvailable: wattsToDbm(pAvs),
      dbmDelivered: wattsToDbm(pDel),
      dbm: wattsToDbm(primaryWatts),
      vrmsSe,
      vpkSe,
      vppSe,
      vocRms,
      vocVpp: vrmsToVpp(vocRms),
      irms: vrmsSe / zz.zL
    };
    if (drive === "diff") {
      return Object.assign(base, {
        dbmPort: base.dbm,
        dbmTotalAvailable: wattsToDbm(2 * pAvs),
        dbmTotalDelivered: wattsToDbm(2 * pDel),
        vrmsDiff: 2 * vrmsSe,
        vpkDiff: 2 * vpkSe,
        vppDiff: 2 * vppSe,
        zDiffDut: 2 * zdut,
        zDiffVna: 2 * zvna
      });
    }
    return base;
  }

  function fromDbmPlane(dbm, zvna, zdut, drive, path) {
    if (!(zvna > 0) || !(zdut > 0) || !Number.isFinite(dbm)) return null;
    const zz = zsZl(path, zvna, zdut);
    const watts = dbmToWatts(dbm);
    const vrmsSe = path === "rx"
      ? wattsToVrms(watts, zz.zL)
      : vrmsAtLoadFromAvailable(watts, zz.zS, zz.zL);
    return packInterface(vrmsSe, zvna, zdut, path, drive === "diff" ? "diff" : "se");
  }

  function fromVoppPlane(vopp, zvna, zdut, drive, path) {
    if (!(zvna > 0) || !(zdut > 0) || !(vopp >= 0)) return null;
    const vppSe = drive === "diff" ? vopp / 2 : vopp;
    const vrmsSe = vppToVrms(vppSe);
    return packInterface(vrmsSe, zvna, zdut, path, drive === "diff" ? "diff" : "se");
  }

  function gammaFromRl(rl) {
    if (!Number.isFinite(rl)) return NaN;
    return Math.pow(10, -rl / 20);
  }

  function rlFromGamma(gamma) {
    if (!(gamma > 0) || !Number.isFinite(gamma)) {
      return gamma === 0 ? Infinity : NaN;
    }
    return -20 * Math.log10(gamma);
  }

  function vswrFromGamma(gamma) {
    if (!Number.isFinite(gamma) || gamma < 0) return NaN;
    if (gamma >= 1) return Infinity;
    return (1 + gamma) / (1 - gamma);
  }

  function gammaFromVswr(vswr) {
    if (!Number.isFinite(vswr) || vswr < 1) return NaN;
    return (vswr - 1) / (vswr + 1);
  }

  function mismatchLossFromGamma(gamma) {
    if (!Number.isFinite(gamma) || gamma < 0) return NaN;
    if (gamma >= 1) return Infinity;
    return -10 * Math.log10(1 - gamma * gamma);
  }

  function gammaFromMismatchLoss(mloss) {
    if (!Number.isFinite(mloss) || mloss < 0) return NaN;
    const delivered = Math.pow(10, -mloss / 10);
    if (delivered > 1) return NaN;
    return Math.sqrt(1 - delivered);
  }

  function matchFromGamma(gamma) {
    return {
      gamma,
      rl: rlFromGamma(gamma),
      vswr: vswrFromGamma(gamma),
      mloss: mismatchLossFromGamma(gamma),
      delivered: gamma < 1 ? 1 - gamma * gamma : 0
    };
  }

  function ip3FromDbc(pToneDbm, im3Dbc, gainDb) {
    if (!Number.isFinite(pToneDbm) || !Number.isFinite(im3Dbc)) {
      return null;
    }
    const delta = -im3Dbc;
    const iip3 = pToneDbm + delta / 2;
    const g = Number.isFinite(gainDb) ? gainDb : NaN;
    const oip3 = Number.isFinite(g) ? iip3 + g : NaN;
    return {
      pToneDbm,
      im3Dbc,
      im3Dbm: pToneDbm + im3Dbc,
      delta,
      iip3,
      oip3,
      gainDb: g,
      p1dbThumb: Number.isFinite(oip3) ? oip3 - 10 : NaN
    };
  }

  function ip3FromAbs(pToneDbm, im3Dbm, gainDb) {
    if (!Number.isFinite(pToneDbm) || !Number.isFinite(im3Dbm)) return null;
    return ip3FromDbc(pToneDbm, im3Dbm - pToneDbm, gainDb);
  }

  function p1dbFromInput(gainDb, pin1dB) {
    if (!Number.isFinite(gainDb) || !Number.isFinite(pin1dB)) return null;
    return {
      gainDb,
      pin1dB,
      pout1dB: pin1dB + gainDb - 1,
      poutLinear: pin1dB + gainDb
    };
  }

  function p1dbFromOutput(gainDb, pout1dB) {
    if (!Number.isFinite(gainDb) || !Number.isFinite(pout1dB)) return null;
    return p1dbFromInput(gainDb, pout1dB - gainDb + 1);
  }

  function compressionAt(gainDb, pin, poutMeas) {
    if (!Number.isFinite(gainDb) || !Number.isFinite(pin) || !Number.isFinite(poutMeas)) {
      return null;
    }
    const poutLinear = pin + gainDb;
    return {
      gainDb,
      pin,
      poutMeas,
      poutLinear,
      gainMeas: poutMeas - pin,
      compression: poutLinear - poutMeas
    };
  }

  function thdFromDbc(harmonicsDbc) {
    const terms = (harmonicsDbc || []).filter(Number.isFinite);
    const sum = terms.reduce(function (acc, dbc) {
      return acc + Math.pow(10, dbc / 10);
    }, 0);
    const ratio = Math.sqrt(sum);
    return {
      ratio,
      percent: 100 * ratio,
      db: ratio > 0 ? 20 * Math.log10(ratio) : -Infinity,
      count: terms.length
    };
  }

  function twoToneFromToneDbm(dbmTone, z0, drive) {
    const one = fromDbm(dbmTone, z0, drive || "se");
    const vppOne = voppOf(one);
    const vpkOne = one.drive === "diff" ? one.vpkDiff : one.vpk;
    const ports = one.drive === "diff" ? 2 : 1;
    return {
      drive: one.drive,
      z0,
      dbmTone,
      dbmPortAvg: dbmTone + DB_3,
      dbmPortPep: dbmTone + DB_6,
      dbmTotalAvg: dbmTone + DB_3 + 10 * Math.log10(ports),
      dbmTotalPep: dbmTone + DB_6 + 10 * Math.log10(ports),
      vppOne,
      vpkOne,
      vpkEnv: 2 * vpkOne,
      vppEnv: 2 * vppOne,
      paprVsToneDb: DB_6,
      paprVsAvgDb: DB_3
    };
  }

  function guidedWavelength(freqHz, er) {
    if (!(freqHz > 0) || !(er > 0)) return NaN;
    return C_LIGHT / freqHz / Math.sqrt(er);
  }

  function delayFromLength(lengthM, er) {
    if (!(lengthM >= 0) || !(er > 0)) return NaN;
    return (lengthM * Math.sqrt(er)) / C_LIGHT;
  }

  function lengthFromDelay(delayS, er) {
    if (!(delayS >= 0) || !(er > 0)) return NaN;
    return (delayS * C_LIGHT) / Math.sqrt(er);
  }

  function degreesFromLength(lengthM, freqHz, er) {
    const lambda = guidedWavelength(freqHz, er);
    if (!(lambda > 0) || !Number.isFinite(lengthM)) return NaN;
    return (360 * lengthM) / lambda;
  }

  function lengthFromDegrees(deg, freqHz, er) {
    const lambda = guidedWavelength(freqHz, er);
    if (!(lambda > 0) || !Number.isFinite(deg)) return NaN;
    return (deg / 360) * lambda;
  }

  function vfFromEr(er) {
    if (!(er > 0)) return NaN;
    return 1 / Math.sqrt(er);
  }

  function erFromVf(vf) {
    if (!(vf > 0)) return NaN;
    return 1 / (vf * vf);
  }

  function formatVswr(vswr) {
    if (!Number.isFinite(vswr)) return "∞";
    if (vswr >= 100) return vswr.toFixed(1);
    return vswr.toFixed(3);
  }

  const RF = {
    SQRT2,
    TWO_SQRT2,
    C_LIGHT,
    DB_3,
    DB_6,
    dbmToWatts,
    wattsToDbm,
    wattsToVrms,
    vrmsToWatts,
    vrmsToVpp,
    vppToVrms,
    vrmsToVpk,
    seFromDbm,
    seFromVpp,
    diffFromPortDbm,
    diffFromVppDiff,
    fromDbm,
    fromVopp,
    dbmOf,
    voppOf,
    parseNumber,
    trimFixed,
    formatDbm,
    splitVoltage,
    formatVoltage,
    formatPowerWatts,
    formatCurrent,
    voltsToUnit,
    unitToVolts,
    reflection,
    vrmsAtLoadFromAvailable,
    availableFromVrmsAtLoad,
    fromDbmPlane,
    fromVoppPlane,
    gammaFromRl,
    rlFromGamma,
    vswrFromGamma,
    gammaFromVswr,
    mismatchLossFromGamma,
    gammaFromMismatchLoss,
    matchFromGamma,
    ip3FromDbc,
    ip3FromAbs,
    p1dbFromInput,
    p1dbFromOutput,
    compressionAt,
    thdFromDbc,
    twoToneFromToneDbm,
    guidedWavelength,
    delayFromLength,
    lengthFromDelay,
    degreesFromLength,
    lengthFromDegrees,
    vfFromEr,
    erFromVf,
    formatVswr
  };

  if (typeof module === "object" && module.exports) {
    module.exports = RF;
  } else {
    root.RF = RF;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
