'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {BattleResult, BattleView, MoveOption, PokemonView, SideView} from '@/engine/view';
import {STATUS_LABELS, TYPE_COLORS, boostLabel, hpColor, hpPercent} from './format';

interface Props {
  view: BattleView;
  log: string[];
  pending: boolean;
  notice: string | null;
  onChoose: (choice: string) => void;
  onForfeit: () => void;
  onPlayAgain: () => void;
}

export function BattleScreen({view, log, pending, notice, onChoose, onForfeit, onPlayAgain}: Props) {
  return (
    <div className="battle">
      <div className="turn-bar">
        <span>Turn {view.turn}</span>
        <FieldSummary view={view} />
      </div>
      <ActiveCard side={view.foe} foe />
      <ActiveCard side={view.me} />
      {view.result ? (
        <ResultPanel result={view.result} foe={view.foe} onPlayAgain={onPlayAgain} />
      ) : (
        <Controls view={view} pending={pending} notice={notice} onChoose={onChoose} onForfeit={onForfeit} />
      )}
      <BattleLog lines={log} />
    </div>
  );
}

function FieldSummary({view}: {view: BattleView}) {
  const parts = [view.field.weather, view.field.terrain && `${view.field.terrain} Terrain`, ...view.field.pseudoWeather];
  const text = parts.filter(Boolean).join(' · ');
  return text ? <span className="muted">{text}</span> : null;
}

function TypeBadge({type}: {type: string}) {
  return (
    <span className="type" style={{background: TYPE_COLORS[type] ?? '#888'}}>
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
  return (
    <div className="pips" aria-label={foe ? 'Opponent team' : 'Your team'}>
      {pips.map((state, i) => (
        <span key={i} className={`pip ${state}`} />
      ))}
    </div>
  );
}

function ActiveCard({side, foe}: {side: SideView; foe?: boolean}) {
  const p = side.active;
  return (
    <section className={`card active-card ${foe ? 'foe' : 'mine'}`}>
      <div className="active-head">
        <span className="muted small">{foe ? 'Opponent' : 'You'}</span>
        <TeamPips side={side} foe={foe} />
      </div>
      {p ? <ActiveDetails p={p} foe={foe} /> : <p className="muted">No Pokémon active</p>}
      {side.conditions.length > 0 && <div className="chips">{side.conditions.map(c => <span key={c} className="chip">{c}</span>)}</div>}
    </section>
  );
}

function ActiveDetails({p, foe}: {p: PokemonView; foe?: boolean}) {
  const pct = hpPercent(p.hp, p.maxhp);
  return (
    <>
      <div className="mon-line">
        <strong className="mon-name">{p.species}</strong>
        <span className="muted small">L{p.level}</span>
        {p.types.map(t => <TypeBadge key={t} type={t} />)}
        {p.terastallized && <span className="chip tera">Tera {p.terastallized}</span>}
      </div>
      <HpBar hp={p.hp} maxhp={p.maxhp} />
      <div className="mon-line small">
        <span className="hp-text">{foe ? `${Math.ceil(pct)}%` : `${p.hp}/${p.maxhp} HP`}</span>
        {p.status && <span className={`status ${p.status}`}>{STATUS_LABELS[p.status] ?? p.status}</span>}
        {Object.entries(p.boosts).map(([k, v]) => (
          <span key={k} className={`chip ${v > 0 ? 'up' : 'down'}`}>{boostLabel(k, v)}</span>
        ))}
        {p.volatiles.map(v => <span key={v} className="chip">{v}</span>)}
      </div>
      {foe && (p.item || p.ability || p.moves.length > 0) && (
        <p className="muted small known">
          {[p.ability, p.item, p.moves.join(', ')].filter(Boolean).join(' · ')}
        </p>
      )}
      {!foe && (
        <p className="muted small known">{[p.ability, p.item].filter(Boolean).join(' · ')}</p>
      )}
    </>
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
  // Reset the toggle each turn, and once Tera is used.
  useEffect(() => setTera(false), [view.turn]);

  const team = view.me.team;
  const disabled = pending || !prompt;
  const switchable = new Map((prompt?.switches ?? []).map(s => [s.teamIndex, s.slot]));

  return (
    <section className="card controls">
      {pending && <p className="muted small status-line">Waiting…</p>}
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
            <button key={p.teamIndex} className={`switch ${p.active ? 'is-active' : ''}`}
              disabled={disabled || slot === undefined} onClick={() => slot && onChoose(`switch ${slot}`)}>
              <span className="switch-name">{p.species}</span>
              <span className="switch-hp">
                {p.fainted ? 'Fainted' : `${Math.ceil(pct)}%`}
                {p.status && !p.fainted ? ` · ${STATUS_LABELS[p.status] ?? p.status}` : ''}
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

function MoveButton({move, disabled, onClick}: {move: MoveOption; disabled: boolean; onClick: () => void}) {
  const meta = move.category === 'Status' ? 'Status' : `${move.category} ${move.basePower || '—'}`;
  return (
    <button className="move" disabled={disabled} onClick={onClick} style={{borderColor: TYPE_COLORS[move.type]}}>
      <span className="move-name">{move.name}</span>
      <span className="move-meta">
        <TypeBadge type={move.type} />
        <span className="muted small">{meta}</span>
        <span className="muted small pp">{move.pp}/{move.maxpp}</span>
      </span>
    </button>
  );
}

function ResultPanel({result, foe, onPlayAgain}: {result: BattleResult; foe: SideView; onPlayAgain: () => void}) {
  const headline = result.winner === 'player' ? 'You won!' : result.winner === 'ai' ? 'You lost' : 'Tie';
  const left = result.myFainted.filter(f => !f).length;
  return (
    <section className="card result">
      <h2>{headline}</h2>
      <p className="squares" aria-label={`${left} of 6 Pokémon left`}>
        {result.myFainted.map(f => (f ? '⬛' : '🟩')).join('')}
      </p>
      <p className="muted">
        {result.turns} turns
        {result.winner === 'ai' && (result.forfeited ? ' · forfeit' : ` · opponent had ${result.aiRemaining} left`)}
      </p>
      <p className="muted small">Opponent revealed: {foe.team.map(p => p.species).join(', ') || 'none'}</p>
      <button className="primary" onClick={onPlayAgain}>Play again</button>
    </section>
  );
}

/** Renders the LogFormatter's light markup: **bold**, ||exact||percent||, turn headers. */
function renderLine(line: string): ReactNode {
  const text = line.replace(/\|\|[^|]*\|\|([^|]*)\|\|/g, '$1');
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function BattleLog({lines}: {lines: string[]}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, open]);
  return (
    <section className="card log-card">
      <button className="log-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        Battle log {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="log" ref={ref} aria-live="polite">
          {lines.map((line, i) => {
            const turn = line.match(/^== (Turn \d+) ==$/);
            if (turn) return <div key={i} className="log-turn">{turn[1]}</div>;
            const detail = line.startsWith('  ');
            return <div key={i} className={detail ? 'log-detail' : 'log-main'}>{renderLine(line.trim())}</div>;
          })}
        </div>
      )}
    </section>
  );
}
