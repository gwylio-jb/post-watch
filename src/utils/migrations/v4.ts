/**
 * Storage migration v3 → v4 (Sprint 16 Pack 4 #1).
 *
 * Adds the gap-session snapshot key. The actual snapshot save flow is
 * user-driven (via the GapAnalysis toolbar), so this step is just a
 * version stamp + the empty-array seed so the new key exists.
 *
 * Idempotent: if the key already holds a valid array, leaves it.
 */
import type { MigrationStepResult } from './index';

const SNAPSHOTS_KEY = 'clause-control:gap-session-snapshots';

export function migrateToV4(): MigrationStepResult {
  let wrote = false;
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (raw === null) {
      localStorage.setItem(SNAPSHOTS_KEY, '[]');
      wrote = true;
    } else {
      // Reset corrupt / non-array values so v1 always sees an array.
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          localStorage.setItem(SNAPSHOTS_KEY, '[]');
          wrote = true;
        }
      } catch {
        localStorage.setItem(SNAPSHOTS_KEY, '[]');
        wrote = true;
      }
    }
  } catch {
    /* ignore */
  }

  return {
    ran: wrote,
    summary: wrote ? 'seeded gap-session-snapshots key' : 'already migrated',
  };
}
