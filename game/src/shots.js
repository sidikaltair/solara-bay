// Screenshot scenes behind ?shot=chase|foot|mission|dusk|start (with &seed=N).
// Each one stages the real game state — a car, police, pedestrians, a live
// mission — then lets the world simmer for a couple of seconds so traffic and
// peds settle into natural positions. The same seed always gives the same frame.
import { STEP } from './config.js';
import { makeCar, spawnTrafficCar } from './traffic.js';
import { makePed } from './peds.js';
import { addCrime } from './police.js';
import { startMission } from './missions.js';
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
    // Cover: sports car mid-chase down Pier Row, two SBPD cars behind,
    // 3 wanted stars, mission 3 banner up.
    const car = putPlayerInCar(G, 'sports', 1155, 825, 0);
    car.speed = 320;
    const cop1 = makeCar(G.rng, 'police', 1050, 843, 0, {});
    cop1.chasing = true; cop1.speed = 300;
    const cop2 = makeCar(G.rng, 'police', 990, 807, 0, {});
    cop2.chasing = true; cop2.speed = 290;
    G.policeCars.push(cop1, cop2);
    // startMission('heat') itself raises the heat to 3 stars via addCrime.
    startMission(G, 2); // "Lose the Heat" — the banner + objective show
    G.banner = { title: '3 — Lose the Heat', sub: 'The SBPD is all over you. Lose the 3-star heat!', until: 9999 };
  } else if (name === 'foot') {
    // On foot downtown: player on the sidewalk, peds + parked cars around,
    // mission 1 marker visible up the street.
    G.player.x = 860;
    G.player.y = 870;
    G.player.angle = -Math.PI / 2;
    startMission(G, 0);
    G.banner = { title: '1 — Wheels', sub: 'Mara needs a clean ride. Steal any car.', until: 9999 };
  } else if (name === 'mission') {
    // Mission in progress: driving the package run, waypoint ahead, timer live.
    const car = putPlayerInCar(G, 'sedan', 1155, 1155, -Math.PI / 2);
    car.speed = 280;
    startMission(G, 1); // Package Run, 90 s
    G.mission.timer = 74;
    G.banner = { title: '2 — Package Run', sub: 'North docks. 90 seconds. No stops.', until: 9999 };
  } else if (name === 'dusk') {
    // Golden hour on the beach road: sports car cruising west along the coast
    // toward the beach marker, sand and water in frame below the road.
    G.clockMinutes = 1090; // 18:10 — dusk tint
    G.timeOfDay = 'dusk';
    const car = putPlayerInCar(G, 'sports', 820, 2475, Math.PI);
    car.speed = 260;
    G.wanted.stars = 1;
    startMission(G, 4); // The Bay Job — escape to the beach
    G.mission.stage = 'escape';
    G.mission.target = { x: 495, y: 2475, label: 'Solara Beach' };
    G.banner = { title: '5 — The Bay Job', sub: 'The take is yours. Escape to Solara Beach!', until: 9999 };
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
  G.hud.update();
  return G.state;
}
