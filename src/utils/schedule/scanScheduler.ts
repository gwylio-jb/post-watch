/**
 * Pure scheduler logic for recurring scans.
 *
 * Sprint 13 Pack 2 §3.5. The scheduler is split into two parts:
 *
 *   - This module: pure functions for `nextDueAt` calculation, due-now
 *     filtering, and creating new Schedule records. Effect-free; tests are
 *     trivial.
 *   - A small `useEffect` in the app shell that ticks every minute and
 *     enqueues anything due. That side-effect lives near the WP audit hub
 *     and reuses queueRunner.
 *
 * Cadences supported:
 *   - weekly:  fires on a fixed weekday (0 = Sun) at a fixed local hour
 *   - monthly: fires on a fixed day-of-month at a fixed local hour
 *   - interval: fires every N days since the last fire (relative cadence)
 *
 * All times stored as ISO 8601 (UTC) on disk. Hour in cadence is local
 * time — so "weekly Mon 06:00" means the user's machine local 06:00,
 * not UTC. Avoids the consultant scheduling at 02:00 every Monday because
 * they're in BST.
 */
import type { Schedule, SchedulerCadence } from '../../data/types';

/** Compute the next due time given a cadence and a reference instant. */
export function computeNextDueAt(
  cadence: SchedulerCadence,
  now: Date = new Date(),
  lastFiredAt?: string,
): string {
  const nowMs = now.getTime();

  if (cadence.kind === 'interval') {
    // Relative — N days since last fire (or "now + N days" on first run).
    const base = lastFiredAt ? new Date(lastFiredAt).getTime() : nowMs;
    return new Date(base + cadence.days * 24 * 60 * 60 * 1000).toISOString();
  }

  if (cadence.kind === 'weekly') {
    // Find the next occurrence of weekday/hour in local time. Walk forward
    // up to 7 days. Note: building a Date from local components — the
    // resulting ISO string serialises in UTC, which is what disk stores.
    const target = new Date(now);
    target.setHours(cadence.hour, 0, 0, 0);
    let daysToAdd = (cadence.weekday - target.getDay() + 7) % 7;
    if (daysToAdd === 0 && target.getTime() <= nowMs) daysToAdd = 7;
    target.setDate(target.getDate() + daysToAdd);
    return target.toISOString();
  }

  // monthly
  const target = new Date(now);
  target.setHours(cadence.hour, 0, 0, 0);
  target.setDate(cadence.day);
  // If we're already past this month's due time, roll to next month.
  if (target.getTime() <= nowMs) {
    target.setMonth(target.getMonth() + 1);
  }
  return target.toISOString();
}

/** Return only schedules whose `nextDueAt` is at or before `now`. */
export function dueNow(schedules: Schedule[], now: Date = new Date()): Schedule[] {
  const ms = now.getTime();
  return schedules.filter(s =>
    s.kind === 'wp-scan' &&
    s.active &&
    !s.deletedAt &&
    new Date(s.nextDueAt).getTime() <= ms
  );
}

/**
 * Apply a "I just fired this schedule" update — bump lastFiredAt and
 * recompute nextDueAt from the cadence.
 */
export function markFired(schedule: Schedule, now: Date = new Date()): Schedule {
  if (schedule.kind !== 'wp-scan') return schedule;
  const lastFiredAt = now.toISOString();
  return {
    ...schedule,
    lastFiredAt,
    nextDueAt: computeNextDueAt(schedule.cadence, now, lastFiredAt),
  };
}

/** Convenience constructor for the new-schedule UI. */
export function newScanSchedule(
  domain: string,
  cadence: SchedulerCadence,
  opts: { clientId?: string; alertOnDrop?: number } = {},
  now: Date = new Date(),
): Schedule {
  return {
    id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'wp-scan',
    domain,
    clientId: opts.clientId,
    cadence,
    alertOnDrop: opts.alertOnDrop,
    active: true,
    nextDueAt: computeNextDueAt(cadence, now),
  };
}

// ─── Storage I/O ───────────────────────────────────────────────────────────

const SCHEDULE_KEY = 'clause-control:wp-audit-schedules';

export function loadSchedules(): Schedule[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSchedules(schedules: Schedule[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
}
