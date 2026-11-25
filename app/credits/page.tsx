import type {Metadata} from 'next';
import {Footer, Nav} from '@/ui/Nav';

export const metadata: Metadata = {title: 'Credits · Showdol'};

export default function Credits() {
  return (
    <main>
      <Nav />
      <h1 className="page-title">Credits</h1>

      <section className="card">
        <h2 className="card-title">Pokémon</h2>
        <p className="small">
          Showdol is a free, non-commercial fan project with no affiliation with or endorsement from Nintendo,
          Creatures Inc., GAME FREAK Inc. or The Pokémon Company. Pokémon, the Pokémon names and all Pokémon artwork
          are © and ™ Nintendo, Creatures Inc., GAME FREAK Inc. and The Pokémon Company.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Sprites</h2>
        <p className="small">
          Pokémon sprites are the Black/White-style sprites used by{' '}
          <a href="https://pokemonshowdown.com" rel="noopener noreferrer">Pokémon Showdown</a>. Sprites for Pokémon
          introduced after Generation 5 were drawn by the{' '}
          <a href="https://www.smogon.com/forums/threads/smogon-sprite-project.3647722/" rel="noopener noreferrer">
            Smogon Sprite Project
          </a>{' '}
          and its artists, who allow non-profit use with credit. Thank you to every contributor.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Battle engine and data</h2>
        <ul className="small">
          <li>
            Battle simulation: <a href="https://github.com/pkmn/ps" rel="noopener noreferrer">@pkmn/sim</a>, an
            extraction of the Pokémon Showdown simulator by Guangcong Luo and contributors (MIT).
          </li>
          <li>Random Battle teams: @pkmn/randoms (MIT). Battle state and log text: @pkmn/client, @pkmn/protocol, @pkmn/view (MIT).</li>
          <li>
            Damage calculation: <a href="https://github.com/smogon/damage-calc" rel="noopener noreferrer">@smogon/calc</a> (MIT).
          </li>
        </ul>
        <p className="small">
          Built with Next.js and React (MIT). Full license texts for all open-source code in Showdol:{' '}
          <a href="/third-party-licenses.txt">third-party licenses</a>.
        </p>
      </section>
      <Footer />
    </main>
  );
}
