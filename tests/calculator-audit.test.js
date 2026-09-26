'use strict';
// Independent audit oracles: sampled waveforms, direct noise propagation and
// integer point lattices. These do not use RF helpers to compute expectations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');
const C = 299792458;
const K = 1.380649e-23;
const T0 = 290;
const close = (a, b, rel = 3e-11, abs = 1e-14) => {
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= abs + rel * Math.abs(b), `${a} != ${b}`);
};
function generator(seed = 20260925) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
const dbm = w => 10 * Math.log10(w / 0.001);
const power = d => 0.001 * 10 ** (d / 10);
function waveformPower(peak, z, frequencies = [1], samples = 4096) {
  let sum = 0, high = -Infinity, low = Infinity;
  for (let i = 0; i < samples; i++) {
    const v = frequencies.reduce((a, f) => a + peak * Math.cos(2 * Math.PI * f * i / samples), 0);
    sum += v * v / z; high = Math.max(high, v); low = Math.min(low, v);
  }
  return { average: sum / samples, high, low };
}

test('audit: VOPP agrees with a Thevenin circuit, sampled sinusoid power and both reference planes', () => {
  const random = generator();
  for (let i = 0; i < 180; i++) {
    const level = -100 + 130 * random(), zs = 10 + 190 * random(), zl = 10 + 990 * random();
    const available = power(level), voc = Math.sqrt(available * 4 * zs), vrms = voc * zl / (zs + zl);
    const delivered = vrms * vrms / zl, reflectedFraction = ((zl - zs) / (zl + zs)) ** 2;
    close(delivered / available + reflectedFraction, 1);
    for (const drive of ['se', 'diff']) {
      const swing = 2 * Math.SQRT2 * vrms * (drive === 'diff' ? 2 : 1);
      const result = RF.fromDbmPlane(level, zs, zl, drive, 'src');
      close(RF.voppOf(result), swing); close(result.wattsAvailable, available);
      close(result.wattsDelivered, delivered); close(result.vocRms, voc);
      close(RF.fromVoppPlane(swing, zs, zl, drive, 'src').dbm, level);
      // Receiver direction swaps physical source/load. Delivered power is the entered level.
      const receiver = RF.fromDbmPlane(dbm(delivered), zl, zs, drive, 'rx');
      close(receiver.vrmsSe, vrms); close(receiver.wattsAvailable, available);
      close(RF.fromVoppPlane(swing, zl, zs, drive, 'rx').dbm, dbm(delivered));
    }
    if (i < 8) close(waveformPower(Math.SQRT2 * vrms, zl).average, delivered);
  }
  for (const direction of ['src', 'rx']) for (const drive of ['se', 'diff']) {
    const zero = RF.fromVoppPlane(0, 50, 75, drive, direction);
    assert.equal(zero.dbm, -Infinity); assert.equal(zero.wattsDelivered, 0);
  }
});

test('audit: two-tone average and envelope powers agree with sampled equal tones', () => {
  for (const level of [-80, -20, 0, 13]) for (const z of [25, 50, 75, 100]) {
    const onePeak = Math.sqrt(2 * power(level) * z);
    const measured = waveformPower(onePeak, z, [101, 103]);
    const result = RF.twoToneFromToneDbm(level, z, 'se');
    close(result.dbmPortAvg, dbm(measured.average));
    // PEP is the power of a CW sine with the peak of the two-tone envelope.
    close(result.dbmPortPep, dbm(measured.high ** 2 / (2 * z)));
    close(result.vppEnv, measured.high - measured.low);
    const differential = RF.twoToneFromToneDbm(level, z, 'diff');
    close(differential.vppEnv, 2 * result.vppEnv);
    close(power(differential.dbmTotalAvg), 2 * measured.average);
    close(power(differential.dbmTotalPep), measured.high ** 2 / z);
  }
});

