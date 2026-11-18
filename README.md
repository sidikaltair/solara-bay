# Solara Bay 3D — a third-person open-world crime game

Rebuilt from the ground up in 3D third-person (Vice City Stories style) — recorded rebuild, November 2026.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete 3D third-person open-world crime game, built for the
[gta6-01 "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666,
top 100 paid). Low-poly 3D in the spirit of Vice City Stories: a visible
character, a drivable city, police chases and five jobs for the fixer who
runs the bay. Three.js (vendored, no network requests), vanilla JS ES
modules, procedural art, WebAudio synth — every model is built from code
and every sound is synthesised.

You came to Solara Bay with $150 and a name nobody knows. Mara Voss, the fixer
who runs the bay, has five jobs for you — if you can drive, run, and disappear
fast enough to survive them.

## Play

Serve it locally (no build step) and open http://localhost:8123:

```sh
node serve.mjs 8123
```

Or open `game/index.html` from any static file server. It runs fully
offline in a desktop browser.

| Key | Action |
| --- | --- |
| WASD | Move (on foot) / drive (in a car) |
| Shift | Run |
| E | Enter / exit a car (steal any car on the street) |
| Mouse drag | Look around (third-person camera follows you) |
| Click | Shoot the pistol |
| Space | Brake / handbrake |
| P / Esc | Pause |
| M | Mute |

## What's in the bay

- **A 3D city** — a 660×660-unit low-poly city: road grid, ~120 windowed
  buildings, parks, palms, a beach and the water's edge, day and golden-hour
  dusk lighting with shadows. Same seed, same city.
- **Cars & traffic** — six car types (sedan, taxi, van, sports car, truck,
  police interceptor). Traffic drives the streets, parks, and turns at
  intersections. Steal any car — if someone sees you, the heat goes up.
- **Pedestrians** — they walk the sidewalks, cross at intersections, and flee
  from gunshots and speeding cars.
- **Wanted & police** — 0–5 stars. Crimes (theft, hitting peds, shooting,
  decking a cop) raise the heat; SBPD interceptors with flashing light bars
  chase and ram, foot cops chase you down and bust you. Lay low and the stars
  fall.
- **Five missions for Mara Voss** — steal a getaway car, a 90-second package
  run, losing a 3-star heat, a getaway pickup under pursuit, and the final
  Bay Job heist. Glowing waypoint beam, minimap marker, objective banner,
  dialogue, cash payouts.
- **Combat** — pistol with mouse aim, foot cops at higher wanted levels,
  health/ammo pickups.
- **HUD & minimap** — cash, health, wanted stars, clock, speed, ammo, live
  circular minimap with police blips and the mission marker.
- **Save / load** — progress, cash and position persist in localStorage;
  continue from the title screen.
- **Sound** — WebAudio synth: engine hum that follows your speed, sirens,
  gunshots, crashes, pickup blips and a bass groove. No audio files.

## Shots

`shots.json` lists the four deterministic screenshot scenes
(`?shot=chase|foot|mission|dusk&seed=1`): the police chase cover, on foot
downtown, the Getaway Driver pickup, and a dusk drive down to the beach.

## Self-test

`?selftest=1` runs a scripted play-through (walk / steal / drive / mission 1 /
police spawn / shoot / save) and reports the result — 10/10 PASS.

## Files

- `game/` — the playable game (`index.html` + `src/*.js` ES modules +
  `vendor/three.module.js`, Three.js r160 vendored under MIT)
- `screenshots/` — the four entry screenshots (1280×800 JPEG)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output dir and writes `dossier.json`
- `serve.mjs` — tiny static server for local play-testing (`node serve.mjs 8123`)
- `serve.ts` — same, on port 8080 (`node serve.ts`)
- `vendor/makefun-game.ts` — the make.fun dossier library (kit file)

## License

MIT — see [LICENSE](LICENSE). Original IP only: the city of Solara Bay, Mara
Voss, and every name, character and asset in this game are original creations.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bf45yvhr&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
