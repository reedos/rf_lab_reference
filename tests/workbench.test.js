const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/rf.js');
const near = (actual, expected, tol = 1e-10) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
const pad = (loss, temperature = 290) => ({kind:'passive',db:loss,temperature,limit:null});
const amp = (gain, nf) => ({kind:'active',db:gain,nf,limit:null});
test('display precision follows value and unit without erasing tiny values', () => {
  assert.equal(RF.formatNumber(.333564095,'ns'),'0.3336');
  assert.equal(RF.formatNumber(333.564095,'ps'),'333.6');
  assert.equal(RF.formatNumber(.632455532,'V'),'0.6325');
  assert.equal(RF.formatNumber(632.455532,'mV'),'632.5');
  assert.equal(RF.formatNumber(120.083074,'deg'),'120.08');
  assert.equal(RF.formatNumber(5.008895,'dB'),'5.01');
  assert.equal(RF.formatNumber(1.23456e-12,'s'),'1.235e-12');
  assert.equal(RF.formatNumber(-0),'0');
  assert.equal(RF.formatNumber(999999.9),'1e6');
  assert.equal(RF.formatNumber(Infinity),'∞');
  assert.equal(RF.formatNumber(NaN),'—');
});
test('logarithmic and angle displays round floating-point residue to zero', () => {
  for (const value of [0, -0, 9.643e-16, -9.643e-16, .0049, -.0049]) {
    assert.equal(RF.formatDbm(value), '0');
    for (const unit of ['dB', 'dBm', 'dBc', 'deg']) assert.equal(RF.formatNumber(value, unit), '0');
  }
  for (const value of [.0051, -.0051]) {
    assert.equal(RF.formatDbm(value), value > 0 ? '0.01' : '-0.01');
    assert.equal(RF.formatNumber(value, 'dB'), value > 0 ? '0.01' : '-0.01');
  }
  assert.equal(RF.formatDbm(-Infinity), '−∞');
  assert.equal(RF.formatNumber(9.643e-16, 's'), '9.643e-16');
  for (const drive of ['se', 'diff']) for (const direction of ['src', 'rx']) {
    const result = RF.fromDbmPlane(0, 50, 50, drive, direction);
    assert.equal(RF.formatDbm(result.dbmAvailable), '0');
    assert.equal(RF.formatDbm(result.dbmDelivered), '0');
  }
});

