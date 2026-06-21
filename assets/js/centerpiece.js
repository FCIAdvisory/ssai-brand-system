/* ============================================================================
   SSAI — animated centerpiece (the signature page animation)
   Drop a <div class="centerpiece" data-variant="globe"></div> on any page and
   load this module; it mounts a lightweight Three.js animation sized to the box.
   Variants: globe (default) · sun · galaxy · orbits
   Respects prefers-reduced-motion (renders a still frame).
   ============================================================================ */
import * as THREE from 'three';

const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const GOLD = 0xf2c14e, BLUE = 0x3c7be0, ICE = 0xcfe0ff, WARM = 0xffd9a0;

function init(el) {
  const variant = el.dataset.variant || 'globe';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  const root = new THREE.Group(); scene.add(root);
  const updaters = [];

  // faint backdrop starfield (all variants)
  (function stars() {
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 22 + Math.random() * 16, u = Math.random(), v = Math.random();
      const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
      pos[i*3] = r*Math.sin(ph)*Math.cos(th); pos[i*3+1] = r*Math.cos(ph); pos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ICE, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false })));
  })();

  if (variant === 'globe' || variant === 'orbits') buildGlobe(root, updaters, variant);
  else if (variant === 'sun') buildSun(root, updaters);
  else if (variant === 'galaxy') buildGalaxy(root, updaters);
  else buildGlobe(root, updaters, 'globe');

  function resize() {
    const w = el.clientWidth || 480, h = el.clientHeight || 480;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); new ResizeObserver(resize).observe(el);

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!REDUCE) updaters.forEach(u => u(dt, t));
    renderer.render(scene, camera);
    if (!REDUCE) requestAnimationFrame(frame);
  }
  frame();
  if (REDUCE) { updaters.forEach(u => u(0.4, 0.4)); renderer.render(scene, camera); }
}

/* ---------- GLOBE: point-cloud Earth + orbits + satellites + data arcs ---------- */
function buildGlobe(root, updaters, variant) {
  const R = 1.9;
  const globe = new THREE.Group(); globe.rotation.z = 0.41; root.add(globe);

  // base sphere shell (faint, gives the globe its form)
  (function shell() {
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = sphere(R); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: BLUE, size: 0.022, transparent: true, opacity: 0.32, depthWrite: false })));
  })();

  // land points sampled from the Earth day map (continents read as bright clusters)
  const landGeo = new THREE.BufferGeometry();
  const landMat = new THREE.PointsMaterial({ color: ICE, size: 0.04, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const landPts = new THREE.Points(landGeo, landMat); globe.add(landPts);
  const landAnchors = [];
  sampleLand('assets/images/scenes/journey/earth-day.jpg', R, (positions, anchors) => {
    landGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    landAnchors.push(...anchors);
    buildArcs();
  });

  // wire halo ring
  (function halo() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.18, R * 1.185, 96),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI / 2.1; root.add(ring);
  })();

  // orbital rings + traveling satellites
  const sats = [];
  const orbitDefs = variant === 'orbits'
    ? [[R*1.45, 0.5, 0.0, GOLD], [R*1.75, -0.8, 1.1, BLUE], [R*2.05, 0.3, 2.0, GOLD], [R*2.35, 1.1, 0.6, ICE]]
    : [[R*1.5, 0.6, 0.0, GOLD], [R*1.9, -0.7, 1.4, BLUE], [R*2.25, 0.25, 2.6, GOLD]];
  orbitDefs.forEach(([rad, tilt, phase, col]) => {
    const grp = new THREE.Group(); grp.rotation.x = Math.PI / 2 + tilt; grp.rotation.y = phase; root.add(grp);
    const seg = 128, op = new Float32Array((seg + 1) * 3);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; op[i*3]=Math.cos(a)*rad; op[i*3+1]=0; op[i*3+2]=Math.sin(a)*rad; }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    grp.add(new THREE.Line(og, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.28 })));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: col }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.8, depthWrite: false }));
    glow.scale.set(0.34, 0.34, 1); sat.add(glow); grp.add(sat);
    sats.push({ sat, rad, a: Math.random() * 6.28, spd: 0.18 + Math.random() * 0.16 });
  });

  // data arcs between land anchors (great-circle-ish, drawn after land loads)
  const arcGroup = new THREE.Group(); globe.add(arcGroup);
  let arcs = [];
  function buildArcs() {
    for (let i = 0; i < 7; i++) addArc();
  }
  function addArc() {
    if (landAnchors.length < 2) return;
    const a = landAnchors[(Math.random() * landAnchors.length) | 0];
    const b = landAnchors[(Math.random() * landAnchors.length) | 0];
    if (a === b) return;
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.25 + Math.random() * 0.25));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(40);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? GOLD : ICE, transparent: true, opacity: 0 });
    const line = new THREE.Line(g, m); arcGroup.add(line);
    arcs.push({ line, m, life: Math.random() * 4, dur: 3 + Math.random() * 3 });
  }

  updaters.push((dt, t) => {
    globe.rotation.y += dt * 0.06;
    sats.forEach(s => { s.a += dt * s.spd; s.sat.position.set(Math.cos(s.a) * s.rad, 0, Math.sin(s.a) * s.rad); });
    arcs.forEach(o => {
      o.life += dt;
      const p = (o.life % o.dur) / o.dur;          // 0..1 fade in/out
      o.m.opacity = Math.sin(p * Math.PI) * 0.7;
    });
  });
}

