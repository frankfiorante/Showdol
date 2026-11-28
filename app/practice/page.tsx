import type {Metadata} from 'next';
import {Practice} from '@/ui/Practice';

export const metadata: Metadata = {
  title: 'Practice',
  description: 'Unlimited practice Pokémon Random Battles against the Showdol AI, with new random teams every game.',
  alternates: {canonical: '/practice'},
};

export default function PracticePage() {
  return <Practice />;
}
