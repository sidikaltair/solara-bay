// Traffic: civilian cars looping around city blocks on the road grid.
// Each car owns a rectangular route (road centre-lines) and follows it with
// the shared driveAI steering. Routes keep cars on roads, never on blocks.
import { G, mulberry32 } from './state.js';
import { makeCar, driveAI } from './car.js';

const ROAD_LINES = [-275, -165, -55, 55, 165, 275];

function rectRoute(rand) {
  // Pick two distinct road lines for x and two for z, forming a rectangle.
  const xi = Math.floor(rand() * ROAD_LINES.length);
  let xj = Math.floor(rand() * ROAD_LINES.length);
  if (xj === xi) xj = (xj + 2) % ROAD_LINES.length;
  const zi = Math.floor(rand() * ROAD_LINES.length);
  let zj = Math.floor(rand() * ROAD_LINES.length);
  if (zj === zi) zj = (zj + 2) % ROAD_LINES.length;
  const x1 = ROAD_LINES[Math.min(xi, xj)], x2 = ROAD_LINES[Math.max(xi, xj)];
  const z1 = ROAD_LINES[Math.min(zi, zj)], z2 = ROAD_LINES[Math.max(zi, zj)];
  // Clockwise rectangle, starting at a random corner.
  const pts = [
    { x: x1, z: z1 }, { x: x2, z: z1 },
    { x: x2, z: z2 }, { x: x1, z: z2 },
  ];
  const start = Math.floor(rand() * 4);
  return pts.slice(start).concat(pts.slice(0, start));
}

export function initTraffic(n) {
  const rand = mulberry32(4242);
  for (let i = 0; i < n; i++) {
    const route = rectRoute(rand);
    const p0 = route[0];
    const car = makeCar({
      x: p0.x, z: p0.z,
      angle: Math.atan2(route[1].x - p0.x, route[1].z - p0.z),
      driver: 'traffic',
      route,
    });
    car.routeIdx = 1;
    car.maxSpeed = 10 + rand() * 3;
    car.cruise = car.maxSpeed;
  }
}

export function updateTraffic(dt) {
  for (const car of G.traffic) {
    if (car.disabled || car.driver !== 'traffic' || !car.route) continue;
    const wp = car.route[car.routeIdx];
    if (!wp) continue;
    const dx = wp.x - car.x, dz = wp.z - car.z;
    if (Math.hypot(dx, dz) < 7) {
      car.routeIdx = (car.routeIdx + 1) % car.route.length;
      continue;
    }
    driveAI(car, dt, wp.x, wp.z, car.cruise || 10);
  }
}

// A few parked cars the player can take without a wanted jump.
export function spawnParked(n) {
  const rand = mulberry32(777);
  let placed = 0, guard = 0;
  while (placed < n && guard++ < 200) {
    const road = ROAD_LINES[Math.floor(rand() * ROAD_LINES.length)];
    const along = -260 + rand() * 520;
    const side = rand() < 0.5 ? -1 : 1;
    const horizontal = rand() < 0.5;
    const x = horizontal ? along : road + side * 7;
    const z = horizontal ? road + side * 7 : along;
    // Keep clear of the plaza and the beach.
    if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
    if (z > 280) continue;
    const car = makeCar({ x, z, angle: horizontal ? Math.PI / 2 : 0, driver: null });
    car.maxSpeed = 24;
    placed++;
  }
}
