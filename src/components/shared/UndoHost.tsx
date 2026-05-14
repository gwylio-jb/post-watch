/**
 * Sprint 19: bottom-of-screen toast that surfaces the single pending
 * undo entry. Subscribes to undoBus and re-renders both on slot change
 * and on a 250ms tick so the countdown stays current.
 *
 * Sits in the app shell once; doesn't render anything when the slot
 * is empty. Position is `fixed` so it floats above every page.
 */
import { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import {
  subscribe, getUndo, performUndo, dismissUndo,
} from '../../utils/undoBus';

export default function UndoHost() {
  // Trick to force re-render on bus change. We don't actually need
  // useSyncExternalStore's snapshot semantics — we just want a tick.
  const [, force] = useState(0);

  useEffect(() => {
    return subscribe(() => force(n => n + 1));
  }, []);

  // Tick the countdown — only run a timer while an entry exists,
  // so we're idle when the slot is empty.
  useEffect(() => {
    const entry = getUndo();
    if (!entry) return;
    const id = setInterval(() => force(n => n + 1), 250);
    return () => clearInterval(id);
  });

  const entry = getUndo();
  if (!entry) return null;

  const remaining = Math.max(0, entry.expiresAt - Date.now());
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-1)',
        border: '1px solid var(--line-2)',
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        fontSize: 13,
        color: 'var(--ink-1)',
        fontFamily: 'inherit',
        minWidth: 280,
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{entry.label}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {seconds}s</span>
      </div>
      <button
        type="button"
        onClick={performUndo}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,217,163,0.14)',
          border: '1px solid rgba(0,217,163,0.30)',
          color: 'var(--mint)',
          borderRadius: 10,
          padding: '6px 12px',
          fontSize: 12, fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Undo2 className="w-3 h-3" />
        Undo
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissUndo}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink-3)', padding: 4, display: 'inline-flex',
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
