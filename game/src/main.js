// Solara Bay 3D — boot and the one loop. Third-person camera, input, state
// machine (menu / playing / paused / busted / wasted / complete), waypoint
// beam, foot cops, and the ?shot= / ?selftest=1 hooks.
// 3D rebuild v1 — recorded session, November 2026.
// ?seed=N fixes the city. ?time=dusk forces golden-hour light.
import * as THREE from '../vendor/three.module.js';
import { CAR, COMBAT, PLAYER, STEP, WORLD, PLACES } from './config.js';
import { createRandom } from './util.js';
import { createCity } from './world.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { makePlayer, enterExitCar, stepPlayerDriving, stepPlayerOnFoot, syncPlayerMesh } from './player.js';
import { makeCar, spawnParkedCar, spawnTrafficCar, stepTrafficCar, collideCars, syncCarMesh } from './vehicles.js';
import { makePed, stepPed } from './peds.js';
import { makeWanted, addCrime, updatePolice } from './police.js';
import { missionTarget, objectiveText, startMission, updateMissions } from './missions.js';
import { firePistol, makeCombat, makeCop, stepCop, updateCombat } from './combat.js';
import { stageShot } from './shots.js';
import { runSelftest } from './selftest.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const timeParam = params.get('time');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const audio = createAudio();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8e8);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
// Muzzle flash light (off by default).
const muzzleLight = new THREE.PointLight(0xffc860, 0, 18);
scene.add(muzzleLight);

function resize() {
  const w = window.innerWidth; const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function buildGame() {
  const rng = createRandom(seed);
  const city = createCity(rng, scene);
  const G = {
    time: 0,
    clockMinutes: 570, // 09:30 — a bright Solara Bay morning
    timeOfDay: 'day',
    state: 'menu',
    seed,
    rng,
    city,
    scene,
    camera,
    player: makePlayer(-115, -112),
    cars: [],
    peds: [],
    policeCars: [],
    cops: [],
    tracers: [],
    pickups: [],
    wanted: makeWanted(),
    combat: makeCombat(),
    mission: null,
    completed: [],
    spawnTimer: 0,
    bustTimer: 0,
    copTouchTimer: 0,
    crimeCooldown: 0,
    busted: false,
    wasted: false,
    banner: null,
    gunshotAt: null,
    muzzleLight,
    camYaw: Math.PI, // camera looks north (-z) at start
    camPitch: 0.34,
    camDist: 9.5,
    camFollowPause: 0,
    inputOverride: null,
    audio,
    input: null,
    hud: null,
    waypoint: null,
    saveGame() { saveGame(G); },
    toast(text, seconds) { if (G.hud) G.hud.showToast(text, seconds || 3); },
  };
  G.input = createInput();
  G.hud = createHud(G);
  return G;
}

const G = buildGame();

// ---- Input ----
function createInput() {
  const keys = {};
  const input = {
    forward: false, back: false, left: false, right: false,
    run: false, brake: false,
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    syncKeys();
    if (e.code === 'KeyE' && G.state === 'playing') {
      const res = enterExitCar(G);
      if (res === 'enter') {
        // Stealing in front of witnesses brings the heat.
        const witnessed = G.peds.some((pd) => Math.hypot(pd.x - G.player.x, pd.z - G.player.z) < 25)
          || G.policeCars.some((c) => Math.hypot(c.x - G.player.x, c.z - G.player.z) < 40);
        if (witnessed) addCrime(G, 1, 'Stolen car — the SBPD is coming!');
        else G.toast('Nice wheels. Mara is waiting.', 3);
      }
    }
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'KeyM') {
      const m = audio.toggleMute();
      G.toast(m ? 'Muted' : 'Sound on', 2);
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; syncKeys(); });
  function syncKeys() {
    input.forward = !!(keys.KeyW || keys.ArrowUp);
    input.back = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
    input.run = !!keys.ShiftLeft || !!keys.ShiftRight;
    input.brake = !!keys.Space;
  }
  // Mouse drag orbits the camera; click shoots (on foot only).
  let dragging = false; let lastX = 0; let lastY = 0; let downAt = 0;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = performance.now();
  });
  window.addEventListener('mouseup', (e) => {
    if (dragging && performance.now() - downAt < 220 && G.state === 'playing') {
      firePistol(G, camera);
    }
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    G.camYaw -= dx * 0.006;
    G.camPitch = Math.max(0.08, Math.min(1.0, G.camPitch + dy * 0.004));
    G.camFollowPause = 3;
  });
  return input;
}

