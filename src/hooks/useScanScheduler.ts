/**
 * useScanScheduler — drives recurring scan schedules.
 *
 * Sprint 13 Pack 2 §3.5. Pure scheduler logic lives in
 * `src/utils/schedule/scanScheduler.ts`; this hook is the timer + storage
 * glue.
 *
 * Behaviour:
 *  - On mount: check if any active schedules are already due (the app may
 *    have been closed past several scheduled times). Enqueue them
 *    immediately and bump nextDueAt forward.
 *  - Every 60 seconds: re-check. The interval pauses when the OS sleeps
 *    the laptop and resumes on wake — acceptable behaviour, missed fires
 *    catch up on the wake tick.
 *  - Foreground only — when the app is closed nothing fires. Daemon mode
 *    is its own sprint (decision §8 #1).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Schedule, SchedulerCadence } from '../data/types';
import {
  loadSchedules, saveSchedules, dueNow, markFired,
  newScanSchedule, newBackupSchedule, newReportExportSchedule,
} from '../utils/schedule/scanScheduler';

const TICK_MS = 60_000;

export interface UseScanSchedulerResult {
  schedules: Schedule[];
  /** Add a new wp-scan schedule. */
  addSchedule: (
    domain: string,
    cadence: SchedulerCadence,
    opts?: { clientId?: string; alertOnDrop?: number },
  ) => Schedule;
  /** Sprint 14 Pack 3 #3 — add a backup-reminder schedule. */
  addBackupSchedule: (cadence: SchedulerCadence) => Schedule;
  /** Sprint 17 Pack 4 #3 — scheduled PDF report export. */
  addReportExportSchedule: (
    template: 'executive-summary' | 'portfolio-summary',
    cadence: SchedulerCadence,
    opts?: { clientId?: string },
  ) => Schedule;
  /** Toggle active/paused. Soft-kept rows survive the toggle. */
  setActive: (id: string, active: boolean) => void;
  /** Soft-delete (sets deletedAt). Doesn't physically remove. */
  removeSchedule: (id: string) => void;
}

interface UseScanSchedulerOpts {
  /**
   * Called when a schedule fires. Caller is responsible for actually
   * enqueueing the scan (we don't import useScanQueue from here to avoid
   * a circular dependency). Typical caller: App.tsx gluing the two hooks
   * together.
   */
  onFire: (schedule: Schedule) => void;
}

export function useScanScheduler({ onFire }: UseScanSchedulerOpts): UseScanSchedulerResult {
  const schedulesRef = useRef<Schedule[]>([]);
  const [schedules, setSchedulesState] = useState<Schedule[]>([]);

  const writeSchedules = useCallback((next: Schedule[]) => {
    schedulesRef.current = next;
    setSchedulesState(next);
    saveSchedules(next);
  }, []);

  // ── Hydrate on mount ──
  // Intentional sync setState inside an effect — the schedules state must
  // be hydrated before the tick effect below runs, and any cascade is the
  // goal (initial render shows []; immediately after hydration the tick
  // can pick up already-due rows). Same pattern as ClauseExplorer.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    writeSchedules(loadSchedules());
  }, [writeSchedules]);

  // ── Tick: fire any due schedules ──
  // Stable ref to onFire so the interval doesn't re-arm every render.
  const onFireRef = useRef(onFire);
  useEffect(() => { onFireRef.current = onFire; }, [onFire]);

  useEffect(() => {
    function tick() {
      const due = dueNow(schedulesRef.current);
      if (due.length === 0) return;
      let next = schedulesRef.current;
      for (const s of due) {
        onFireRef.current(s);
        next = next.map(x => x.id === s.id ? markFired(x) : x);
      }
      writeSchedules(next);
    }
    // Fire once on mount (catches any "missed" schedules from while the
    // app was closed) then every minute.
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [writeSchedules]);

  // ── Mutators ──

  const addSchedule = useCallback(
    (domain: string, cadence: SchedulerCadence, opts: { clientId?: string; alertOnDrop?: number } = {}) => {
      const s = newScanSchedule(domain, cadence, opts);
      writeSchedules([...schedulesRef.current, s]);
      return s;
    },
    [writeSchedules],
  );

  const addBackupSchedule = useCallback(
    (cadence: SchedulerCadence) => {
      const s = newBackupSchedule(cadence);
      writeSchedules([...schedulesRef.current, s]);
      return s;
    },
    [writeSchedules],
  );

  const addReportExportSchedule = useCallback(
    (
      template: 'executive-summary' | 'portfolio-summary',
      cadence: SchedulerCadence,
      opts: { clientId?: string } = {},
    ) => {
      const s = newReportExportSchedule(template, cadence, opts);
      writeSchedules([...schedulesRef.current, s]);
      return s;
    },
    [writeSchedules],
  );

  const setActive = useCallback((id: string, active: boolean) => {
    writeSchedules(
      schedulesRef.current.map(s =>
        s.id === id ? { ...s, active } : s
      )
    );
  }, [writeSchedules]);

  const removeSchedule = useCallback((id: string) => {
    // Soft-delete (decision §6 of the discovery doc — preps for Pack 6 undo).
    const now = new Date().toISOString();
    writeSchedules(
      schedulesRef.current.map(s =>
        s.id === id ? { ...s, deletedAt: now, active: false } : s
      )
    );
  }, [writeSchedules]);

  return { schedules, addSchedule, addBackupSchedule, addReportExportSchedule, setActive, removeSchedule };
}
