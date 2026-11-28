import type {Metadata} from 'next';
import {Home} from '@/ui/Home';

export const metadata: Metadata = {alternates: {canonical: '/'}};

// Tells search engines the site's name, so results show "Showdol" (and don't read it as a typo of Showdown).
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {'@type': 'WebSite', '@id': 'https://showdol.com/#website', name: 'Showdol', url: 'https://showdol.com/'},
    {
      '@type': 'VideoGame',
      name: 'Showdol',
      url: 'https://showdol.com/',
      description: 'A free daily Pokémon Random Battle in the browser. Everyone gets the same team against the same AI.',
      genre: 'Strategy',
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      offers: {'@type': 'Offer', price: 0, priceCurrency: 'USD'},
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')}} />
      <Home />
    </>
  );
}
