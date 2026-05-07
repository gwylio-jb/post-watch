/**
 * Versioned migration runner — single chokepoint for every schema change.
 *
 * Why this exists (Sprint 13, §6.3 / §6.4 of the discovery doc):
 *  - Pre-V2.5 migrations were a single bottom-up function in
 *    `clientMigration.ts`. That worked for one migration but doesn't compose:
 *    Sprint 13 needs a v2 step (queue + schedule scaffolding); Sprint 14
 *    will add a v3 step (encryption envelope); Pack 4 will likely add
 *    another. Stuffing each into the same function would turn into spaghetti.
 *  - This module exposes a single `runMigrations()` that reads the current
 *    storage version, runs every pending step in order, and writes the new
 *    version. Each step is idempotent and individually testable.
 *
 * Storage version key: `clause-control:storage-version` (note: distinct from
 * the legacy `clause-control-version` key, which the v2 step retires).
 *
 * Each step's contract:
 *  - Pure side-effects on localStorage
 *  - No throws on malformed data — log and skip; never block boot
 *  - Idempotent: running twice is a no-op
 */

import { migrateToV2 } from './v2';
import { runClientMigration } from '../clientMigration';

// Storage version after all migrations have run. Bump this number when a new
// step lands. The key it's written to lives in `STORAGE_VERSION_KEY` below.
const TARGET_VERSION = 2;
const STORAGE_VERSION_KEY = 'clause-control:storage-version';

const STEPS: Record<number, () => MigrationStepResult> = {
  // Pre-2 migrations live in the legacy clientMigration.ts file — kept
  // separate so existing devices that already ran it on V2.1 don't re-run.
  // The v2 step assumes V2.1 has already completed (via `runClientMigration`
  // below) before it touches anything.
  2: migrateToV2,
};

export interface MigrationStepResult {
  /** Did this step do any actual work? `false` means already-migrated state. */
  ran: boolean;
  /** Free-text summary; surfaced in console for debug. */
  summary?: string;
}

export interface MigrationRunResult {
  fromVersion: number;
  toVersion: number;
  /** Steps that actually executed (vs short-circuited). */
  applied: number[];
}

function readVersion(): number {
  try {
    const raw = localStorage.getItem(STORAGE_VERSION_KEY);
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function writeVersion(v: number): void {
  try {
    localStorage.setItem(STORAGE_VERSION_KEY, String(v));
  } catch {
    /* ignore — boot should never fail on a write */
  }
}

/**
 * Apply every pending migration step from the device's current version up
 * to TARGET_VERSION. Always runs the legacy V2.1 client-back-fill first
 * (it has its own idempotency flag).
 */
export function runMigrations(): MigrationRunResult {
  // Always run the legacy V2.1 step first. It's a no-op on already-migrated
  // devices (its own flag-based guard), and it has to land before v2 because
  // v2 assumes clients/risks/etc. already carry clientId.
  runClientMigration();

  const fromVersion = readVersion();
  const applied: number[] = [];

  for (let v = fromVersion + 1; v <= TARGET_VERSION; v++) {
    const step = STEPS[v];
    if (!step) continue;
    const res = step();
    if (res.ran) applied.push(v);
    if (res.summary) {
      console.info(`[post-watch] migration v${v}: ${res.summary}`);
    }
  }

  writeVersion(TARGET_VERSION);

  return { fromVersion, toVersion: TARGET_VERSION, applied };
}

// Re-export the version key so tests can inspect it without string-duplication.
export { STORAGE_VERSION_KEY, TARGET_VERSION };
