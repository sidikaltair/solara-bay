// Screenshot scenes behind ?shot=chase|foot|mission|dusk|start (with &seed=N).
// Each one stages the real game state — a car, police, pedestrians, a live
// mission — then lets the world simmer for a couple of seconds so traffic and
// peds settle into natural positions. The same seed always gives the same frame.
// NOTE: in shot mode the game loop never runs (runShot paints twice and stops),
// so everything staged here is frozen exactly as placed — muzzle flash,
// bullets, cops and police cars all stay put for the capture.
import { STEP } from './config.js';
import { makeCar, spawnTrafficCar } from './traffic.js';
import { makePed } from './peds.js';
import { addCrime } from './police.js';
import { startMission, missionTarget } from './missions.js';
import { stepTrafficCar } from './traffic.js';
import { stepPed } from './peds.js';

// Let traffic + peds move for `seconds` so the frame looks alive, not posed.
function simmer(G, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    G.time += STEP;
    for (const car of G.cars) stepTrafficCar(G.city, car, G.cars, STEP);
    for (const ped of G.peds) stepPed(G.city, ped, G.player, null, STEP);
  }
}

// Put the player in a car on a road, facing along it.
function putPlayerInCar(G, type, x, y, angle) {
  const car = makeCar(G.rng, type, x, y, angle, {});
  car.speed = 200;
  car.playerDriven = true; // the traffic AI must never steer the player's car
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

// Drop an SBPD interceptor at (x, y) already chasing the player.
function putPoliceCar(G, x, y, angle, speed) {
  const cop = makeCar(G.rng, 'police', x, y, angle, {});
  cop.chasing = true;
  cop.speed = speed ?? 300;
  G.policeCars.push(cop);
  return cop;
}

// Crowd the frame near (x, y) with a few traffic cars + pedestrians.
function spawnNear(G, x, y, cars, peds) {
  for (let i = 0; i < cars; i += 1) G.cars.push(spawnTrafficCar(G.city, G.rng, x, y));
  for (let i = 0; i < peds; i += 1) {
    G.peds.push(makePed(G.rng, G.city, x + (G.rng() - 0.5) * 420, y + (G.rng() - 0.5) * 300));
  }
}

function centreCamera(G) {
  const w = 1280;
  const h = 800;
  G.camera.x = Math.max(0, Math.min(2640 - w, G.player.x - w / 2));
  G.camera.y = Math.max(0, Math.min(2640 - h, G.player.y - h / 2));
}

export function stageShot(G, name) {
  G.state = 'playing';
  G.clockMinutes = 570; // 09:30, bright morning
  G.timeOfDay = 'day';
  // A busy downtown: extra traffic + pedestrians crowded near the player.
  const px = 1155;
  const py = 825;
  G.player.x = px;
  G.player.y = py;
  G.player.angle = 0;
  for (let i = 0; i < 6; i += 1) G.cars.push(spawnTrafficCar(G.city, G.rng, px, py));
  for (let i = 0; i < 10; i += 1) {
    const ped = makePed(G.rng, G.city, px + (G.rng() - 0.5) * 420, py + (G.rng() - 0.5) * 300);
    G.peds.push(ped);
  }

  if (name === 'chase') {
    // Cover: sports car mid-chase down Pier Row, FIVE SBPD cars in a tight
    // pack behind, 5 wanted stars, mission 3 banner up, $2,000 in pocket.
    const car = putPlayerInCar(G, 'sports', 1155, 825, 0);
    car.speed = 320;
    putPoliceCar(G, 900, 807, 0, 295);
    putPoliceCar(G, 990, 807, 0, 290);
    putPoliceCar(G, 1080, 807, 0, 305);
    putPoliceCar(G, 940, 843, 0, 300);
    putPoliceCar(G, 1030, 843, 0, 298);
    // startMission('heat') itself raises the heat to 3 stars via addCrime.
    startMission(G, 2); // "Lose the Heat" — the banner + objective show
    G.wanted.stars = 5;
    G.player.cash = 2000;
    G.banner = { title: '3 — Lose the Heat', sub: 'The SBPD is all over you. Lose the 5-star heat!', until: 9999 };
  } else if (name === 'foot') {
    // Foot shootout by the chop shop: player centred on foot, pistol out,
    // muzzle flash live + bullets in flight, two foot cops closing in,
    // a parked car right beside them, chop-shop waypoint in frame.
    G.player.x = 1980;
    G.player.y = 825;
    // Aim at the nearest cop (north-east of the player).
    G.player.angle = Math.atan2(770 - 825, 2100 - 1980);
    const parked = makeCar(G.rng, 'sedan', 1920, 855, 0, { parked: true });
    G.cars.push(parked);
    // A little traffic for life, but keep pedestrians AWAY from the player —
    // a crowd on top of the hero hides the shootout. Two peds, far out.
    spawnNear(G, 1980, 825, 3, 0);
    G.peds.push(makePed(G.rng, G.city, 1800, 680));
    G.peds.push(makePed(G.rng, G.city, 2180, 980));
    // Two foot cops closing in on the player.
    G.cops.push(
      { x: 2100, y: 770, angle: Math.atan2(825 - 770, 1980 - 2100), speed: 150, holdTimer: 0, cop: true },
      { x: 2070, y: 900, angle: Math.atan2(825 - 900, 1980 - 2070), speed: 150, holdTimer: 0, cop: true },
    );
    // Pistol firing: muzzle flash live + three bullets in flight toward cop 1.
    const a = G.player.angle;
    G.combat.muzzle = 0.08;
    for (const d of [70, 150, 240]) {
      G.bullets.push({
        x: G.player.x + Math.cos(a) * d,
        y: G.player.y + Math.sin(a) * d,
        vx: Math.cos(a) * 900,
        vy: Math.sin(a) * 900,
        life: 0.47,
      });
    }
    // A spark where a round just clipped the cop.
    G.particles.push({ x: 2100, y: 770, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffd34d', size: 5, spark: true });
    startMission(G, 0);
    G.wanted.stars = 2;
    G.banner = { title: '1 — Wheels', sub: 'Mara needs a clean ride. Steal any car.', until: 9999 };
  } else if (name === 'mission') {
    // "Getaway Driver" (mission 4): Dice picked up, driving east toward the
    // safehouse with 4 SBPD cars in pursuit, 17:00 warm light, $2,000.
    G.clockMinutes = 1020; // 17:00 — warm late light
    G.timeOfDay = 'dusk';
    const car = putPlayerInCar(G, 'sports', 1650, 1815, 0);
    car.speed = 320;
    putPoliceCar(G, 1400, 1797, 0, 300);
    putPoliceCar(G, 1520, 1797, 0, 295);
    putPoliceCar(G, 1440, 1833, 0, 305);
    putPoliceCar(G, 1560, 1833, 0, 290);
    spawnNear(G, 1650, 1815, 4, 6);
    startMission(G, 3); // "Getaway Driver" — pickup at the arcade
    // Dice is already in: retarget to the safehouse, heat jumps to 4 stars.
    G.mission.pickedUp = true;
    G.mission.target = { x: 2145, y: 1815, label: 'Safehouse' };
    addCrime(G, 2, 'Dice is in the car! The SBPD is onto you — GO!');
    G.wanted.stars = 4;
    G.player.cash = 2000;
    G.banner = { title: '4 — Getaway Driver', sub: 'Dice is in! Drive him to the Safehouse — 4 stars on your tail!', until: 9999 };
  } else if (name === 'dusk') {
    // Golden hour on the beach road: sports car centred, driving south down
    // the coast road toward the beach, FIVE SBPD cars in pursuit behind,
    // beach + water in the lower third, $3,100 (jobs 1–4 done) in pocket.
    G.clockMinutes = 1090; // 18:10 — dusk tint
    G.timeOfDay = 'dusk';
    const car = putPlayerInCar(G, 'sports', 820, 2240, Math.PI / 2);
    car.speed = 280;
    putPoliceCar(G, 807, 1980, Math.PI / 2, 300);
    putPoliceCar(G, 807, 2070, Math.PI / 2, 295);
    putPoliceCar(G, 807, 2160, Math.PI / 2, 305);
    putPoliceCar(G, 843, 2020, Math.PI / 2, 298);
    putPoliceCar(G, 843, 2110, Math.PI / 2, 290);
    spawnNear(G, 820, 2240, 4, 6);
    startMission(G, 4); // The Bay Job — escape to the beach
    G.mission.stage = 'escape';
    G.mission.target = { x: 495, y: 2475, label: 'Solara Beach' };
    G.wanted.stars = 5;
    G.player.cash = 3100;
    G.banner = { title: '5 — The Bay Job', sub: 'The take is yours. Every cop in Solara Bay is coming!', until: 9999 };
  } else {
    // 'start' (or anything else): the title screen over a living downtown.
    G.state = 'menu';
    G.player.x = 1155;
    G.player.y = 1155;
    G.clockMinutes = 1020; // 17:00, warm late light
    G.timeOfDay = 'dusk';
  }

  simmer(G, 2);
  centreCamera(G);
  // Show the mission waypoint diamond in the world (stepWorld never runs
  // in shot mode, so set it here or the marker never renders).
  G.missionTarget = missionTarget(G);
  G.hud.update();
  return G.state;
}
