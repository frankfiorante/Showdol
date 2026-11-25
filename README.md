# Showdol

A daily Pokémon battle. Each day, everyone gets the same Gen 9 Random Battle team and faces the same AI team. Damage rolls, crits and misses are rolled separately for each player. It runs entirely in the browser: no accounts, no backend, and no connection to Pokémon Showdown's servers.

See [PLAN.md](PLAN.md) for the full design and build phases.

> **Status:** Phase 4 (real UI). One game a day against a heuristic AI on a mobile-first battle screen with sprites, with a daily lock, a countdown to local midnight, and resume on reload. Stats, sharing and launch come in Phase 5.

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

To build and serve the static site:

```sh
pnpm build        # static export to out/
pnpm start        # serves out/
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Static export to `out/` |
| `pnpm typecheck` | TypeScript check |
| `pnpm gen:puzzle` | Generates and curates puzzle files (today by default). Takes `--from YYYY-MM-DD --days N`, plus `--battles`, `--min`, `--max` and `--rerolls` for curation. `--check` verifies existing files still regenerate to the same teams. Never changes an existing day's file unless given `--force` |
| `pnpm session:check` | Plays battles through `BattleSession` with a random player, checking invariants and resuming each one from a random save point. Takes `--n 300` and `--print` |
| `pnpm ai:check random\|mirror\|duel` | AI harness: AI vs random bot (both sides), AI vs AI on each day's matchup, or variant weights (`--weights '{"setup":60}'`) vs the defaults with paired seeds |
| `pnpm ai:watch YYYY-MM-DD` | Prints a compact log of one AI-vs-AI battle on that day's matchup |
| `pnpm sprites:fetch` | Downloads any missing sprites for species Gen 9 Random Battle can roll into `public/sprites/gen5/` and rewrites the index (`--dry-run` lists them) |
| `pnpm daily:check` | Unit checks for dates, puzzle numbers, the save format and the daily lock (runs in a time zone with daylight saving time) |
| `pnpm spike:bots` | Random bot vs random bot on a puzzle, in Node. Takes `--date`, `--n` and `--replay` |
| `pnpm spike:size` | JS bundle sizes after a build: what loads up front and what loads on demand |

## How it works

- **Daily puzzles** are generated at build time by `scripts/gen-puzzle.ts`, one JSON file per date in `public/puzzles/`. Seeds come from the date, so the same code and package versions always give the same files. Each matchup is played AI vs AI and rerolled if it's lopsided. The files are committed so a day's teams never change once published. The browser fetches only today's file.
- **The AI** (`src/ai/`) scores every legal option with `@smogon/calc` damage estimates, plus speed, status, setup, hazard, recovery and switching heuristics, and occasionally takes a close runner-up. It sees the player's full team.
- **The battle** runs in a Web Worker (`src/worker/battle.worker.ts`) that loads only when the player presses Play. Inside it, `BattleSession` (`src/engine/session.ts`) drives the `@pkmn/sim` simulator and the opponent. It feeds only the player's side of the battle messages to an `@pkmn/client` battle, so the UI never sees information the player shouldn't have.
- **The UI** (`src/ui/`) gets a plain, serializable `BattleView` (`src/engine/view.ts`) plus formatted log lines after each choice, and sends back choices like `move 2 terastallize` or `switch 4`.
- **Daily lock and resume** (`src/game/`): everything is saved in localStorage under `showdol:v1`. Pressing Play saves the day's record with a fresh battle seed and AI seed, and every choice is appended to its input log. On reload, the worker replays the log on the same seed to restore the exact battle. The AI's past choices come from the log, and each new decision gets its own seed, so resuming never changes what the AI does.

## Project layout

```text
app/                 Next.js pages: home + battle (/), Phase 0 timing page (/spike)
src/ai/              Heuristic AI and the sim-to-damage-calc bridge
src/engine/          Battle session, battle runner, view types, random bot, puzzle types (runs in Node and the worker)
src/game/            Dates and puzzle numbers, saved data, daily lock rules
src/worker/          Web Worker entry points and message types
src/ui/              React battle screen, worker hook, formatting helpers
scripts/             Puzzle generation and curation, test and AI harnesses, bundle measurement
public/puzzles/      Generated daily puzzle files
public/sprites/gen5/ Self-hosted Pokémon sprites and their species index
```

## Dependencies and licensing

The simulator and battle libraries (`@pkmn/sim`, `@pkmn/randoms`, `@pkmn/client`, `@pkmn/protocol`, `@pkmn/view`, `@pkmn/data`) and `@smogon/calc` are MIT-licensed. The battle UI is written from scratch, with no code from Pokémon Showdown's AGPL-licensed client.

`@pkmn/sim` and `@pkmn/randoms` are pinned to exact versions because upgrading them changes the teams generated from the same seed. Upgrade them only between batches of generated days.

Sprites are the Gen 5-style sprites used by Pokémon Showdown, including the Smogon Sprite Project's sprites for later Pokémon, self-hosted with credit (see `/credits`). No sprite set licenses the images themselves, since the art belongs to Nintendo/Game Freak/The Pokémon Company.

Showdol is a non-commercial fan project. Pokémon and its names are trademarks of Nintendo, Game Freak and The Pokémon Company.
