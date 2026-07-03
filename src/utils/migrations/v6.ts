/**
 * Storage migration v5 → v6 (Sprint 23, v3.0 pillar #1).
 *
 * Seeds the Statement of Applicability key (`clause-control:soa`) as an
 * empty per-client map. Per-client entries are seeded lazily by
 * ensureSeeded() on first visit to the SoA tab — the migration only
 * guarantees the key exists and is object-shaped, mirroring v5's
 * attachments pattern.
 *
 * Idempotent — resets corrupt / non-object values rather than crashing boot.
 */
import type { MigrationStepResult } from './index';

const KEY = 'clause-control:soa';

export function migrateToV6(): MigrationStepResult {
  let wrote = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      localStorage.setItem(KEY, '{}');
      wrote = true;
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          localStorage.setItem(KEY, '{}');
          wrote = true;
        }
      } catch {
        localStorage.setItem(KEY, '{}');
        wrote = true;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    ran: wrote,
    summary: wrote ? 'seeded SoA key' : 'already migrated',
  };
}
