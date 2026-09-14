// One builder draws every page's block diagram as HTML: blocks joined by buses, each bus
// carrying one or two rails with a wire, an arrow, a tag above, a label below, and a port with
// a nub on the block at either end. HTML rather than SVG so the drawing reflows on a phone,
// carries subscripts and colour the way the rest of the page does, and exports with the same
// stylesheet. Grid placement is set here; the widths live in the stylesheet.
//
// spec = { id, caption, captionId, ariaLabel,
//   blocks: [{ kicker, title, sub, z, zId, accent: 'in'|'out'|null, midcap, foot }],   // 2 or 3
//   buses:  [{ rails: [{ tone: 'accent'|'plus'|'minus'|'neutral', left: {label, id}, right: {label, id},
//                        top: {html, id}, bottom: {html, id}, ground, tap: {label, side}, arrow }],
//             brace: { side: 'in'|'out', label } }] }                                   // blocks - 1
(function () {
  'use strict';
  const GROUND = '<svg class="gnd" viewBox="0 0 24 12" aria-hidden="true"><path d="M4 2 H20 M7 6 H17 M10 10 H14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/></svg>';
  function el(tag, cls, html, id) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined && html !== null) node.innerHTML = html;
    if (id) node.id = id;
    return node;
  }
  function render(host, spec) {
    const blocks = spec.blocks, buses = spec.buses;
    const railRows = Math.max(1, ...buses.map(bus => bus.rails.length));
    const figure = el('figure', 'schematic', null, spec.id);
    figure.setAttribute('aria-label', spec.ariaLabel || spec.caption || 'Block diagram');
    if (spec.caption) figure.append(el('figcaption', 'schematic-cap', spec.caption, spec.captionId));
    const grid = el('div', 'blk');
    grid.dataset.blocks = String(blocks.length);
    grid.dataset.rails = String(railRows);
    if (spec.midWide) grid.dataset.mid = 'wide';
    const columns = [];
    blocks.forEach((block, i) => {
      columns.push(i === 0 || i === blocks.length - 1 ? 'var(--block-w)' : 'var(--mid-w)');
      if (i < blocks.length - 1) columns.push('minmax(var(--bus-min), 1fr)');
    });
    grid.style.gridTemplateColumns = columns.join(' ');
    const railSpan = `2 / ${2 + railRows}`;
    const put = (node, column, row) => { node.style.gridColumn = String(column); node.style.gridRow = row; grid.append(node); return node; };
    blocks.forEach((block, i) => {
      const column = 2 * i + 1;
      const shell = put(el('div', 'blk-shell' + (block.accent ? ' edge-' + block.accent : '')), column, '1 / -1');
      shell.setAttribute('aria-hidden', 'true');
      const head = put(el('div', 'blk-head'), column, '1');
      if (block.kicker) head.append(el('span', 'node-kicker', block.kicker, block.kickerId));
      if (block.title) head.append(el('strong', 'node-title', block.title, block.titleId));
      if (block.sub) head.append(el('span', 'node-sub', block.sub, block.subId));
      if (block.z) head.append(el('span', 'node-z', block.z, block.zId));
      if (block.midcap) put(el('div', 'blk-midcap', block.midcap), column, railSpan);
      put(el('div', 'blk-foot', block.foot || ''), column, String(2 + railRows));
    });
    buses.forEach((bus, i) => {
      const column = 2 * i + 2;
      bus.rails.forEach((rail, r) => {
        const row = bus.rails.length === 1 ? railSpan : String(2 + r);
        const tone = rail.tone && rail.tone !== 'accent' ? ' ' + rail.tone : '';
        const left = put(el('div', 'blk-port src-port' + tone), column - 1, row);
        left.append(el('span', null, rail.left && rail.left.label || '', rail.left && rail.left.id), el('i', 'nub'));
        const right = put(el('div', 'blk-port dut-port' + tone), column + 1, row);
        right.append(el('i', 'nub'), el('span', null, rail.right && rail.right.label || '', rail.right && rail.right.id));
        left.lastChild.setAttribute('aria-hidden', 'true'); right.firstChild.setAttribute('aria-hidden', 'true');
        const line = put(el('div', 'blk-bus' + tone), column, row);
        line.append(el('span', 'rail-tag', rail.top ? rail.top.html : '', rail.top && rail.top.id));
        const track = el('div', 'bus-track');
        track.append(el('span', 'wire'));
        if (rail.arrow !== false) track.append(el('span', 'arrow'));
        line.append(track);
        const below = el('div', 'rail-sub');
        if (rail.bottom) below.append(el('span', null, rail.bottom.html, rail.bottom.id));
        if (rail.tap) below.append(el('span', 'rail-tap side-' + rail.tap.side, `<span>${rail.tap.label}</span>${GROUND}`));
        else if (rail.ground) below.append(el('span', 'rail-ground', GROUND));
        line.append(below);
      });
      if (bus.brace && bus.rails.length > 1) {
        const brace = put(el('div', 'bus-brace side-' + bus.brace.side), column, railSpan);
        brace.setAttribute('aria-hidden', 'true');
        brace.append(el('span', 'bus-callout', bus.brace.label));
      }
    });
    figure.append(grid);
    host.replaceChildren(figure);
    return figure;
  }
  render.ground = GROUND;
  window.Bench.diagram = render;
})();
