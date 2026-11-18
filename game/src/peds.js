// Pedestrians: low-poly walkers on the sidewalks, fleeing from gunshots and
// speeding cars. Cheap, varied, and they make the streets feel alive.
import * as THREE from '../vendor/three.module.js';
import { dist2 } from './util.js';

const SHIRTS = [0xd84f4f, 0x4f7ad8, 0x7ad84f, 0xd8b84f, 0x9a5fd8, 0xe8e8e8, 0x3a3f46];
const PANTS = [0x2a3442, 0x5a4a3a, 0x3a3f46, 0x6a5a7a];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)] });
  const skin = new THREE.MeshLambertMaterial({ color: [0xc98a5a, 0x8a5a3a, 0xe8b88a][Math.floor(rng() * 3)] });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.42), shirt);
  torso.position.y = 1.3; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skin);
  head.position.y = 2.05;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.34), pants);
  legL.position.set(-0.2, 0.42, 0);
  g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.2;
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function makePed(rng, city, x, z) {
  const p = city.randomRoadPoint(rng);
  const ped = {
    x: x ?? p.x, z: z ?? p.z,
    angle: rng() * Math.PI * 2,
    speed: 1.6 + rng() * 1.4,
    mesh: makePedMesh(rng),
    phase: rng() * 6,
    flee: 0,
    target: null,
  };
  ped.mesh.position.set(ped.x, 0, ped.z);
  return ped;
}

export function stepPed(city, ped, player, gunshotAt, dt) {
  // Flee from gunshots or a speeding car close by.
  if (gunshotAt && dist2(ped.x, ped.z, gunshotAt.x, gunshotAt.z) < 30) ped.flee = 3;
  if (player.car && dist2(ped.x, ped.z, player.x, player.z) < 12 && Math.abs(player.car.speed) > 15) ped.flee = 2;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = Math.atan2(ped.x - player.x, ped.z - player.z);
    ped.angle = away;
    ped.x += Math.sin(away) * 5 * dt;
    ped.z += Math.cos(away) * 5 * dt;
  } else {
    // Wander: pick a new heading now and then, stay near roads.
    if (!ped.target || dist2(ped.x, ped.z, ped.target.x, ped.target.z) < 4 || Math.random() < 0.002) {
      const p = city.randomRoadPoint(Math.random);
      ped.target = p;
    }
    const want = Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z);
    ped.angle = want;
    ped.x += Math.sin(want) * ped.speed * dt;
    ped.z += Math.cos(want) * ped.speed * dt;
  }
  const hit = city.collideCircle(ped.x, ped.z, 0.8);
  ped.x = hit.x; ped.z = hit.z;
  ped.phase += dt * (ped.flee > 0 ? 11 : 6);
  const swing = Math.sin(ped.phase) * 0.5;
  ped.mesh.userData.legL.rotation.x = swing;
  ped.mesh.userData.legR.rotation.x = -swing;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.angle;
}
