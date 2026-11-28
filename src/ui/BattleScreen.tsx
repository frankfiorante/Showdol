'use client';

import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import type {BattleResult, BattleView, ConditionView, MoveOption, PokemonView, SideView} from '@/engine/view';
import {STATUS_LABELS, TYPE_COLORS, boostLabel, hpColor, hpPercent, typeStyle} from './format';
import {Sprite} from './Sprite';
import {WithPokemonTip} from './PokemonTip';
import {WithMoveTip} from './MoveTip';
import {ShareButton} from './ShareButton';
import {ConditionBadge, conditionColors, conditionInfo} from './Conditions';
import {shareText} from '@/game/share';
import {formatPar, parVerdict, VERDICT_LABEL, type Par} from '@/game/par';

interface Props {
  /** Absent in practice: the header says Practice and there's nothing to share. */
  puzzleNumber?: number;
  /** The day's par, for the result panel. */
  par?: Par;
  view: BattleView;
  log: string[];
  /** Log lines from the most recent step, shown as "what just happened". */
  latest: string[];
  pending: boolean;
  notice: string | null;
  logExpanded: boolean;
  onToggleLog: () => void;
  onChoose: (choice: string) => void;
  onForfeit: () => void;
  onDone: () => void;
  /** Practice only: start another game from the result panel. */
  onNewGame?: () => void;
}

export function BattleScreen(props: Props) {
  const {puzzleNumber, par, view, log, latest, pending, notice, logExpanded, onToggleLog, onChoose, onForfeit, onDone, onNewGame} = props;
  return (
    <div className="battle">
      <header className="battle-head">
        <span>{puzzleNumber === undefined ? 'Practice' : `Showdol #${puzzleNumber}`}</span>
        <span className="muted">Turn {view.turn}</span>
      </header>
      <FieldBar view={view} />
      <Stage view={view} />
      <LastTurn lines={latest} />
      {view.result ? (
        <ResultPanel result={view.result} puzzleNumber={puzzleNumber} par={par} onDone={onDone} onNewGame={onNewGame} />
      ) : (
        <Controls view={view} pending={pending} notice={notice} onChoose={onChoose} onForfeit={onForfeit}
          forfeitNote={puzzleNumber === undefined ? 'Forfeit ends this practice game.' : 'Forfeit counts as a loss.'} />
      )}
      <BattleLog lines={log} open={logExpanded} onToggle={onToggleLog} />
    </div>
  );
}

/** Weather, terrain and field effects such as Trick Room: they apply to both sides. */
function FieldBar({view}: {view: BattleView}) {
  const {weather, terrain, pseudoWeather} = view.field;
  if (!weather && !terrain && !pseudoWeather.length) return null;
  return (
    <div className="field-bar" role="group" aria-label="Field conditions">
      {weather && <ConditionBadge c={weather} kind="weather" />}
      {terrain && <ConditionBadge c={terrain} kind="terrain" />}
      {pseudoWeather.map(c => <ConditionBadge key={c.id} c={c} kind="field" />)}
    </div>
  );
}

/** Field effects with a look of their own on the stage. */
const ROOM_FX = new Set(['trickroom', 'magicroom', 'wonderroom', 'gravity']);

/** Weather, terrain and rooms painted behind everything on the stage. */
function StageEffects({field}: {field: BattleView['field']}) {
  const rooms = field.pseudoWeather.filter(c => ROOM_FX.has(c.id));
  return (
    <div className="fx" aria-hidden>
      {field.terrain && <div className={`fx-layer fx-${field.terrain.id}`} />}
      {rooms.map(c => <div key={c.id} className={`fx-layer fx-${c.id}`} />)}
      {field.weather && <div className={`fx-layer fx-${field.weather.id}`} />}
    </div>
  );
}

/** Hazards on the ground, screens in front, and Leech Seed sprouts on the Pokémon. */
function PlatformEffects({side}: {side: SideView}) {
  const has = (id: string) => side.conditions.find(c => c.id === id);
  const layers = (id: string) => {
    const c = has(id);
    return c ? c.layers ?? 1 : 0;
  };
  const screens = side.conditions.filter(c => conditionInfo(c, 'side').kind === 'screen');
  const seeded = side.active?.volatiles.some(v => v.id === 'leechseed');
  const rocks = has('stealthrock') || has('gmaxsteelsurge');
  return (
    <>
      {has('stickyweb') && <StickyWeb />}
      {(rocks || layers('spikes') > 0 || layers('toxicspikes') > 0) && (
        <span className="ground-hazards" aria-hidden>
          {rocks && <Rocks steel={!has('stealthrock')} />}
          {Array.from({length: layers('spikes')}, (_, i) => <Spike key={`s${i}`} />)}
          {Array.from({length: layers('toxicspikes')}, (_, i) => <Spike key={`t${i}`} toxic />)}
          {rocks && <Rocks steel={!has('stealthrock')} flip />}
        </span>
      )}
      {screens.map((c, i) => (
        <span key={c.id} className="screen-wall" aria-hidden
          style={{...conditionColors(conditionInfo(c, 'screen').color), '--i': i} as CSSProperties} />
      ))}
      {seeded && (
        <span className="seeded" aria-hidden>
          <Sprout /><Sprout />
        </span>
      )}
    </>
  );
}

