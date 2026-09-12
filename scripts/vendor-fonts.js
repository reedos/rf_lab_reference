// Reproduce the bundled web fonts (latin subset) from Google Fonts so pages make no external requests.
// Usage: node scripts/vendor-fonts.js
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(path.resolve(__dirname, '..'), 'vendor', 'fonts');
const families = 'family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;600;700';
const cssUrl = `https://fonts.googleapis.com/css2?${families}&display=swap`;
// A modern browser UA makes the API return woff2 sources with unicode-range subsets.
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' };
(async () => {
  fs.mkdirSync(target, { recursive: true });
  const css = await (await fetch(cssUrl, { headers })).text();
  const blocks = css.match(/\/\* latin \*\/\s*@font-face\s*\{[^}]*\}/g) || [];
  const files = new Map();
  for (const block of blocks) {
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const weight = Number(block.match(/font-weight:\s*(\d+)/)[1]);
    const url = block.match(/url\(([^)]+)\)/)[1];
    const range = block.match(/unicode-range:\s*([^;]+);/)[1];
    const slug = family.toLowerCase().replace(/\s+/g, '-');
    const entry = files.get(url) || { family, slug, weights: [], range };
    entry.weights.push(weight);
    files.set(url, entry);
  }
  let out = '/* Bundled latin subsets from Google Fonts. Regenerate with `npm run vendor:fonts`. */\n';
  for (const [url, f] of files) {
    const variable = f.weights.length > 1;
    const file = `${f.slug}-${variable ? 'variable' : f.weights[0]}-latin.woff2`;
    fs.writeFileSync(path.join(target, file), Buffer.from(await (await fetch(url, { headers })).arrayBuffer()));
    const weight = variable ? `${Math.min(...f.weights)} ${Math.max(...f.weights)}` : String(f.weights[0]);
    out += `@font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(${file}) format('woff2'); unicode-range: ${f.range}; }\n`;
    console.log(`${file} <- ${url}`);
  }
  fs.writeFileSync(path.join(target, 'fonts.css'), out);
})().catch(err => { console.error(err); process.exit(1); });
