// Wanted system + police spawning. Stars 0-5; crimes raise them, they decay
// when the player stays out of trouble. Police cars chase and ram.
import { WANTED } from './config.js';
import { makeCar, stepPoliceCar } from './vehicles.js';
import { dist2 } from './util.js';

export function makeWanted() {
  return { stars: 0, quietTimer: 0, decayTimer: 0 };
}

export function addCrime(G, stars, message) {
  const w = G.wanted;
  w.stars = Math.min(WANTED.max, w.stars + stars);
  w.quietTimer = 0;
  w.decayTimer = 0;
  if (message) G.toast(message, 4);
  G.audio.siren();
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const target = WANTED.policeCarsPerStar[w.stars];
  // Spawn / despawn police cars to match the wanted level.
  while (G.policeCars.length < target) {
    const a = Math.random() * Math.PI * 2;
    const d = 55 + Math.random() * 25;
    const x = G.player.x + Math.sin(a) * d;
    const z = G.player.z + Math.cos(a) * d;
    const snapped = G.city.nearestRoadPoint(x, z);
    const car = makeCar(G.rng, 'police', snapped.x, snapped.z, Math.atan2(G.player.x - snapped.x, G.player.z - snapped.z), {});
    car.chasing = true;
    car.speed = 20;
    G.policeCars.push(car);
    G.scene.add(car.mesh);
  }
  while (G.policeCars.length > target) {
    const car = G.policeCars.pop();
    G.scene.remove(car.mesh);
  }
  // Chase.
  for (const car of G.policeCars) {
    stepPoliceCar(G.city, car, G.player.x, G.player.z, dt);
  }
  // Busted: a police car touching the player on foot for long enough.
  if (!G.player.car && w.stars > 0) {
    let touching = false;
    for (const car of G.policeCars) {
      if (dist2(car.x, car.z, G.player.x, G.player.z) < 3) { touching = true; break; }
    }
    G.bustTimer = touching ? (G.bustTimer || 0) + dt : 0;
    if (G.bustTimer > WANTED.bustTouchSeconds) {
      G.bustTimer = 0;
      G.busted = true;
      G.state = 'busted';
    }
  } else {
    G.bustTimer = 0;
  }
  // Decay: quiet + no police close -> stars fall one at a time.
  const nearest = G.policeCars.reduce((m, c) => Math.min(m, dist2(c.x, c.z, G.player.x, G.player.z)), Infinity);
  if (w.stars > 0) {
    if (nearest > 45) {
      w.quietTimer += dt;
      if (w.quietTimer > WANTED.decayQuietSeconds) {
        w.decayTimer += dt;
        if (w.decayTimer > WANTED.decayPerStarSeconds) {
          w.stars -= 1;
          w.decayTimer = 0;
          w.quietTimer = 0;
        }
      }
    } else {
      w.quietTimer = 0;
      w.decayTimer = 0;
    }
  }
}
