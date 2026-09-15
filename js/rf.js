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
    if (watts === 0) return -Infinity;
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

  // Plain decimal notation only: no hex, binary, octal, or Infinity. A comma is a
  // decimal mark ("0,25") or a thousands separator ("1,000", "1,000.5", "1.000,5").
  const DECIMAL = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
  function parseNumber(raw) {
    if (raw == null) return NaN;
    let text = String(raw).trim();
    if (text.includes(",")) {
      if (text.includes(".")) {
        const thousands = text.lastIndexOf(".") > text.lastIndexOf(",") ? "," : ".";
        text = text.split(thousands).join("").replace(",", ".");
      } else if (/^[-+]?[1-9]\d{0,2}(,\d{3})+$/.test(text)) {
        text = text.split(",").join("");
      } else if (text.split(",").length === 2) {
        text = text.replace(",", ".");
      } else {
        return NaN;
      }
    }
    if (!DECIMAL.test(text)) return NaN;
    const value = Number(text);
    return Number.isFinite(value) ? value : NaN;
  }

  // Presentation only: four significant figures for linear quantities, and
  // hundredths for logarithmic levels/angles, including near zero.
  // Tiny linear quantities (e.g. delays in seconds) retain significant figures.
  function formatNumber(value, unit) {
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '-∞';
    if (!Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    const mag = Math.abs(value);
    if (['dB', 'dBm', 'dBc', 'deg'].includes(unit) && mag < 1e6) return String(Number(value.toFixed(2)));
    const rounded = Number(value.toPrecision(4));
    return Math.abs(rounded) >= 1e6 || Math.abs(rounded) < 1e-3 ? rounded.toExponential().replace('e+', 'e') : String(rounded);
  }

  function parseZero(raw) {
    return raw != null && String(raw).trim() === '' ? 0 : parseNumber(raw);
  }

  function formatDbm(dbm, digits) {
    if (dbm === -Infinity) return "−∞";
    if (!Number.isFinite(dbm)) return "—";
    const n = digits == null ? 2 : digits;
    const rounded = Number(dbm.toFixed(n));
    return rounded === 0 ? "0" : rounded.toFixed(n);
  }

  function splitVoltage(volts) {
    if (!Number.isFinite(volts)) return { value: NaN, unit: "V", text: "—" };
    const mag = Math.abs(volts);
    if (mag === 0) return { value: 0, unit: "V", text: "0 V" };
    if (mag < 1e-6) {
      const n = volts * 1e9;
      return { value: n, unit: "nV", text: `${formatNumber(n)} nV` };
    }
    if (mag < 1e-3) {
      const n = volts * 1e6;
      return { value: n, unit: "µV", text: `${formatNumber(n)} µV` };
    }
    if (mag < 1) {
      const n = volts * 1e3;
      return { value: n, unit: "mV", text: `${formatNumber(n)} mV` };
    }
    return { value: volts, unit: "V", text: `${formatNumber(volts)} V` };
  }

  function formatVoltage(volts) {
    return splitVoltage(volts).text;
  }

  function formatPowerWatts(watts) {
    if (!Number.isFinite(watts) || watts < 0) return "—";
    if (watts === 0) return "0 W";
    const mw = watts * 1000;
    if (mw < 1e-6) return `${formatNumber(mw * 1e9)} pW`;
    if (mw < 1e-3) return `${formatNumber(mw * 1e6)} nW`;
    if (mw < 1) return `${formatNumber(mw * 1e3)} µW`;
    if (mw < 1000) return `${formatNumber(mw)} mW`;
    return `${formatNumber(watts)} W`;
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

  // Passive loads, real positive reference impedance. Handles short and open.
  function complexMatch(r, x, z0) {
    if (![r, x, z0].every(Number.isFinite) || r < 0 || !(z0 > 0)) return null;
    const a = r / z0, b = x / z0;
    const den = (a + 1) ** 2 + b * b;
    if (!Number.isFinite(den)) return null;
    return matchFromComplexGamma((a * a + b * b - 1) / den, 2 * b / den, z0);
  }

  function matchFromComplexGamma(re, im, z0) {
    if (![re, im, z0].every(Number.isFinite) || !(z0 > 0)) return null;
    let mag = Math.hypot(re, im);
    if (mag > 1 + 1e-12) return null;
    if (mag > 1) { re /= mag; im /= mag; mag = 1; }
    const den = (1 - re) ** 2 + im * im;
    const r = den === 0 ? Infinity : z0 * Math.max(0, 1 - mag * mag) / den;
    const x = den === 0 ? 0 : z0 * 2 * im / den;
    return Object.assign(matchFromGamma(mag), { re, im, r, x, z0,
      phase: mag === 0 ? 0 : Math.atan2(im, re) * 180 / Math.PI });
  }

  // Absolute IM3 is measured at the OUTPUT. dBc is relative to one output tone.
  function ip3Measurement(tone, im3, gain, plane, unit) {
    if (![tone, im3].every(Number.isFinite) || !['input', 'output'].includes(plane) || !['dbc', 'dbm'].includes(unit)) return null;
    const hasGain = Number.isFinite(gain);
    const outputTone = plane === 'output' ? tone : hasGain ? tone + gain : NaN;
    if (unit === 'dbm' && !Number.isFinite(outputTone)) return null;
    const dbc = unit === 'dbc' ? im3 : im3 - outputTone;
    if (dbc > 0) return null;
    const intercept = tone - dbc / 2;
    const iip3 = plane === 'input' ? intercept : hasGain ? intercept - gain : NaN;
    const oip3 = plane === 'output' ? intercept : hasGain ? intercept + gain : NaN;
    return { iip3, oip3, delta: -dbc, im3Dbc: dbc, outputTone,
      im3Output: Number.isFinite(outputTone) ? outputTone + dbc : NaN };
  }

  // Phase must be unwrapped. Reflection includes the outward and return paths.
  function phaseDelay(f1, f2, phase1, phase2, turns, mode, vf) {
    if (![f1, f2, phase1, phase2, turns, vf].every(Number.isFinite) ||
        !(f1 > 0) || !(f2 > f1) || !Number.isInteger(turns) || !(vf > 0 && vf <= 1) ||
        !['transmission', 'reflection'].includes(mode)) return null;
    const deltaPhase = phase2 - phase1 + 360 * turns;
    const traceDelay = -deltaPhase / (360 * (f2 - f1));
    const oneWayDelay = traceDelay / (mode === 'reflection' ? 2 : 1);
    return { deltaPhase, traceDelay, oneWayDelay, length: oneWayDelay * C_LIGHT * vf };
  }

  const K_BOLTZMANN = 1.380649e-23;
  const T_REF = 290;
  function cascade(stages, inputDbm, bandwidth, sourceTemperature) {
    if (!Array.isArray(stages) || stages.length > 24 ||
        ![inputDbm, bandwidth, sourceTemperature].every(Number.isFinite) ||
        !(bandwidth > 0) || !(sourceTemperature > 0)) return null;
    let gain = 1, factor = 1, gainDb = 0;
    const rows = [];
    for (const stage of stages) {
      if (!stage || !['active', 'passive'].includes(stage.kind) || !Number.isFinite(stage.db)) return null;
      const passive = stage.kind === 'passive';
      if (passive && (!(stage.db >= 0) || !(stage.temperature > 0) || !Number.isFinite(stage.temperature))) return null;
      if (!passive && (!(stage.nf >= 0) || !Number.isFinite(stage.nf))) return null;
      if (stage.limit != null && !Number.isFinite(stage.limit)) return null;
      const stageGainDb = passive ? -stage.db : stage.db;
      const stageGain = 10 ** (stageGainDb / 10);
      const stageFactor = passive ? 1 + (1 / stageGain - 1) * stage.temperature / T_REF : 10 ** (stage.nf / 10);
      const contribution = (stageFactor - 1) / gain;
      factor += contribution;
      gain *= stageGain;
      gainDb += stageGainDb;
      const outputDbm = inputDbm + gainDb;
      const noiseWatts = K_BOLTZMANN * (sourceTemperature + (factor - 1) * T_REF) * bandwidth * gain;
      if (![gain, factor, outputDbm, noiseWatts].every(Number.isFinite) || !(gain > 0) || !(noiseWatts > 0)) return null;
      rows.push({ gainDb: stageGainDb, cumulativeGainDb: gainDb, outputDbm, contribution,
        stageNf: 10 * Math.log10(stageFactor), nf: 10 * Math.log10(factor),
        noiseDbm: wattsToDbm(noiseWatts), headroom: stage.limit == null ? null : stage.limit - outputDbm });
    }
    const equivalentTemperature = (factor - 1) * T_REF;
    const noiseWatts = K_BOLTZMANN * (sourceTemperature + equivalentTemperature) * bandwidth * gain;
    if (!(noiseWatts > 0) || !Number.isFinite(noiseWatts)) return null;
    const noiseDbm = wattsToDbm(noiseWatts);
    return { rows, gainDb, factor, nf: 10 * Math.log10(factor), equivalentTemperature,
      outputDbm: inputDbm + gainDb, noiseDbm, inputNoiseDbm: wattsToDbm(K_BOLTZMANN * sourceTemperature * bandwidth),
      snr: inputDbm + gainDb - noiseDbm };
  }

  // Frequency text with an optional SI prefix or unit: "10k", "100 MHz", "10G". Bare numbers use defaultScale.
  const FREQUENCY_SCALE = { '': 1, hz: 1, k: 1e3, khz: 1e3, m: 1e6, mhz: 1e6, g: 1e9, ghz: 1e9, t: 1e12, thz: 1e12 };
  function parseFrequency(raw, defaultScale) {
    if (raw == null) return NaN;
    const match = String(raw).trim().match(/^(.*?)\s*([kKmMgGtT]?(?:[hH][zZ])?)$/);
    if (!match) return NaN;
    const number = parseNumber(match[1]), suffix = match[2].toLowerCase();
    if (!Number.isFinite(number)) return NaN;
    return number * (suffix === '' ? (defaultScale > 0 ? defaultScale : 1) : FREQUENCY_SCALE[suffix]);
  }

  // The numeric part of a frequency entry. Picking a unit strips a typed suffix so the
  // selector, not stale text, decides what the digits mean.
  function frequencyDigits(raw) {
    if (raw == null) return '';
    const text = String(raw).trim();
    const match = text.match(/^(.*?)\s*[kKmMgGtT]?(?:[hH][zZ])?$/);
    return match ? match[1] : text;
  }

  // Frequencies keep up to ten significant digits so sweep boundaries read exactly.
  function formatFrequency(hz) {
    if (!Number.isFinite(hz)) return { value: NaN, unit: 'Hz', text: '—' };
    const mag = Math.abs(hz);
    const unit = mag >= 1e9 ? 'GHz' : mag >= 1e6 ? 'MHz' : mag >= 1e3 ? 'kHz' : 'Hz';
    const value = Number((hz / FREQUENCY_SCALE[unit.toLowerCase()]).toPrecision(10));
    return { value, unit, text: `${value} ${unit}` };
  }

  // Linear sweep from start to stop in equal steps. The step divides the span when `exact`;
  // otherwise `points` is the count that fits without passing stop, and the alternatives land on stop.
  function sweepPoints(start, stop, step) {
    if (![start, stop, step].every(Number.isFinite) || !(step > 0) || stop < start) return null;
    const span = stop - start, n = span / step, nearest = Math.round(n);
    const exact = Math.abs(n - nearest) <= 1e-9 * Math.max(1, n);
    const points = (exact ? nearest : Math.floor(n)) + 1;
    return { start, stop, step, span, points, exact, lastPoint: exact ? stop : start + (points - 1) * step,
      pointsCeil: exact ? points : Math.ceil(n) + 1, stepCeil: exact ? step : span / Math.ceil(n),
      stepFloor: exact ? step : Math.floor(n) > 0 ? span / Math.floor(n) : NaN };
  }

  function sweepStep(start, stop, points) {
    if (![start, stop].every(Number.isFinite) || !Number.isInteger(points) || points < 1 || stop < start) return null;
    if (points === 1) return stop === start ? { start, stop, points, step: 0, span: 0, exact: true, lastPoint: stop } : null;
    return { start, stop, points, step: (stop - start) / (points - 1), span: stop - start, exact: true, lastPoint: stop };
  }

  // Planning estimate, not an instrument timing specification. Pairwise correction
  // uses P(P-1) passes; this is a selectable sequence, not a universal port multiplier.
  // Source and custom modes allow other acquisition sequences without assuming that
  // the number of displayed S-parameters equals the number of passes.
  function sweepTiming(points, segments, options = {}) {
    const { ports = 1, sequence = 'source', customPasses = 1, averages = 1,
      ifbw = null, ifFactor = 1, pointOverhead = 0, segmentOverhead = 0,
      cycleOverhead = 0 } = options;
    if (!Number.isSafeInteger(points) || points < 1 || !Number.isSafeInteger(segments) || segments < 1 ||
        !Number.isInteger(ports) || ports < 1 || ports > 4 ||
        !['pairwise', 'source', 'custom'].includes(sequence) ||
        !Number.isSafeInteger(averages) || averages < 1 ||
        !Number.isFinite(ifFactor) || ifFactor <= 0 ||
        (ifbw !== null && (!Number.isFinite(ifbw) || ifbw <= 0)) ||
        ![pointOverhead, segmentOverhead, cycleOverhead].every(v => Number.isFinite(v) && v >= 0) ||
        (sequence === 'custom' && (!Number.isSafeInteger(customPasses) || customPasses < 1))) return null;
    const passes = sequence === 'custom' ? customPasses : sequence === 'source' ? ports : Math.max(1, ports * (ports - 1));
    const acquisitionTime = ifbw === null ? NaN : points * ifFactor / ifbw;
    const passOverhead = points * pointOverhead + segments * segmentOverhead;
    const passTime = acquisitionTime + passOverhead;
    const measurementTime = passes * passTime + cycleOverhead;
    const averagedTime = averages * measurementTime;
    if (ifbw !== null && ![acquisitionTime, passTime, measurementTime, averagedTime].every(Number.isFinite)) return null;
    return { ports, sequence, passes, averages, ifFactor, acquisitionTime, passOverhead,
      pointOverhead, segmentOverhead, cycleOverhead, passTime, measurementTime, averagedTime };
  }

  // Segment table: per-segment point counts and relative spacing, boundary continuity, and jumps.
  // mode 'relative' compares Δf/f at segment starts; mode 'absolute' compares step sizes.
  // A boundary is "sharp" outside 1/jumpLimit .. jumpLimit (default 3x).
  function segmentedSweep(segments, options) {
    const opts = options || {};
    if (!Array.isArray(segments) || segments.length === 0 || segments.length > 100) return null;
    const rows = [];
    for (const segment of segments) {
      if (!segment || !(segment.start > 0)) return null;
      const linear = sweepPoints(segment.start, segment.stop, segment.step);
      if (!linear) return null;
      rows.push(Object.assign(linear, {
        fractionalStart: linear.step / linear.start, fractionalStop: linear.step / linear.lastPoint,
        pointsPerDecadeStart: 1 / Math.log10(1 + linear.step / linear.start),
        pointsPerDecadeStop: 1 / Math.log10(1 + linear.step / linear.lastPoint) }));
    }
    // Average density counts a segment as covering [start, next start) so a 1..9 decade is 9 per decade.
    rows.forEach((r, i) => {
      const next = rows[i + 1], end = next && next.start > r.lastPoint ? next.start : r.lastPoint + r.step;
      r.decadePoints = r.points / Math.log10(end / r.start);
    });
    const jumpLimit = opts.jumpLimit > 1 ? opts.jumpLimit : 3, mode = opts.mode === 'absolute' ? 'absolute' : 'relative';
    const outside = ratio => ratio > jumpLimit || ratio < 1 / jumpLimit;
    const boundaries = [];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i], gap = b.start - a.lastPoint;
      const kind = gap < 0 ? 'overlap' : gap === 0 ? 'duplicate' : gap <= a.step * (1 + 1e-9) ? 'contiguous' : 'gap';
      const stepRatio = b.step / a.step, patternRatio = b.fractionalStart / a.fractionalStart;
      boundaries.push({ index: i, frequency: b.start, gap, kind, stepRatio, patternRatio, previousStep: a.step,
        fractionalRatio: b.fractionalStart / a.fractionalStop,
        sharp: outside(mode === 'relative' ? patternRatio : stepRatio) });
    }
    const points = rows.reduce((sum, r) => sum + r.points, 0);
    const first = rows[0].start, last = rows[rows.length - 1].lastPoint;
    const fine = Math.min(...rows.map(r => r.fractionalStop)), coarse = Math.max(...rows.map(r => r.fractionalStart));
    const logPoints = ratio => last > first ? Math.ceil(Math.log(last / first) / Math.log(1 + ratio)) + 1 : 1;
    const maxPoints = Number.isInteger(opts.maxPoints) && opts.maxPoints > 0 ? opts.maxPoints : null;
    const ifbw = opts.ifbw > 0 ? opts.ifbw : null;
    // Legacy single-pass approximation. Use sweepTiming for complete measurement estimates.
    const pointOverhead = opts.pointOverhead > 0 ? opts.pointOverhead : 0;
    const segmentOverhead = opts.segmentOverhead > 0 ? opts.segmentOverhead : 0;
    const overheadTime = points * pointOverhead + rows.length * segmentOverhead;
    return { rows, boundaries, points, first, last, jumpLimit, mode, maxPoints, ifbw,
      headroom: maxPoints === null ? null : maxPoints - points,
      sweepTime: ifbw === null ? NaN : points / ifbw,
      pointOverhead, segmentOverhead, overheadTime,
      sweepTimeTotal: ifbw === null ? (overheadTime > 0 ? overheadTime : NaN) : points / ifbw + overheadTime,
      inexact: rows.filter(r => !r.exact).length,
      decadePoints: { min: Math.min(...rows.map(r => r.decadePoints)), max: Math.max(...rows.map(r => r.decadePoints)) },
      problems: rows.filter(r => !r.exact).length + boundaries.filter(b => b.sharp || b.kind !== 'contiguous').length + (maxPoints !== null && points > maxPoints ? 1 : 0),
      log: { fine, coarse, finePoints: logPoints(fine), coarsePoints: logPoints(coarse) } };
  }

  // Ripple between two mismatches facing each other, from their return losses in dB. The
  // reflections interact through their product, and the trace moves between 20 log10(1 ± |Γ1Γ2|).
  function mismatchRipple(rl1, rl2) {
    if (![rl1, rl2].every(v => Number.isFinite(v) && v >= 0)) return null;
    const gamma1 = Math.pow(10, -rl1 / 20), gamma2 = Math.pow(10, -rl2 / 20), product = gamma1 * gamma2;
    const up = 20 * Math.log10(1 + product), down = product < 1 ? 20 * Math.log10(1 - product) : -Infinity;
    return { rl1, rl2, gamma1, gamma2, product, up, down, peakToPeak: up - down };
  }

  // ----- Single-ended to mixed-mode S-parameters -----
  // A logical port is one physical port (single-ended) or a pair. The differential and
  // common-mode waves of a pair are (a_p - a_q)/sqrt 2 and (a_p + a_q)/sqrt 2, so the whole
  // conversion is Smm = T S T^T with T orthogonal. Rows come out differential first, then
  // single-ended, then common, which is the block ordering analyzers display.
  function mixedModeRows(sides) {
    if (!Array.isArray(sides) || sides.length !== 2) return null;
    const seen = new Set();
    for (const side of sides) {
      if (!side || !Array.isArray(side.ports) || side.ports.length < 1 || side.ports.length > 2) return null;
      for (const port of side.ports) { if (!Number.isInteger(port) || port < 1 || seen.has(port)) return null; seen.add(port); }
    }
    const rows = [];
    sides.forEach((side, index) => {
      const [p, q] = side.ports, number = index + 1;
      if (side.ports.length === 2) rows.push({ side: number, mode: 'd', label: 'd' + number, weights: [{ port: p, w: Math.SQRT1_2 }, { port: q, w: -Math.SQRT1_2 }] });
      else rows.push({ side: number, mode: 's', label: 's' + number, weights: [{ port: p, w: 1 }] });
    });
    sides.forEach((side, index) => {
      const [p, q] = side.ports, number = index + 1;
      if (side.ports.length === 2) rows.push({ side: number, mode: 'c', label: 'c' + number, weights: [{ port: p, w: Math.SQRT1_2 }, { port: q, w: Math.SQRT1_2 }] });
    });
    return rows;
  }
  const fromPolar = (db, deg) => { const m = Math.pow(10, db / 20), a = (deg * Math.PI) / 180; return { re: m * Math.cos(a), im: m * Math.sin(a) }; };
  const toPolar = z => { const mag = Math.hypot(z.re, z.im); return { re: z.re, im: z.im, mag, db: mag > 0 ? 20 * Math.log10(mag) : -Infinity, deg: mag > 0 ? (Math.atan2(z.im, z.re) * 180) / Math.PI : 0 }; };
  // S is indexed by physical port number: S[i][j] = { re, im } for i, j in the mapping.
  function mixedMode(S, sides) {
    const rows = mixedModeRows(sides);
    if (!rows) return null;
    const ports = sides.flatMap(side => side.ports);
    for (const i of ports) for (const j of ports) {
      const z = S && S[i] && S[i][j];
      if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return null;
    }
    const entries = [];
    rows.forEach((r, ri) => rows.forEach((c, ci) => {
      const terms = [];
      let re = 0, im = 0;
      for (const a of r.weights) for (const b of c.weights) {
        const coefficient = a.w * b.w;
        terms.push({ coefficient, i: a.port, j: b.port });
        re += coefficient * S[a.port][b.port].re; im += coefficient * S[a.port][b.port].im;
      }
      // A balanced entry cancels exactly in algebra and to about 1e-17 in floating point;
      // report that as zero rather than as a -340 dB residue.
      if (Math.hypot(re, im) < 1e-12) { re = 0; im = 0; }
      entries.push({ row: ri, col: ci, name: 'S' + r.mode + c.mode + r.side + c.side, from: c, to: r, terms, value: toPolar({ re, im }) });
    }));
    const byName = {};
    entries.forEach(entry => { byName[entry.name] = entry; });
    return { rows, entries, byName, ports };
  }

  // What arrives at the receiver against its 0.1 dB compression and damage levels, and the
  // attenuator that would bring it under the compression point with the margin asked for,
  // rounded up to a stock value.
  const PAD_VALUES = [1, 2, 3, 6, 10, 20, 30, 40];
  function receiverBudget(levelDbm, opts) {
    const o = opts || {};
    if (![levelDbm, o.compression, o.damage].every(Number.isFinite) || !(o.margin >= 0) || !Number.isFinite(o.margin)) return null;
    const headroom = o.compression - levelDbm, damageHeadroom = o.damage - levelDbm;
    const excess = Math.max(0, levelDbm - (o.compression - o.margin));
    const stock = PAD_VALUES.find(v => v >= excess);
    const pad = excess === 0 ? 0 : stock === undefined ? Math.ceil(excess) : stock;
    return { level: levelDbm, compression: o.compression, damage: o.damage, margin: o.margin, headroom, damageHeadroom, excess, pad, afterPad: levelDbm - pad,
      state: damageHeadroom < 0 ? 'damage' : headroom < o.margin ? 'compress' : 'ok' };
  }

  // Time-domain transform limits of a linear sweep. The alias-free range is 1/Δf in round-trip
  // time, half that one way, and the response resolution is about 1/span. A segmented table has
  // no single Δf, and analyzers do not transform it.
  function timeDomain(step, span) {
    if (!(step > 0) || !(span > 0) || ![step, span].every(Number.isFinite)) return null;
    return { range: 1 / step, rangeOneWay: 0.5 / step, resolution: 1 / span };
  }

  // Receiver noise floor against IF bandwidth and averaging. The datasheet quotes a floor at
  // one bandwidth; it moves 10 dB per decade of bandwidth and drops 10 log10(N) with N averages.
  // A level 'signal' dBm sits some margin above it, and that margin sets the trace noise: the
  // in-phase noise component has an amplitude 10^(-SNR/20)/sqrt(2) of the signal, which reads
  // as (20/ln 10) times that in dB rms and (180/pi) times it in degrees rms.
  function noiseFloor(opts) {
    const o = opts || {};
    const averages = o.averages === undefined ? 1 : o.averages;
    if (![o.floorRef, o.ifbwRef, o.ifbw].every(Number.isFinite) || !(o.ifbwRef > 0) || !(o.ifbw > 0) || !(averages >= 1) || !Number.isFinite(averages)) return null;
    const bandwidthTerm = 10 * Math.log10(o.ifbw / o.ifbwRef), averagingTerm = -10 * Math.log10(averages);
    const floor = o.floorRef + bandwidthTerm + averagingTerm;
    const result = { floorRef: o.floorRef, ifbwRef: o.ifbwRef, ifbw: o.ifbw, averages, bandwidthTerm, averagingTerm, floor,
      signal: null, snr: null, amplitude: null, traceNoiseDb: null, traceNoiseDeg: null, ifbwFor: null };
    if (Number.isFinite(o.signal)) {
      const snr = o.signal - floor, amplitude = Math.pow(10, -snr / 20) / Math.SQRT2;
      result.signal = o.signal; result.snr = snr; result.amplitude = amplitude;
      result.traceNoiseDb = (20 / Math.LN10) * amplitude;
      result.traceNoiseDeg = (180 / Math.PI) * amplitude;
      // The widest bandwidth that still leaves a given margin, with the same averaging.
      result.ifbwFor = margin => o.ifbwRef * averages * Math.pow(10, (o.signal - o.floorRef - margin) / 10);
    }
    return result;
  }

  // Log-style table: points at 1, 1+k, 1+2k, ... times each decade (k = multiplierStep), one linear
  // segment per decade, optionally followed by a linear tail from tailStart to stop.
  function logTable(start, stop, multiplierStep, tailStart, tailStep) {
    const k = multiplierStep, tail = Number.isFinite(tailStart);
    if (!(start > 0) || !(stop > start) || !(k > 0) || !(k <= 9)) return null;
    if (tail && (!(tailStart > start) || !(tailStart <= stop) || !(tailStep > 0))) return null;
    const logStop = tail ? tailStart : stop, segments = [], round = f => Number(f.toPrecision(12));
    for (let n = Math.floor(Math.log10(start) + 1e-9); segments.length <= 60; n++) {
      const base = Math.pow(10, n);
      if (base > logStop * (1 + 1e-9)) break;
      const points = [];
      for (let m = 1; m < 10 - 1e-9; m = round(m + k)) {
        const f = round(m * base);
        if (f < start * (1 - 1e-12)) continue;
        if (tail ? f >= logStop * (1 - 1e-12) : f > logStop * (1 + 1e-12)) break;
        points.push(f);
      }
      if (points.length) segments.push({ start: points[0], stop: points[points.length - 1], step: round(k * base) });
    }
    if (segments.length > 60) return null;
    if (tail) segments.push({ start: tailStart, stop, step: tailStep });
    return segments.length ? segments : null;
  }

  // Two-tone frequency plan. Odd-order products land on a uniform grid of spacing Δ:
  // order 2k+1 sits at f1 − kΔ and f2 + kΔ, so IM3 is one spacing outside each tone.
  // Even-order products fall near DC and near the second harmonic.
  function tonePlan(f1, f2, options) {
    const opts = options || {};
    if (!(f1 > 0) || !(f2 > f1)) return null;
    const delta = f2 - f1, center = (f1 + f2) / 2;
    const band = opts.band && opts.band.low > 0 && opts.band.high > opts.band.low ? opts.band : null;
    const maxOrder = Number.isInteger(opts.maxOrder) && opts.maxOrder >= 3 ? Math.min(opts.maxOrder, 15) : 7;
    const products = [{ order: 1, label: 'f1', frequency: f1 }, { order: 1, label: 'f2', frequency: f2 }];
    for (let k = 1; 2 * k + 1 <= maxOrder; k++) {
      products.push({ order: 2 * k + 1, label: `${k + 1}f1−${k}f2`, frequency: f1 - k * delta },
        { order: 2 * k + 1, label: `${k + 1}f2−${k}f1`, frequency: f2 + k * delta });
    }
    products.push({ order: 2, label: 'f2−f1', frequency: delta }, { order: 2, label: 'f1+f2', frequency: f1 + f2 },
      { order: 2, label: '2f1', frequency: 2 * f1 }, { order: 2, label: '2f2', frequency: 2 * f2 });
    for (const product of products) {
      product.valid = product.frequency > 0;
      product.inBand = band && product.valid ? product.frequency >= band.low && product.frequency <= band.high : null;
    }
    products.sort((a, b) => a.frequency - b.frequency);
    // Whichever floor is highest is the one that limits an IM3 measurement.
    const rbw = opts.rbw > 0 ? opts.rbw : null, tone = opts.toneLevel;
    const floors = [];
    if (rbw !== null && Number.isFinite(opts.danl) && Number.isFinite(tone)) {
      floors.push({ source: 'Analyzer noise floor', dbc: opts.danl + 10 * Math.log10(rbw) - tone });
    }
    if (rbw !== null && Number.isFinite(opts.phaseNoise)) {
      floors.push({ source: 'Phase noise at Δ offset', dbc: opts.phaseNoise + 10 * Math.log10(rbw) });
    }
    if (Number.isFinite(opts.toi) && Number.isFinite(tone)) {
      floors.push({ source: 'Analyzer third-order products', dbc: 2 * (tone - opts.toi) });
    }
    const limit = floors.length ? floors.reduce((a, b) => b.dbc > a.dbc ? b : a) : null;
    return { f1, f2, delta, center, products, band, maxOrder, floors, limit,
      im3Lower: f1 - delta, im3Upper: f2 + delta, im3Span: 3 * delta,
      rbw, rbwMax: delta / 10, resolved: rbw === null ? null : rbw <= delta / 10,
      envelopeBeat: delta, envelopeBandwidth: 5 * delta,
      outOfBand: band ? products.filter(p => p.valid && p.order > 1 && p.inBand === false).length : null };
  }

  // Harmonic frequencies with instrument-range and DUT-passband checks.
  function harmonicPlan(f0, count, options) {
    const opts = options || {};
    if (!(f0 > 0) || !Number.isInteger(count) || count < 2 || count > 20) return null;
    const band = opts.band && opts.band.low > 0 && opts.band.high > opts.band.low ? opts.band : null;
    const instrumentMax = opts.instrumentMax > 0 ? opts.instrumentMax : null;
    const rows = [];
    for (let n = 1; n <= count; n++) {
      const frequency = n * f0;
      rows.push({ n, frequency,
        aboveInstrument: instrumentMax === null ? null : frequency > instrumentMax,
        inBand: band ? frequency >= band.low && frequency <= band.high : null });
    }
    return { f0, count, rows, band, instrumentMax,
      highestMeasurable: instrumentMax === null ? null : Math.floor(instrumentMax / f0),
      maxFundamental: instrumentMax === null ? null : instrumentMax / count };
  }

  // Attenuation of harmonic n relative to the fundamental through a p-pole rolloff at fc.
  // Negative: the harmonic is suppressed, so a measured dBc understates the intrinsic one.
  // Valid only when the nonlinearity precedes the band limit and the device is not slewing.
  function bandLimitAttenuation(f0, fc, n, poles) {
    const p = poles == null ? 1 : poles;
    if (!(f0 > 0) || !(fc > 0) || !(n >= 1) || !(p >= 1) || ![f0, fc, n, p].every(Number.isFinite)) return NaN;
    return 10 * p * Math.log10((1 + (f0 / fc) ** 2) / (1 + (n * f0 / fc) ** 2));
  }

  function bandLimitedThd(harmonics, f0, fc, poles) {
    if (!Array.isArray(harmonics) || !harmonics.length) return null;
    const rows = [];
    for (const harmonic of harmonics) {
      if (!Number.isInteger(harmonic.n) || harmonic.n < 2 || !Number.isFinite(harmonic.dbc)) return null;
      const attenuation = bandLimitAttenuation(f0, fc, harmonic.n, poles);
      if (!Number.isFinite(attenuation)) return null;
      // Far above the corner the fundamental and the harmonic roll off together, so the
      // relative attenuation stops at 20p*log10(n) however high f0 goes.
      const asymptote = -20 * (poles == null ? 1 : poles) * Math.log10(harmonic.n);
      rows.push({ n: harmonic.n, measured: harmonic.dbc, attenuation, asymptote,
        saturated: attenuation - asymptote < 0.5, intrinsic: harmonic.dbc - attenuation });
    }
    return { rows, f0, fc, poles: poles == null ? 1 : poles,
      measured: thdFromDbc(rows.map(r => r.measured)), intrinsic: thdFromDbc(rows.map(r => r.intrinsic)) };
  }

  // A contaminant this many dB relative to the DUT harmonic adds with unknown phase.
  function contaminationRange(relativeDb) {
    if (!Number.isFinite(relativeDb)) return null;
    const ratio = 10 ** (relativeDb / 20);
    return { ratio, high: 20 * Math.log10(1 + ratio),
      low: ratio === 1 ? -Infinity : 20 * Math.log10(Math.abs(1 - ratio)) };
  }

  // Voltage gain from a transmission parameter. Waves are normalised by the square root of
  // each port's reference impedance, so a voltage ratio and a power ratio coincide only when
  // the two reference impedances are equal. A differential port behaves as an ordinary port
  // with its own differential reference impedance, which is twice the per-line value when the
  // two lines are uncoupled.
  const GAIN_TOPOLOGIES = {
    dd: { key: 'dd', label: 'Differential in, differential out', parameter: 'S_{dd21}', plain: 'Sdd21', input: 'diff', output: 'diff' },
    sd: { key: 'sd', label: 'Differential in, single-ended out', parameter: 'S_{sd21}', plain: 'Ssd21', input: 'diff', output: 'se' },
    ds: { key: 'ds', label: 'Single-ended in, differential out', parameter: 'S_{ds21}', plain: 'Sds21', input: 'se', output: 'diff' },
    ss: { key: 'ss', label: 'Single-ended in, single-ended out', parameter: 'S_{21}', plain: 'S21', input: 'se', output: 'se' }
  };
  function gainConversion(topology, z1, z2) {
    const spec = Object.hasOwn(GAIN_TOPOLOGIES, topology) ? GAIN_TOPOLOGIES[topology] : null;
    if (!spec || ![z1, z2].every(value => Number.isFinite(value) && value > 0)) return null;
    const ratio = z2 / z1, factor = Math.sqrt(ratio);
    return { spec, z1, z2, ratio, factor,
      db: 10 * Math.log10(ratio),
      perLine1: spec.input === 'diff' ? z1 / 2 : null,
      perLine2: spec.output === 'diff' ? z2 / 2 : null };
  }

  // Intra-pair skew. A length mismatch delays one half of a differential pair, which rotates
  // part of the differential signal into the common mode. For an otherwise ideal pair the
  // split is |Sdd21| = cos(pi f dt) and |Scd21| = sin(pi f dt), so power is conserved between
  // the two modes. At half a period of skew the halves arrive in phase and the differential
  // signal nulls completely.
  function pairSkew(lengthDelta, er, freqHz) {
    if (![lengthDelta, er, freqHz].every(Number.isFinite) || !(er > 0) || !(freqHz > 0)) return null;
    const length = Math.abs(lengthDelta);
    const skew = (length * Math.sqrt(er)) / C_LIGHT;
    const cycles = freqHz * skew;
    const half = Math.PI * cycles;
    const differential = Math.abs(Math.cos(half)), common = Math.abs(Math.sin(half));
    const level = value => value === 0 ? -Infinity : 20 * Math.log10(value);
    return { length, er, freqHz, skew, cycles, degrees: 360 * cycles,
      differential, common, differentialDb: level(differential), commonDb: level(common),
      nullFrequency: skew > 0 ? 1 / (2 * skew) : Infinity,
      beyondNull: cycles > 0.5 };
  }

  // Largest skew, and length mismatch, that still meets a target. 'common' caps mode
  // conversion; 'differential' caps insertion loss. The mode-conversion limit binds first,
  // which is why a pair can look flat on Sdd21 and still radiate.
  function skewBudget(targetDb, mode, er, freqHz) {
    if (!Number.isFinite(targetDb) || targetDb >= 0 || !(er > 0) || !(freqHz > 0) ||
        !['common', 'differential'].includes(mode)) return null;
    const ratio = 10 ** (targetDb / 20);
    const half = mode === 'differential' ? Math.acos(ratio) : Math.asin(ratio);
    if (!Number.isFinite(half)) return null;
    const cycles = half / Math.PI, skew = cycles / freqHz;
    return { targetDb, mode, cycles, skew, degrees: 360 * cycles,
      length: (skew * C_LIGHT) / Math.sqrt(er) };
  }

  // Gain referred to the input terminal rather than to the incident wave. The two differ by
  // 1 + S11, which needs the reflection's phase as well as its magnitude.
  function terminalCorrection(s11Db, s11Deg) {
    if (![s11Db, s11Deg].every(Number.isFinite) || s11Db > 0) return null;
    const magnitude = 10 ** (s11Db / 20), radians = (s11Deg * Math.PI) / 180;
    const re = 1 + magnitude * Math.cos(radians), im = magnitude * Math.sin(radians);
    const denominator = Math.hypot(re, im);
    const degenerate = denominator < 1e-9;
    return { magnitude, re, im, denominator, degenerate,
      db: degenerate ? Infinity : -20 * Math.log10(denominator) };
  }

  const RF = {
    formatNumber, parseZero, parseFrequency, formatFrequency, frequencyDigits, sweepPoints, sweepStep, segmentedSweep, sweepTiming, logTable, noiseFloor, timeDomain, mismatchRipple, receiverBudget, PAD_VALUES, mixedModeRows, mixedMode, fromPolar, toPolar,
    tonePlan, harmonicPlan, bandLimitAttenuation, bandLimitedThd, contaminationRange, gainConversion, GAIN_TOPOLOGIES, pairSkew, skewBudget, terminalCorrection,
    complexMatch, matchFromComplexGamma, ip3Measurement, phaseDelay, cascade, K_BOLTZMANN, T_REF,
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
    formatDbm,
    splitVoltage,
    formatVoltage,
    formatPowerWatts,
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
    erFromVf
  };

  if (typeof module === "object" && module.exports) {
    module.exports = RF;
  } else {
    root.RF = RF;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
