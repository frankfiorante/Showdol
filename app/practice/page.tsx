import type {Metadata} from 'next';
import {Practice} from '@/ui/Practice';

export const metadata: Metadata = {title: 'Practice · Showdol'};

export default function PracticePage() {
  return <Practice />;
}
