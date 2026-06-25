/* ============================================================================
   SSAI — practice journey: a SCROLL-DRIVEN WebGL narrative for a practice page.
   The scene transforms the further you scroll (camera dolly + orbit, the world
   forms, data arcs and satellites populate), while text beats fade through.
   Markup:
     <section class="practice-journey" data-journey="science">
       <div class="pj-stage">
         <div class="pj-canvas"></div>
         <div class="pj-beat" data-a="0" data-b="0.14">…</div> …
         <div class="pj-cue">Scroll</div>
       </div>
     </section>
   Reduced-motion: collapses to one screen with a still frame + first beat.
   ============================================================================ */
import * as THREE from 'three';

const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const GOLD = 0xf2c14e, BLUE = 0x4a86dd, ICE = 0xcfe0ff;

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function ramp(p, a, b) { return clamp01((p - a) / (b - a)); }
function fadeOp(p, a, b, e) { e = e || 0.04; if (p < a - e || p > b + e) return 0; if (p < a) return (p - (a - e)) / e; if (p > b) return 1 - (p - b) / e; return 1; }
function sphere(r) { const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1); return new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); }
function glowTex() { if (glowTex._c) return glowTex._c; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex._c = new THREE.CanvasTexture(c); return glowTex._c; }
function sampleLand(url, R, cb) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const W = 480, H = 240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, W, H);
    let data; try { data = cx.getImageData(0, 0, W, H).data; } catch (e) { cb(new Float32Array(0), []); return; }
    const out = [], anchors = [], TARGET = 5200; let tries = 0;
    while (out.length / 3 < TARGET && tries < TARGET * 8) {
      tries++; const v = sphere(R);
      const lon = Math.atan2(v.z, v.x), lat = Math.asin(v.y / R);
      const u = (lon / (2 * Math.PI) + 0.5), t = (0.5 - lat / Math.PI);
      const px = Math.min(W - 1, Math.max(0, (u * W) | 0)), py = Math.min(H - 1, Math.max(0, (t * H) | 0));
      const idx = (py * W + px) * 4, r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r + g + b) / 765, isLand = (b < (r + g) / 2 * 1.08) && bright > 0.09 && bright < 0.74;
      if (isLand) { out.push(v.x, v.y, v.z); if (anchors.length < 140 && Math.random() < 0.04) anchors.push(v.clone()); }
    }
    cb(new Float32Array(out), anchors);
  };
  img.onerror = () => cb(new Float32Array(0), []); img.src = url;
}

// camera keyframes (Science): far approach -> Earth fills -> orbit -> see the network -> pull back
const KF = [
  { p: 0.00, pos: [0, 0.3, 16.5], reveal: 0.12 },
  { p: 0.26, pos: [0, 0.2, 6.6], reveal: 1.0 },
  { p: 0.52, pos: [4.2, 1.1, 5.4], reveal: 1.0 },
  { p: 0.76, pos: [-1.2, 3.0, 9.2], reveal: 1.0 },
  { p: 1.00, pos: [0, 0.4, 13.5], reveal: 1.0 },
];
function camAt(p) {
  let i = 0; while (i < KF.length - 2 && p > KF[i + 1].p) i++;
  const A = KF[i], B = KF[i + 1], t = easeIO(clamp01((p - A.p) / (B.p - A.p)));
  return { x: lerp(A.pos[0], B.pos[0], t), y: lerp(A.pos[1], B.pos[1], t), z: lerp(A.pos[2], B.pos[2], t), reveal: lerp(A.reveal, B.reveal, t) };
}

