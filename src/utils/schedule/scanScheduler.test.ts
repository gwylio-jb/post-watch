/**
 * Tests for the pure scheduler.
 *
 * What we're protecting against:
 *  - Off-by-one weekday math (next Monday at 06:00 should NOT fire today
 *    at 06:00 if today is already past 06:00 Monday).
 *  - Monthly cadence at end-of-month (day=31, current month=Feb) — should
 *    roll to next month gracefully.
 *  - Interval cadence using lastFiredAt vs falling back to now.
 *  - dueNow filtering inactive / soft-deleted schedules.
 *  - markFired updating both lastFiredAt and nextDueAt atomically.
 */
import {
  computeNextDueAt, dueNow, markFired, newScanSchedule,
  loadSchedules, saveSchedules,
} from './scanScheduler';
import type { Schedule } from '../../data/types';

const SCHEDULE_KEY = 'clause-control:wp-audit-schedules';

// ─── computeNextDueAt — interval ───────────────────────────────────────────

describe('computeNextDueAt — interval cadence', () => {
  it('fires N days from now on first run (no lastFiredAt)', () => {
    const now = new Date('2026-05-01T12:00:00Z');
    const result = computeNextDueAt({ kind: 'interval', days: 7 }, now);
    expect(result).toBe('2026-05-08T12:00:00.000Z');
  });

  it('fires N days from lastFiredAt when present', () => {
    const now = new Date('2026-05-01T12:00:00Z');
    const lastFired = '2026-04-15T12:00:00Z';
    const result = computeNextDueAt({ kind: 'interval', days: 30 }, now, lastFired);
    expect(result).toBe('2026-05-15T12:00:00.000Z');
  });
});

// ─── computeNextDueAt — weekly ─────────────────────────────────────────────

describe('computeNextDueAt — weekly cadence', () => {
  it('rolls forward to next week if today is the target weekday but past the hour', () => {
    // 2026-05-04 is a Monday (weekday 1).
    // Schedule is "Mon at 06:00 local". Test runs at local 09:00 — so should
    // skip this Monday and roll to next Monday.
    const now = new Date('2026-05-04T09:00:00');  // local time
    const result = computeNextDueAt({ kind: 'weekly', weekday: 1, hour: 6 }, now);
    const r = new Date(result);
    expect(r.getDay()).toBe(1);
    // Day-of-month should be ≥ 11 (one week after the 4th).
    expect(r.getDate()).toBeGreaterThanOrEqual(10);
  });

  it('schedules for today when target hour is still ahead', () => {
    // Mon 04:00 — schedule at 06:00 same day.
    const now = new Date('2026-05-04T04:00:00');
    const result = computeNextDueAt({ kind: 'weekly', weekday: 1, hour: 6 }, now);
    const r = new Date(result);
    expect(r.getDay()).toBe(1);
    expect(r.getDate()).toBe(4);
  });

  it('walks forward to the next occurrence of the target weekday', () => {
    // Now = Wednesday. Schedule = Friday.
    const now = new Date('2026-05-06T12:00:00');  // Wed (weekday 3)
    const result = computeNextDueAt({ kind: 'weekly', weekday: 5, hour: 9 }, now);
    expect(new Date(result).getDay()).toBe(5);  // Fri
  });
});

// ─── computeNextDueAt — monthly ────────────────────────────────────────────

describe('computeNextDueAt — monthly cadence', () => {
  it('schedules for this month if target day is still ahead', () => {
    const now = new Date('2026-05-04T12:00:00');
    const result = computeNextDueAt({ kind: 'monthly', day: 15, hour: 9 }, now);
    expect(new Date(result).getDate()).toBe(15);
    expect(new Date(result).getMonth()).toBe(4);  // May (0-indexed)
  });

  it('rolls to next month when the day is already past', () => {
    const now = new Date('2026-05-20T12:00:00');
    const result = computeNextDueAt({ kind: 'monthly', day: 15, hour: 9 }, now);
    expect(new Date(result).getMonth()).toBe(5);  // June
  });

  it('rolls to next month when day matches but hour passed', () => {
    const now = new Date('2026-05-15T12:00:00');
    const result = computeNextDueAt({ kind: 'monthly', day: 15, hour: 9 }, now);
    expect(new Date(result).getMonth()).toBe(5);
  });

  it('handles end-of-month gracefully (Feb + day 31 → March 3)', () => {
    // setDate(31) in February overflows to early March in JS Date semantics.
    // Acceptable v1 behaviour — Pack 4 may revisit with a "last day of
    // month" cadence kind.
    const now = new Date('2026-02-01T12:00:00');
    const result = computeNextDueAt({ kind: 'monthly', day: 31, hour: 9 }, now);
    const r = new Date(result);
    expect(r.getMonth()).toBe(2);  // March
    expect(r.getDate()).toBe(3);   // 31 - 28 = 3
  });
});

