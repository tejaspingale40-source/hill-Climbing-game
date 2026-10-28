import * as THREE from 'three';
import { sfx } from './audio.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, ...o });

// ---------- constants ----------
const H = 90, R = 60;                       // mountain height / base radius
const coneR = (y) => Math.max(R * (1 - y / H), 0);
const PW = 0.4, PH = 1.8, GRAV = 34, JUMP = 12.5, WALK = 6.5, RUN = 10.5, LIMIT = 78;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2a7de1'); gr.addColorStop(0.6, '#8fd3ff'); gr.addColorStop(1, '#ffe9c2');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(c);
}
scene.fog = new THREE.Fog(0xcfe9ff, 90, 420);
scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x5a7a3a, 0.95));
const sun = new THREE.DirectionalLight(0xfff1d0, 1.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
scene.add(sun, sun.target);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- world: ground, mountain, decor ----------
const solids = []; // axis-aligned boxes: {cx,cy,cz,hx,hy,hz,climb,mv,dx,dz}
function addSolid(mesh, cx, cy, cz, hx, hy, hz, extra = {}) {
  const s = { cx, cy, cz, hx, hy, hz, ...extra, mesh };
  solids.push(s); return s;
}
addSolid(null, 0, -5, 0, 500, 5, 500);
const ground = new THREE.Mesh(new THREE.CircleGeometry(450, 48), M(0x58b04a));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

{ // mountain cone with height-based vertex colors
  const cg = new THREE.ConeGeometry(R, H, 44, 12, true), pos = cg.attributes.position, cols = [];
  const A = new THREE.Color('#4f9d3a'), B = new THREE.Color('#8a7a5a'), C = new THREE.Color('#9aa0a6'), D = new THREE.Color('#ffffff'), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / H + 0.5;
    if (t < 0.3) col.copy(A).lerp(B, t / 0.3); else if (t < 0.75) col.copy(B).lerp(C, (t - 0.3) / 0.45); else col.copy(C).lerp(D, (t - 0.75) / 0.25);
    cols.push(col.r, col.g, col.b);
  }
  cg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
  m.position.y = H / 2; m.receiveShadow = true; scene.add(m);
  const rg = new THREE.DodecahedronGeometry(1), rm = M(0x8d9096);
  for (let i = 0; i < 80; i++) {
    const y = rnd(2, H * 0.9), a = rnd(0, 6.283), r = coneR(y) - 0.3, s = rnd(1, 2.2);
    const k = new THREE.Mesh(rg, rm); k.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    k.scale.set(s, s * rnd(0.6, 1), s); k.rotation.set(rnd(0, 3), rnd(0, 3), 0); k.castShadow = true; scene.add(k);
  }
}
{ // pine trees on the valley floor
  const tr = new THREE.CylinderGeometry(0.4, 0.5, 2, 6), le = new THREE.ConeGeometry(2.2, 4, 7), lm = M(0x2e8b3d), tm = M(0x6b4423);
  for (let i = 0; i < 110; i++) {
    const a = rnd(0, 6.283), r = rnd(82, 190), s = rnd(0.8, 1.8), g = new THREE.Group();
    const t = new THREE.Mesh(tr, tm); t.position.y = 1;
    const l1 = new THREE.Mesh(le, lm); l1.position.y = 4; const l2 = new THREE.Mesh(le, lm); l2.position.y = 6; l2.scale.setScalar(0.7);
    [t, l1, l2].forEach((o) => { o.castShadow = true; g.add(o); });
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.scale.setScalar(s); scene.add(g);
  }
}
const clouds = [];
for (let i = 0; i < 16; i++) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: false });
  for (let j = 0; j < 5; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rnd(5, 9), 8, 6), mat); b.position.set(j * 7 - 14, rnd(-2, 3), rnd(-4, 4)); b.scale.y = 0.6; g.add(b); }
  const a = rnd(0, 6.283), r = rnd(80, 260); g.position.set(Math.cos(a) * r, rnd(35, 120), Math.sin(a) * r); scene.add(g); clouds.push(g);
}

