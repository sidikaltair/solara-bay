// Cars: traffic AI, parked cars, car types and the car physics the player drives.
// Traffic cars keep to a lane, slow for the car ahead, and turn at intersections;
// the player's car uses the same body with arcade steering.
import { CAR, WORLD } from './config.js';
import { pick, range } from './random.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'van', 'sports', 'truck', 'sedan', 'taxi'];

export function makeCar(rng, type, x, y, angle, opts = {}) {
  const spec = CAR.types[type];
  return {
    type, x, y, angle,
    speed: opts.speed ?? 0,
    spec,
    police: type === 'police',
    parked: opts.parked ?? false,
    traffic: opts.traffic ?? false,
    laneDir: opts.laneDir ?? 1,      // +1 / -1 along its road
    axis: opts.axis ?? 'h',          // 'h' or 'v' road it follows
    targetSpeed: opts.targetSpeed ?? range(rng, 90, 150),
    turnCooldown: 0,
    hitCooldown: 0,
    lightPhase: rng() * Math.PI * 2, // police light-bar blink phase
    hue: opts.hue ?? null,
  };
}

// Spawn a traffic car on a road near (fx, fy).
export function spawnTrafficCar(city, rng, fx, fy) {
  const p = city.randomRoadPoint(fx, fy, 900);
  const axis = city.roadAxis(p.x, p.y);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = 18;
  let x = p.x;
  let y = p.y;
  let angle = 0;
  if (axis === 'h' || axis === 'cross') {
    y = city.nearestRoadCenter(p.y) + (dir > 0 ? lane : -lane);
    angle = dir > 0 ? 0 : Math.PI;
  } else {
    x = city.nearestRoadCenter(p.x) + (dir > 0 ? -lane : lane);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = makeCar(rng, pick(rng, TRAFFIC_TYPES), x, y, angle, {
    traffic: true, axis: axis === 'v' ? 'v' : 'h', laneDir: dir,
  });
  car.speed = car.targetSpeed;
  return car;
}

// A parked car hugging the kerb of a road.
export function spawnParkedCar(city, rng) {
  const p = city.randomRoadPoint();
  const axis = city.roadAxis(p.x, p.y);
  const dir = rng() < 0.5 ? 1 : -1;
  let x = p.x;
  let y = p.y;
  let angle = 0;
  if (axis === 'h' || axis === 'cross') {
    y = city.nearestRoadCenter(p.y) + (dir > 0 ? 30 : -30);
    angle = dir > 0 ? 0 : Math.PI;
  } else {
    x = city.nearestRoadCenter(p.x) + (dir > 0 ? -30 : 30);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  return makeCar(rng, pick(rng, TRAFFIC_TYPES), x, y, angle, { parked: true });
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// One traffic step: lane-keep, yield to the car ahead, turn at intersections.
export function stepTrafficCar(city, car, cars, dt) {
  // Parked cars and the car the player is driving are not traffic.
  if (car.parked || car.playerDriven) return;
  const { roadCenters, roadWidth } = WORLD;
  const halfRoad = roadWidth / 2;
  car.turnCooldown -= dt;
  // Where the lane centre is for this car's road.
  let laneX = car.x;
  let laneY = car.y;
  let wantAngle = car.angle;
  if (car.axis === 'h') {
    const cy = city.nearestRoadCenter(car.y);
    laneY = cy + (car.laneDir > 0 ? 18 : -18);
    wantAngle = car.laneDir > 0 ? 0 : Math.PI;
  } else {
    const cx = city.nearestRoadCenter(car.x);
    laneX = cx + (car.laneDir > 0 ? -18 : 18);
    wantAngle = car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  // At an intersection, sometimes turn onto the crossing road.
  const nearCross = Math.min(
    ...roadCenters.map((c) => Math.abs((car.axis === 'h' ? car.x : car.y) - c)),
  );
  if (nearCross < 26 && car.turnCooldown <= 0 && Math.random() < 0.012) {
    car.axis = car.axis === 'h' ? 'v' : 'h';
    car.laneDir = Math.random() < 0.5 ? 1 : -1;
    car.turnCooldown = 4;
  }
  // Yield: slow down when another car is close ahead.
  let desired = car.targetSpeed;
  const aheadX = car.x + Math.cos(car.angle) * 46;
  const aheadY = car.y + Math.sin(car.angle) * 46;
  for (const other of cars) {
    if (other === car || other.parked) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 34) { desired = 0; break; }
  }
  car.speed += Math.max(-260 * dt, Math.min(160 * dt, desired - car.speed));
  // Steer gently toward the lane.
  const steer = angleDiff(car.angle, wantAngle);
  car.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, steer));
  // Pull back toward the lane centre line.
  const pull = car.axis === 'h' ? (laneY - car.y) * 0.9 : (laneX - car.x) * 0.9;
  if (car.axis === 'h') car.y += Math.max(-60 * dt, Math.min(60 * dt, pull * dt * 10));
  else car.x += Math.max(-60 * dt, Math.min(60 * dt, pull * dt * 10));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Keep inside the city; wrap around the far edge so traffic never runs out.
  const s = WORLD.size;
  if (car.x < 20 || car.x > s - 20 || car.y < 20 || car.y > s - 20) {
    car.angle += Math.PI;
    car.x = Math.max(40, Math.min(s - 40, car.x));
    car.y = Math.max(40, Math.min(s - 40, car.y));
  }
}

// Player driving: arcade accel / brake / steer with a little drift.
export function stepPlayerCar(car, steer, throttle, braking, dt) {
  const spec = car.spec;
  if (throttle > 0) car.speed += spec.accel * dt;
  if (braking) car.speed -= CAR.brake * dt;
  // Drag + rolling resistance.
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 6 && throttle <= 0 && !braking) car.speed = 0;
  car.speed = Math.max(-CAR.reverseTop, Math.min(spec.top, car.speed));
  // Steering bites harder the faster you go, but never at a standstill.
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * spec.turn * grip * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Circle-ish car-vs-car bump: push apart, trade a little speed, spark.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = (a.spec.len + b.spec.len) / 2 - 6;
  if (dist >= min || dist < 0.001) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const push = (min - dist) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const tmp = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = tmp * 0.4;
  return true;
}
