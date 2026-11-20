// HUD: health / money / ammo / wanted stars / mission panel / speed, and a
// circular top-down minimap drawn on a 2D canvas every frame.
import { G, clamp } from './state.js';
import { currentMission, missionProgressText } from './missions.js';

let el = {};
let mm = null;
let mmCtx = null;

export function initHUD() {
  el = {
    money: document.getElementById('money'),
    ammo: document.getElementById('ammo'),
    healthfill: document.getElementById('healthfill'),
    stars: document.getElementById('stars'),
    title: document.getElementById('missionTitle'),
    obj: document.getElementById('missionObj'),
    speed: document.getElementById('speed'),
    veh: document.getElementById('veh'),
    crosshair: document.getElementById('crosshair'),
  };
  mm = document.getElementById('minimap');
  mmCtx = mm ? mm.getContext('2d') : null;
}

export function updateHUD() {
  if (!el.money) return;
  el.money.textContent = G.money;
  el.ammo.textContent = G.ammo;
  el.healthfill.style.width = clamp(G.health, 0, 100) + '%';
  el.healthfill.style.background = G.health > 50
    ? 'linear-gradient(90deg,#37d67a,#a5e34d)'
    : G.health > 25 ? 'linear-gradient(90deg,#e8a33c,#e8d33c)' : 'linear-gradient(90deg,#d63a37,#e87a3c)';
  let s = '';
  for (let i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
  el.stars.textContent = s;
  const m = currentMission();
  if (m) {
    el.title.textContent = m.title;
    el.obj.textContent = missionProgressText();
  } else {
    el.title.textContent = 'All jobs done';
    el.obj.textContent = 'Solara Bay is yours. Free roam!';
  }
  const p = G.player;
  if (p && p.car) {
    el.speed.textContent = Math.round(Math.abs(p.car.speed) * 3.6);
    el.veh.textContent = p.car.police ? 'Police interceptor' : 'Driving';
  } else {
    el.speed.textContent = p && p.moving ? Math.round(6 * 3.6) : 0;
    el.veh.textContent = 'On foot';
  }
  el.crosshair.style.display = (G.mode === 'foot' && !G.paused) ? 'block' : 'none';
  drawMinimap();
}

function toMap(x, z, size) {
  // City -330..330 -> canvas 0..size.
  const s = size / 660;
  return [(x + 330) * s, (z + 330) * s];
}

export function drawMinimap() {
  if (!mmCtx || !G.world) return;
  const S = 168;
  const ctx = mmCtx;
  ctx.clearRect(0, 0, S, S);
  // Circular clip.
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  // Base + beach + water.
  ctx.fillStyle = '#3d5a34'; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#d9c28a'; ctx.fillRect(0, S - 14, S, 14);
  ctx.fillStyle = '#1e6f9e'; ctx.fillRect(0, S - 6, S, 6);
  // Roads.
  ctx.fillStyle = '#2e3138';
  const roadW = (18 / 660) * S;
  for (const r of [-275, -165, -55, 55, 165, 275]) {
    const [rx] = toMap(r, 0, S);
    ctx.fillRect(rx - roadW / 2, 0, roadW, S);
    const [, rz] = toMap(0, r, S);
    ctx.fillRect(0, rz - roadW / 2, S, roadW);
  }
  // Buildings.
  ctx.fillStyle = '#8a94a6';
  for (const b of G.world.buildings) {
    const [bx, bz] = toMap(b.position.x, b.position.z, S);
    const w = (b.geometry.parameters.width / 660) * S;
    const d = (b.geometry.parameters.depth / 660) * S;
    ctx.fillRect(bx - w / 2, bz - d / 2, Math.max(2, w), Math.max(2, d));
  }
  // Waypoint.
  const m = currentMission();
  if (m) {
    const [wx, wz] = toMap(m.target.x, m.target.z, S);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(wx, wz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(wx, wz, 8 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic cars (white), police (blue/red), player (green triangle).
  const dot = (x, z, color, r) => {
    const [dx, dz] = toMap(x, z, S);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(dx, dz, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const c of G.traffic) if (!c.disabled) dot(c.x, c.z, '#ffffff', 2);
  for (const c of G.police) {
    if (c.disabled) continue;
    dot(c.x, c.z, Math.floor(G.time * 6) % 2 === 0 ? '#ff4040' : '#4060ff', 3);
  }
  const p = G.player;
  if (p) {
    const px = p.car ? p.car.x : p.x;
    const pz = p.car ? p.car.z : p.z;
    const [dx, dz] = toMap(px, pz, S);
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(dx, dz, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(dx, dz, 5.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // Ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
}
