// Shared mutable game state + small helpers.
// Every module imports G and reads/writes its fields. Nothing here touches
// the DOM or the renderer; main.js fills scene/camera/renderer at boot.
export const G = {
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  keys: {},
  mode: 'foot',            // 'foot' | 'drive'
  player: null,            // player object (see player.js)
  cars: [],                // every drivable car (traffic + parked + police)
  traffic: [],
  police: [],
  footCops: [],
  peds: [],
  wanted: 0,
  money: 0,
  health: 100,
  ammo: 12,
  maxAmmo: 12,
  missionIndex: 0,
  missions: [],
  time: 0,
  dusk: false,
  paused: false,
  colliders: [],           // building AABBs: { minX, maxX, minZ, maxZ }
  cityHalf: 330,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 9,
  dragging: false,
  lastCrimeAt: -999,
  started: false,
  selftest: false,
  shot: 0,                 // 0 = normal play, 1..4 = screenshot staging
  world: null,             // { buildings: [...], palms, water, sun, hemi }
  muted: false,
};

export function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Deterministic PRNG so the city is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Angle helpers (radians).
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Circle (x,z,r) vs building AABB push-out. Returns corrected {x,z}.
export function collideCircle(x, z, r) {
  for (let i = 0; i < G.colliders.length; i++) {
    const c = G.colliders[i];
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Center inside the box: push out along the smallest penetration.
        const pl = x - (c.minX - r), pr = (c.maxX + r) - x;
        const pt = z - (c.minZ - r), pb = (c.maxZ + r) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r;
        else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r;
        else z = c.maxZ + r;
      }
    }
  }
  // Keep everything inside the city bounds (the water is beyond the beach).
  const B = G.cityHalf - 4;
  x = clamp(x, -B, B);
  z = clamp(z, -B, B);
  return { x, z };
}