function Rocks({steel, flip}: {steel?: boolean; flip?: boolean}) {
  return (
    <svg className={`hz-rocks ${steel ? 'steel' : ''} ${flip ? 'flip' : ''}`} width="29" height="20" viewBox="0 0 22 15">
      <path d="M1 14L4 6.5l3 2.5L10.5 1 14 8.5l2-2L21 14z" />
      <path d="M10.5 1L9 14M4 6.5L6 14M16 6.5l-1.5 7.5" className="facet" />
    </svg>
  );
}

function Spike({toxic}: {toxic?: boolean}) {
  return (
    <svg className={`hz-spike ${toxic ? 'toxic' : ''}`} width="12" height="17" viewBox="0 0 9 13">
      <path d="M.75 12.25L4.5 1l3.75 11.25z" />
    </svg>
  );
}

function StickyWeb() {
  return (
    <svg className="hz-web" width="74" height="24" viewBox="0 0 60 21" aria-hidden>
      <path d="M30 20.5L10 20.5M30 20.5L15.9 6.4M30 20.5V.5M30 20.5L44.1 6.4M30 20.5H50M16 20.5a14 14 0 0 1 28 0M23 20.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

function Sprout() {
  return (
    <svg className="sprout" width="20" height="20" viewBox="0 0 16 16">
      <path d="M8 15V8.5M8 8.5C8 5.5 6 4 3 4c0 3 2 4.5 5 4.5zM8 10.5c0-2.5 2-4 5-4 0 2.5-2 4-5 4z" />
    </svg>
  );
}

export function TypeBadge({type}: {type: string}) {
  return (
    <span className="type" style={typeStyle(type)}>
      {type}
    </span>
  );
}

function HpBar({hp, maxhp}: {hp: number; maxhp: number}) {
  const pct = hpPercent(hp, maxhp);
  return (
    <div className="hpbar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="HP">
      <div style={{width: `${pct}%`, background: hpColor(pct)}} />
    </div>
  );
}

/** The player's team as alive / fainted dots. */
function TeamPips({side}: {side: SideView}) {
  const pips = side.team.map(p => (p.fainted ? 'fainted' : 'alive'));
  const left = side.team.filter(p => !p.fainted).length;
  return (
    <div className="pips" role="img" aria-label={`You: ${left} of ${side.totalPokemon} Pokémon remaining`}>
      {pips.map((state, i) => <span key={i} className={`pip ${state}`} />)}
    </div>
  );
}

/**
 * The foe's revealed Pokémon as mini sprites (hover / tap for details), then
 * "?" slots for the ones not seen yet, so the player doesn't have to remember.
 */
function FoeRoster({side}: {side: SideView}) {
  const unknown = Math.max(0, side.totalPokemon - side.team.length);
  const left = side.team.filter(p => !p.fainted).length + unknown;
  return (
    <div className="foe-roster" role="list" aria-label={`Opponent: ${left} of ${side.totalPokemon} Pokémon remaining`}>
      {side.team.map(p => (
        <WithPokemonTip key={p.name} p={p} foe tapToggle tabIndex={0} role="listitem"
          className={`roster-slot ${p.active ? 'is-active' : ''} ${p.fainted ? 'is-fainted' : ''}`}
          aria-label={`Opposing ${p.species}, ${p.fainted ? 'fainted' : `${Math.ceil(hpPercent(p.hp, p.maxhp))}% HP`}`}>
          <Sprite species={p.species} size={36} type={p.types[0]} />
        </WithPokemonTip>
      ))}
      {Array.from({length: unknown}, (_, i) => (
        <span key={`unknown-${i}`} className="roster-slot unknown" role="listitem" aria-label="Not yet seen">?</span>
      ))}
    </div>
  );
}

/** The battlefield: foe top right, the player's Pokémon (from behind) bottom left. */
function Stage({view}: {view: BattleView}) {
  const foe = view.foe.active;
  const me = view.me.active;
  return (
    <section className="stage" aria-label="Battlefield" data-terrain={view.field.terrain?.id}>
      <StageEffects field={view.field} />
      <FoeRoster side={view.foe} />
      <div className="stage-row foe-row">
        <InfoBox side={view.foe} foe />
        <div className="platform">
          <PlatformEffects side={view.foe} />
          {foe && (
            <WithPokemonTip p={foe} foe tapToggle tabIndex={0} role="button" aria-label={`Details: opposing ${foe.species}`}>
              <Sprite key={`foe-${foe.name}-${foe.species}`} species={foe.species} size={96} type={foe.types[0]}
                hp={foe.hp} className="enter-foe" />
            </WithPokemonTip>
          )}
        </div>
      </div>
      <div className="stage-row me-row">
        <div className="platform">
          <PlatformEffects side={view.me} />
          {me && (
            <WithPokemonTip p={me} tapToggle tabIndex={0} role="button" aria-label={`Details: your ${me.species}`}>
              <Sprite key={`me-${me.name}-${me.species}`} species={me.species} size={112} back type={me.types[0]}
                hp={me.hp} className="enter-me" />
            </WithPokemonTip>
          )}
        </div>
        <InfoBox side={view.me} />
      </div>
    </section>
  );
}

function InfoBox({side, foe}: {side: SideView; foe?: boolean}) {
  const p = side.active;
  return (
    <div className={`infobox ${foe ? 'foe' : 'mine'}`}>
      {!foe && (
        <div className="infobox-top">
          <TeamPips side={side} />
        </div>
      )}
      {p ? <ActiveDetails p={p} foe={foe} /> : <p className="muted small">{foe ? 'Choosing…' : 'No Pokémon active'}</p>}
      <SideConditions conditions={side.conditions} owner={foe ? 'the opponent’s side' : 'your side'} />
    </div>
  );
}

/** Hazards first (what hurts on switching in), then screens and the rest. */
function SideConditions({conditions, owner}: {conditions: ConditionView[]; owner: string}) {
  if (!conditions.length) return null;
  const hazard = (c: ConditionView) => conditionInfo(c, 'side').kind === 'hazard';
  const sorted = [...conditions.filter(hazard), ...conditions.filter(c => !hazard(c))];
  return (
    <div className="chips side-conds">
      {sorted.map(c => <ConditionBadge key={c.id} c={c} kind={hazard(c) ? 'hazard' : 'side'} owner={owner} />)}
    </div>
  );
}

function ActiveDetails({p, foe}: {p: PokemonView; foe?: boolean}) {
  const pct = hpPercent(p.hp, p.maxhp);
  const known = foe ? [p.ability, p.item].filter(Boolean).join(' · ') : '';
  return (
    <>
      <div className="mon-line">
        <strong className="mon-name">{p.species}</strong>
        <span className="muted small">L{p.level}</span>
        {p.status && <span className={`status ${p.status}`}>{STATUS_LABELS[p.status] ?? p.status}</span>}
      </div>
      <div className="mon-line">
        {p.types.map(t => <TypeBadge key={t} type={t} />)}
        {p.terastallized && <span className="chip tera">Tera</span>}
      </div>
      <HpBar hp={p.hp} maxhp={p.maxhp} />
      <div className="mon-line small">
        <span className="hp-text">{foe ? `${Math.ceil(pct)}%` : `${p.hp}/${p.maxhp}`}</span>
        {Object.entries(p.boosts).map(([k, v]) => (
          <span key={k} className={`chip ${v > 0 ? 'up' : 'down'}`}>{boostLabel(k, v)}</span>
        ))}
        {p.volatiles.map(v => (
          <ConditionBadge key={v.id} c={v} kind="volatile" compact owner={foe ? `the opposing ${p.species}` : `your ${p.species}`} />
        ))}
      </div>
      {known && <p className="muted tiny known">{known}</p>}
      {foe && p.moves.length > 0 && <p className="muted tiny known">{p.moves.join(', ')}</p>}
    </>
  );
}

/** What happened in the last step, revealed line by line. */
function LastTurn({lines}: {lines: string[]}) {
  const shown = lines.filter(l => !/^== Turn \d+ ==$/.test(l) && !/^Battle started/.test(l));
  if (!shown.length) return null;
  return (
    <section className="last-turn" aria-live="polite" key={lines.join('\n')}>
      {shown.map((line, i) => (
        <div key={i} className={`${lineClass(line)} reveal`} style={{animationDelay: `${Math.min(i, 12) * 120}ms`}}>
          {renderLine(line.trim())}
        </div>
      ))}
    </section>
  );
}

function Controls({view, pending, notice, onChoose, onForfeit, forfeitNote}: {
  view: BattleView;
  pending: boolean;
  notice: string | null;
  onChoose: (c: string) => void;
  onForfeit: () => void;
  forfeitNote: string;
}) {
  const [tera, setTera] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const prompt = view.prompt;
  // Reset the toggle each turn (and so once Tera has been used).
  useEffect(() => setTera(false), [view.turn]);

  const team = view.me.team;
  const disabled = pending || !prompt;
  const switchable = new Map((prompt?.switches ?? []).map(s => [s.teamIndex, s.slot]));

  return (
    <section className="card controls">
      {pending && <p className="muted small status-line">Waiting for the opponent…</p>}
      {!pending && prompt?.kind === 'switch' && (
        <p className="status-line"><strong>{prompt.reviving ? 'Choose a fainted Pokémon to revive' : 'Choose your next Pokémon'}</strong></p>
      )}
      {notice && <p className="notice small" role="alert">{notice}</p>}

      {prompt?.kind === 'move' && (
        <>
          <div className="moves">
            {prompt.moves.map(m => (
              <WithMoveTip key={m.slot} move={m}>
                <MoveButton move={m} disabled={disabled || m.disabled}
                  onClick={() => onChoose(`move ${m.slot}${tera ? ' terastallize' : ''}`)} />
              </WithMoveTip>
            ))}
          </div>
          {prompt.canTera && (
            <label className={`tera-toggle ${tera ? 'on' : ''}`}>
              <input type="checkbox" checked={tera} disabled={disabled} onChange={e => setTera(e.target.checked)} />
              Terastallize <TypeBadge type={prompt.canTera} />
            </label>
          )}
          {prompt.trapped && <p className="muted small">You can&apos;t switch out.</p>}
        </>
      )}

      <div className="switches">
        {team.map(p => {
          const slot = switchable.get(p.teamIndex!);
          const pct = hpPercent(p.hp, p.maxhp);
          return (
            <WithPokemonTip key={p.teamIndex} p={p}>
              <button className={`switch ${p.active ? 'is-active' : ''} ${p.fainted ? 'is-fainted' : ''}`}
                disabled={disabled || slot === undefined} onClick={() => slot && onChoose(`switch ${slot}`)}
                aria-label={`Switch to ${p.species}, ${p.fainted ? 'fainted' : `${Math.ceil(pct)}% HP`}`}>
                <Sprite species={p.species} size={40} type={p.types[0]} />
                <span className="switch-text">
                  <span className="switch-name">{p.species}</span>
                  <span className="switch-hp">
                    {p.fainted ? 'Fainted' : `${Math.ceil(pct)}%`}
                    {p.status && !p.fainted ? ` · ${STATUS_LABELS[p.status] ?? p.status}` : ''}
                  </span>
                </span>
                <span className="mini-hp" style={{width: `${pct}%`, background: hpColor(pct)}} />
              </button>
            </WithPokemonTip>
          );
        })}
      </div>

      <div className="forfeit-row">
        {confirmForfeit ? (
          <>
            <span className="small">{forfeitNote}</span>
            <button className="danger" disabled={pending} onClick={() => { setConfirmForfeit(false); onForfeit(); }}>Forfeit</button>
            <button onClick={() => setConfirmForfeit(false)}>Cancel</button>
          </>
        ) : (
          <button className="link" disabled={pending} onClick={() => setConfirmForfeit(true)}>Forfeit…</button>
        )}
      </div>
    </section>
  );
}

const EFFECTIVENESS: Record<number, [string, string]> = {
  0: ['No effect', 'none'],
  0.25: ['Barely effective', 'weak'],
  0.5: ['Not very effective', 'weak'],
  2: ['Super effective', 'strong'],
  4: ['Super effective ×4', 'strong'],
};

function MoveButton({move, disabled, onClick}: {move: MoveOption; disabled: boolean; onClick: () => void}) {
  const meta = move.category === 'Status' ? 'Status' : `${move.category === 'Physical' ? 'Phys' : 'Spec'} ${move.basePower || '—'}`;
  const eff = move.effectiveness === undefined ? undefined : EFFECTIVENESS[move.effectiveness];
  return (
    <button className="move" disabled={disabled} onClick={onClick} style={{borderColor: TYPE_COLORS[move.type]}}>
      <span className="move-top">
        <span className="move-name">{move.name}</span>
        <span className="muted small pp">{move.pp}/{move.maxpp}</span>
      </span>
      <span className="move-meta">
        <TypeBadge type={move.type} />
        <span className="muted small">{meta}</span>
      </span>
      {eff && <span className={`eff ${eff[1]}`}>{eff[0]}</span>}
    </button>
  );
}

export function ResultSummary({won, turns, myFainted, aiRemaining, forfeited, aiTeam, aiSeen, par}: {
  won: boolean;
  turns?: number;
  myFainted?: boolean[];
  aiRemaining?: number;
  forfeited?: boolean;
  aiTeam?: string[];
  aiSeen?: boolean[];
  par?: Par;
}) {
  // After a loss, Pokémon never sent out stay hidden. Older records without aiSeen show everything.
  const hidden = (i: number) => !won && aiSeen !== undefined && !aiSeen[i];
  const left = myFainted ? myFainted.filter(f => !f).length : undefined;
  const mine = left !== undefined && turns !== undefined ? {left, turns} : undefined;
  const verdict = won && par && mine ? parVerdict(mine, par) : undefined;
  return (
    <>
      {myFainted && (
        <p className="squares" aria-label={`${left} of 6 Pokémon remaining`}>
          {myFainted.map(f => (f ? '⬛' : '🟩')).join('')}
        </p>
      )}
      {verdict && mine && par ? (
        <>
          <p className={`par-verdict ${verdict}`}>{VERDICT_LABEL[verdict]}</p>
          <dl className="par-compare">
            <dt>You</dt><dd>{formatPar(mine)}</dd>
            <dt>Par</dt><dd>{formatPar(par)}</dd>
          </dl>
        </>
      ) : (
        <>
          <p className="muted">
            {turns !== undefined && `${turns} ${turns === 1 ? 'turn' : 'turns'}`}
            {!won && (forfeited ? ' · forfeit' : aiRemaining !== undefined ? ` · opponent had ${aiRemaining} Pokémon remaining` : '')}
          </p>
          {par && <p className="muted small">Par was {formatPar(par)}</p>}
        </>
      )}
      {aiTeam && (
        <div className="reveal-team">
          <p className="muted small">Opponent&apos;s team</p>
          <div className="sprite-row">
            {aiTeam.map((s, i) => hidden(i) ? (
              <figure key={s} aria-label="Not seen">
                <span className="unseen" aria-hidden>?</span>
                <figcaption className="tiny muted">Not seen</figcaption>
              </figure>
            ) : (
              <figure key={s}>
                <Sprite species={s} size={64} />
                <figcaption className="tiny">{s}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ResultPanel({result, puzzleNumber, par, onDone, onNewGame}: {
  result: BattleResult;
  puzzleNumber?: number;
  par?: Par;
  onDone: () => void;
  onNewGame?: () => void;
}) {
  const headline = result.winner === 'player' ? 'You won!' : result.winner === 'ai' ? 'You lost' : 'Tie';
  return (
    <section className="card result">
      <h2>{headline}</h2>
      {/* Practice teams are never played again, so even a loss reveals the whole opposing team. */}
      <ResultSummary won={result.winner === 'player'} {...result} par={par}
        aiSeen={puzzleNumber === undefined ? undefined : result.aiSeen} />
      <div className="row result-actions">
        {puzzleNumber !== undefined && (
          <ShareButton text={shareText({...result, puzzleNumber, par, won: result.winner === 'player'}, window.location.host)} />
        )}
        {onNewGame && <button className="primary" onClick={onNewGame}>New game</button>}
        <button onClick={onDone}>Done</button>
      </div>
    </section>
  );
}

/** Renders the LogFormatter's light markup: **bold**, ||exact||percent||. */
function renderLine(line: string): ReactNode {
  const text = line.replace(/\|\|[^|]*\|\|([^|]*)\|\|/g, '$1');
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

/** Indented lines are effects of the line above; lines about the AI get a different accent. */
function lineClass(line: string) {
  const foe = /opposing|^AI (sent|withdrew|won)/.test(line.trim());
  return `${line.startsWith('  ') ? 'log-detail' : 'log-main'} ${foe ? 'foe-line' : 'my-line'}`;
}

function BattleLog({lines, open, onToggle}: {lines: string[]; open: boolean; onToggle: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, open]);
  return (
    <section className="card log-card">
      <button className="log-toggle" onClick={onToggle} aria-expanded={open}>
        <span>Battle log</span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="log" ref={ref}>
          {lines.map((line, i) => {
            const turn = line.match(/^== (Turn \d+) ==$/);
            if (turn) return <div key={i} className="log-turn">{turn[1]}</div>;
            return <div key={i} className={lineClass(line)}>{renderLine(line.trim())}</div>;
          })}
        </div>
      )}
    </section>
  );
}
