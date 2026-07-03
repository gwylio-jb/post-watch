/**
 * Storage migration v8 → v9 (Sprint 26, v3.0 pillar #4).
 *
 * Seeds the KPI + register keys as empty arrays. Same idempotent
 * shape-guard pattern as v5–v8.
 */
import type { MigrationStepResult } from './index';

const KEYS = [
  'clause-control:kpis',
  'clause-control:training',
  'clause-control:incidents',
  'clause-control:assets',
];

export function migrateToV9(): MigrationStepResult {
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
    summary: wrote ? 'seeded kpi + register keys' : 'already migrated',
  };
}
