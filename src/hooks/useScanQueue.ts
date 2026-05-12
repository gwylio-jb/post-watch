/**
 * useScanQueue — drives the persistent batch scan queue.
 *
 * Sprint 13 Pack 2 §3.5. The pure queue mutators live in
 * `src/utils/queue/scanQueue.ts`; this hook is the effectful glue that:
 *  - Loads queue state from localStorage on mount, recovering any 'running'
 *    rows that survived a crash by resetting them to 'pending'.
 *  - Exposes enqueue / cancel / clearCompleted to consumers.
 *  - Runs ONE pending item at a time. When a scan finishes (success or
 *    failure) it persists the result, attaches the report to
 *    `wp-audit-reports`, and immediately picks up the next pending item.
 *  - Single instance per app — mount it once near the root (App.tsx) so
 *    foreground processing keeps going regardless of which page the user
 *    is on.
 *
 * Foreground-only by design (decision §8 #1 of the discovery doc). When
 * the app is closed, the queue freezes; on next launch it picks up where
 * it left off.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { AuditApiKeys, AuditReport } from '../data/auditTypes';
import type { ScanQueueItem, Client } from '../data/types';
import { runScan } from '../utils/audit/scanEngine';
import {
  loadQueue, saveQueue,
  setCursor,
  enqueue as enqueueRows,
  nextPending, markRunning, markDone, markFailed,
  cancel as cancelRow, clearCompleted, recoverInflight,
} from '../utils/queue/scanQueue';
import { chainReport, nextPrevHash } from '../utils/integrity';

const REPORTS_KEY = 'clause-control:wp-audit-reports';
const API_KEYS_KEY = 'clause-control:wp-audit-api-keys';
const CLIENTS_KEY = 'clause-control:clients';
const MAX_SAVED_REPORTS = 20;  // mirror WpAuditHub's MAX_SAVED

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export interface UseScanQueueResult {
  queue: ScanQueueItem[];
  /** True while a scan is mid-run. UI uses this to disable conflicting actions. */
  isRunning: boolean;
  /** Enqueue one or more URLs. Returns the new queue. */
  enqueue: (items: { targetUrl: string; clientId?: string }[]) => void;
  /** Cancel a single item by id. */
  cancel: (id: string) => void;
  /** Drop every terminal row (done / failed / cancelled). */
  clearCompleted: () => void;
}

export function useScanQueue(): UseScanQueueResult {
  // We hold a ref to the queue alongside React state. The ref is the source
  // of truth for the runner loop (which fires from inside async callbacks
  // and can't rely on closed-over React state). State drives re-renders.
  const queueRef = useRef<ScanQueueItem[]>([]);
  const [queue, setQueueState] = useState<ScanQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Helper: write through to ref + state + storage in one place. Every
  // mutator funnels through here — guarantees we never forget to persist.
  const writeQueue = useCallback((next: ScanQueueItem[]) => {
    queueRef.current = next;
    setQueueState(next);
    saveQueue(next);
  }, []);

  // ── Mount: hydrate from storage, recover any in-flight rows ──
  useEffect(() => {
    const recovered = recoverInflight(loadQueue());
    setCursor(null);
    writeQueue(recovered);
    // The runner-tick effect below will pick up any pending rows.
  }, [writeQueue]);

  // ── Mutators ──

  const enqueue = useCallback((items: { targetUrl: string; clientId?: string }[]) => {
    writeQueue(enqueueRows(queueRef.current, items));
  }, [writeQueue]);

  const cancel = useCallback((id: string) => {
    // If we're cancelling the currently-running item, abort the in-flight
    // scan too. The runner's catch block will see the AbortError and mark
    // it cancelled in storage; here we eagerly mark + abort so the UI
    // reflects the change immediately.
    const target = queueRef.current.find(q => q.id === id);
    if (target?.status === 'running') {
      abortRef.current?.abort();
    }
    writeQueue(cancelRow(queueRef.current, id));
  }, [writeQueue]);

  const clearCompletedRows = useCallback(() => {
    writeQueue(clearCompleted(queueRef.current));
  }, [writeQueue]);

  // ── Runner tick: when the queue changes, see if there's work to do ──
  useEffect(() => {
    // Already running? The current scan's completion callback will pick up
    // the next item.
    if (isRunning) return;

    const next = nextPending(queueRef.current);
    if (!next) return;

    // Fire and forget — the runScan promise self-cleans via the writeQueue
    // calls in its handlers.
    let cancelled = false;

    (async () => {
      const apiKeys = loadJson<AuditApiKeys>(API_KEYS_KEY, {});
      const clients = loadJson<Client[]>(CLIENTS_KEY, []);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setCursor(next.id);
      setIsRunning(true);
      writeQueue(markRunning(queueRef.current, next.id));

      try {
        // No live-checks UI for batch — pass a no-op progress callback.
        // The queue UI shows row-level status; per-check progress would
        // be too noisy for a batch.
        const rawReport = await runScan(next.targetUrl, apiKeys, () => {}, ctrl.signal);
        if (cancelled) return;

        const client = next.clientId ? clients.find(c => c.id === next.clientId) : undefined;
        const baseReport: AuditReport = {
          ...rawReport,
          clientId: next.clientId,
          clientLogo: client?.logo,
        };

        // Persist the report to wp-audit-reports (same shape WpAuditHub
        // uses for individual scans). Cap at MAX_SAVED_REPORTS to mirror
        // WpAuditHub's housekeeping. Sprint 14: chain the tamper-evident
        // hash before persisting.
        const reports = loadJson<AuditReport[]>(REPORTS_KEY, []);
        const safeReports = Array.isArray(reports) ? reports : [];
        const prevHash = nextPrevHash(safeReports);
        const report = await chainReport(baseReport, prevHash);
        const nextReports = [report, ...safeReports.filter(r => r.id !== report.id)].slice(0, MAX_SAVED_REPORTS);
        localStorage.setItem(REPORTS_KEY, JSON.stringify(nextReports));

        writeQueue(markDone(queueRef.current, next.id, report.id));
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).name === 'AbortError'
          ? 'Cancelled by user'
          : `Scan failed: ${(err as Error).message}`;
        // If aborted, the cancel() call already moved the row to cancelled.
        // Only mark failed for real errors.
        if ((err as Error).name !== 'AbortError') {
          writeQueue(markFailed(queueRef.current, next.id, msg));
        }
      } finally {
        if (!cancelled) {
          setCursor(null);
          setIsRunning(false);
          abortRef.current = null;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [queue, isRunning, writeQueue]);

  return {
    queue,
    isRunning,
    enqueue,
    cancel,
    clearCompleted: clearCompletedRows,
  };
}
