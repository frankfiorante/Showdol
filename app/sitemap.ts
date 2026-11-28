import type {MetadataRoute} from 'next';

export const dynamic = 'force-static';

// Stats is left out: it only shows what this browser has saved.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/how-to-play', '/practice', '/credits'].map(path => ({url: `https://showdol.com${path}`}));
}
