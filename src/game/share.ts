import type {GameRecord} from './storage';

export type ShareableResult = Pick<GameRecord, 'puzzleNumber' | 'turns' | 'myFainted' | 'aiRemaining' | 'forfeited' | 'abandoned'> & {
  won: boolean;
};

const turnsText = (n?: number) => (n === undefined ? '' : ` in ${n} ${n === 1 ? 'turn' : 'turns'}`);

/**
 * The spoiler-free share text from PLAN.md:
 *
 *   Showdol #12 · W in 23 turns
 *   🟩🟩⬛🟩⬛⬛
 *   showdol.example
 */
export function shareText(r: ShareableResult, host?: string): string {
  let headline: string;
  if (r.won) headline = `W${turnsText(r.turns)}`;
  else if (r.forfeited) headline = 'L (forfeit)';
  else if (r.abandoned) headline = 'L (unfinished)';
  else headline = `L${turnsText(r.turns)}${r.aiRemaining !== undefined ? ` (${r.aiRemaining} left)` : ''}`;

  const lines = [`Showdol #${r.puzzleNumber} · ${headline}`];
  if (r.myFainted) lines.push(r.myFainted.map(f => (f ? '⬛' : '🟩')).join(''));
  if (host) lines.push(host);
  return lines.join('\n');
}
