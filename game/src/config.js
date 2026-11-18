// Solara Bay — tuning constants. One place for every number the game balances on,
// so a tweak here retunes driving, chasing, missions and combat together.
export const WORLD = {
  size: 2640,          // city is a square, px
  roadPitch: 330,      // distance between road centre-lines
  roadWidth: 72,       // asphalt width
  roadCenters: [165, 495, 825, 1155, 1485, 1815, 2145, 2475],
  beachTop: 2475,      // sand starts just past the last road
  waterTop: 2560,      // water is impassable
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  healthMax: 100,
  enterRange: 56,
};

export const CAR = {
  // type: length, width, top speed px/s, accel, turn rate, colour, label
  types: {
    sedan:  { len: 52, wid: 26, top: 330, accel: 240, turn: 2.6, color: '#c94f43', label: 'Marlin Sedan' },
    taxi:   { len: 52, wid: 26, top: 320, accel: 230, turn: 2.6, color: '#f2c230', label: 'Bay Taxi' },
    van:    { len: 62, wid: 28, top: 260, accel: 170, turn: 2.0, color: '#7d8a99', label: 'Cargo Van' },
    sports: { len: 54, wid: 26, top: 430, accel: 330, turn: 3.1, color: '#2e6fd8', label: 'Vortex GT' },
    police: { len: 54, wid: 27, top: 400, accel: 320, turn: 3.0, color: '#1c2733', label: 'SBPD Interceptor' },
    truck:  { len: 68, wid: 30, top: 240, accel: 150, turn: 1.8, color: '#5a7d4f', label: 'Hauler' },
  },
  reverseTop: 120,
  brake: 420,
  drag: 0.55,          // per-second speed decay when coasting
};

export const WANTED = {
  max: 5,
  decayQuietSeconds: 10,   // no crime + no police near -> stars start falling
  decayPerStarSeconds: 7,
  policeCarsPerStar: [0, 1, 2, 3, 4, 5],
  bustTouchSeconds: 1.4,   // a foot cop touching you this long busts you
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
  fistDamage: 18,
  fistRange: 46,
  fistCooldown: 0.45,
  bulletSpeed: 900,
  startAmmo: 24,
  maxAmmo: 120,
};

export const MISSIONS = [
  {
    id: 'wheels', name: '1 — Wheels', fixer: 'Mara Voss',
    brief: 'Mara needs a clean ride. Steal any car and bring it to the chop shop.',
    reward: 400,
    lines: [
      'MARA: Solara Bay eats the slow, kid. Prove you can drive.',
      'MARA: Any car on the street will do. Bring it to the chop shop — yellow marker.',
    ],
  },
  {
    id: 'package', name: '2 — Package Run', fixer: 'Mara Voss',
    brief: 'A package for the north docks. 90 seconds. No questions, no stops.',
    reward: 650, timeLimit: 90,
    lines: [
      'MARA: Package in the trunk. North docks, 90 seconds. The clock is already running.',
      'MARA: Drive like the bay is on fire. Because it might be.',
    ],
  },
  {
    id: 'heat', name: '3 — Lose the Heat', fixer: 'Mara Voss',
    brief: 'The SBPD is all over you. Lose the 3-star heat — break line of sight and lay low.',
    reward: 800,
    lines: [
      'MARA: You lit up the whole precinct. Lose them. Alleys, side streets — vanish.',
      'MARA: Stay out of sight until the stars drop. Do NOT start a war with them.',
    ],
  },
  {
    id: 'getaway', name: '4 — Getaway Driver', fixer: 'Mara Voss',
    brief: 'Pick up Dice at the arcade, then drive him to the safehouse while the cops chase.',
    reward: 1100,
    lines: [
      'MARA: Dice is waiting at the arcade with a bag full of trouble. Go get him.',
      'DICE: Drive, drive! Safehouse on the east side. And try not to die.',
    ],
  },
  {
    id: 'bayjob', name: '5 — The Bay Job', fixer: 'Mara Voss',
    brief: 'The big one: hold the bank on Pier Row, then escape to the beach with the take.',
    reward: 2500,
    lines: [
      'MARA: This is it. The bank on Pier Row. Hold the spot, grab the take, run for the beach.',
      'MARA: Every cop in Solara Bay will be coming. Make it count.',
    ],
  },
];

export const SAVE_KEY = 'solara-bay-save-v1';
export const STEP = 1 / 60;
