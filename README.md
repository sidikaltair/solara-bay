# Solara Bay 3D — a third-person open-world crime game

Rebuilt from the ground up in 3D third-person (Vice City Stories style) — recorded rebuild, November 2026.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete 3D third-person open-world crime game, built for the
[gta6-01 "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666,
top 100 paid). Low-poly 3D in the spirit of Vice City Stories: a visible
character, a drivable city, police chases and five jobs for the fixer who
runs the bay. Three.js r160 loaded from CDN, vanilla JS ES modules,
procedural art, WebAudio synth — every model is built from code and every
sound is synthesised.

You came to Solara Bay with $150 and a name nobody knows. Mara Voss, the fixer
who runs the bay, has five jobs for you — if you can drive, run, and disappear
fast enough to survive them.

## Play

Serve it locally (no build step) and open http://localhost:8123:

```sh
node serve.mjs 8123
```

Or open `game/index.html` from any static file server. It needs internet
once, to load Three.js r160 from the unpkg CDN.

| Key | Action |
| --- | --- |
| WASD | Move (on foot) / drive (in a car) |
| Shift | Sprint |
| E | Enter / exit a car (steal any car on the street) |
| Mouse drag | Look around (third-person camera follows you) |
| Click | Shoot the pistol |
| R | Reload |
| Esc | Pause |
| M | Mute |

## What's in the bay

- **A 3D city** — a 660×660-unit low-poly city: road grid, windowed
  buildings, palms, a beach and the water's edge, day and golden-hour
  dusk lighting with shadows. Same seed, same city.
- **Cars & traffic** — traffic cars loop the road grid on rectangular
  routes; parked cars wait on the streets. Steal any car — if someone
  sees you take a traffic car, the heat goes up.
- **Pedestrians** — they walk the sidewalks and flee from gunshots.
- **Wanted & police** — 0–5 stars. Crimes (theft, shooting peds or cops,
  ramming a cop car) raise the heat; police interceptors with flashing
  light bars chase and ram, foot cops close in at 3+ stars. Lay low and
  the stars fall.
- **Five missions for Mara Voss** — First Job (reach the docks), Borrowed
  Wheels (steal a car, bring it to the garage), The Drop (deliver it to
  the beach), Loose Ends (disable 2 police cars), Getaway (lose the heat,
  reach the safehouse). Glowing waypoint beam, minimap marker, objective
  banner, cash payouts.
- **Combat** — pistol with mouse aim, muzzle flash and tracer, ammo +
  reload. Three hits disable a police car.
- **HUD & minimap** — cash, health, wanted stars, speed, ammo, live
  circular minimap with police blips and the mission marker.
- **Save / load** — money, mission progress, health, position and wanted
  level persist in localStorage; continue from where you left off.
- **Sound** — WebAudio synth: engine hum that follows your speed, sirens,
  gunshots, pickup blips and a mission jingle. No audio files.

## Shots

`?shot=1..4` stages the four deterministic screenshot scenes: the police
chase (1), the on-foot shootout (2), the mission waypoint (3), and the dusk
skyline (4). Screenshots live in `screenshots/` (1280×800 JPEG).

## Self-test

`?selftest=1` runs ten checks (Three.js loaded, renderer, world, player,
missions, movement, car enter/exit, waypoint beam, minimap, audio) and
reports the result — 10/10 PASS.

## Files

- `game/` — the playable game (`index.html` + `src/*.js` ES modules;
  Three.js r160 from the unpkg CDN, no vendored library)
- `game/src/` — `state.js` (shared state + helpers), `world.js` (seeded
  city), `player.js` (on-foot character), `car.js` (cars + arcade physics),
  `traffic.js` (traffic routes + parked cars), `police.js` (wanted + chase),
  `combat.js` (pistol + pedestrians), `missions.js` (5 chained jobs),
  `hud.js` (HUD + minimap), `audio.js` (WebAudio synth), `save.js`
  (localStorage + pause), `selftest.js` (10 checks), `shots.js`
  (screenshot staging), `main.js` (boot + game loop + camera + input)
- `screenshots/` — the four entry screenshots (1280×800 JPEG)
- `serve.mjs` — tiny static server for local play-testing (`node serve.mjs 8123`)

## License

MIT — see [LICENSE](LICENSE). Original IP only: the city of Solara Bay, Mara
Voss, and every name, character and asset in this game are original creations.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bf45yvhr&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
