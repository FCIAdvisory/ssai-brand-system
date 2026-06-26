/* ============================================================================
   SSAI — practice experience: the ENTIRE practice page is one scroll-
   choreographed piece over a single persistent WebGL backdrop that EVOLVES with
   overall scroll. Content sections choreograph over it (reveals via site.js).
   Scenes (data-scene): globe (Science), network (Technology),
   assembly (Engineering), pulse (Health). Reduced-motion = one still frame.
   ============================================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const GOLD = 0xf2c14e, BLUE = 0x4a86dd, ICE = 0xcfe0ff, WARM = 0xffcf8a;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const ramp = (p, a, b) => clamp01((p - a) / (b - a));
function sphere(r) { const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1); return new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); }
function glowTex() { if (glowTex._c) return glowTex._c; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex._c = new THREE.CanvasTexture(c); return glowTex._c; }
function starfield(scene) { const N = 1200, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const v = sphere(27 + Math.random() * 26); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: ICE, size: 0.05, transparent: true, opacity: 0.45, depthWrite: false }))); }
function sampleLand(url, R, cb) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const W = 480, H = 240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, W, H);
    let data; try { data = cx.getImageData(0, 0, W, H).data; } catch (e) { cb(new Float32Array(0), []); return; }
    const out = [], anchors = [], TARGET = 5400; let tries = 0;
    while (out.length / 3 < TARGET && tries < TARGET * 8) {
      tries++; const v = sphere(R);
      const lon = Math.atan2(v.z, v.x), lat = Math.asin(v.y / R);
      const u = (lon / (2 * Math.PI) + 0.5), t = (0.5 - lat / Math.PI);
      const px = Math.min(W - 1, Math.max(0, (u * W) | 0)), py = Math.min(H - 1, Math.max(0, (t * H) | 0));
      const idx = (py * W + px) * 4, r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const bright = (r + g + b) / 765, isLand = (b < (r + g) / 2 * 1.08) && bright > 0.09 && bright < 0.74;
      if (isLand) { out.push(v.x, v.y, v.z); if (anchors.length < 150 && Math.random() < 0.04) anchors.push(v.clone()); }
    }
    cb(new Float32Array(out), anchors);
  };
  img.onerror = () => cb(new Float32Array(0), []); img.src = url;
}
function offset(host) { return (host.clientWidth || innerWidth) > 820 ? 1 : 0; }

/* ---------------- SCIENCE: a particle Earth whose data network builds ---------------- */
const GKF = [{ p: 0, pos: [0.2, 0.5, 9.6], rv: 0.18 }, { p: 0.22, pos: [1.4, 0.2, 8.0], rv: 1 }, { p: 0.55, pos: [2.0, 0.7, 7.4], rv: 1 }, { p: 0.8, pos: [1.2, 1.0, 8.2], rv: 1 }, { p: 1, pos: [0.4, 0.4, 9.2], rv: 1 }];
function kf(K, p) { let i = 0; while (i < K.length - 2 && p > K[i + 1].p) i++; const A = K[i], B = K[i + 1], t = easeIO(clamp01((p - A.p) / (B.p - A.p))); return { x: lerp(A.pos[0], B.pos[0], t), y: lerp(A.pos[1], B.pos[1], t), z: lerp(A.pos[2], B.pos[2], t), rv: lerp(A.rv, B.rv, t) }; }
function buildGlobe(ctx) {
  const { root, camera, host } = ctx; root.rotation.z = 0.36;
  const R = 2.25, globe = new THREE.Group(); root.add(globe);
  const L = new THREE.TextureLoader(), B = 'assets/textures/earth/';
  const day = L.load(B + 'earth_day.jpg'), night = L.load(B + 'earth_night.png'), spec = L.load(B + 'earth_specular.jpg'), cloud = L.load(B + 'earth_clouds.png');
  [day, night, spec, cloud].forEach(t => { try { t.colorSpace = THREE.SRGBColorSpace; } catch (e) {} });
  const sunDir = new THREE.Vector3(1.0, 0.35, 0.55).normalize();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: day }, nightMap: { value: night }, specMap: { value: spec }, sunDir: { value: sunDir } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D dayMap,nightMap,specMap; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; void main(){ float s=dot(normalize(vN),sunDir); float t=smoothstep(-0.12,0.30,s); vec3 d=texture2D(dayMap,vUv).rgb; vec3 n=texture2D(nightMap,vUv).rgb*1.5; vec3 col=mix(n, d*(0.3+0.9*t), t); float oc=texture2D(specMap,vUv).r; col += vec3(0.55,0.7,1.0)*pow(max(s,0.0),16.0)*oc*0.6; gl_FragColor=vec4(col,1.0); }'
  })); globe.add(earth);
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloud, alphaMap: cloud, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.015, 64, 48), cloudMat); globe.add(clouds);
  const atmoMat = new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { op: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vWP; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }',
    fragmentShader: 'uniform float op; varying vec3 vN; varying vec3 vWP; void main(){ vec3 vd=normalize(cameraPosition-vWP); float f=pow(1.0-max(dot(vd,vN),0.0),3.2); gl_FragColor=vec4(0.32,0.56,1.0, f*op); }' });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 48), atmoMat));
  const anchors = []; for (let i = 0; i < 48; i++) anchors.push(sphere(R * 1.004));
  const sats = [];
  [[R*1.35,0.5,0,GOLD],[R*1.7,-0.7,1.2,BLUE],[R*2.05,0.3,2.4,GOLD],[R*2.45,1.0,0.7,ICE]].forEach(([rad,tilt,ph,col]) => {
    const grp = new THREE.Group(); grp.rotation.x = Math.PI/2 + tilt; grp.rotation.y = ph; root.add(grp);
    const seg = 160, op = new Float32Array((seg+1)*3); for (let i = 0; i <= seg; i++) { const a = i/seg*Math.PI*2; op[i*3]=Math.cos(a)*rad; op[i*3+2]=Math.sin(a)*rad; }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0 }); grp.add(new THREE.Line(og, lineMat));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0, depthWrite: false })); glow.scale.set(0.42, 0.42, 1); sat.add(glow); grp.add(sat);
    sats.push({ sat, glow, lineMat, satMat: sat.material, rad, a: Math.random()*6.28, spd: 0.16 + Math.random()*0.16 });
  });
  const arcGroup = new THREE.Group(); globe.add(arcGroup); const arcs = [];
  function addArc() { const a = anchors[(Math.random()*anchors.length)|0], b = anchors[(Math.random()*anchors.length)|0]; if (a === b) return; const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.22 + Math.random()*0.3)); const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(46); const m = new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? GOLD : ICE, transparent: true, opacity: 0 }); arcGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); arcs.push({ m, life: Math.random()*4, dur: 3 + Math.random()*3 }); }
  for (let i = 0; i < 16; i++) addArc();
  let spin = 0;
  return function (p, dt, mx, my) {
    const c = kf(GKF, p); root.position.x = 2.4 * offset(host);
    camera.position.set(c.x + mx * 0.5, c.y - my * 0.4, c.z); camera.lookAt(root.position.x * 0.62, 0, 0);
    atmoMat.uniforms.op.value = 0.9; cloudMat.opacity = 0.45 * ramp(p, 0.02, 0.3);
    const netw = ramp(p, 0.3, 0.72); sats.forEach(s => { s.lineMat.opacity = 0.24 * netw; s.satMat.opacity = netw; s.glow.material.opacity = 0.85 * netw; s.a += dt * s.spd; s.sat.position.set(Math.cos(s.a)*s.rad, 0, Math.sin(s.a)*s.rad); });
    const arcI = ramp(p, 0.2, 0.7); spin += dt * (0.025 + 0.04 * p); globe.rotation.y = spin; clouds.rotation.y = spin * 1.18;
    arcs.forEach(o => { o.life += dt; o.m.opacity = Math.sin((o.life % o.dur) / o.dur * Math.PI) * 0.7 * arcI; });
  };
}

