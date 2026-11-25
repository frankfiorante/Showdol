'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {BattleResult, BattleView, MoveOption, PokemonView, SideView} from '@/engine/view';
import {STATUS_LABELS, TYPE_COLORS, boostLabel, hpColor, hpPercent, typeStyle} from './format';
import {Sprite} from './Sprite';

interface Props {
  puzzleNumber: number;
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
}

export function BattleScreen(props: Props) {
  const {puzzleNumber, view, log, latest, pending, notice, logExpanded, onToggleLog, onChoose, onForfeit, onDone} = props;
  return (
    <div className="battle">
      <header className="battle-head">
        <span>Showdol #{puzzleNumber}</span>
        <span className="muted">Turn {view.turn}</span>
      </header>
      <FieldChips view={view} />
      <Stage view={view} />
      <LastTurn lines={latest} />
      {view.result ? (
        <ResultPanel result={view.result} onDone={onDone} />
      ) : (
        <Controls view={view} pending={pending} notice={notice} onChoose={onChoose} onForfeit={onForfeit} />
      )}
      <BattleLog lines={log} open={logExpanded} onToggle={onToggleLog} />
    </div>
  );
}

function FieldChips({view}: {view: BattleView}) {
  const parts = [view.field.weather, view.field.terrain && `${view.field.terrain} Terrain`, ...view.field.pseudoWeather];
  const items = parts.filter(Boolean) as string[];
  if (!items.length) return null;
  return <div className="field-chips">{items.map(t => <span key={t} className="chip">{t}</span>)}</div>;
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

/** Six slots: the foe's revealed Pokémon, then unknowns. */
function TeamPips({side, foe}: {side: SideView; foe?: boolean}) {
  const pips: string[] = side.team.map(p => (p.fainted ? 'fainted' : 'alive'));
  while (pips.length < side.totalPokemon) pips.push('unknown');
  const left = side.team.filter(p => !p.fainted).length + (side.totalPokemon - side.team.length);
  return (
    <div className="pips" role="img" aria-label={`${foe ? 'Opponent' : 'You'}: ${left} of ${side.totalPokemon} left`}>
      {pips.map((state, i) => <span key={i} className={`pip ${state}`} />)}
    </div>
  );
}

/** The battlefield: foe top right, the player's Pokémon (from behind) bottom left. */
function Stage({view}: {view: BattleView}) {
  const foe = view.foe.active;
  const me = view.me.active;
  return (
    <section className="stage" aria-label="Battlefield">
      <div className="stage-row foe-row">
        <InfoBox side={view.foe} foe />
        <div className="platform">
          {foe && <Sprite key={`foe-${foe.name}-${foe.species}`} species={foe.species} size={96} type={foe.types[0]}
            hp={foe.hp} className="enter-foe" />}
        </div>
      </div>
      <div className="stage-row me-row">
        <div className="platform">
          {me && <Sprite key={`me-${me.name}-${me.species}`} species={me.species} size={112} back type={me.types[0]}
            hp={me.hp} className="enter-me" />}
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
      <div className="infobox-top">
        <TeamPips side={side} foe={foe} />
      </div>
      {p ? <ActiveDetails p={p} foe={foe} /> : <p className="muted small">{foe ? 'Choosing…' : 'No Pokémon active'}</p>}
      {side.conditions.length > 0 && (
        <div className="chips">{side.conditions.map(c => <span key={c} className="chip hazard">{c}</span>)}</div>
      )}
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
        {p.volatiles.map(v => <span key={v} className="chip">{v}</span>)}
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

function Controls({view, pending, notice, onChoose, onForfeit}: {
  view: BattleView;
  pending: boolean;
  notice: string | null;
  onChoose: (c: string) => void;
  onForfeit: () => void;
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
              <MoveButton key={m.slot} move={m} disabled={disabled || m.disabled}
                onClick={() => onChoose(`move ${m.slot}${tera ? ' terastallize' : ''}`)} />
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
            <button key={p.teamIndex} className={`switch ${p.active ? 'is-active' : ''} ${p.fainted ? 'is-fainted' : ''}`}
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
          );
        })}
      </div>

      <div className="forfeit-row">
        {confirmForfeit ? (
          <>
            <span className="small">Forfeit counts as a loss.</span>
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
    <button className="move" disabled={disabled} onClick={onClick} style={{borderColor: TYPE_COLORS[move.type]}}
      title={`${move.name}: ${move.type}, ${move.category}${move.basePower ? `, ${move.basePower} power` : ''}, ${move.pp}/${move.maxpp} PP`}>
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

export function ResultSummary({won, turns, myFainted, aiRemaining, forfeited, aiTeam}: {
  won: boolean;
  turns?: number;
  myFainted?: boolean[];
  aiRemaining?: number;
  forfeited?: boolean;
  aiTeam?: string[];
}) {
  const left = myFainted ? myFainted.filter(f => !f).length : undefined;
  return (
    <>
      {myFainted && (
        <p className="squares" aria-label={`${left} of 6 Pokémon left`}>
          {myFainted.map(f => (f ? '⬛' : '🟩')).join('')}
        </p>
      )}
      <p className="muted">
        {turns !== undefined && `${turns} turns`}
        {!won && (forfeited ? ' · forfeit' : aiRemaining !== undefined ? ` · opponent had ${aiRemaining} left` : '')}
      </p>
      {aiTeam && (
        <div className="reveal-team">
          <p className="muted small">Opponent&apos;s team</p>
          <div className="sprite-row">
            {aiTeam.map(s => (
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

function ResultPanel({result, onDone}: {result: BattleResult; onDone: () => void}) {
  const headline = result.winner === 'player' ? 'You won!' : result.winner === 'ai' ? 'You lost' : 'Tie';
  return (
    <section className="card result">
      <h2>{headline}</h2>
      <ResultSummary won={result.winner === 'player'} {...result} />
      <button className="primary" onClick={onDone}>Done</button>
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
