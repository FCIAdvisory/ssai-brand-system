/* SSAI Gateway — motion engine
   Globe · Starfield · Counters · Parallax · Reveals · Tweak application
   Vanilla, no dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPRcap = 2;
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

  /* ---------------------------------------------------------------- Reveals */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* --------------------------------------------------------------- Counters */
  (function () {
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-counters]'));
    if (!groups.length) return;
    function fmt(n, comma) {
      n = Math.round(n);
      return comma ? n.toLocaleString('en-US') : String(n);
    }
    function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
    function run(group) {
      var stats = Array.prototype.slice.call(group.querySelectorAll('[data-target]'));
      stats.forEach(function (st, i) {
        var target = parseFloat(st.getAttribute('data-target')) || 0;
        var comma = st.getAttribute('data-comma') === '1';
        var valEl = st.querySelector('.stat-val');
        if (!valEl) return;
        if (reduce) { valEl.textContent = fmt(target, comma); return; }
        var dur = 1500, start = null, delay = i * 120;
        function tick(ts) {
          if (start === null) start = ts;
          var t = Math.min((ts - start) / dur, 1);
          valEl.textContent = fmt(target * easeOutExpo(t), comma);
          if (t < 1) requestAnimationFrame(tick);
          else valEl.textContent = fmt(target, comma);
        }
        setTimeout(function () { requestAnimationFrame(tick); }, delay);
      });
    }
    groups.forEach(function (g) {
      if (reduce || !('IntersectionObserver' in window)) { run(g); return; }
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { run(g); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(g);
    });
  })();

  /* -------------------------------------------------------------- Parallax */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length || reduce) return;
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var r = el.getBoundingClientRect();
        var center = r.top + r.height / 2;
        var off = (center - vh / 2) / vh; // -0.5..0.5-ish
        el.style.transform = 'translate3d(0,' + (off * speed * 100).toFixed(2) + 'px,0) scale(1.08)';
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ------------------------------------------------------------- Tilt cards */
  (function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
    if (!cards.length || reduce || matchMedia('(hover:none)').matches) return;
    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (px * 5).toFixed(2) + 'deg) rotateX(' + (-py * 5).toFixed(2) + 'deg) translateZ(0)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  })();

  /* ----------------------------------------------------------------- Globe */
  function makeGlobe(canvas) {
    var ctx = canvas.getContext('2d');
    function gpal(light) { return light
      ? { back: '150,158,214', front: '22,20,95', arc: '60,123,224', halo: '60,123,224', hub: '22,20,95', hubStroke: '34,31,122' }
      : { back: '60,73,170', front: '244,245,255', arc: '60,123,224', halo: '22,20,95', hub: '244,245,255', hubStroke: '244,245,255' }; }
    var COL = gpal(isLight());
    var SITES = [
      { lat: 38.99, lon: -76.85, c: '244,245,255', hub: true }, // Goddard
      { lat: 37.09, lon: -76.38, c: '47,217,195' },
      { lat: 37.41, lon: -122.06, c: '127,217,87' },
      { lat: 34.65, lon: -86.67, c: '242,180,60' },
      { lat: 30.36, lon: -89.60, c: '242,103,60' },
      { lat: 34.20, lon: -118.17, c: '138,92,255' },
      { lat: 28.57, lon: -80.65, c: '242,180,60' },
      { lat: 78.23, lon: 15.39, c: '47,217,195' },
      { lat: -77.85, lon: 166.67, c: '127,217,87' },
      { lat: 49.87, lon: 8.62, c: '138,92,255' }
    ];
    function ll(lat, lon) { var p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180; return { x: -Math.sin(p) * Math.cos(t), y: Math.cos(p), z: Math.sin(p) * Math.sin(t) }; }
    SITES.forEach(function (s) { var v = ll(s.lat, s.lon); s.x = v.x; s.y = v.y; s.z = v.z; });
    var hub = SITES[0];
    function slerp(a, b, t) { var d = a.x * b.x + a.y * b.y + a.z * b.z; d = Math.max(-1, Math.min(1, d)); var o = Math.acos(d); if (o < 1e-4) return { x: a.x, y: a.y, z: a.z }; var s = Math.sin(o), w1 = Math.sin((1 - t) * o) / s, w2 = Math.sin(t * o) / s; return { x: a.x * w1 + b.x * w2, y: a.y * w1 + b.y * w2, z: a.z * w1 + b.z * w2 }; }
    var arcs = [];
    for (var k = 1; k < SITES.length; k++) { var pts = [], N = 46; for (var s = 0; s <= N; s++) pts.push(slerp(hub, SITES[k], s / N)); arcs.push({ pts: pts, phase: Math.random() }); }
    var DOTS = [], ND = reduce ? 800 : 1400;
    (function () { var off = 2 / ND, inc = Math.PI * (3 - Math.sqrt(5)); for (var d = 0; d < ND; d++) { var y = d * off - 1 + off / 2, r = Math.sqrt(Math.max(0, 1 - y * y)), ph = d * inc; DOTS.push({ x: Math.cos(ph) * r, y: y, z: Math.sin(ph) * r }); } })();

    var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, DPRcap);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * (W < 720 ? 0.5 : 0.66); cy = H * 0.5;
      R = Math.min(W * 0.42, H * 0.62); R = Math.max(R, Math.min(W, H) * 0.34);
    }
    var rotY = 0, vel = 0.0016, curTilt = -0.34, t0 = 0, dragging = false, lastX = 0, lastY = 0, lastT = 0, raf = null, running = false;
    function rotate(p) {
      var cyR = Math.cos(rotY), syR = Math.sin(rotY);
      var x1 = p.x * cyR + p.z * syR, z1 = -p.x * syR + p.z * cyR;
      var ct = Math.cos(curTilt), st = Math.sin(curTilt);
      var y1 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
      return { x: cx + x1 * R, y: cy - y1 * R, z: z2 };
    }
    function frame(ts) {
      if (!t0) t0 = ts; var dt = Math.min(50, ts - t0); t0 = ts;
      ctx.clearRect(0, 0, W, H);
      if (!dragging) { rotY += vel; vel += (0.0016 - vel) * 0.02; } else { rotY += vel; }
      var halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      halo.addColorStop(0, 'rgba(' + COL.halo + ',0.30)'); halo.addColorStop(0.6, 'rgba(' + COL.halo + ',0.10)'); halo.addColorStop(1, 'rgba(' + COL.halo + ',0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 7); ctx.fill();
      for (var i = 0; i < DOTS.length; i++) {
        var p = rotate(DOTS[i]); var depth = (p.z + 1) / 2; var front = p.z > 0;
        var col = front ? COL.front : COL.back;
        var a = front ? (0.14 + depth * 0.5) : (0.10 + depth * 0.22);
        var rad = front ? (0.7 + depth * 1.1) : (0.5 + depth * 0.6);
        ctx.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fill();
      }
      for (var ai = 0; ai < arcs.length; ai++) {
        var arc = arcs[ai], ap = [];
        for (var s2 = 0; s2 < arc.pts.length; s2++) ap.push(rotate(arc.pts[s2]));
        ctx.lineWidth = 1;
        for (var s3 = 0; s3 < ap.length - 1; s3++) {
          var p1 = ap[s3], p2 = ap[s3 + 1]; var mz = (p1.z + p2.z) / 2; if (mz < -0.05) continue;
          var fade = Math.max(0, Math.min(1, (mz + 0.05) / 0.55));
          ctx.strokeStyle = 'rgba(' + COL.arc + ',' + (0.05 + fade * 0.30).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        if (!reduce) {
          arc.phase += dt * 0.00026; if (arc.phase > 1.35) arc.phase -= 1.7;
          var idx = arc.phase * (ap.length - 1);
          if (idx >= 0 && idx < ap.length - 1) {
            var fi = Math.floor(idx), fr = idx - fi, pp = ap[fi], np = ap[fi + 1];
            var px = pp.x + (np.x - pp.x) * fr, py = pp.y + (np.y - pp.y) * fr, pz = pp.z + (np.z - pp.z) * fr;
            if (pz > -0.05) {
              var pf = Math.max(0, Math.min(1, (pz + 0.05) / 0.55));
              var g = ctx.createRadialGradient(px, py, 0, px, py, 7);
              g.addColorStop(0, 'rgba(120,180,255,' + (0.85 * pf).toFixed(3) + ')'); g.addColorStop(1, 'rgba(60,123,224,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
            }
          }
        }
      }
      for (var mi = 0; mi < SITES.length; mi++) {
        var sp = rotate(SITES[mi]); if (sp.z <= 0.02) continue;
        var f = Math.max(0, Math.min(1, (sp.z - 0.02) / 0.5));
        var pulse = reduce ? 0.7 : (0.55 + 0.45 * Math.sin(ts * 0.003 + mi));
        var sz = SITES[mi].hub ? 4.4 : 3.2;
        var mcol = SITES[mi].hub ? COL.hub : SITES[mi].c;
        var gg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sz * 3.4);
        gg.addColorStop(0, 'rgba(' + mcol + ',' + (0.42 * f * pulse).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(' + mcol + ',0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sp.x, sp.y, sz * 3.4, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(' + mcol + ',' + (0.55 + 0.45 * f).toFixed(3) + ')';
        ctx.fillRect(sp.x - sz / 2, sp.y - sz / 2, sz, sz);
        if (SITES[mi].hub) { ctx.strokeStyle = 'rgba(' + COL.hubStroke + ',' + (0.45 * f).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.strokeRect(sp.x - sz / 2 - 2, sp.y - sz / 2 - 2, sz + 4, sz + 4); }
      }
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    function onDown(e) { dragging = true; var t = e.touches ? e.touches[0] : e; lastX = t.clientX; lastY = t.clientY; lastT = performance.now(); vel = 0; }
    function onMove(e) { if (!dragging) return; var t = e.touches ? e.touches[0] : e; var now = performance.now(); var dx = t.clientX - lastX; var dy = t.clientY - lastY; var dtm = Math.max(1, now - lastT); rotY += dx * 0.005; vel = dx * 0.005 * (16 / dtm); curTilt = Math.max(-1.0, Math.min(1.0, curTilt - dy * 0.004)); lastX = t.clientX; lastY = t.clientY; lastT = now; if (e.cancelable && Math.abs(dx) > Math.abs(dy)) e.preventDefault(); if (reduce) { ctx.clearRect(0, 0, W, H); frame(performance.now()); } }
    function onUp() { dragging = false; }
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    return {
      resize: resize,
      setTheme: function (light) { var t = gpal(light); for (var k in t) COL[k] = t[k]; if (reduce && W > 1) frame(performance.now()); },
      start: function () { resize(); if (reduce) { frame(performance.now()); return; } if (running) return; running = true; t0 = 0; raf = requestAnimationFrame(frame); },
      stop: function () { running = false; if (raf) cancelAnimationFrame(raf); }
    };
  }

  /* -------------------------------------------------------------- Starfield */
  function makeStarfield(canvas) {
    var ctx = canvas.getContext('2d');
    function spal(light) { return light
      ? { star: '34,31,122', neb1: '60,123,224', neb2: '138,92,255', na1: 0.07, na2: 0.05, shoot: '60,80,170', sa: 0.7 }
      : { star: '244,245,255', neb1: '60,123,224', neb2: '138,92,255', na1: 0.10, na2: 0.08, shoot: '180,210,255', sa: 1 }; }
    var SF = spal(isLight());
    var W = 0, H = 0, dpr = 1, raf = null, running = false, t0 = 0;
    var layers = [], shoot = null, shootTimer = 0;
    function build() {
      layers = [];
      var defs = [
        { n: Math.round((W * H) / 5200), sp: 0.004, r: [0.3, 0.9], a: [0.25, 0.55] },
        { n: Math.round((W * H) / 9000), sp: 0.010, r: [0.5, 1.4], a: [0.4, 0.8] },
        { n: Math.round((W * H) / 22000), sp: 0.020, r: [0.9, 2.0], a: [0.6, 1.0] }
      ];
      defs.forEach(function (d) {
        var arr = [];
        for (var i = 0; i < d.n; i++) arr.push({ x: Math.random() * W, y: Math.random() * H, r: d.r[0] + Math.random() * (d.r[1] - d.r[0]), a: d.a[0] + Math.random() * (d.a[1] - d.a[0]), ph: Math.random() * 6.28, tw: 0.4 + Math.random() * 1.6 });
        layers.push({ sp: d.sp, stars: arr });
      });
    }
    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, DPRcap);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    function frame(ts) {
      if (!t0) t0 = ts; var dt = Math.min(60, ts - t0); t0 = ts;
      ctx.clearRect(0, 0, W, H);
      // faint nebula wash
      var ng = ctx.createRadialGradient(W * 0.7, H * 0.32, 20, W * 0.7, H * 0.32, Math.max(W, H) * 0.7);
      ng.addColorStop(0, 'rgba(' + SF.neb1 + ',' + SF.na1 + ')'); ng.addColorStop(0.5, 'rgba(' + SF.neb1 + ',' + (SF.na1 * 0.6).toFixed(3) + ')'); ng.addColorStop(1, 'rgba(' + SF.neb1 + ',0)');
      ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
      var ng2 = ctx.createRadialGradient(W * 0.2, H * 0.8, 20, W * 0.2, H * 0.8, Math.max(W, H) * 0.6);
      ng2.addColorStop(0, 'rgba(' + SF.neb2 + ',' + SF.na2 + ')'); ng2.addColorStop(1, 'rgba(' + SF.neb2 + ',0)');
      ctx.fillStyle = ng2; ctx.fillRect(0, 0, W, H);
      for (var l = 0; l < layers.length; l++) {
        var lay = layers[l];
        for (var i = 0; i < lay.stars.length; i++) {
          var st = lay.stars[i];
          st.x -= lay.sp * dt * 6; if (st.x < -2) { st.x = W + 2; st.y = Math.random() * H; }
          var tw = reduce ? 1 : (0.55 + 0.45 * Math.sin(ts * 0.001 * st.tw + st.ph));
          ctx.globalAlpha = st.a * tw * SF.sa;
          ctx.fillStyle = 'rgba(' + SF.star + ',1)';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // shooting stars
      if (!reduce) {
        shootTimer -= dt;
        if (!shoot && shootTimer <= 0) {
          shoot = { x: Math.random() * W * 0.6 + W * 0.2, y: Math.random() * H * 0.4, vx: -(4 + Math.random() * 3), vy: (2 + Math.random() * 1.5), life: 1 };
          shootTimer = 4200 + Math.random() * 5000;
        }
        if (shoot) {
          shoot.x += shoot.vx * dt * 0.12; shoot.y += shoot.vy * dt * 0.12; shoot.life -= dt * 0.0016;
          if (shoot.life <= 0) { shoot = null; }
          else {
            var tx = shoot.x - shoot.vx * 9, ty = shoot.y - shoot.vy * 9;
            var lg = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
            lg.addColorStop(0, 'rgba(' + SF.shoot + ',' + (0.9 * shoot.life).toFixed(2) + ')'); lg.addColorStop(1, 'rgba(' + SF.shoot + ',0)');
            ctx.strokeStyle = lg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(tx, ty); ctx.stroke();
          }
        }
      }
      if (running && !reduce) raf = requestAnimationFrame(frame);
    }
    return {
      resize: resize,
      setTheme: function (light) { var t = spal(light); for (var k in t) SF[k] = t[k]; if (reduce && W > 1) frame(performance.now()); },
      start: function () { resize(); if (reduce) { frame(performance.now()); return; } if (running) return; running = true; t0 = 0; raf = requestAnimationFrame(frame); },
      stop: function () { running = false; if (raf) cancelAnimationFrame(raf); }
    };
  }

  /* -------------------------------------------------------- Hero controller */
  var hero = document.querySelector('.hero');
  var globe = null, stars = null, currentHero = null;
  var globeCanvas = hero && hero.querySelector('.hero-globe canvas');
  var starCanvas = hero && hero.querySelector('.hero-stars canvas');
  if (globeCanvas) globe = makeGlobe(globeCanvas);
  if (starCanvas) stars = makeStarfield(starCanvas);

  function setHero(style) {
    if (!hero) return;
    currentHero = style;
    hero.setAttribute('data-hero', style);
    if (globe) globe.stop();
    if (stars) stars.stop();
    if (style === 'globe' && globe) { requestAnimationFrame(globe.start); }
    else if (style === 'starfield' && stars) { requestAnimationFrame(stars.start); }
  }

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (currentHero === 'globe' && globe) globe.resize();
      if (currentHero === 'starfield' && stars) stars.resize();
    }, 140);
  });

  window.__setGatewayTheme = function (theme) {
    var light = theme === 'light';
    if (globe) globe.setTheme(light);
    if (stars) stars.setTheme(light);
  };

  /* ------------------------------------------------------- Apply tweaks API */
  var ACCENTS = {
    '#2fd9c3': { rgb: '47,217,195', hex: '#2fd9c3', ink: '#04201c' },
    '#3c7be0': { rgb: '60,123,224', hex: '#3c7be0', ink: '#04102a' },
    '#f2b43c': { rgb: '242,180,60', hex: '#f2b43c', ink: '#241701' },
    '#8a5cff': { rgb: '138,92,255', hex: '#8a5cff', ink: '#120630' }
  };
  window.__applyGatewayTweaks = function (t) {
    /* accent is owned globally by the control dock (switcher.js) */
    if (hero) {
      var img = hero.querySelector('.hero-cine img');
      if (img && t.heroImage) {
        var src = 'assets/images/' + t.heroImage + '.jpg';
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      }
    }
    var sys = document.getElementById('system');
    if (sys) sys.setAttribute('data-layout', t.cardLayout || 'grid');
    document.body.setAttribute('data-motion', t.motion === false ? 'off' : 'on');
    if (t.heroStyle && t.heroStyle !== currentHero) setHero(t.heroStyle);
  };

  /* Boot: read persisted tweak state if present, else defaults from DOM */
  function boot() {
    var initial = (window.__gatewayInitialTweaks) || { heroStyle: 'globe', heroImage: 'orbital-sunrise-limb', accent: '#2fd9c3', cardLayout: 'grid', motion: true };
    setHero(initial.heroStyle || 'globe');
    window.__applyGatewayTweaks(initial);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
