// Solara Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer + HUD paint what is there.
// Screens: menu / playing / paused / busted / wasted / complete.
// ?seed=N fixes the city. ?shot=chase|foot|mission|dusk|start stages a scene
// and sets window.__shotReady for screenshots. ?selftest=1 runs a scripted
// play-through (walk, steal, drive the first mission, police spawn, save)
// and writes the result into #selftest for headless verification.
import { CAR, COMBAT, PLAYER, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { makePlayer, nearestCar, enterExitCar, stepPlayerDriving, stepPlayerOnFoot } from './player.js';
import { makeCar, spawnParkedCar, spawnTrafficCar, stepTrafficCar, collideCars } from './traffic.js';
import { makePed, stepPed } from './peds.js';
import { makeWanted, addCrime, updatePolice } from './police.js';
import { missionTarget, objectiveText, startMission, updateMissions } from './missions.js';
import { aimAngle, makeCombat, updateBullets, updateCombat } from './combat.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function buildGame() {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const G = {
    time: 0,
    clockMinutes: 570, // 09:30 — a bright Solara Bay morning
    timeOfDay: 'day',
    state: 'menu',
    seed,
    rng,
    city,
    player: makePlayer(860, 870),
    cars: [],
    peds: [],
    policeCars: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: makeWanted(),
    combat: makeCombat(),
    mission: null,
    completed: [],
    camera: { x: 0, y: 0 },
    spawnTimer: 0,
    busted: false,
    wasted: false,
    banner: null,
    gunshotAt: null,
    aimAngle: null,
    missionTarget: null,
    inputOverride: null,
    audio,
    input: null,
    hud: null,
    saveGame() { saveGame(G); },
    toast(text, seconds) { if (G.hud) G.hud.showToast(text, seconds || 3); },
  };
  G.input = createInput(canvas);
  G.hud = createHud(G);
  return G;
}

const G = buildGame();

function announce(message) {
  statusEl.textContent = message;
}

function spawnPickups() {
  const kinds = ['health', 'ammo', 'health', 'ammo', 'health', 'ammo', 'health', 'ammo'];
  for (const kind of kinds) {
    const p = G.city.randomRoadPoint();
    G.pickups.push({ kind, x: p.x, y: p.y, respawn: 0 });
  }
}

function populateWorld() {
  G.cars.length = 0;
  G.peds.length = 0;
  G.policeCars.length = 0;
  G.cops.length = 0;
  G.bullets.length = 0;
  G.particles.length = 0;
  G.pickups.length = 0;
  for (let i = 0; i < 11; i += 1) G.cars.push(spawnTrafficCar(G.city, G.rng, G.player.x, G.player.y));
  for (let i = 0; i < 10; i += 1) G.cars.push(spawnParkedCar(G.city, G.rng));
  for (let i = 0; i < 24; i += 1) G.peds.push(makePed(G.rng, G.city));
  spawnPickups();
}

function showScreen(name) {
  for (const id of ['screen-menu', 'screen-pause', 'screen-busted', 'screen-wasted', 'screen-complete']) {
    document.getElementById(id).classList.toggle('show', id === `screen-${name}`);
  }
  document.getElementById('hud').classList.toggle('hidden', name === 'menu');
}

function newGame() {
  populateWorld();
  G.player = makePlayer(860, 870);
  G.player.cash = 150;
  G.wanted = makeWanted();
  G.completed = [];
  G.clockMinutes = 570;
  G.timeOfDay = 'day';
  G.busted = false;
  G.wasted = false;
  G.banner = null;
  G.state = 'playing';
  audio.unlock();
  startMission(G, 0);
  showScreen('none');
  announce('Playing. Mara Voss has a job for you — follow the yellow marker.');
}

function continueGame() {
  const save = loadGame();
  if (!save) { newGame(); return; }
  populateWorld();
  G.player = makePlayer(save.x, save.y);
  G.player.cash = save.cash;
  G.player.health = save.health;
  G.player.ammo = save.ammo;
  G.completed = save.completed || [];
  G.wanted = makeWanted();
  G.clockMinutes = 570;
  G.state = 'playing';
  audio.unlock();
  startMission(G, save.missionIdx || 0);
  showScreen('none');
  announce(`Welcome back. ${G.completed.length} jobs done, $${G.player.cash} in your pocket.`);
}

