'use client';

import {useEffect, useRef, useState} from 'react';
import {typeStyle} from './format';
import {spriteUrl, useSpriteIndex} from './sprites';

interface Props {
  species: string;
  /** Rendered size in CSS pixels (sprites are 96px pixel art). */
  size?: number;
  /** Mirror horizontally (the player's own Pokémon face the foe). */
  back?: boolean;
  /** Used for the fallback card's color. */
  type?: string;
  /** Current HP; a drop triggers a short hit flash. */
  hp?: number;
  fainted?: boolean;
  className?: string;
}

/**
 * A Pokémon sprite, or a monogram card when there's no sprite for it.
 * Re-keyed by species by the caller to replay the entrance animation.
 */
export function Sprite({species, size = 96, back, type, hp, fainted, className = ''}: Props) {
  const index = useSpriteIndex();
  const [broken, setBroken] = useState(false);
  const [hit, setHit] = useState(false);
  const lastHp = useRef(hp);

  useEffect(() => {
    if (hp !== undefined && lastHp.current !== undefined && hp < lastHp.current) {
      setHit(true);
      const t = setTimeout(() => setHit(false), 450);
      lastHp.current = hp;
      return () => clearTimeout(t);
    }
    lastHp.current = hp;
  }, [hp]);

  const classes = `sprite ${back ? 'back' : ''} ${hit ? 'hit' : ''} ${fainted ? 'fainted' : ''} ${className}`;
  const style = {width: size, height: size};
  if (!index) return <span className={classes} style={style} aria-hidden />;

  const url = spriteUrl(index, species);
  if (!url || broken) {
    const initials = species.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2);
    return (
      <span className={`${classes} monogram`} style={{...style, ...typeStyle(type ?? '')}}
        role="img" aria-label={species}>
        {initials || species.slice(0, 2)}
      </span>
    );
  }
  return (
    // Pixel art: plain <img> with nearest-neighbour scaling; next/image would smooth it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={species} width={96} height={96} className={classes} style={style}
      draggable={false} onError={() => setBroken(true)} />
  );
}
