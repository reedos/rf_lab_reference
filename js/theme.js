// Colour theme: one button at the top right cycles Auto, Light and Dark. Auto follows the
// operating system, the way an instrument's screen follows its print mode. A pinned choice is
// one word in this browser's storage and nothing else is written. The head of each page
// applies the same rule before the stylesheet paints, so a light-mode visitor never sees a
// dark flash. The icon shows the choice in force.
(function () {
  'use strict';
  const KEY = 'rf-lab:theme';
  const media = matchMedia('(prefers-color-scheme: light)');
  const NEXT = { system: 'light', light: 'dark', dark: 'system' };
  const LABEL = { system: 'Auto, following the system', light: 'Light', dark: 'Dark' };
  const ICON = {
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  let choice = 'system', button = null;
  try { const stored = localStorage.getItem(KEY); if (stored === 'light' || stored === 'dark') choice = stored; } catch (_) { /* storage unavailable */ }
  const resolved = () => choice === 'system' ? (media.matches ? 'light' : 'dark') : choice;
  function apply() {
    const theme = resolved();
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#090b10');
    if (button) {
      button.innerHTML = ICON[choice];
      button.setAttribute('data-theme-choice', choice);
      const text = `Theme: ${LABEL[choice]}. Switch to ${LABEL[NEXT[choice]].split(',')[0].toLowerCase()}`;
      button.setAttribute('aria-label', text); button.title = text;
    }
    document.dispatchEvent(new CustomEvent('theme-change', { detail: theme }));
  }
  function set(next) {
    choice = next === 'light' || next === 'dark' ? next : 'system';
    try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch (_) { /* the choice still applies for this page */ }
    apply();
  }
  media.addEventListener('change', () => { if (choice === 'system') apply(); });
  function mount() {
    const top = document.querySelector('header.top');
    if (!top || document.getElementById('theme-button')) return;
    button = document.createElement('button');
    button.type = 'button'; button.id = 'theme-button'; button.className = 'theme-button';
    button.addEventListener('click', () => set(NEXT[choice]));
    top.append(button);
    apply();
  }
  window.Theme = { get choice() { return choice; }, get resolved() { return resolved(); }, set };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
