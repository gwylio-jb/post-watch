/**
 * Sprint 22: shared toast bus.
 *
 * SettingsMenu grew its own toast state; UndoHost has another surface;
 * new v3.0 features would have added a third. One bus, one host, one
 * placement (bottom-centre, above UndoHost's slot).
 *
 * Same module-scope pattern as undoBus: utils own the queue, a single
 * <ToastHost /> renders it. Non-React callers (utils) can toast too.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastEntry {
  id: string;
  kind: ToastKind;
  message: string;
  expiresAt: number;
}

const DEFAULT_TTL: Record<ToastKind, number> = {
  success: 3500,
  info: 4500,
  error: 6500,   // errors linger — the user needs time to read them
};

let queue: ToastEntry[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const l of listeners) l();
}

export function pushToast(kind: ToastKind, message: string, ttlMs?: number): void {
  const ttl = ttlMs ?? DEFAULT_TTL[kind];
  const entry: ToastEntry = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message,
    expiresAt: Date.now() + ttl,
  };
  // Cap the stack at 3 — older ones drop off rather than piling up.
  queue = [...queue.slice(-2), entry];
  emit();
  const t = setTimeout(() => dismissToast(entry.id), ttl);
  timers.set(entry.id, t);
}

export function dismissToast(id: string): void {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
  const before = queue.length;
  queue = queue.filter(e => e.id !== id);
  if (queue.length !== before) emit();
}

export function getToasts(): ToastEntry[] {
  return queue;
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test hook. */
export const __testing__ = {
  reset(): void {
    queue = [];
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    listeners.clear();
  },
};
