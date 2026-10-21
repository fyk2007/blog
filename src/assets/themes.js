(() => {
  'use strict';

  const storageKey = 'fyk-theme';
  const themes = ['blue', 'sage', 'sand', 'lavender', 'rose', 'teal', 'graphite', 'olive'];
  const labels = { blue: '蓝白', sage: '苔绿', sand: '暖砂', lavender: '雾紫', rose: '灰粉', teal: '青灰', graphite: '石墨', olive: '浅橄榄' };
  const root = document.documentElement;
  let current = 'blue';
  try {
    const stored = localStorage.getItem(storageKey);
    if (themes.includes(stored)) current = stored;
  } catch (_) { /* The control also works when storage is unavailable. */ }
  root.dataset.theme = current;

  function syncControls() {
    document.querySelectorAll('.theme-control').forEach(control => {
      control.querySelector('.theme-trigger')?.setAttribute('aria-label', `配色：${labels[current]}`);
      control.querySelectorAll('[data-theme-value]').forEach(option => {
        const selected = option.dataset.themeValue === current;
        option.setAttribute('aria-checked', String(selected));
        option.tabIndex = selected ? 0 : -1;
      });
    });
  }

  function selectTheme(value, persist = true) {
    if (!themes.includes(value)) return;
    current = value;
    root.dataset.theme = value;
    if (persist) {
      try { localStorage.setItem(storageKey, value); } catch (_) { /* Optional persistence. */ }
    }
    syncControls();
  }

  function init() {
    syncControls();
    document.querySelectorAll('.theme-control').forEach(control => {
      const trigger = control.querySelector('.theme-trigger');
      const options = Array.from(control.querySelectorAll('[data-theme-value]'));
      if (!trigger || !options.length) return;

      function close(returnFocus = false) {
        control.open = false;
        if (returnFocus) trigger.focus({ preventScroll: true });
      }

      options.forEach(option => {
        option.addEventListener('click', () => {
          selectTheme(option.dataset.themeValue);
          close(true);
        });
      });

      trigger.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        control.open = true;
        options.find(option => option.dataset.themeValue === current)?.focus({ preventScroll: true });
      });

      control.addEventListener('keydown', event => {
        if (event.key === 'Escape' && control.open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
          return;
        }
        const index = options.indexOf(event.target);
        if (index < 0) return;
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else return;
        event.preventDefault();
        selectTheme(options[next].dataset.themeValue);
        options[next].focus({ preventScroll: true });
      });

      document.addEventListener('pointerdown', event => {
        if (control.open && !control.contains(event.target)) close();
      });
      control.addEventListener('focusout', event => {
        if (control.open && event.relatedTarget && !control.contains(event.relatedTarget)) close();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.addEventListener('storage', event => {
    if (event.key === storageKey) selectTheme(themes.includes(event.newValue) ? event.newValue : 'blue', false);
  });
})();
