/* ============================================================================
   SSAI — "wow" layer (cinematic restraint) for CONTENT pages.
   Learns from index.html: Lenis momentum ({duration:1.05,smoothWheel:true}),
   fade/rise reveals, photo-hero parallax + Ken Burns, headline word-rise,
   magnetic buttons. NEVER loaded on index.html. Progressive + reduced-motion safe.
   ============================================================================ */
(function () {
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var root = document.documentElement;
  root.classList.add('wow-on');
  if (reduce) root.classList.add('wow-reduce');

  var heroes = [].slice.call(document.querySelectorAll('.phero.shot, .phero.live'));

  // global failsafe: after the entrance window, force all copy visible no matter what
  setTimeout(function () { root.classList.add('wow-force'); }, 2200);

  /* ---- 1. enhance each photo hero: parallax image layer + word-rise headline ---- */
  heroes.forEach(function (hero) {
    var bg = hero.style.backgroundImage;
    if (bg && bg !== 'none') {
      var layer = document.createElement('div'); layer.className = 'wow-hero-bg';
      var img = document.createElement('div'); img.className = 'wow-hero-img';
      img.style.backgroundImage = bg;
      layer.appendChild(img);
      hero.insertBefore(layer, hero.firstChild);
      hero._wowLayer = layer;
      hero.style.backgroundImage = 'none';   // paint the image once (the layer carries it now)
    }
    var h1 = hero.querySelector('h1');
    if (h1 && !h1._wowSplit) { splitWords(h1); h1._wowSplit = true; }
    // entrance on next frame, with a failsafe so copy never stays hidden if rAF is throttled
    var doReveal = function () { if (h1) h1.classList.add('wow-in'); hero.classList.add('wow-in'); };
    requestAnimationFrame(function () { requestAnimationFrame(doReveal); });
    setTimeout(doReveal, 500);
  });

  /* ---- 2. Lenis momentum scroll (identical config to the homepage) ---- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }
  // keep Lenis in sync with the scroll-lock: the popup sets html overflow:hidden on
  // open and clears it on close. Observing that covers EVERY close path (x, backdrop,
  // Escape, the iframe Close button) without fragile per-event wiring. Also re-check the
  // modal's own open state so another html-style writer can't spuriously resume scroll.
  if (lenis && window.MutationObserver) {
    var lock = new MutationObserver(function () {
      var modalOpen = document.querySelector('.capmodal.open');
      if (document.documentElement.style.overflow === 'hidden' || modalOpen) lenis.stop(); else lenis.start();
    });
    lock.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  }

  /* ---- 3. hero parallax: the image drifts slower than the page ---- */
  if (!reduce && heroes.length) {
    var ticking = false;
    function applyParallax() {
      ticking = false;
      var vh = innerHeight;
      for (var i = 0; i < heroes.length; i++) {
        var hero = heroes[i], layer = hero._wowLayer;
        if (!layer) continue;
        var r = hero.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        var shift = Math.max(-40, Math.min(40, -(r.top / vh) * 40));
        layer.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      }
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(applyParallax); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    if (lenis) lenis.on('scroll', onScroll);
    applyParallax();
  }

  /* ---- 4. magnetic buttons (pointer devices only) ---- */
  if (!reduce && window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    [].slice.call(document.querySelectorAll('.btn, .cta')).forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        b.style.transform = 'translate(' + (mx * 0.08).toFixed(1) + 'px,' + (my * 0.08).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }

  /* ---- word splitter: wraps each word in <span class="wow-w"><span>…</span></span>,
         preserving <br> and inline spans (e.g. .em), with a staggered delay ---- */
  function splitWords(el) {
    var kids = [].slice.call(el.childNodes), idx = { n: 0 };
    el.textContent = '';
    kids.forEach(function (node) { appendSplit(el, node, idx); });
  }
  function appendSplit(parent, node, idx) {
    if (node.nodeType === 3) {
      var parts = node.textContent.split(/(\s+)/);
      parts.forEach(function (tok) {
        if (tok === '') return;
        if (/^\s+$/.test(tok)) { parent.appendChild(document.createTextNode(tok)); return; }
        var w = document.createElement('span'); w.className = 'wow-w';
        var inner = document.createElement('span');
        inner.textContent = tok;
        inner.style.transitionDelay = (Math.min(idx.n, 7) * 0.05).toFixed(2) + 's';
        idx.n++;
        w.appendChild(inner); parent.appendChild(w);
      });
    } else if (node.nodeType === 1) {
      if (node.tagName === 'BR') { parent.appendChild(node.cloneNode(false)); return; }
      var clone = node.cloneNode(false);
      [].slice.call(node.childNodes).forEach(function (c) { appendSplit(clone, c, idx); });
      parent.appendChild(clone);
    }
  }
})();
