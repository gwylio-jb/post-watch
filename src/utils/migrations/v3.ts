/**
 * Storage migration v2 → v3 (Sprint 15 Pack 3 #4).
 *
 * Encryption-at-rest landed in v2.7. The v3 step is a version-stamp only:
 * the enable-encryption operation is user-initiated (via Settings), and
 * the crash-recovery sweep (cryptoStorage.cleanupAfterCrash) is wired
 * into App.tsx's boot effect so it runs on EVERY launch, not just once
 * at migration time.
 *
 * Why not put cleanupAfterCrash here: the migration runner advances the
 * version key after running all pending steps, so a step only fires once
 * per device. The interrupted-enable crash can happen at any time after
 * v3 is recorded, so the cleanup must run unconditionally on each boot.
 */
import type { MigrationStepResult } from './index';

export function migrateToV3(): MigrationStepResult {
  return {
    ran: true,
    summary: 'encryption boot-flow available — actual enable happens via Settings',
  };
}
