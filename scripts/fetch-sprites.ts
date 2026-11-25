/**
 * Downloads the Gen 5-style sprites for every Pokémon Gen 9 Random Battle can
 * roll (plus battle-only formes they can change into) and writes an index so
 * the UI can find a sprite by species name. Files are committed; this only
 * needs rerunning when the randoms package adds species.
 *
 *   pnpm sprites:fetch --dry-run   # list what would be fetched
 *   pnpm sprites:fetch             # download missing files
 *
 * Source: Pokémon Showdown's sprite server (Gen 5 sprites, and Smogon Sprite
 * Project sprites for later Pokémon). Images © Nintendo / Creatures Inc. /
 * GAME FREAK Inc. / The Pokémon Company; see the credits page.
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Dex, toID, type Species} from '@pkmn/sim';
import {TeamGenerators} from '@pkmn/randoms';
import {FORMAT} from '@/engine/puzzle';

const SOURCE = 'https://play.pokemonshowdown.com/sprites/gen5';
const outDir = join(import.meta.dirname, '..', 'public', 'sprites', 'gen5');
const dryRun = process.argv.includes('--dry-run');

const generator = TeamGenerators.getTeamGenerator(FORMAT) as unknown as {randomSets: Record<string, unknown>};

/** Every species name that can appear in battle, mapped to its sprite id. */
const index = new Map<string, string>();
const add = (s: Species) => {
  if (!s.exists) return;
  index.set(toID(s.name), s.spriteid);
  // Cosmetic formes (Vivillon patterns, Florges colors, ...) share the base sprite.
  for (const name of s.cosmeticFormes ?? []) index.set(toID(name), s.spriteid);
};
for (const id of Object.keys(generator.randomSets)) {
  const species = Dex.species.get(id);
  add(species);
  // Formes it can change into mid-battle (Palafin-Hero, Mimikyu-Busted, Terapagos-Stellar, ...).
  for (const name of species.otherFormes ?? []) {
    const forme = Dex.species.get(name);
    // Skip formes Gen 9 can't use (Megas, Primals, ...).
    if (forme.battleOnly && !forme.isNonstandard) add(forme);
  }
}

const spriteIds = [...new Set(index.values())].sort();
console.log(`${Object.keys(generator.randomSets).length} species in the random sets → ${index.size} names → ${spriteIds.length} sprites`);

if (dryRun) {
  console.log(spriteIds.join(' '));
  process.exit(0);
}

mkdirSync(outDir, {recursive: true});
const missing: string[] = [];
let fetched = 0, bytes = 0;

async function fetchOne(id: string) {
  const file = join(outDir, `${id}.png`);
  if (existsSync(file)) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${SOURCE}/${id}.png`, {headers: {'User-Agent': 'showdol-build (non-commercial fan project)'}});
    if (res.status === 404) break;
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, buf);
    fetched++;
    bytes += buf.length;
    return;
  }
  missing.push(id);
}

// A few at a time, to be gentle on the server.
const queue = [...spriteIds];
await Promise.all(Array.from({length: 4}, async () => {
  for (let id = queue.shift(); id; id = queue.shift()) await fetchOne(id);
}));

const available = new Set(spriteIds.filter(id => existsSync(join(outDir, `${id}.png`))));
// A forme without its own sprite (e.g. Greninja-Bond) uses its base species' sprite.
const resolve = (name: string, sprite: string) =>
  available.has(sprite) ? sprite : [Dex.species.get(Dex.species.get(name).baseSpecies).spriteid].find(id => available.has(id));
const out = Object.fromEntries(
  [...index].map(([name, sprite]) => [name, resolve(name, sprite)] as const).filter(([, s]) => s).sort(),
);
writeFileSync(join(outDir, 'index.json'), JSON.stringify(out) + '\n');

console.log(`fetched ${fetched} (${(bytes / 1024).toFixed(0)} KB), ${available.size}/${spriteIds.length} available`);
const noSprite = [...index.keys()].filter(name => !(name in out));
if (missing.length) console.log(`not on the server: ${missing.join(', ')}`);
console.log(noSprite.length ? `no sprite at all (UI shows a placeholder): ${noSprite.join(', ')}` : 'every species has a sprite (some formes use their base species)');
