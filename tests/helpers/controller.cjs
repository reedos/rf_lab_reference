const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const repo = path.resolve(__dirname, '../..');

// A controller unit-test fixture, not a browser: read real authored input defaults,
// dispatch input/change events, and execute the real number cache and URL code.
// Layout, rendering, pointer hit testing and clipboard integration belong in browser tests.
function boot(page, query = '') {
  const html = fs.readFileSync(path.join(repo, `${page}.html`), 'utf8');
  const elements = new Map(), all = [], docEvents = {}, winEvents = {};
  class Element {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs;
      this.id = attrs.id || ''; this.value = attrs.value || '';
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-')).map(([k,v]) => [k.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase()),v]));
      this.textContent = ''; this.innerHTML = ''; this.listeners = {};
      this.disabled = false; this.options = []; this.hidden = false;
      const classes = new Set((attrs.class || '').split(/\s+/));
      this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, on) { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); } };
    }
    addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    get selectedOptions() { return this.options.filter(o => o.value === this.value); }
    append(...children) { (this.children ||= []).push(...children); }
    replaceChildren() { this.innerHTML = ''; this.textContent = ''; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    closest(selector) { return matches(this, selector) ? this : null; }
    contains() { return true; }
    select() {}
    focus() { document.activeElement = this; }
  }
  const attrsOf = text => Object.fromEntries([...text.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] || '']));
  for (const match of html.matchAll(/<(input|button|select)\b([^>]*)>/g)) {
    const el = new Element(match[1], attrsOf(match[2]));
    if (el.tagName === 'SELECT') {
      const content = html.slice(match.index + match[0].length).split('</select>')[0];
      el.options = [...content.matchAll(/<option\b([^>]*)>([^<]*)/g)].map(m => ({ ...attrsOf(m[1]), textContent: m[2] }));
      el.value = (el.options.find(o => Object.hasOwn(o, 'selected')) || el.options[0] || {}).value || '';
    }
    all.push(el); if (el.id) elements.set(el.id, el);
  }
  function matches(el, selector) {
    // Match only simple selectors needed by these controllers. A descendant query
    // uses its final selector; the fixture doesn't claim to test DOM containment.
    const final = selector.trim().split(/\s+/).at(-1);
    const tag = final.match(/^[a-z]+/i)?.[0];
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    for (const m of final.matchAll(/\[([^=\]]+)(?:=['"]?([^\]'"\s]+)['"]?)?\]/g)) {
      if (!Object.hasOwn(el.attrs, m[1]) || (m[2] !== undefined && el.attrs[m[1]] !== m[2])) return false;
    }
    for (const m of final.matchAll(/\.([\w-]+)/g)) if (!el.classList.contains(m[1])) return false;
    return Boolean(tag || final.includes('[') || final.includes('.'));
  }
  const document = {
    readyState: 'loading', activeElement: null, documentElement: new Element(), body: new Element('body'),
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element('div', { id })); return elements.get(id); },
    querySelectorAll(selector) { return all.filter(el => matches(el, selector)); },
    querySelector(selector) { return all.find(el => matches(el, selector)) || null; },
    createElement(tag) { return new Element(tag); },
    addEventListener(k, fn) { (docEvents[k] ||= []).push(fn); },
    dispatchEvent(e) { for (const fn of docEvents[e.type] || []) fn(e); }
  };
  const initial = query.startsWith('http') ? query : `https://reedos.github.io/rf_lab_reference/${page}.html${query}`;
  let location = new URL(initial), latest;
  const window = { location, addEventListener(k, fn) { (winEvents[k] ||= []).push(fn); } };
  const sandbox = { URL, URLSearchParams, document, window, console, Math, WeakMap, location,
    getComputedStyle: () => ({ getPropertyValue: () => '' }), matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame() {},
    CustomEvent: class { constructor(type, props) { this.type = type; Object.assign(this, props); } },
    Event: class { constructor(type, props) { this.type = type; Object.assign(this, props); } },
    navigator: { clipboard: { writeText() {} } },
    history: { replaceState(_a, _b, next) { location = new URL(next, location); sandbox.location = window.location = location; } }
  };
  window.history = sandbox.history; window.setTimeout = sandbox.setTimeout; window.clearTimeout = sandbox.clearTimeout;
  const context = vm.createContext(sandbox);
  for (const file of ['rf', 'link-state', 'bench', 'dut']) {
    vm.runInContext(fs.readFileSync(path.join(repo, `js/${file}.js`), 'utf8'), context, { filename: `js/${file}.js` });
    Object.assign(sandbox, window);
  }
  const update = sandbox.Bench.update;
  window.RF = sandbox.RF;
  sandbox.Bench.update = value => { latest = value; update(value); };
  sandbox.Bench.exports = () => {};
  sandbox.Bench.diagram = () => {};
  sandbox.Bench.diagram.ground = '';
  sandbox.Bench.math = (el, latex) => { el.textContent = latex; };
  const controller = page === 'index' ? 'app' : page;
  vm.runInContext(fs.readFileSync(path.join(repo, `js/${controller}.js`), 'utf8'), context, { filename: `js/${controller}.js` });
  function event(el, type, extra = {}) {
    const e = { target: el, type, preventDefault() {}, ...extra };
    for (const fn of docEvents[type] || []) fn(e);
    for (const fn of el.listeners[type] || []) fn(e);
  }
  function edit(id, value) {
    const el = document.getElementById(id); document.activeElement = el; el.value = String(value);
    event(el, el.tagName === 'SELECT' ? 'change' : 'input'); document.activeElement = null;
  }
  function click(key, value) {
    const el = value === undefined ? document.getElementById(key) : all.find(el => el.dataset[key] === value);
    if (!el) throw new Error(`No control ${key}=${value}`);
    event(el, 'click');
  }
  return { edit, click, event, get: id => document.getElementById(id), read: id => sandbox.Bench.read(id),
    key: (key, extra = {}) => event(document.getElementById('smith'), 'keydown', { key, ...extra }),
    get valid() { return sandbox.Bench.valid; }, get url() { return sandbox.location.href; },
    get calculation() { return latest; }, dut: sandbox.Dut };
}
module.exports = { boot };