test('numbers accept decimal commas and thousands separators but not hex or infinity', () => {
  for (const [text, value] of [['1,000',1000],['0,25',.25],['0,250',.25],['1,000.5',1000.5],['1.000,5',1000.5],['1,000,000.25',1000000.25],['1e3',1000],['-.5',-.5],['+3',3],[' -10.5 ',-10.5]]) assert.equal(RF.parseNumber(text), value, text);
  for (const text of ['0x10','0b11','1,0,5','1.5.2','Infinity','-Infinity','1_000','--1','']) assert.ok(Number.isNaN(RF.parseNumber(text)), text);
});
test('frequency text takes SI prefixes, units, or a default scale', () => {
  assert.equal(RF.parseFrequency('10k'), 1e4); assert.equal(RF.parseFrequency('100 MHz'), 1e8); assert.equal(RF.parseFrequency('10G'), 10e9);
  assert.equal(RF.parseFrequency('2.4 GHz'), 2.4e9); assert.equal(RF.parseFrequency('100', 1e6), 1e8); assert.equal(RF.parseFrequency('1,000 Hz'), 1000);
  for (const text of ['10 x', 'ten', '', '0x10']) assert.ok(Number.isNaN(RF.parseFrequency(text, 1)), text);
  assert.deepEqual(RF.formatFrequency(124.99e9), { value: 124.99, unit: 'GHz', text: '124.99 GHz' });
  assert.equal(RF.formatFrequency(10e3).text, '10 kHz');
});
test('sweep point counts land exactly on the stop when the step divides the span', () => {
  const wide = RF.sweepPoints(100e6, 10e9, 10e6);
  assert.equal(wide.points, 991); assert.equal(wide.exact, true); assert.equal(wide.lastPoint, 10e9);
  const power = RF.sweepPoints(-20, -4, .1);
  assert.equal(power.points, 161); assert.equal(power.exact, true);
  const odd = RF.sweepPoints(0, 10, 3);
  assert.equal(odd.exact, false); assert.equal(odd.points, 4); assert.equal(odd.lastPoint, 9); assert.equal(odd.pointsCeil, 5); near(odd.stepCeil, 2.5); near(odd.stepFloor, 10/3);
  near(RF.sweepStep(-20, -4, 161).step, .1); assert.equal(RF.sweepStep(-20, -4, 1), null); assert.equal(RF.sweepStep(5, 5, 1).step, 0);
  for (const args of [[10, 0, 1], [0, 10, 0], [0, 10, -1], [NaN, 1, 1]]) assert.equal(RF.sweepPoints(...args), null);
});
test('segmented sweeps total points and flag step jumps, gaps, overlaps and duplicates', () => {
  const decades = [[10e3, 90e3, 10e3], [100e3, 900e3, 100e3], [1e6, 9e6, 1e6], [10e6, 90e6, 10e6], [100e6, 10e9, 100e6]].map(([start, stop, step]) => ({ start, stop, step }));
  const r = RF.segmentedSweep(decades, { maxPoints: 100001, ifbw: 1000 });
  assert.deepEqual(r.rows.map(x => x.points), [9, 9, 9, 9, 1250]); assert.equal(r.points, 136);
  assert.equal(r.boundaries.length, 4); assert.ok(r.boundaries.every(b => b.kind === 'contiguous' && !b.sharp && Math.abs(b.stepRatio - 10) < 1e-9 && Math.abs(b.patternRatio - 1) < 1e-9));
  assert.equal(r.headroom, 100001 - 136); near(r.sweepTime, .136); assert.equal(r.problems, 0); assert.equal(r.mode, 'relative');
  for (const row of r.rows.slice(0, 4)) near(row.decadePoints, 9, 1e-9);
  near(r.rows[4].decadePoints, 1250 / Math.log10(10.1e9 / 100e6), 1e-9); near(r.decadePoints.min, 9, 1e-9);
  const absolute = RF.segmentedSweep(decades, { mode: 'absolute' });
  assert.equal(absolute.problems, 4); assert.ok(absolute.boundaries.every(b => b.sharp));
  const dense = RF.segmentedSweep([{ start: 1e6, stop: 9e6, step: 1e6 }, { start: 10e6, stop: 90e6, step: 1e6 }]);
  assert.equal(dense.boundaries[0].sharp, true); near(dense.boundaries[0].patternRatio, .1);
  near(r.rows[0].fractionalStart, 1); near(r.rows[4].fractionalStop, 100e6 / 10e9);
  near(r.log.coarse, 1); assert.equal(r.log.coarsePoints, Math.ceil(Math.log(10e9 / 10e3) / Math.log(2)) + 1);
  const smooth = RF.segmentedSweep([{ start: 1e9, stop: 2e9, step: 10e6 }, { start: 2.01e9, stop: 3e9, step: 10e6 }], { jumpLimit: 3 });
  assert.equal(smooth.problems, 0); assert.equal(smooth.boundaries[0].kind, 'contiguous');
  assert.equal(RF.segmentedSweep([{ start: 1e9, stop: 2e9, step: 10e6 }, { start: 2e9, stop: 3e9, step: 10e6 }]).boundaries[0].kind, 'duplicate');
  assert.equal(RF.segmentedSweep([{ start: 1e9, stop: 2e9, step: 10e6 }, { start: 1.5e9, stop: 3e9, step: 10e6 }]).boundaries[0].kind, 'overlap');
  assert.equal(RF.segmentedSweep([{ start: 1e9, stop: 2e9, step: 10e6 }, { start: 2.5e9, stop: 3e9, step: 10e6 }]).boundaries[0].kind, 'gap');
  assert.equal(RF.segmentedSweep([{ start: 1e9, stop: 2e9, step: 10e6 }], { maxPoints: 50 }).problems, 1);
  for (const bad of [[], [{ start: 0, stop: 1e9, step: 1e6 }], [{ start: 2e9, stop: 1e9, step: 1e6 }], [{ start: 1e9, stop: 2e9, step: 0 }]]) assert.equal(RF.segmentedSweep(bad), null);
});
test('log-style tables generate one round-number segment per decade with an optional linear tail', () => {
  const table = RF.logTable(10e3, 10e9, 1, 100e6, 100e6);
  assert.deepEqual(table, [[10e3, 90e3, 10e3], [100e3, 900e3, 100e3], [1e6, 9e6, 1e6], [10e6, 90e6, 10e6], [100e6, 10e9, 100e6]].map(([start, stop, step]) => ({ start, stop, step })));
  assert.equal(RF.segmentedSweep(table).points, 136);
  assert.deepEqual(RF.logTable(1e6, 100e6, 2), [{ start: 1e6, stop: 9e6, step: 2e6 }, { start: 10e6, stop: 90e6, step: 20e6 }, { start: 100e6, stop: 100e6, step: 200e6 }]);
  assert.deepEqual(RF.logTable(25e3, 1e6, 1)[0], { start: 30e3, stop: 90e3, step: 10e3 });
  assert.deepEqual(RF.logTable(1e9, 9.5e9, .5)[0], { start: 1e9, stop: 9.5e9, step: .5e9 });
  assert.equal(RF.segmentedSweep(RF.logTable(1e6, 1e9, .1)).rows[0].points, 90);
  assert.equal(RF.segmentedSweep(RF.logTable(1e6, 1e9, .1)).problems, 0);
  for (const args of [[0, 1e9, 1], [1e9, 1e9, 1], [1e6, 1e9, 0], [1e6, 1e9, 10], [1e6, 1e9, 1, 1e5, 1e6], [1e6, 1e9, 1, 1e8, 0]]) assert.equal(RF.logTable(...args), null);
});
test('blank-as-zero parser changes only empty input, not invalid input', () => {
  assert.equal(RF.parseZero(''),0); assert.equal(RF.parseZero('  '),0);
  assert.equal(RF.parseZero('0,25'),.25);
  for (const value of ['-','bad','.',null,Infinity]) assert.ok(Number.isNaN(RF.parseZero(value)));
  assert.ok(Number.isNaN(RF.parseNumber('')));
});
test('complex reflection has known matched, short, open, and reactive limits', () => {
  near(RF.complexMatch(50,0,50).gamma,0);
  near(RF.complexMatch(0,0,50).re,-1);
  const open=RF.matchFromComplexGamma(1,0,50);
  assert.equal(open.r,Infinity); near(open.delivered,0); assert.equal(open.vswr,Infinity);
  const reactive=RF.complexMatch(0,50,50);
  near(reactive.re,0); near(reactive.im,1); near(reactive.phase,90); near(reactive.delivered,0);
  const load=RF.complexMatch(50,50,50);
  near(load.re,.2); near(load.im,.4); near(load.delivered,.8); near(load.mloss,.969100130080564);
});
test('complex inverse and power conservation across passive impedances', () => {
  for(const z0 of [33,50,75,100]) for(const r of [0,1,25,50,100,1000]) for(const x of [-500,-50,0,50,500]) {
    const a=RF.complexMatch(r,x,z0), b=RF.matchFromComplexGamma(a.re,a.im,z0);
    near(b.r,r,1e-7); near(b.x,x,1e-7);
    near(a.delivered,4*r*z0/((r+z0)**2+x*x),1e-12);
  }
});
test('complex inputs reject active loads and invalid reflection magnitudes', () => {
  for(const args of [[-1,0,50],[50,NaN,50],[50,0,0],[Infinity,0,50]]) assert.equal(RF.complexMatch(...args),null);
  assert.equal(RF.matchFromComplexGamma(1.1,0,50),null);
});
test('IP3 uses consistent input and output planes with absolute output IM3', () => {
  const input=RF.ip3Measurement(-10,-40,20,'input','dbc');
  near(input.iip3,10); near(input.oip3,30); near(input.im3Output,-30);
  const output=RF.ip3Measurement(10,-30,20,'output','dbm');
  near(output.iip3,10); near(output.oip3,30);
  const abs=RF.ip3Measurement(-10,-30,20,'input','dbm');
  near(abs.iip3,10); near(abs.delta,40);
  // Input-referred dBc does not need gain; absolute output power does.
  near(RF.ip3Measurement(-10,-40,NaN,'input','dbc').iip3,10);
  near(RF.ip3Measurement(10,-30,NaN,'output','dbm').oip3,30);
  assert.equal(RF.ip3Measurement(-10,-30,NaN,'input','dbm'),null);
  assert.equal(RF.ip3Measurement(10,15,20,'output','dbm'),null);
});
test('phase slope distinguishes one-way and reflection delay', () => {
  const tx=RF.phaseDelay(1e9,1.1e9,0,-36,0,'transmission',1);
  near(tx.traceDelay,1e-9,1e-20); near(tx.length,.299792458);
  const rx=RF.phaseDelay(1e9,1.1e9,0,-72,0,'reflection',.7);
  near(rx.oneWayDelay,1e-9,1e-20); near(rx.length,.2098547206);
  const wrapped=RF.phaseDelay(1e9,1.1e9,-170,170,-1,'transmission',1);
  near(wrapped.deltaPhase,-20);
  assert.ok(RF.phaseDelay(1e9,1.1e9,0,36,0,'transmission',1).length<0);
  assert.equal(RF.phaseDelay(1e9,1e9,0,-36,0,'transmission',1),null);
  assert.equal(RF.phaseDelay(1e9,1.1e9,0,-36,.5,'transmission',1),null);
  assert.equal(RF.phaseDelay(1e9,1.1e9,0,-36,0,'transmission',1.1),null);
});
test('noise from a 290 K source is kTB and passive loss preserves thermal equilibrium', () => {
  const source=RF.cascade([],0,1,290);
  near(source.noiseDbm,-173.97518719422808,1e-9); near(source.nf,0);
  const passive=RF.cascade([pad(10)],0,1,290);
  near(passive.noiseDbm,source.noiseDbm,1e-9); near(passive.nf,10); near(passive.gainDb,-10);
  const hot=RF.cascade([pad(10,580)],0,1,290);
  near(hot.factor,19); near(hot.equivalentTemperature,18*290);
});
test('stage ordering changes Friis noise figure but preserves net gain and CW output power', () => {
  const firstPad=RF.cascade([pad(3),amp(20,2)],-20,1e6,290);
  const firstAmp=RF.cascade([amp(20,2),pad(3)],-20,1e6,290);
  near(firstPad.nf,5); assert.ok(firstAmp.nf<2.1);
  near(firstPad.outputDbm,-3); near(firstAmp.outputDbm,-3);
  near(firstPad.noiseDbm,-173.97518719422808+60+17+5,1e-9);
  near(firstPad.rows.reduce((sum,r)=>sum+r.contribution,1),firstPad.factor);
});
test('bandwidth, source temperature and output headroom are applied at the correct plane', () => {
  const stages=[pad(3),{...amp(20,2),limit:0},pad(6)];
  const r=RF.cascade(stages,-10,1e6,290), wide=RF.cascade(stages,-10,10e6,290);
  near(r.rows[0].outputDbm,-13); near(r.rows[1].outputDbm,7); near(r.rows[1].headroom,-7); near(r.rows[2].outputDbm,1);
  near(wide.noiseDbm-r.noiseDbm,10);
  const warm=RF.cascade([],0,1,580), cool=RF.cascade([],0,1,290);
  near(warm.noiseDbm-cool.noiseDbm,10*Math.log10(2));
});
test('cascade rejects incomplete, nonphysical and overflowing data', () => {
  for(const stages of [[pad(-3)],[pad(3,0)],[amp(20,-1)],[{...amp(20,2),limit:NaN}],[amp(5000,2)]]) assert.equal(RF.cascade(stages,0,1e6,290),null);
  assert.equal(RF.cascade([],0,-1,290),null);
  assert.equal(RF.cascade([],0,1,0),null);
});
test('zero voltage represents zero power rather than an invalid measurement', () => {
  const r=RF.fromVoppPlane(0,50,50,'se','src');
  assert.equal(r.dbm,-Infinity); near(r.wattsDelivered,0);
});