function respawnAfterTrouble(kind) {
  const fine = kind === 'busted' ? Math.min(G.player.cash, 200) : Math.min(G.player.cash, 150);
  G.player.cash -= fine;
  G.player.health = PLAYER.healthMax;
  G.player.car = null;
  G.wanted = makeWanted();
  G.policeCars.length = 0;
  G.cops.length = 0;
  G.busted = false;
  G.wasted = false;
  // Precinct steps (busted) or the hospital (wasted) — both downtown.
  G.player.x = kind === 'busted' ? 200 : 1200;
  G.player.y = kind === 'busted' ? 200 : 1200;
  G.state = 'playing';
  audio.siren(false);
  showScreen('none');
  G.toast(kind === 'busted' ? `Busted! The SBPD took $${fine}. Mara is not impressed.` : `Wasted! The hospital patched you up. -$${fine}.`, 4);
  G.saveGame();
}

function updateCamera(dt) {
  const { w, h } = renderer.viewSize();
  const tx = Math.max(0, Math.min(WORLD.size - w, G.player.x - w / 2));
  const ty = Math.max(0, Math.min(WORLD.size - h, G.player.y - h / 2));
  const k = 1 - Math.pow(0.001, dt); // smooth follow
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
}

function stepWorld(dt) {
  const p = G.player;
  const input = G.inputOverride || G.input;
  G.time += dt;
  G.clockMinutes += dt * 0.5; // 1 game hour per 2 real minutes
  if (G.clockMinutes >= 1440) G.clockMinutes -= 1440;
  G.timeOfDay = G.clockMinutes >= 1020 && G.clockMinutes < 1140 ? 'dusk' : 'day';
  G.missionTarget = missionTarget(G);

  // Aim (on foot only).
  G.aimAngle = p.car ? null : aimAngle(G);

  // --- Player ---
  if (p.car) {
    const result = stepPlayerDriving(G.city, p, input, dt);
    if (result === 'crash') {
      audio.crash();
      for (let i = 0; i < 10; i += 1) {
        G.particles.push({
          x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
          life: 0.4, max: 0.4, color: '#ffd34d', size: 4, spark: true,
        });
      }
    }
    // Skid smoke when cornering hard at speed.
    if (Math.abs(p.car.speed) > 240 && Math.random() < dt * 8) {
      G.particles.push({
        x: p.car.x - Math.cos(p.car.angle) * 20, y: p.car.y - Math.sin(p.car.angle) * 20,
        vx: 0, vy: 0, life: 0.5, max: 0.5, color: 'rgba(200,200,200,0.7)', size: 6, spark: false,
      });
    }
    audio.engine(Math.min(1, Math.abs(p.car.speed) / p.car.spec.top));
  } else {
    stepPlayerOnFoot(G.city, p, input.move(), input.run(), dt);
    audio.engineOff();
  }

  // --- Cars: traffic AI + collisions with the player's car ---
  for (const car of G.cars) stepTrafficCar(G.city, car, G.cars, dt);
  for (const car of G.cars) {
    if (p.car && collideCars(p.car, car)) {
      if (Math.abs(p.car.speed) > 120) audio.crash();
    }
  }
  // Keep traffic near the player.
  G.cars = G.cars.filter((car) => {
    if (car === p.car) return true;
    return Math.hypot(car.x - p.x, car.y - p.y) < 1300;
  });
  while (G.cars.filter((c) => c.traffic).length < 10) {
    G.cars.push(spawnTrafficCar(G.city, G.rng, p.x, p.y));
  }

  // --- Pedestrians ---
  for (const ped of G.peds) stepPed(G.city, ped, p, G.gunshotAt, dt);
  G.gunshotAt = null;
  // Player car hitting a pedestrian is a crime.
  if (p.car && Math.abs(p.car.speed) > 60) {
    for (const ped of G.peds) {
      if (!ped.down && Math.hypot(ped.x - p.x, ped.y - p.y) < 30) {
        ped.down = 4;
        ped.fleeing = 4;
        addCrime(G, 1, 'You hit a pedestrian!');
        audio.thud();
      }
    }
  }
  G.peds = G.peds.filter((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 1100);
  while (G.peds.length < 22) G.peds.push(makePed(G.rng, G.city));

  // --- Police, missions, combat ---
  updatePolice(G, dt);
  G.policeCars = G.policeCars.filter((car) => !car.despawn && Math.hypot(car.x - p.x, car.y - p.y) < 1400);
  updateMissions(G, dt);
  updateCombat(G, dt);
  updateBullets(G, dt);

  // --- Pickups ---
  for (const pk of G.pickups) {
    if (pk.respawn > 0) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        const np = G.city.randomRoadPoint(p.x, p.y, 900);
        pk.x = np.x; pk.y = np.y;
      }
      continue;
    }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      if (pk.kind === 'health' && p.health < PLAYER.healthMax) {
        p.health = Math.min(PLAYER.healthMax, p.health + 30);
        G.toast('Health +30', 1.5);
      } else if (pk.kind === 'ammo') {
        p.ammo = Math.min(COMBAT.maxAmmo, p.ammo + 12);
        G.toast('Ammo +12', 1.5);
      } else continue;
      audio.pickup();
      pk.respawn = 25;
    }
  }

  // --- Particles ---
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);

  updateCamera(dt);

  // --- End states ---
  if (G.busted) {
    G.state = 'busted';
    document.getElementById('busted-fine').textContent = `The SBPD impounded your car and fined you. Mara is already calling.`;
    showScreen('busted');
    announce('Busted by the SBPD.');
  } else if (G.wasted || p.health <= 0) {
    G.wasted = true;
    G.state = 'wasted';
    showScreen('wasted');
    announce('Wasted.');
  }
  G.hud.update();
}

