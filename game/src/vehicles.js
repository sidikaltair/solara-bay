// Solara Bay 3D — cars. Low-poly box-built cars, traffic that follows the
// road grid, and police interceptors that chase the player.
import * as THREE from '../vendor/three.module.js';
import { CAR, WORLD } from './config.js';
import { angleDiff, angleLerp, clamp, dist2 } from './util.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2f42 });

export function makeCarMesh(type, colorHex) {
  const def = CAR.types[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex ?? def.color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(def.wid, 0.75, def.len);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(bodyGeo, glassMat);
  cabin.scale.set(def.wid * 0.82, 0.62, def.len * 0.45);
  cabin.position.set(0, 1.28, -def.len * 0.04);
  cabin.castShadow = true;
  g.add(cabin);
  // Headlights + taillights.
  const hlMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  const tlMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x330000 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(bodyGeo, hlMat);
    hl.scale.set(0.34, 0.18, 0.1);
    hl.position.set(sx * (def.wid / 2 - 0.3), 0.62, def.len / 2 + 0.02);
    g.add(hl);
    const tl = new THREE.Mesh(bodyGeo, tlMat);
    tl.scale.set(0.34, 0.18, 0.1);
    tl.position.set(sx * (def.wid / 2 - 0.3), 0.62, -def.len / 2 - 0.02);
    g.add(tl);
  }
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (def.wid / 2), 0.42, sz * (def.len / 2 - 0.85));
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  if (type === 'police') {
    // Light bar: two emissive domes that flash red / blue.
    const bar = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.scale.set(def.wid * 0.7, 0.16, 0.5);
    bar.position.set(0, 1.66, -def.len * 0.04);
    g.add(bar);
    const red = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
    red.scale.set(0.5, 0.2, 0.44);
    red.position.set(-0.42, 1.8, -def.len * 0.04);
    g.add(red);
    const blue = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0022ff, emissiveIntensity: 0.1 }));
    blue.scale.set(0.5, 0.2, 0.44);
    blue.position.set(0.42, 1.8, -def.len * 0.04);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  g.userData.def = def;
  return g;
}

export function makeCar(rng, type, x, z, angle, opts = {}) {
  const mesh = makeCarMesh(type, opts.color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  return {
    type, mesh, x, z, angle,
    speed: 0,
    steering: 0,
    playerDriven: false,
    chasing: false,
    parked: !!opts.parked,
    roadAxis: opts.roadAxis || null, // 'x' | 'z' for traffic
    roadLine: opts.roadLine ?? null,
    dir: opts.dir || 1,
    dead: false,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  const spin = car.speed * 0.12;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin * 0.016;
  if (car.type === 'police' && car.mesh.userData.lightRed) {
    const phase = Math.floor(performance.now() / 260) % 2 === 0;
    car.mesh.userData.lightRed.material.emissiveIntensity = phase ? 1.6 : 0.1;
    car.mesh.userData.lightBlue.material.emissiveIntensity = phase ? 0.1 : 1.6;
  }
}

export function spawnTrafficCar(city, rng, nearX, nearZ) {
  const types = ['sedan', 'taxi', 'van', 'sports', 'truck'];
  const type = types[Math.floor(rng() * types.length)];
  const p = city.randomRoadPoint(rng);
  const axis = rng() < 0.5 ? 'x' : 'z';
  const dir = rng() < 0.5 ? 1 : -1;
  const car = makeCar(rng, type, p.x, p.z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
    roadAxis: axis, roadLine: axis === 'x' ? p.z : p.x, dir,
  });
  car.speed = CAR.types[type].top * (0.35 + rng() * 0.25);
  return car;
}

export function spawnParkedCar(city, rng) {
  const types = ['sedan', 'taxi', 'van', 'sports'];
  const type = types[Math.floor(rng() * types.length)];
  const p = city.randomRoadPoint(rng);
  const axis = rng() < 0.5 ? 'x' : 'z';
  const off = (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 1.6);
  const x = axis === 'x' ? p.x : p.x + off;
  const z = axis === 'x' ? p.z + off : p.z;
  const angle = axis === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
  return makeCar(rng, type, x, z, angle, { parked: true });
}

// Traffic: cruise along its road line, wrap around the city edge.
export function stepTrafficCar(city, car, cars, dt) {
  if (car.playerDriven || car.chasing || car.parked) return;
  const def = CAR.types[car.type];
  car.speed = Math.min(car.speed + 4 * dt, def.top * 0.55);
  const step = car.speed * car.dir * dt;
  if (car.roadAxis === 'x') {
    car.x += step;
    if (car.x > WORLD.size / 2) car.x = -WORLD.size / 2;
    if (car.x < -WORLD.size / 2) car.x = WORLD.size / 2;
  } else {
    car.z += step;
    if (car.z > WORLD.size / 2) car.z = -WORLD.size / 2;
    if (car.z < -WORLD.size / 2) car.z = WORLD.size / 2;
  }
  syncCarMesh(car);
}

// Police chase: steer toward the player, ram speed slightly below player's top.
export function stepPoliceCar(city, car, targetX, targetZ, dt) {
  const def = CAR.types.police;
  const d = dist2(car.x, car.z, targetX, targetZ);
  const want = Math.atan2(targetX - car.x, targetZ - car.z);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -def.turn * dt, def.turn * dt);
  const targetSpeed = d > 30 ? def.top : def.top * 0.8;
  car.speed = Math.min(car.speed + def.accel * dt, targetSpeed);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const hit = city.collideCircle(car.x, car.z, 1.6);
  car.x = hit.x; car.z = hit.z;
  syncCarMesh(car);
  return d;
}

// Simple circle-vs-circle separation between cars (no full physics).
export function collideCars(cars, dt) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i]; const b = cars[j];
      if (a.parked && b.parked) continue;
      const dx = b.x - a.x; const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = 2.6;
      if (d > 0.001 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d; const nz = dz / d;
        if (!a.playerDriven) { a.x -= nx * push; a.z -= nz * push; }
        if (!b.playerDriven) { b.x += nx * push; b.z += nz * push; }
        if (a.playerDriven) a.speed *= 0.6;
        if (b.playerDriven) b.speed *= 0.6;
        syncCarMesh(a); syncCarMesh(b);
      }
    }
  }
}

export { angleLerp };
