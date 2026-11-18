// Solara Bay 3D — tuning constants. 3D city is 660x660 units; the 2D game's
// 2640px map maps to it by dividing by 4 and centring on (0,0).
export const WORLD = {
  size: 660,            // city square, units (x and z, centred on 0)
  roadPitch: 82.5,      // distance between road centre-lines
  roadWidth: 18,        // asphalt width
  roadCenters: [-288.75, -206.25, -123.75, -41.25, 41.25, 123.75, 206.25, 288.75],
  beachZ: 330,          // sand starts here (south edge)
  waterZ: 372,          // water is impassable
};

export const PLAYER = {
  radius: 0.9,
  walkSpeed: 6.5,
  runSpeed: 10.5,
  healthMax: 100,
  enterRange: 3.2,
};

export const CAR = {
  types: {
    sedan:  { len: 4.6, wid: 2.0, top: 34, accel: 26, turn: 2.2, color: 0xc94f43, label: 'Marlin Sedan' },
    taxi:   { len: 4.6, wid: 2.0, top: 33, accel: 25, turn: 2.2, color: 0xf2c230, label: 'Bay Taxi' },
    van:    { len: 5.4, wid: 2.2, top: 26, accel: 17, turn: 1.7, color: 0x7d8a99, label: 'Cargo Van' },
    sports: { len: 4.7, wid: 2.0, top: 46, accel: 36, turn: 2.6, color: 0x2e6fd8, label: 'Vortex GT' },
    police: { len: 4.8, wid: 2.1, top: 42, accel: 34, turn: 2.5, color: 0x1c2733, label: 'SBPD Interceptor' },
    truck:  { len: 6.0, wid: 2.4, top: 24, accel: 15, turn: 1.5, color: 0x5a7d4f, label: 'Hauler' },
  },
  reverseTop: 12,
  brake: 46,
  drag: 0.55,
};

export const WANTED = {
  max: 5,
  decayQuietSeconds: 10,
  decayPerStarSeconds: 7,
  policeCarsPerStar: [0, 1, 2, 3, 4, 5],
  bustTouchSeconds: 1.4,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  pistolCooldown: 0.28,
  bulletSpeed: 120,
  startAmmo: 24,
  maxAmmo: 120,
};

// Mission targets in 3D coords (2D px / 4 - 330, z = 2D y / 4 - 330).
export const PLACES = {
  chopShop:  { x: 206,  z: -124, label: 'Chop Shop' },
  docks:     { x: -206, z: -289, label: 'North Docks' },
  arcade:    { x: -124, z: -41,  label: 'Neon Arcade' },
  safehouse: { x: 206,  z: 124,  label: 'Safehouse' },
  bank:      { x: -41,  z: -206, label: 'Pier Row Bank' },
  beach:     { x: -206, z: 289,  label: 'Solara Beach' },
  precinct:  { x: 41,   z: 41,   label: 'SBPD Precinct' },
  hospital:  { x: -41,  z: 206,  label: 'Bay General' },
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

export const SAVE_KEY = 'solara-bay-3d-save-v1';
export const STEP = 1 / 60;
