import {formatPar, parVerdict, VERDICT_LABEL} from './par';
import {pokemonLeft} from './stats';
import type {GameRecord} from './storage';

export type ShareableResult = Pick<GameRecord, 'puzzleNumber' | 'turns' | 'myFainted' | 'aiRemaining' | 'forfeited' | 'abandoned' | 'par'> & {
  won: boolean;
};

const turnsText = (n?: number) => (n === undefined ? '' : ` in ${n} ${n === 1 ? 'turn' : 'turns'}`);

/**
 * The spoiler-free share text:
 *
 *   Showdol #12 · W · Beat par ⭐
 *   You: 5 Pokémon remaining, 22 turns
 *   Par: 3 Pokémon remaining, 30 turns
 *   🟩🟩⬛🟩🟩🟩
 *   showdol.example
 *
 * A loss keeps its headline (`L in 31 turns (AI had 2 Pokémon remaining)`) and still
 * shows par. Without a par (older puzzle files) a win reads `W in 23 turns`.
 */
export function shareText(r: ShareableResult, host?: string): string {
  const left = pokemonLeft(r);
  const mine = left !== undefined && r.turns !== undefined ? {left, turns: r.turns} : undefined;

  let headline: string;
  if (r.won && r.par && mine) headline = `W · ${VERDICT_LABEL[parVerdict(mine, r.par)]}`;
  else if (r.won) headline = `W${turnsText(r.turns)}`;
  else if (r.forfeited) headline = 'L (forfeit)';
  else if (r.abandoned) headline = 'L (unfinished)';
  else headline = `L${turnsText(r.turns)}${r.aiRemaining !== undefined ? ` (AI had ${r.aiRemaining} Pokémon remaining)` : ''}`;

  const lines = [`Showdol #${r.puzzleNumber} · ${headline}`];
  if (r.won && r.par && mine) lines.push(`You: ${formatPar(mine)}`);
  if (r.par) lines.push(`Par: ${formatPar(r.par)}`);
  if (r.myFainted) lines.push(r.myFainted.map(f => (f ? '⬛' : '🟩')).join(''));
  if (host) lines.push(host);
  return lines.join('\n');
}