function init(section) {
  const host = section.querySelector('.pj-canvas');
  const beats = [].slice.call(section.querySelectorAll('.pj-beat'));
  const cue = section.querySelector('.pj-cue');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const root = new THREE.Group(); scene.add(root); root.rotation.z = 0.36;

  (function stars() {
    const N = 1100, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = sphere(26 + Math.random() * 24); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ICE, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false })));
  })();

  const R = 2.25, globe = new THREE.Group(); root.add(globe);
  const shellMat = new THREE.PointsMaterial({ color: BLUE, size: 0.02, transparent: true, opacity: 0.3, depthWrite: false });
  (function shell() { const N = 2200, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const v = sphere(R); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); globe.add(new THREE.Points(g, shellMat)); })();

  const landGeo = new THREE.BufferGeometry();
  const landMat = new THREE.PointsMaterial({ color: ICE, size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  globe.add(new THREE.Points(landGeo, landMat));
  const landAnchors = [];
  sampleLand('assets/images/scenes/journey/earth-day.jpg', R, (pos, anchors) => { landGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); landAnchors.push(...anchors); for (let i = 0; i < 16; i++) addArc(); });

  const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3c7be0, transparent: true, opacity: 0.5, depthWrite: false }));
  atmo.scale.set(R * 4.4, R * 4.4, 1); atmo.position.z = -0.6; globe.add(atmo);

  const sats = [];
  [[R*1.45,0.5,0,GOLD],[R*1.8,-0.7,1.2,BLUE],[R*2.2,0.3,2.4,GOLD],[R*2.6,1.0,0.7,ICE]].forEach(([rad,tilt,phase,col]) => {
    const grp = new THREE.Group(); grp.rotation.x = Math.PI/2 + tilt; grp.rotation.y = phase; root.add(grp);
    const seg = 160, op = new Float32Array((seg+1)*3); for (let i = 0; i <= seg; i++) { const a = i/seg*Math.PI*2; op[i*3]=Math.cos(a)*rad; op[i*3+1]=0; op[i*3+2]=Math.sin(a)*rad; }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0 });
    grp.add(new THREE.Line(og, lineMat));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0, depthWrite: false }));
    glow.scale.set(0.4, 0.4, 1); sat.add(glow); grp.add(sat);
    sats.push({ sat, glow, lineMat, satMat: sat.material, rad, a: Math.random()*6.28, spd: 0.16 + Math.random()*0.16 });
  });

  const arcGroup = new THREE.Group(); globe.add(arcGroup); const arcs = [];
  function addArc() {
    if (landAnchors.length < 2) return;
    const a = landAnchors[(Math.random()*landAnchors.length)|0], b = landAnchors[(Math.random()*landAnchors.length)|0]; if (a === b) return;
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.3 + Math.random()*0.35));
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(46);
    const m = new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? GOLD : ICE, transparent: true, opacity: 0 });
    arcGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
    arcs.push({ m, life: Math.random()*4, dur: 3 + Math.random()*3 });
  }

  let spin = 0;
  function setProgress(p, dt) {
    const c = camAt(p);
    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(0, 0, 0);
    landMat.opacity = 0.96 * c.reveal; shellMat.opacity = 0.12 + 0.2 * c.reveal;
    atmo.material.opacity = 0.5 * c.reveal;
    const netw = ramp(p, 0.42, 0.72);                 // satellites + orbits populate
    sats.forEach(s => { s.lineMat.opacity = 0.24 * netw; s.satMat.opacity = netw; s.glow.material.opacity = 0.85 * netw; });
    const arcI = ramp(p, 0.3, 0.7);                    // data arcs intensify
    spin += dt * (0.04 + 0.05 * p);
    globe.rotation.y = spin;
    globe.scale.setScalar(1 + Math.sin(spin * 1.2) * 0.01);
    arcs.forEach(o => { o.life += dt; o.m.opacity = Math.sin((o.life % o.dur) / o.dur * Math.PI) * 0.7 * arcI; });
  }

  function resize() { const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); new ResizeObserver(resize).observe(host);

  // ---- scroll driver (damped, Lenis-friendly: reads window scroll) ----
  let targetP = 0, curP = 0; const clock = new THREE.Clock();
  function updateBeats(p) {
    for (let i = 0; i < beats.length; i++) {
      const a = +beats[i].dataset.a, b = +beats[i].dataset.b, o = fadeOp(p, a, b);
      beats[i].style.opacity = o;
      beats[i].style.transform = 'translateY(' + lerp(26, -18, ramp(p, a, b)).toFixed(1) + 'px)';
      beats[i].style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    }
    if (cue) cue.style.opacity = (1 - clamp01(p / 0.08));
  }
  function loop() {
    const max = Math.max(1, section.offsetHeight - innerHeight);
    targetP = clamp01((-section.getBoundingClientRect().top) / max);
    curP += (targetP - curP) * 0.1;
    if (Math.abs(targetP - curP) < 0.0004) curP = targetP;
    setProgress(curP, Math.min(clock.getDelta(), 0.05));
    updateBeats(curP);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  if (REDUCE) {
    section.classList.add('pj-static');                // CSS collapses the section to one screen
    setProgress(0.3, 0.3); updateBeats(0.02); renderer.render(scene, camera);
  } else {
    requestAnimationFrame(loop);
  }
}

function boot() { document.querySelectorAll('.practice-journey').forEach(s => { try { init(s); } catch (e) { console.warn('practice-journey failed', e); } }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
