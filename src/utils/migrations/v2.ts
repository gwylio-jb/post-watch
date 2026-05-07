/**
 * Storage migration v1 → v2 (Sprint 13, Pack 2).
 *
 * Adds two new persisted keys for portfolio mode:
 *   - clause-control:wp-audit-queue        ScanQueueItem[]
 *   - clause-control:wp-audit-schedules    Schedule[]
 *
 * Both initialise as empty arrays. The hooks that read them already
 * tolerate missing keys, so this step is largely belt-and-braces — the
 * primary purpose is to record the version bump on the device so future
 * steps (v3 encryption, v4 …) can reason about prior state.
 *
 * Idempotent: if either key already holds a valid array, leaves it alone.
 */
import type { MigrationStepResult } from './index';

const QUEUE_KEY    = 'clause-control:wp-audit-queue';
const SCHEDULE_KEY = 'clause-control:wp-audit-schedules';

function ensureArrayKey(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      localStorage.setItem(key, '[]');
      return true;  // wrote
    }
    // If the existing value parses as an array, leave it. If it's something
    // else (corrupt), reset to []. Surviving boot is more important than
    // preserving unparseable data.
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return false;
    } catch {
      /* fall through */
    }
    localStorage.setItem(key, '[]');
    return true;
  } catch {
    return false;
  }
}

export function migrateToV2(): MigrationStepResult {
  const wroteQueue    = ensureArrayKey(QUEUE_KEY);
  const wroteSchedule = ensureArrayKey(SCHEDULE_KEY);
  const ran = wroteQueue || wroteSchedule;
  return {
    ran,
    summary: ran
      ? `seeded ${[wroteQueue && 'queue', wroteSchedule && 'schedules'].filter(Boolean).join(' + ')}`
      : 'already migrated',
  };
}