/* ---------- SUN: glowing core + corona particles + flares ---------- */
function buildSun(root, updaters) {
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  root.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffaa44, transparent: true, opacity: 0.9, depthWrite: false }));
  glow.scale.set(7.5, 7.5, 1); root.add(glow);
  // corona points
  const N = 2600, pos = new Float32Array(N * 3), spd = new Float32Array(N), base = new Float32Array(N);
  for (let i = 0; i < N; i++) { const v = sphere(1.5 + Math.random() * 1.7); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; base[i]=v.length(); spd[i]=0.1+Math.random()*0.4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: WARM, size: 0.05, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(pts);
  updaters.push((dt, t) => {
    root.rotation.y += dt * 0.05; pts.rotation.y -= dt * 0.03;
    const s = 1 + Math.sin(t * 1.4) * 0.02; core.scale.setScalar(s);
    glow.material.opacity = 0.8 + Math.sin(t * 1.4) * 0.12;
  });
}

/* ---------- GALAXY: spiral particle field ---------- */
function buildGalaxy(root, updaters) {
  const N = 6000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const c1 = new THREE.Color(GOLD), c2 = new THREE.Color(BLUE), c3 = new THREE.Color(ICE);
  const arms = 3;
  for (let i = 0; i < N; i++) {
    const r = Math.pow(Math.random(), 0.6) * 3.4;
    const arm = (i % arms) / arms * Math.PI * 2;
    const ang = arm + r * 0.9 + (Math.random() - 0.5) * 0.5;
    const sx = (Math.random() - 0.5) * 0.35 * (1 + r * 0.2);
    pos[i*3] = Math.cos(ang) * r + sx;
    pos[i*3+1] = (Math.random() - 0.5) * 0.35 * (1 - r / 4);
    pos[i*3+2] = Math.sin(ang) * r + sx;
    const c = r < 0.7 ? c1 : (Math.random() > 0.6 ? c2 : c3);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const gx = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending }));
  gx.rotation.x = 0.62; root.add(gx);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: WARM, transparent: true, opacity: 0.9, depthWrite: false }));
  core.scale.set(2.4, 2.4, 1); root.add(core);
  updaters.push((dt) => { gx.rotation.y += dt * 0.08; });
}

/* ---------- helpers ---------- */
function sphere(r) {
  const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
  return new THREE.Vector3(r*Math.sin(ph)*Math.cos(th), r*Math.cos(ph), r*Math.sin(ph)*Math.sin(th));
}
function glowTex() {
  if (glowTex._c) return glowTex._c;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex._c = new THREE.CanvasTexture(c); return glowTex._c;
}
// sample the Earth day map → land points on a sphere of radius R
function sampleLand(url, R, cb) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const W = 480, H = 240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, W, H);
    let data; try { data = cx.getImageData(0, 0, W, H).data; } catch (e) { cb(new Float32Array(0), []); return; }
    const out = [], anchors = [], TARGET = 4200; let tries = 0;
    while (out.length / 3 < TARGET && tries < TARGET * 8) {
      tries++;
      const v = sphere(R);
      // lon/lat from the sphere point → uv into the equirect map
      const lon = Math.atan2(v.z, v.x), lat = Math.asin(v.y / R);
      const u = (lon / (2 * Math.PI) + 0.5), t = (0.5 - lat / Math.PI);
      const px = Math.min(W - 1, Math.max(0, (u * W) | 0)), py = Math.min(H - 1, Math.max(0, (t * H) | 0));
      const idx = (py * W + px) * 4, r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r + g + b) / 765;
      const isLand = (b < (r + g) / 2 * 1.08) && bright > 0.09 && bright < 0.74;
      if (isLand) { out.push(v.x, v.y, v.z); if (anchors.length < 80 && Math.random() < 0.05) anchors.push(v.clone()); }
    }
    cb(new Float32Array(out), anchors);
  };
  img.onerror = () => cb(new Float32Array(0), []);
  img.src = url;
}

/* ---------- auto-init ---------- */
function boot() {
  document.querySelectorAll('.centerpiece').forEach(el => { try { init(el); } catch (e) { console.warn('centerpiece failed', e); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
