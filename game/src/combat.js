// Combat: pistol (mouse aim, click to shoot) and fists when the clip is dry.
// Bullets fly straight, spark on buildings, and hit peds, cops and cars.
// Every shot is a crime the wanted system hears about.
import { COMBAT } from './config.js';
import { addCrime } from './police.js';

export function makeCombat() {
  return { cooldown: 0, muzzle: 0 };
}

// Aim angle from the player to the mouse cursor, in world space.
export function aimAngle(G) {
  const mouse = G.input.mouse();
  const wx = G.camera.x + mouse.x;
  const wy = G.camera.y + mouse.y;
  return Math.atan2(wy - G.player.y, wx - G.player.x);
}

export function updateCombat(G, dt) {
  const c = G.combat;
  c.cooldown -= dt;
  if (c.muzzle > 0) c.muzzle -= dt;
  const mouse = G.input.mouse();
  if (!mouse.down || c.cooldown > 0) return;
  if (G.player.car) return; // no drive-bys in this build — get out to fight
  if (G.state !== 'playing') return;

  if (G.player.ammo > 0) {
    c.cooldown = COMBAT.pistolCooldown;
    c.muzzle = 0.08;
    G.player.ammo -= 1;
    const a = aimAngle(G);
    G.bullets.push({
      x: G.player.x + Math.cos(a) * 20,
      y: G.player.y + Math.sin(a) * 20,
      vx: Math.cos(a) * COMBAT.bulletSpeed,
      vy: Math.sin(a) * COMBAT.bulletSpeed,
      life: COMBAT.pistolRange / COMBAT.bulletSpeed,
    });
    G.gunshotAt = { x: G.player.x, y: G.player.y };
    G.audio.shot();
    addCrime(G, 1, 'Shots fired — the SBPD heard that.');
  } else {
    // Fists: a short swing at whatever is closest.
    c.cooldown = COMBAT.fistCooldown;
    const a = aimAngle(G);
    const hx = G.player.x + Math.cos(a) * COMBAT.fistRange;
    const hy = G.player.y + Math.sin(a) * COMBAT.fistRange;
    let hitAny = false;
    for (const ped of G.peds) {
      if (!ped.down && Math.hypot(ped.x - hx, ped.y - hy) < 30) {
        ped.down = 3;
        ped.fleeing = 3;
        hitAny = true;
      }
    }
    for (const cop of G.cops) {
      if (Math.hypot(cop.x - hx, cop.y - hy) < 30) {
        cop.x += Math.cos(a) * 60;
        cop.y += Math.sin(a) * 60;
        hitAny = true;
        addCrime(G, 1, 'You decked a cop!');
      }
    }
    if (hitAny) G.audio.thud();
  }
}

// Move bullets and resolve hits.
export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    // Buildings stop bullets with a spark.
    for (const c of G.city.colliders) {
      if (b.x > c.x && b.x < c.x + c.w && b.y > c.y && b.y < c.y + c.h) {
        b.dead = true;
        G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#ffd34d', size: 4, spark: true });
        break;
      }
    }
    if (b.dead) continue;
    for (const ped of G.peds) {
      if (!ped.down && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        ped.down = 4;
        ped.fleeing = 4;
        b.dead = true;
        addCrime(G, 1, 'Pedestrian down — witnesses called it in.');
        break;
      }
    }
    if (b.dead) continue;
    for (const cop of G.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
        cop.x += (b.vx / COMBAT.bulletSpeed) * 30;
        cop.y += (b.vy / COMBAT.bulletSpeed) * 30;
        cop.holdTimer = 0;
        b.dead = true;
        addCrime(G, 1, 'You shot a cop! Every unit is coming.');
        break;
      }
    }
    if (b.dead) continue;
    for (const car of [...G.cars, ...G.policeCars]) {
      if (Math.hypot(car.x - b.x, car.y - b.y) < car.spec.len / 2) {
        b.dead = true;
        G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ff9a3d', size: 5, spark: true });
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}
