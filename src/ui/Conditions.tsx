'use client';

import type {CSSProperties, ReactNode} from 'react';
import type {ConditionView} from '@/engine/view';
import {Tooltip, useTooltip} from './Tooltip';

/**
 * How weather, terrain, field effects, side conditions and volatiles look:
 * an icon, a color, and a plain-language note on what each one does.
 */

type Kind = 'weather' | 'terrain' | 'field' | 'hazard' | 'screen' | 'side' | 'volatile';

interface Info {
  kind: Kind;
  icon: IconName;
  color: string;
  /** For side conditions and volatiles: whether it helps or hurts whoever it's on. */
  tone?: 'good' | 'bad';
  desc: string;
  /** The held item that makes it last longer, if it can be extended. */
  extender?: string;
  /** Most layers it can have (Spikes, Toxic Spikes). */
  maxLayers?: number;
}

const INFO: Record<string, Info> = {
  // Weather
  sun: {kind: 'weather', icon: 'sun', color: '#f59e0b', extender: 'Heat Rock',
    desc: 'Fire moves deal 1.5× damage and Water moves 0.5×. Nothing can be frozen, and Solar Beam needs no charge turn.'},
  harshsunshine: {kind: 'weather', icon: 'sun', color: '#ea580c',
    desc: 'Water moves fail and Fire moves deal 1.5× damage. Lasts while the Pokémon that caused it stays in.'},
  rain: {kind: 'weather', icon: 'rain', color: '#3b82f6', extender: 'Damp Rock',
    desc: 'Water moves deal 1.5× damage and Fire moves 0.5×. Thunder and Hurricane can’t miss.'},
  heavyrain: {kind: 'weather', icon: 'rain', color: '#1d4ed8',
    desc: 'Fire moves fail and Water moves deal 1.5× damage. Lasts while the Pokémon that caused it stays in.'},
  sand: {kind: 'weather', icon: 'sand', color: '#b08d57', extender: 'Smooth Rock',
    desc: 'Rock types get 1.5× Sp. Def. Each turn, Pokémon that aren’t Rock, Ground or Steel lose 1/16 of their HP.'},
  snow: {kind: 'weather', icon: 'snow', color: '#38bdf8', extender: 'Icy Rock',
    desc: 'Ice types get 1.5× Defense, and Blizzard can’t miss.'},
  hail: {kind: 'weather', icon: 'snow', color: '#38bdf8', extender: 'Icy Rock',
    desc: 'Each turn, Pokémon that aren’t Ice type lose 1/16 of their HP. Blizzard can’t miss.'},
  strongwinds: {kind: 'weather', icon: 'wind', color: '#64748b',
    desc: 'Moves that would be super effective against Flying types deal normal damage to them instead.'},

  // Terrain (only grounded Pokémon: not Flying types, Levitate, Air Balloon, ...)
  electricterrain: {kind: 'terrain', icon: 'bolt', color: '#eab308', extender: 'Terrain Extender',
    desc: 'Grounded Pokémon can’t fall asleep, and their Electric moves deal 1.3× damage.'},
  grassyterrain: {kind: 'terrain', icon: 'leaf', color: '#22c55e', extender: 'Terrain Extender',
    desc: 'Grounded Pokémon heal 1/16 of their HP each turn, and their Grass moves deal 1.3× damage. Earthquake and Bulldoze deal half damage.'},
  psychicterrain: {kind: 'terrain', icon: 'eye', color: '#d946ef', extender: 'Terrain Extender',
    desc: 'Grounded Pokémon can’t be hit by priority moves, and their Psychic moves deal 1.3× damage.'},
  mistyterrain: {kind: 'terrain', icon: 'mist', color: '#f472b6', extender: 'Terrain Extender',
    desc: 'Grounded Pokémon can’t get status conditions or be confused, and Dragon moves deal them half damage.'},

  // Field effects (both sides)
  trickroom: {kind: 'field', icon: 'room', color: '#8b5cf6',
    desc: 'Slower Pokémon move first. Priority still counts: a priority move goes before any normal one.'},
  magicroom: {kind: 'field', icon: 'box', color: '#a855f7', desc: 'Held items have no effect.'},
  wonderroom: {kind: 'field', icon: 'swap', color: '#6366f1', desc: 'Every Pokémon’s Defense and Sp. Def are swapped.'},
  gravity: {kind: 'field', icon: 'gravity', color: '#4f46e5',
    desc: 'Nothing is airborne: Ground moves hit Flying types and Levitate. Accuracy goes up, and moves like Fly and High Jump Kick can’t be used.'},
  fairylock: {kind: 'field', icon: 'lock', color: '#ec4899', desc: 'No Pokémon can switch out next turn.'},
  mudsport: {kind: 'field', icon: 'bolt', color: '#92400e', desc: 'Electric moves have 1/3 of their power.'},
  watersport: {kind: 'field', icon: 'rain', color: '#0ea5e9', desc: 'Fire moves have 1/3 of their power.'},
  iondeluge: {kind: 'field', icon: 'bolt', color: '#eab308', desc: 'Normal moves become Electric type this turn.'},

  // Entry hazards
  stealthrock: {kind: 'hazard', icon: 'rock', color: '#a16207', tone: 'bad',
    desc: 'Pokémon switching in lose HP based on how weak they are to Rock: 1/8 normally, up to 1/2 for 4× weak.'},
  gmaxsteelsurge: {kind: 'hazard', icon: 'rock', color: '#60a1b8', tone: 'bad',
    desc: 'Pokémon switching in lose HP based on how weak they are to Steel: 1/8 normally, up to 1/2 for 4× weak.'},
  spikes: {kind: 'hazard', icon: 'spikes', color: '#78716c', tone: 'bad', maxLayers: 3,
    desc: 'Grounded Pokémon switching in lose 1/8 of their HP (1/6 with 2 layers, 1/4 with 3).'},
  toxicspikes: {kind: 'hazard', icon: 'toxicspikes', color: '#9333ea', tone: 'bad', maxLayers: 2,
    desc: 'Grounded Pokémon switching in are poisoned (badly poisoned with 2 layers). A grounded Poison type switching in removes them.'},
  stickyweb: {kind: 'hazard', icon: 'web', color: '#84cc16', tone: 'bad',
    desc: 'Grounded Pokémon switching in have their Speed lowered by 1 stage.'},

  // Screens and other side effects
  reflect: {kind: 'screen', icon: 'shield', color: '#a855f7', tone: 'good', extender: 'Light Clay',
    desc: 'Physical damage to this side’s Pokémon is halved. Critical hits ignore it.'},
  lightscreen: {kind: 'screen', icon: 'shield', color: '#eab308', tone: 'good', extender: 'Light Clay',
    desc: 'Special damage to this side’s Pokémon is halved. Critical hits ignore it.'},
  auroraveil: {kind: 'screen', icon: 'shield', color: '#2dd4bf', tone: 'good', extender: 'Light Clay',
    desc: 'Physical and special damage to this side’s Pokémon is halved. Critical hits ignore it.'},
  tailwind: {kind: 'side', icon: 'wind', color: '#0ea5e9', tone: 'good', desc: 'This side’s Pokémon have doubled Speed.'},
  safeguard: {kind: 'side', icon: 'shield', color: '#22c55e', tone: 'good',
    desc: 'This side’s Pokémon can’t get status conditions or be confused.'},
  mist: {kind: 'side', icon: 'mist', color: '#94a3b8', tone: 'good', desc: 'The opponent can’t lower this side’s stats.'},
  luckychant: {kind: 'side', icon: 'sparkle', color: '#f472b6', tone: 'good', desc: 'Critical hits can’t land on this side.'},
  futuresight: {kind: 'side', icon: 'clock', color: '#d946ef', tone: 'bad',
    desc: 'A Future Sight attack will hit this side’s Pokémon when the count runs out.'},
  doomdesire: {kind: 'side', icon: 'clock', color: '#60a1b8', tone: 'bad',
    desc: 'A Doom Desire attack will hit this side’s Pokémon when the count runs out.'},

  // Volatiles: on one Pokémon, and gone once it switches out unless noted.
  leechseed: {kind: 'volatile', icon: 'seed', color: '#16a34a', tone: 'bad',
    desc: 'Loses 1/8 of its max HP each turn, and the Pokémon across from it heals that much. Ends when it switches out.'},
  confusion: {kind: 'volatile', icon: 'swirl', color: '#d946ef', tone: 'bad',
    desc: 'For 2–5 turns, a 1 in 3 chance each turn to hit itself instead of using its move.'},
  substitute: {kind: 'volatile', icon: 'doll', color: '#0ea5e9', tone: 'good',
    desc: 'A decoy takes the hits until it breaks, and blocks most status moves. Sound moves go through it.'},
  taunt: {kind: 'volatile', icon: 'ban', color: '#ef4444', tone: 'bad', desc: 'Can only use damaging moves for 3 turns.'},
  encore: {kind: 'volatile', icon: 'repeat', color: '#ef4444', tone: 'bad', desc: 'Must repeat its last move for 3 turns.'},
  torment: {kind: 'volatile', icon: 'ban', color: '#ef4444', tone: 'bad', desc: 'Can’t use the same move twice in a row.'},
  disable: {kind: 'volatile', icon: 'ban', color: '#ef4444', tone: 'bad', desc: 'One of its moves can’t be used for 4 turns.'},
  yawn: {kind: 'volatile', icon: 'sleep', color: '#64748b', tone: 'bad',
    desc: 'Falls asleep at the end of next turn unless it switches out first.'},
  perishsong: {kind: 'volatile', icon: 'clock', color: '#ef4444', tone: 'bad',
    desc: 'Faints when the count reaches 0 at the end of a turn, unless it switches out first.'},
  curse: {kind: 'volatile', icon: 'drop', color: '#7c3aed', tone: 'bad', desc: 'Loses 1/4 of its max HP each turn until it switches out.'},
  saltcure: {kind: 'volatile', icon: 'drop', color: '#a8a29e', tone: 'bad',
    desc: 'Loses 1/8 of its max HP each turn (1/4 if Water or Steel type) until it switches out.'},
  partiallytrapped: {kind: 'volatile', icon: 'chain', color: '#ef4444', tone: 'bad',
    desc: 'Can’t switch out and loses 1/8 of its max HP each turn for 4–5 turns.'},
  trapped: {kind: 'volatile', icon: 'chain', color: '#ef4444', tone: 'bad', desc: 'Can’t switch out.'},
  focusenergy: {kind: 'volatile', icon: 'sparkle', color: '#f59e0b', tone: 'good', desc: 'Much more likely to land critical hits.'},
  protosynthesis: {kind: 'volatile', icon: 'sparkle', color: '#f59e0b', tone: 'good',
    desc: 'Its highest stat is boosted: 1.5× if Speed, 1.3× otherwise.'},
  quarkdrive: {kind: 'volatile', icon: 'sparkle', color: '#eab308', tone: 'good',
    desc: 'Its highest stat is boosted: 1.5× if Speed, 1.3× otherwise.'},
  flashfire: {kind: 'volatile', icon: 'sparkle', color: '#ea580c', tone: 'good', desc: 'Its Fire moves deal 1.5× damage.'},
  charge: {kind: 'volatile', icon: 'bolt', color: '#eab308', tone: 'good', desc: 'Its next Electric move deals double damage.'},
  magnetrise: {kind: 'volatile', icon: 'float', color: '#60a1b8', tone: 'good', desc: 'Immune to Ground moves for 5 turns.'},
  aquaring: {kind: 'volatile', icon: 'heal', color: '#3b82f6', tone: 'good', desc: 'Heals 1/16 of its max HP each turn.'},
  ingrain: {kind: 'volatile', icon: 'heal', color: '#22c55e', tone: 'good',
    desc: 'Heals 1/16 of its max HP each turn, but can’t switch out.'},
  destinybond: {kind: 'volatile', icon: 'chain', color: '#7c3aed', tone: 'good',
    desc: 'If an attack makes it faint before its next move, the attacker faints too.'},
};

