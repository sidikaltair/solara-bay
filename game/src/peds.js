// Pedestrians: they walk the sidewalks, cross at intersections, and flee from
// gunshots and speeding cars. A hit pedestrian is a crime — the wanted system
// is told about it by main.js, not here.
import { pick, range } from './random.js';

const SHIRTS = ['#e8b4b8', '#a8c8e8', '#c8e8a8', '#e8d8a8', '#d8a8e8', '#f0f0f0', '#e8a878', '#98d8c8'];
const PANTS = ['#3a4a5a', '#5a3a3a', '#2a2a2a', '#4a5a3a', '#6a5a4a'];
const SKINS = ['#f0c8a0', '#c89878', '#8a5a3a', '#e8b88a', '#6a4a2a'];

export function makePed(rng, city, x, y) {
  const p = x === undefined ? city.randomSidewalkPoint() : { x, y };
  return {
    x: p.x, y: p.y,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 34, 62),
    target: city.randomSidewalkPoint(),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKINS),
    fleeing: 0,        // seconds of panic left
    down: 0,           // seconds lying on the ground after being hit
    walkPhase: rng() * Math.PI * 2,
    dead: false,
  };
}

export function stepPed(city, ped, player, gunshotAt, dt) {
  if (ped.down > 0) {
    ped.down -= dt;
    return;
  }
  // Panic: a gunshot or a fast car nearby sends them running away from it.
  let fleeFrom = null;
  if (gunshotAt && Math.hypot(ped.x - gunshotAt.x, ped.y - gunshotAt.y) < 260) {
    fleeFrom = gunshotAt;
  } else if (player.car && Math.abs(player.car.speed) > 200 &&
    Math.hypot(ped.x - player.car.x, ped.y - player.car.y) < 130) {
    fleeFrom = player.car;
  }
  if (fleeFrom) {
    ped.fleeing = 1.6;
    // Remember where the danger was: fleeing lasts longer than one sighting.
    ped.fleeX = fleeFrom.x;
    ped.fleeY = fleeFrom.y;
  }
  ped.walkPhase += dt * (ped.fleeing > 0 ? 14 : 7);

  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.fleeing > 0) {
    ped.fleeing -= dt;
    const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    tx = ped.x + Math.cos(away) * 60;
    ty = ped.y + Math.sin(away) * 60;
    speed = 150;
  } else {
    tx = ped.target.x;
    ty = ped.target.y;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 14) {
      ped.target = city.randomSidewalkPoint();
      return;
    }
  }
  const want = Math.atan2(ty - ped.y, tx - ped.x);
  let diff = want - ped.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  city.collideCircle(ped, 10);
}
