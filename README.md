# RF Lab Reference

Quick RF lab reference. Static pages for a phone or tablet next to a VNA.

- Repo: https://github.com/reedos/rf_lab_reference
- Live: https://reedos.github.io/rf_lab_reference/

No build step. Classic scripts, no bundler.

## Calculators

| Page | Use at the bench |
| --- | --- |
| [VOPP](https://reedos.github.io/rf_lab_reference/) | CW dBm to peak-to-peak voltage, single-ended and true differential |
| [Match](https://reedos.github.io/rf_lab_reference/match.html) | Complex impedance R + jX, interactive Smith chart, S11, VSWR, and mismatch loss |
| [Large-signal](https://reedos.github.io/rf_lab_reference/large-signal.html) | Two-tone envelope, tone/harmonic frequency plan, IMD3 / IP3, P1dB, THD |
| [Gain](https://reedos.github.io/rf_lab_reference/gain.html) | Mixed-mode transmission parameter to voltage gain when the port reference impedances differ |
| [Mixed-mode](https://reedos.github.io/rf_lab_reference/mixed.html) | Mixed-mode S-parameters from single-ended ones for any port mapping, three- and four-port, with a numeric evaluation at one point |
| [Delay](https://reedos.github.io/rf_lab_reference/delay.html) | Wavelength, one-way/round-trip delay, electrical degrees, phase-slope length estimates, intra-pair skew |
| [Sweep](https://reedos.github.io/rf_lab_reference/sweep.html) | Points for linear and segmented frequency sweeps, boundary checks for gaps and step jumps, power-sweep sizing |
| [Power & noise](https://reedos.github.io/rf_lab_reference/chain.html) | Power at each connection, user-defined output limits, and cascaded noise figure |

Diagrams are drawn from the current inputs. The two-tone spectrum places its tones and
third-order products at the entered frequencies and level, with higher orders marked at their
frequencies only; the chain path names each stage kind and the gain that produced the next
level; the gain diagrams carry the entered reference impedances and a caption derived from
them. Every diagram is drawn by one builder as HTML blocks joined by buses, so VOPP, Gain and
Mixed-mode share one style and all of them reflow on a phone. Every calculator has **Show calculation**, with rendered LaTeX equations, substituted
numbers, units, and model assumptions. Equations update with the inputs; long equations
scroll within their own panel on small screens. KaTeX loads the first time a calculation
panel opens; it, its fonts, and the page fonts are bundled locally, with MathML included
for assistive technology. **Copy link** preserves the setup,
including the input used to solve the other fields. **Named setups** stores up to 50 setups per calculator in this browser;
saving an existing name updates it. Use a copied link to move a setup to another device.
Storage and clipboard failures are reported without preventing calculation.

Setups stay on the device. There is no account, backend, or measurement upload, and the
pages make no external requests.

## The look

Surfaces are flat and dense. Depth comes from a hairline, a one-pixel edge highlight and a soft
shadow, never from blur, so the contrast measured for both themes is what you get, and an
exported figure looks like the page it came from. The header is the one glass gesture: on a
desktop it stays put and blurs the content scrolling beneath it. Navigation is sentence case,
readouts use tabular figures so digits line up as they change, buttons share one vocabulary
with a small icon each, and the block diagrams share the schematic's box treatment.

## Light and dark

The pages follow the operating system's colour preference by default, the way an instrument's
screen and its print mode are two views of the same trace set, and the button at the top
right cycles **Auto**, **Light** and **Dark**; its icon shows the choice in force. A pinned choice is the one word this site
keeps in the browser besides named setups. The two palettes share their roles: amber for the
first quantity and teal for the second, which is the channel-one-yellow, channel-two-cyan
order of most bench instruments, with every meaning-carrying colour clearing WCAG AA on its
background in both themes. Exported images pick their theme independently of the page, and
the rendered algebra is recoloured to match.

## Tables and equations on a phone

Columns are centred so a heading sits over its numbers, and a number never wraps away from its
unit. Reference tables scroll inside their own frame when they must, so the heading above stays
put, and a frame with more to the side shows a fade there. List tables (sweep segments and
boundaries, chain stages, tone and harmonic plans) stack into cards on a phone, each value
under its own heading, so nothing scrolls sideways; matrices (the mixed-mode grids) keep their
rows and columns and scroll. Equations that run wide on a phone are set on several lines there
and on one line on a desktop, so no equation needs a sideways scroll at the default settings.

## Copying figures, tables and equations

Every calculator's toolbar can copy an image as well as text. **Copy figure** takes the
diagram with the values it carries and the result tiles; **Copy table** copies the result
tables as tab-separated text for a spreadsheet, and **Table image** copies them as a picture;
**Copy equations** renders the calculation panel afresh, with the current numbers
substituted, whether or not the panel is open. Pages whose equations live in the body (Gain,
Mixed-mode) include those first. Each image carries a header with the page and the DUT
card, and a footer with the address and the date, so it stands on its own in a report. The
**Image** selector chooses a light theme for paper and slides or the site's dark theme; both
keep the port colours. Images are drawn in the browser from the live page, with the site's
fonts embedded, at twice the layout size; nothing is sent anywhere. If the browser refuses the
clipboard, the PNG is downloaded instead.

## The DUT card

Every page opens with the same **DUT card**: input and output port topology, a per-line
reference impedance for each side, and the operating range, with an optional name. It lives
only in the page link. Navigation links carry it, a copied link carries it, and nothing is
written to the device, so it disappears when the tab closes and can be pinned with a
bookmark. Only values that differ from the default (50 Ω differential both sides, 100 MHz to
10 GHz) appear in the link, so ordinary links stay short.

Pages that use the card are bound to it both ways. VOPP looks at the input side when the VNA
drives the DUT and at the output side when the DUT drives the VNA, so switching direction
switches the impedance and drive mode as well; editing Z<sub>DUT</sub> or the drive on the
page writes that side back to the card. Gain takes both sides: the topology picks the
parameter, and each per-line impedance doubles for a differential reference. Sweep takes the
range: the generated table's linear tail starts where the DUT lives and stops at the top of its
range, the wide preset spans it, and a coverage tile reports whether the segment table reaches
both ends. Each card states what the current page takes from it. Links from before the card
existed keep their own values, because a link that names the page's drive or impedance wins
over the default card.

## Reading the pages

Each calculator has **one answer**. It leads its list of tiles, spans the row, and is the only
one styled that way; everything after it is supporting detail.

**Colour carries quantity identity, not decoration.** One side of a pair takes one colour, the
other side takes the other, and those same two colours appear in the diagram, inside the
rendered algebra, and on the matching tiles. Wires, boxes, arrows and grounds are structure,
so they stay neutral and let the quantities read. Each page that uses the scheme states its
key in one line.

| Page | One colour | The other |
| --- | --- | --- |
| VOPP | source impedance, available power | load impedance, delivered power, loaded voltage |
| Match | reference impedance Z₀ | the load Z = R + jX |
| Large-signal | IIP3, input-referred tone | OIP3, IM3, OP1dB, output-referred |
| Gain | input reference and incident wave | output reference and the voltage at the load |

A readout takes the colour of the side it belongs to rather than the block it happens to sit
on. In the receive direction the power drawn on the source block is delivered power, a
load-side quantity, and its colour says so.

The scheme is applied only where a page genuinely pairs two quantities. The sweep, delay and
power-chain pages have no such pair, so forcing it there would dilute what the colours mean.
The differential rails keep their own amber and blue for plus and minus, which is a separate
axis, and every key that appears beside them says so.

Colour only ever reinforces a written label. Every coloured symbol keeps its text, so nothing
is lost in greyscale, in print, or to a colour vision deficiency. The port colours are defined
once in the stylesheet as `--port-in` and `--port-out`, and the scripts read them back rather
than hardcoding a second copy.

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
fundamental in gigahertz and a kilohertz step beside a gigahertz stop.

Picking a unit **keeps the digits you typed and changes what they mean**, the way an
analyzer's unit keys work: type 10, choose GHz, get 10 GHz. Any unit typed into the field
itself is dropped at that point, so the selector is what decides. A field that is *solved*
from another one behaves the other way round, because it is rewritten from the physical value
each time: change the unit on a solved delay and it converts, so the delay itself does not
move. Typing a unit or SI prefix still works where a keyboard allows it (10k, 100 MHz, 2.4G).

## VOPP: dBm to peak-to-peak

The calculation panel follows the direction you actually solved in. Type a level and it runs
power to voltage; type VOPP and it runs voltage to power, ending in dBm. Every substituted
value carries its unit, so each line can be checked dimensionally, and the reflection
coefficient is tied to the power split through P_del/P_avs = 1 − |Γ|² rather than being left
as a loose number. Differential adds the differential impedance, the pair voltage, and the
total across both ports.

dBm to voltage at the reference plane, in either direction. Default unit is **volts**.

- **Z<sub>VNA</sub>** is fixed at 50 Ω (analyzer port).
- **Z<sub>DUT</sub>** is the DUT impedance at that plane (per side if differential).
- Type **dBm or VOPP** — the other field updates.
- **VNA → DUT:** dBm is *available* source power. VOPP is the loaded voltage at the DUT.
- **DUT → VNA:** dBm is *delivered* receiver power. VOPP is at the VNA port.

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

## Mixed-mode S-parameters

The differential and common-mode waves of a pair are (a₊ − a₋)/√2 and (a₊ + a₋)/√2, so the
whole conversion is S_mm = T S Tᵀ with T orthogonal. The page takes the topology from the DUT
card (or its own selector, which writes back to the card), lets you say which analyzer ports
make up each logical port (default 1 and 3 in, 2 and 4 out, the first of a pair being its
positive line), and writes out every mixed-mode parameter in terms of the single-ended ones
with your port numbers substituted: for the default mapping,
S_dd21 = ½(S21 − S23 − S41 + S43), S_dc21 = ½(S21 + S23 − S41 − S43), and so on. A
single-ended side carries a 1/√2, so S_sd21 = (S21 − S23)/√2 reads −3.01 dB for an ideal
split, which is the same 3.01 dB the Gain page adds back through the reference impedances.
Both single-ended sides reduce to the two-port set.

Mode reference impedances follow the card: 2 Z₀ for a differential mode and Z₀/2 for a
common mode, per side. The transform assumes both lines of a pair share their per-line
reference; renormalising to something else needs the whole single-ended matrix first.

An optional grid takes the single-ended set at one frequency as level and phase (row = to,
column = from; the example is a slightly unbalanced through path). The mixed-mode table and
tiles report the transmission term, both return terms, the common-mode through path and the
mode conversions, with S_cd21 also given relative to S_dd21. An entry that cancels exactly,
which an ideally balanced pair produces, is reported as −∞ dB rather than as a round-off
residue. The link at the bottom carries the card to the Gain page to turn the parameter into
a voltage gain.

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
segment is a plain linear sweep; 100 MHz to 10 GHz in 10 MHz steps is 991 points.
Each of a segment's start, stop and step carries its own unit, so one row can run from
100 MHz to 10 GHz in 10 MHz steps without retyping anything in a common unit. A step that
does not divide the span is flagged with the step that would land on the stop frequency.

**Log-style tables** put points at 1, 1+k, 1+2k … times each decade as one linear segment
per decade, so every frequency is a round number; the generator builds that table from start,
stop, and k, with an optional linear tail where the DUT lives (for example decades from 10 kHz,
then 100 MHz to 10 GHz in 100 MHz steps).

Each segment has a checkbox beside its number. Clearing it **parks** the segment: the values
stay on screen but the segment is excluded from the totals, the table and the boundary checks,
so switching a middle one off reports the hole it leaves rather than hiding it. Result rows
keep their original numbering, and the parked state travels in the link. Switching every
segment off is an error rather than an empty sweep.

Boundary checks compare each segment's last point with the next start (contiguous, gap,
overlap, or duplicate point) and a ratio beyond the configurable threshold (default 3×) is
marked. Continuity is judged against the step just swept, not against whichever of the two
steps is larger: a segment stepping 100 kHz that is followed by one starting 9.1 MHz later has
a gap, even though the next segment's own 10 MHz step would span it. The relative comparison (default) uses Δf/f at adjacent segment starts, so a decade
table that repeats its pattern is smooth even though its absolute step jumps 10×; the absolute
comparison uses step size for tables meant to be linear throughout. Per-segment Δf/f, average
points per decade, and instantaneous points per decade show the relative resolution, and a
log-sweep equivalent gives the point count that would match the finest or coarsest relative
spacing over the whole span. Optional inputs report headroom
against an instrument point limit and a minimum sweep time of about N/IFBW, which excludes
band crossings, settling, and dwell.

Power sweeps use the same count: −20 dBm to −4 dBm in 0.1 dB steps is 161 points. Enter the
step or the number of points; the other updates.

**Noise floor and trace noise** use the same IF bandwidth as the sweep time. Enter the floor
your analyzer's datasheet quotes at one bandwidth; it rises 10 dB per decade of bandwidth and
falls 10 log₁₀ N with N averages, and the sweep time multiplies by N. Enter the level you need
to see at the receiver (source power plus the DUT's |S21| at that point) and the page reports
the margin above the floor, the trace noise it produces (about 6.1 dB × 10^(−SNR/20) rms in
magnitude and 57° × the same factor in phase, from the in-phase noise component), and the
widest IF bandwidth that still leaves a 20 dB margin. A margin under 20 dB is flagged. The
model treats the floor as white noise in the IF filter and averaging as coherent; real
receivers add a fixed residual at the narrowest bandwidths.

## Intra-pair skew

A length mismatch between the P and N halves of a pair delays one of them. For an otherwise
ideal pair the differential signal is scaled and the missing part reappears as common mode:

    dt   = dl * sqrt(eff. permittivity) / c
    dphi = 360 * f * dt
    |Sdd21| = cos(pi f dt) = cos(dphi / 2)
    |Scd21| = sin(pi f dt) = sin(dphi / 2)
    |Sdd21|^2 + |Scd21|^2 = 1

Skew dissipates nothing. It moves energy from the differential mode into the common mode,
which is why it shows up as radiation and as lost common-mode rejection long before it shows
up as insertion loss. At half a period of skew the two halves arrive in phase and the
differential signal nulls completely.

**What is acceptable depends on frequency**, in direct proportion. The page takes a target,
either a mode-conversion ceiling or a differential-loss ceiling, and reports the largest
mismatch that still meets it at the frequency entered above. Mode conversion is almost always
the binding constraint:

| Target at 10 GHz, FR4 | Skew | Mismatch | Fraction of a period |
| --- | --- | --- | --- |
| −20 dB conversion | 3.19 ps | 18.1 mil | 3.19 % |
| −30 dB conversion | 1.01 ps | 5.73 mil | 1.01 % |
| −40 dB conversion | 0.32 ps | 1.81 mil | 0.32 % |
| 0.1 dB differential loss | 4.82 ps | 27.4 mil | 4.82 % |

A budget met at 5 GHz is missed by 6 dB at 10 GHz, so state the frequency whenever you quote
a skew number. The model assumes the pair is otherwise ideal and that skew is the only
asymmetry; real loss and impedance imbalance add their own conversion on top.

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
