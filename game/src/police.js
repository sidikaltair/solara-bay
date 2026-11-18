// Wanted + police: stars rise on crimes, SBPD cars spawn and chase (ram + block),
// foot cops chase you on foot, and a long quiet stretch lets the heat die down.
// Busted happens when a foot cop holds onto you; wasted when your health hits 0.
import { WANTED } from './config.js';
import { makeCar } from './traffic.js';

export function makeWanted() {
  return {
    stars: 0,
    quietTimer: 0,     // seconds since the last crime
    decayTimer: 0,     // counts down to losing one star
    lastCrimeAt: -999,
  };
}

export function addCrime(G, stars, reason) {
  const w = G.wanted;
  w.stars = Math.min(WANTED.max, w.stars + stars);
  w.quietTimer = 0;
  w.decayTimer = 0;
  w.lastCrimeAt = G.time;
  G.toast(reason, 2.2);
  G.audio.siren(w.stars > 0);
}

// Spawn / maintain the police presence for the current wanted level.
export function updatePolice(G, dt) {
  const w = G.wanted;
  const player = G.player;
  w.quietTimer += dt;

  // Heat decay: quiet + no police close by -> lose a star every few seconds.
  const nearestPolice = nearestPoliceDist(G);
  if (w.stars > 0 && w.quietTimer > WANTED.decayQuietSeconds && nearestPolice > 420) {
    w.decayTimer += dt;
    if (w.decayTimer >= WANTED.decayPerStarSeconds) {
      w.stars -= 1;
      w.decayTimer = 0;
      if (w.stars === 0) {
        G.toast('You lost them. The heat is off — for now.', 3);
        G.audio.siren(false);
      }
    }
  } else {
    w.decayTimer = 0;
  }

  // Police cars: keep the count matched to the stars.
  const wantCars = WANTED.policeCarsPerStar[w.stars];
  G.spawnTimer -= dt;
  if (G.policeCars.length < wantCars && G.spawnTimer <= 0) {
    G.spawnTimer = 1.2;
    const car = spawnPoliceCar(G);
    if (car) G.policeCars.push(car);
  }
  // Despawn police cars that fell far behind once the heat is gone.
  if (w.stars === 0) {
    for (const car of G.policeCars) car.despawn = true;
  }

  // Foot cops: only while on foot and wanted >= 2, at most 3 at once.
  if (w.stars >= 2 && !player.car && G.cops.length < 3 && Math.random() < dt * 0.5) {
    const a = Math.random() * Math.PI * 2;
    G.cops.push({
      x: player.x + Math.cos(a) * 320, y: player.y + Math.sin(a) * 320,
      angle: 0, speed: 150, holdTimer: 0, cop: true,
    });
  }

  // Chase each police car toward the player.
  for (const car of G.policeCars) {
    chaseCar(G, car, dt);
  }
  // Foot cops run at the player; holding on busts you.
  for (const cop of G.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 26) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.holdTimer = 0;
    } else {
      cop.holdTimer += dt;
      if (cop.holdTimer >= WANTED.bustTouchSeconds) {
        G.busted = true;
      }
    }
    G.city.collideCircle(cop, 11);
  }
  // Cops give up once the heat is fully gone.
  if (w.stars === 0) G.cops.length = 0;
}

function nearestPoliceDist(G) {
  let best = Infinity;
  for (const car of G.policeCars) {
    best = Math.min(best, Math.hypot(car.x - G.player.x, car.y - G.player.y));
  }
  for (const cop of G.cops) {
    best = Math.min(best, Math.hypot(cop.x - G.player.x, cop.y - G.player.y));
  }
  return best;
}

function spawnPoliceCar(G) {
  // Spawn on a road 500–700 px from the player, roughly behind the chase.
  const a = Math.random() * Math.PI * 2;
  const d = 560 + Math.random() * 160;
  const px = G.player.x + Math.cos(a) * d;
  const py = G.player.y + Math.sin(a) * d;
  const p = G.city.randomRoadPoint(px, py, 700);
  const car = makeCar(G.rng, 'police', p.x, p.y, 0, { traffic: false });
  car.chasing = true;
  car.speed = 200;
  return car;
}

// A police car steers straight at the player and rams; a hard ram slows both.
function chaseCar(G, car, dt) {
  const player = G.player;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnRate = 2.4;
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  const target = Math.min(car.spec.top, 300 + G.wanted.stars * 24);
  car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.lightPhase += dt * 9;
  const hitWall = G.city.collideCar(car, car.spec.len / 2 - 4);
  if (hitWall) car.speed *= 0.6;
  // Ram the player's car.
  if (player.car && dist < (car.spec.len + player.car.spec.len) / 2 - 4) {
    const push = 60 * dt;
    player.car.x += Math.cos(car.angle) * push * 8;
    player.car.y += Math.sin(car.angle) * push * 8;
    player.car.speed *= 0.94;
    car.speed *= 0.7;
    if (Math.abs(player.car.speed) > 60) G.audio.crash();
    G.particles.push({ x: player.car.x, y: player.car.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffd34d', size: 5, spark: true });
  }
  // Ram the player on foot: a hard hit hurts.
  if (!player.car && dist < 30 && player.invulnerable <= 0) {
    player.health -= 18;
    player.invulnerable = 1;
    player.x += Math.cos(car.angle) * 40;
    player.y += Math.sin(car.angle) * 40;
    G.audio.crash();
    G.toast('Run over by the SBPD!', 2);
    if (player.health <= 0) G.wasted = true;
  }
}
