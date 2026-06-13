/* SSAI — shared theme toggle wiring.
   Pair with the tiny pre-paint script in <head>:
   <script>(function(){try{if(localStorage.getItem('ssai-theme')==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();</script>
   Markup expected: a #themeTog button, optional #navMark / #footLogo <img>. */
(function () {
  'use strict';
  function wire() {
    var html = document.documentElement;
    var btn = document.getElementById('themeTog');
    var navMark = document.getElementById('navMark');
    var footLogo = document.getElementById('footLogo');
    function apply(t, save) {
      if (t === 'light') html.setAttribute('data-theme', 'light');
      else html.removeAttribute('data-theme');
      if (navMark) navMark.setAttribute('src', t === 'light' ? 'assets/logo/ssai-indigo-mark.png' : 'assets/logo/ssai-white-mark.png');
      if (footLogo) footLogo.setAttribute('src', t === 'light' ? 'assets/logo/ssai-color-full.png' : 'assets/logo/ssai-white-full.png');
      if (window.__setGatewayTheme) window.__setGatewayTheme(t);
      if (save) { try { localStorage.setItem('ssai-theme', t); } catch (e) {} }
    }
    var cur = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    apply(cur, false);
    if (btn) btn.addEventListener('click', function () { cur = (cur === 'light') ? 'dark' : 'light'; apply(cur, true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
