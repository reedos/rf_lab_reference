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
    return result.drive === "diff" ? result.vppDiff : result.vpp;
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

  const RF = {
    SQRT2,
    TWO_SQRT2,
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
    unitToVolts
  };

  if (typeof module === "object" && module.exports) {
    module.exports = RF;
  } else {
    root.RF = RF;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