/* ---------------- TECHNOLOGY: a data/neural network that grows + lights up ---------------- */
function buildNetwork(ctx) {
  const { root, camera, host } = ctx;
  const N = 260, nodes = [], npos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = sphere(2.3 + Math.random() * 1.0); npos[i*3]=v.x; npos[i*3+1]=v.y; npos[i*3+2]=v.z; nodes.push(v); }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(npos, 3));
  const nodeMat = new THREE.PointsMaterial({ color: ICE, size: 0.07, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(new THREE.Points(ng, nodeMat));
  const segs = [], pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { if (nodes[i].distanceTo(nodes[j]) < 1.0 && Math.random() < 0.55) { segs.push(nodes[i].x,nodes[i].y,nodes[i].z, nodes[j].x,nodes[j].y,nodes[j].z); pairs.push([nodes[i], nodes[j]]); if (pairs.length > 520) { i = N; break; } } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
  const linkMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0 }); root.add(new THREE.LineSegments(lg, linkMat));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x2f6fd0, transparent: true, opacity: 0.4, depthWrite: false })); core.scale.set(7, 7, 1); root.add(core);
  const pulses = []; for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: i % 3 ? ICE : GOLD, transparent: true, opacity: 0, depthWrite: false })); s.scale.set(0.26, 0.26, 1); root.add(s); pulses.push({ s, lk: pairs[(Math.random()*pairs.length)|0], t: Math.random(), spd: 0.4 + Math.random() * 0.6 }); }
  let spin = 0;
  return function (p, dt, mx, my) {
    root.position.x = 1.7 * offset(host); spin += dt * (0.05 + 0.05 * p); root.rotation.y = spin; root.rotation.x = 0.2 + Math.sin(spin * 0.3) * 0.08;
    camera.position.set(lerp(8.4, 6.6, p) + mx * 0.6, 0.3 - my * 0.45, 0.001); camera.lookAt(root.position.x * 0.6, 0, 0);
    const rev = ramp(p, 0.04, 0.6); nodeMat.opacity = 0.2 + 0.75 * rev;
    linkMat.opacity = 0.5 * ramp(p, 0.12, 0.78);
    pulses.forEach(pl => { pl.t += dt * pl.spd; if (pl.t > 1) { pl.t = 0; pl.lk = pairs[(Math.random()*pairs.length)|0]; } if (pl.lk) { pl.s.position.lerpVectors(pl.lk[0], pl.lk[1], pl.t); pl.s.material.opacity = Math.sin(pl.t * Math.PI) * 0.95 * ramp(p, 0.18, 0.55); } });
  };
}

