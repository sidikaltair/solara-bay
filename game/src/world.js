// Solara Bay itself: a seeded grid city — roads, blocks, procedural buildings,
// parks, a beach and water edge — plus every collision query the game needs.
// The city is generated once from the seed and never changes during a run.
import { WORLD } from './config.js';
import { pick, range } from './random.js';

const BUILDING_COLORS = ['#b98a6e', '#8fa3b8', '#c2b49a', '#9a7d8f', '#7e9c8a', '#b8b0a0', '#a88f6a', '#6f87a0'];
const ROOF_COLORS = ['#5d6b7a', '#7a6a58', '#4f5d4a', '#8a4f4f', '#3f4a55'];
const PARK_NAMES = ['Palm Court', 'Voss Park', 'Sunset Green'];

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const colliders = []; // AABBs {x,y,w,h} — buildings + water
  const { size, roadCenters, roadPitch, roadWidth, beachTop, waterTop } = WORLD;
  const halfRoad = roadWidth / 2;

  // Blocks sit between road centre-lines. Block (bx,by) spans the square
  // between roads bx and bx+1; the last row (by = 7) is the beach strip.
  for (let bx = 0; bx < roadCenters.length - 1; bx += 1) {
    for (let by = 0; by < roadCenters.length - 1; by += 1) {
      const x0 = roadCenters[bx] + halfRoad + 8;
      const y0 = roadCenters[by] + halfRoad + 8;
      const x1 = roadCenters[bx + 1] - halfRoad - 8;
      const y1 = roadCenters[by + 1] - halfRoad - 8;
      const w = x1 - x0;
      const h = y1 - y0;
      if (by === roadCenters.length - 2) {
        // The row above the beach road is the boardwalk: palms + benches, no buildings.
        for (let i = 0; i < 6; i += 1) {
          trees.push({ x: x0 + 20 + rng() * (w - 40), y: y0 + 20 + rng() * (h - 40), r: 9 + rng() * 5, palm: true });
        }
        continue;
      }
      if (rng() < 0.14) {
        parks.push({ x: x0, y: y0, w, h, name: pick(rng, PARK_NAMES) });
        for (let i = 0; i < 7; i += 1) {
          trees.push({ x: x0 + 16 + rng() * (w - 32), y: y0 + 16 + rng() * (h - 32), r: 8 + rng() * 6, palm: rng() < 0.4 });
        }
        continue;
      }
      // 1–4 buildings per block, sliced along the block's long side.
      const count = 1 + Math.floor(rng() * 3.5);
      const horizontal = w >= h;
      let cursor = 0;
      for (let i = 0; i < count; i += 1) {
        const frac = i === count - 1 ? 1 : 0.3 + rng() * 0.4;
        const bw = horizontal ? Math.max(50, (w - cursor) * frac - 10) : w - 16;
        const bh = horizontal ? h - 16 : Math.max(50, (h - cursor) * frac - 10);
        const bx0 = x0 + (horizontal ? cursor + 5 : 8);
        const by0 = y0 + (horizontal ? 8 : cursor + 5);
        const b = {
          x: bx0, y: by0, w: bw, h: bh,
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ROOF_COLORS),
          height: 6 + rng() * 22,           // fake height: drives the shadow offset
          windows: Math.floor(rng() * 3),   // rooftop detail seed
        };
        buildings.push(b);
        colliders.push({ x: bx0, y: by0, w: bw, h: bh });
        if (rng() < 0.6) trees.push({ x: bx0 + bw + 6, y: by0 + bh / 2, r: 7 + rng() * 4, palm: rng() < 0.5 });
        cursor += (horizontal ? bw : bh) + 10;
        if (cursor > (horizontal ? w : h) - 60) break;
      }
    }
  }

  // Street lamps along every road, staggered.
  for (const c of roadCenters) {
    for (let t = 120; t < size - 100; t += 240) {
      lamps.push({ x: c + halfRoad + 6, y: t });
      lamps.push({ x: t, y: c - halfRoad - 6 });
    }
  }
  // Water blocks everything south of the sand.
  colliders.push({ x: 0, y: waterTop, w: size, h: size - waterTop });

  function onRoad(x, y) {
    for (const c of roadCenters) {
      if (Math.abs(x - c) <= halfRoad || Math.abs(y - c) <= halfRoad) return true;
    }
    return false;
  }

  function nearestRoadCenter(v) {
    let best = roadCenters[0];
    for (const c of roadCenters) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    return best;
  }

  // Is point (x,y) on a road, and if so which axis? Used by traffic lane-keeping.
  function roadAxis(x, y) {
    let dx = Infinity;
    let dy = Infinity;
    for (const c of roadCenters) {
      dx = Math.min(dx, Math.abs(x - c));
      dy = Math.min(dy, Math.abs(y - c));
    }
    if (dx <= halfRoad && dy <= halfRoad) return 'cross';
    if (dx <= halfRoad) return 'v';
    if (dy <= halfRoad) return 'h';
    return null;
  }

  // Circle (player / ped) vs building AABBs: push the circle out.
  function collideCircle(p, radius) {
    for (const c of colliders) {
      const cx = Math.max(c.x, Math.min(p.x, c.x + c.w));
      const cy = Math.max(c.y, Math.min(p.y, c.y + c.h));
      const ddx = p.x - cx;
      const ddy = p.y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < radius * radius && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (ddx / d) * radius;
        p.y = cy + (ddy / d) * radius;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: shove out along the smallest penetration.
        const left = p.x - c.x;
        const right = c.x + c.w - p.x;
        const top = p.y - c.y;
        const bottom = c.y + c.h - p.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = c.x - radius;
        else if (m === right) p.x = c.x + c.w + radius;
        else if (m === top) p.y = c.y - radius;
        else p.y = c.y + c.h + radius;
      }
    }
    p.x = Math.max(radius, Math.min(size - radius, p.x));
    p.y = Math.max(radius, Math.min(size - radius, p.y));
  }

  // Oriented car (as a circle at its centre, radius ~ half length) vs buildings.
  // Returns true when the car hit something solid this step.
  function collideCar(car, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.x, Math.min(car.x, c.x + c.w));
      const cy = Math.max(c.y, Math.min(car.y, c.y + c.h));
      const ddx = car.x - cx;
      const ddy = car.y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          car.x = cx + (ddx / d) * radius;
          car.y = cy + (ddy / d) * radius;
        } else {
          car.x -= Math.cos(car.angle) * radius;
          car.y -= Math.sin(car.angle) * radius;
        }
      }
    }
    if (car.x < radius) { car.x = radius; hit = true; }
    if (car.y < radius) { car.y = radius; hit = true; }
    if (car.x > size - radius) { car.x = size - radius; hit = true; }
    if (car.y > size - radius) { car.y = size - radius; hit = true; }
    return hit;
  }

  // A random point on a road (for spawning traffic / pickups), near a focus point.
  function randomRoadPoint(fx, fy, maxDist) {
    for (let tries = 0; tries < 20; tries += 1) {
      const c = pick(rng, roadCenters);
      const along = range(rng, 80, size - 80);
      const horizontal = rng() < 0.5;
      const p = horizontal ? { x: along, y: c } : { x: c, y: along };
      if (fx === undefined || Math.hypot(p.x - fx, p.y - fy) < maxDist) return p;
    }
    return { x: roadCenters[3], y: roadCenters[3] };
  }

  // A random sidewalk point: just off a road, inside a block edge.
  function randomSidewalkPoint() {
    const c = pick(rng, roadCenters);
    const along = range(rng, 80, size - 80);
    const off = halfRoad + 10 + rng() * 14;
    return rng() < 0.5
      ? { x: along, y: c + (rng() < 0.5 ? off : -off) }
      : { x: c + (rng() < 0.5 ? off : -off), y: along };
  }

  return {
    buildings, trees, lamps, parks, colliders,
    onRoad, nearestRoadCenter, roadAxis, collideCircle, collideCar,
    randomRoadPoint, randomSidewalkPoint,
  };
}
