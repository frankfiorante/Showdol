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
  /** Slide in once when mounted (the caller keys it by Pokémon, so a switch-in remounts it). */
  enter?: 'foe' | 'me';
  className?: string;
}

/**
 * A Pokémon sprite, or a monogram card when there's no sprite for it.
 * A form change (Cramorant-Gulping, Mimikyu-Busted) swaps the image in place.
 */
export function Sprite({species, size = 96, back, type, hp, fainted, enter, className = ''}: Props) {
  const index = useSpriteIndex();
  // Per URL, so a form change with a working sprite recovers from an earlier broken one.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  // Cleared when the slide-in ends: the hit flash swaps `animation`, and putting the
  // entrance class back afterwards would replay it.
  const [entering, setEntering] = useState(!!enter);
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

  const enterClass = enter && entering ? `enter-${enter}` : '';
  const classes = `sprite ${back ? 'back' : ''} ${hit ? 'hit' : ''} ${fainted ? 'fainted' : ''} ${enterClass} ${className}`;
  const style = {width: size, height: size};
  const onAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName.startsWith('enter-')) setEntering(false);
  };
  if (!index) return <span className={classes} style={style} aria-hidden />;

  const url = spriteUrl(index, species);
  if (!url || brokenUrl === url) {
    const initials = species.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2);
    return (
      <span className={`${classes} monogram`} style={{...style, ...typeStyle(type ?? '')}}
        role="img" aria-label={species} onAnimationEnd={onAnimationEnd}>
        {initials || species.slice(0, 2)}
      </span>
    );
  }
  return (
    // Pixel art: plain <img> with nearest-neighbour scaling; next/image would smooth it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={species} width={96} height={96} className={classes} style={style}
      draggable={false} onError={() => setBrokenUrl(url)} onAnimationEnd={onAnimationEnd} />
  );
}
