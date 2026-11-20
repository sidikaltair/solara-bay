// Headless self-test (?selftest=1). Ten checks that prove the game boots,
// the world builds, missions load, and the player can move and drive.
// Results go into #selftest and document.title so a headless run can read
// them with --dump-dom. Nothing here needs user input.
import * as THREE from 'three';
import { G } from './state.js';
import { updatePlayer, enterCar, exitCar, nearestCar } from './player.js';
import { makeCar } from './car.js';
import { drawMinimap } from './hud.js';
import { initAudio } from './audio.js';

const CHECKS = [];

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function renderResults(results) {
  const passed = results.filter(r => r.ok).length;
  const lines = results.map(r => (r.ok ? 'PASS' : 'FAIL') + ' ' + r.name + (r.note ? ' — ' + r.note : ''));
  lines.push(`SELFTEST ${passed}/${results.length}`);
  const el = document.getElementById('selftest');
  if (el) {
    el.style.display = 'block';
    el.textContent = lines.join('\n');
  }
  document.title = `SELFTEST ${passed}/${results.length}`;
  window.__selftestDone = true;
  window.__selftestPassed = passed;
  window.__selftestTotal = results.length;
}

export async function runSelfTest() {
  const results = [];
  const tick = () => new Promise(r => requestAnimationFrame(() => r()));

  check('three-loaded', () => THREE.REVISION === '160');
  check('renderer-created', () => {
    return !!G.renderer && G.renderer instanceof THREE.WebGLRenderer
      && !!G.renderer.getContext();
  });
  check('world-built', () => {
    return !!G.world && G.world.buildings.length >= 20
      && G.colliders.length >= 20;
  });
  check('player-spawned', () => {
    return !!G.player && G.player.mesh.parent === G.scene;
  });
  check('missions-loaded', () => {
    return G.missions.length === 5 && !!G.missions[0].target;
  });

  // The movement + car checks need a couple of real frames first.
  await tick(); await tick();

  check('player-moves', () => {
    const p = G.player;
    const x0 = p.x, z0 = p.z;
    G.keys['KeyW'] = true;
    for (let i = 0; i < 30; i++) updatePlayer(0.016);
    G.keys['KeyW'] = false;
    const moved = Math.hypot(p.x - x0, p.z - z0);
    return moved > 0.5;
  });

  check('car-enter-exit', () => {
    const p = G.player;
    const car = makeCar({ x: p.x + 2.5, z: p.z, angle: 0, driver: null });
    const near = nearestCar(6);
    if (!near) return false;
    const okIn = enterCar(near);
    const inCar = okIn && G.mode === 'drive' && p.car === near;
    exitCar();
    const outCar = G.mode === 'foot' && p.car === null && p.mesh.visible;
    // Clean up the test car so it does not linger in the scene.
    G.scene.remove(car.mesh);
    G.cars.splice(G.cars.indexOf(car), 1);
    return inCar && outCar;
  });

  check('waypoint-beam', () => {
    const m = G.missions[G.missionIndex];
    if (!m) return false;
    // The beam is stored on G (named 'waypoint-beam'); do not match by
    // geometry type alone — the plaza fountain is also a cylinder.
    const beam = G._beam;
    return !!beam && beam.visible
      && Math.abs(beam.position.x - m.target.x) < 1
      && Math.abs(beam.position.z - m.target.z) < 1;
  });

  check('minimap-renders', () => {
    drawMinimap();
    const mm = document.getElementById('minimap');
    if (!mm) return false;
    const ctx = mm.getContext('2d');
    const px = ctx.getImageData(84, 84, 1, 1).data;
    return px[3] > 0;
  });

  check('audio-module', () => {
    try {
      initAudio();
      return true;
    } catch (e) {
      return false;
    }
  });

  for (const c of CHECKS) {
    let ok = false, note = '';
    try {
      ok = !!c.fn();
    } catch (e) {
      ok = false;
      note = String(e && e.message || e);
    }
    results.push({ name: c.name, ok, note });
  }
  renderResults(results);
  return results;
}
