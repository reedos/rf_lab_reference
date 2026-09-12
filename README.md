# RF Lab Reference

Quick RF lab reference. Static pages for a phone or tablet next to a VNA.

- Repo: https://github.com/reedos/rf_lab_reference
- Live: https://reedos.github.io/rf_lab_reference/

No build step. Classic scripts, no bundler.

## Calculators

| Page | Use at the bench |
| --- | --- |
| [VOPP](https://reedos.github.io/rf_lab_reference/) | CW dBm ↔ peak-to-peak voltage, single-ended and true differential |
| [Match](https://reedos.github.io/rf_lab_reference/match.html) | Complex impedance R + jX, interactive Smith chart, S11, VSWR, and mismatch loss |
| [Large-signal](https://reedos.github.io/rf_lab_reference/large-signal.html) | Two-tone envelope, tone/harmonic frequency plan, IMD3 / IP3, P1dB, THD |
| [Gain](https://reedos.github.io/rf_lab_reference/gain.html) | Mixed-mode transmission parameter to voltage gain when the port reference impedances differ |
| [Delay](https://reedos.github.io/rf_lab_reference/delay.html) | Wavelength, one-way/round-trip delay, electrical degrees, and phase-slope length estimates |
| [Sweep](https://reedos.github.io/rf_lab_reference/sweep.html) | Points for linear and segmented frequency sweeps, boundary checks for gaps and step jumps, power-sweep sizing |
| [Power & noise](https://reedos.github.io/rf_lab_reference/chain.html) | Power at each connection, user-defined output limits, and cascaded noise figure |

Every calculator has **Show calculation**, with rendered LaTeX equations, substituted
numbers, units, and model assumptions. Equations update with the inputs; long equations
scroll within their own panel on small screens. KaTeX loads the first time a calculation
panel opens; it, its fonts, and the page fonts are bundled locally, with MathML included
for assistive technology. **Copy link** preserves the setup,
including the input used to solve the other fields. **Named setups** stores up to 50 setups per calculator in this browser;
saving an existing name updates it. Use a copied link to move a setup to another device.
Storage and clipboard failures are reported without preventing calculation.

Setups stay on the device. There is no account, backend, or measurement upload, and the
pages make no external requests.

## Display precision and blank inputs

Linear values display up to four significant figures; dB values and angles use
hundredths. Decimal places follow the selected unit: the same delay displays as
0.3336 ns or 333.6 ps. Very small linear values retain significant figures instead of
rounding to zero. Logarithmic levels and angles round to hundredths even near
zero, so floating-point residue displays as 0 rather than scientific notation.
Values you type, or restore from a link, stay exactly as written; only solved fields show
rounded values. Calculations and saved links keep full precision, including through repeated
unit changes. Displayed equations and copied results use rounded values.

Blank neutral terms mean zero: load resistance/reactance, reflection and measured
phase angles, extra phase turns, length/delay/electrical angle, VOPP, and gain/loss.
Blank gain means 0 dB (unity), so enter the actual gain for an amplifier. Required
reference impedances, frequencies, dielectric properties, noise figures,
temperatures, and power measurements must still be supplied. Blank harmonics are
omitted, and blank output limits mean no limit; neither becomes a 0 dB measurement.
Invalid text is always rejected, including hex or binary forms. A comma is read as a
decimal mark (0,25) or as a thousands separator (1,000 or 1,000.5).

## Signs and units on a phone

Mobile decimal keypads have no minus key, so every field that can hold a negative value
carries a **±** button beside it. It flips the sign of what is there, and on a blank field it
starts a negative entry so the next digits land after the minus. Fields that must be positive,
such as impedances, frequencies, temperatures and point counts, have no button.

Every frequency field carries **its own unit**, so a corner in kilohertz sits beside a
fundamental in gigahertz and a kilohertz step beside a gigahertz stop. Changing a unit keeps
the physical value and rewrites the number, so 1 GHz becomes 1000000 kHz rather than 1 kHz.
Typing a unit or SI prefix still works where a keyboard allows it (10k, 100 MHz, 2.4G) and
overrides the selector for that entry.

## VOPP — dBm ↔ peak-to-peak

dBm ↔ voltage at the reference plane. Default unit is **volts**.

- **Z<sub>PNA</sub>** is fixed at 50 Ω (analyzer port).
- **Z<sub>DUT</sub>** is the DUT impedance at that plane (per side if differential).
- Type **dBm or VOPP** — the other field updates.
- **PNA → DUT:** dBm is *available* source power. VOPP is the loaded voltage at the DUT.
- **DUT → PNA:** dBm is *delivered* receiver power. VOPP is at the PNA port.

```
P_W        = 10^(dBm/10) / 1000
V_oc       = 2 √(P_avs · Z_S)
V_rms      = V_oc · Z_L / (Z_S + Z_L)
VOPP_SE    = 2√2 · V_rms
VOPP_diff  = 2 · VOPP_SE
```

| dBm / port (matched 50 Ω) | SE VOPP | Diff VOPP |
| ------------------------- | ------- | --------- |
| −10                       | 0.200 V | 0.400 V   |
| 0                         | 0.632 V | 1.265 V   |
| +10                       | 2.00 V  | 4.00 V    |

## Large-signal

- **Two-tone workspace:** one setup drives three sections. The per-tone level, reference
  plane, impedance, drive mode, and gain are entered once at the top; changing the reference
  plane converts the tone level by the gain. Envelope VOPP is **2×** the CW VOPP at that
  per-tone dBm, and PEP is **+6.02 dB** vs one tone. Links from the older separate tabs
  (`tab=tones`, `tab=imd3`, and the old `imd-tone` field) still load.
- **IMD3:** the shared reference plane says whether the tone level is at the DUT input or
  output. IIP3 = P_input,tone + Δ/2; OIP3 = P_output,tone + Δ/2. OIP3 = IIP3 + G.
  Absolute IM3 dBm is always at the **DUT output**; dBc is relative to one output
  tone. Gain defaults to 0 dB when blank; enter the DUT gain to translate between
  input and output reference planes. Changing units
  or reference plane converts the entered value when enough information is present.
  Thumb: OP1dB ≈ OIP3 − 10 dB, only an approximate cubic-model relationship.
- **Tone plan:** enter f₁ with either f₂ or the spacing Δ. Odd-order products land on a
  uniform grid: order 2k+1 sits at f₁ − kΔ and f₂ + kΔ, so the IM3 pair spans 3Δ. Even-order
  products fall near DC and near the second harmonic. Resolution bandwidth should be Δ/10 or
  less. With optional analyzer entries the measurable IM3 floor is the highest of three:
  noise floor plus the bandwidth term referred to the tone, phase noise at the Δ offset over
  that bandwidth, and the analyzer's own products at 2(P_tone − TOI). The envelope beats at Δ,
  so a bias or video path narrower than several times Δ gives asymmetric IM3 sidebands, which
  is a memory effect rather than a measurement error.
- **P1dB:** OP1dB = IP1dB + G₀ − 1 dB.
- **THD:** RSS of harmonics in dBc. −40 dBc on one harmonic is 1%. With a fundamental
  frequency the harmonics are placed and checked against the analyzer's top frequency and the
  DUT passband; a harmonic above the analyzer range cannot be measured at all. A device corner
  frequency estimates how much the DUT's own rolloff hides:

  ```
  A_n = 10 p log10[ (1 + (f0/fc)^2) / (1 + (n f0/fc)^2) ]
  H_n,intrinsic = H_n,measured − A_n
  ```

  The fundamental is attenuated too, so at f₀ = f_c the second harmonic is understated by
  about 4 dB rather than 3 dB. The relative attenuation saturates at 20p·log₁₀(n), because far
  above the corner the fundamental and the harmonic roll off together: one pole can never
  account for more than 6.02 dB on H2, and a stopband 60 dB deep would need ten poles. The
  panel says when the correction has reached that limit, which is why the passband flags are
  kept alongside the corner rather than replaced by it. The passband answers whether a harmonic
  is inside the band the device is specified for, at any rejection depth; the corner quantifies
  partial attenuation near the edge. This holds only when the nonlinearity precedes the band limit
  and the device is not slewing; a feedback amplifier moves the other way, because loop gain
  falls with frequency and distortion suppression falls with it. When every harmonic lands
  outside the DUT passband, THD is the wrong metric and an in-band intermodulation measurement
  is reported instead. A source or receiver harmonic adds with unknown phase, so a contaminant
  10 dB below the DUT harmonic puts the reading between 2.4 dB high and 3.3 dB low.

## Voltage and power gain

A transmission parameter is a ratio of travelling waves, and each wave is normalised by the
square root of its port's reference impedance. Squaring the magnitude cancels that
normalisation, so the power ratio is the same whatever the reference impedances are. The
voltage ratio is not, and carries the square root with it:

    A_v = S21 · sqrt(Z2 / Z1)
    20·log10|A_v| = 20·log10|S21| + 10·log10(Z2 / Z1)
    P2 / P_avs = |S21|^2                      (no impedance term)

The page takes a port topology and the two reference impedances, and renders the conversion
as algebra with those impedances substituted. There are no level inputs; the output is the
factor, the decibel offset, and the derivation. A diagram shows which voltage each side
refers to.

| Topology | Parameter | Z₁ | Z₂ | Voltage factor | Add to dB |
| --- | --- | --- | --- | --- | --- |
| Differential in, differential out | Sdd21 | 100 Ω | 100 Ω | 1 | 0.00 dB |
| Differential in, single-ended out | Ssd21 | 100 Ω | 50 Ω | 0.7071 | −3.01 dB |
| Single-ended in, differential out | Sds21 | 50 Ω | 100 Ω | 1.414 | +3.01 dB |

Equal references are why Sdd21 is so often treated as a voltage ratio directly: for a
symmetric pair the impedance doubles on both sides and the factor is exactly one. The ±3.01 dB
appears as soon as one side is single-ended.

A differential port behaves as an ordinary port with its own differential reference impedance.
That impedance is twice the per-line value only for an uncoupled pair; a real coupled pair has
twice its odd-mode impedance, which is lower. The conversion also assumes each port is
terminated in its own reference impedance, and it describes small-signal behaviour only.
Renormalising a measurement to different impedances needs the whole S-matrix, not the
transmission term alone. A form referred to the input terminal voltage, which brings in the
input reflection, is shown alongside and agrees with the first when the input is matched.

## Match and Smith chart

Enter R + jX with a real positive reference Z₀, or enter reflection magnitude and
phase. S11, VSWR, and mismatch-loss edits preserve the reflection phase. Magnitude
alone cannot determine complex impedance. Drag or click the Smith chart to set Γ;
arrow keys move it, and Shift gives finer steps. Open, short, and match presets are
included. A collapsible real-resistance curve retains the X = 0 reference view.

This model covers passive loads (R ≥ 0, |Γ| ≤ 1), including open/short limits.
Delivered fraction 1 − |Γ|² assumes a matched source at that reference plane.
It does not calculate general source/load mismatch uncertainty.

## Delay and phase slope

Use a cable's velocity factor or effective permittivity, not an unqualified bulk
board dielectric constant. The line model is uniform and nondispersive.
Unit changes preserve the physical value. Old length-based links still load,
including older links that incorrectly recorded delay/angle as the input source.

The phase-slope helper uses τ_trace = −Δφ/(360 Δf), with phase in degrees.
For reflection, physical one-way delay is half the trace delay. The extra-turns
field supplies phase unwrapping; two points cannot determine it automatically.
Negative estimates remain visible but cannot be applied as physical cable length.
The page distinguishes physical port extension from trace electrical delay and
links to instrument documentation for the control conventions.

## Sweep setup

Each segment is a linear sweep: N = (f_stop − f_start)/Δf + 1, counting both ends. One
segment is a plain linear sweep; 100 MHz to 125 GHz in 10 MHz steps is 12 491 points.
Each of a segment's start, stop and step carries its own unit, so one row can run from
100 MHz to 125 GHz in 10 MHz steps without retyping anything in a common unit. A step that
does not divide the span is flagged with the step that would land on the stop frequency.

**Log-style tables** put points at 1, 1+k, 1+2k … times each decade as one linear segment
per decade, so every frequency is a round number; the generator builds that table from start,
stop, and k, with an optional linear tail where the DUT lives (for example decades from 10 kHz,
then 100 MHz to 125 GHz in 100 MHz steps).

Boundary checks compare each segment's last point with the next start (contiguous, gap,
overlap, or duplicate point) and a ratio beyond the configurable threshold (default 3×) is
marked. The relative comparison (default) uses Δf/f at adjacent segment starts, so a decade
table that repeats its pattern is smooth even though its absolute step jumps 10×; the absolute
comparison uses step size for tables meant to be linear throughout. Per-segment Δf/f, average
points per decade, and instantaneous points per decade show the relative resolution, and a
log-sweep equivalent gives the point count that would match the finest or coarsest relative
spacing over the whole span. Optional inputs report headroom
against an instrument point limit and a minimum sweep time of about N/IFBW, which excludes
band crossings, settling, and dwell.

Power sweeps use the same count: −20 dBm to −4 dBm in 0.1 dB steps is 161 points. Enter the
step or the number of points; the other updates.

## Power and noise chain

Add, remove, or reorder up to 24 passive or amplifier stages. Passive stages take
positive loss and physical temperature; amplifiers take signed gain and noise
figure. Name the output connection (DUT input, DUT output, receiver, etc.) and
optionally enter its CW signal-power limit. Tables show stage output power,
headroom, noise figure, and output noise. The contribution chart shows added noise
referred to the chain input, in kelvin and as a fraction of total added noise.

All gains and noise factors in these equations are linear power ratios:

```
F_total = 1 + Σ (F_i − 1) / G_before_i
F_passive = 1 + (L − 1) T_physical / 290 K
T_equivalent = (F_total − 1) × 290 K
P_noise,out = k × B × (T_source + T_equivalent) × G_total
```

The model assumes matched ports and gain/noise figure constant across equivalent
noise bandwidth. Coupler loss refers to the selected branch with other ports
terminated. It does not model compression, peak envelope power, frequency sweeps,
or reflections between stages. Noise figure is referenced to 290 K even when the
source or passive-stage temperature is different.

## Local

```bash
npm test
python -m http.server 8080
```

For browser verification (development dependencies only):

```bash
npm ci
npx playwright install chromium firefox
npm run test:browser
```

`BROWSERS=chromium,firefox` runs both engines; the default is Chromium.
In PowerShell, set `$env:BROWSERS='chromium,firefox'` before running the test.
`SCREENSHOTS=1` writes screenshots under ignored `tmp/screenshots`.
The tests start their own local server under a GitHub Pages-style subpath.
They exercise inputs, reference planes, units, saved links/setups, clipboard and
storage failures, chart interactions, stage order/limits, sweep segments and boundaries,
typed-value display, and phone/tablet/desktop layout. Mathematical tests include known values, inverse conversions, conservation
checks, thermal equilibrium, and invalid-input boundaries. CI runs both engines.

Shared math is in `js/rf.js`; each page has a separate controller. `js/bench.js`
provides equation rendering, calculation details, clipboard handling, and local setups.
To refresh the committed KaTeX assets from the pinned dependency, run
`npm run vendor:katex`; `npm run vendor:fonts` re-downloads the bundled latin font subsets
(IBM Plex and Sora, SIL Open Font License). Normal use and GitHub Pages deployment need
no build step.

## GitHub Pages

Source: **Deploy from a branch**, `main` / `/ (root)`.
