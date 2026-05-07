/**
 * Tests for the pure scan-queue manager.
 *
 * What we're protecting against:
 *  - State machine errors: a 'done' row being silently re-set to 'running',
 *    a 'failed' row losing its error message, etc.
 *  - Storage I/O: malformed JSON crashing loadQueue (must return []).
 *  - Crash recovery: 'running' rows that survive a restart must come back
 *    to 'pending' so the runner doesn't skip them.
 *  - Cursor handling: clearing the cursor when no item is running.
 */
import {
  loadQueue, saveQueue, loadCursor, setCursor,
  enqueue, nextPending, markRunning, markDone, markFailed,
  cancel, clearCompleted, counts, recoverInflight,
} from './scanQueue';
import type { ScanQueueItem } from '../../data/types';

const QUEUE_KEY  = 'clause-control:wp-audit-queue';
const CURSOR_KEY = 'clause-control:wp-audit-queue-cursor';

function fakeRow(over: Partial<ScanQueueItem> = {}): ScanQueueItem {
  return {
    id: over.id ?? `q-${Math.random().toString(36).slice(2, 8)}`,
    targetUrl: 'https://example.com',
    status: 'pending',
    enqueuedAt: '2026-05-01T00:00:00Z',
    ...over,
  };
}

// ─── Storage I/O ───────────────────────────────────────────────────────────

describe('loadQueue / saveQueue', () => {
  it('returns [] when the key is missing', () => {
    expect(loadQueue()).toEqual([]);
  });

  it('round-trips a queue array', () => {
    const original = [fakeRow({ id: 'a' }), fakeRow({ id: 'b', status: 'done' })];
    saveQueue(original);
    expect(loadQueue()).toEqual(original);
  });

  it('returns [] when storage holds malformed JSON', () => {
    localStorage.setItem(QUEUE_KEY, '{not valid');
    expect(loadQueue()).toEqual([]);
  });

  it('returns [] when storage holds a non-array shape', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ unexpected: true }));
    expect(loadQueue()).toEqual([]);
  });
});

describe('cursor I/O', () => {
  it('returns null when no cursor is set', () => {
    expect(loadCursor()).toBeNull();
  });

  it('sets and reads the cursor by id', () => {
    setCursor('q-running');
    expect(loadCursor()).toBe('q-running');
  });

  it('null clears the cursor key', () => {
    setCursor('q-x');
    setCursor(null);
    expect(localStorage.getItem(CURSOR_KEY)).toBeNull();
  });
});

// ─── Mutators ──────────────────────────────────────────────────────────────

describe('enqueue', () => {
  it('appends new pending rows for each input', () => {
    const result = enqueue([], [
      { targetUrl: 'https://a.com' },
      { targetUrl: 'https://b.com', clientId: 'c-1' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].targetUrl).toBe('https://a.com');
    expect(result[0].status).toBe('pending');
    expect(result[1].clientId).toBe('c-1');
  });

  it('preserves the existing queue order', () => {
    const start = [fakeRow({ id: 'old' })];
    const next = enqueue(start, [{ targetUrl: 'https://new.com' }]);
    expect(next[0].id).toBe('old');
    expect(next[1].targetUrl).toBe('https://new.com');
  });

  it('gives every row a distinct id', () => {
    const result = enqueue([], Array(10).fill({ targetUrl: 'https://a.com' }));
    const ids = new Set(result.map(r => r.id));
    expect(ids.size).toBe(10);
  });
});

describe('nextPending', () => {
  it('returns the first pending row in source order', () => {
    const q = [
      fakeRow({ id: 'a', status: 'done' }),
      fakeRow({ id: 'b', status: 'pending' }),
      fakeRow({ id: 'c', status: 'pending' }),
    ];
    expect(nextPending(q)?.id).toBe('b');
  });

  it('skips running rows (only one runner at a time)', () => {
    const q = [
      fakeRow({ id: 'a', status: 'running' }),
      fakeRow({ id: 'b', status: 'pending' }),
    ];
    expect(nextPending(q)?.id).toBe('b');
  });

  it('returns undefined when no rows are pending', () => {
    const q = [fakeRow({ status: 'done' }), fakeRow({ status: 'cancelled' })];
    expect(nextPending(q)).toBeUndefined();
  });
});

describe('state transitions', () => {
  it('markRunning sets status + startedAt', () => {
    const q = [fakeRow({ id: 'r1' })];
    const next = markRunning(q, 'r1');
    expect(next[0].status).toBe('running');
    expect(next[0].startedAt).toBeDefined();
  });

  it('markDone sets status + reportId + completedAt', () => {
    const q = [fakeRow({ id: 'r1', status: 'running' })];
    const next = markDone(q, 'r1', 'report-42');
    expect(next[0].status).toBe('done');
    expect(next[0].reportId).toBe('report-42');
    expect(next[0].completedAt).toBeDefined();
  });

  it('markFailed sets status + error + completedAt', () => {
    const q = [fakeRow({ id: 'r1', status: 'running' })];
    const next = markFailed(q, 'r1', 'TLS handshake failed');
    expect(next[0].status).toBe('failed');
    expect(next[0].error).toBe('TLS handshake failed');
  });

  it('cancel turns pending → cancelled', () => {
    const q = [fakeRow({ id: 'r1', status: 'pending' })];
    expect(cancel(q, 'r1')[0].status).toBe('cancelled');
  });

  it('cancel turns running → cancelled', () => {
    const q = [fakeRow({ id: 'r1', status: 'running' })];
    expect(cancel(q, 'r1')[0].status).toBe('cancelled');
  });

  it('cancel is a no-op on already-terminal rows', () => {
    const q = [fakeRow({ id: 'r1', status: 'done' })];
    expect(cancel(q, 'r1')[0].status).toBe('done');
  });

  it('all mutators are immutable — input array is not modified', () => {
    const original = [fakeRow({ id: 'r1' })];
    markRunning(original, 'r1');
    expect(original[0].status).toBe('pending');
  });
});

describe('clearCompleted', () => {
  it('drops done / failed / cancelled rows; keeps pending + running', () => {
    const q = [
      fakeRow({ id: 'a', status: 'pending' }),
      fakeRow({ id: 'b', status: 'running' }),
      fakeRow({ id: 'c', status: 'done' }),
      fakeRow({ id: 'd', status: 'failed' }),
      fakeRow({ id: 'e', status: 'cancelled' }),
    ];
    const next = clearCompleted(q);
    expect(next.map(r => r.id)).toEqual(['a', 'b']);
  });
});

describe('counts', () => {
  it('counts every status accurately', () => {
    const q = [
      fakeRow({ status: 'pending' }), fakeRow({ status: 'pending' }),
      fakeRow({ status: 'running' }),
      fakeRow({ status: 'done' }), fakeRow({ status: 'done' }), fakeRow({ status: 'done' }),
      fakeRow({ status: 'failed' }),
    ];
    expect(counts(q)).toEqual({ pending: 2, running: 1, done: 3, failed: 1, cancelled: 0 });
  });
});

describe('recoverInflight', () => {
  it('resets running rows back to pending on app launch', () => {
    const q = [
      fakeRow({ id: 'a', status: 'running', startedAt: '2026-05-01T00:00:00Z' }),
      fakeRow({ id: 'b', status: 'pending' }),
      fakeRow({ id: 'c', status: 'done' }),
    ];
    const next = recoverInflight(q);
    expect(next[0].status).toBe('pending');
    expect(next[0].startedAt).toBeUndefined();
    expect(next[1].status).toBe('pending');
    expect(next[2].status).toBe('done');
  });
});
