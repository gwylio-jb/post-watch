/**
 * Storage migration v6 → v7 (Sprint 24, v3.0 pillar #2).
 *
 * Seeds the findings/CAPA register key (`clause-control:findings`) as an
 * empty array. Same idempotent shape-guard pattern as v5/v6.
 */
import type { MigrationStepResult } from './index';

const KEY = 'clause-control:findings';

export function migrateToV7(): MigrationStepResult {
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
    summary: wrote ? 'seeded findings key' : 'already migrated',
  };
}
