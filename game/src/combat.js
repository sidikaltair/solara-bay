// Combat: pistol hitscan toward the camera crosshair, with a tracer line,
// muzzle flash light, and simple damage to police cars / foot cops.
import * as THREE from '../vendor/three.module.js';
import { COMBAT } from './config.js';
import { dist2 } from './util.js';

export function makeCombat() {
  return { cooldown: 0, muzzleUntil: 0 };
}

export function updateCombat(G, dt) {
  const c = G.combat;
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.muzzleUntil > 0 && G.time > c.muzzleUntil && G.muzzleLight) {
    G.muzzleLight.intensity = 0;
  }
}

// Fire the pistol at the crosshair. Returns true if a shot was fired.
export function firePistol(G, camera) {
  const p = G.player;
  const c = G.combat;
  if (p.car || c.cooldown > 0 || p.ammo <= 0) return false;
  c.cooldown = COMBAT.pistolCooldown;
  p.ammo -= 1;
  G.audio.shot();
  // Ray from the camera through the screen centre.
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  ray.far = COMBAT.pistolRange;
  // Find the closest police car / cop the ray passes near (cylinder test).
  let best = null; let bestT = Infinity;
  const origin = ray.ray.origin;
  const dir = ray.ray.direction;
  const targets = [];
  for (const car of G.policeCars) targets.push({ x: car.x, z: car.z, r: 2.2, kind: 'car', ref: car });
  for (const cop of G.cops) targets.push({ x: cop.x, z: cop.z, r: 0.9, kind: 'cop', ref: cop });
  for (const t of targets) {
    // Closest approach of the ray to the target centre (y ~1).
    const px = t.x - origin.x; const pz = t.z - origin.z; const py = 1 - origin.y;
    const tt = px * dir.x + py * dir.y + pz * dir.z;
    if (tt < 0 || tt > bestT) continue;
    const cx = origin.x + dir.x * tt; const cy = origin.y + dir.y * tt; const cz = origin.z + dir.z * tt;
    const d = Math.hypot(cx - t.x, cy - 1, cz - t.z);
    if (d < t.r) { best = t; bestT = tt; }
  }
  const end = best ? new THREE.Vector3(best.x, 1, best.z) : ray.ray.at(Math.min(COMBAT.pistolRange, bestT === Infinity ? COMBAT.pistolRange : bestT), new THREE.Vector3());
  // Tracer.
  const start = new THREE.Vector3(p.x, 1.6, p.z);
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers.push({ line, until: G.time + 0.08 });
  // Muzzle flash.
  if (G.muzzleLight) {
    G.muzzleLight.position.set(p.x + Math.sin(p.angle) * 1.2, 1.6, p.z + Math.cos(p.angle) * 1.2);
    G.muzzleLight.intensity = 6;
    c.muzzleUntil = G.time + 0.06;
  }
  if (best) {
    if (best.kind === 'cop') {
      best.ref.health -= COMBAT.pistolDamage;
      if (best.ref.health <= 0) {
        best.ref.dead = true;
        G.scene.remove(best.ref.mesh);
        G.cops = G.cops.filter((cp) => cp !== best.ref);
      }
    } else {
      // Shooting a police car slows it and enrages it; it does not explode.
      best.ref.speed *= 0.5;
    }
    G.toast('Hit!', 1);
  }
  return true;
}

// A foot cop: simple chaser that bumps the player on foot.
export function makeCop(x, z) {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), dark);
  torso.position.y = 1.35; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 2.12;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), new THREE.MeshLambertMaterial({ color: 0x0d1420 }));
  cap.position.y = 2.42;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), dark);
  legL.position.set(-0.22, 0.45, 0);
  g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22;
  g.add(legR);
  g.position.set(x, 0, z);
  return { x, z, angle: 0, health: 100, mesh: g, dead: false, phase: Math.random() * 6 };
}

export function stepCop(G, cop, dt) {
  const p = G.player;
  const d = dist2(cop.x, cop.z, p.x, p.z);
  if (d > 0.5) {
    const want = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.angle = want;
    cop.x += Math.sin(want) * 5.5 * dt;
    cop.z += Math.cos(want) * 5.5 * dt;
    const hit = G.city.collideCircle(cop.x, cop.z, 0.9);
    cop.x = hit.x; cop.z = hit.z;
    cop.phase += dt * 9;
    const swing = Math.sin(cop.phase) * 0.5;
    cop.mesh.children[3].rotation.x = swing;
    cop.mesh.children[4].rotation.x = -swing;
  }
  cop.mesh.position.set(cop.x, 0, cop.z);
  cop.mesh.rotation.y = cop.angle;
}
