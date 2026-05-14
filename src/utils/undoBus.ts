/**
 * Sprint 19: a single-entry undo bus.
 *
 * The whole app shares one slot. Pushing a new undo replaces (and
 * implicitly forfeits) any pending entry — single-level undo is the
 * mental model we want; if a user deletes A then deletes B, hitting
 * undo brings B back, not both.
 *
 * Entries auto-expire after `DEFAULT_TTL_MS`. The host re-renders on
 * each tick of a small timer so the countdown label stays current
 * without every caller having to manage timers.
 *
 * Callers publish via `pushUndo({ label, revert })`. The revert
 * callback closes over whatever data is needed to restore the deleted
 * record — the bus stays data-model-agnostic.
 */

export interface UndoEntry {
  /** Short label shown in the toast, e.g. "Risk deleted". */
  label: string;
  /** Run when the user clicks Undo. */
  revert: () => void;
  /** Epoch ms when this entry expires. */
  expiresAt: number;
  /** Internal id for React keys + dedup. */
  id: string;
}

export const DEFAULT_TTL_MS = 8000;

let current: UndoEntry | null = null;
const listeners = new Set<() => void>();
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const l of listeners) l();
}

function scheduleExpiry(): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  if (!current) return;
  const remaining = current.expiresAt - Date.now();
  if (remaining <= 0) {
    current = null;
    emit();
    return;
  }
  expiryTimer = setTimeout(() => {
    current = null;
    expiryTimer = null;
    emit();
  }, remaining);
}

export function pushUndo(args: { label: string; revert: () => void; ttlMs?: number }): void {
  const ttl = args.ttlMs ?? DEFAULT_TTL_MS;
  current = {
    label: args.label,
    revert: args.revert,
    expiresAt: Date.now() + ttl,
    id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  scheduleExpiry();
  emit();
}

/** Run the pending undo, if any, and clear the slot. */
export function performUndo(): void {
  const entry = current;
  current = null;
  if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  emit();
  if (entry) {
    try { entry.revert(); } catch (e) {
      console.error('[undoBus] revert threw', e);
    }
  }
}

/** Drop the pending entry without running it. */
export function dismissUndo(): void {
  if (!current) return;
  current = null;
  if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  emit();
}

export function getUndo(): UndoEntry | null {
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test hook — reset module state between specs. */
export const __testing__ = {
  reset(): void {
    current = null;
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
    listeners.clear();
  },
};
