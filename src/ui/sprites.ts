'use client';

import {useEffect, useState} from 'react';

/** Species id (toID of the name) → sprite file id. Written by `pnpm sprites:fetch`. */
export type SpriteIndex = Record<string, string>;

let cached: Promise<SpriteIndex> | null = null;

function loadIndex(): Promise<SpriteIndex> {
  cached ??= fetch('/sprites/gen5/index.json')
    .then(r => (r.ok ? (r.json() as Promise<SpriteIndex>) : {}))
    .catch(() => ({}));
  return cached;
}

/** Same normalization as the sim's toID. */
export const toID = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The sprite index, or null while it loads. Shared across components. */
export function useSpriteIndex(): SpriteIndex | null {
  const [index, setIndex] = useState<SpriteIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadIndex().then(i => live && setIndex(i));
    return () => {
      live = false;
    };
  }, []);
  return index;
}

export function spriteUrl(index: SpriteIndex, species: string): string | null {
  const id = index[toID(species)];
  return id ? `/sprites/gen5/${id}.png` : null;
}
