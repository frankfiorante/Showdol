import type {Metadata, Viewport} from 'next';
import './globals.css';

const description = 'A daily Pokémon Random Battle. Same teams for everyone. One battle a day.';

// Icons and the link preview image come from the files in app/ (see scripts/gen-icons.ts).
export const metadata: Metadata = {
  metadataBase: new URL('https://showdol.com'),
  title: 'Showdol',
  description,
  openGraph: {title: 'Showdol', description, url: '/', siteName: 'Showdol', type: 'website'},
  twitter: {card: 'summary_large_image', title: 'Showdol', description},
};

export const viewport: Viewport = {width: 'device-width', initialScale: 1};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
