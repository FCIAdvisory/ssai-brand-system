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
  const { root, camera, host } = ctx; root.rotation.z = 0.16;
  const R = 2.25, globe = new THREE.Group(); root.add(globe);
  const L = new THREE.TextureLoader(), B = 'assets/textures/earth/layers/';
  const mk = f => { const t = L.load(B + f); try { t.colorSpace = THREE.SRGBColorSpace; } catch (e) {} return t; };
  const base = mk('true_color.jpg');
  const dataTex = [null, mk('ndvi.png'), mk('aerosol.png'), mk('sst.png'), mk('chlorophyll.png'), mk('night.png')];
  const labels = ['True Color', 'Vegetation · NDVI', 'Aerosol · Optical Depth', 'Sea Surface Temp', 'Ocean Chlorophyll', 'Earth at Night'];
  const sunDir = new THREE.Vector3(0.9, 0.32, 0.5).normalize();
  const uni = { baseTex: { value: base }, layA: { value: dataTex[1] }, layB: { value: dataTex[1] }, mixAB: { value: 0 }, ovA: { value: 0 }, ovB: { value: 0 }, sunDir: { value: sunDir }, ambient: { value: 0.58 } };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D baseTex,layA,layB; uniform float mixAB,ovA,ovB,ambient; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; void main(){ vec3 b=texture2D(baseTex,vUv).rgb; vec4 a=texture2D(layA,vUv); vec4 c=texture2D(layB,vUv); vec3 va=mix(b,a.rgb,a.a*ovA); vec3 vb=mix(b,c.rgb,c.a*ovB); vec3 surf=mix(va,vb,clamp(mixAB,0.0,1.0)); float lt=ambient+(1.0-ambient)*smoothstep(-0.4,0.6,dot(normalize(vN),sunDir)); gl_FragColor=vec4(surf*lt,1.0); }'
  })); globe.add(earth);
  const anchors = []; for (let i = 0; i < 48; i++) anchors.push(sphere(R * 1.004));
  const sats = [];
  [[R*1.35,0.5,0,GOLD],[R*1.7,-0.7,1.2,BLUE],[R*2.05,0.3,2.4,ICE],[R*2.45,1.0,0.7,GOLD]].forEach(([rad,tilt,ph,col]) => {
    const grp = new THREE.Group(); grp.rotation.x = Math.PI/2 + tilt; grp.rotation.y = ph; root.add(grp);
    const seg = 160, op = new Float32Array((seg+1)*3); for (let i = 0; i <= seg; i++) { const a = i/seg*Math.PI*2; op[i*3]=Math.cos(a)*rad; op[i*3+2]=Math.sin(a)*rad; }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(op, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0 }); grp.add(new THREE.Line(og, lineMat));
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0, depthWrite: false })); glow.scale.set(0.4, 0.4, 1); sat.add(glow); grp.add(sat);
    sats.push({ sat, glow, lineMat, satMat: sat.material, rad, a: Math.random()*6.28, spd: 0.16 + Math.random()*0.16 });
  });
  const arcGroup = new THREE.Group(); globe.add(arcGroup); const arcs = [];
  function addArc() { const a = anchors[(Math.random()*anchors.length)|0], b = anchors[(Math.random()*anchors.length)|0]; if (a === b) return; const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.22 + Math.random()*0.3)); const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(46); const m = new THREE.LineBasicMaterial({ color: Math.random() > 0.5 ? GOLD : ICE, transparent: true, opacity: 0 }); arcGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); arcs.push({ m, life: Math.random()*4, dur: 3 + Math.random()*3 }); }
  for (let i = 0; i < 16; i++) addArc();
  const cap = (typeof document !== 'undefined') ? document.getElementById('pxLayer') : null; const capV = cap ? cap.querySelector('.px-readout-v') : null; let lastLab = -1;
  let spin = 0;
  return function (p, dt, mx, my) {
    const c = kf(GKF, p); root.position.x = 2.4 * offset(host);
    camera.position.set(c.x + mx * 0.5, c.y - my * 0.4, c.z); camera.lookAt(root.position.x * 0.62, 0, 0);
    const N = labels.length, pos = clamp01(p) * (N - 1), si = Math.min(Math.floor(pos), N - 2), f = easeIO(clamp01(pos - si));
    uni.layA.value = dataTex[Math.max(si, 1)]; uni.ovA.value = si >= 1 ? 1 : 0; uni.layB.value = dataTex[si + 1]; uni.ovB.value = 1; uni.mixAB.value = f;
    const li = Math.round(pos); if (capV && li !== lastLab) { capV.textContent = labels[li]; lastLab = li; }
    const netw = ramp(p, 0.25, 0.7); sats.forEach(s2 => { s2.lineMat.opacity = 0.22 * netw; s2.satMat.opacity = netw; s2.glow.material.opacity = 0.8 * netw; s2.a += dt * s2.spd; s2.sat.position.set(Math.cos(s2.a)*s2.rad, 0, Math.sin(s2.a)*s2.rad); });
    const arcI = ramp(p, 0.2, 0.7); spin += dt * (0.03 + 0.04 * p); globe.rotation.y = spin;
    arcs.forEach(o => { o.life += dt; o.m.opacity = Math.sin((o.life % o.dur) / o.dur * Math.PI) * 0.65 * arcI; });
  };
}