// ---------- level: spiral of rock columns, climb pillars, moving slabs ----------
const grassM = M(0x6bcf4f), rockM = M(0x9b8b75), climbM = M(0xd9792b), slabM = M(0x5aa7d6), goldM = M(0xffc400, { metalness: 0.6, roughness: 0.3, emissive: 0x553300 });
const movers = [], coins = [], cps = [], N = 38;
let y = 1.2, ang = 0, summit = null;
for (let i = 0; i < N; i++) {
  const climb = i > 0 && i % 8 === 0, slab = !climb && i % 7 === 4;
  if (i > 0) y += climb ? 5 : 1.7;
  const r = coneR(y) + 6; if (i > 0) ang += 8 / r;
  const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
  if (slab) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 5), slabM); m.castShadow = m.receiveShadow = true; scene.add(m);
    const s = addSolid(m, x, y - 0.4, z, 2.5, 0.4, 2.5, { mv: true, dx: 0, dz: 0 });
    const tx = -Math.sin(ang), tz = Math.cos(ang);
    movers.push({ s, bx: x, bz: z, tx, tz, ph: rnd(0, 6) });
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, y, 6), climb ? climbM : rockM); m.position.set(x, y / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    if (!climb) { const gt = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 6.2), grassM); gt.position.set(x, y - 0.1, z); gt.receiveShadow = true; scene.add(gt); }
    addSolid(m, x, y / 2, z, 3, y / 2, 3, { climb });
  }
  if (i > 0 && i < N - 1) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), goldM); c.rotation.x = Math.PI / 2;
    const g = new THREE.Group(); g.add(c); g.position.set(x, y + 1.3, z); scene.add(g); coins.push({ g, alive: true });
  }
  const isSummit = i === N - 1;
  if (i % 10 === 0 || isSummit) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), M(0xeeeeee)), cloth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), M(isSummit ? 0xffd23f : 0xe63946));
    cloth.position.set(0.65, 1.1, 0); const g = new THREE.Group(); g.add(pole, cloth); g.position.set(x + 1.5, y + 1.5, z + 1.5); pole.castShadow = true; scene.add(g);
    const cp = { x, y: y + 0.05, z, got: i === 0, cloth, g };
    if (isSummit) summit = cp; else cps.push(cp);
    if (i === 0) cloth.material.color.set(0x2ecc71);
  }
}
const SUMMIT_Y = summit.y;

// ---------- player model ----------
const hero = new THREE.Group(), limb = (w, h, d, mat, px, py) => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = -h / 2; m.castShadow = true; g.add(m); g.position.set(px, py, 0); hero.add(g); return g; };
const skin = M(0xffcf9f), blue = M(0x2f6fe4);
const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), blue); torso.position.y = 1.0; torso.castShadow = true; hero.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8), skin); head.position.y = 1.67; head.castShadow = true; hero.add(head);
const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.25, 8), M(0xe63946)); hat.position.y = 1.9; hero.add(hat);
const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), M(0xf08c00)); pack.position.set(0, 1.05, -0.33); pack.castShadow = true; hero.add(pack);
[-0.11, 0.11].forEach((ex) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), M(0x111111)); e.position.set(ex, 1.7, 0.27); hero.add(e); });
const legL = limb(0.28, 0.6, 0.28, M(0x34495e), -0.18, 0.6), legR = limb(0.28, 0.6, 0.28, M(0x34495e), 0.18, 0.6);
const armL = limb(0.2, 0.7, 0.22, skin, -0.46, 1.35), armR = limb(0.2, 0.7, 0.22, skin, 0.46, 1.35);
scene.add(hero);

