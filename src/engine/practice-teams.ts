import {Teams, type PRNGSeed} from '@pkmn/sim';
import {FORMAT} from './puzzle';

export interface TeamSeeds {
  player: string;
  ai: string;
}

/**
 * Two fresh Random Battle teams for a practice game, made the same way as the
 * daily puzzles' (scripts/gen-puzzle.ts) but with no curation. The generator
 * is imported on demand so daily games never download it.
 */
export async function generateTeams(seeds: TeamSeeds): Promise<{player: string; ai: string}> {
  const {TeamGenerators} = await import('@pkmn/randoms');
  const gen = (seed: string) => Teams.pack(TeamGenerators.getTeamGenerator(FORMAT, seed as PRNGSeed).getTeam());
  return {player: gen(seeds.player), ai: gen(seeds.ai)};
}
