'use client';

import type {ReactNode} from 'react';
import type {PlayerSetInfo} from '@/engine/puzzle';
import type {PokemonView} from '@/engine/view';
import {boostMultiplier} from '@/engine/boosts';
import {STATUS_LABELS, hpPercent, typeStyle} from './format';
import {Tooltip, useTooltip} from './Tooltip';

const STAT_LABELS: [string, string][] = [['atk', 'Atk'], ['def', 'Def'], ['spa', 'SpA'], ['spd', 'SpD'], ['spe', 'Spe']];

function Badge({type}: {type: string}) {
  return <span className="type" style={typeStyle(type)}>{type}</span>;
}

/**
 * Showdown-style details for a Pokémon. The player's own show the full set;
 * the foe's show only what's public: revealed info, the abilities its Random
 * Battle sets can have, and its Speed range.
 */
export function PokemonTip({p, foe}: {p: PokemonView; foe?: boolean}) {
  const pct = Math.ceil(hpPercent(p.hp, p.maxhp));
  return (
    <div className="tip">
      <div className="tip-head">
        <strong>{p.species}</strong>
        <span className="muted"> L{p.level}</span>
        {foe && p.transformed && <span className="muted"> · {p.name} (transformed)</span>}
      </div>
      <div className="tip-row">
        {p.types.map(t => <Badge key={t} type={t} />)}
        {p.terastallized ? <span className="chip tera">Terastallized</span> : p.teraType && <span className="small muted">Tera <Badge type={p.teraType} /></span>}
      </div>
      <div className="tip-row">
        <span>{p.fainted ? 'Fainted' : foe ? `HP ${pct}%` : `HP ${p.hp}/${p.maxhp} (${pct}%)`}</span>
        {p.status && !p.fainted && <span className={`status ${p.status}`}>{STATUS_LABELS[p.status] ?? p.status}</span>}
      </div>
      {foe ? <FoeDetails p={p} /> : <OwnDetails p={p} />}
    </div>
  );
}

function Line({label, children}: {label: string; children: ReactNode}) {
  return <div className="tip-line"><span className="tip-label">{label}</span> {children}</div>;
}

function OwnDetails({p}: {p: PokemonView}) {
  return (
    <>
      <Line label="Ability:">{p.ability ?? '—'}</Line>
      <Line label="Item:">{p.item ?? 'None'}</Line>
      {p.stats && (
        <div className="tip-stats">
          {STAT_LABELS.map(([key, label]) => {
            const base = p.stats![key];
            const stage = p.boosts[key] ?? 0;
            const shown = stage ? Math.floor(base * boostMultiplier(stage)) : base;
            return (
              <span key={key} className={stage > 0 ? 'up' : stage < 0 ? 'down' : ''}>
                {label} {shown}
              </span>
            );
          })}
        </div>
      )}
      <MoveList p={p} />
    </>
  );
}

function FoeDetails({p}: {p: PokemonView}) {
  const s = p.speed;
  const range = (min: number, max: number) => (min === max ? `${min}` : `${min} to ${max}`);
  return (
    <>
      {p.ability ? (
        <Line label="Ability:">{p.ability}</Line>
      ) : p.possibleAbilities?.length ? (
        <Line label={p.possibleAbilities.length === 1 ? 'Possible ability:' : 'Possible abilities:'}>{p.possibleAbilities.join(', ')}</Line>
      ) : null}
      <Line label="Item:">{p.item ?? <span className="muted">unknown</span>}</Line>
      {s && (
        <Line label="Spe">
          {range(s.min, s.max)} <span className="muted small">(before items/abilities/modifiers)</span>
          {s.modifiedMin !== undefined && (
            <div className="small">→ {range(s.modifiedMin, s.modifiedMax!)} with {s.modifiers.join(', ')}</div>
          )}
          {s.modifiedMin === undefined && s.modifiers.length > 0 && <div className="small muted">{s.modifiers.join(', ')}</div>}
        </Line>
      )}
      {p.moveDetails?.length ? <MoveList p={p} title="Revealed moves" /> : <p className="small muted tip-line">No moves revealed yet</p>}
    </>
  );
}

function MoveList({p, title}: {p: PokemonView; title?: string}) {
  if (!p.moveDetails?.length) return null;
  return (
    <div className="tip-moves">
      {title && <div className="tip-label">{title}</div>}
      <ul>
        {p.moveDetails.map(m => (
          <li key={m.name}>
            <Badge type={m.type} /> <span>{m.name}</span>
            {m.maxpp ? <span className="muted small pp">{m.pp}/{m.maxpp}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A player's set from the puzzle file, as a full-HP Pokémon view for the tooltip. */
export function viewFromSet(set: PlayerSetInfo, teamIndex: number): PokemonView {
  return {
    teamIndex,
    name: set.species,
    species: set.species,
    level: set.level,
    types: set.types,
    hp: set.maxhp,
    maxhp: set.maxhp,
    fainted: false,
    active: false,
    boosts: {},
    volatiles: [],
    item: set.item,
    ability: set.ability,
    moves: set.moves.map(m => m.name),
    teraType: set.teraType,
    stats: set.stats,
    moveDetails: set.moves.map(m => ({name: m.name, type: m.type, pp: m.pp, maxpp: m.pp})),
  };
}

/** Wraps any element so hovering / long-pressing / focusing it shows the Pokémon's details. */
export function WithPokemonTip({p, foe, tapToggle, children, className, as = 'span', ...rest}: {
  p: PokemonView;
  foe?: boolean;
  tapToggle?: boolean;
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div';
} & React.HTMLAttributes<HTMLElement>) {
  const {open, anchor, id, triggerProps} = useTooltip({tapToggle});
  const Tag = as;
  return (
    <>
      <Tag {...rest} {...triggerProps} className={`tip-trigger ${className ?? ''}`}>
        {children}
      </Tag>
      <Tooltip open={open} anchor={anchor} id={id}><PokemonTip p={p} foe={foe} /></Tooltip>
    </>
  );
}
