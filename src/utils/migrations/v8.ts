/**
 * Storage migration v7 → v8 (Sprint 25, v3.0 pillar #3).
 *
 * Seeds the internal-audits and management-reviews keys as empty arrays.
 * Same idempotent shape-guard pattern as v5–v7.
 */
import type { MigrationStepResult } from './index';

const KEYS = ['clause-control:internal-audits', 'clause-control:management-reviews'];

export function migrateToV8(): MigrationStepResult {
  let wrote = false;
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        localStorage.setItem(key, '[]');
        wrote = true;
      } else {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            localStorage.setItem(key, '[]');
            wrote = true;
          }
        } catch {
          localStorage.setItem(key, '[]');
          wrote = true;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return {
    ran: wrote,
    summary: wrote ? 'seeded internal-audits + management-reviews keys' : 'already migrated',
  };
}
