// Applies the saved theme before the first paint (no flash). External file: the server's CSP forbids inline scripts.
try {
  var t = localStorage.getItem('psm-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  /* storage blocked: follow the system theme */
}
