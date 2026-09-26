# Calculator correctness review — 2026-09-25

The review started from `d62ead40fe35262727ccd474381a6aa82f10c13c` and covered all eight
calculator pages. Three parallel reviews checked numerical mathematics, controller and
saved-link behavior, and the Smith-chart fixes. The original 43 numerical tests passed
before the review; the added tests cover defects those checks did not catch.

## Changes

- **Match:** exact zero resistance and explicit unit reflection magnitude retain zero
  delivered power and infinite VSWR/mismatch loss. Impedance entries retain the supplied
  R and X. Scaled arithmetic avoids squaring overflow, and tiny nonzero losses survive.
- **Match state:** point-mode links restore both ripple inputs. A perfect match gives
  zero ripple. Invalid loads clear dependent ripple results. Chart points on the unit
  circle retain that boundary when saved and restored.
- **Shared parsing:** malformed mixed decimal/thousands separators are rejected.
  Existing documented decimal-comma and grouping conventions remain supported.
- **Receiver budget:** the attenuator meets both the requested compression margin and
  the entered damage limit, even when damage is the tighter constraint.
- **Sweep:** one-point sweeps remain usable without a time-domain transform. Large
  inexact counts no longer round onto the stop; unsafe integer counts and overflowing
  spans are rejected. Shown equations include the floor operation and avoid zero-step
  division for a constant-level power sweep.
- **Large-signal:** an analyzer below the fundamental reports no measurable harmonics.
  Supplied nonpositive frequencies, invalid passbands and overflowing corrections are
  rejected instead of silently dropping the requested calculation.
- **Gain:** finite near-short terminal corrections remain finite; only an exact short
  gives the singular result. The reference-impedance explanation correctly distinguishes
  differential-to-single-ended and single-ended-to-differential voltage factors.
- **Model descriptions:** THD rolloff is explicitly a cascade of identical first-order
  low-pass poles, with f_c specified per pole. Mixed-mode documentation no longer claims
  a common-mode termination cannot affect the differential response.

## Reproducible checks

Run `npm test`. The test runner discovers every numerical/controller `*.test.js` suite
except `browser.test.js`, which has its own command. The new tests use deterministic
seeds and independent physical models where practical:

| Calculator | Independent checks |
| --- | --- |
| VOPP | Thevenin source/load division, sampled sinusoid power, both reference planes, differential drive, zero power and inverse conversions |
| Match | Analytic impedance/reflection relations, exact open/short/reactance limits, small losses, large impedances, polar phase sweep, saved-point and ripple state |
| Large-signal | Sampled equal tones and harmonic RMS, linear/cubic IP3 slopes, compression planes, published tone-product example, cascaded RC transfer functions and analyzer limits |
| Gain | Incident/output travelling-wave voltages, all four topologies, terminal reflection phase and near-short limits |
| Mixed-mode | Direct modal excitation for all 24 physical-port permutations and four topologies; matrix energy conservation, duplicate port rejection and link restoration |
| Delay | Propagation speed, electrical length, one-way/reflection phase slope, direct delayed-pair mode split, skew budgets and unit/link round trips |
| Sweep | Integer frequency lattices, inexact endpoints, segmented boundary kinds, log-table uniqueness, acquisition-pass timing, noise bandwidth/averaging, one-point recovery |
| Power & noise | Direct stage-by-stage thermal-noise propagation, source temperature, output planes, stage limits, receiver protection and stage/link validation |

An additional independent Python Decimal oracle at 80-digit precision checked 20,160
Smith/scalar cases with 180,880 comparisons. All passed after the fixes. This included
10,000 impedance cases, 10,000 passive complex-reflection cases, 44 ideal reactances,
canonical loads, scalar boundaries and extreme-value conditioning cases. The portable
regression cases are committed in `tests/match-math.test.js`; the larger review evidence
is retained separately from the application.

Browser checks run with `npm ci`, `npx playwright install chromium firefox`, then
`npm run test:browser` (`BROWSERS=chromium,firefox`). The repository's CI runs both engines
under a GitHub Pages-style subpath. It covers all eight pages, navigation, inputs, units,
saved links, clipboard/storage failures, chart interaction, equation rendering, image
exports, and phone/tablet/desktop layouts. New browser scenarios exercise the corrected
Smith, one-point sweep, receiver-budget and THD paths.

## Scope and limits

This is a numerical and software verification, not calibration against hardware and not
a proof for every floating-point input. The models retain their stated assumptions:
real positive reference impedances, passive loads for Match, equal per-line references
within each mixed-mode pair, matched stages for cascade noise, ideal pair skew, and
small-signal/cubic or specified low-pass models where applicable. Sweep timing remains
an instrument-dependent planning estimate. Trace-noise expressions are high-SNR
approximations. Extremely large or ill-conditioned inputs can exceed representable
precision; meaningful displayed digits and explicit model limits matter at the bench.

The two-tone plan writes solved frequency displays at 12 significant digits. Promoting
such a solved field to the driver can lose sub-millihertz spacing on multi-GHz carriers.
The original driver remains in saved links. The mixed-mode numerical helper suppresses
entries below a magnitude of 1e-12 (−240 dB); the page uses its algebra, not measured data.
Analyzer floor estimates report the largest individual contributor rather than a combined
noise/uncertainty budget. Time-domain resolution also depends on the transform and window.

Controller unit fixtures run the real application scripts with a minimal DOM; they do
not verify browser layout, pointer coordinates or clipboard integration. Those remain
the responsibility of the separate browser suite. Local interactive browser access was
unavailable during this review; CI supplies the browser execution evidence.

## Primary references consulted

- [Keysight: impedance measurement](https://helpfiles.keysight.com/csg/m9485a/tutorials/comp_imped.htm) — complex reflection and impedance.
- [Keysight: swept IMD concepts](https://helpfiles.keysight.com/csg/NA520xA/Applications/Swept_IMD_and_IM_Spectrum_Concepts.htm) — tone products and intercept conventions.
- [Keysight: balanced measurements](https://helpfiles.keysight.com/csg/e5080b/S1_Settings/Balanced_Measurements.htm) — mode definitions and port transforms.
- [Keysight: unbalanced/balanced filter measurement](https://helpfiles.keysight.com/csg/e5071c/measurement/measurement_examples/measuring_an_unbalanced_and_balanced_bandpass_filter.htm) — differential/common reference impedances.
- [Rohde & Schwarz: cold-source noise figure](https://scdn.rohde-schwarz.com/ur/pws/dl_downloads/dl_application/application_notes/1sl378/1SL378_0e_ColdSrcNF.pdf) — 290 K reference and cascaded noise.
- [Analog Devices: phase relations in active filters](https://www.analog.com/en/resources/analog-dialogue/articles/phase-relations-in-active-filters.html) — cascaded poles and filter response.
- [Keysight: time domain](https://helpfiles.keysight.com/csg/e5055a/Time/TimeDomain.htm) — transform/window-dependent resolution.
- [Keysight: expanding dynamic range](https://helpfiles.keysight.com/csg/e5061b/measurement/optimizing_measurements/expanding_the_dynamic_range.htm) — bandwidth and averaging assumptions.