test('audit: gain conversion and terminal correction follow normalized travelling waves', () => {
  const random = generator(42);
  for (const topology of ['ss', 'sd', 'ds', 'dd']) for (let i = 0; i < 125; i++) {
    const z1 = 10 + 190 * random(), z2 = 10 + 190 * random();
    const incidentPower = 0.0001 + random(), transmission = 0.01 + 10 * random();
    const incidentVoltage = Math.sqrt(incidentPower * z1);
    const outputVoltage = Math.sqrt(incidentPower * transmission ** 2 * z2);
    const conversion = RF.gainConversion(topology, z1, z2);
    close(transmission * conversion.factor, outputVoltage / incidentVoltage);
    close(conversion.db, 20 * Math.log10(outputVoltage / incidentVoltage / transmission));
    const magnitude = random() * 0.98, phase = -180 + 360 * random(), angle = phase * Math.PI / 180;
    const terminal = RF.terminalCorrection(20 * Math.log10(magnitude), phase);
    const terminalVoltageSquared = incidentVoltage ** 2 * (1 + magnitude ** 2 + 2 * magnitude * Math.cos(angle));
    close(conversion.factor / terminal.denominator, outputVoltage / Math.sqrt(terminalVoltageSquared) / transmission);
  }
});

test('audit: only an exact short makes terminal gain unbounded; nearby loads remain finite', () => {
  // Taylor series for 1-exp(-x), independent of the implementation's expm1 path.
  const x = 1e-10 * Math.LN10 / 20, denominator = x - x * x / 2 + x * x * x / 6;
  const nearShort = RF.terminalCorrection(-1e-10, 180);
  assert.equal(nearShort.degenerate, false);
  close(nearShort.denominator, denominator, 1e-12, 1e-25);
  close(nearShort.db, -20 * Math.log10(denominator));
  for (const phase of [180, -180, 540, -540]) {
    const exact = RF.terminalCorrection(0, phase);
    assert.equal(exact.degenerate, true); assert.equal(exact.db, Infinity);
    assert.equal(exact.denominator, 0);
  }
  const phaseError = RF.terminalCorrection(0, 179.9999);
  assert.equal(phaseError.degenerate, false);
  close(phaseError.denominator, 2 * Math.sin(.0001 * Math.PI / 360), 1e-9, 1e-16);
});

const permutations = values => values.length ? values.flatMap((x, i) => permutations(values.filter((_, j) => j !== i)).map(rest => [x, ...rest])) : [[]];
function independentModes(sides) {
  const modes = [];
  sides.forEach((s, i) => modes.push({ ports: s.ports, mode: s.ports.length === 1 ? 's' : 'd', side: i + 1 }));
  sides.forEach((s, i) => { if (s.ports.length === 2) modes.push({ ports: s.ports, mode: 'c', side: i + 1 }); });
  return modes;
}
function launch(mode) {
  if (mode.mode === 's') return { [mode.ports[0]]: 1 };
  return { [mode.ports[0]]: 1 / Math.sqrt(2), [mode.ports[1]]: (mode.mode === 'd' ? -1 : 1) / Math.sqrt(2) };
}
function receive(mode, outgoing, component) {
  if (mode.mode === 's') return outgoing[mode.ports[0]][component];
  return (outgoing[mode.ports[0]][component] + (mode.mode === 'd' ? -1 : 1) * outgoing[mode.ports[1]][component]) / Math.sqrt(2);
}

test('audit: all mixed-mode pairings equal direct modal excitation and preserve matrix energy', () => {
  const random = generator(9);
  for (const mapping of permutations([1, 2, 3, 4])) for (const topology of ['dd', 'ds', 'sd', 'ss']) {
    const sides = [{ ports: topology[0] === 'd' ? mapping.slice(0, 2) : mapping.slice(0, 1) },
      { ports: topology[1] === 'd' ? mapping.slice(2, 4) : mapping.slice(2, 3) }];
    const ports = sides.flatMap(s => s.ports), matrix = {};
    for (const i of ports) { matrix[i] = {}; for (const j of ports) matrix[i][j] = { re: random() - .5, im: random() - .5 }; }
    const result = RF.mixedMode(matrix, sides), modes = independentModes(sides);
    close(result.entries.reduce((sum, e) => sum + e.value.mag ** 2, 0),
      ports.reduce((sum, i) => sum + ports.reduce((s, j) => s + matrix[i][j].re ** 2 + matrix[i][j].im ** 2, 0), 0));
    for (const stimulus of modes) {
      const input = launch(stimulus), outgoing = {};
      for (const i of ports) outgoing[i] = {
        re: ports.reduce((sum, j) => sum + matrix[i][j].re * (input[j] || 0), 0),
        im: ports.reduce((sum, j) => sum + matrix[i][j].im * (input[j] || 0), 0)
      };
      for (const response of modes) {
        const actual = result.byName[`S${response.mode}${stimulus.mode}${response.side}${stimulus.side}`].value;
        close(actual.re, receive(response, outgoing, 're')); close(actual.im, receive(response, outgoing, 'im'));
      }
    }
  }
});

