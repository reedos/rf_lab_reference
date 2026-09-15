// Calculator state belongs in the fragment, which is not part of an HTTP request.
// This is sharing convenience, not encryption: recipients and browser history can read it.
(function () {
  'use strict';
  function readUrl(value) {
    const url = new URL(value, location.href);
    const params = new URLSearchParams(url.search);
    if (url.hash.startsWith('#?')) new URLSearchParams(url.hash.slice(2)).forEach((v, k) => params.set(k, v));
    return params;
  }
  function writeUrl(base, params) {
    const clean = base.split(/[?#]/)[0];
    const text = params.toString();
    return clean + (text ? '#?' + text : '');
  }
  const replace = history.replaceState.bind(history);
  history.replaceState = function (data, title, value) {
    if (typeof value === 'string') {
      const url = new URL(value, location.href);
      if (url.search || url.hash.startsWith('#?')) value = writeUrl(value, readUrl(value));
    }
    return replace(data, title, value);
  };
  window.LinkState = { read: () => readUrl(location.href), readUrl, writeUrl };
  // Legacy query links have already reached the host once. Move them before loading
  // page assets so future reloads, copied links and navigation no longer send state.
  if (location.search) history.replaceState(null, '', location.href);
  document.addEventListener('click', event => {
    const a = event.target.closest('a[href]');
    const href = a && a.getAttribute('href');
    if (!href || !href.startsWith('#') || href.startsWith('#?')) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault(); target.scrollIntoView();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  // Loading a different setup fragment on the same page must reinitialize its fields.
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#?')) location.reload(); });
})();
