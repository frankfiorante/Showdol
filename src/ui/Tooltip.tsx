'use client';

import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

const LONG_PRESS_MS = 400;

/**
 * Tooltip behavior like Showdown's: hover with a mouse, long-press on touch
 * (it stays open after lifting the finger until the next tap), and keyboard
 * focus. A long press never also triggers the element's click.
 */
export function useTooltip({tapToggle = false}: {tapToggle?: boolean} = {}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const start = useRef<{x: number; y: number} | null>(null);
  const id = useId();

  const cancelTimer = () => window.clearTimeout(timer.current);
  useEffect(() => cancelTimer, []);

  // Close on a tap elsewhere, scrolling, or Escape.
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', close, {passive: true, capture: true});
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', close, {capture: true});
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const ref = useCallback((el: HTMLElement | null) => {
    anchor.current = el;
  }, []);

  const triggerProps = {
    ref,
    'aria-describedby': open ? id : undefined,
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(true),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(false),
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      longPressed.current = false;
      start.current = {x: e.clientX, y: e.clientY};
      cancelTimer();
      timer.current = window.setTimeout(() => {
        longPressed.current = true;
        setOpen(true);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // A drag or scroll isn't a long press.
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancelTimer();
    },
    onPointerUp: cancelTimer,
    onPointerCancel: cancelTimer,
    onClickCapture: (e: React.MouseEvent) => {
      if (longPressed.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressed.current = false;
      } else if (tapToggle) {
        setOpen(o => !o);
      }
    },
    // Stops the long-press context menu / image callout on phones.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // Keyboard focus only (the focused element may be a button inside the trigger).
    onFocus: (e: React.FocusEvent) => {
      if ((e.target as HTMLElement).matches(':focus-visible')) setOpen(true);
    },
    onBlur: () => setOpen(false),
  };

  return {open, anchor, id, triggerProps};
}

/** Positions itself above (or below) the anchor, kept inside the viewport. */
export function Tooltip({open, anchor, id, children}: {
  open: boolean;
  anchor: React.RefObject<HTMLElement | null>;
  id: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{left: number; top: number} | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !box.current) {
      setPos(null);
      return;
    }
    const a = anchor.current.getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, a.left + a.width / 2 - b.width / 2), window.innerWidth - b.width - margin);
    const above = a.top - b.height - margin;
    const below = a.bottom + margin;
    const top = above >= margin || below + b.height > window.innerHeight ? Math.max(margin, above) : below;
    setPos({left, top});
  }, [open, anchor, children]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={box} id={id} role="tooltip" className="tooltip"
      style={pos ? {left: pos.left, top: pos.top} : {left: 0, top: 0, visibility: 'hidden'}}>
      {children}
    </div>,
    document.body,
  );
}