test('audit: delay, electrical length, phase slope and skew agree with a travelling-wave model', () => {
  const random = generator(87);
  for (let i = 0; i < 300; i++) {
    const er = 1 + 10 * random(), length = .00001 + 10 * random(), frequency = 1e6 + 50e9 * random();
    const velocity = C / Math.sqrt(er), delay = length / velocity;
    close(RF.delayFromLength(length, er), delay, 3e-12, 1e-22);
    close(RF.lengthFromDelay(delay, er), length);
    close(RF.guidedWavelength(frequency, er), velocity / frequency);
    close(RF.degreesFromLength(length, frequency, er), 360 * frequency * delay);
    close(RF.lengthFromDegrees(360 * frequency * delay, frequency, er), length);
    for (const mode of ['transmission', 'reflection']) {
      const f1 = frequency, f2 = frequency * 1.03, paths = mode === 'reflection' ? 2 : 1;
      const result = RF.phaseDelay(f1, f2, -360 * f1 * delay * paths, -360 * f2 * delay * paths, 0, mode, velocity / C);
      close(result.oneWayDelay, delay, 1e-10, 1e-21); close(result.length, length, 1e-10);
    }
    const mismatch = random() * .01, dt = mismatch / velocity, angle = -2 * Math.PI * frequency * dt;
    const actual = RF.pairSkew(mismatch, er, frequency);
    close(actual.differential, Math.hypot(1 + Math.cos(angle), Math.sin(angle)) / 2);
    close(actual.common, Math.hypot(1 - Math.cos(angle), -Math.sin(angle)) / 2);
    close(actual.common ** 2 + actual.differential ** 2, 1);
    for (const mode of ['common', 'differential']) {
      const target = mode === 'common' ? -20 - random() * 40 : -0.1 - random() * 2;
      const budget = RF.skewBudget(target, mode, er, frequency), a = 2 * Math.PI * frequency * budget.length / velocity;
      const fraction = mode === 'common' ? (1 - Math.cos(a)) / 2 : (1 + Math.cos(a)) / 2;
      close(10 * Math.log10(fraction), target, 3e-7);
    }
  }
});

test('audit: IP3 follows independently specified linear/cubic power slopes at both planes', () => {
  const random = generator(312);
  for (let i = 0; i < 250; i++) {
    const intercept = 10 + random() * 40, gain = -10 + random() * 50, inputTone = intercept - gain - 10 - random() * 60;
    const outputTone = inputTone + gain, im3Absolute = 3 * outputTone - 2 * intercept, im3Dbc = im3Absolute - outputTone;
    for (const plane of ['input', 'output']) for (const unit of ['dbc', 'dbm']) {
      const result = RF.ip3Measurement(plane === 'input' ? inputTone : outputTone, unit === 'dbc' ? im3Dbc : im3Absolute, gain, plane, unit);
      close(result.oip3, intercept); close(result.iip3, intercept - gain);
      close(result.im3Output, im3Absolute); close(result.im3Dbc, im3Dbc);
    }
    const compressionInput = -20 + 30 * random(), idealOutput = compressionInput + gain;
    const compression = RF.p1dbFromOutput(gain, idealOutput - 1);
    close(compression.pin1dB, compressionInput); close(compression.poutLinear, idealOutput);
    close(RF.compressionAt(gain, compressionInput, idealOutput - .6).compression, .6);
  }
});

