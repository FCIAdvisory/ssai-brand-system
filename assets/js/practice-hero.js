/* ============================================================================
   SSAI — practice hero (full-bleed living WebGL behind a practice headline).
   Drop <div class="phero-webgl" data-hero="globe"></div> inside a .phero.live
   and load this module. Variants: globe (Science). More to come.
   Composed for a hero (subject offset right), slow drift + mouse parallax,
   breathes, pauses when off-screen, renders a still frame for reduced-motion.
   ============================================================================ */
import * as THREE from 'three';

const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const GOLD = 0xf2c14e, BLUE = 0x4a86dd, ICE = 0xcfe0ff;

function sphere(r) {
  const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
  return new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
}
function glowTex() {
  if (glowTex._c) return glowTex._c;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex._c = new THREE.CanvasTexture(c); return glowTex._c;
}
function sampleLand(url, R, cb) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const W = 480, H = 240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, W, H);
    let data; try { data = cx.getImageData(0, 0, W, H).data; } catch (e) { cb(new Float32Array(0), []); return; }
    const out = [], anchors = [], TARGET = 5200; let tries = 0;
    while (out.length / 3 < TARGET && tries < TARGET * 8) {
      tries++;
      const v = sphere(R);
      const lon = Math.atan2(v.z, v.x), lat = Math.asin(v.y / R);
      const u = (lon / (2 * Math.PI) + 0.5), t = (0.5 - lat / Math.PI);
      const px = Math.min(W - 1, Math.max(0, (u * W) | 0)), py = Math.min(H - 1, Math.max(0, (t * H) | 0));
      const idx = (py * W + px) * 4, r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r + g + b) / 765;
      const isLand = (b < (r + g) / 2 * 1.08) && bright > 0.09 && bright < 0.74;
      if (isLand) { out.push(v.x, v.y, v.z); if (anchors.length < 120 && Math.random() < 0.04) anchors.push(v.clone()); }
    }
    cb(new Float32Array(out), anchors);
  };
  img.onerror = () => cb(new Float32Array(0), []);
  img.src = url;
}

function initGlobe(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const root = new THREE.Group(); scene.add(root);
  root.rotation.z = 0.36;                     // axial tilt
  const updaters = [];

  // backdrop starfield
  (function stars() {
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const r = 26 + Math.random() * 22, v = sphere(r); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ICE, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false })));
  })();

  const R = 2.25;
  const globe = new THREE.Group(); root.add(globe);

  // faint point-sphere shell (gives the globe its form)
  (function shell() {
    const N = 2200, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = sphere(R); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: BLUE, size: 0.02, transparent: true, opacity: 0.30, depthWrite: false })));
  })();

  // continents from the Earth day map (bright clusters)
  const landGeo = new THREE.BufferGeometry();
  const landMat = new THREE.PointsMaterial({ color: ICE, size: 0.035, transparent: true, opacity: 0.96, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.Points(landGeo, landMat));
  const landAnchors = [];
  sampleLand('assets/images/scenes/journey/earth-day.jpg', R, (positions, anchors) => {
    landGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    landAnchors.push(...anchors);
    for (let i = 0; i < 11; i++) addArc();
  });

  // atmosphere rim glow (back sprite behind the globe)
  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3c7be0, transparent: true, opacity: 0.55, depthWrite: false }));
  atmo.scale.set(R * 4.2, R * 4.2, 1); atmo.position.z = -0.6; globe.add(atmo);

  // orbital rings + traveling satellites
  const sats = [];
  [[R*1.45,0.5,0.0,GOLD],[R*1.8,-0.7,1.2,BLUE],[R*2.2,0.3,2.4,GOLD],[R*2.6,1.0,0.7,ICE]].forEach(([rad,tilt,phase,col]) => {
    const grp = new THREE.Group(); grp.rotation.x = Math.PI/2 + tilt; grp.rotation.y = phase; root.add(grp);
    const seg = 160, op = new Float32Array((seg+1)*3);
    for (let i = 0; i <= seg; i++) { const a = i/seg*Math.PI*2; op[i*3]=Math.cos(a)*rad; op[i*3+1]=0; op[i*3+2]=Math.sin(a)*rad; }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    grp.add(new THREE.Line(og, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.22 })));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: col }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.85, depthWrite: false }));
    glow.scale.set(0.4, 0.4, 1); sat.add(glow); grp.add(sat);
    sats.push({ sat, rad, a: Math.random()*6.28, spd: 0.16 + Math.random()*0.16 });
  });

  // data arcs between land anchors
  const arcGroup = new THREE.Group(); globe.add(arcGroup);
  const arcs = [];
  function addArc() {
    if (landAnchors.length < 2) return;
    const a = landAnchors[(Math.random()*landAnchors.length)|0], b = landAnchors[(Math.random()*landAnchors.length)|0];
    if (a === b) return;
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.3 + Math.random()*0.3));
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(44);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? GOLD : ICE, transparent: true, opacity: 0 });
    arcGroup.add(new THREE.Line(g, m));
    arcs.push({ m, life: Math.random()*4, dur: 3 + Math.random()*3 });
  }

  updaters.push((dt, t) => {
    globe.rotation.y += dt * 0.05;
    globe.scale.setScalar(1 + Math.sin(t * 0.5) * 0.012);          // breathe
    sats.forEach(s => { s.a += dt * s.spd; s.sat.position.set(Math.cos(s.a)*s.rad, 0, Math.sin(s.a)*s.rad); });
    arcs.forEach(o => { o.life += dt; o.m.opacity = Math.sin((o.life % o.dur) / o.dur * Math.PI) * 0.7; });
  });

  // ---- composition: push the subject toward the right of the frame ----
  function layout() {
    const w = el.clientWidth || 960, h = el.clientHeight || 600;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    root.position.x = w > 760 ? 2.3 : 0;        // offset right on desktop, centered on mobile
    root.position.y = w > 760 ? 0.1 : 0.2;
  }
  layout(); new ResizeObserver(layout).observe(el);

  // mouse parallax (camera)
  let mx = 0, my = 0;
  if (!REDUCE) window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const clock = new THREE.Clock();
  let visible = true, looping = true;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!REDUCE) {
      updaters.forEach(u => u(dt, t));
      camera.position.x += (mx * 0.6 - camera.position.x) * 0.04;
      camera.position.y += (-my * 0.45 - camera.position.y) * 0.04;
      camera.lookAt(root.position.x * 0.5, 0, 0);
    }
    renderer.render(scene, camera);
    if (!REDUCE && visible) { requestAnimationFrame(frame); } else { looping = false; }
  }
  frame();
  if (!REDUCE && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !looping) { looping = true; requestAnimationFrame(frame); } }, { rootMargin: '200px' }).observe(el);
  }
  if (REDUCE) { updaters.forEach(u => u(0.5, 0.5)); renderer.render(scene, camera); }
}

const BUILDERS = { globe: initGlobe };
function boot() {
  document.querySelectorAll('.phero-webgl').forEach(el => {
    const v = el.dataset.hero || 'globe';
    try { (BUILDERS[v] || initGlobe)(el); } catch (e) { console.warn('practice-hero failed', e); }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