function handleActions() {
  const actions = G.input.takeActions();
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    G.toast(muted ? 'Sound off (M to turn back on)' : 'Sound on', 1.5);
  }
  if (G.state === 'menu') {
    if (actions & ACTION_CONFIRM) newGame();
    return;
  }
  if (G.state === 'playing') {
    if (actions & ACTION_PAUSE) {
      G.state = 'paused';
      showScreen('pause');
      announce('Paused.');
      G.saveGame();
    } else if (actions & ACTION_ENTER) {
      const car = G.player.car ? null : nearestCar(G.cars, G.player);
      const result = enterExitCar(G.player, car);
      if (result === 'stole') {
        // Witnessed theft raises the heat; nobody around, nobody cares.
        const witnessed = G.peds.some((ped) => !ped.down && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 220)
          || G.cops.some((cop) => Math.hypot(cop.x - G.player.x, cop.y - G.player.y) < 260)
          || G.policeCars.length > 0;
        if (witnessed) addCrime(G, 1, 'Grand theft auto — witnessed!');
        else G.toast('Car stolen. Nobody saw a thing.', 2);
        audio.unlock();
      } else if (result === 'exited') {
        G.toast('On foot.', 1);
      }
    }
    return;
  }
  if (G.state === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
    G.state = 'playing';
    showScreen('none');
    announce('Playing.');
  } else if (G.state === 'busted' && (actions & ACTION_CONFIRM)) {
    respawnAfterTrouble('busted');
  } else if (G.state === 'wasted' && (actions & ACTION_CONFIRM)) {
    respawnAfterTrouble('wasted');
  } else if (G.state === 'complete' && (actions & ACTION_CONFIRM)) {
    G.state = 'playing';
    showScreen('none');
  }
}

function runGame() {
  populateWorld();
  wireButtons();
  showScreen('menu');
  // Menu backdrop: the city simmers behind the title (traffic + peds only).
  let accumulator = 0;
  let last = performance.now();
  let menuPan = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (G.state === 'menu') {
      menuPan += 0.016;
      G.time += STEP;
      G.player.x = 1155 + Math.cos(menuPan * 0.3) * 260;
      G.player.y = 1155 + Math.sin(menuPan * 0.3) * 260;
      for (const car of G.cars) stepTrafficCar(G.city, car, G.cars, STEP);
      for (const ped of G.peds) stepPed(G.city, ped, G.player, null, STEP);
      updateCamera(STEP);
      renderer.draw(G);
      return;
    }
    if (G.state === 'playing') {
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
        if (G.state !== 'playing') break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(G);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'playing') {
      G.state = 'paused';
      showScreen('pause');
      G.saveGame();
    }
  });

  // Continue button is only offered when a save exists.
  document.getElementById('btn-continue').style.display = hasSave() ? 'inline-block' : 'none';
  announce('Solara Bay. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

function wireButtons() {
  document.getElementById('btn-new').addEventListener('click', () => { audio.unlock(); newGame(); });
  document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); continueGame(); });
  document.getElementById('btn-resume').addEventListener('click', () => {
    G.state = 'playing'; showScreen('none');
  });
  document.getElementById('btn-quit-menu').addEventListener('click', () => {
    G.state = 'menu'; showScreen('menu'); G.saveGame();
  });
  document.getElementById('btn-busted').addEventListener('click', () => respawnAfterTrouble('busted'));
  document.getElementById('btn-wasted').addEventListener('click', () => respawnAfterTrouble('wasted'));
  document.getElementById('btn-complete').addEventListener('click', () => {
    G.state = 'playing'; showScreen('none');
  });
}

