# RF calculator audit — 10/07/2026

Branch: `astra/ex-3`. All inputs and screenshots are synthetic.

## Bugs fixed

- Mixed-mode conversion forced every magnitude below 1e-12 to zero, including a
  single-ended identity transform. Removed that absolute cutoff. Tests retain
  signals down to 1e-250 and verify exact balanced cancellation independently.
- Harmonic rolloff correction squared unbounded frequency ratios, producing
  Infinity/Infinity and NaN for valid finite inputs. A scaled logarithmic form now
  reaches the independent RC limit, -20 p log10(n), even when f0/fc overflows.
- The dark foundation and drive-dependent accent differed from the required IF
  palette. Ported its ground, surface, border, ink and #e6ba82 amber tokens; removed
  decorative gradients and header blur. Kept bundled calculator fonts, control
  geometry and labeled RF quantity colors. Updated dark export checks and metadata.
- The delay page's more specific two-column rule defeated the 360 px field rule,
  clipping the default delay beside its unit. Fields now stack through 540 px;
  browser checks measure actual text against usable input width on phone screens.

## Numerical evidence

`npm test`: 94 passing tests (90 baseline plus four new edge regressions). The
new regressions failed three tests before the numerical fixes and pass afterward.
Relative tolerances scale with the expected result; tiny-signal checks have no
fixed absolute tolerance that could accept zero.

| Calculator | Independent oracle / boundary checks |
| --- | --- |
| VOPP | Thevenin circuit and sampled sine-wave power; both planes, differential power, zero volts; dBm/watts round trips from -1200 to +1200 dBm |
| Match | Complex S11/Z round trips, passive power conservation, open/short, every integer phase on the Smith boundary, near-boundary resistance, huge impedances |
| Large-signal | Sampled equal-tone envelope and harmonic RMS; independently specified linear/cubic IP3 slopes; compression; cascaded RC correction and extreme-ratio asymptote |
| Gain | Normalized incident/output travelling-wave voltages; input reflection including exact and near shorts; invalid reference impedances |
| Mixed-mode | Direct modal launch/receive at all port permutations, energy conservation, identity and weak balanced transmission |
| Delay | Travelling-wave velocity, phase slope for one-/two-way paths, inverse length/delay/angle, skew power conservation and inverse budgets |
| Sweep | Integer point lattice and explicit log-table enumeration, fractional endpoints, one-point and overflowing counts, independent timing and noise-bandwidth scaling |
| Power & noise | Direct stage-by-stage signal/noise propagation, thermal equilibrium, stage ordering, receiver limits, invalid/overflowing chains |

The independent oracles live in `tests/calculator-audit.test.js`,
`tests/astra-edge.test.js`, `tests/match-math.test.js`, `tests/rf.test.js` and
`tests/workbench.test.js`; controller suites cover invalidation and saved drivers.
Reviewed units include per-port versus total differential power, per-line versus
modal impedance, dBc versus output dBm, one-way versus round-trip time, and Hz
versus displayed frequency units. No new unit-label defect found.

## Browser and privacy evidence

`npm run test:browser`: 49 Chromium scenarios passed. All eight calculators pass
at 360, 390, 430, 768 and 1440 px. At 360 px, all detail panels also pass expanded
in both themes with a long synthetic DUT name, rendered equations and no document
overflow. Screenshots saved under ignored `tmp/screenshots/chromium/` were visually
inspected. Existing tests cover blank/invalid states, clipboard failures, unit
changes, navigation, chart interaction and figure/equation export.
The new input-readability check reproduced the clipped default delay before the
CSS fix; it checks delay, large-signal, sweep and chain values at all three phone widths.

DUT values survive navigation/reload in the URL fragment. Request/referrer checks
verify they are not sent to the local host; local storage contains only the theme
key and session storage stays empty. Legacy query links necessarily reach the host
once before conversion, as already documented. External analytics requests are
blocked by the test harness. The production analytics behavior was not audited.

`git diff --check` passed. A local-only identifier scan found neither the configured
hostname nor tailnet IP in tracked files. Added lines were scanned for email,
credential and notification-topic patterns without printing sensitive values.

Limitations: Chromium emulation, not physical iOS/Android or instrument validation.
Tests establish the stated models and boundaries, not arbitrary floating-point
inputs or real hardware accuracy. No live data, services or deployment changed.

Reed's decision: review and merge the branch, including the shared-palette change.