// ---------- state ----------
const keys = new Set();
const p = new THREE.Vector3(); const mv = new THREE.Vector2();
let state = 'menu', score = 0, lives = 3, cp = cps[0], vy = 0, onGround = false, standing = null, coyote = 0, jumpBuf = 0;
let yaw = 0, manual = 0, invuln = 0, time = 0, face = 0, phase = 0, rockT = 2, climbing = false, touchClimb = false, toastT = 0;
const rocks = [], rockGeo = new THREE.DodecahedronGeometry(0.8), rockMat = M(0x6e6a66);

function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1600); }
function hud() {
  $('score').textContent = 'Score ' + score; $('lives').textContent = '♥'.repeat(Math.max(lives, 0));
  $('alt').textContent = Math.max(0, Math.round(p.y * 3)) + ' m'; $('prog').style.width = Math.min(100, Math.max(0, (p.y / SUMMIT_Y) * 100)) + '%';
}
function respawn() {
  p.set(cp.x, cp.y, cp.z); vy = 0; invuln = 2; yaw = Math.PI - Math.atan2(cp.z, cp.x); camera.position.set(p.x + Math.sin(yaw) * 9, p.y + 5, p.z + Math.cos(yaw) * 9);
}
function newGame() {
  score = 0; lives = 3; cps.forEach((c, i) => { c.got = i === 0; c.cloth.material.color.set(i === 0 ? 0x2ecc71 : 0xe63946); });
  cp = cps[0]; coins.forEach((c) => { c.alive = true; c.g.visible = true; });
  rocks.forEach((r) => scene.remove(r.m)); rocks.length = 0; rockT = 2; respawn(); hud();
}
function show(id) { ['menu', 'pause', 'over', 'win'].forEach((k) => $(k).classList.toggle('hidden', k !== id)); $('hud').classList.toggle('hidden', id === 'menu' || id === 'over' || id === 'win'); }
function start() { sfx.init(); sfx.startMusic(); newGame(); state = 'play'; show(null); }
function pause(on) { if (on && state === 'play') { state = 'pause'; show('pause'); $('hud').classList.remove('hidden'); } else if (!on && state === 'pause') { state = 'play'; show(null); } }
function toMenu() { state = 'menu'; sfx.stopMusic(); show('menu'); }
function hurt(msg) {
  if (invuln > 0 || state !== 'play') return;
  lives--; sfx.hurt(); hud();
  if (lives <= 0) { state = 'over'; sfx.stopMusic(); sfx.lose(); $('overTxt').textContent = `You scored ${score} and reached ${Math.round(p.y * 3)} m.`; show('over'); } else { toast(msg); respawn(); }
}
function win() { state = 'win'; score += lives * 100 + 500; sfx.stopMusic(); sfx.win(); $('winTxt').textContent = `Final score: ${score}  (lives bonus included)`; show('win'); }

// ---------- collision ----------
const hit = (s) => Math.abs(p.x - s.cx) < s.hx + PW && Math.abs(p.z - s.cz) < s.hz + PW && p.y < s.cy + s.hy - 0.001 && p.y + PH > s.cy - s.hy;
function collide(axis) {
  for (const s of solids) {
    if (!hit(s)) continue;
    if (axis === 'y') {
      if (vy <= 0) { p.y = s.cy + s.hy; onGround = true; standing = s; } else p.y = s.cy - s.hy - PH;
      vy = 0;
    } else {
      const c = axis === 'x' ? s.cx : s.cz, h = axis === 'x' ? s.hx : s.hz;
      p[axis] = p[axis] > c ? c + h + PW : c - h - PW;
      if (s.climb) touchClimb = true;
    }
  }
}

