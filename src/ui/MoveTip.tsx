'use client';

import type {ReactNode} from 'react';
import type {MoveOption} from '@/engine/view';
import {typeStyle} from './format';
import {Tooltip, useTooltip} from './Tooltip';

function priorityText(priority: number) {
  const n = `${priority > 0 ? '+' : '−'}${Math.abs(priority)}`;
  if (priority > 1) return <>Nearly always moves first <em>(priority {n})</em>.</>;
  if (priority === 1) return <>Usually moves first <em>(priority {n})</em>.</>;
  if (priority < 0) return <>Nearly always moves last <em>(priority {n})</em>.</>;
  return null;
}

/** Showdown-style details for one of the player's moves. */
export function MoveTip({move}: {move: MoveOption}) {
  const priority = priorityText(move.priority);
  return (
    <div className="tip move-tip">
      <div className="tip-head"><strong>{move.name}</strong></div>
      <div className="tip-row">
        <span className="type" style={typeStyle(move.type)}>{move.type}</span>
        <span className={`category ${move.category.toLowerCase()}`}>{move.category}</span>
      </div>
      {move.category !== 'Status' && (
        <div className="tip-line"><span className="tip-label">Base power:</span> {move.basePower || '—'}</div>
      )}
      <div className="tip-line">
        <span className="tip-label">Accuracy:</span> {move.accuracy === true ? 'can’t miss' : `${move.accuracy}%`}
      </div>
      <div className="tip-line"><span className="tip-label">PP:</span> {move.pp}/{move.maxpp}</div>
      {priority && <p className="tip-section">{priority}</p>}
      {move.desc && <p className="tip-section">{move.desc}</p>}
      {move.flags.length > 0 && (
        <ul className="tip-flags">{move.flags.map(f => <li key={f}>✓ {f}</li>)}</ul>
      )}
    </div>
  );
}

/** Wraps a move button so hovering / long-pressing / focusing it shows the move's details. */
export function WithMoveTip({move, children}: {move: MoveOption; children: ReactNode}) {
  const {open, anchor, id, triggerProps} = useTooltip();
  return (
    <>
      <span {...triggerProps} className="tip-trigger">{children}</span>
      <Tooltip open={open} anchor={anchor} id={id}><MoveTip move={move} /></Tooltip>
    </>
  );
}