// ---- Screenshot staging: paint the staged scene twice, then flag readiness. ----
function runShot(name) {
  populateWorld();
  stageShot(G, name);
  // Gameplay scenes hide the menu overlay and show the HUD; the 'start'
  // scene keeps the title screen over the living city.
  showScreen(G.state === 'menu' ? 'menu' : 'none');
  let painted = 0;
  function paint() {
    renderer.draw(G);
    G.hud.update();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      statusEl.textContent = `shot-ready ${name}`;
      document.title = `SHOT OK ${name}`;
    }
  }
  requestAnimationFrame(paint);
}

// ---- Headless self-test: scripted play-through, results into #selftest. ----
// Runs the simulation synchronously in one tight loop (no rAF / wall clock),
// so headless Chrome with --dump-dom reports the result deterministically.
function runSelftest() {
  populateWorld();
  G.state = 'playing';
  showScreen('none');
  wireButtons();
  startMission(G, 0);
  const report = { walk: false, stole: false, drove: false, mission1: false, policeSpawned: false, saveOk: false, wantedAfterCrime: 0 };
  let phase = 'walk';
  let steps = 0;
  const MAX_STEPS = 60 * 120; // up to 120 simulated seconds

  function autopilotInput() {
    const p = G.player;
    if (phase === 'walk') {
      // Nearest car by distance (no range limit — the autopilot walks to it).
      let car = null;
      let best = Infinity;
      for (const c of G.cars) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < best) { best = d; car = c; }
      }
      if (!car) return { move: () => ({ x: 0, y: 0 }), run: () => false, brake: () => false, mouse: () => ({ x: 0, y: 0, down: false }) };
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 40) {
        const result = enterExitCar(p, car);
        if (result === 'stole') { report.stole = true; phase = 'drive'; }
      }
      report.walk = true;
      return { move: () => ({ x: dx / (d || 1), y: dy / (d || 1) }), run: () => true, brake: () => false, mouse: () => ({ x: 0, y: 0, down: false }) };
    }
    // Drive: steer the car toward the mission target, foot down.
    const target = missionTarget(G);
    const want = Math.atan2(target.y - p.y, target.x - p.x);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
    return { move: () => ({ x: steer, y: -1 }), run: () => false, brake: () => false, mouse: () => ({ x: 0, y: 0, down: false }) };
  }

  while (steps < MAX_STEPS) {
    steps += 1;
    G.inputOverride = autopilotInput();
    stepWorld(STEP);
    if (G.completed.includes('wheels')) report.mission1 = true;
    if (report.mission1 && phase === 'drive') {
      phase = 'police';
      addCrime(G, 3, 'selftest crime');
      report.wantedAfterCrime = G.wanted.stars;
    }
    if (phase === 'police' && G.policeCars.length > 0) {
      report.policeSpawned = true;
      report.drove = !!G.player.car;
      G.saveGame();
      const loaded = loadGame();
      report.saveOk = !!loaded && loaded.cash === G.player.cash && loaded.completed.includes('wheels');
      break;
    }
    if (G.state === 'busted' || G.state === 'wasted') break;
  }
  report.steps = steps;
  report.time = Math.round(G.time);
  report.cash = G.player.cash;
  report.completed = G.completed;
  report.phase = phase;
  report.timeout = steps >= MAX_STEPS;
  renderer.draw(G);
  G.hud.update();
  document.getElementById('selftest').textContent = JSON.stringify(report);
  document.title = 'SELFTEST DONE';
}

if (shot) runShot(shot);
else if (selftest) runSelftest();
else runGame();
