# Meridian Bay

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/thekni8/gta6-open-world/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/thekni8/gta6-open-world/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game built for make.fun's **Make GTA 6** competition
(`gta6-01`). Everything in it — the city, the characters, the crews, the story —
is invented for this game. No affiliation with any existing game series.

## The game

**Meridian Bay** is a sun-soaked fictional coastal city: a marina district,
downtown towers, old-town streets, a beachfront boardwalk and a container port.
You are **Kai Mercer**, a driver-for-hire pulled into a turf war between the
**Harbor Kings** (dockside smugglers) and the **Vesper Syndicate** (nightclub
money). Five missions carry the story from a delivery gone wrong to a final
choice between the two crews.

## What's in it

- A drivable 3D city (Three.js, vendored) — on foot or behind the wheel, with
  arcade driving, handbrake turns, skid marks and damage states
- Traffic and pedestrians with simple AI — both flee when trouble starts
- A 1–5 star wanted system: police cruisers chase, ram, and throw T-bone
  roadblocks at high heat; lay low to cool off
- A 5-mission story arc with objectives, minimap markers, rewards and
  fail/restart
- Combat: a 9mm pistol with muzzle flash, tracers, hit sparks and floating
  damage numbers, plus melee
- A live canvas minimap, a full-map overlay, health/cash/stars HUD, and a
  weapon badge with ammo readout
- Synthesized WebAudio sound (engine, sirens, gunshots, a chord-pad loop) —
  no audio files
- localStorage saves: mission progress, cash and position

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Orbit camera / aim |
| Left click | Shoot |
| E | Enter / exit car |
| R | Reload |
| Shift | Sprint |
| Space | Handbrake |
| F | Headlights |
| M | Full map |
| Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is static files under `game/` — no build step, no network at runtime.
Three.js is vendored as `game/vendor/three.min.js` (0.160.0).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's `vendor/makefun-game.ts` library.

## Layout

```
game/
  index.html            page + HUD DOM
  style.css             HUD + menu styling
  vendor/three.min.js   vendored Three.js 0.160.0
  src/
    main.js             boot, game loop, state machine
    config.js           tuning constants
    input.js            keyboard + mouse
    world/              city generation, daylight
    player/             character, follow camera
    vehicles/           cars + driving, traffic AI
    people/             pedestrian AI
    police/             wanted level, chases, roadblocks
    missions/           story data, mission manager
    combat/             weapons, enemies
    ui/                 HUD, minimap, menus
    audio/              WebAudio synth
    effects/            particles, skid marks
    save/               localStorage save/load
    shots/              screenshot staging (debug scene setup)
    util/               seeded random helpers
```

## License

MIT — see [LICENSE](LICENSE).

<!-- Meridian Bay round 9 — witness touch -->
