// The player, on foot and behind the wheel: movement, entering/exiting cars,
// and the crime hooks (stealing a witnessed car raises the wanted level).
import { PLAYER } from './config.js';
import { stepPlayerCar } from './traffic.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,   // facing up the street
    health: PLAYER.healthMax,
    cash: 150,
    ammo: 24,
    car: null,             // the car object being driven, or null on foot
    moving: false,
    running: false,
    invulnerable: 0,
    bustTimer: 0,
  };
}

// On-foot step: WASD velocity, building collision, world bounds.
export function stepPlayerOnFoot(city, player, move, running, dt) {
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.moving = move.x !== 0 || move.y !== 0;
  player.running = running && player.moving;
  if (player.moving) {
    player.angle = Math.atan2(move.y, move.x);
    player.x += move.x * speed * dt;
    player.y += move.y * speed * dt;
    city.collideCircle(player, PLAYER.radius);
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

// Driving step: W/S throttle + brake, A/D steer, Space handbrake.
export function stepPlayerDriving(city, player, input, dt) {
  const car = player.car;
  if (!car) return;
  const move = input.move();
  const steer = -move.x; // A = left: in screen space, left is negative x... handled by caller angle
  // Steering: pressing left (A) should turn the car counter-clockwise.
  const steerInput = (move.x === 0 ? 0 : move.x);
  const throttle = move.y < 0 ? 1 : 0;      // W / Up = accelerate
  const reverse = move.y > 0 ? 1 : 0;       // S / Down = reverse (or brake while moving)
  const braking = input.brake() || (reverse && car.speed > 20);
  if (reverse && car.speed <= 20) {
    // Reverse gear: feed negative throttle through the same physics.
    car.speed -= car.spec.accel * 0.6 * dt;
    car.speed = Math.max(-120, car.speed);
    car.angle += steerInput * car.spec.turn * 0.5 * dt * -1;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  } else {
    stepPlayerCar(car, steerInput, throttle, braking, dt);
  }
  const hitWall = city.collideCar(car, car.spec.len / 2 - 4);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  if (hitWall && Math.abs(car.speed) > 140) {
    car.speed *= 0.35;
    return 'crash';
  }
  return null;
}

// Nearest enterable car within reach (not a police car already chasing you).
export function nearestCar(cars, player) {
  let best = null;
  let bestDist = PLAYER.enterRange;
  for (const car of cars) {
    if (car.police && car.chasing) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  return best;
}

// Get in: returns 'stole' when the car had a driver / was not yours, else 'entered'.
// Get out: leaves the player standing beside the car.
export function enterExitCar(player, car) {
  if (player.car) {
    const old = player.car;
    old.playerDriven = false;
    player.car = null;
    const side = old.angle + Math.PI / 2;
    player.x = old.x + Math.cos(side) * 34;
    player.y = old.y + Math.sin(side) * 34;
    player.angle = old.angle;
    return 'exited';
  }
  if (!car) return null;
  const stolen = car.traffic || car.parked;
  car.parked = false;
  car.traffic = false;
  car.playerDriven = true;
  car.speed = 0;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return stolen ? 'stole' : 'entered';
}
