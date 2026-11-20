// Police + wanted level. Wanted 0-5. Police cars spawn on nearby roads and
// chase the player; at wanted >= 3 foot cops also close in on foot. Wanted
// decays when the player stays clean and out of sight for a while.
import * as THREE from 'three';
import { G, clamp, dist2D } from './state.js';
import { makeCar, driveAI, disableCar } from './car.js';

const ROAD_LINES = [-275, -165, -55, 55, 165, 275];

export function addWanted(n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.lastCrimeAt = G.time;
}

function wantedPoliceCount() {
  if (G.wanted <= 0) return 0;
  if (G.wanted <= 2) return 1;
  if (G.wanted === 3) return 2;
  if (G.wanted === 4) return 3;
  return 4;
}

function spawnPoliceCar() {
  const p = G.player;
  // Pick a road point 60-110 units away from the player.
  const road = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
  const along = clamp(p.z + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50), -280, 280);
  const horizontal = Math.random() < 0.5;
  const x = horizontal ? clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50), -280, 280) : road;
  const z = horizontal ? road : along;
  const car = makeCar({
    x, z,
    angle: Math.atan2(p.x - x, p.z - z),
    police: true, driver: 'police',
  });
  car.maxSpeed = 25 + G.wanted;
  return car;
}

function makeFootCop(x, z) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d2f55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 8), navy);
  body.position.y = 1.25; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 2.05; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12),
    new THREE.MeshLambertMaterial({ color: 0x0d1b33 }));
  cap.position.y = 2.28; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), navy);
  legL.position.set(-0.2, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2; g.add(legR);
  g.position.set(x, 0, z);
  G.scene.add(g);
  const cop = { mesh: g, x, z, angle: 0, shootT: 0, walkT: Math.random() * 6 };
  G.footCops.push(cop);
  return cop;
}

export function spawnFootCop(x, z) {
  return makeFootCop(x, z);
}

function removeFootCop(cop) {
  G.scene.remove(cop.mesh);
  const i = G.footCops.indexOf(cop);
  if (i >= 0) G.footCops.splice(i, 1);
}

export function updatePolice(dt) {
  const p = G.player;
  if (!p) return;
  const px = p.car ? p.car.x : p.x;
  const pz = p.car ? p.car.z : p.z;

  // --- wanted decay: clean for 20s and no cop nearby -> -1 star per 10s ---
  const nearCop = G.police.some(c => !c.disabled && dist2D(px, pz, c.x, c.z) < 40)
    || G.footCops.some(c => dist2D(px, pz, c.x, c.z) < 30);
  if (G.wanted > 0 && G.time - G.lastCrimeAt > 20 && !nearCop) {
    G._decayT = (G._decayT || 0) + dt;
    if (G._decayT > 10) { G.wanted -= 1; G._decayT = 0; }
  } else {
    G._decayT = 0;
  }

  // --- keep the right number of police cars ---
  const want = wantedPoliceCount();
  const active = G.police.filter(c => !c.disabled);
  if (active.length < want) {
    spawnPoliceCar();
  } else if (active.length > want && G.wanted === 0) {
    // Wanted cleared: the extra cars drive off (just remove the farthest).
    let far = null, farD = -1;
    for (const c of active) {
      const d = dist2D(px, pz, c.x, c.z);
      if (d > farD) { farD = d; far = c; }
    }
    if (far) {
      G.scene.remove(far.mesh);
      G.cars.splice(G.cars.indexOf(far), 1);
      G.police.splice(G.police.indexOf(far), 1);
    }
  }

  // --- chase ---
  for (const car of G.police) {
    if (car.disabled) continue;
    driveAI(car, dt, px, pz, car.maxSpeed);
    // Ramming the player's car hurts it a little; on foot, a close cop car
    // pressures the player (health chip) — the arrest clock.
    const d = dist2D(px, pz, car.x, car.z);
    if (G.mode === 'foot' && d < 4.5) {
      car._pressT = (car._pressT || 0) + dt;
      if (car._pressT > 1.2) {
        G.health = Math.max(0, G.health - 4);
        car._pressT = 0;
        addWanted(0); // refreshes nothing, keeps wanted visible
      }
    } else {
      car._pressT = 0;
    }
    if (G.mode === 'drive' && d < 3.2 && Math.abs(car.speed) > 4) {
      // Ram: slow the player car down hard.
      if (p.car) p.car.speed *= 0.55;
      G.health = Math.max(0, G.health - 2);
    }
  }

  // --- foot cops at wanted >= 3 while on foot ---
  if (G.wanted >= 3 && G.mode === 'foot') {
    if (G.footCops.length < 2) {
      const a = Math.random() * Math.PI * 2;
      makeFootCop(px + Math.cos(a) * 26, pz + Math.sin(a) * 26);
    }
  } else if (G.wanted < 3) {
    while (G.footCops.length > 0) removeFootCop(G.footCops[0]);
  }
  for (const cop of [...G.footCops]) {
    const d = dist2D(px, pz, cop.x, cop.z);
    const want = Math.atan2(px - cop.x, pz - cop.z);
    cop.angle += (want - cop.angle) * Math.min(1, dt * 4);
    if (d > 10) {
      cop.x += Math.sin(cop.angle) * 3.4 * dt;
      cop.z += Math.cos(cop.angle) * 3.4 * dt;
      cop.walkT += dt * 8;
    } else {
      // In range: shoot at the player once a second.
      cop.shootT += dt;
      if (cop.shootT > 1.1) {
        cop.shootT = 0;
        G.health = Math.max(0, G.health - 5);
      }
    }
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.angle;
  }
}
