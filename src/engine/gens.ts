import {Dex} from '@pkmn/sim';
import {Generations} from '@pkmn/data';

/**
 * @pkmn/data generations backed by the sim's own Dex, shared by the client
 * and the damage calc so there's only one copy of the data. Gen 9 Random
 * Battle can include anything the sim knows about, so nothing is filtered.
 */
export const gens = new Generations(Dex as never, () => true);
export const gen9 = gens.get(9);
