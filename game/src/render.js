// Drawing only: game state in, pixels out. A smooth follow camera, a top-down
// procedural city (roads, sidewalks, buildings with sun shadows, parks, beach
// and water), cars, pedestrians, the player, particles and a dusk light tint.
// All art is drawn from code — no image files anywhere.
import { WORLD } from './config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 800;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * ratio);
    canvas.height = Math.round(viewH * ratio);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const s = car.spec;
    // Soft shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    roundRect(-s.len / 2 + 3, -s.wid / 2 + 4, s.len, s.wid, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = s.color;
    roundRect(-s.len / 2, -s.wid / 2, s.len, s.wid, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Windows + roof.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(-s.len * 0.18, -s.wid / 2 + 4, s.len * 0.28, s.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(-s.len * 0.05, -s.wid / 2 + 4, s.len * 0.05, s.wid - 8, 3);
    ctx.fill();
    // Headlights / taillights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(s.len / 2 - 3, -s.wid / 2 + 3, 3, 6);
    ctx.fillRect(s.len / 2 - 3, s.wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-s.len / 2, -s.wid / 2 + 3, 3, 6);
    ctx.fillRect(-s.len / 2, s.wid / 2 - 9, 3, 6);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#222';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-s.len / 2 + 8 + i * 9, -3, 5, 6);
    }
    if (car.police) {
      // Flashing light bar: red on one side, blue on the other, alternating.
      const phase = Math.floor(time * 4 + car.lightPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2222' : '#2266ff';
      ctx.fillRect(-6, -s.wid / 2 + 2, 12, 7);
      ctx.fillStyle = phase ? '#2266ff' : '#ff2222';
      ctx.fillRect(-6, s.wid / 2 - 9, 12, 7);
      ctx.fillStyle = '#fff';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 2, 3);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, pants, skin, phase, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.sin(phase) * 1.5;
    // Legs (two small steps).
    ctx.fillStyle = pants;
    ctx.fillRect(-5 + bob, 2, 4, 8);
    ctx.fillRect(1 - bob, 2, 4, 8);
    // Body, rotated to face the walking direction.
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(-8, -9, 16, 18, 7);
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -12, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(0, -13.5, 6.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(G) {
    const city = G.city;
    const cam = G.camera;
    const time = G.time;
    const dusk = G.timeOfDay === 'dusk';
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    const vx0 = cam.x - 60;
    const vy0 = cam.y - 60;
    const vx1 = cam.x + viewW + 60;
    const vy1 = cam.y + viewH + 60;
    const S = WORLD.size;

    // Ground: grass everywhere; the city sits on it.
    ctx.fillStyle = dusk ? '#6d8a52' : '#79a75e';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

    // Beach sand + water along the south edge.
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, WORLD.beachTop, S, WORLD.waterTop - WORLD.beachTop);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(0, WORLD.waterTop, S, S - WORLD.waterTop);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = WORLD.waterTop + 14 + i * 16;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 60) {
        const y = wy + Math.sin(x / 90 + time * 1.4 + i) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = dusk ? '#4f7a44' : '#5da24e';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sidewalk blocks (the pale slabs between roads).
    ctx.fillStyle = '#b3ac9c';
    for (let bx = 0; bx < WORLD.roadCenters.length - 1; bx += 1) {
      for (let by = 0; by < WORLD.roadCenters.length - 1; by += 1) {
        const x0 = WORLD.roadCenters[bx] + WORLD.roadWidth / 2;
        const y0 = WORLD.roadCenters[by] + WORLD.roadWidth / 2;
        const w = WORLD.roadPitch - WORLD.roadWidth;
        ctx.fillRect(x0, y0, w, w);
      }
    }

    // Roads: asphalt bands + dashed centre lines.
    ctx.fillStyle = '#3a3f47';
    for (const c of WORLD.roadCenters) {
      ctx.fillRect(0, c - WORLD.roadWidth / 2, S, WORLD.roadWidth);
      ctx.fillRect(c - WORLD.roadWidth / 2, 0, WORLD.roadWidth, S);
    }
    ctx.strokeStyle = 'rgba(242,194,48,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (const c of WORLD.roadCenters) {
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(S, c); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (const c of WORLD.roadCenters) {
      ctx.strokeRect(c - WORLD.roadWidth / 2 + 2, 0, WORLD.roadWidth - 4, S);
      ctx.strokeRect(0, c - WORLD.roadWidth / 2 + 2, S, WORLD.roadWidth - 4);
    }

    // Buildings: sun shadow, body, roof detail, windows as a roof grid.
    for (const b of city.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
      const shx = b.height * 0.55;
      const shy = b.height * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + shx, b.y + shy, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Rooftop details: vents / AC boxes, and a helipad on the tallest.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3 + b.windows) % 3 === 0) {
            ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 9);
          }
        }
      }
      if (b.height > 22) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
      }
    }

    // Trees and lamps.
    for (const t of city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      if (t.palm) {
        ctx.strokeStyle = '#7a5a38';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 3, t.y - 8); ctx.stroke();
        ctx.fillStyle = '#3f8f4f';
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          ctx.beginPath();
          ctx.ellipse(t.x + 3 + Math.cos(a) * 7, t.y - 8 + Math.sin(a) * 7, 8, 3.5, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.arc(t.x + 3, t.y + 3, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e7d46';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3f9e58';
        ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const lamp of city.lamps) {
      if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
      ctx.fillStyle = '#2c313a';
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2); ctx.fill();
      if (dusk) {
        ctx.fillStyle = 'rgba(255,220,120,0.35)';
        ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 12, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Pickups: health crosses and ammo boxes.
    for (const pk of G.pickups) {
      const bob = Math.sin(time * 3 + pk.x) * 2;
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(pk.x - 9, pk.y - 9 + bob, 18, 18);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(pk.x - 2.5, pk.y - 7 + bob, 5, 14);
        ctx.fillRect(pk.x - 7, pk.y - 2.5 + bob, 14, 5);
      } else {
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(pk.x - 9, pk.y - 7 + bob, 18, 14);
        ctx.fillStyle = '#222';
        ctx.font = `bold 10px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AMMO', pk.x, pk.y + bob);
      }
    }

    // Mission waypoint: pulsing diamond + light beam.
    const target = G.missionTarget;
    if (target) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ctx.fillStyle = 'rgba(242,194,48,0.25)';
      ctx.beginPath(); ctx.arc(target.x, target.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2c230';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f2c230';
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.fillStyle = '#222';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', target.x, target.y + 1);
    }

    // Cars (traffic, parked, police, player's).
    for (const car of G.cars) drawCar(car, time);
    for (const car of G.policeCars) {
      if (!car.despawn) drawCar(car, time);
      // Siren glow on the road.
      const phase = Math.floor(time * 4 + car.lightPhase) % 2 === 0;
      ctx.fillStyle = phase ? 'rgba(255,40,40,0.20)' : 'rgba(40,110,255,0.20)';
      ctx.beginPath(); ctx.arc(car.x, car.y, 44, 0, Math.PI * 2); ctx.fill();
    }

    // Pedestrians + foot cops.
    for (const ped of G.peds) {
      if (ped.down > 0) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(0.6);
        ctx.fillStyle = ped.shirt;
        roundRect(-11, -6, 22, 12, 5);
        ctx.fill();
        ctx.fillStyle = ped.skin;
        ctx.beginPath(); ctx.arc(13, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.skin, ped.walkPhase);
      }
    }
    for (const cop of G.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1c2f4a', '#141c28', '#e8b88a', time * 10);
      ctx.fillStyle = '#1c2f4a';
      ctx.beginPath(); ctx.arc(cop.x, cop.y - 12, 7, Math.PI, Math.PI * 2); ctx.fill();
    }

    // The player: on foot a walker in a teal jacket; in a car the car itself
    // gets a soft highlight ring so the eye finds it in a chase.
    const p = G.player;
    if (p.car) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.car.x, p.car.y, p.car.spec.len * 0.72, 0, Math.PI * 2); ctx.stroke();
    } else {
      const blink = p.invulnerable > 0 && Math.floor(time * 10) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.angle, '#19b8a6', '#2c3e50', '#f0c8a0', time * (p.running ? 14 : 8), 1.05);
        // Aim line while the pistol is out.
        if (G.aimAngle !== null && G.aimAngle !== undefined) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(G.aimAngle) * 18, p.y + Math.sin(G.aimAngle) * 18);
          ctx.lineTo(p.x + Math.cos(G.aimAngle) * 44, p.y + Math.sin(G.aimAngle) * 44);
          ctx.stroke();
        }
        if (G.combat.muzzle > 0) {
          const a = G.aimAngle ?? p.angle;
          ctx.fillStyle = '#ffe27a';
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Bullets as tracers, particles as fading sparks / smoke.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2.5;
    for (const b of G.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of G.particles) {
      const a = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * a + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Off-screen waypoint arrow: point the player at the mission from anywhere.
    if (target && G.state === 'playing') {
      const sx = target.x - cam.x;
      const sy = target.y - cam.y;
      if (sx < 60 || sx > viewW - 60 || sy < 60 || sy > viewH - 60) {
        const cx = viewW / 2;
        const cy = viewH / 2;
        const a = Math.atan2(sy - cy, sx - cx);
        const ex = Math.max(50, Math.min(viewW - 50, cx + Math.cos(a) * (Math.min(viewW, viewH) / 2 - 70)));
        const ey = Math.max(90, Math.min(viewH - 60, cy + Math.sin(a) * (Math.min(viewW, viewH) / 2 - 70)));
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#f2c230';
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#f2c230';
        ctx.font = `bold 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(Math.hypot(target.x - p.x, target.y - p.y))}m`, ex, ey + 30);
      }
    }

    // Light tint: golden hour for dusk, a faint warm wash for day.
    if (dusk) {
      ctx.fillStyle = 'rgba(255,122,40,0.13)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.fillStyle = 'rgba(30,20,60,0.05)';
      ctx.fillRect(0, 0, viewW, viewH);
    } else {
      ctx.fillStyle = 'rgba(255,240,200,0.05)';
      ctx.fillRect(0, 0, viewW, viewH);
    }
    // Vignette.
    const grad = ctx.createRadialGradient(
      viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42,
      viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  return { draw, resize, viewSize: () => ({ w: viewW, h: viewH }) };
}
