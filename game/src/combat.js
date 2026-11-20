// Pistol combat: hitscan raycast from the camera, muzzle flash, tracer
// line, ammo + reload. Shooting a cop car disables it after 3 hits;
// shooting a pedestrian or a cop is a crime.
import * as THREE from 'three';
import { G, dist2D } from './state.js';
import { disableCar } from './car.js';
import { addWanted } from './police.js';

let raycaster = null;
let flash = null;        // muzzle flash mesh (a small bright plane + light)
let flashLight = null;
let flashT = 0;
let tracer = null;       // thin stretched box from gun to hit point
let tracerT = 0;
let cooldown = 0;
let reloadT = 0;

export function initCombat() {
  raycaster = new THREE.Raycaster();
  raycaster.far = 120;
  flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  flash.visible = false;
  G.scene.add(flash);
  flashLight = new THREE.PointLight(0xffc860, 0, 14);
  G.scene.add(flashLight);
  tracer = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 1),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.85 }));
  tracer.visible = false;
  G.scene.add(tracer);
}

function showFlash(from, to) {
  flash.position.copy(from).add(new THREE.Vector3(0, 0.05, 0));
  flash.lookAt(G.camera.position);
  flash.visible = true;
  flashLight.position.copy(from);
  flashLight.intensity = 22;
  flashT = 0.09;
  // Tracer: stretch a thin box between the two points.
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  tracer.position.copy(from).addScaledVector(dir, 0.5);
  tracer.lookAt(to);
  tracer.scale.set(1, 1, len);
  tracer.visible = true;
  tracerT = 0.16;
}

function gunTip() {
  const p = G.player;
  if (!p) return new THREE.Vector3(0, 1.4, 0);
  const dir = new THREE.Vector3(Math.sin(p.angle), 0, Math.cos(p.angle));
  return new THREE.Vector3(p.x + dir.x * 0.7, 1.45, p.z + dir.z * 0.7);
}

export function shoot() {
  const p = G.player;
  if (!p || G.mode !== 'foot' || G.paused) return false;
  if (cooldown > 0 || reloadT > 0) return false;
  if (G.ammo <= 0) { startReload(); return false; }
  cooldown = 0.22;
  G.ammo -= 1;

  // Aim from the camera through the crosshair.
  raycaster.setFromCamera(new THREE.Vector2(0, 0), G.camera);
  const targets = [];
  for (const c of G.cars) if (!c.disabled) targets.push(c.mesh);
  for (const cop of G.footCops) targets.push(cop.mesh);
  for (const ped of G.peds) targets.push(ped.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  const tip = gunTip();
  let end;
  if (hits.length > 0) {
    const h = hits[0];
    end = h.point.clone();
    // Walk up to the object root to find what we hit.
    let obj = h.object;
    while (obj.parent && obj.parent !== G.scene) obj = obj.parent;
    const car = G.cars.find(c => c.mesh === obj);
    if (car) {
      if (car.police) {
        car.health -= 1;
        if (car.health <= 0) disableCar(car);
      }
      addWanted(1);
    } else {
      const cop = G.footCops.find(c => c.mesh === obj);
      const ped = G.peds.find(pd => pd.mesh === obj);
      if (cop) {
        G.scene.remove(cop.mesh);
        G.footCops.splice(G.footCops.indexOf(cop), 1);
        addWanted(1);
      } else if (ped) {
        ped.flee = true;
        addWanted(2);
      }
    }
  } else {
    end = raycaster.ray.at(60, new THREE.Vector3());
  }
  showFlash(tip, end);
  return true;
}

export function startReload() {
  if (reloadT > 0 || G.ammo === G.maxAmmo) return;
  reloadT = 1.1;
}

export function updateCombat(dt) {
  cooldown = Math.max(0, cooldown - dt);
  if (reloadT > 0) {
    reloadT -= dt;
    if (reloadT <= 0) G.ammo = G.maxAmmo;
  }
  if (flashT > 0) {
    flashT -= dt;
    if (flashT <= 0 && G.shot === 0) {
      flash.visible = false;
      flashLight.intensity = 0;
    }
  }
  if (tracerT > 0) {
    tracerT -= dt;
    if (tracerT <= 0 && G.shot === 0) tracer.visible = false;
  }
  // In screenshot mode the flash + tracer stay visible for the capture.
}

// Pedestrians: a few walkers on the sidewalks who flee from gunfire.
export function initPeds(n) {
  const spots = [[-40, 20], [60, -60], [-120, 100], [140, 40], [20, -140], [-180, -40]];
  for (let i = 0; i < n; i++) {
    const [x, z] = spots[i % spots.length];
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: [0xc2543a, 0x3a7ac2, 0x54a34a, 0xd8b13c][i % 4] });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.7, 4, 8), shirt);
    body.position.y = 1.2; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98d5f }));
    head.position.y = 1.95; g.add(head);
    g.position.set(x, 0, z);
    G.scene.add(g);
    G.peds.push({
      mesh: g, x, z,
      angle: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 0.8,
      flee: false,
      turnT: 0,
    });
  }
}

export function updatePeds(dt) {
  for (const ped of G.peds) {
    ped.turnT -= dt;
    if (ped.turnT <= 0) {
      ped.angle += (Math.random() - 0.5) * 1.6;
      ped.turnT = 2 + Math.random() * 3;
    }
    const sp = ped.flee ? 5 : ped.speed;
    const nx = ped.x + Math.sin(ped.angle) * sp * dt;
    const nz = ped.z + Math.cos(ped.angle) * sp * dt;
    if (Math.abs(nx) < 320 && Math.abs(nz) < 320) { ped.x = nx; ped.z = nz; }
    else ped.angle += Math.PI;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.angle;
    if (ped.flee) ped.flee = dist2D(ped.x, ped.z, G.player.x, G.player.z) < 40;
  }
}
