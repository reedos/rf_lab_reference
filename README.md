# RF Calc

Static bench calculators for RF lab work. Hosted as GitHub Pages so they are a tap away next to a VNA.

- Repo: https://github.com/reedos/RF_Calculator
- Live: https://reedos.github.io/RF_Calculator/

No build step. Open the HTML over HTTP (GitHub Pages, or any static server). Classic scripts, no bundler.

## Calculators

| Page | Use at the bench |
| --- | --- |
| [VOPP](https://reedos.github.io/RF_Calculator/) | CW dBm ↔ peak-to-peak voltage, single-ended and true differential |
| [Match](https://reedos.github.io/RF_Calculator/match.html) | Return loss ↔ VSWR ↔ \|Γ\| ↔ mismatch loss |
| [Large-signal](https://reedos.github.io/RF_Calculator/large-signal.html) | Two-tone envelope, IMD3 / IP3, P1dB, THD |
| [Delay](https://reedos.github.io/RF_Calculator/delay.html) | Wavelength, time delay, electrical degrees |

## VOPP — dBm ↔ peak-to-peak

VNA source power to voltage at the DUT, and back. Default unit is **volts**.

- **Single-ended:** one port into Z₀.
- **Differential:** two complementary ports. VOPP is V₊ − V₋, peak-to-peak.
- dBm is **available power per port** — the VNA source-power setting.

```
P_W        = 10^(dBm/10) / 1000
V_rms      = √(P_W · Z0)
VOPP_SE    = 2√2 · V_rms
VOPP_diff  = 2 · VOPP_SE
```

| dBm / port | SE VOPP | Diff VOPP |
| ---------- | ------- | --------- |
| −10        | 0.200 V | 0.400 V   |
| 0          | 0.632 V | 1.265 V   |
| +10        | 2.00 V  | 4.00 V    |

## Large-signal

- **Two-tone:** two equal CW tones. Envelope VOPP is **2×** the CW VOPP at that per-tone dBm. PEP is **+6.02 dB** vs one tone. This is why IMD compresses sooner than a CW P1dB sweep at the same per-tone setting.
- **IMD3:** IIP3 = P_tone + Δ/2. OIP3 = IIP3 + G. Thumb: OP1dB ≈ OIP3 − 10 dB.
- **P1dB:** OP1dB = IP1dB + G₀ − 1 dB. Optional measured P_out → compression depth.
- **THD:** RSS of harmonics in dBc. −40 dBc on one harmonic is 1% THD.

If you drive a differential pair through a balun from **one** port, subtract hybrid / balun loss separately.

## Local

```bash
npm test
python -m http.server 8080
```

## GitHub Pages

Source: **Deploy from a branch**, `main` / `/ (root)`. `.nojekyll` is present so Jekyll does not process the tree.
