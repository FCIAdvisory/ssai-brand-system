/* SSAI — control dock: cross-page navigator + global accent picker.
   One consistent, theme-aware bar shared by every page. Self-contained styles;
   respects html[data-theme]. Accent persists in localStorage ('ssai-accent') and
   drives --accent / --accent-rgb / --accent-ink (and --accent-label via each page's
   CSS color-mix), recoloring buttons and accent text live. */
(function () {
  'use strict';

  var PAGES = [
    { f: 'vision.html', label: 'Overview' },
    { f: 'index.html', label: 'Gateway' },
    { f: 'homepage.html', label: 'Homepage' },
    { f: 'brand-book.html', label: 'Brand Book' },
    { f: 'interactive-kit.html', label: 'Kit' }
  ];
  /* Curated accent palette — vivid on deep space, legible on starlight. */
  var ACCENTS = [
    { id: 'teal',    name: 'Aurora Teal',  hex: '#2fd9c3', rgb: '47,217,195',  ink: '#04201c' },
    { id: 'blue',    name: 'Ion Blue',     hex: '#4d8dff', rgb: '77,141,255',  ink: '#03102b' },
    { id: 'violet',  name: 'Plasma',       hex: '#a974ff', rgb: '169,116,255', ink: '#1a0840' },
    { id: 'gold',    name: 'Solar Gold',   hex: '#f5b13a', rgb: '245,177,58',  ink: '#241701' },
    { id: 'green',   name: 'Aurora Green', hex: '#5fd98a', rgb: '95,217,138',  ink: '#042814' },
    { id: 'magenta', name: 'Nebula Pink',  hex: '#ff5d8f', rgb: '255,93,143',  ink: '#2a0716' }
  ];
  /* Pages whose buttons + accent text are wired to --accent (show the picker here). */
  var ACCENT_PAGES = ['vision.html', 'index.html', 'homepage.html', 'interactive-kit.html'];

  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!here || here.indexOf('.html') === -1) here = 'index.html';

  function curAccent() {
    var id; try { id = localStorage.getItem('ssai-accent'); } catch (e) {}
    for (var i = 0; i < ACCENTS.length; i++) if (ACCENTS[i].id === id) return ACCENTS[i];
    return ACCENTS[0];
  }
  function applyAccent(a) {
    var s = document.documentElement.style;
    s.setProperty('--accent', a.hex);
    s.setProperty('--accent-rgb', a.rgb);
    s.setProperty('--accent-ink', a.ink);
  }
  /* apply immediately to minimize flash */
  applyAccent(curAccent());

  var css = '' +
    '.ssai-dock{position:fixed;left:16px;bottom:16px;z-index:300;display:flex;align-items:center;gap:3px;padding:6px 8px;border-radius:30px;' +
    'background:rgba(8,6,26,.74);border:1px solid rgba(166,171,230,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
    "font-family:'Chakra Petch',ui-sans-serif,system-ui,sans-serif;box-shadow:0 14px 44px -18px rgba(0,0,0,.75);max-width:calc(100vw - 32px);flex-wrap:wrap}" +
    ':root[data-theme="light"] .ssai-dock{background:rgba(255,255,255,.85);border-color:rgba(22,20,95,.16);box-shadow:0 14px 44px -22px rgba(22,20,95,.45)}' +
    '.ssai-dock-tag{font-style:italic;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-size:10px;color:#7e84bf;padding:0 9px 0 6px;white-space:nowrap}' +
    '.ssai-dock-sep{width:1px;height:16px;background:rgba(166,171,230,.24);margin:0 3px}' +
    ':root[data-theme="light"] .ssai-dock-sep{background:rgba(22,20,95,.16)}' +
    '.ssai-dock a,.ssai-dock span.cur{font-weight:600;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#a6abe6;text-decoration:none;padding:6px 11px;border-radius:20px;white-space:nowrap;cursor:pointer}' +
    '.ssai-dock a{transition:color .18s,background .18s}' +
    '.ssai-dock a:hover{color:#fff;background:rgba(166,171,230,.14)}' +
    ':root[data-theme="light"] .ssai-dock a{color:#54597f}' +
    ':root[data-theme="light"] .ssai-dock a:hover{color:#161438;background:rgba(22,20,95,.07)}' +
    '.ssai-dock span.cur{color:var(--accent-ink,#04201c);background:var(--accent,#2fd9c3);cursor:default}' +
    '.ssai-dock-acclab{font-weight:600;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#7e84bf;padding:0 5px}' +
    '.ssai-dock-dots{display:flex;align-items:center;gap:6px;padding-right:4px}' +
    '.ssai-dock-dot{width:16px;height:16px;border-radius:50%;border:0;padding:0;cursor:pointer;background:var(--sw);box-shadow:0 0 0 1px rgba(255,255,255,.28);transition:transform .15s ease,box-shadow .15s ease}' +
    '.ssai-dock-dot:hover{transform:scale(1.18)}' +
    '.ssai-dock-dot.on{box-shadow:0 0 0 2px rgba(255,255,255,.92),0 0 11px var(--sw)}' +
    ':root[data-theme="light"] .ssai-dock-dot{box-shadow:0 0 0 1px rgba(22,20,95,.2)}' +
    ':root[data-theme="light"] .ssai-dock-dot.on{box-shadow:0 0 0 2px #161438,0 0 11px var(--sw)}' +
    '@media(max-width:760px){.ssai-dock-tag,.ssai-dock-acclab{display:none}.ssai-dock a,.ssai-dock span.cur{font-size:10px;padding:5px 9px}}';

  function build() {
    if (document.querySelector('.ssai-dock')) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var dock = document.createElement('nav');
    dock.className = 'ssai-dock';
    dock.setAttribute('aria-label', 'SSAI brand system navigation and accent');

    var html = '<span class="ssai-dock-tag">SSAI Brand System</span><span class="ssai-dock-sep"></span>';
    PAGES.forEach(function (p) {
      if (p.f === here) html += '<span class="cur" aria-current="page">' + p.label + '</span>';
      else html += '<a href="' + p.f + '">' + p.label + '</a>';
    });

    if (ACCENT_PAGES.indexOf(here) !== -1) {
      html += '<span class="ssai-dock-sep"></span><span class="ssai-dock-acclab">Accent</span><span class="ssai-dock-dots" role="group" aria-label="Accent colour">';
      var cur = curAccent();
      ACCENTS.forEach(function (a) {
        html += '<button type="button" class="ssai-dock-dot' + (a.id === cur.id ? ' on' : '') +
          '" data-acc="' + a.id + '" title="' + a.name + '" aria-label="' + a.name + '" style="--sw:' + a.hex + '"></button>';
      });
      html += '</span>';
    }
    dock.innerHTML = html;
    document.body.appendChild(dock);

    dock.addEventListener('click', function (e) {
      var dot = e.target.closest ? e.target.closest('.ssai-dock-dot') : null;
      if (!dot) return;
      var id = dot.getAttribute('data-acc');
      var a = null;
      for (var i = 0; i < ACCENTS.length; i++) if (ACCENTS[i].id === id) a = ACCENTS[i];
      if (!a) return;
      applyAccent(a);
      try { localStorage.setItem('ssai-accent', a.id); } catch (err) {}
      var dots = dock.querySelectorAll('.ssai-dock-dot');
      for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('on', dots[j] === dot);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
