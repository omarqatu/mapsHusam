// Applies the saved theme before the first paint (no flash). External file: the server's CSP forbids inline scripts.
try {
  var t = localStorage.getItem('psm-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  // The admin's brand colours (CSS built by src/features/brand-theme; the app replaces it once the server answers).
  var css = localStorage.getItem('psm-brand-css');
  if (css) {
    var s = document.createElement('style');
    s.id = 'psm-brand';
    s.textContent = css;
    document.head.appendChild(s);
  }
} catch (e) {
  /* storage blocked: follow the system theme and the default colours */
}