test('audit: THD matches sampled harmonic RMS; band correction matches cascaded RC transfer functions', () => {
  const harmonics = [{ n: 2, amplitude: .01 }, { n: 3, amplitude: .003 }, { n: 4, amplitude: .0007 }, { n: 5, amplitude: .0001 }];
  let distortionSquare = 0;
  for (let i = 0; i < 4096; i++) {
    const distortion = harmonics.reduce((sum, h) => sum + h.amplitude * Math.cos(2 * Math.PI * h.n * i / 4096), 0);
    distortionSquare += distortion ** 2 / 4096;
  }
  const result = RF.thdFromDbc(harmonics.map(h => 20 * Math.log10(h.amplitude)));
  close(result.ratio, Math.sqrt(distortionSquare / .5)); close(result.percent, 100 * result.ratio);
  for (const ratio of [.001, .1, .5, 1, 2, 100]) for (const poles of [1, 2, 4]) {
    // Transfer function of p identical, isolated RC sections, with each pole at fc.
    const h = n => (1 / Math.hypot(1, n * ratio)) ** poles;
    const measured = harmonics.map(x => ({ n: x.n, dbc: 20 * Math.log10(x.amplitude * h(x.n) / h(1)) }));
    const corrected = RF.bandLimitedThd(measured, ratio, 1, poles);
    close(corrected.intrinsic.ratio, result.ratio);
    corrected.rows.forEach((row, i) => close(row.intrinsic, 20 * Math.log10(harmonics[i].amplitude)));
  }
  // Unknown-phase contamination bounds also hold when the contaminant is larger.
  for (const relativeDb of [-60, -20, -3, 0, 3, 20]) {
    const r = 10 ** (relativeDb / 20), range = RF.contaminationRange(relativeDb);
    let smallest = Infinity, largest = 0;
    for (let k = 0; k <= 360; k++) {
      const a = k * Math.PI / 180, magnitude = Math.hypot(1 + r * Math.cos(a), r * Math.sin(a));
      smallest = Math.min(smallest, magnitude); largest = Math.max(largest, magnitude);
    }
    close(range.high, 20 * Math.log10(largest));
    if (r === 1) assert.equal(range.low, -Infinity); else close(range.low, 20 * Math.log10(smallest));
  }
});

test('audit: tone products match published Keysight example, analyzer floors and harmonic limits', () => {
  // Keysight Swept IMD Concepts: f1=100 MHz, f2=120 MHz; IM3=80/140, IM5=60/160, IM7=40/180, IM9=20/200.
  const plan = RF.tonePlan(100e6, 120e6, { maxOrder: 9, band: { low: 50e6, high: 190e6 }, rbw: 100, toneLevel: -20, toi: 20, phaseNoise: -130, danl: -155 });
  for (const [order, frequencies] of [[3, [80, 140]], [5, [60, 160]], [7, [40, 180]], [9, [20, 200]]]) {
    assert.deepEqual(plan.products.filter(p => p.order === order).map(p => p.frequency / 1e6), frequencies);
  }
  assert.equal(plan.im3Span, 60e6); assert.equal(plan.resolved, true);
  assert.deepEqual(plan.floors.map(f => f.dbc), [-115, -110, -80]); assert.equal(plan.limit.dbc, -80);
  assert.equal(RF.tonePlan(100e6, 120e6, { rbw: 2.1e6 }).resolved, false);
  const harmonics = RF.harmonicPlan(2e9, 5, { instrumentMax: 1e9 });
  assert.equal(harmonics.highestMeasurable, 0); assert.ok(harmonics.rows.every(r => r.aboveInstrument));
  assert.equal(RF.harmonicPlan(2e9, 5, { instrumentMax: 6e9 }).highestMeasurable, 3);
});

