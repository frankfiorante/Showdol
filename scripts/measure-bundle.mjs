/**
 * Reports JS sizes in the static export: what index.html loads up front vs
 * what loads lazily (the battle worker). Run after `pnpm build`.
 */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {brotliCompressSync, gzipSync} from 'node:zlib';

const out = new URL('../out/', import.meta.url).pathname;
const chunksDir = join(out, '_next/static/chunks');
const html = readFileSync(join(out, 'index.html'), 'utf8');

const kb = n => `${(n / 1024).toFixed(0)} KB`.padStart(8);
const rows = readdirSync(chunksDir)
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const buf = readFileSync(join(chunksDir, f));
    return {
      f,
      raw: buf.length,
      gz: gzipSync(buf, {level: 9}).length,
      br: brotliCompressSync(buf).length,
      initial: html.includes(f),
      sim: buf.includes('gen9randombattle'),
    };
  })
  .sort((a, b) => b.raw - a.raw);

console.log(`${'chunk'.padEnd(36)}${'raw'.padStart(8)}${'gzip'.padStart(8)}${'brotli'.padStart(8)}  load`);
for (const r of rows) {
  const load = r.initial ? 'initial' : r.sim ? 'lazy (sim)' : 'lazy';
  console.log(`${r.f.padEnd(36)}${kb(r.raw)}${kb(r.gz)}${kb(r.br)}  ${load}`);
}
const sum = (xs, k) => xs.reduce((a, r) => a + r[k], 0);
const initial = rows.filter(r => r.initial);
const lazy = rows.filter(r => !r.initial);
console.log(`\ninitial JS: ${kb(sum(initial, 'raw'))} raw ${kb(sum(initial, 'gz'))} gzip ${kb(sum(initial, 'br'))} brotli`);
console.log(`lazy JS:    ${kb(sum(lazy, 'raw'))} raw ${kb(sum(lazy, 'gz'))} gzip ${kb(sum(lazy, 'br'))} brotli`);