/* ---------------- ENGINEERING: a wireframe spacecraft that assembles part by part -------- */
function buildAssembly(ctx) {
  const { scene, root, camera, host, renderer } = ctx;
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch (e) {}
  const sun = new THREE.DirectionalLight(0xfff4e6, 4.2); sun.position.set(5, 3, 5); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 1.6); fill.position.set(-4, -1, 3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0x4a566c, 1.2));
  scene.add(new THREE.HemisphereLight(0x9ab8ff, 0x0a0f18, 0.9));
  const holder = new THREE.Group(); root.add(holder); let ready = false;
  const draco = new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  loader.load('assets/models/hubble.glb', (g) => {
    const m = g.scene; const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    m.position.sub(c); m.scale.setScalar(3.8 / Math.max(sz.x, sz.y, sz.z));
    m.traverse(o => { const mm = o.material; if (mm) { if ('envMapIntensity' in mm) mm.envMapIntensity = 2.0; if (mm.metalness > 0.9) mm.metalness = 0.6; if (mm.roughness !== undefined && mm.roughness < 0.25) mm.roughness = 0.35; mm.needsUpdate = true; } });
    holder.add(m); holder.scale.setScalar(1); ready = true;
  }, undefined, (e) => console.warn('[hubble] load failed', e));
  let spin = 0;
  return function (p, dt, mx, my) {
    root.position.x = 0; spin += dt * 0.16;
    holder.position.set(0, -0.45, -1.7 * offset(host));
    holder.rotation.y = spin + p * 2.4; holder.rotation.x = 0.16 + Math.sin(spin * 0.25) * 0.1;
    camera.position.set(lerp(8.8, 7.4, p) + mx * 0.6, lerp(0.7, 0.15, easeIO(p)) - my * 0.5, 0.001); camera.lookAt(0, -0.35, 0);
  };
}

