// On-foot player: a simple low-poly figure with walk animation, camera-
// relative WASD movement, building collision, and car enter/exit.
import * as THREE from 'three';
import { G, clamp, collideCircle, dist2D } from './state.js';

export function createPlayer(x, z) {
  const g = new THREE.Group();

  const jacket = new THREE.MeshLambertMaterial({ color: 0x274b8f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 8), jacket);
  body.position.y = 1.25;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 2.05;
  head.castShadow = true;
  g.add(head);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 2.28;
  g.add(cap);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legL.position.set(-0.2, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  g.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), jacket);
  armL.position.set(-0.55, 1.3, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  g.add(armR);

  // Pistol in the right hand (visible when aiming).
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x181818 }));
  gun.add(gunBody);
  gun.position.set(0.55, 1.05, 0.35);
  g.add(gun);

  g.position.set(x, 0, z);
  G.scene.add(g);

  const p = {
    mesh: g, gun, legL, legR, armL, armR,
    x, z, angle: 0,
    walkT: 0,
    moving: false,
    car: null,          // car being driven, or null
    aiming: false,
  };
  G.player = p;
  return p;
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p || G.mode !== 'foot' || G.paused) return;
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
  const sprint = (k['ShiftLeft'] || k['ShiftRight']) ? 1.55 : 1;
  const speed = 6 * sprint;

  let mx = 0, mz = 0;
  if (fwd !== 0 || strafe !== 0) {
    // Camera-relative movement. forward = (sin yaw, cos yaw); right =
    // cross(forward, up) = (-cos yaw, sin yaw).
    const sy = Math.sin(G.camYaw), cy = Math.cos(G.camYaw);
    mx = sy * fwd - cy * strafe;
    mz = cy * fwd + sy * strafe;
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.moving = true;
    p.angle = Math.atan2(mx, mz);
  } else {
    p.moving = false;
  }

  const nx = p.x + mx * speed * dt;
  const nz = p.z + mz * speed * dt;
  const hit = collideCircle(nx, nz, 0.6);
  p.x = hit.x; p.z = hit.z;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.angle;

  // Walk swing.
  if (p.moving) {
    p.walkT += dt * 10 * sprint;
    const s = Math.sin(p.walkT) * 0.5;
    p.legL.rotation.x = s;
    p.legR.rotation.x = -s;
    p.armL.rotation.x = -s * 0.7;
    p.armR.rotation.x = s * 0.7;
  } else {
    p.legL.rotation.x *= 0.8;
    p.legR.rotation.x *= 0.8;
    p.armL.rotation.x *= 0.8;
    p.armR.rotation.x *= 0.8;
  }
  // Aim pose: right arm forward.
  p.gun.visible = true;
  if (p.aiming) {
    p.armR.rotation.x = -1.35;
    p.gun.position.set(0.3, 1.45, 0.55);
  } else {
    p.gun.position.set(0.55, 1.05, 0.35);
  }
}

export function nearestCar(maxD) {
  const p = G.player;
  let best = null, bestD = maxD;
  for (const c of G.cars) {
    if (c.disabled || c.driver === 'player') continue;
    const d = dist2D(p.x, p.z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(car) {
  const p = G.player;
  if (!car || G.mode !== 'foot') return false;
  const wasTraffic = car.driver === 'traffic';
  const wasParked = car.driver === null;
  car.driver = 'player';
  p.car = car;
  G.mode = 'drive';
  p.mesh.visible = false;
  // Stealing a traffic car (or any occupied car) is a crime. Parked cars
  // that belong to nobody are free — but taking a traffic car is theft.
  if (wasTraffic) {
    G.wanted = Math.min(5, G.wanted + 2);
    G.lastCrimeAt = G.time;
  }
  return true;
}

export function exitCar() {
  const p = G.player;
  if (G.mode !== 'drive' || !p.car) return;
  const car = p.car;
  car.driver = null;
  p.car = null;
  G.mode = 'foot';
  // Step out to the left of the car.
  const sx = car.x + Math.cos(car.angle) * 2.2;
  const sz = car.z - Math.sin(car.angle) * 2.2;
  const hit = collideCircle(sx, sz, 0.6);
  p.x = hit.x; p.z = hit.z;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.visible = true;
}