/* ---------------- TECHNOLOGY: a data/neural network that grows + lights up ---------------- */
function buildNetwork(ctx) {
  const { root, camera, host } = ctx;
  const N = 380, nodes = [], npos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = sphere(2.1 + Math.random() * 1.25); npos[i*3]=v.x; npos[i*3+1]=v.y; npos[i*3+2]=v.z; nodes.push(v); }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(npos, 3));
  const nodeMat = new THREE.PointsMaterial({ color: ICE, size: 0.07, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(new THREE.Points(ng, nodeMat));
  const segs = [], pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { if (nodes[i].distanceTo(nodes[j]) < 1.0 && Math.random() < 0.55) { segs.push(nodes[i].x,nodes[i].y,nodes[i].z, nodes[j].x,nodes[j].y,nodes[j].z); pairs.push([nodes[i], nodes[j]]); if (pairs.length > 760) { i = N; break; } } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
  const linkMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0 }); root.add(new THREE.LineSegments(lg, linkMat));
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x2f6fd0, transparent: true, opacity: 0.4, depthWrite: false })); core.scale.set(7, 7, 1); root.add(core);
  const gridMat = new THREE.MeshBasicMaterial({ color: BLUE, wireframe: true, transparent: true, opacity: 0, depthWrite: false }); root.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.85, 2), gridMat));
  const pulses = []; for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: i % 3 ? ICE : GOLD, transparent: true, opacity: 0, depthWrite: false })); s.scale.set(0.26, 0.26, 1); root.add(s); pulses.push({ s, lk: pairs[(Math.random()*pairs.length)|0], t: Math.random(), spd: 0.4 + Math.random() * 0.6 }); }
  let spin = 0;
  return function (p, dt, mx, my) {
    root.position.x = 1.7 * offset(host); spin += dt * (0.05 + 0.05 * p); root.rotation.y = spin; root.rotation.x = 0.2 + Math.sin(spin * 0.3) * 0.08;
    camera.position.set(lerp(8.4, 6.6, p) + mx * 0.6, 0.3 - my * 0.45, 0.001); camera.lookAt(root.position.x * 0.6, 0, 0);
    const rev = ramp(p, 0.04, 0.6); nodeMat.opacity = 0.2 + 0.75 * rev;
    linkMat.opacity = 0.5 * ramp(p, 0.12, 0.78); gridMat.opacity = 0.13 * ramp(p, 0.06, 0.5);
    pulses.forEach(pl => { pl.t += dt * pl.spd; if (pl.t > 1) { pl.t = 0; pl.lk = pairs[(Math.random()*pairs.length)|0]; } if (pl.lk) { pl.s.position.lerpVectors(pl.lk[0], pl.lk[1], pl.t); pl.s.material.opacity = Math.sin(pl.t * Math.PI) * 0.95 * ramp(p, 0.18, 0.55); } });
  };
}

