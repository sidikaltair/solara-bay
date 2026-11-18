// Screenshot scenes behind ?shot=chase|foot|mission|dusk (with &seed=N).
// Each one stages the real game state — a car, police, pedestrians, a live
// mission — then lets the world simmer so traffic and peds settle into
// natural positions. The same seed always gives the same frame.
import { STEP } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './peds.js';
import { startMission } from './missions.js';
import { stepTrafficCar } from './vehicles.js';
import { stepPed } from './peds.js';

// Let traffic + peds move for `seconds` so the frame looks alive, not posed.
function simmer(G, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    G.time += STEP;
    for (const car of G.cars) stepTrafficCar(G.city, car, G.cars, STEP);
    for (const ped of G.peds) stepPed(G.city, ped, G.player, null, STEP);
  }
}

function putPlayerInCar(G, type, x, z, angle) {
  const car = makeCar(G.rng, type, x, z, angle, {});
  car.speed = 22;
  car.playerDriven = true;
  G.cars.push(car);
  G.scene.add(car.mesh);
  G.player.car = car;
  G.player.mesh.visible = false;
  G.player.x = x; G.player.z = z; G.player.angle = angle;
  return car;
}

function addCopBehind(G, x, z, angle, speed) {
  const cop = makeCar(G.rng, 'police', x, z, angle, {});
  cop.chasing = true;
  cop.speed = speed;
  G.policeCars.push(cop);
  G.scene.add(cop.mesh);
  return cop;
}

function aimCamera(G, yawOffset = 0, dist = 9.5) {
  // Camera sits behind the player's facing direction and stays put.
  // A small yaw offset gives a 3/4 rear view so the player car and the
  // trailing police are both visible in frame.
  G.camYaw = G.player.angle + Math.PI + yawOffset;
  G.camPitch = 0.3;
  G.camDist = dist;
  G.camFollowPause = 9999;
}

export function stageShot(G, name) {
  G.state = 'playing';
  G.clockMinutes = 570; // 09:30, bright morning
  G.timeOfDay = 'day';
  G.city.setTimeOfDay('day');
  // A busy downtown: extra traffic + pedestrians crowded near the player.
  const px = -41; const pz = -41; // downtown crossroads
  G.player.x = px; G.player.z = pz; G.player.angle = Math.PI / 2; // facing east
  for (let i = 0; i < 6; i += 1) {
    const car = makeCar(G.rng, ['sedan', 'taxi', 'van'][i % 3], px + (G.rng() - 0.5) * 90, pz + (G.rng() - 0.5) * 60, (G.rng() < 0.5 ? 0 : Math.PI / 2), { roadAxis: 'x', roadLine: pz, dir: 1 });
    car.speed = 12;
    G.cars.push(car); G.scene.add(car.mesh);
  }
  for (let i = 0; i < 10; i += 1) {
    // Peds ahead of the player (east) — never between the camera and the player.
    const ped = makePed(G.rng, G.city, px + 8 + G.rng() * 55, pz + (G.rng() - 0.5) * 56);
    G.peds.push(ped); G.scene.add(ped.mesh);
  }
  G.player.cash = 2000;

  if (name === 'chase') {
    // Cover: sports car mid-chase down Pier Row. Cops in a V around the
    // player (ahead-left, behind-left, behind-right) so all three are in
    // frame — trailing directly behind puts them behind the camera.
    const car = putPlayerInCar(G, 'sports', -41, -41, Math.PI / 2);
    car.speed = 34;
    addCopBehind(G, -28, -52, Math.PI / 2, 32);
    addCopBehind(G, -50, -54, Math.PI / 2, 30);
    addCopBehind(G, -50, -28, Math.PI / 2, 29);
    startMission(G, 2); // "Lose the Heat" — 3 stars + banner
    G.banner = { title: '3 — Lose the Heat', sub: 'The SBPD is all over you. Lose the 3-star heat!', until: 9999 };
    aimCamera(G, -0.35, 14);
  } else if (name === 'foot') {
    // On foot downtown: player on the street edge, peds + parked cars around,
    // mission 1 marker visible up the street.
    G.player.x = -52; G.player.z = -38;
    G.player.angle = Math.PI / 2;
    const parked = makeCar(G.rng, 'sedan', -46, -24, Math.PI / 2, { parked: true });
    G.cars.push(parked); G.scene.add(parked.mesh);
    startMission(G, 0);
    G.banner = { title: '1 — Wheels', sub: 'Mara needs a clean ride. Steal any car.', until: 9999 };
    aimCamera(G, 0.2, 9.5);
  } else if (name === 'mission') {
    // Getaway Driver: Dice picked up, 4-star chase toward the safehouse.
    const car = putPlayerInCar(G, 'sports', -124, -41, Math.PI / 2);
    car.speed = 30;
    addCopBehind(G, -111, -52, Math.PI / 2, 30);
    addCopBehind(G, -133, -54, Math.PI / 2, 29);
    addCopBehind(G, -133, -28, Math.PI / 2, 28);
    startMission(G, 3);
    G.mission.pickedUp = true;
    G.mission.target = { x: 206, z: 124, label: 'Safehouse' };
    G.wanted.stars = 4;
    G.banner = { title: '4 — Getaway Driver', sub: 'Dice is in! Drive him to the Safehouse.', until: 9999 };
    aimCamera(G, -0.35, 14);
  } else if (name === 'dusk') {
    // The Bay Job at golden hour: beach + water behind, 5-star heat.
    G.clockMinutes = 1090; // 18:10
    G.timeOfDay = 'dusk';
    G.city.setTimeOfDay('dusk');
    const car = putPlayerInCar(G, 'sports', -206, 300, -Math.PI / 2);
    car.speed = 26;
    // Player faces west; cops close in from ahead and both flanks.
    addCopBehind(G, -222, 300, -Math.PI / 2, 26);
    addCopBehind(G, -196, 312, -Math.PI / 2, 25);
    addCopBehind(G, -196, 288, -Math.PI / 2, 25);
    startMission(G, 4);
    G.mission.stage = 'escape';
    G.mission.target = { x: -206, z: 289, label: 'Solara Beach' };
    G.wanted.stars = 5;
    G.banner = { title: '5 — The Bay Job', sub: 'Every cop in Solara Bay will be coming.', until: 9999 };
    aimCamera(G, -0.3, 14);
  }
  simmer(G, 2);
}
