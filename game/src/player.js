// Solara Bay 3D — the player. A low-poly character (boxes + cylinders) with
// a walk swing, on-foot movement relative to the camera, and arcade driving.
import * as THREE from '../vendor/three.module.js';
import { CAR, PLAYER } from './config.js';
import { angleLerp, clamp, dist2 } from './util.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e8a6a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3442 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  torso.position.y = 1.35;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 2.12;
  head.castShadow = true;
  g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54), hair);
  hairTop.position.y = 2.4;
  g.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
  armL.position.set(-0.58, 1.35, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.58;
  g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export function makePlayer(x, z) {
  return {
    x, z, angle: 0, mesh: makePlayerMesh(),
    health: PLAYER.healthMax, cash: 150, ammo: 24,
    car: null, walkPhase: 0, moving: false,
  };
}

export function syncPlayerMesh(p) {
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.angle;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.8;
  p.mesh.userData.armR.rotation.x = swing * 0.8;
}

// On foot: WASD relative to the camera yaw; Shift runs.
export function stepPlayerOnFoot(G, p, input, camYaw, dt) {
  let ix = 0; let iz = 0;
  if (input.forward) iz -= 1;
  if (input.back) iz += 1;
  if (input.left) ix -= 1;
  if (input.right) ix += 1;
  p.moving = ix !== 0 || iz !== 0;
  if (!p.moving) { syncPlayerMesh(p); return; }
  const len = Math.hypot(ix, iz);
  ix /= len; iz /= len;
  // Camera-relative: forward is -Z rotated by camYaw.
  const fx = -Math.sin(camYaw); const fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw); const rz = -Math.sin(camYaw);
  const mx = fx * -iz + rx * ix;
  const mz = fz * -iz + rz * ix;
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.x += mx * speed * dt;
  p.z += mz * speed * dt;
  p.angle = angleLerp(p.angle, Math.atan2(mx, mz), Math.min(1, dt * 12));
  p.walkPhase += speed * dt * 1.6;
  const hit = G.city.collideCircle(p.x, p.z, PLAYER.radius);
  p.x = hit.x; p.z = hit.z;
  syncPlayerMesh(p);
}

// Driving: W/S accel + brake/reverse, A/D steer (steering follows speed sign).
export function stepPlayerDriving(G, p, input, dt) {
  const car = p.car;
  if (!car) return;
  const def = CAR.types[car.type];
  if (input.forward) car.speed = Math.min(car.speed + def.accel * dt, def.top);
  else if (input.back) {
    if (car.speed > 1) car.speed = Math.max(car.speed - 46 * dt, 0);
    else car.speed = Math.max(car.speed - def.accel * 0.6 * dt, -CAR.reverseTop);
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  let steer = 0;
  if (input.left) steer += 1;
  if (input.right) steer -= 1;
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * def.turn * dirSign * Math.min(1, Math.abs(car.speed) / 12) * dt;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const hit = G.city.collideCircle(car.x, car.z, 1.7);
  if (hit.x !== car.x || hit.z !== car.z) car.speed *= 0.5;
  car.x = hit.x; car.z = hit.z;
  p.x = car.x; p.z = car.z; p.angle = car.angle;
  p.moving = Math.abs(car.speed) > 1;
}

export function nearestCar(G, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of G.cars) {
    if (car.playerDriven) continue;
    const d = dist2(G.player.x, G.player.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterExitCar(G) {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    car.playerDriven = false;
    car.speed *= 0.4;
    // Step out to the driver's side.
    const sx = Math.cos(car.angle); const sz = -Math.sin(car.angle);
    p.x = car.x + sx * 2.2; p.z = car.z + sz * 2.2;
    const hit = G.city.collideCircle(p.x, p.z, PLAYER.radius);
    p.x = hit.x; p.z = hit.z;
    p.car = null;
    p.mesh.visible = true;
    syncPlayerMesh(p);
    return 'exit';
  }
  const car = nearestCar(G, PLAYER.enterRange);
  if (!car) return null;
  if (car.type === 'police') return null; // cannot jack a cop car
  p.car = car;
  car.playerDriven = true;
  car.chasing = false;
  car.parked = false;
  p.mesh.visible = false;
  p.x = car.x; p.z = car.z; p.angle = car.angle;
  return 'enter';
}
