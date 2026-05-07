/**
 * Tests for the scanEngine pure surface — buildCheckCatalogue, computeScore,
 * extractDomain, normaliseUrl. Network-driven `runScan` is intentionally not
 * tested here; it'll get a separate suite with mocked fetch in a follow-up.
 *
 * What we're protecting against:
 *  - Score drift: a Critical fail must always cost 20 points, a High 10, etc.
 *    The scan-report scorecard, the dashboard trend, and the alerts feed all
 *    sit on this number.
 *  - The "warning" status discount (40% of severity weight) silently
 *    regressing — that's how a Critical-severity warning ends up costing 8
 *    instead of 20.
 *  - URL normalisation that strips a meaningful path or fails to add the
 *    https:// prefix the network layer needs.
 *  - Catalogue duplicates — every check id must be unique, otherwise the
 *    progress UI and the result map can't keep them apart.
 */
import { computeScore, extractDomain, normaliseUrl, buildCheckCatalogue } from './scanEngine';
import type { AuditCheck, SeverityLevel, CheckStatus } from '../../data/auditTypes';

function chk(severity: SeverityLevel, status: CheckStatus | null, id = 'c'): AuditCheck {
  return {
    id,
    category: 'Configuration',
    name: id,
    description: '',
    worstCaseSeverity: severity,
    result: status ? { status, detail: '' } : undefined,
  };
}

// ─── computeScore ───────────────────────────────────────────────────────────

describe('computeScore', () => {
  it('returns 100 when no checks have run yet', () => {
    expect(computeScore([])).toBe(100);
    expect(computeScore([chk('Critical', null)])).toBe(100);
  });

  it('returns 100 when every check passes', () => {
    expect(computeScore([
      chk('Critical', 'pass', '1'),
      chk('High',     'pass', '2'),
      chk('Medium',   'pass', '3'),
    ])).toBe(100);
  });

  it('deducts the documented severity weights for fails', () => {
    // Critical = 20, High = 10, Medium = 5, Low = 2
    expect(computeScore([chk('Critical', 'fail')])).toBe(80);
    expect(computeScore([chk('High',     'fail')])).toBe(90);
    expect(computeScore([chk('Medium',   'fail')])).toBe(95);
    expect(computeScore([chk('Low',      'fail')])).toBe(98);
  });

  it('discounts warnings to 40% of the severity weight', () => {
    // Critical=20 → warning costs 8 (round(20*0.4))
    expect(computeScore([chk('Critical', 'warning')])).toBe(92);
    // High=10 → warning costs 4
    expect(computeScore([chk('High', 'warning')])).toBe(96);
  });

  it('discounts errors to 20% of the severity weight', () => {
    // Critical=20 → error costs 4 (round(20*0.2))
    expect(computeScore([chk('Critical', 'error')])).toBe(96);
  });

  it('skips info and skipped statuses entirely', () => {
    expect(computeScore([
      chk('Critical', 'info'),
      chk('Critical', 'skipped'),
    ])).toBe(100);
  });

  it('clamps the score at zero, never going negative', () => {
    // 6 critical fails would be -120 raw, must clamp to 0.
    const checks = Array.from({ length: 6 }, (_, i) => chk('Critical', 'fail', `c${i}`));
    expect(computeScore(checks)).toBe(0);
  });

  it('combines fails and warnings additively', () => {
    expect(computeScore([
      chk('Critical', 'fail'),     // -20
      chk('High',     'warning'),  // -4
      chk('Medium',   'pass'),     //  0
      chk('Low',      'fail'),     // -2
    ])).toBe(74);
  });
});

// ─── extractDomain ──────────────────────────────────────────────────────────

describe('extractDomain', () => {
  it('strips the protocol and returns the bare hostname', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('strips a leading "www."', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });

  it('falls back to a string-strip on malformed URLs (no throw)', () => {
    // No protocol — new URL() throws, fallback path activates.
    expect(extractDomain('example.com/path')).toBe('example.com');
    expect(extractDomain('www.example.com/x?y=z')).toBe('example.com');
  });
});

// ─── normaliseUrl ───────────────────────────────────────────────────────────

describe('normaliseUrl', () => {
  it('adds https:// when no protocol is present', () => {
    expect(normaliseUrl('example.com')).toBe('https://example.com');
    expect(normaliseUrl('  example.com  ')).toBe('https://example.com');
  });

  it('preserves an explicit http:// prefix', () => {
    expect(normaliseUrl('http://example.com')).toBe('http://example.com');
  });

  it('preserves an explicit https:// prefix', () => {
    expect(normaliseUrl('https://example.com')).toBe('https://example.com');
  });

  it('strips a single trailing slash', () => {
    expect(normaliseUrl('https://example.com/')).toBe('https://example.com');
    expect(normaliseUrl('example.com/')).toBe('https://example.com');
  });
});

// ─── buildCheckCatalogue ────────────────────────────────────────────────────

describe('buildCheckCatalogue', () => {
  const catalogue = buildCheckCatalogue();

  it('returns a non-empty list of checks', () => {
    expect(catalogue.length).toBeGreaterThan(40);
  });

  it('gives every check a unique id (progress map relies on this)', () => {
    const ids = catalogue.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns a fresh array per call (no shared state across runs)', () => {
    const a = buildCheckCatalogue();
    const b = buildCheckCatalogue();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });

  it('starts with no result on any check (must be set during scan)', () => {
    expect(catalogue.every(c => c.result === undefined)).toBe(true);
  });

  it('every check carries a worstCaseSeverity inside the documented set', () => {
    const allowed: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Info', 'Pass'];
    expect(catalogue.every(c => allowed.includes(c.worstCaseSeverity))).toBe(true);
  });
});
