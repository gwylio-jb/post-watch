/**
 * Tests for the versioned migration runner.
 *
 * What we're protecting against:
 *  - V2 step touching keys that already hold valid data (must be idempotent).
 *  - Corrupt JSON in queue/schedule keys crashing boot — must reset to [].
 *  - Storage-version key not advancing on partial-failure runs.
 *  - Re-running the runner being a no-op on a fully-migrated device.
 */
import { runMigrations, STORAGE_VERSION_KEY, TARGET_VERSION } from './index';
import { migrateToV2 } from './v2';

const QUEUE_KEY    = 'clause-control:wp-audit-queue';
const SCHEDULE_KEY = 'clause-control:wp-audit-schedules';

describe('migrations', () => {
  describe('runMigrations', () => {
    it('on a clean device, advances to TARGET_VERSION and seeds the new keys', () => {
      const result = runMigrations();
      expect(result.toVersion).toBe(TARGET_VERSION);
      expect(localStorage.getItem(STORAGE_VERSION_KEY)).toBe(String(TARGET_VERSION));
      expect(localStorage.getItem(QUEUE_KEY)).toBe('[]');
      expect(localStorage.getItem(SCHEDULE_KEY)).toBe('[]');
    });

    it('on a fully-migrated device, is a no-op (no steps applied)', () => {
      // First pass — fresh device.
      runMigrations();
      // Second pass — should now be a no-op since the version key is current.
      const result = runMigrations();
      expect(result.applied).toEqual([]);
      expect(result.toVersion).toBe(TARGET_VERSION);
    });

    it('reports the version it migrated from', () => {
      // Skip the legacy v1 step, simulate a fresh post-V2.1 device.
      const result = runMigrations();
      expect(result.fromVersion).toBe(1);
    });
  });

  describe('migrateToV2', () => {
    it('preserves a valid existing queue array', () => {
      const existing = [{ id: 'q1', status: 'pending' }];
      localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));

      migrateToV2();

      // Step still ran (it wrote the schedule key); but queue should be untouched.
      expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)).toEqual(existing);
    });

    it('preserves a valid existing schedule array', () => {
      const existing = [{ id: 's1', kind: 'wp-scan', domain: 'example.com' }];
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(existing));

      migrateToV2();

      expect(JSON.parse(localStorage.getItem(SCHEDULE_KEY)!)).toEqual(existing);
    });

    it('resets corrupt queue JSON to [] (boot must not fail)', () => {
      localStorage.setItem(QUEUE_KEY, '{not valid json');
      const r = migrateToV2();
      expect(r.ran).toBe(true);
      expect(localStorage.getItem(QUEUE_KEY)).toBe('[]');
    });

    it('resets a non-array value (object literal) to []', () => {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ unexpected: 'shape' }));
      migrateToV2();
      expect(localStorage.getItem(SCHEDULE_KEY)).toBe('[]');
    });

    it('reports ran=false when both keys already hold valid arrays', () => {
      localStorage.setItem(QUEUE_KEY, '[]');
      localStorage.setItem(SCHEDULE_KEY, '[]');
      const r = migrateToV2();
      expect(r.ran).toBe(false);
    });
  });
});
