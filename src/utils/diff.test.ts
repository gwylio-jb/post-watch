/**
 * Tests for the pure diff functions.
 *
 * What we're protecting against:
 *  - Item identity bugs: same itemId in both sides with different fields
 *    must surface as 'changed', not 'removed + added'.
 *  - Ordering: rendered tables expect removed → changed → added so the
 *    UI reads top-down "what's gone, what's different, what's new".
 *  - Field-level granularity: changed entries name exactly the fields
 *    that differ, so the diff UI can highlight columns.
 *  - Scan-score deltas use the LATEST report per domain on each side,
 *    not the first.
 */
import { diffGapItems, diffRisks, diffScansByDomain } from './diff';
import type { GapAnalysisItem, RiskItem } from '../data/types';
import type { AuditReport } from '../data/auditTypes';

// ─── diffGapItems ──────────────────────────────────────────────────────────

function fakeGap(over: Partial<GapAnalysisItem> = {}): GapAnalysisItem {
  return {
    itemId: 'A.5.1',
    itemType: 'control',
    status: 'Not Assessed',
    priority: 'Medium',
    notes: '',
    responsible: '',
    ...over,
  };
}

describe('diffGapItems', () => {
  it('returns [] for two empty arrays', () => {
    expect(diffGapItems([], [])).toEqual([]);
  });

  it('detects items added only on the after side', () => {
    const result = diffGapItems([], [fakeGap()]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('added');
  });

  it('detects items removed (present in before, missing in after)', () => {
    const result = diffGapItems([fakeGap({ itemId: 'A.5.1' })], []);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('removed');
  });

  it('detects field changes on the same itemId without splitting into removed+added', () => {
    const before = fakeGap({ status: 'Not Assessed' });
    const after  = fakeGap({ status: 'Compliant' });
    const result = diffGapItems([before], [after]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('changed');
    if (result[0].kind === 'changed') {
      expect(result[0].fields).toEqual(['status']);
    }
  });

  it('reports multiple changed fields on the same item', () => {
    const before = fakeGap({ status: 'Not Assessed', priority: 'Low', notes: '' });
    const after  = fakeGap({ status: 'Compliant',    priority: 'High', notes: 'done' });
    const result = diffGapItems([before], [after]);
    expect(result[0].kind).toBe('changed');
    if (result[0].kind === 'changed') {
      expect(result[0].fields.sort()).toEqual(['notes', 'priority', 'status']);
    }
  });

  it("skips items where every field is equal", () => {
    const before = fakeGap({ itemId: 'A.5.1', status: 'Compliant' });
    const after  = fakeGap({ itemId: 'A.5.1', status: 'Compliant' });
    expect(diffGapItems([before], [after])).toEqual([]);
  });

  it('orders results: removed → changed → added', () => {
    const before = [
      fakeGap({ itemId: 'A.removed' }),
      fakeGap({ itemId: 'A.changed', status: 'Not Assessed' }),
    ];
    const after = [
      fakeGap({ itemId: 'A.changed', status: 'Compliant' }),
      fakeGap({ itemId: 'A.added' }),
    ];
    const result = diffGapItems(before, after);
    expect(result.map(r => r.kind)).toEqual(['removed', 'changed', 'added']);
  });

  it('handles many items efficiently — O(n) over each side', () => {
    // Smoke test that we're using maps not nested loops.
    const before = Array.from({ length: 500 }, (_, i) => fakeGap({ itemId: `A.${i}` }));
    const after  = Array.from({ length: 500 }, (_, i) => fakeGap({ itemId: `A.${i}`, status: 'Compliant' }));
    const start = performance.now();
    const result = diffGapItems(before, after);
    const elapsed = performance.now() - start;
    expect(result).toHaveLength(500);
    // Generous bound; real time is in the low ms.
    expect(elapsed).toBeLessThan(200);
  });
});

// ─── diffRisks ─────────────────────────────────────────────────────────────

function fakeRisk(over: Partial<RiskItem> = {}): RiskItem {
  return {
    id: 'r-1',
    name: 'A risk',
    description: '',
    category: 'Technical',
    likelihood: 3,
    impact: 3,
    score: 9,
    treatment: 'Mitigate',
    owner: '',
    dueDate: '',
    status: 'Open',
    ...over,
  };
}

describe('diffRisks', () => {
  it('detects added / removed / changed risks', () => {
    const before = [fakeRisk({ id: 'r1' }), fakeRisk({ id: 'r2', score: 9 })];
    const after  = [fakeRisk({ id: 'r2', score: 12 }), fakeRisk({ id: 'r3' })];
    const result = diffRisks(before, after);
    const kinds = result.map(r => r.kind);
    expect(kinds).toContain('removed'); // r1
    expect(kinds).toContain('changed'); // r2 score
    expect(kinds).toContain('added');   // r3
  });

  it('names the specific fields that changed on a risk', () => {
    const before = fakeRisk({ id: 'r1', score: 9, status: 'Open' });
    const after  = fakeRisk({ id: 'r1', score: 9, status: 'Closed' });
    const result = diffRisks([before], [after]);
    expect(result).toHaveLength(1);
    if (result[0].kind === 'changed') {
      expect(result[0].fields).toEqual(['status']);
    }
  });
});

// ─── diffScansByDomain ─────────────────────────────────────────────────────

function fakeReport(over: Partial<AuditReport> = {}): AuditReport {
  return {
    id: `r-${Math.random()}`,
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-01-01T00:00:00Z',
    score: 70,
    checks: [],
    ...over,
  };
}

describe('diffScansByDomain', () => {
  it('returns [] for two empty arrays', () => {
    expect(diffScansByDomain([], [])).toEqual([]);
  });

  it('reports a positive delta when the score improved', () => {
    const before = [fakeReport({ domain: 'a.com', score: 60, startedAt: '2026-01-01T00:00:00Z' })];
    const after  = [fakeReport({ domain: 'a.com', score: 85, startedAt: '2026-02-01T00:00:00Z' })];
    const result = diffScansByDomain(before, after);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ domain: 'a.com', before: 60, after: 85, delta: 25 });
  });

  it('picks the LATEST report per domain from each side', () => {
    // Two reports on the same domain in `before`; latest is the second.
    const before = [
      fakeReport({ domain: 'a.com', score: 30, startedAt: '2025-12-01T00:00:00Z' }),
      fakeReport({ domain: 'a.com', score: 60, startedAt: '2026-01-15T00:00:00Z' }),
    ];
    const after = [fakeReport({ domain: 'a.com', score: 85, startedAt: '2026-02-01T00:00:00Z' })];
    const result = diffScansByDomain(before, after);
    expect(result[0].before).toBe(60);
  });

  it('uses completedAt over startedAt when present', () => {
    const before = [fakeReport({
      domain: 'a.com', score: 60,
      startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:05:00Z',
    })];
    const after = [fakeReport({
      domain: 'a.com', score: 75,
      startedAt: '2026-02-01T00:00:00Z', completedAt: '2026-02-01T00:05:00Z',
    })];
    expect(diffScansByDomain(before, after)[0].delta).toBe(15);
  });

  it('handles domains present on only one side (no delta)', () => {
    const before = [fakeReport({ domain: 'a.com' })];
    const after  = [fakeReport({ domain: 'b.com' })];
    const result = diffScansByDomain(before, after);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.domain === 'a.com')?.after).toBeNull();
    expect(result.find(r => r.domain === 'b.com')?.before).toBeNull();
    expect(result.every(r => r.delta === null)).toBe(true);
  });

  it('sorts by worst regression first (most-negative delta at top)', () => {
    const before = [
      fakeReport({ domain: 'big-drop.com', score: 90 }),
      fakeReport({ domain: 'small-drop.com', score: 75 }),
      fakeReport({ domain: 'improved.com', score: 50 }),
    ];
    const after = [
      fakeReport({ domain: 'big-drop.com', score: 40 }),
      fakeReport({ domain: 'small-drop.com', score: 70 }),
      fakeReport({ domain: 'improved.com', score: 80 }),
    ];
    const result = diffScansByDomain(before, after);
    expect(result[0].domain).toBe('big-drop.com');
    expect(result[1].domain).toBe('small-drop.com');
    expect(result[2].domain).toBe('improved.com');
  });
});
