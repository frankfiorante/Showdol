import type {Metadata} from 'next';
import Link from 'next/link';
import {Footer, Nav} from '@/ui/Nav';

export const metadata: Metadata = {
  title: 'How to play',
  description: 'How Showdol works: one Gen 9 Random Battle a day, the same teams for everyone, par, streaks and sharing.',
  alternates: {canonical: '/how-to-play'},
};

export default function HowToPlay() {
  return (
    <main>
      <Nav />
      <h1 className="page-title">How to play</h1>

      <section className="card prose">
        <h2 className="card-title">One battle a day</h2>
        <p>
          Every day there&apos;s a new Gen 9 Random Battle (singles). Everyone gets the same team of six and faces the
          same AI team. A new puzzle unlocks at midnight, your local time.
        </p>
        <p>
          You see your own team before you start. The opponent&apos;s team stays hidden until each Pokémon is sent
          out. The AI, on the other hand, knows your whole team, so plan for that.
        </p>
      </section>

      <section className="card prose">
        <h2 className="card-title">Your own luck</h2>
        <p>
          Damage rolls, critical hits, misses and side effects are rolled separately for every player, so the same
          moves won&apos;t play out the same way for your friends.
        </p>
        <p>
          Once you press Play, your luck is fixed for the day. Reloading the page brings back the exact same battle,
          so a bad critical hit can&apos;t be undone. You can close the tab and come back later.
        </p>
      </section>

      <section className="card prose">
        <h2 className="card-title">Playing</h2>
        <ul>
          <li>Tap a move to attack, or one of your Pokémon to switch.</li>
          <li>Each battle you can Terastallize once: tick the box, then pick a move.</li>
          <li>Move buttons show how effective they are against the opponent&apos;s types. Abilities aren&apos;t included.</li>
          <li>Forfeiting counts as a loss.</li>
          <li>
            If you don&apos;t finish a game, you can still finish it the next day before midnight. After that it
            counts as a loss.
          </li>
        </ul>
      </section>

      <section className="card prose">
        <h2 className="card-title">Par</h2>
        <p>
          Before each puzzle goes live, the AI plays your team against the opponent&apos;s 100 times. Par is its
          typical win: the middle one when its wins are lined up best to worst.
        </p>
        <p>
          A result is better when more of your Pokémon are remaining. If two results have the same number remaining,
          the one with fewer turns is better. Beat par by doing better than the AI did, and keep a par streak going
          on the stats page.
        </p>
      </section>

      <section className="card prose">
        <h2 className="card-title">Practice</h2>
        <p>
          Want more battles? <Link href="/practice">Practice</Link> gives both sides brand-new random teams every
          game, as many times as you like. Practice games don&apos;t count toward your stats or streaks, and one
          unfinished practice game is saved so you can pick it back up later.
        </p>
      </section>

      <section className="card prose">
        <h2 className="card-title">Sharing</h2>
        <pre className="share-example">{'Showdol #12 · W · Beat par ⭐\nYou: 5 Pokémon remaining, 22 turns\nPar: 3 Pokémon remaining, 30 turns\n🟩🟩⬛🟩🟩🟩'}</pre>
        <p>
          The squares are your six Pokémon in team order: 🟩 remaining at the end, ⬛ fainted. A loss shows how
          many Pokémon the AI had remaining, plus the day&apos;s par. The share never names a Pokémon, so it doesn&apos;t
          spoil the puzzle.
        </p>
        <p>Missing a day breaks your streak but doesn&apos;t count as a loss.</p>
      </section>
      <Footer />
    </main>
  );
}
