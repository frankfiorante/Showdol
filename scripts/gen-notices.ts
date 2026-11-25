/**
 * Writes public/third-party-licenses.txt: the license notices for third-party
 * code that ships to the browser. MIT and Apache-2.0 require these to go with
 * every copy, and minified bundles strip them, so the site serves this file
 * and links it from /credits.
 *
 *   pnpm notices:gen
 *
 * Rerun after upgrading or adding a package the browser uses. To see what
 * ships, build once with `productionBrowserSourceMaps: true` in next.config.ts
 * and list the node_modules paths in the .map files' `sources`.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root = join(import.meta.dirname, '..');
const outFile = join(root, 'public', 'third-party-licenses.txt');

/** Installed path and version of every production package, from pnpm. */
const installed = new Map<string, {path: string; version: string}>();
const listing = JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {cwd: root, encoding: 'utf8'})) as
  Record<string, {name: string; versions: string[]; paths: string[]}[]>;
for (const pkgs of Object.values(listing)) {
  for (const p of pkgs) installed.set(p.name, {path: p.paths[0], version: p.versions[0]});
}
const pkg = (name: string) => {
  const p = installed.get(name);
  if (!p) throw new Error(`${name} isn't installed as a production dependency`);
  return p;
};
const withVersion = (name: string) => `${name}@${pkg(name).version}`;

/** The package's own license file, or the upstream repo's when the package doesn't include one. */
function licenseOf(name: string, fallback?: string) {
  for (const f of ['LICENSE', 'LICENSE.md', 'license.md', 'LICENSE.txt']) {
    const file = join(pkg(name).path, f);
    if (existsSync(file)) return readFileSync(file, 'utf8');
  }
  if (fallback) return readFileSync(join(import.meta.dirname, 'licenses', fallback), 'utf8');
  throw new Error(`no license file for ${name}`);
}

interface Notice { title: string; packages: string[]; license: string; spdx: string; note?: string }

const next = pkg('next');
const nextCompiled = (dir: string) => readFileSync(join(next.path, 'dist', 'compiled', dir, 'LICENSE'), 'utf8');

const pkmn = ['@pkmn/client', '@pkmn/data', '@pkmn/protocol', '@pkmn/sets', '@pkmn/view'];

const notices: Notice[] = [
  {title: 'Next.js', packages: [withVersion('next')], spdx: 'MIT', license: licenseOf('next')},
  {
    title: 'React',
    packages: ['react', 'react-dom', 'react-server-dom-turbopack', 'scheduler'],
    note: `Bundled inside next@${next.version}.`,
    spdx: 'MIT',
    license: nextCompiled('react'),
  },
  {title: 'process (browser shim)', packages: ['process'], note: `Bundled inside next@${next.version}.`, spdx: 'MIT', license: nextCompiled('process')},
  {title: 'SWC helpers', packages: [withVersion('@swc/helpers')], spdx: 'Apache-2.0', license: licenseOf('@swc/helpers')},
  {
    title: 'Pokémon Showdown simulator',
    packages: [withVersion('@pkmn/sim')],
    spdx: 'MIT',
    license: licenseOf('@pkmn/sim'),
  },
  {
    title: 'pkmn libraries',
    packages: pkmn.map(withVersion),
    note: 'Substantial parts are derived from the MIT-licensed code of Pokémon Showdown and its client, by Guangcong Luo and other contributors.',
    spdx: 'MIT',
    license: licenseOf(pkmn[0], 'pkmn-ps.txt'),
  },
  {
    title: 'pkmn Random Battle sets',
    packages: [withVersion('@pkmn/randoms')],
    note: 'Used at build time. Data generated from it ships in /puzzles/ and the opponent tooltip. Derived from Pokémon Showdown code by Guangcong Luo and other contributors.',
    spdx: 'MIT',
    license: licenseOf('@pkmn/randoms', 'pkmn-ps.txt'),
  },
  {title: 'Pokémon damage calculator', packages: [withVersion('@smogon/calc')], spdx: 'MIT', license: licenseOf('@smogon/calc', 'smogon-damage-calc.txt')},
  {title: 'ts-chacha20', packages: [withVersion('ts-chacha20')], spdx: 'MIT', license: licenseOf('ts-chacha20')},
];

const rule = '='.repeat(79);
const text = [
  'Third-party software notices for Showdol',
  '',
  'Showdol includes the open-source software below. Each package is used under',
  'the license reproduced with it. Pokémon names, artwork and sprites are not',
  'covered by any of these licenses: see /credits.',
  '',
  ...notices.flatMap(n => [
    rule,
    `${n.title} (${n.spdx})`,
    ...n.packages.map(p => `  ${p}`),
    ...(n.note ? ['', n.note] : []),
    rule,
    '',
    n.license.trim(),
    '',
  ]),
].join('\n');

writeFileSync(outFile, text);
console.log(`wrote ${notices.length} notices (${(text.length / 1024).toFixed(0)} KB) to public/third-party-licenses.txt`);
