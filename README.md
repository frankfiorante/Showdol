# Showdol

A daily Pokémon battle. Each day, everyone gets the same Gen 9 Random Battle team and faces the same AI team. Damage rolls, crits and misses are rolled separately for each player. It runs entirely in the browser: no accounts, no backend, and no connection to Pokémon Showdown's servers.

See [PLAN.md](PLAN.md) for the full design and build phases.

> **Status:** Phase 1 (playable core). The opponent is still a random-move bot, and there's no daily lock or resume yet.

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
| `pnpm gen:puzzle` | Generates today's puzzle file. Takes `--from YYYY-MM-DD --days N`, or `--check` to verify generation is deterministic without writing files |
| `pnpm session:check` | Plays battles through `BattleSession` with a random player, checking invariants and that seed + input log replay identically. Takes `--n 300` and `--print` |
| `pnpm spike:bots` | Random bot vs random bot on a puzzle, in Node. Takes `--date`, `--n` and `--replay` |
| `pnpm spike:size` | JS bundle sizes after a build: what loads up front and what loads on demand |

## How it works

- **Daily puzzles** are generated at build time by `scripts/gen-puzzle.ts`, one JSON file per date in `public/puzzles/`. Seeds come from the date, so the same package versions always give the same teams. The files are committed so a day's teams never change once published. The browser fetches only today's file.
- **The battle** runs in a Web Worker (`src/worker/battle.worker.ts`) that loads only when the player presses Play. Inside it, `BattleSession` (`src/engine/session.ts`) drives the `@pkmn/sim` simulator and the opponent. It feeds only the player's side of the battle messages to an `@pkmn/client` battle, so the UI never sees information the player shouldn't have.
- **The UI** (`src/ui/`) gets a plain, serializable `BattleView` (`src/engine/view.ts`) plus formatted log lines after each choice, and sends back choices like `move 2 terastallize` or `switch 4`.
- **Determinism:** each game has its own battle seed and an input log of every choice. Replaying the log on the same seed reproduces the battle exactly, which is the basis for resume in Phase 2.

## Project layout

```text
app/                 Next.js pages: home + battle (/), Phase 0 timing page (/spike)
src/engine/          Battle session, view types, random bot, puzzle types (runs in Node and the worker)
src/worker/          Web Worker entry points and message types
src/ui/              React battle screen, worker hook, formatting helpers
scripts/             Puzzle generation, test harnesses, bundle measurement
public/puzzles/      Generated daily puzzle files
```

## Dependencies and licensing

The simulator and battle libraries (`@pkmn/sim`, `@pkmn/randoms`, `@pkmn/client`, `@pkmn/protocol`, `@pkmn/view`, `@pkmn/data`) are MIT-licensed. The battle UI is written from scratch, with no code from Pokémon Showdown's AGPL-licensed client.

`@pkmn/sim` and `@pkmn/randoms` are pinned to exact versions because upgrading them changes the teams generated from the same seed. Upgrade them only between batches of generated days.

Showdol is a non-commercial fan project. Pokémon and its names are trademarks of Nintendo, Game Freak and The Pokémon Company.