/* ---------------- ENGINEERING: the real NASA Hubble, scattered components reassembling on scroll -------- */
function buildAssembly(ctx) {
  const { scene, root, camera, host, renderer } = ctx;
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; } catch (e) {}
  const sun = new THREE.DirectionalLight(0xfff4e6, 4.2); sun.position.set(5, 3, 5); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 1.6); fill.position.set(-4, -1, 3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0x4a566c, 1.2));
  scene.add(new THREE.HemisphereLight(0x9ab8ff, 0x0a0f18, 0.9));
  // the deep-space object the telescope observes
  const H = new THREE.Vector3(0, -0.5, 0), T = new THREE.Vector3(0, 1.7, -2.6);
  const tGrp = new THREE.Group(); tGrp.position.copy(T); root.add(tGrp);
  const tGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd9b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); tGlow.scale.set(2.6, 2.6, 1); tGrp.add(tGlow);
  const tCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff0e8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); tCore.scale.set(0.9, 0.9, 1); tGrp.add(tCore);
  let tImg = null;
  new THREE.TextureLoader().load('assets/textures/space/target.jpg', tex => { try { tex.colorSpace = THREE.SRGBColorSpace; } catch (e) {} const pl = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 6.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); tGrp.add(pl); tImg = pl; }, undefined, () => {});
  // aim: local aperture axis -> direction to target
  const apDir = new THREE.Vector3(0, 1, 0).normalize();
  const aimed = new THREE.Quaternion().setFromUnitVectors(apDir, T.clone().sub(H).normalize());
  const holder = new THREE.Group(); holder.position.copy(H); root.add(holder); let ready = false; const parts = [];
  const draco = new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  loader.load('assets/models/hubble.glb', (g) => {
    const m = g.scene; const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    m.position.sub(c); m.scale.setScalar(3.8 / Math.max(sz.x, sz.y, sz.z));
    m.traverse(o => { const mm = o.material; if (mm) { if ('envMapIntensity' in mm) mm.envMapIntensity = 2.0; if (mm.metalness > 0.9) mm.metalness = 0.6; if (mm.roughness !== undefined && mm.roughness < 0.25) mm.roughness = 0.35; mm.needsUpdate = true; } });
    m.updateMatrixWorld(true);
    const pgrp = new THREE.Group(); m.add(pgrp); const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o); }); const maxDim = Math.max(sz.x, sz.y, sz.z);
    meshes.forEach((mesh, i) => { pgrp.attach(mesh); const home = mesh.position.clone(); let dir = home.clone(); if (dir.length() < maxDim * 0.04) { dir.copy(sphere(1)); } dir.normalize(); parts.push({ mesh, home, scatter: dir.multiplyScalar(maxDim * (0.4 + 0.4 * (i % 3))), t0: 0.16 + i * 0.08 }); });
    holder.add(m); holder.scale.setScalar(1); ready = true;
  }, undefined, (e) => console.warn('[hubble] load failed', e));
  const te = new THREE.Euler(), tumble = new THREE.Quaternion();
  let spin = 0;
  return function (p, dt, mx, my) {
    root.position.x = 0; spin += dt * 0.3;
    const off = offset(host), shiftX = off ? -2.2 : 0;
    holder.position.x = shiftX; tGrp.position.x = shiftX;
    camera.position.set(mx * 0.5, lerp(0.3, 0.1, easeIO(p)) - my * 0.4, lerp(9.5, 12.8, p));
    camera.lookAt(off ? 0.9 : 0, 0.5, -0.6);
    for (let i = 0; i < parts.length; i++) { const pt = parts[i], f = REDUCE ? 0 : 1 - easeOut(ramp(p, pt.t0, pt.t0 + 0.4)); pt.mesh.position.copy(pt.home).addScaledVector(pt.scatter, f); }
    const lock = REDUCE ? 1 : easeIO(ramp(p, 0.4, 0.95));
    te.set(0.3 + Math.sin(spin * 0.4) * 0.25, spin, 0.15); tumble.setFromEuler(te);
    holder.quaternion.slerpQuaternions(tumble, aimed, lock);
    const pulse = 0.82 + Math.sin(spin * 1.6) * 0.18;
    tGlow.material.opacity = (0.1 + 0.45 * lock) * pulse;
    tCore.material.opacity = (0.08 + 0.5 * lock) * pulse;
    if (tImg) { tImg.material.opacity = 0.9 * lock; tImg.quaternion.copy(camera.quaternion); }
    tGrp.scale.setScalar(lerp(0.7, 1.0, lock));
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
  const prings = []; for (let i = 0; i < 5; i++) { const g = new THREE.RingGeometry(0.95, 1.0, 64); const m = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }); const mesh = new THREE.Mesh(g, m); mesh.rotation.x = Math.PI / 2.3; root.add(mesh); prings.push({ mesh, m, ph: i / 5 }); }
  // EKG vital-trace ring: a heartbeat waveform baked around a ring, slowly rotating, brightening on each beat
  const EK = 320, ekgPos = new Float32Array(EK * 3), ekgR = 2.05;
  for (let i = 0; i < EK; i++) { const x = i / EK, a = x * Math.PI * 2; const spike = Math.exp(-Math.pow((x-0.5)/0.010,2))*0.6 - Math.exp(-Math.pow((x-0.474)/0.008,2))*0.2 - Math.exp(-Math.pow((x-0.527)/0.009,2))*0.24 + Math.exp(-Math.pow((x-0.35)/0.02,2))*0.08 + Math.exp(-Math.pow((x-0.63)/0.03,2))*0.06; const r = ekgR + spike; ekgPos[i*3]=Math.cos(a)*r; ekgPos[i*3+1]=Math.sin(a)*r; ekgPos[i*3+2]=0; }
  const ekgGeo = new THREE.BufferGeometry(); ekgGeo.setAttribute('position', new THREE.BufferAttribute(ekgPos, 3));
  const ekgMat = new THREE.LineBasicMaterial({ color: 0x8fe6d4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const ekgGrp = new THREE.Group(); ekgGrp.rotation.x = Math.PI / 2.2; ekgGrp.add(new THREE.LineLoop(ekgGeo, ekgMat)); root.add(ekgGrp);
  let t = 0, spin = 0;
  return function (p, dt, mx, my) {
    t += dt; spin += dt * 0.05; root.position.x = 1.5 * offset(host); root.rotation.y = spin;
    camera.position.set(lerp(8.5, 6.8, p) + mx * 0.5, 0.4 - my * 0.4, 0.001); camera.lookAt(root.position.x * 0.6, 0, 0);
    const bt = beat(t), s = 1 + bt * 0.16; coreGlow.scale.set(2.4 * s, 2.4 * s, 1); coreGlow.material.opacity = 0.7 + bt * 0.3; coreShell.scale.setScalar(s); coreShell.material.opacity = 0.7 + bt * 0.3;
    ekgGrp.rotation.z += dt * 0.3; ekgMat.opacity = (0.3 + bt * 0.45) * ramp(p, 0.1, 0.5);
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
