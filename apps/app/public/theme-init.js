// Applies the stored theme before first paint to avoid a flash of the wrong theme.
// Served as an external, same-origin script so it is allowed by the production
// Content-Security-Policy (script-src 'self' forbids inline scripts).
(function () {
  try {
    var t = localStorage.getItem('tracknow-theme')
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
  } catch (e) {
    /* storage unavailable (private mode, blocked) — fall back to system theme */
  }
})()