test('audit: cascaded output noise matches direct stage-by-stage thermal-noise propagation', () => {
  const random = generator(381);
  for (let trial = 0; trial < 300; trial++) {
    const bandwidth = 10 ** (2 + random() * 7), sourceTemperature = 10 + random() * 1000, input = -100 + random() * 60;
    const stages = Array.from({ length: 1 + Math.floor(random() * 10) }, (_, i) => random() < .45
      ? { kind: 'passive', db: random() * 15, temperature: 10 + random() * 1000, limit: i % 2 ? null : 10 }
      : { kind: 'active', db: -3 + random() * 33, nf: random() * 10, limit: i % 2 ? null : 15 });
    let noise = K * sourceTemperature * bandwidth, noiseAt290 = K * T0 * bandwidth, signal = power(input), netGain = 1;
    const actual = RF.cascade(stages, input, bandwidth, sourceTemperature);
    stages.forEach((stage, i) => {
      const g = 10 ** ((stage.kind === 'passive' ? -stage.db : stage.db) / 10);
      const addedOutputNoise = stage.kind === 'passive' ? K * stage.temperature * bandwidth * (1 - g)
        : K * T0 * bandwidth * (10 ** (stage.nf / 10) - 1) * g;
      noise = noise * g + addedOutputNoise; noiseAt290 = noiseAt290 * g + addedOutputNoise;
      signal *= g; netGain *= g;
      close(actual.rows[i].noiseDbm, dbm(noise)); close(actual.rows[i].outputDbm, dbm(signal));
      if (stage.limit !== null) close(actual.rows[i].headroom, stage.limit - dbm(signal));
    });
    close(actual.noiseDbm, dbm(noise)); close(actual.outputDbm, dbm(signal)); close(actual.snr, 10 * Math.log10(signal / noise));
    close(actual.factor, noiseAt290 / (K * T0 * bandwidth * netGain));
    close(actual.equivalentTemperature, noise / (K * bandwidth * netGain) - sourceTemperature, 3e-10);
  }
});

test('audit: receiver attenuation always meets both the compression margin and damage limit', () => {
  const special = RF.receiverBudget(5, { compression: 10, damage: 0, margin: 3 });
  assert.equal(special.state, 'damage'); assert.equal(special.pad, 6); assert.equal(special.afterPad, -1);
  const random = generator(521);
  for (let i = 0; i < 500; i++) {
    const level = -80 + random() * 150, compression = -20 + random() * 40, damage = -10 + random() * 60, margin = random() * 10;
    const result = RF.receiverBudget(level, { compression, damage, margin });
    assert.ok(result.afterPad <= compression - margin + 1e-12);
    assert.ok(result.afterPad <= damage + 1e-12);
    close(result.afterPad + result.pad, level);
    assert.ok(result.pad >= 0);
  }
});

test('audit: sweep counts agree with an integer lattice and retain genuinely inexact endpoints', () => {
  const random = generator(741);
  for (let i = 0; i < 500; i++) {
    const start = Math.floor(random() * 1e9), span = Math.floor(random() * 1e7), step = 1 + Math.floor(random() * 1e5);
    const actual = RF.sweepPoints(start, start + span, step);
    assert.equal(actual.points, Math.floor(span / step) + 1);
    assert.equal(actual.exact, span % step === 0);
    assert.equal(actual.lastPoint, start + Math.floor(span / step) * step);
    assert.ok(actual.lastPoint <= start + span);
  }
  const large = RF.sweepPoints(0, 1e9 + .4, 1);
  assert.equal(large.exact, false); assert.equal(large.lastPoint, 1e9); assert.equal(large.points, 1000000001);
  const roundedUp = RF.sweepPoints(0, 1e9 + .6, 1);
  assert.equal(roundedUp.exact, false); assert.equal(roundedUp.points, 1000000001);
  assert.equal(RF.sweepPoints(-20, -4, .1).points, 161);
  assert.equal(RF.sweepPoints(-20, -4, .1).exact, true);
  assert.equal(RF.sweepPoints(0, 1, 1e-20), null);
  assert.equal(RF.sweepPoints(-1e308, 1e308, 1), null);
  assert.equal(RF.sweepStep(0, 1, 1e20), null);
  assert.equal(RF.sweepStep(-1e308, 1e308, 101), null);
});