const KIND_LABEL: Record<Kind, string> = {
  weather: 'Weather',
  terrain: 'Terrain · grounded Pokémon only',
  field: 'Field effect · both sides',
  hazard: 'Entry hazard',
  screen: 'Screen',
  side: 'Side effect',
  volatile: 'On this Pokémon',
};

export function conditionInfo(c: ConditionView, fallback: Kind): Info {
  return INFO[c.id] ?? {kind: fallback, icon: 'dot', color: '#71717a', desc: ''};
}

/** "4 or 7" while an unseen item could extend it, else "4". */
export function turnsShort(turns: NonNullable<ConditionView['turns']>) {
  return turns.min === turns.max ? `${turns.min}` : `${turns.min} or ${turns.max}`;
}

function turnsLong(c: ConditionView, info: Info) {
  const t = c.turns;
  if (!t) return info.kind === 'hazard' ? 'Stays until removed (Rapid Spin, Defog, ...).' : null;
  if (c.id === 'perishsong') return `Perish count: ${t.min}.`;
  if (t.min !== t.max) {
    return `${t.min} turns left including this one, or ${t.max} if it was set with ${info.extender ?? 'an item that extends it'}.`;
  }
  return t.min === 1 ? 'Ends after this turn.' : `${t.min} turns left including this one.`;
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Color custom properties for a condition (no color-mix: iOS 15 Safari lacks it). */
export function conditionColors(color: string): CSSProperties {
  return {'--c': color, '--c-bg': rgba(color, 0.16), '--c-line': rgba(color, 0.5)} as CSSProperties;
}

function ConditionTip({c, info, owner}: {c: ConditionView; info: Info; owner?: string}) {
  const turns = turnsLong(c, info);
  const layers = c.layers ?? (info.maxLayers ? 1 : undefined);
  return (
    <div className="tip cond-tip" style={conditionColors(info.color)}>
      <div className="tip-head cond-tip-head">
        <Icon name={info.icon} />
        <strong>{c.name}</strong>
        {layers && info.maxLayers ? <span className="muted"> · {layers} of {info.maxLayers} layers</span> : null}
      </div>
      <div className="tip-label small">{KIND_LABEL[info.kind]}{owner ? ` · ${owner}` : ''}</div>
      {turns && <div className="tip-line">{turns}</div>}
      {info.desc && <p className="tip-section">{info.desc}</p>}
    </div>
  );
}

/**
 * A colored badge: icon, name, layers and turns left. Hover, long-press, tap
 * or focus it for what it does.
 */
export function ConditionBadge({c, kind, owner, compact}: {
  c: ConditionView;
  /** Used when the condition isn't in the catalog. */
  kind: Kind;
  /** Whose side or Pokémon it's on, for the tooltip: "your side", "the opposing Garchomp". */
  owner?: string;
  /** Icon and short name only, for volatiles next to the HP bar. */
  compact?: boolean;
}) {
  const {open, anchor, id, triggerProps} = useTooltip({tapToggle: true});
  const info = conditionInfo(c, kind);
  const label = [c.name, c.layers && `${c.layers} layers`, c.turns && `${turnsShort(c.turns)} turns left`]
    .filter(Boolean).join(', ');
  return (
    <>
      <span {...triggerProps} role="button" tabIndex={0} aria-label={label}
        className={`tip-trigger cond ${info.tone ?? ''} ${compact ? 'compact' : ''}`} style={conditionColors(info.color)}>
        <Icon name={info.icon} />
        <span className="cond-name">{c.name}</span>
        {c.layers && <span className="cond-layers">×{c.layers}</span>}
        {c.turns && <span className="cond-turns" aria-hidden>{turnsShort(c.turns)}</span>}
      </span>
      <Tooltip open={open} anchor={anchor} id={id}><ConditionTip c={c} info={info} owner={owner} /></Tooltip>
    </>
  );
}

/* ---------- Icons: 16×16, stroked in the condition's color ---------- */

type IconName =
  | 'sun' | 'rain' | 'sand' | 'snow' | 'wind' | 'bolt' | 'leaf' | 'eye' | 'mist' | 'room' | 'box' | 'swap'
  | 'gravity' | 'lock' | 'rock' | 'spikes' | 'toxicspikes' | 'web' | 'shield' | 'sparkle' | 'clock' | 'seed'
  | 'swirl' | 'doll' | 'ban' | 'repeat' | 'sleep' | 'drop' | 'chain' | 'float' | 'heal' | 'dot';

const ICONS: Record<IconName, ReactNode> = {
  sun: <><circle cx="8" cy="8" r="3" fill="currentColor" /><path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.05 3.05l1.27 1.27M11.68 11.68l1.27 1.27M3.05 12.95l1.27-1.27M11.68 4.32l1.27-1.27" /></>,
  rain: <><path d="M4.5 9a2.5 2.5 0 0 1 .3-5 3.5 3.5 0 0 1 6.6 1A2 2 0 0 1 11.5 9z" fill="currentColor" fillOpacity=".25" /><path d="M5.5 11l-.8 2.5M8.5 11l-.8 2.5M11.5 11l-.8 2.5" /></>,
  sand: <><path d="M1.5 5.5h8a2 2 0 1 0-2-2M1.5 9h11a2 2 0 1 1-2 2M1.5 12.5h5" /><circle cx="13" cy="5.5" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="13" r=".8" fill="currentColor" stroke="none" /></>,
  snow: <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.5L8 4l1.7-1.5M6.3 13.5L8 12l1.7 1.5" />,
  wind: <path d="M1.5 6h8.5a2 2 0 1 0-2-2M1.5 9.5h10.5a2 2 0 1 1-2 2M1.5 12.5h4" />,
  bolt: <path d="M9 1.5L3.5 9h4l-1 5.5 6-8h-4z" fill="currentColor" fillOpacity=".35" />,
  leaf: <path d="M3 13C3 6.5 7 3 13 3c0 6-3.5 10-10 10zM3 13l5.5-5.5" fill="currentColor" fillOpacity=".25" />,
  eye: <><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" fill="currentColor" /></>,
  mist: <path d="M2 5c2-1.5 4 1.5 6 0s4 1.5 6 0M2 8.5c2-1.5 4 1.5 6 0s4 1.5 6 0M2 12c2-1.5 4 1.5 6 0s4 1.5 6 0" />,
  room: <><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M2 6h12M2 10h12M6 2v12M10 2v12" strokeOpacity=".6" /></>,
  box: <path d="M2.5 5.5L8 2.5l5.5 3v5L8 13.5l-5.5-3zM2.5 5.5L8 8.5l5.5-3M8 8.5v5" />,
  swap: <path d="M2.5 5.5h10L10 3M13.5 10.5h-10L6 13" />,
  gravity: <path d="M8 1.5v8.5M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" />,
  lock: <><rect x="3.5" y="7" width="9" height="7" rx="1" fill="currentColor" fillOpacity=".25" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></>,
  rock: <path d="M1.5 13.5L4 7l2.5 2L9 2.5l2 5 3.5 6z" fill="currentColor" fillOpacity=".45" />,
  spikes: <path d="M1 14l2.5-7L6 14zM5.5 14L8 4.5 10.5 14zM10 14l2.5-7 2.5 7z" fill="currentColor" fillOpacity=".45" />,
  toxicspikes: <><path d="M1 14l3-7 3 7zM9 14l3-7 3 7z" fill="currentColor" fillOpacity=".45" /><path d="M8 1.5C6.6 3.4 6 4.4 6 5.3a2 2 0 0 0 4 0c0-.9-.6-1.9-2-3.8z" fill="currentColor" /></>,
  web: <><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" strokeOpacity=".7" /><circle cx="8" cy="8" r="2.8" /><circle cx="8" cy="8" r="5.6" /></>,
  shield: <path d="M8 1.5l5.5 2v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7v-4z" fill="currentColor" fillOpacity=".3" />,
  sparkle: <path d="M8 1.5l1.7 4.8 4.8 1.7-4.8 1.7L8 14.5l-1.7-4.8L1.5 8l4.8-1.7z" fill="currentColor" fillOpacity=".35" />,
  clock: <><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5V8l2.5 1.5" /></>,
  seed: <path d="M8 14.5V8M8 8C8 5 6 3.5 3 3.5 3 6.5 5 8 8 8zM8 10c0-2.5 2-4 5-4 0 2.5-2 4-5 4z" fill="currentColor" fillOpacity=".3" />,
  swirl: <path d="M8.5 8.5a1.5 1.5 0 1 1 1-2 3 3 0 1 1-4.5 3 4.5 4.5 0 1 1 7.5-1" />,
  doll: <><circle cx="8" cy="5" r="2.5" fill="currentColor" fillOpacity=".3" /><path d="M3 14c0-3 2.2-5 5-5s5 2 5 5z" fill="currentColor" fillOpacity=".3" /></>,
  ban: <><circle cx="8" cy="8" r="6.5" /><path d="M3.4 12.6l9.2-9.2" /></>,
  repeat: <path d="M2.5 7V6a2 2 0 0 1 2-2h8.5L11 2M13.5 9v1a2 2 0 0 1-2 2H3l2 2" />,
  sleep: <path d="M3 3.5h4.5L3 9h4.5M9.5 8h4l-4 5h4" />,
  drop: <path d="M8 1.5C5.5 5 4 7 4 9.5a4 4 0 0 0 8 0C12 7 10.5 5 8 1.5z" fill="currentColor" fillOpacity=".3" />,
  chain: <path d="M6.5 9.5l3-3M5.5 7.5L4 9a2.5 2.5 0 0 0 3.5 3.5L9 11M10.5 8.5L12 7a2.5 2.5 0 0 0-3.5-3.5L7 5" />,
  float: <path d="M8 12V2.5M4.5 6L8 2.5 11.5 6M4 14.5h8" />,
  heal: <><circle cx="8" cy="8" r="6.5" fill="currentColor" fillOpacity=".2" /><path d="M8 4.5v7M4.5 8h7" /></>,
  dot: <circle cx="8" cy="8" r="3" fill="currentColor" />,
};

export function Icon({name, size = 14}: {name: IconName; size?: number}) {
  return (
    <svg className="cond-icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {ICONS[name]}
    </svg>
  );
}
