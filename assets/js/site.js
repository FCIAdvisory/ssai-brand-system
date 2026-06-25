/* ============================================================================
   SSAI — site-wide interactivity (scroll reveal + count-up stats)
   Progressive enhancement: if JS is off, nothing is hidden.
   ============================================================================ */

/* ---------------- nav active-state (set on the link matching this page) ------ */
(function () {
  try {
    var page = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (href && href === page) {
        a.classList.add('active');
        var item = a.closest('.nav-item');
        if (item) { var top = item.querySelector('.nav-link'); if (top) top.classList.add('active'); }
      }
    });
  } catch (e) {}
})();

(function () {
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------------- scroll reveal ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    document.body.classList.add('reveal-on');
    var sel = '.section .kick, .section .eyebrow, .section .dtitle, .section .lead, .section .body-col, ' +
              '.card, .stat, .chip, .figure, .flist > li, .band-cta > *, .phero .sub, .phero .btn-row, ' +
              '.cp-split > div, .media-grid > .figure, .grid > .card';
    var els = [].slice.call(document.querySelectorAll(sel)).filter(function (el) {
      return !el.closest('.nav, .footer, .site-foot, .nav-links');
    });
    // de-dupe (some selectors overlap)
    var uniq = []; var seenEl = new Set();
    els.forEach(function (el) { if (!seenEl.has(el)) { seenEl.add(el); uniq.push(el); } });
    // stagger by position among matched siblings
    var counts = new Map();
    uniq.forEach(function (el) {
      el.classList.add('r-el');
      var p = el.parentElement;
      var n = counts.get(p) || 0; el.dataset.ri = n; counts.set(p, n + 1);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = Math.min(6, +e.target.dataset.ri || 0) * 0.06;
        e.target.style.transitionDelay = d + 's';
        e.target.classList.add('r-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    uniq.forEach(function (el) { io.observe(el); });
    // failsafe: if the observer never fires (throttled/headless env), reveal everything so nothing stays hidden
    setTimeout(function () {
      if (!document.querySelector('.r-el.r-in')) uniq.forEach(function (el) { el.classList.add('r-in'); });
    }, 1700);
  }

  /* ---------------- count-up stats ---------------- */
  if ('IntersectionObserver' in window) {
    var nums = [].slice.call(document.querySelectorAll('.stat b, .lib-stat .n'));
    function parse(t) {
      var m = t.match(/^(\D*)([\d][\d,]*(?:\.\d+)?)(.*)$/);
      if (!m) return null;
      return { pre: m[1], val: parseFloat(m[2].replace(/,/g, '')), suf: m[3], comma: /,/.test(m[2]) };
    }
    function fmt(n, comma) { n = Math.round(n); return comma ? n.toLocaleString('en-US') : String(n); }
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; nio.unobserve(el);
        var p = parse(el.textContent.trim());
        if (!p || reduce) return;
        // skip plain years (e.g. "1977") and huge numbers
        if (p.pre === '' && p.suf === '' && p.val >= 1900 && p.val <= 2100) return;
        if (p.val > 1000000) return;
        var dur = 1200, t0 = null;
        el.textContent = p.pre + '0' + p.suf;
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur), e2 = 1 - Math.pow(1 - k, 3);
          el.textContent = p.pre + fmt(p.val * e2, p.comma) + p.suf;
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { nio.observe(el); });
  }
})();

/* ---------------- capability-statement popup viewer ---------------- */
(function () {
  if (/capability-statement/.test(location.pathname)) return; // don't intercept on the statement pages
  var sel = 'a[href$="capability-statement.html"],a[href$="capability-statement-defense.html"]';
  var modal, frame;
  function build() {
    modal = document.createElement('div');
    modal.className = 'capmodal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '<div class="capmodal-backdrop"></div><div class="capmodal-panel"><button class="capmodal-close" aria-label="Close">×</button><iframe class="capmodal-frame" title="Capability statement"></iframe></div>';
    document.body.appendChild(modal);
    frame = modal.querySelector('.capmodal-frame');
    modal.querySelector('.capmodal-backdrop').addEventListener('click', close);
    modal.querySelector('.capmodal-close').addEventListener('click', close);
  }
  function open(src) { if (!modal) build(); frame.src = src; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.documentElement.style.overflow = 'hidden'; }
  function close() { if (!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.documentElement.style.overflow = ''; setTimeout(function () { if (frame) frame.src = 'about:blank'; }, 300); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest(sel);
    if (a && !a.hasAttribute('download') && a.getAttribute('target') !== '_blank') { e.preventDefault(); open(a.getAttribute('href')); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('message', function (e) { if (e && e.data === 'close-capmodal') close(); });
})();
