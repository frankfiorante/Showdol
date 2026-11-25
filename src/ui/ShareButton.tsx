'use client';

import {useEffect, useRef, useState} from 'react';

/**
 * Shares text with the phone's share sheet on touch devices (Web Share API),
 * otherwise copies it to the clipboard with a "Copied" toast. If neither is
 * available, shows the text selected so it can be copied by hand.
 */
export function ShareButton({text, className = 'primary'}: {text: string; className?: string}) {
  const [toast, setToast] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (manual) area.current?.select();
  }, [manual]);

  async function share() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({text});
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied to clipboard');
    } catch {
      setManual(true);
    }
  }

  return (
    <div className="share">
      <button className={className} onClick={share}>Share</button>
      {toast && <div className="toast" role="status">{toast}</div>}
      {manual && (
        <textarea ref={area} className="share-text" readOnly rows={text.split('\n').length} value={text}
          aria-label="Result to copy" />
      )}
    </div>
  );
}
