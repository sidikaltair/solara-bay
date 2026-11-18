// ?selftest=1 — scripted play-through using the real game functions:
// walk, steal a car, drive, finish mission 1, police spawn, shoot, save.
// Results go into #selftest and window.__selftestDone for headless checks.
import { PLACES } from './config.js';
import { enterExitCar } from './player.js';
import { startMission } from './missions.js';
import { addCrime } from './police.js';
import { firePistol } from './combat.js';
import { loadGame } from './save.js';
import { STEP } from './config.js';

export async function runSelftest(G, hooks) {
  const results = [];
  const el = document.getElementById('selftest');
  const check = (name, ok, detail) => {
    results.push(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
    console.log(results[results.length - 1]);
  };
  const step = (n) => { for (let i = 0; i < n; i += 1) hooks.stepGame(STEP); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    await sleep(300); // let the renderer warm up
    // 1. Walk on foot.
    const sx = G.player.x; const sz = G.player.z;
    G.inputOverride = { forward: true, back: false, left: false, right: false, run: false, brake: false };
    step(60);
    const walked = Math.hypot(G.player.x - sx, G.player.z - sz);
    check('walk', walked > 2, `moved ${walked.toFixed(1)}u`);
    G.inputOverride = null;

    // 2. Steal a car.
    const parked = G.cars.find((c) => c.parked) || G.cars[0];
    G.player.x = parked.x + 2; G.player.z = parked.z;
    const entered = enterExitCar(G);
    check('steal', entered === 'enter' && !!G.player.car, entered || 'no car in range');

    // 3. Drive.
    const cx = G.player.x; const cz = G.player.z;
    G.inputOverride = { forward: true, back: false, left: false, right: false, run: false, brake: false };
    step(120);
    const drove = Math.hypot(G.player.x - cx, G.player.z - cz);
    check('drive', drove > 10 && Math.abs(G.player.car.speed) > 3, `moved ${drove.toFixed(1)}u @ ${G.player.car.speed.toFixed(1)}u/s`);
    G.inputOverride = null;

    // 4. Exit the car.
    const exited = enterExitCar(G);
    check('exitCar', exited === 'exit' && !G.player.car, exited || 'still in car');

    // 5. Mission 1: steal + deliver to the chop shop.
    const cashBefore = G.player.cash;
    startMission(G, 0);
    const car2 = G.cars.find((c) => !c.playerDriven && c.type !== 'police');
    G.player.x = car2.x + 2; G.player.z = car2.z;
    enterExitCar(G);
    G.player.x = PLACES.chopShop.x; G.player.z = PLACES.chopShop.z;
    G.player.car.x = PLACES.chopShop.x; G.player.car.z = PLACES.chopShop.z;
    step(5);
    check('mission1', G.completed.includes('wheels') && G.player.cash > cashBefore, `cash $${cashBefore} -> $${G.player.cash}`);

    // 6. Police spawn at 3 stars.
    addCrime(G, 3);
    step(30);
    check('policeSpawn', G.policeCars.length >= 3, `${G.policeCars.length} cars`);

    // 7. Shoot the pistol.
    if (G.player.car) enterExitCar(G);
    const ammoBefore = G.player.ammo;
    const fired = firePistol(G, G.camera);
    check('shoot', fired && G.player.ammo === ammoBefore - 1, `ammo ${ammoBefore} -> ${G.player.ammo}`);

    // 8. Save / load round-trip.
    G.saveGame();
    const save = loadGame();
    check('save', !!save && save.cash === G.player.cash, save ? `cash $${save.cash}` : 'no save');

    // 9. Waypoint exists for the active mission.
    check('waypoint', !!G.mission, G.mission ? G.mission.def.id : 'no mission');

    // 10. Rendered frames.
    check('render', G.scene.children.length > 50, `${G.scene.children.length} scene objects`);
  } catch (err) {
    results.push(`FAIL: exception ${err.message}`);
    console.error(err);
  }
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  const summary = failed === 0 ? 'PASS' : `FAIL (${failed} failed)`;
  el.textContent = `${summary}\n${results.join('\n')}`;
  window.__selftestDone = summary;
  console.log(`SELFTEST ${summary}`);
}
