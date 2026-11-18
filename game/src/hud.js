// HUD: DOM overlay (cash, health, stars, clock, ammo, objective, banner,
// toast, hint) + a 2D top-down minimap canvas.
import { WORLD } from './config.js';
import { missionTarget, objectiveText } from './missions.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = 0;

  function drawMinimap() {
    const S = 190;
    const scale = S / (WORLD.size + 40);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#20262e';
    mctx.fillRect(0, 0, S, S);
    // Roads.
    mctx.strokeStyle = '#4a5058';
    mctx.lineWidth = 4;
    for (const c0 of WORLD.roadCenters) {
      const [x1, y1] = toMap(c0, -WORLD.size / 2);
      const [x2, y2] = toMap(c0, WORLD.size / 2);
      mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
      const [x3, y3] = toMap(-WORLD.size / 2, c0);
      const [x4, y4] = toMap(WORLD.size / 2, c0);
      mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
    }
    // Beach + water.
    mctx.fillStyle = '#e0c98f';
    mctx.fillRect(0, toMap(0, WORLD.beachZ)[1], S, S);
    mctx.fillStyle = '#2f7fb8';
    mctx.fillRect(0, toMap(0, WORLD.waterZ)[1], S, S - toMap(0, WORLD.waterZ)[1]);
    // Mission target.
    const t = missionTarget(G);
    if (t) {
      const [mx, my] = toMap(t.x, t.z);
      mctx.fillStyle = '#f2c230';
      mctx.beginPath(); mctx.arc(mx, my, 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#f2c230'; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(mx, my, 9, 0, Math.PI * 2); mctx.stroke();
    }
    // Police cars.
    mctx.fillStyle = '#4d8dff';
    for (const car of G.policeCars) {
      const [mx, my] = toMap(car.x, car.z);
      mctx.beginPath(); mctx.arc(mx, my, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(G.player.x, G.player.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - G.player.angle);
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  function showToast(text, seconds) {
    const el = $('hud-toast');
    el.textContent = text;
    el.classList.add('show');
    toastTimer = seconds || 3;
  }

  function update(dt) {
    const p = G.player;
    $('hud-cash').textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
    $('hud-car').textContent = p.car ? `🚗 ${p.car.type.toUpperCase()} — E to exit` : 'On foot — E near a car to steal it';
    const hp = Math.max(0, Math.round(p.health));
    $('hud-health-fill').style.width = `${hp}%`;
    $('hud-health-fill').style.background = hp > 50 ? '#27ae60' : hp > 25 ? '#f2c230' : '#e74c3c';
    $('hud-health-text').textContent = `${hp}`;
    const stars = $('hud-stars');
    stars.textContent = '★'.repeat(G.wanted.stars) + '☆'.repeat(5 - G.wanted.stars);
    stars.classList.toggle('hot', G.wanted.stars > 0);
    const hh = String(Math.floor(G.clockMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(G.clockMinutes % 60)).padStart(2, '0');
    $('hud-clock').textContent = `${hh}:${mm}`;
    $('hud-ammo').textContent = p.car ? `▸ ${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : `▸ ${p.ammo} ammo`;
    $('hud-objective').textContent = objectiveText(G);
    const banner = $('hud-banner');
    if (G.banner && G.time < G.banner.until) {
      $('hud-banner-title').textContent = G.banner.title;
      $('hud-banner-sub').textContent = G.banner.sub;
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('hud-toast').classList.remove('show');
    }
    $('hud-hint').textContent = p.car
      ? 'WASD drive · Space brake · E exit car · P pause · M mute'
      : 'WASD move · Shift run · E enter car · Click shoot · P pause · M mute';
    drawMinimap();
  }

  return { update, showToast };
}