function readInput() {
  return G.inputOverride || G.input;
}

// ---- Waypoint beam ----
const beamMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 34, 12, 1, true), beamMat);
beam.visible = false;
scene.add(beam);
const markerGeo = new THREE.OctahedronGeometry(1.4);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
const marker = new THREE.Mesh(markerGeo, markerMat);
marker.visible = false;
scene.add(marker);

function updateWaypoint() {
  const t = missionTarget(G);
  if (!t) { beam.visible = false; marker.visible = false; return; }
  beam.visible = true; marker.visible = true;
  beam.position.set(t.x, 17, t.z);
  marker.position.set(t.x, 8 + Math.sin(G.time * 2) * 0.8, t.z);
  marker.rotation.y = G.time;
}

// ---- Camera ----
function updateCamera(dt) {
  const p = G.player;
  const driving = !!p.car;
  const targetDist = driving ? 13 : 9.5;
  G.camDist += (targetDist - G.camDist) * Math.min(1, dt * 3);
  // Gentle auto-follow behind the facing direction (paused after mouse drag).
  if (G.camFollowPause > 0) G.camFollowPause -= dt;
  else {
    const wantYaw = p.angle + Math.PI;
    let diff = ((wantYaw - G.camYaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    G.camYaw += diff * Math.min(1, dt * (driving ? 3.2 : 1.4));
  }
  const tx = p.x; const ty = p.car ? 2.6 : 2.1; const tz = p.z;
  const d = G.camDist;
  const cx = tx + Math.sin(G.camYaw) * Math.cos(G.camPitch) * d;
  const cz = tz + Math.cos(G.camYaw) * Math.cos(G.camPitch) * d;
  const cy = ty + Math.sin(G.camPitch) * d;
  camera.position.set(cx, cy, cz);
  camera.lookAt(tx, ty, tz);
  // Sun shadow follows the player.
  const sun = G.city.sun;
  sun.position.set(p.x + 180, 260, p.z + 120);
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
}

// ---- World population ----
function populateWorld() {
  for (const car of [...G.cars, ...G.policeCars]) G.scene.remove(car.mesh);
  for (const ped of G.peds) G.scene.remove(ped.mesh);
  for (const cop of G.cops) G.scene.remove(cop.mesh);
  G.cars.length = 0; G.peds.length = 0; G.policeCars.length = 0; G.cops.length = 0;
  G.tracers.length = 0; G.pickups.length = 0;
  for (let i = 0; i < 11; i += 1) {
    const car = spawnTrafficCar(G.city, G.rng, G.player.x, G.player.z);
    G.cars.push(car); G.scene.add(car.mesh);
  }
  for (let i = 0; i < 10; i += 1) {
    const car = spawnParkedCar(G.city, G.rng);
    G.cars.push(car); G.scene.add(car.mesh);
  }
  for (let i = 0; i < 24; i += 1) {
    const ped = makePed(G.rng, G.city);
    G.peds.push(ped); G.scene.add(ped.mesh);
  }
}

// ---- Screens ----
function showScreen(name) {
  for (const id of ['screen-menu', 'screen-pause', 'screen-busted', 'screen-wasted', 'screen-complete']) {
    document.getElementById(id).classList.toggle('show', id === `screen-${name}`);
  }
  document.getElementById('hud').classList.toggle('hidden', name === 'menu');
}

function announce(message) { statusEl.textContent = message; }

function newGame() {
  populateWorld();
  G.player = makePlayer(-115, -112);
  G.player.cash = 150;
  G.player.mesh.visible = true;
  G.scene.add(G.player.mesh);
  G.wanted = makeWanted();
  G.completed = [];
  G.clockMinutes = 570;
  G.timeOfDay = 'day';
  G.city.setTimeOfDay('day');
  G.busted = false; G.wasted = false; G.banner = null;
  G.state = 'playing';
  audio.unlock();
  startMission(G, 0);
  showScreen('none');
  announce('Playing. Mara Voss has a job for you — follow the yellow marker.');
}

function continueGame() {
  const save = loadGame();
  if (!save) { newGame(); return; }
  populateWorld();
  G.player = makePlayer(save.x, save.z);
  G.player.cash = save.cash;
  G.player.health = save.health;
  G.player.ammo = save.ammo;
  G.player.mesh.visible = true;
  G.scene.add(G.player.mesh);
  G.completed = save.completed || [];
  G.wanted = makeWanted();
  G.clockMinutes = 570;
  G.state = 'playing';
  audio.unlock();
  startMission(G, save.missionIdx || 0);
  showScreen('none');
  announce(`Welcome back. ${G.completed.length} jobs done, $${G.player.cash} in your pocket.`);
}

function respawnAfterTrouble(kind) {
  const spot = kind === 'busted' ? PLACES.precinct : PLACES.hospital;
  if (G.player.car) { G.scene.remove(G.player.car.mesh); G.cars = G.cars.filter((c) => c !== G.player.car); }
  G.player = makePlayer(spot.x, spot.z);
  G.player.cash = Math.max(0, Math.floor(G.player.cash * 0.9));
  G.player.mesh.visible = true;
  G.scene.add(G.player.mesh);
  G.wanted = makeWanted();
  G.policeCars.forEach((c) => G.scene.remove(c.mesh));
  G.policeCars.length = 0;
  G.cops.forEach((c) => G.scene.remove(c.mesh));
  G.cops.length = 0;
  G.busted = false; G.wasted = false;
  G.state = 'playing';
  showScreen('none');
}

function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; showScreen('pause'); }
  else if (G.state === 'paused') { G.state = 'playing'; showScreen('none'); }
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit-menu').addEventListener('click', () => { G.state = 'menu'; showScreen('menu'); });
document.getElementById('btn-busted').addEventListener('click', () => respawnAfterTrouble('busted'));
document.getElementById('btn-wasted').addEventListener('click', () => respawnAfterTrouble('wasted'));
document.getElementById('btn-complete').addEventListener('click', () => { showScreen('none'); });

// ---- One fixed simulation step ----
function stepGame(dt) {
  G.time += dt;
  G.clockMinutes += dt * 0.6;
  // Dusk rolls in after 17:30.
  if (G.timeOfDay === 'day' && G.clockMinutes >= 1050) {
    G.timeOfDay = 'dusk';
    G.city.setTimeOfDay('dusk');
    G.toast('Golden hour over the bay.', 3);
  }
  const input = readInput();
  const p = G.player;
  if (p.car) stepPlayerDriving(G, p, input, dt);
  else stepPlayerOnFoot(G, p, input, G.camYaw, dt);
  // Traffic + peds.
  for (const car of G.cars) stepTrafficCar(G.city, car, G.cars, dt);
  collideCars([...G.cars, ...G.policeCars], dt);
  for (const ped of G.peds) stepPed(G.city, ped, p, G.gunshotAt, dt);
  G.gunshotAt = null;
  // Player car hitting a pedestrian = a crime.
  if (p.car && Math.abs(p.car.speed) > 12) {
    G.crimeCooldown = Math.max(0, G.crimeCooldown - dt);
    for (const ped of G.peds) {
      if (Math.hypot(ped.x - p.x, ped.z - p.z) < 2.6 && G.crimeCooldown <= 0) {
        addCrime(G, 1, 'You hit a pedestrian! The SBPD is coming.');
        ped.flee = 4;
        G.crimeCooldown = 3;
        break;
      }
    }
  }
  // Police + foot cops.
  updatePolice(G, dt);
  const wantCops = (!p.car && G.wanted.stars >= 2) ? Math.min(3, G.wanted.stars - 1) : 0;
  while (G.cops.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    const cop = makeCop(p.x + Math.sin(a) * 18, p.z + Math.cos(a) * 18);
    G.cops.push(cop); G.scene.add(cop.mesh);
  }
  while (G.cops.length > wantCops) {
    const cop = G.cops.pop();
    G.scene.remove(cop.mesh);
  }
  let copTouch = false;
  for (const cop of G.cops) {
    stepCop(G, cop, dt);
    if (Math.hypot(cop.x - p.x, cop.z - p.z) < 1.8) copTouch = true;
  }
  // Police car ramming the player on foot hurts.
  if (!p.car) {
    for (const car of G.policeCars) {
      if (Math.hypot(car.x - p.x, car.z - p.z) < 2.4) {
        p.health -= 30 * dt;
        const away = Math.atan2(p.x - car.x, p.z - car.z);
        p.x += Math.sin(away) * 6 * dt;
        p.z += Math.cos(away) * 6 * dt;
      }
    }
  }
  G.copTouchTimer = copTouch ? G.copTouchTimer + dt : 0;
  if (G.copTouchTimer > 1.4 && !p.car) {
    G.copTouchTimer = 0;
    G.busted = true;
    G.state = 'busted';
  }
  if (p.health <= 0 && !G.wasted) {
    G.wasted = true;
    G.state = 'wasted';
    p.health = PLAYER.healthMax;
  }
  updateMissions(G, dt);
  updateCombat(G, dt);
  // Expire tracers.
  for (let i = G.tracers.length - 1; i >= 0; i -= 1) {
    if (G.time > G.tracers[i].until) {
      G.scene.remove(G.tracers[i].line);
      G.tracers.splice(i, 1);
    }
  }
  // Engine sound.
  audio.setEngine(p.car ? Math.min(1, Math.abs(p.car.speed) / CAR.types[p.car.type].top) : 0);
  // Water shimmer.
  G.city.water.material.opacity = 0.8 + Math.sin(G.time * 0.7) * 0.06;
  updateWaypoint();
  if (G.state === 'busted') showScreen('busted');
  else if (G.state === 'wasted') showScreen('wasted');
  else if (G.state === 'complete') showScreen('complete');
}

// ---- Frame loop ----
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (G.state === 'playing' && !G.frozen) {
    acc += dt;
    while (acc >= STEP) { stepGame(STEP); acc -= STEP; }
    updateCamera(dt);
    G.hud.update(dt);
  } else if (G.state === 'playing' && G.frozen) {
    // Staged screenshot: hold the frame exactly as staged.
    updateCamera(0.016);
    G.hud.update(0.016);
  } else if (G.state === 'menu') {
    // Slow cinematic orbit behind the menu.
    G.time += dt;
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 60, 26, Math.cos(t) * 60 - 40);
    camera.lookAt(0, 6, 0);
  }
  renderer.render(scene, camera);
}

// ---- Boot ----
G.scene.add(G.player.mesh);
if (timeParam === 'dusk') { G.timeOfDay = 'dusk'; G.city.setTimeOfDay('dusk'); G.clockMinutes = 1090; }
if (shot) {
  populateWorld();
  // Warm up traffic/peds first, THEN stage — so staged cops and the player
  // car sit exactly where the shot wants them, and the freeze holds the frame.
  for (let i = 0; i < 90; i += 1) stepGame(STEP);
  stageShot(G, shot);
  // Sync every mesh to its staged position (the freeze stops stepGame, so
  // nothing else will move them into place).
  syncPlayerMesh(G.player);
  for (const car of [...G.cars, ...G.policeCars]) syncCarMesh(car);
  for (const ped of G.peds) { ped.mesh.position.set(ped.x, 0, ped.z); ped.mesh.rotation.y = ped.angle; }
  updateWaypoint();
  G.state = 'playing';
  showScreen('none');
  G.frozen = true;
  updateCamera(0.016);
  G.hud.update(0.016);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else if (selftest) {
  populateWorld();
  G.state = 'playing';
  showScreen('none');
  runSelftest(G, { stepGame, updateCamera });
} else {
  showScreen('menu');
}
requestAnimationFrame(frame);
