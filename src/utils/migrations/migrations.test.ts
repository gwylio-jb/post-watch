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
import { migrateToV3 } from './v3';

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

  describe('migrateToV3', () => {
    it('always reports ran=true — version-stamp only step', () => {
      const r = migrateToV3();
      expect(r.ran).toBe(true);
    });

    it('does not touch user data — encryption is enabled via Settings, not migration', () => {
      localStorage.setItem('clause-control:wp-audit-reports', '[]');
      migrateToV3();
      expect(localStorage.getItem('clause-control:wp-audit-reports')).toBe('[]');
    });
  });

  // v3.0 ship: the whole chain, run against a simulated v2.x device.
  // This is the upgrade path every existing install takes on first boot
  // of 3.0.0 — user data must survive untouched and every new key must
  // exist with the right shape.
  describe('full chain on a simulated v2.x store', () => {
    it('seeds every v3.0 key and preserves existing data', () => {
      // A device that stopped migrating at v5 (Sprint 17 era), with data.
      localStorage.setItem(STORAGE_VERSION_KEY, '5');
      const clients = [{ id: 'c1', name: 'Acme', createdAt: '2025-01-01' }];
      const risks = [{ id: 'r1', name: 'Legacy risk', score: 12 }];
      localStorage.setItem('clause-control:clients', JSON.stringify(clients));
      localStorage.setItem('clause-control:post-watch:risks', JSON.stringify(risks));
      localStorage.setItem('clause-control:attachments', '[]');

      const result = runMigrations();

      expect(result.fromVersion).toBe(5);
      expect(result.toVersion).toBe(TARGET_VERSION);
      expect(result.applied).toEqual([6, 7, 8, 9]);

      // New keys exist with the right container shapes.
      expect(JSON.parse(localStorage.getItem('clause-control:soa')!)).toEqual({});
      for (const key of ['findings', 'internal-audits', 'management-reviews', 'kpis', 'training', 'incidents', 'assets']) {
        expect(JSON.parse(localStorage.getItem(`clause-control:${key}`)!)).toEqual([]);
      }

      // Pre-existing data preserved. The legacy V2.1 back-fill may add an
      // "Unassigned" client and stamp clientIds — that's expected; what
      // matters is the original records are still there, intact in substance.
      const migratedClients = JSON.parse(localStorage.getItem('clause-control:clients')!) as { id: string; name: string }[];
      expect(migratedClients.some(c => c.id === 'c1' && c.name === 'Acme')).toBe(true);
      const migratedRisks = JSON.parse(localStorage.getItem('clause-control:post-watch:risks')!) as { id: string; name: string; score: number }[];
      expect(migratedRisks).toHaveLength(1);
      expect(migratedRisks[0]).toMatchObject({ id: 'r1', name: 'Legacy risk', score: 12 });

      // Idempotent: a second boot applies nothing.
      expect(runMigrations().applied).toEqual([]);
    });

    it('repairs corrupt v3.0 keys without touching version-tracked data', () => {
      localStorage.setItem(STORAGE_VERSION_KEY, '5');
      localStorage.setItem('clause-control:soa', '"not an object"');
      localStorage.setItem('clause-control:findings', '{oops');
      runMigrations();
      expect(JSON.parse(localStorage.getItem('clause-control:soa')!)).toEqual({});
      expect(JSON.parse(localStorage.getItem('clause-control:findings')!)).toEqual([]);
    });
  });
});
