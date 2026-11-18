// Missions: Mara Voss's 5-job story chain, ported from the 2D game to 3D
// coordinates. Each mission is a small state machine with a target point.
import { MISSIONS, PLACES } from './config.js';
import { addCrime } from './police.js';
import { dist2 } from './util.js';

export function missionDef(idx) {
  return MISSIONS[idx] ?? null;
}

export function startMission(G, idx) {
  const def = missionDef(idx);
  if (!def) {
    G.mission = null;
    G.state = 'complete';
    return;
  }
  const m = {
    idx, def, stage: 'go',
    timer: def.timeLimit ?? 0,
    holdTimer: 0,
    pickedUp: false,
    target: null,
  };
  if (def.id === 'wheels') m.target = PLACES.chopShop;
  else if (def.id === 'package') m.target = PLACES.docks;
  else if (def.id === 'heat') { m.target = null; addCrime(G, 3, 'WANTED: 3 stars — lose the heat!'); }
  else if (def.id === 'getaway') m.target = PLACES.arcade;
  else if (def.id === 'bayjob') m.target = PLACES.bank;
  G.mission = m;
  G.banner = { title: def.name, sub: def.brief, until: G.time + 6 };
  for (const line of def.lines) G.toast(line, 4);
  G.audio.mission();
}

export function objectiveText(G) {
  const m = G.mission;
  if (!m) return 'All jobs done — Solara Bay is yours. Free roam!';
  const p = G.player;
  switch (m.def.id) {
    case 'wheels':
      return p.car ? 'Deliver the car to the Chop Shop' : 'Steal a car — walk up to one and press E';
    case 'package':
      return `Deliver the package to the North Docks — ${Math.max(0, Math.ceil(m.timer))}s left`;
    case 'heat':
      return `Lose the heat — wanted ${'★'.repeat(G.wanted.stars)}${'☆'.repeat(5 - G.wanted.stars)} — stay out of sight`;
    case 'getaway':
      return m.pickedUp ? 'Dice is in! Drive him to the Safehouse' : 'Pick up Dice at the Neon Arcade';
    case 'bayjob':
      return m.stage === 'hold'
        ? `Hold the bank — ${Math.max(0, (5 - m.holdTimer)).toFixed(0)}s`
        : m.stage === 'escape' ? 'Grab the take! Escape to Solara Beach' : 'Get to the Pier Row Bank';
    default:
      return m.def.brief;
  }
}

export function missionTarget(G) {
  return G.mission ? G.mission.target : null;
}

function arrive(G, target, radius) {
  return dist2(G.player.x, G.player.z, target.x, target.z) < radius;
}

function completeMission(G) {
  const m = G.mission;
  const reward = m.def.reward;
  G.player.cash += reward;
  G.completed.push(m.def.id);
  G.toast(`${m.def.name} complete! +$${reward}`, 4);
  G.banner = { title: 'JOB DONE', sub: `+$${reward} — ${m.def.name}`, until: G.time + 4 };
  G.audio.payday();
  G.saveGame();
  startMission(G, m.idx + 1);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) return;
  const p = G.player;
  switch (m.def.id) {
    case 'wheels':
      if (p.car && arrive(G, PLACES.chopShop, 10)) completeMission(G);
      break;
    case 'package': {
      m.timer -= dt;
      if (m.timer <= 0) {
        G.toast('Too slow! Mara is not happy — try the run again.', 4);
        startMission(G, m.idx); // retry the same job
        break;
      }
      if (arrive(G, PLACES.docks, 10)) completeMission(G);
      break;
    }
    case 'heat':
      if (G.wanted.stars === 0) completeMission(G);
      break;
    case 'getaway':
      if (!m.pickedUp) {
        if (arrive(G, PLACES.arcade, 9)) {
          m.pickedUp = true;
          m.target = PLACES.safehouse;
          addCrime(G, 2, 'Dice is in the car! The SBPD is onto you — GO!');
          G.toast('DICE: Drive, drive! Safehouse on the east side!', 4);
        }
      } else if (p.car && arrive(G, PLACES.safehouse, 10)) {
        completeMission(G);
      }
      break;
    case 'bayjob':
      if (m.stage === 'go') {
        if (arrive(G, PLACES.bank, 10)) { m.stage = 'hold'; m.holdTimer = 0; }
      } else if (m.stage === 'hold') {
        m.holdTimer += dt;
        if (m.holdTimer >= 5) {
          m.stage = 'escape';
          m.target = PLACES.beach;
          addCrime(G, 4, 'The take is yours! Every cop in Solara Bay is coming!');
          G.toast('MARA: The take is yours! Run for the beach!', 4);
        }
      } else if (m.stage === 'escape') {
        if (arrive(G, PLACES.beach, 12)) completeMission(G);
      }
      break;
    default:
      break;
  }
}
