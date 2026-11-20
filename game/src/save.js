// Save / load via localStorage + pause menu wiring. The save stores money,
// mission progress, health, player position and wanted level. Test modes
// (?selftest / ?shot) never load a save — they always start fresh.
import { G } from './state.js';
import { showBanner } from './missions.js';

const KEY = 'solara-bay-3d-save-v1';

export function saveGame() {
  try {
    const p = G.player;
    const data = {
      money: G.money,
      missionIndex: G.missionIndex,
      health: G.health,
      wanted: G.wanted,
      dusk: G.dusk,
      x: p ? (p.car ? p.car.x : p.x) : 0,
      z: p ? (p.car ? p.car.z : p.z) : 0,
      at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    showBanner('Game saved.');
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.money !== 'number') return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function applySave(d) {
  if (!d) return;
  G.money = d.money || 0;
  G.missionIndex = d.missionIndex || 0;
  G.health = d.health || 100;
  G.wanted = d.wanted || 0;
  if (G.player) {
    G.player.x = d.x || 0;
    G.player.z = d.z || 0;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
  }
}

export function togglePause() {
  G.paused = !G.paused;
  const el = document.getElementById('pause');
  if (el) el.style.display = G.paused ? 'flex' : 'none';
}

export function wirePauseButtons() {
  const resume = document.getElementById('resumeBtn');
  const save = document.getElementById('saveBtn');
  const quit = document.getElementById('quitBtn');
  if (resume) resume.addEventListener('click', () => togglePause());
  if (save) save.addEventListener('click', () => { saveGame(); togglePause(); });
  if (quit) quit.addEventListener('click', () => { saveGame(); location.reload(); });
}
