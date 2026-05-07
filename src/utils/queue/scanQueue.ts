/**
 * Pure queue manager for batch WordPress scans.
 *
 * Sprint 13 Pack 2 §3.5 of the discovery doc. The queue is persisted in
 * localStorage so it survives app restarts (a long batch shouldn't be lost
 * to a routine browser/Tauri reload). This module is intentionally
 * effect-free beyond the storage read/write — see queueRunner.ts for the
 * actual scan-execution glue.
 *
 * Storage shape: localStorage key `clause-control:wp-audit-queue` holds a
 * `ScanQueueItem[]`. The cursor key `clause-control:wp-audit-queue-cursor`
 * holds the id of the currently-running item (recovered on app launch so a
 * crash mid-scan doesn't lose its place).
 *
 * All exports are pure (no setTimeout, no fetch, no React). Caller decides
 * when to read/write.
 */
import type { ScanQueueItem, ScanQueueStatus } from '../../data/types';

const QUEUE_KEY  = 'clause-control:wp-audit-queue';
const CURSOR_KEY = 'clause-control:wp-audit-queue-cursor';

// ─── Storage I/O ───────────────────────────────────────────────────────────

export function loadQueue(): ScanQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: ScanQueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function loadCursor(): string | null {
  try {
    return localStorage.getItem(CURSOR_KEY);
  } catch {
    return null;
  }
}

export function setCursor(id: string | null): void {
  if (id === null) localStorage.removeItem(CURSOR_KEY);
  else             localStorage.setItem(CURSOR_KEY, id);
}

// ─── Mutators (pure functions over the queue array) ────────────────────────

/** Append `items` as new pending entries. */
export function enqueue(queue: ScanQueueItem[], items: { targetUrl: string; clientId?: string }[]): ScanQueueItem[] {
  const now = new Date().toISOString();
  const next: ScanQueueItem[] = items.map((it, i) => ({
    id: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    targetUrl: it.targetUrl,
    clientId: it.clientId,
    status: 'pending',
    enqueuedAt: now,
  }));
  return [...queue, ...next];
}

/** First pending item in source order. */
export function nextPending(queue: ScanQueueItem[]): ScanQueueItem | undefined {
  return queue.find(q => q.status === 'pending');
}

/** Mark `id` as running (sets startedAt, leaves other rows alone). */
export function markRunning(queue: ScanQueueItem[], id: string): ScanQueueItem[] {
  const now = new Date().toISOString();
  return queue.map(q => q.id === id ? { ...q, status: 'running' as const, startedAt: now } : q);
}

/** Mark `id` as done with the resulting AuditReport id attached. */
export function markDone(queue: ScanQueueItem[], id: string, reportId: string): ScanQueueItem[] {
  const now = new Date().toISOString();
  return queue.map(q => q.id === id
    ? { ...q, status: 'done' as const, reportId, completedAt: now }
    : q
  );
}

/** Mark `id` as failed with an error message. */
export function markFailed(queue: ScanQueueItem[], id: string, error: string): ScanQueueItem[] {
  const now = new Date().toISOString();
  return queue.map(q => q.id === id
    ? { ...q, status: 'failed' as const, error, completedAt: now }
    : q
  );
}

/** Cancel a single pending or running item. */
export function cancel(queue: ScanQueueItem[], id: string): ScanQueueItem[] {
  const now = new Date().toISOString();
  return queue.map(q => {
    if (q.id !== id) return q;
    // Done / failed / already-cancelled stay put — no point unsetting them.
    if (q.status === 'pending' || q.status === 'running') {
      return { ...q, status: 'cancelled' as const, completedAt: now };
    }
    return q;
  });
}

/** Drop every row that's already terminal (done / failed / cancelled). */
export function clearCompleted(queue: ScanQueueItem[]): ScanQueueItem[] {
  return queue.filter(q => q.status === 'pending' || q.status === 'running');
}

// ─── Counts (UI helpers) ───────────────────────────────────────────────────

export function counts(queue: ScanQueueItem[]): Record<ScanQueueStatus, number> {
  const out: Record<ScanQueueStatus, number> = {
    pending: 0, running: 0, done: 0, failed: 0, cancelled: 0,
  };
  for (const q of queue) out[q.status] += 1;
  return out;
}

// ─── Crash recovery ────────────────────────────────────────────────────────

/**
 * On app launch: any row that was 'running' must have been mid-scan when the
 * app died. Reset it to 'pending' so the runner picks it up again.
 */
export function recoverInflight(queue: ScanQueueItem[]): ScanQueueItem[] {
  return queue.map(q => q.status === 'running'
    ? { ...q, status: 'pending' as const, startedAt: undefined }
    : q
  );
}
