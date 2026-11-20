// Screenshot staging (?shot=1..4). Each shot arranges the scene into a
// readable, dramatic frame and leaves it there — the game loop keeps
// rendering, so a headless --screenshot after a virtual-time budget captures
// the staged frame. All staging uses the live game objects (no fake props).
import * as THREE from 'three';
import { G, clamp } from './state.js';
import { makeCar } from './car.js';
import { enterCar } from './player.js';
import { spawnFootCop } from './police.js';
import { setDusk } from './world.js';
import { setMissionIndex } from './missions.js';
import { shoot } from './combat.js';

function setCam(yaw, pitch, dist, tx, ty, tz) {
  G.camYaw = yaw;
  G.camPitch = pitch;
  G.camDist = dist;
  G._camTarget = { x: tx, y: ty, z: tz };
}

function playerDriveAt(x, z, angle) {
  const p = G.player;
  const car = makeCar({ x, z, angle, driver: null });
  car.maxSpeed = 26;
  enterCar(car);
  car.speed = 14;
  return car;
}

// 1 — car chase: player driving with two police cars on his tail.
function stageChase() {
  G.wanted = 3;
  const car = playerDriveAt(55, 40, Math.PI);
  const cop1 = makeCar({ x: 55, z: 40 - 14, angle: Math.PI, police: true, driver: 'police' });
  const cop2 = makeCar({ x: 58.5, z: 40 - 24, angle: Math.PI, police: true, driver: 'police' });
  cop1.speed = 15; cop2.speed = 15;
  // A civilian car ahead for depth (parked — no route, so driver stays null).
  makeCar({ x: 55, z: 40 + 55, angle: Math.PI, driver: null });
  setCam(Math.PI, 0.26, 13, car.x, 2.2, car.z);
  return 'chase staged';
}

// 2 — on-foot shootout: player aiming, two foot cops + a cruiser, muzzle flash.
function stageFoot() {
  const p = G.player;
  p.x = -20; p.z = -20;
  p.mesh.position.set(p.x, 0, p.z);
  p.angle = Math.PI * 0.75;
  p.mesh.rotation.y = p.angle;
  p.aiming = true;
  G.wanted = 3;
  spawnFootCop(-14, -8);
  spawnFootCop(-28, -6);
  makeCar({ x: -34, z: -30, angle: Math.PI * 0.6, police: true, driver: 'police' });
  // Face the camera over the player's shoulder.
  G.camYaw = Math.PI * 0.75 + Math.PI;
  setCam(G.camYaw, 0.22, 8, p.x, 1.8, p.z);
  // Fire once so the muzzle flash + tracer are in frame (they hold in shot mode).
  G.keys['KeyW'] = false;
  shoot();
  return 'foot shootout staged';
}

// 3 — mission waypoint: player on foot near the glowing beam.
function stageMission() {
  setMissionIndex(1);
  const p = G.player;
  const m = G.missions[G.missionIndex];
  p.x = m.target.x - 14; p.z = m.target.z - 10;
  p.mesh.position.set(p.x, 0, p.z);
  p.angle = Math.atan2(m.target.x - p.x, m.target.z - p.z);
  p.mesh.rotation.y = p.angle;
  G.wanted = 1;
  makeCar({ x: p.x + 6, z: p.z + 4, angle: 0.4, driver: null });
  setCam(p.angle + Math.PI, 0.3, 15, (p.x + m.target.x) / 2, 3, (p.z + m.target.z) / 2);
  return 'mission staged';
}

// 4 — dusk skyline: high camera over the city, beach and water.
function stageDusk() {
  setDusk(true);
  const p = G.player;
  p.x = 0; p.z = 180;
  p.mesh.position.set(p.x, 0, p.z);
  G.wanted = 0;
  // A couple of cars with headlights on the beach road for life (parked).
  makeCar({ x: -55, z: 240, angle: 0, driver: null });
  makeCar({ x: 55, z: 250, angle: Math.PI, driver: null });
  setCam(Math.PI, 0.62, 95, 0, 8, 120);
  return 'dusk staged';
}

export function stageShot(n) {
  G.shot = n;
  // Keep the HUD visible — it is part of the frame.
  switch (n) {
    case 1: return stageChase();
    case 2: return stageFoot();
    case 3: return stageMission();
    case 4: return stageDusk();
    default: return 'unknown shot';
  }
}
