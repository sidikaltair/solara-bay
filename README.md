# Solara Bay — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sidikaltair/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete top-down open-world crime game in the spirit of GTA 1/2, built for
the [gta6-01 "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666,
top 100 paid). Vanilla JavaScript, zero libraries, zero network requests —
every pixel is drawn from code and every sound is synthesised with WebAudio.

You came to Solara Bay with $150 and a name nobody knows. Mara Voss, the fixer
who runs the bay, has five jobs for you — if you can drive, run, and disappear
fast enough to survive them.

## Play

Serve it locally (no build step) and open http://localhost:8080:

```sh
node serve.ts
```

Or open `game/index.html` directly from any static file server. It runs fully
offline in a desktop browser.

| Key | Action |
| --- | --- |
| WASD / arrows | Move (on foot) / drive (in a car) |
| Shift | Run |
| E | Enter / exit a car (steal any car on the street) |
| Mouse + click | Aim and shoot the pistol (fists when the clip is dry) |
| Space | Brake / handbrake |
| P / Esc | Pause |
| M | Mute |

## What's in the bay

- **A living city** — a seeded 2640×2640 grid city: roads, procedural
  buildings with sun shadows and rooftop helipads, parks, a boardwalk, a beach
  and the water's edge. Same seed, same city.
- **Cars & traffic** — six car types (sedan, taxi, van, sports car, truck,
  police interceptor). Traffic keeps to its lane, yields, and turns at
  intersections. Steal any car — if someone sees you, the heat goes up.
- **Pedestrians** — they walk the sidewalks, cross at intersections, and flee
  from gunshots and speeding cars.
- **Wanted & police** — 0–5 stars. Crimes (theft, hitting peds, shooting,
  decking a cop) raise the heat; SBPD interceptors chase and ram, foot cops
  chase you down and bust you. Lay low and the stars fall.
- **Five missions for Mara Voss** — steal a getaway car, a 90-second package
  run, losing a 3-star heat, a getaway pickup under pursuit, and the final
  Bay Job heist. Waypoint markers, minimap blips, objective banner, dialogue,
  cash payouts.
- **Combat** — pistol with mouse aim, fists, health/ammo pickups.
- **HUD & minimap** — cash, health, wanted stars, clock, ammo, live circular
  minimap with police blips and the mission marker.
- **Save / load** — progress, cash and position persist in localStorage;
  continue from the title screen.
- **Sound** — WebAudio synth: engine hum that follows your speed, sirens,
  gunshots, crashes, pickup blips and a bass groove. No audio files.

## Shots

`shots.json` lists the four deterministic screenshot scenes
(`?shot=chase|foot|mission|dusk&seed=1`): the police chase cover, on foot
downtown, the package run, and a dusk drive down to the beach.

## Files

- `game/` — the playable game (`index.html` + `src/*.js`, ES modules)
- `screenshots/` — the four entry screenshots (1280×800 JPEG)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output dir and writes `dossier.json`
- `serve.ts` — tiny static server for local play-testing
- `vendor/makefun-game.ts` — the make.fun dossier library (kit file)

## License

MIT — see [LICENSE](LICENSE). Original IP only: the city of Solara Bay, Mara
Voss, and every name, character and asset in this game are original creations.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bf45yvhr&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
