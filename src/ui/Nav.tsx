import Link from 'next/link';

/** Site header: the name (home) and the secondary pages. */
export function Nav() {
  return (
    <header className="nav">
      <Link href="/" className="nav-title">Showdol</Link>
      <nav className="nav-links" aria-label="Main">
        <Link href="/stats">Stats</Link>
        <Link href="/how-to-play">How to play</Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer small muted">
      <Link href="/credits">Credits</Link> · Fan project, not affiliated with Nintendo or The Pokémon Company.
    </footer>
  );
}
