// Solara Bay 3D — boot + game loop + camera + input.
// Third-person follow camera (mouse-drag orbit, auto-follows behind while
// moving), WASD on foot / driving, E enter-exit, click shoot, R reload.
import * as THREE from 'three';
import { G, clamp, angDiff } from './state.js';
import { buildWorld, setDusk } from './world.js';
import { createPlayer, updatePlayer, nearestCar, enterCar, exitCar } from './player.js';
import { updatePlayerCar } from './car.js';
import { initTraffic, updateTraffic, spawnParked } from './traffic.js';
import { updatePolice } from './police.js';
import { initCombat, shoot, startReload, updateCombat, initPeds, updatePeds } from './combat.js';
import { initMissions, updateMissions, setMissionIndex } from './missions.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import { loadGame, applySave, togglePause, wirePauseButtons } from './save.js';
import { runSelfTest } from './selftest.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
G.selftest = params.get('selftest') === '1';
G.shot = parseInt(params.get('shot') || '0', 10) || 0;

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'game';
  document.getElementById('app').appendChild(renderer.domElement);
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.clock = new THREE.Clock();
}

function initInput() {
  window.addEventListener('keydown', (e) => {
    G.keys[e.code] = true;
    initAudio();
    if (e.code === 'KeyE') {
      if (G.mode === 'foot') {
        const car = nearestCar(4.5);
        if (car) { enterCar(car); sfx('click'); }
      } else {
        exitCar();
      }
    }
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') { G.muted = !G.muted; }
  });
  window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });

  let downX = 0, downY = 0, moved = false;
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    G.dragging = true; moved = false;
    downX = e.clientX; downY = e.clientY;
    initAudio();
  });
  window.addEventListener('mousemove', (e) => {
    if (!G.dragging) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    G.camYaw -= dx * 0.005;
    G.camPitch = clamp(G.camPitch + dy * 0.004, 0.06, 1.05);
    G._manualCamUntil = G.time + 3;
    downX = e.clientX; downY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    const wasDrag = moved;
    G.dragging = false;
    if (!wasDrag && G.mode === 'foot' && !G.paused) {
      if (shoot()) sfx('shot');
    }
  });
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  // Target: player (or the car) + eye height. Shots may pin a custom target.
  let tx, ty, tz;
  if (G._camTarget) {
    tx = G._camTarget.x; ty = G._camTarget.y; tz = G._camTarget.z;
  } else if (p.car) {
    tx = p.car.x; ty = 2.0; tz = p.car.z;
  } else {
    tx = p.x; ty = 1.9; tz = p.z;
  }
  // Auto-follow behind while moving (unless the user dragged recently).
  const heading = p.car ? p.car.angle : p.angle;
  const moving = p.car ? Math.abs(p.car.speed) > 1 : p.moving;
  if (moving && !G.dragging && G.time > (G._manualCamUntil || 0) && !G._camTarget) {
    G.camYaw += angDiff(G.camYaw, heading) * Math.min(1, dt * 1.6);
  }
  const dist = G._camTarget ? G.camDist : (p.car ? 11 : 8.5);
  const hDist = Math.cos(G.camPitch) * dist;
  const cx = tx - Math.sin(G.camYaw) * hDist;
  const cy = ty + Math.sin(G.camPitch) * dist;
  const cz = tz - Math.cos(G.camYaw) * hDist;
  G.camera.position.set(cx, cy, cz);
  G.camera.lookAt(tx, ty, tz);
}

function update(dt) {
  G.time += dt;
  if (G.paused) return;
  const p = G.player;
  if (G.mode === 'foot') {
    updatePlayer(dt);
  } else if (p && p.car) {
    updatePlayerCar(p.car, dt);
  }
  updateTraffic(dt);
  updatePolice(dt);
  updateCombat(dt);
  updatePeds(dt);
  updateMissions(dt);
  updateAudio(dt);
  // Water shimmer.
  if (G.world && G.world.water) {
    G.world.water.position.y = 0.12 + Math.sin(G.time * 0.7) * 0.05;
  }
  updateCamera(dt);
  updateHUD();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  update(dt);
  G.renderer.render(G.scene, G.camera);
  window.__frames = (window.__frames || 0) + 1;
}

function boot() {
  initRenderer();
  buildWorld();
  createPlayer(0, 0);
  initTraffic(10);
  spawnParked(6);
  initPeds(6);
  initCombat();
  initMissions();
  initHUD();
  initAudio();
  wirePauseButtons();
  initInput();

  // Continue a save unless this is a test / screenshot run.
  if (!G.selftest && !G.shot) {
    const save = loadGame();
    if (save) {
      applySave(save);
      setMissionIndex(save.missionIndex || 0);
      if (save.dusk) setDusk(true);
    }
  }
  if (params.get('dusk') === '1') setDusk(true);

  G.started = true;
  window.__game = G;

  if (G.shot > 0) {
    stageShot(G.shot);
    updateCamera(0.016);
    updateHUD();
  }
  if (G.selftest) {
    // Let two frames render, then run the checks.
    requestAnimationFrame(() => requestAnimationFrame(() => { runSelfTest(); }));
  }
  loop();
}

boot();
