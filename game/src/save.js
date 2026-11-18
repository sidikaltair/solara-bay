// Save/load via localStorage — cash, health, ammo, position, missions done.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const p = G.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: p.x, z: p.z, cash: p.cash, health: p.health, ammo: p.ammo,
      completed: G.completed,
      missionIdx: G.mission ? G.mission.idx : G.completed.length,
    }));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
