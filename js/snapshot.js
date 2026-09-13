// Copy a figure, a table or the rendered equations as a PNG. The live DOM is cloned into an
// SVG foreignObject together with the site's stylesheets and fonts (as data URIs, since an
// SVG image may not fetch anything), drawn to a canvas, and handed to the clipboard. The
// image carries a header with the page and the DUT, and a footer with the address and date,
// so it stands on its own in a report. Nothing leaves the browser.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SCALE = 2;
  const fontCache = new Map();
  let cssPromise = null, config = null, busy = false;

  const toDataUri = async url => {
    if (!fontCache.has(url)) fontCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.blob(); })
      .then(blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); })));
    return fontCache.get(url);
  };
  // Every same-origin rule, with each @font-face's woff2 inlined. Fonts the page never loaded
  // (a KaTeX weight nobody used) are still small, and caching keeps the second copy instant.
  function collectCss(families) {
    const jobs = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) {
          const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
          if (!families.has(family)) continue;
          const match = rule.style.getPropertyValue('src').match(/url\((["']?)([^"')]+\.woff2)\1\)/);
          if (!match) continue;
          const url = new URL(match[2], sheet.href || location.href).href;
          jobs.push(toDataUri(url).then(data => rule.cssText.replace(/src:[^;]+;?/, 'src: url(' + data + ') format("woff2");'), () => ''));
        } else jobs.push(Promise.resolve(rule.cssText));
      }
    }
    return Promise.all(jobs).then(parts => parts.join('\n'));
  }
  function familiesIn(root) {
    const families = new Set();
    root.querySelectorAll('*').forEach(el => getComputedStyle(el).fontFamily.split(',').forEach(f => families.add(f.replace(/["']/g, '').trim())));
    families.add(getComputedStyle(root).fontFamily.split(',')[0].replace(/["']/g, '').trim());
    return families;
  }
  // Custom properties as the page currently resolves them, so the dark image matches the
  // page and a differential drive keeps its accent.
  function tokens() {
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (_) { continue; }
      for (const rule of rules) if (rule.style) for (const name of rule.style) if (name.startsWith('--')) names.add(name);
    }
    const computed = getComputedStyle(document.body), out = {};
    for (const name of names) { const value = computed.getPropertyValue(name); if (value) out[name] = value.trim(); }
    return out;
  }
  // A token as it resolves under a theme, read from a throwaway element wearing that theme.
  function themeToken(theme, name) {
    const probe = document.createElement('div');
    probe.className = 'snap-' + theme; probe.hidden = true;
    document.body.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(name).trim();
    probe.remove();
    return value;
  }
  // KaTeX bakes \textcolor into inline styles with the colours of the theme the page was in,
  // so an export in the other theme swaps them for that theme's port colours.
  // The browser serialises an inline colour as rgb(), so compare through that form.
  const normalise = colour => { const el = document.createElement('span'); el.style.color = colour; return el.style.color; };
  function recolour(clone, theme) {
    const pairs = [['--port-in', Bench.PORT.in], ['--port-out', Bench.PORT.out]].map(([name, from]) => {
      const to = themeToken(theme, name);
      return { fromHex: from.toLowerCase(), toHex: to.toLowerCase(), from: normalise(from), to: normalise(to) };
    }).filter(pair => pair.from && pair.to && pair.from !== pair.to);
    if (!pairs.length) return clone;
    clone.querySelectorAll('[style]').forEach(el => { for (const pair of pairs) if (el.style.color === pair.from) el.style.color = pair.to; });
    clone.querySelectorAll('[mathcolor]').forEach(el => { for (const pair of pairs) if (el.getAttribute('mathcolor').toLowerCase() === pair.fromHex) el.setAttribute('mathcolor', pair.toHex); });
    return clone;
  }
  // Form controls do not survive serialisation as their live values; show the value instead.
  function freeze(clone) {
    clone.querySelectorAll('input, select, textarea').forEach(el => {
      const span = document.createElement('span');
      span.className = 'snap-value';
      span.textContent = el.tagName === 'SELECT' ? (el.selectedOptions[0] || {}).textContent || '' : el.value;
      el.replaceWith(span);
    });
    clone.querySelectorAll('button, [aria-hidden="true"] .sign, .toolbar, .export-tools').forEach(el => el.remove());
    return clone;
  }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function header(title, caption) {
    const dut = window.Dut ? Dut.get() : null;
    const dutText = dut ? `${dut.name ? dut.name + ' · ' : ''}${dut.din === 'diff' ? 'diff' : 'SE'} in ${RF.formatNumber(dut.zin)} Ω${dut.din === 'diff' ? '/line' : ''} → ${dut.dout === 'diff' ? 'diff' : 'SE'} out ${RF.formatNumber(dut.zout)} Ω${dut.dout === 'diff' ? '/line' : ''} · ${dut.fminText} ${dut.fminUnit} – ${dut.fmaxText} ${dut.fmaxUnit}` : '';
    const h1 = document.querySelector('h1');
    return `<div class="snap-head"><span class="snap-brand">RF<span>/</span>LAB</span><span class="snap-title">${escape(h1 ? h1.textContent : '')}${title ? ' · ' + escape(title) : ''}</span></div>` +
      (dutText ? `<p class="snap-dut"><span class="snap-label">DUT</span>${escape(dutText)}</p>` : '') +
      (caption ? `<p class="snap-caption">${escape(caption)}</p>` : '');
  }
  function footer() {
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return `<p class="snap-foot"><span>${escape(location.host + location.pathname)}</span><span>${escape(date)}</span></p>`;
  }
  async function render(spec) {
    await document.fonts.ready;
    const theme = spec.theme === 'dark' ? 'dark' : 'light';
    const nodes = spec.nodes.filter(Boolean).map(node => recolour(freeze(node.cloneNode(true)), theme));
    const root = document.createElement('div');
    root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    root.className = 'snap-root';
    for (const [name, value] of Object.entries(tokens())) root.style.setProperty(name, value);
    const wrap = document.createElement('div');
    wrap.className = 'snap snap-' + theme;
    wrap.style.width = (spec.width || 820) + 'px';
    // The theme block resets the accent to amber; a differential page keeps its cyan.
    const drive = document.body.dataset.drive === 'diff' ? 'cyan' : 'amber';
    wrap.style.setProperty('--accent', `var(--${drive})`); wrap.style.setProperty('--accent-soft', `var(--${drive}-soft)`);
    wrap.innerHTML = header(spec.title, spec.caption);
    const body = document.createElement('div'); body.className = 'snap-body';
    nodes.forEach(node => body.append(node));
    wrap.append(body);
    wrap.insertAdjacentHTML('beforeend', footer());
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
    stage.append(root); root.append(wrap);
    document.body.append(stage);
    let svg;
    try {
      const style = document.createElement('style');
      style.textContent = await collectCss(familiesIn(wrap));
      root.prepend(style);
      // Anything that would scroll on the page (a wide table, the power path, a long
      // equation) widens the image instead, up to a sensible page width.
      const overflow = Math.max(0, ...Array.from(wrap.querySelectorAll('*'))
        .map(el => el.scrollWidth - el.clientWidth).filter(Number.isFinite));
      if (overflow > 0) wrap.style.width = Math.min((spec.width || 820) + overflow + 8, 1800) + 'px';
      const rect = wrap.getBoundingClientRect();
      const width = Math.ceil(rect.width), height = Math.ceil(rect.height);
      const xml = new XMLSerializer().serializeToString(root);
      svg = { width, height, text: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>` };
    } finally { stage.remove(); }
    const image = new Image();
    const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('The image could not be drawn.')); });
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.text);
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = svg.width * SCALE; canvas.height = svg.height * SCALE;
    const context = canvas.getContext('2d');
    context.scale(SCALE, SCALE);
    context.drawImage(image, 0, 0);
    return canvas;
  }
  const toBlob = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be encoded.')), 'image/png'));
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function say(message, error) {
    const status = $('bench-status');
    if (!status) return;
    status.textContent = message; status.className = error ? 'hint status-error' : 'hint';
  }
  // The clipboard wants the item created inside the click, so the PNG is promised, not awaited.
  async function copyImage(spec, fileName) {
    if (busy) return;
    busy = true;
    say('Rendering the image…');
    const blobPromise = render(spec).then(toBlob);
    try {
      if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      const blob = await blobPromise;
      say(`Image copied (${spec.theme === 'dark' ? 'dark' : 'light'} theme, ${Math.round(blob.size / 1024)} kB). Paste it into a document or a message.`);
    } catch (error) {
      try {
        const blob = await blobPromise;
        download(blob, fileName);
        say('The clipboard refused the image, so it was downloaded instead.');
      } catch (inner) { say(inner.message || 'The image could not be made.', true); }
    } finally { busy = false; }
  }
  // Cell text as written, not as styled, so headings keep their case in a spreadsheet.
  function tableText(tables) {
    return tables.map(table => Array.from(table.querySelectorAll('tr'))
      .map(row => Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent.replace(/\s+/g, ' ').trim()).join('\t'))
      .join('\n')).filter(Boolean).join('\n\n');
  }
  const resolve = value => typeof value === 'function' ? value() : value;
  const list = value => { const out = resolve(value); return Array.isArray(out) ? out.filter(Boolean) : out ? [out] : []; };
  function mount(options) {
    config = options || {};
    const toolbar = document.querySelector('#copy-link') ? document.querySelector('#copy-link').closest('.toolbar') : null;
    if (!toolbar || $('export-tools')) return;
    const tools = document.createElement('span');
    tools.className = 'export-tools'; tools.id = 'export-tools';
    const button = (id, label) => `<button type="button" class="ghost" id="${id}">${label}</button>`;
    tools.innerHTML = (list(config.figure).length ? button('export-figure', config.figureLabel || 'Copy figure') : '') +
      (list(config.tables).length ? button('export-table', 'Copy table') + button('export-table-image', 'Table image') : '') +
      button('export-equations', 'Copy equations') +
      `<label class="export-theme">Image <select id="export-theme" class="unit-select" aria-label="Image theme"><option value="light">light</option><option value="dark">dark</option></select></label>`;
    toolbar.append(tools);
    const theme = () => $('export-theme').value;
    const slug = document.title.split('·')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rf-lab';
    const caption = () => { try { return resolve(config.caption) || ''; } catch (_) { return ''; } };
    if ($('export-figure')) $('export-figure').addEventListener('click', () => {
      if (!Bench.valid) return say('Enter valid inputs before copying an image.', true);
      copyImage({ title: config.figureTitle || 'Figure', caption: caption(), nodes: list(config.figure), theme: theme() }, `${slug}-figure.png`);
    });
    if ($('export-table')) {
      $('export-table').addEventListener('click', () => { if (Bench.valid) Bench.copy(tableText(list(config.tables))); });
      $('export-table-image').addEventListener('click', () => {
        if (!Bench.valid) return say('Enter valid inputs before copying an image.', true);
        copyImage({ title: config.tableTitle || 'Table', caption: caption(), nodes: list(config.tables), theme: theme() }, `${slug}-table.png`);
      });
    }
    $('export-equations').addEventListener('click', async () => {
      if (!Bench.valid) return say('Enter valid inputs before copying an image.', true);
      say('Rendering the equations…');
      let calculation;
      try { calculation = await Bench.calculationClone(); } catch (_) { return say('The equation renderer is not available.', true); }
      copyImage({ title: 'Calculation', caption: caption(), nodes: [...list(config.equations), calculation], theme: theme(), width: 760 }, `${slug}-equations.png`);
    });
    const enable = valid => ['export-figure', 'export-table', 'export-table-image', 'export-equations'].forEach(id => { if ($(id)) $(id).disabled = !valid; });
    document.addEventListener('bench-valid', event => enable(event.detail));
    enable(Bench.valid);
  }
  window.Snapshot = { render, copyImage, tableText, mount, prepare: (node, theme) => recolour(freeze(node.cloneNode(true)), theme) };
  window.Bench.exports = mount;
})();
