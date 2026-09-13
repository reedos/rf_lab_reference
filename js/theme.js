// Colour theme: Auto follows the operating system, the way an instrument's screen follows its
// print mode; Light and Dark pin it. The choice is one word in this browser's storage and
// nothing else is written. The head of each page applies the same rule before the stylesheet
// paints, so a light-mode visitor never sees a dark flash.
(function () {
  'use strict';
  const KEY = 'rf-lab:theme';
  const media = matchMedia('(prefers-color-scheme: light)');
  let choice = 'system';
  try { const stored = localStorage.getItem(KEY); if (stored === 'light' || stored === 'dark') choice = stored; } catch (_) { /* storage unavailable */ }
  const resolved = () => choice === 'system' ? (media.matches ? 'light' : 'dark') : choice;
  function apply() {
    const theme = resolved();
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#090b10');
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const active = button.dataset.themeChoice === choice;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
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
    if (!top || document.querySelector('.theme-switch')) return;
    const box = document.createElement('div');
    box.className = 'seg theme-switch';
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Colour theme');
    box.innerHTML = [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]
      .map(([value, label]) => `<button type="button" class="seg-btn" data-theme-choice="${value}" aria-pressed="false" title="${value === 'system' ? 'Follow the system setting' : label + ' theme'}">${label}</button>`).join('');
    box.addEventListener('click', event => { const button = event.target.closest('[data-theme-choice]'); if (button) set(button.dataset.themeChoice); });
    top.append(box);
    apply();
  }
  window.Theme = { get choice() { return choice; }, get resolved() { return resolved(); }, set };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
