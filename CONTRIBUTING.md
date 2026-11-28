# Contributing to Showdol

Thanks for taking a look. Showdol is a small solo project, so here's what helps most and what to avoid.

## What's welcome

- **Bug reports.** Open an issue. Small, focused pull requests that fix bugs are welcome too.
- **Feedback on the AI**, such as a trick it always falls for or a move it should never make. Open an issue with the puzzle number and what happened.
- **Anything else** (features, redesigns, refactors, dependency upgrades): **open an issue first**, before writing code. Some parts of the project can't change without breaking published puzzles or players' saved games (see below), and I'd rather tell you that before you spend the time.

## Reporting a bug

Please include:

- The puzzle number (or "practice"), and your browser and device
- What you did, what you expected, and what happened instead
- For a bug during a battle, the turn and the battle log lines around it
- If you're still mid-game, an export code from the Stats page (taken before you finish or forfeit). For unfinished games it includes the battle seed and input log, which lets me replay your exact battle.

**No spoilers.** Every day's teams for the coming year are in `public/puzzles/`. Please don't post or discuss teams from days that haven't happened yet.

## Getting set up

Requires Node 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

The [README](README.md) explains how the pieces fit together and lists every script.

## Before you open a pull request

Run the same checks CI does:

```sh
pnpm typecheck
pnpm gen:puzzle --check   # every puzzle file still regenerates identically
pnpm daily:check
pnpm session:check
pnpm build
```

If you changed the battle screen, check it at phone width (about 390px wide) in both light and dark mode.

## Things that must not change

Players everywhere share the same puzzle each day, and games resume by replaying saved choices. That makes a few things permanent:

- **Published puzzle files.** Don't edit, regenerate or reformat anything in `public/puzzles/`. `gen:puzzle` refuses to rewrite an existing day without `--force`. Don't use `--force` in a pull request.
- **`@pkmn/sim` and `@pkmn/randoms` versions.** They're pinned on purpose. Upgrading either one changes the teams a seed generates and can break replaying games in progress. Please don't open upgrade PRs for them; I upgrade them by hand between batches of generated days.
- **Seeds and dates.** The seed derivation in `scripts/gen-puzzle.ts` and `LAUNCH_DATE` in `src/game/daily.ts` decide every day's teams and puzzle number.
- **The save format.** Everything lives in localStorage under `showdol:v1` (`src/game/storage.ts`). Changing the format means bumping `SCHEMA_VERSION` and adding a migration in `parseSave`. Older code refuses to overwrite a newer save, and backs up anything it can't read before writing, so a mistake shows up as missing stats rather than lost ones. Still, a bad migration is the easiest way to lose players' history. Old `SHOWDOL1-` export codes must keep importing.
- **What the player can see.** The UI only gets the player's side of the battle. Don't show the opponent's hidden sets, items or HP numbers.

## Changing the AI

AI changes (`src/ai/`) don't break saved games, because past AI choices come from the input log. They do change how hard every future day plays compared with its par, which was measured with the current AI. So please open an issue first, and back up weight changes with `pnpm ai:check duel` results.

## Code style

- Import `src/` modules through the `@/` alias (`import {x} from '@/engine/puzzle'`), not `../` relative paths.
- Match the surrounding code: TypeScript, React function components, no new UI frameworks.
- This uses a recent Next.js with breaking changes from older versions. Check the guides in `node_modules/next/dist/docs/` (see `AGENTS.md`) before relying on how things used to work.
- Don't add code from Pokémon Showdown's client, which is AGPL-licensed. The simulator and `@pkmn` libraries are MIT and fine to use.
- Keep it free and non-commercial: no ads, payment links or official Pokémon logos.

## License

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE). That covers code only, not sprites or Pokémon trademarks.