// ─── dueNow ────────────────────────────────────────────────────────────────

function fakeSchedule(over: Partial<Extract<Schedule, { kind: 'wp-scan' }>> = {}): Schedule {
  return {
    id: 'sch-1',
    kind: 'wp-scan',
    domain: 'example.com',
    cadence: { kind: 'interval', days: 7 },
    active: true,
    nextDueAt: '2026-05-01T00:00:00Z',
    ...over,
  };
}

describe('dueNow', () => {
  it('returns schedules whose nextDueAt is in the past', () => {
    const list = [fakeSchedule({ id: 'a', nextDueAt: '2026-04-01T00:00:00Z' })];
    const now = new Date('2026-05-01T00:00:00Z');
    expect(dueNow(list, now)).toHaveLength(1);
  });

  it('skips schedules with a future nextDueAt', () => {
    const list = [fakeSchedule({ id: 'a', nextDueAt: '2027-01-01T00:00:00Z' })];
    const now = new Date('2026-05-01T00:00:00Z');
    expect(dueNow(list, now)).toEqual([]);
  });

  it('skips inactive schedules', () => {
    const list = [fakeSchedule({ id: 'a', active: false, nextDueAt: '2026-01-01T00:00:00Z' })];
    const now = new Date('2026-05-01T00:00:00Z');
    expect(dueNow(list, now)).toEqual([]);
  });

  it('skips soft-deleted schedules', () => {
    const list = [fakeSchedule({
      id: 'a', deletedAt: '2026-04-15T00:00:00Z', nextDueAt: '2026-01-01T00:00:00Z',
    })];
    const now = new Date('2026-05-01T00:00:00Z');
    expect(dueNow(list, now)).toEqual([]);
  });

  it('handles exact-equality (nextDueAt === now)', () => {
    const list = [fakeSchedule({ nextDueAt: '2026-05-01T12:00:00.000Z' })];
    const now = new Date('2026-05-01T12:00:00.000Z');
    expect(dueNow(list, now)).toHaveLength(1);
  });
});

// ─── markFired ─────────────────────────────────────────────────────────────

describe('markFired', () => {
  it('sets lastFiredAt to now and recomputes nextDueAt', () => {
    const s = fakeSchedule({ cadence: { kind: 'interval', days: 7 } });
    const now = new Date('2026-05-01T12:00:00Z');
    const next = markFired(s, now);
    expect(next.kind).toBe('wp-scan');
    expect(next.lastFiredAt).toBe('2026-05-01T12:00:00.000Z');
    if (next.kind === 'wp-scan') {
      expect(next.nextDueAt).toBe('2026-05-08T12:00:00.000Z');
    }
  });

  it('preserves active / deletedAt / alertOnDrop fields', () => {
    const s = fakeSchedule({ alertOnDrop: 5, active: true });
    const next = markFired(s, new Date('2026-05-01T12:00:00Z'));
    if (next.kind === 'wp-scan') {
      expect(next.alertOnDrop).toBe(5);
      expect(next.active).toBe(true);
    }
  });
});

// ─── newScanSchedule ───────────────────────────────────────────────────────

describe('newScanSchedule', () => {
  it('creates an active schedule with computed nextDueAt', () => {
    const now = new Date('2026-05-01T12:00:00Z');
    const s = newScanSchedule('example.com', { kind: 'interval', days: 7 }, {}, now);
    expect(s.kind).toBe('wp-scan');
    if (s.kind === 'wp-scan') {
      expect(s.domain).toBe('example.com');
      expect(s.active).toBe(true);
      expect(s.deletedAt).toBeUndefined();
      expect(s.nextDueAt).toBe('2026-05-08T12:00:00.000Z');
    }
  });

  it('threads optional clientId + alertOnDrop', () => {
    const s = newScanSchedule(
      'example.com',
      { kind: 'interval', days: 7 },
      { clientId: 'c-1', alertOnDrop: 10 },
    );
    if (s.kind === 'wp-scan') {
      expect(s.clientId).toBe('c-1');
      expect(s.alertOnDrop).toBe(10);
    }
  });
});

// ─── Storage I/O ───────────────────────────────────────────────────────────

describe('loadSchedules / saveSchedules', () => {
  it('round-trips an array', () => {
    const arr = [fakeSchedule({ id: 'a' }), fakeSchedule({ id: 'b' })];
    saveSchedules(arr);
    expect(loadSchedules()).toEqual(arr);
  });

  it('returns [] when storage holds malformed JSON', () => {
    localStorage.setItem(SCHEDULE_KEY, '{not valid');
    expect(loadSchedules()).toEqual([]);
  });

  it('returns [] when storage holds a non-array shape', () => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadSchedules()).toEqual([]);
  });
});
