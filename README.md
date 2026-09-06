# RF Calc

Static bench calculators for RF lab work. Hosted as GitHub Pages so they are a tap away next to a VNA.

- Repo: https://github.com/reedos/RF_Calculator
- Live: https://reedos.github.io/RF_Calculator/

No build step. Open `index.html` over HTTP (GitHub Pages, or any static server). Classic scripts, no bundler.

## VOPP — dBm ↔ peak-to-peak

Converts VNA source power to output voltage peak-to-peak (VOPP) and back.

- **Single-ended:** one port into Z₀.
- **Differential:** two complementary ports (true differential / balanced drive). VOPP is V₊ − V₋, peak-to-peak.
- dBm is **available power per port** — the VNA source-power setting.
- Default Z₀ = 50 Ω. Presets for 75 Ω and 100 Ω.

Type in either field; the other updates. `+` / `−` steps the source 1 dB. Arrow keys on the dBm field do the same (Shift for 0.1 dB).

### Formulas (CW sine, matched real load)

```
P_W        = 10^(dBm/10) / 1000
V_rms      = √(P_W · Z0)
VOPP_SE    = 2√2 · V_rms
VOPP_diff  = 2 · VOPP_SE
Z_diff     = 2 · Z0
P_total    = 2 · P_port          (+3.01 dB)
```

Checks at 50 Ω:

| dBm / port | SE VOPP | Diff VOPP |
| ---------- | ------- | --------- |
| −10        | 200 mV  | 400 mV    |
| 0          | 632 mV  | 1.265 V   |
| +10        | 2.00 V  | 4.00 V    |

If you drive a differential pair through a balun from **one** port, this page does not include the hybrid / balun loss — subtract that separately.

## GitHub Pages

1. Push this repo (public).
2. **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main` / `/ (root)`
3. Site URL: `https://<user>.github.io/RF_Calculator/`

`.nojekyll` is present so GitHub does not run Jekyll on the tree.

## Local

```bash
npm test
```

Any static server from the repo root works, for example:

```bash
python -m http.server 8080
```

## Adding another calculator

Keep the same `css/app.css` chrome. Put a new page next to `index.html`, add a nav link in the header, and share helpers from `js/rf.js` if they apply.