/* ---------------- HEALTH: a steady pulse in the void, orbits building around it ---------- */
function beat(t) { const x = (t % 1.15) / 1.15; const a = Math.exp(-Math.pow((x - 0.0) / 0.06, 2)), b = Math.exp(-Math.pow((x - 0.16) / 0.07, 2)) * 0.7; return a + b; }
function buildPulse(ctx) {
  const { root, camera, host } = ctx;
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: WARM, transparent: true, opacity: 0.9, depthWrite: false })); coreGlow.scale.set(2.4, 2.4, 1); root.add(coreGlow);
  const coreShell = (function () { const N = 900, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const v = sphere(0.62); pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ color: WARM, size: 0.03, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); root.add(m); return m; })();
  // orbiting particle rings
  const orbits = []; [[1.5, 0.4, ICE], [2.1, -0.7, BLUE], [2.8, 0.3, ICE], [3.5, 1.0, GOLD]].forEach(([rad, tilt, col]) => {
    const M = 60, pos = new Float32Array(M * 3); for (let i = 0; i < M; i++) { const a = Math.random()*Math.PI*2; pos[i*3]=Math.cos(a)*rad; pos[i*3+1]=(Math.random()-0.5)*0.1; pos[i*3+2]=Math.sin(a)*rad; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const grp = new THREE.Group(); grp.rotation.x = Math.PI/2 + tilt;
    const m = new THREE.PointsMaterial({ color: col, size: 0.05, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); grp.add(new THREE.Points(g, m)); root.add(grp);
    orbits.push({ grp, m, spd: 0.12 + Math.random() * 0.16, reveal: rad });
  });
  // expanding pulse rings on each beat
  const prings = []; for (let i = 0; i < 3; i++) { const g = new THREE.RingGeometry(0.95, 1.0, 64); const m = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }); const mesh = new THREE.Mesh(g, m); mesh.rotation.x = Math.PI / 2.3; root.add(mesh); prings.push({ mesh, m, ph: i / 3 }); }
  let t = 0, spin = 0;
  return function (p, dt, mx, my) {
    t += dt; spin += dt * 0.05; root.position.x = 1.5 * offset(host); root.rotation.y = spin;
    camera.position.set(lerp(8.5, 6.8, p) + mx * 0.5, 0.4 - my * 0.4, 0.001); camera.lookAt(root.position.x * 0.6, 0, 0);
    const bt = beat(t), s = 1 + bt * 0.16; coreGlow.scale.set(2.4 * s, 2.4 * s, 1); coreGlow.material.opacity = 0.7 + bt * 0.3; coreShell.scale.setScalar(s); coreShell.material.opacity = 0.7 + bt * 0.3;
    orbits.forEach((o, i) => { o.grp.rotation.z += dt * o.spd; o.m.opacity = 0.85 * ramp(p, 0.08 + i * 0.12, 0.4 + i * 0.13); });
    prings.forEach(pr => { const ph = (t * 0.5 + pr.ph) % 1; pr.mesh.scale.setScalar(0.8 + ph * 3.2); pr.m.opacity = (1 - ph) * 0.4 * (bt > 0.3 ? 1 : 0.5) * ramp(p, 0.1, 0.5); });
  };
}

const SCENES = { globe: buildGlobe, network: buildNetwork, assembly: buildAssembly, pulse: buildPulse };

function init(host) {
  const name = host.dataset.scene || 'globe';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x080d18, 1);
  host.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const root = new THREE.Group(); scene.add(root); starfield(scene);
  const setProgress = (SCENES[name] || buildGlobe)({ scene, root, camera, host, renderer });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 0.72);
  composer.addPass(bloom);
  function resize() { const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); window.addEventListener('resize', resize);
  let mx = 0, my = 0; if (!REDUCE) window.addEventListener('mousemove', (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; my = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  let targetP = 0, curP = 0; const clock = new THREE.Clock();
  function loop() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    targetP = clamp01((window.scrollY || window.pageYOffset || 0) / max); curP += (targetP - curP) * 0.08; if (Math.abs(targetP - curP) < 0.0004) curP = targetP;
    setProgress(curP, Math.min(clock.getDelta(), 0.05), mx, my); composer.render(); requestAnimationFrame(loop);
  }
  if (REDUCE) { setProgress(0.45, 0.4, 0, 0); composer.render(); } else requestAnimationFrame(loop);
}
function boot() { document.querySelectorAll('.px-canvas').forEach(el => { try { init(el); } catch (e) { console.warn('practice-experience failed', e); } }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
