import {Battle, Dex} from '@pkmn/sim';
import {FORMAT, type PlayerSetInfo} from './puzzle';

/**
 * The player's team exactly as the battle will start it: loads the packed
 * team into a sim battle and reads back stats, HP, PP and display names.
 * Used at build time so the home screen can show sets without the sim.
 */
export function playerSetInfo(packedTeam: string): PlayerSetInfo[] {
  const battle = new Battle({formatid: FORMAT as never, seed: 'sodium,00000000000000000000000000000000'});
  battle.setPlayer('p1', {name: 'Player', team: packedTeam});
  const side = battle.sides[0];
  return side.team.map(set => {
    const p = side.pokemon.find(mon => mon.set === set)!;
    const item = p.getItem().name;
    return {
      species: p.species.name,
      level: p.level,
      types: p.getTypes(),
      ability: Dex.abilities.get(p.ability).name,
      ...(item ? {item} : {}),
      teraType: p.teraType,
      maxhp: p.maxhp,
      stats: {...p.storedStats},
      moves: p.moveSlots.map(m => ({name: m.move, type: Dex.moves.get(m.id).type, pp: m.maxpp})),
    };
  });
}