test('audit: segmented/log sweeps preserve counts, endpoint kinds and selected timing model', () => {
  const examples = [
    { segments: [{ start: 10, stop: 90, step: 10 }, { start: 100, stop: 900, step: 100 }], kind: 'contiguous', points: 18 },
    { segments: [{ start: 10, stop: 90, step: 10 }, { start: 90, stop: 190, step: 10 }], kind: 'duplicate', points: 20 },
    { segments: [{ start: 10, stop: 90, step: 10 }, { start: 80, stop: 180, step: 10 }], kind: 'overlap', points: 20 },
    { segments: [{ start: 10, stop: 90, step: 10 }, { start: 110, stop: 210, step: 10 }], kind: 'gap', points: 20 }
  ];
  for (const example of examples) {
    const result = RF.segmentedSweep(example.segments);
    assert.equal(result.points, example.points); assert.equal(result.boundaries[0].kind, example.kind);
  }
  const log = RF.logTable(1e3, 1e6, .5);
  const frequencies = log.flatMap(segment => Array.from({ length: Math.round((segment.stop - segment.start) / segment.step) + 1 }, (_, k) => segment.start + k * segment.step));
  assert.equal(frequencies.length, 55); assert.equal(new Set(frequencies).size, 55);
  assert.equal(frequencies[0], 1000); assert.equal(frequencies.at(-1), 1e6);
  for (const sequence of ['source', 'pairwise', 'custom']) for (let ports = 1; ports <= 4; ports++) {
    const options = { sequence, ports, customPasses: 5, averages: 7, ifbw: 2000, ifFactor: 1.3, pointOverhead: 12e-6, segmentOverhead: .002, cycleOverhead: .03 };
    const passes = sequence === 'custom' ? 5 : sequence === 'source' ? ports : Math.max(1, ports * (ports - 1));
    let expected = 0;
    for (let average = 0; average < 7; average++) {
      expected += .03;
      for (let pass = 0; pass < passes; pass++) {
        for (let point = 0; point < 551; point++) expected += 1.3 / 2000 + 12e-6;
        for (let segment = 0; segment < 3; segment++) expected += .002;
      }
    }
    close(RF.sweepTiming(551, 3, options).averagedTime, expected);
  }
});

test('audit: receiver white-noise scaling, averaging and high-SNR trace perturbation are consistent', () => {
  const random = generator(91);
  for (let i = 0; i < 200; i++) {
    const reference = -160 + random() * 60, refBandwidth = 10 ** (random() * 3), bandwidth = 10 ** (random() * 6), averages = 1 + Math.floor(random() * 100);
    const spectralDensity = power(reference) / refBandwidth;
    const signal = -50 + random() * 30;
    const actual = RF.noiseFloor({ floorRef: reference, ifbwRef: refBandwidth, ifbw: bandwidth, averages, signal });
    close(power(actual.floor), spectralDensity * bandwidth / averages);
    close(power(signal) / power(actual.floor), 10 ** (actual.snr / 10));
    const bandwidthAtMargin = actual.ifbwFor(20);
    close(10 * Math.log10(power(signal) / (spectralDensity * bandwidthAtMargin / averages)), 20);
  }
  const high = RF.noiseFloor({ floorRef: -120, ifbwRef: 1, ifbw: 1, signal: -40 });
  // Equal RMS real/imaginary noise components; exact log/angle perturbations converge
  // to the implemented first-order high-SNR approximation.
  const epsilon = Math.sqrt(power(-120) / power(-40) / 2);
  close(high.traceNoiseDb, (20 * Math.log10(1 + epsilon) - 20 * Math.log10(1 - epsilon)) / 2, 1e-8);
  close(high.traceNoiseDeg, Math.atan(epsilon) * 180 / Math.PI, 1e-8);
  const td = RF.timeDomain(1e6, 1e9);
  close(td.range, 1e-6); close(td.rangeOneWay, .5e-6); close(td.resolution, 1e-9);
  assert.equal(RF.timeDomain(1e6, 0), null);
});
