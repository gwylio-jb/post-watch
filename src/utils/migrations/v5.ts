/**
 * Storage migration v4 → v5 (Sprint 17 Pack 4 #4).
 *
 * Seeds the evidence-vault metadata key (`clause-control:attachments`).
 * Actual files live in the OS AppData vault directory; this localStorage
 * array holds the metadata records.
 *
 * Idempotent — resets corrupt / non-array values rather than crashing boot.
 */
import type { MigrationStepResult } from './index';

const KEY = 'clause-control:attachments';

export function migrateToV5(): MigrationStepResult {
  let wrote = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      localStorage.setItem(KEY, '[]');
      wrote = true;
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          localStorage.setItem(KEY, '[]');
          wrote = true;
        }
      } catch {
        localStorage.setItem(KEY, '[]');
        wrote = true;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    ran: wrote,
    summary: wrote ? 'seeded attachments key' : 'already migrated',
  };
}
