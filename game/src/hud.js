// HUD: the DOM overlay (cash, health, wanted stars, ammo, clock, objective
// banner, toasts, menus) plus the minimap — a small live canvas of the city
// with the player arrow, police blips and the mission marker.
import { WORLD } from './config.js';
import { missionTarget, objectiveText } from './missions.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    cash: $('hud-cash'), healthFill: $('hud-health-fill'), healthText: $('hud-health-text'),
    stars: $('hud-stars'), ammo: $('hud-ammo'), clock: $('hud-clock'),
    objective: $('hud-objective'), banner: $('hud-banner'),
    bannerTitle: $('hud-banner-title'), bannerSub: $('hud-banner-sub'),
    toast: $('hud-toast'), hint: $('hud-hint'), minimap: $('minimap'),
    carLabel: $('hud-car'),
  };
  const mctx = el.minimap.getContext('2d');
  let lastToast = '';
  let toastUntil = 0;
  let lastObjective = '';

  function fmtClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function showToast(text, seconds) {
    lastToast = text;
    toastUntil = G.time + seconds;
    el.toast.textContent = text;
    el.toast.classList.add('show');
  }

  function drawMinimap() {
    const w = el.minimap.width;
    const h = el.minimap.height;
    const scale = w / WORLD.size;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = '#20262e';
    mctx.fillRect(0, 0, w, h);
    // Parks + beach + water.
    mctx.fillStyle = '#3f7a3a';
    for (const park of G.city.parks) mctx.fillRect(park.x * scale, park.y * scale, park.w * scale, park.h * scale);
    mctx.fillStyle = '#e8d29a';
    mctx.fillRect(0, WORLD.beachTop * scale, w, (WORLD.waterTop - WORLD.beachTop) * scale);
    mctx.fillStyle = '#2f7fb8';
    mctx.fillRect(0, WORLD.waterTop * scale, w, (WORLD.size - WORLD.waterTop) * scale);
    // Roads.
    mctx.strokeStyle = '#5a6068';
    mctx.lineWidth = 3;
    for (const c of WORLD.roadCenters) {
      mctx.beginPath(); mctx.moveTo(0, c * scale); mctx.lineTo(w, c * scale); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(c * scale, 0); mctx.lineTo(c * scale, h); mctx.stroke();
    }
    // Buildings as faint blocks.
    mctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const b of G.city.buildings) {
      mctx.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
    }
    // Mission marker (yellow diamond, pulsing).
    const target = missionTarget(G);
    if (target) {
      const pulse = 5 + Math.sin(G.time * 4) * 1.5;
      mctx.fillStyle = '#f2c230';
      mctx.save();
      mctx.translate(target.x * scale, target.y * scale);
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      mctx.restore();
    }
    // Police blips (red/blue flashing).
    for (const car of G.policeCars) {
      mctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#ff4444' : '#4488ff';
      mctx.beginPath(); mctx.arc(car.x * scale, car.y * scale, 3, 0, Math.PI * 2); mctx.fill();
    }
    for (const cop of G.cops) {
      mctx.fillStyle = '#4488ff';
      mctx.beginPath(); mctx.arc(cop.x * scale, cop.y * scale, 2.5, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow (white triangle pointing along the facing).
    const p = G.player;
    mctx.save();
    mctx.translate(p.x * scale, p.y * scale);
    mctx.rotate(p.angle);
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(7, 0); mctx.lineTo(-5, -4.5); mctx.lineTo(-5, 4.5);
    mctx.closePath(); mctx.fill();
    mctx.restore();
    // North tick.
    mctx.fillStyle = '#fff';
    mctx.font = 'bold 10px system-ui, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('N', w / 2, 11);
  }

  function update() {
    const p = G.player;
    el.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
    const hp = Math.max(0, Math.round(p.health));
    el.healthFill.style.width = `${hp}%`;
    el.healthFill.style.background = hp > 50 ? '#27ae60' : hp > 25 ? '#f2c230' : '#e74c3c';
    el.healthText.textContent = `${hp}`;
    el.stars.textContent = '★'.repeat(G.wanted.stars) + '☆'.repeat(5 - G.wanted.stars);
    el.stars.classList.toggle('hot', G.wanted.stars >= 3);
    el.ammo.textContent = p.car ? '—' : `▸ ${p.ammo} ammo`;
    el.clock.textContent = fmtClock(G.clockMinutes);
    const obj = objectiveText(G);
    if (obj !== lastObjective) {
      lastObjective = obj;
      el.objective.textContent = obj;
    }
    el.carLabel.textContent = p.car ? p.car.spec.label : '';
    el.hint.textContent = p.car
      ? 'W/S drive · A/D steer · Space brake · E exit car · P pause'
      : 'WASD move · Shift run · E enter car · Click shoot · P pause · M mute';
    // Banner: shows for a few seconds after a mission starts / completes.
    if (G.banner && G.time < G.banner.until) {
      el.bannerTitle.textContent = G.banner.title;
      el.bannerSub.textContent = G.banner.sub;
      el.banner.classList.add('show');
    } else {
      el.banner.classList.remove('show');
    }
    // Toast expiry.
    if (lastToast && G.time > toastUntil) {
      el.toast.classList.remove('show');
      lastToast = '';
    }
    drawMinimap();
  }

  return { update, showToast };
}
