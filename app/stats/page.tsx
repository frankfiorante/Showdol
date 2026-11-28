import type {Metadata} from 'next';
import {Stats} from '@/ui/Stats';

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Your Showdol record: wins, streaks and how you did against par. Saved in this browser.',
  alternates: {canonical: '/stats'},
};

export default function StatsPage() {
  return <Stats />;
}
