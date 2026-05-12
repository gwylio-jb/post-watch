/**
 * Tests for the tamper-evident report chain.
 *
 * What we're protecting against:
 *  - Hash stability: two structurally-identical reports must hash to the
 *    same value regardless of object-key insertion order.
 *  - Mutating any field in a saved report must surface as a `hash-mismatch`
 *    flag during verification.
 *  - Re-ordering reports without re-chaining must surface as `chain-break`.
 *  - Pre-V2.6 reports (no `integrity`) must be reported as warning baselines,
 *    not errors — and the chain must continue from genesis after them.
 *  - Verification on an empty array must return ok=true (no false positives).
 */
import { hashReport, chainReport, verifyChain, nextPrevHash, GENESIS_PREV_HASH } from './integrity';
import type { AuditReport } from '../data/auditTypes';

function fakeReport(over: Partial<AuditReport> = {}): AuditReport {
  return {
    id: 'r-1',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-05-01T00:00:00Z',
    completedAt: '2026-05-01T00:01:30Z',
    score: 72,
    checks: [],
    ...over,
  };
}

describe('hashReport', () => {
  it('produces a 64-character hex SHA-256 string', async () => {
    const h = await hashReport(fakeReport());
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across runs for identical input', async () => {
    const a = await hashReport(fakeReport());
    const b = await hashReport(fakeReport());
    expect(a).toBe(b);
  });

  it('differs when any field differs', async () => {
    const a = await hashReport(fakeReport({ score: 72 }));
    const b = await hashReport(fakeReport({ score: 73 }));
    expect(a).not.toBe(b);
  });

  it('ignores the `integrity` field itself (no chicken-and-egg)', async () => {
    const r = fakeReport();
    const a = await hashReport(r);
    const b = await hashReport({
      ...r,
      integrity: { hash: 'pretend', prevHash: 'also-pretend' },
    });
    expect(a).toBe(b);
  });

  it('is stable across different key insertion orders (canonical serialisation)', async () => {
    // Build the same logical report with two different key-order objects.
    const left: AuditReport = {
      id: 'r-1', targetUrl: 'https://example.com', domain: 'example.com',
      startedAt: '2026-05-01T00:00:00Z', score: 72, checks: [],
    };
    const right: AuditReport = {
      checks: [], score: 72, domain: 'example.com',
      startedAt: '2026-05-01T00:00:00Z', targetUrl: 'https://example.com', id: 'r-1',
    };
    const a = await hashReport(left);
    const b = await hashReport(right);
    expect(a).toBe(b);
  });
});

describe('chainReport', () => {
  it('returns a NEW object with the integrity field attached', async () => {
    const r = fakeReport();
    const chained = await chainReport(r, GENESIS_PREV_HASH);
    expect(chained).not.toBe(r);  // immutable
    expect(chained.integrity).toBeDefined();
    expect(chained.integrity!.prevHash).toBe(GENESIS_PREV_HASH);
    expect(chained.integrity!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the stored hash matches what hashReport produces for the same content', async () => {
    const r = fakeReport();
    const chained = await chainReport(r, GENESIS_PREV_HASH);
    expect(await hashReport(chained)).toBe(chained.integrity!.hash);
  });
});

describe('nextPrevHash', () => {
  it('returns GENESIS when saved is empty', () => {
    expect(nextPrevHash([])).toBe(GENESIS_PREV_HASH);
  });

  it('returns GENESIS when the head report has no integrity (pre-V2.6)', () => {
    expect(nextPrevHash([fakeReport()])).toBe(GENESIS_PREV_HASH);
  });

  it('returns the head report\'s hash when it has integrity', () => {
    const head: AuditReport = {
      ...fakeReport(),
      integrity: { hash: 'abc123', prevHash: GENESIS_PREV_HASH },
    };
    expect(nextPrevHash([head])).toBe('abc123');
  });
});

describe('verifyChain', () => {
  it('returns ok=true for an empty chain', async () => {
    const result = await verifyChain([]);
    expect(result.ok).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it('returns ok=true for a single properly-chained report', async () => {
    const r = await chainReport(fakeReport(), GENESIS_PREV_HASH);
    const result = await verifyChain([r]);
    expect(result.ok).toBe(true);
  });

  it('returns ok=true for a multi-report chain in stored newest-first order', async () => {
    const r1 = await chainReport(fakeReport({ id: '1', score: 50 }), GENESIS_PREV_HASH);
    const r2 = await chainReport(fakeReport({ id: '2', score: 60 }), r1.integrity!.hash);
    const r3 = await chainReport(fakeReport({ id: '3', score: 70 }), r2.integrity!.hash);
    // stored newest-first: [r3, r2, r1]
    const result = await verifyChain([r3, r2, r1]);
    expect(result.ok).toBe(true);
  });

  it('flags a tampered field as hash-mismatch', async () => {
    const original = await chainReport(fakeReport({ score: 50 }), GENESIS_PREV_HASH);
    // Simulate someone editing localStorage to change the score.
    const tampered = { ...original, score: 99 };
    const result = await verifyChain([tampered]);
    expect(result.ok).toBe(false);
    expect(result.flags.some(f => f.kind === 'hash-mismatch')).toBe(true);
  });

  it('flags a chain-break when prevHash points to nothing', async () => {
    const r1 = await chainReport(fakeReport({ id: '1' }), GENESIS_PREV_HASH);
    // r2 claims a prevHash that doesn't match r1's hash.
    const r2Faked: AuditReport = {
      ...fakeReport({ id: '2' }),
      integrity: { hash: 'whatever', prevHash: 'wrong-prev' },
    };
    const result = await verifyChain([r2Faked, r1]);
    expect(result.ok).toBe(false);
    expect(result.flags.some(f => f.kind === 'chain-break')).toBe(true);
  });

  it('flags pre-V2.6 reports as baselines but keeps ok=true if everything else valid', async () => {
    const legacy = fakeReport({ id: 'pre-v26' });  // no integrity
    const fresh = await chainReport(fakeReport({ id: 'fresh' }), GENESIS_PREV_HASH);
    // Stored: fresh is newest, legacy is older.
    const result = await verifyChain([fresh, legacy]);
    expect(result.ok).toBe(true);
    expect(result.flags.some(f => f.kind === 'pre-v2.6-baseline')).toBe(true);
  });

  it('handles a chain that resumes from genesis after a legacy gap', async () => {
    const legacy = fakeReport({ id: 'legacy' });  // no integrity
    const post = await chainReport(fakeReport({ id: 'post' }), GENESIS_PREV_HASH);
    const result = await verifyChain([post, legacy]);
    // Should NOT flag chain-break — fresh chain restarted from genesis.
    expect(result.flags.some(f => f.kind === 'chain-break')).toBe(false);
  });
});
