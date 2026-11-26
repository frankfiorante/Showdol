import Link from 'next/link';

/** Site header: the name (home) and the secondary pages. */
export function Nav() {
  return (
    <header className="nav">
      <Link href="/" className="nav-title">
        {/* app/icon.svg, which Next serves at /icon.svg */}
        <img src="/icon.svg" alt="" width={34} height={34} className="nav-logo" />
        Showdol
      </Link>
      <nav className="nav-links" aria-label="Main">
        <Link href="/practice">Practice</Link>
        <Link href="/stats">Stats</Link>
        <Link href="/how-to-play">How to play</Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer small muted">
      <Link href="/credits">Credits</Link>
    </footer>
  );
}
