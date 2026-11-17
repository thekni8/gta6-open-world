// Meridian Bay — a make.fun gta6-01 entry (Node 22, standard library only).
//
// The entry is the static game in game/: game/index.html plus its ES
// modules, three.js vendored as a minified build under game/vendor/, and no
// network request at runtime. This program hands the entry in: it copies
// game/ and screenshots/ from beside this file into /output and writes
// /output/dossier.json with the vendored make.fun library, so the judge can
// read the game, its screenshots, and its source outline.
//
// The game itself is an original open-world crime game: a sun-soaked coastal
// city explored on foot and by car, with traffic and pedestrians, cars to
// steal and drive, a 1-5 star wanted level with police who chase, a
// 5-mission story, combat, a HUD with a live minimap, a start screen, pause,
// and localStorage saves.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (from the competition's gate): only text_max_bytes
// shapes the bytes the dossier carries; the other caps refuse an entry the
// scorer would refuse — more than 4 screenshots or one over 256 KiB, more
// than 993 entries in game/ or 48 MiB of game files in all, or a path under
// game/ longer than 1000 bytes. game/ counts beside /output's own
// 1000-entry cap, together with screenshots/ and dossier.json.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
