// Save / load via localStorage: cash, mission progress, health, ammo and where
// you were standing. A missing or corrupt save simply starts a new game.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      health: G.player.health,
      ammo: G.player.ammo,
      missionIdx: G.mission ? G.mission.idx : 0,
      completed: G.completed,
      x: G.player.x,
      y: G.player.y,
      time: G.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): the game just won't persist.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