// ---------- simulation ----------
function step(dt) {
  time += dt;
  for (const m of movers) {
    const o = Math.sin(time * 0.9 + m.ph) * 2.5, nx = m.bx + m.tx * o, nz = m.bz + m.tz * o;
    m.s.dx = nx - m.s.cx; m.s.dz = nz - m.s.cz; m.s.cx = nx; m.s.cz = nz; m.s.mesh.position.set(nx, m.s.cy, nz);
  }
  if (standing && standing.mv) { p.x += standing.dx; p.z += standing.dz; }
  const f = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw)), r = new THREE.Vector2(-f.y, f.x);
  const ix = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const iz = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0);
  mv.set(f.x * iz + r.x * ix, f.y * iz + r.y * ix); const moving = mv.lengthSq() > 0; if (moving) mv.normalize();
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK) * (onGround ? 1 : 0.9);
  touchClimb = false;
  p.x += mv.x * sp * dt; collide('x'); p.z += mv.y * sp * dt; collide('z');
  // mountain slope is solid and the valley has an outer wall
  let d = Math.hypot(p.x, p.z), lim = coneR(p.y) + 1.5;
  if (d < lim && d > 0.001) { p.x *= lim / d; p.z *= lim / d; touchClimb = false; d = lim; }
  if (d > LIMIT) { p.x *= LIMIT / d; p.z *= LIMIT / d; }
  coyote = onGround ? 0.12 : coyote - dt; jumpBuf -= dt;
  if (jumpBuf > 0 && coyote > 0) { vy = JUMP; coyote = 0; jumpBuf = 0; onGround = false; sfx.jump(); }
  climbing = touchClimb && moving;
  if (climbing) vy = 5; else vy = Math.max(vy - GRAV * dt, -40);
  p.y += vy * dt; onGround = false; standing = null; collide('y');
}
function spawnRock() {
  const m = new THREE.Mesh(rockGeo, rockMat); m.castShadow = true; m.scale.setScalar(rnd(0.8, 1.3));
  m.position.set(p.x + rnd(-6, 6), p.y + 24, p.z + rnd(-6, 6)); scene.add(m); rocks.push({ m, v: 0 });
}
function updateRocks(dt) {
  rockT -= dt; if (rockT <= 0 && p.y > 6) { spawnRock(); rockT = Math.max(1.1, 3 - p.y / 35); }
  for (let i = rocks.length - 1; i >= 0; i--) {
    const k = rocks[i], q = k.m.position; k.v = Math.min(k.v + 20 * dt, 30); q.y -= k.v * dt; k.m.rotation.x += dt * 3; k.m.rotation.z += dt * 2;
    let gone = q.y < 0.7 || Math.hypot(q.x, q.z) < coneR(q.y) + 0.8;
    if (!gone) for (const s of solids) if (Math.abs(q.x - s.cx) < s.hx + 0.8 && Math.abs(q.z - s.cz) < s.hz + 0.8 && q.y - 0.8 < s.cy + s.hy && q.y + 0.8 > s.cy - s.hy) { gone = true; break; }
    if (gone) { if (Math.abs(q.y - p.y) < 25 && Math.hypot(q.x - p.x, q.z - p.z) < 25) sfx.thud(); scene.remove(k.m); rocks.splice(i, 1); continue; }
    if (Math.hypot(q.x - p.x, q.y - (p.y + 0.9), q.z - p.z) < 1.4) { scene.remove(k.m); rocks.splice(i, 1); hurt('Ouch! Rock hit!'); }
  }
}
function updateGame(dt) {
  const n = 2; for (let i = 0; i < n; i++) step(dt / n);
  updateRocks(dt); invuln = Math.max(0, invuln - dt);
  for (const c of coins) {
    if (!c.alive) continue; c.g.rotation.y += dt * 3; c.g.position.y += Math.sin(time * 3 + c.g.position.x) * 0.002;
    if (Math.hypot(c.g.position.x - p.x, c.g.position.z - p.z) < 1.2 && Math.abs(c.g.position.y - (p.y + 0.9)) < 1.3) { c.alive = false; c.g.visible = false; score += 10; sfx.coin(); hud(); }
  }
  for (const c of cps) if (!c.got && Math.hypot(c.x - p.x, c.z - p.z) < 3.5 && Math.abs(c.y - p.y) < 3) { c.got = true; cp = c; c.cloth.material.color.set(0x2ecc71); sfx.check(); toast('Checkpoint!'); }
  if (Math.hypot(summit.x - p.x, summit.z - p.z) < 3 && Math.abs(summit.y - p.y) < 2.5) win();
  else if (p.y < cp.y - 14) hurt('You fell!');
  hud();
}

