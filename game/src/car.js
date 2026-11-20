// Cars: one factory for traffic, parked, player-driven and police cars.
// Arcade physics on purpose — no suspension simulation, just speed, steering
// and simple circle-vs-building / car-vs-car collision.
import * as THREE from 'three';
import { G, clamp, angDiff, collideCircle } from './state.js';

const BODY_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3aa655, 0x8a8f98, 0x222831, 0xd8d8d8, 0x7a4a9e];

export function makeCar(opts) {
  const o = opts || {};
  const color = o.color !== undefined ? o.color : BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)];
  const police = !!o.police;
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf2f2f2 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? 0x222831 : 0x1a2733 }));
  cabin.position.set(0, 1.08, -0.25);
  cabin.castShadow = true;
  g.add(cabin);

  // Bumpers + headlights.
  const bumperMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.3), bumperMat);
  fb.position.set(0, 0.32, 2.25); g.add(fb);
  const bb = fb.clone(); bb.position.z = -2.25; g.add(bb);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const sx of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    hl.position.set(sx, 0.62, 2.22); g.add(hl);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w); wheels.push(w);
  }

  // Police livery: doors stripe + roof light bar.
  let lightBar = null, barRed = null, barBlue = null;
  if (police) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
    stripe.position.y = 0.62; g.add(stripe);
    lightBar = new THREE.Group();
    barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barRed.position.set(-0.32, 1.48, -0.25);
    barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    barBlue.position.set(0.32, 1.48, -0.25);
    lightBar.add(barRed); lightBar.add(barBlue);
    g.add(lightBar);
    const ptext = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    ptext.position.set(0, 0.9, 2.21); g.add(ptext);
  }

  g.position.set(o.x || 0, 0, o.z || 0);
  g.rotation.y = o.angle || 0;
  G.scene.add(g);

  const car = {
    mesh: g, wheels, police,
    x: o.x || 0, z: o.z || 0,
    angle: o.angle || 0,
    speed: 0,
    steer: 0,
    maxSpeed: police ? 26 : 24,
    maxReverse: 9,
    accel: 13,
    brake: 22,
    health: police ? 3 : 1,
    driver: o.driver || null,   // 'player' | 'traffic' | 'police' | null (parked)
    route: o.route || null,     // array of {x,z} for traffic
    routeIdx: 0,
    target: null,               // chase target {x,z} for police
    disabled: false,
    smoke: null,
    lightBar, barRed, barBlue,
    flashT: Math.random() * 0.5,
  };
  G.cars.push(car);
  if (police) G.police.push(car);
  else if (car.driver === 'traffic') G.traffic.push(car);
  return car;
}

function syncMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  // Spin wheels with speed.
  const spin = car.speed * 0.016 / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
}

// Player driving: W/S gas/brake, A/D steer.
export function updatePlayerCar(car, dt) {
  const k = G.keys;
  const fwd = (k['KeyW'] || k['ArrowUp']) ? 1 : 0;
  const back = (k['KeyS'] || k['ArrowDown']) ? 1 : 0;
  const left = (k['KeyA'] || k['ArrowLeft']) ? 1 : 0;
  const right = (k['KeyD'] || k['ArrowRight']) ? 1 : 0;

  if (fwd) car.speed += car.accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= car.brake * dt;
    else car.speed -= car.accel * 0.6 * dt;
  }
  if (!fwd && !back) {
    // Engine drag + rolling resistance.
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 7 * dt);
  }
  car.speed = clamp(car.speed, -car.maxReverse, car.maxSpeed);

  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer += (steerTarget * 0.55 - car.steer) * Math.min(1, dt * 8);
  const spd = clamp(Math.abs(car.speed) / 12, 0, 1);
  car.angle += car.steer * spd * Math.sign(car.speed) * dt * 1.9;

  stepCar(car, dt);
  syncMesh(car);
}

// One physics step: move forward, resolve building + car collisions.
export function stepCar(car, dt) {
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const hit = collideCircle(nx, nz, 1.7);
  // If the push-out moved us a lot, we hit a wall: kill speed.
  const moved = Math.hypot(hit.x - nx, hit.z - nz);
  if (moved > 0.15) car.speed *= 0.35;
  car.x = hit.x; car.z = hit.z;

  // Soft car-vs-car separation.
  for (const o of G.cars) {
    if (o === car || o.disabled) continue;
    const dx = car.x - o.x, dz = car.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      if (car.driver === 'player' && o.police) {
        // Ramming a cop car is a crime.
        if (G.time - G.lastCrimeAt > 2) { G.wanted = Math.min(5, G.wanted + 1); G.lastCrimeAt = G.time; }
      }
    }
  }
}

// AI driving toward a point (traffic waypoints / police chase).
export function driveAI(car, dt, tx, tz, cruise) {
  if (car.disabled) return;
  const dx = tx - car.x, dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  const diff = angDiff(car.angle, want);
  car.steer += (clamp(diff * 1.4, -0.6, 0.6) - car.steer) * Math.min(1, dt * 6);
  const targetSpeed = Math.abs(diff) > 1.2 ? cruise * 0.35 : cruise;
  if (car.speed < targetSpeed) car.speed += car.accel * 0.7 * dt;
  else car.speed -= Math.min(car.speed - targetSpeed, 8 * dt);
  car.speed = clamp(car.speed, 0, car.maxSpeed);
  car.angle += car.steer * clamp(Math.abs(car.speed) / 12, 0, 1) * dt * 1.9;
  stepCar(car, dt);
  syncMesh(car);
  // Police light bar flash.
  if (car.police && car.lightBar) {
    car.flashT += dt;
    const on = Math.floor(car.flashT * 6) % 2 === 0;
    car.barRed.visible = on;
    car.barBlue.visible = !on;
  }
}

export function disableCar(car) {
  car.disabled = true;
  car.speed = 0;
  if (!car.smoke) {
    const smoke = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333, transparent: true, opacity: 0.55 }));
    smoke.position.set(0, 2.2, 1.2);
    car.mesh.add(smoke);
    car.smoke = smoke;
  }
}
