# rf_lab

Quick RF lab reference. Static pages for a phone or tablet next to a VNA.

- Repo: https://github.com/reedos/rf_lab
- Live: https://reedos.github.io/rf_lab/

No build step. Classic scripts, no bundler.

## Calculators

| Page | Use at the bench |
| --- | --- |
| [VOPP](https://reedos.github.io/rf_lab/) | CW dBm ↔ peak-to-peak voltage, single-ended and true differential |
| [Match](https://reedos.github.io/rf_lab/match.html) | Return loss ↔ VSWR ↔ \|Γ\| ↔ mismatch loss vs real Z |
| [Large-signal](https://reedos.github.io/rf_lab/large-signal.html) | Two-tone envelope, IMD3 / IP3, P1dB, THD |
| [Delay](https://reedos.github.io/rf_lab/delay.html) | Wavelength, time delay, electrical degrees |

## VOPP — dBm ↔ peak-to-peak

dBm ↔ voltage at the reference plane. Default unit is **volts**.

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

- **Two-tone:** two equal CW tones. Envelope VOPP is **2×** the CW VOPP at that per-tone dBm. PEP is **+6.02 dB** vs one tone.
- **IMD3:** IIP3 = P_tone + Δ/2. OIP3 = IIP3 + G. Thumb: OP1dB ≈ OIP3 − 10 dB.
- **P1dB:** OP1dB = IP1dB + G₀ − 1 dB.
- **THD:** RSS of harmonics in dBc. −40 dBc on one harmonic is 1%.

## Local

```bash
npm test
python -m http.server 8080
```

## GitHub Pages

Source: **Deploy from a branch**, `main` / `/ (root)`.