// ---------- animation / camera ----------
function animate(dt) {
  if (moving()) face += angDiff(Math.atan2(mv.x, mv.y), face) * Math.min(1, 14 * dt);
  hero.position.copy(p); hero.rotation.y = face; hero.visible = invuln <= 0 || Math.floor(time * 12) % 2 === 0;
  const amt = moving() && onGround ? 1 : 0; phase += dt * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 14 : 9) * amt;
  const sw = Math.sin(phase) * 0.9 * amt;
  legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
  if (!onGround) { armL.rotation.x = armR.rotation.x = Math.PI * 0.8; legL.rotation.x = 0.4; legR.rotation.x = -0.3; }
  if (climbing) { armL.rotation.x = Math.sin(time * 14) * 0.5 + 2.6; armR.rotation.x = -Math.sin(time * 14) * 0.5 + 2.6; }
}
const moving = () => mv.lengthSq() > 0.01 && state === 'play';
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; }
function updateCamera(dt) {
  if (keys.has('KeyQ')) { yaw -= 1.9 * dt; manual = 3; } if (keys.has('KeyE')) { yaw += 1.9 * dt; manual = 3; }
  manual -= dt;
  if (manual <= 0 && state === 'play' && moving()) yaw += angDiff(Math.PI - Math.atan2(p.z, p.x), yaw) * Math.min(1, 0.7 * dt);
  const t = new THREE.Vector3(p.x, p.y + 1.5, p.z), want = new THREE.Vector3(p.x + Math.sin(yaw) * 9, p.y + 5, p.z + Math.cos(yaw) * 9);
  const dx = Math.hypot(want.x, want.z), minR = coneR(want.y) + 2; if (dx < minR) { want.x *= minR / dx; want.z *= minR / dx; }
  camera.position.lerp(want, 1 - Math.exp(-7 * dt)); camera.lookAt(t);
  sun.position.set(p.x + 35, p.y + 55, p.z + 25); sun.target.position.copy(p);
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space' && state === 'play' && !e.repeat) jumpBuf = 0.14;
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) pause(state === 'play');
  if (e.code === 'KeyM') $('muteBtn').click();
  if (e.code === 'Enter' && state === 'menu') start();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); pause(true); });
let drag = false;
renderer.domElement.addEventListener('pointerdown', () => (drag = true));
addEventListener('pointerup', () => (drag = false));
addEventListener('pointermove', (e) => { if (drag && state === 'play') { yaw -= e.movementX * 0.006; manual = 3; } });
$('startBtn').onclick = start; $('retryBtn').onclick = start; $('againBtn').onclick = start; $('restartBtn').onclick = start;
$('resumeBtn').onclick = () => pause(false); $('pauseBtn').onclick = () => pause(state === 'play');
$('menuBtn').onclick = $('menuBtn2').onclick = $('menuBtn3').onclick = toMenu;
$('muteBtn').onclick = () => { sfx.init(); $('muteBtn').textContent = sfx.toggleMute() ? '🔇' : '🔊'; };

// ---------- main loop ----------
let last = performance.now();
newGame(); show('menu');
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  if (state === 'play') updateGame(dt);
  else if (state === 'menu') { yaw += dt * 0.15; }
  animate(dt); updateCamera(dt);
  coinsSpin(dt);
  for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 280) c.position.x = -280; }
  renderer.render(scene, camera);
}
function coinsSpin(dt) { if (state !== 'play') for (const c of coins) if (c.alive) c.g.rotation.y += dt * 2; }
requestAnimationFrame(loop);
