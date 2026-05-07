/**
 * Tests for deriveAlerts — the single source of truth that feeds the sidebar
 * badge AND the Alerts page. If these two ever disagree on the count, this
 * file caught the regression.
 *
 * What we're protecting against:
 *  - Counting old scans of the same domain (must keep only the most recent).
 *  - Drifting between the scan-report scorecard and the alert list (a
 *    "warning" status with Critical/High severity has to count).
 *  - TLS expiry alerts not flipping severity at the 7-day boundary.
 *  - pruneDismissed dropping ids that still refer to live alerts.
 *  - Compliance non-compliance leaking through when priority isn't High.
 */
import { deriveAlerts, filterDismissed, pruneDismissed, type Alert } from './deriveAlerts';
import type { AuditReport, AuditCheck } from '../data/auditTypes';
import type { GapAnalysisSession } from '../data/types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

function check(overrides: Partial<AuditCheck>): AuditCheck {
  return {
    id: 'check-1',
    category: 'WordPress Core',
    name: 'WordPress core out of date',
    description: 'Detects core version drift',
    worstCaseSeverity: 'High',
    ...overrides,
  };
}

function report(overrides: Partial<AuditReport>): AuditReport {
  return {
    id: 'r1',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-04-01T10:00:00Z',
    completedAt: '2026-04-01T10:01:30Z',
    score: 80,
    checks: [],
    ...overrides,
  };
}

function failedCheck(sev: 'Critical' | 'High' | 'Medium', name = 'Bad check'): AuditCheck {
  return check({
    id: `chk-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    worstCaseSeverity: sev,
    result: { status: 'fail', detail: `${name} failed` },
  });
}

// ─── deriveAlerts ───────────────────────────────────────────────────────────

describe('deriveAlerts', () => {
  it('returns no alerts for an empty inbox', () => {
    expect(deriveAlerts([], [])).toEqual([]);
  });

  it('emits one alert per Critical or High failed scan check', () => {
    const r = report({
      checks: [
        failedCheck('Critical', 'Critical fail'),
        failedCheck('High', 'High fail'),
        failedCheck('Medium', 'Medium fail'),  // ← below threshold
      ],
    });
    const alerts = deriveAlerts([r], []);
    expect(alerts).toHaveLength(2);
    expect(alerts.map(a => a.severity).sort()).toEqual(['Critical', 'High']);
  });

  it('treats "warning" status as a finding (must agree with the scan scorecard)', () => {
    const r = report({
      checks: [
        check({
          id: 'warn',
          worstCaseSeverity: 'High',
          result: { status: 'warning', detail: 'partial fail' },
        }),
      ],
    });
    const alerts = deriveAlerts([r], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('High');
  });

  it('only counts the most recent scan per domain', () => {
    // Two scans of the same domain, three days apart. Only the newer should
    // generate alerts — older findings have been re-checked.
    const stale = report({
      id: 'old', startedAt: '2026-04-01T00:00:00Z',
      checks: [failedCheck('Critical', 'Stale finding')],
    });
    const fresh = report({
      id: 'new', startedAt: '2026-04-04T00:00:00Z',
      checks: [failedCheck('High', 'Fresh finding')],
    });
    const alerts = deriveAlerts([stale, fresh], []);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain('Fresh finding');
  });

  it('emits a TLS expiry alert when cert expires within 30 days', () => {
    const r = report({
      checks: [
        check({
          id: 'tls-cert-expiry',
          category: 'TLS / SSL',
          name: 'TLS certificate expiry',
          worstCaseSeverity: 'High',
          result: { status: 'warning', detail: 'Cert expires in 12 days' },
        }),
      ],
    });
    const alerts = deriveAlerts([r], []);
    const tlsAlert = alerts.find(a => a.id.startsWith('tls-expiry-'));
    expect(tlsAlert).toBeDefined();
    expect(tlsAlert?.severity).toBe('High');
  });

  it('escalates TLS expiry to Critical at the 7-day boundary', () => {
    const r = report({
      checks: [
        check({
          id: 'tls-cert-expiry',
          category: 'TLS / SSL',
          name: 'TLS certificate expiry',
          worstCaseSeverity: 'High',
          result: { status: 'warning', detail: 'Cert expires in 5 days' },
        }),
      ],
    });
    const alerts = deriveAlerts([r], []);
    const tlsAlert = alerts.find(a => a.id.startsWith('tls-expiry-'));
    expect(tlsAlert?.severity).toBe('Critical');
  });

  it('does not emit a TLS alert when expiry is more than 30 days out', () => {
    const r = report({
      checks: [
        check({
          id: 'tls-cert-expiry',
          worstCaseSeverity: 'High',
          result: { status: 'warning', detail: 'Cert expires in 90 days' },
        }),
      ],
    });
    const alerts = deriveAlerts([r], []);
    expect(alerts.find(a => a.id.startsWith('tls-expiry-'))).toBeUndefined();
  });

  it('emits a compliance alert only for High-priority Non-Compliant items', () => {
    const sessions: GapAnalysisSession[] = [
      {
        id: 's1', clientId: 'c-1', name: 'ISMS gap',
        items: [
          { itemId: 'A.5.1', itemType: 'control', status: 'Non-Compliant', priority: 'High',  notes: '', responsible: '' },
          { itemId: 'A.5.2', itemType: 'control', status: 'Non-Compliant', priority: 'Low',   notes: '', responsible: '' },
          { itemId: 'A.5.3', itemType: 'control', status: 'Compliant',     priority: 'High',  notes: '', responsible: '' },
        ],
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      },
    ];
    const alerts = deriveAlerts([], sessions);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].source).toBe('post_comply');
    expect(alerts[0].detail).toContain('1 items');
  });

  it('sorts results: Critical first, then by recency within severity', () => {
    // Distinct completedAt on each report so the recency tiebreak is testable.
    const older = report({
      id: 'a', domain: 'a.com',
      startedAt: '2026-04-01T00:00:00Z', completedAt: '2026-04-01T00:01:00Z',
      checks: [failedCheck('Critical', 'Older crit')],
    });
    const newer = report({
      id: 'b', domain: 'b.com',
      startedAt: '2026-04-05T00:00:00Z', completedAt: '2026-04-05T00:01:00Z',
      checks: [failedCheck('Critical', 'Newer crit'), failedCheck('High', 'Newer high')],
    });
    const alerts = deriveAlerts([older, newer], []);
    // All criticals first.
    expect(alerts.slice(0, 2).every(a => a.severity === 'Critical')).toBe(true);
    expect(alerts[2].severity).toBe('High');
    // Within Critical, newer beats older.
    expect(alerts[0].timestamp).toBe('2026-04-05T00:01:00Z');
    expect(alerts[1].timestamp).toBe('2026-04-01T00:01:00Z');
  });
});

// ─── filterDismissed ────────────────────────────────────────────────────────

describe('filterDismissed', () => {
  it('returns the input unchanged when no ids are dismissed', () => {
    const alerts = [
      { id: 'a1', severity: 'High', source: 'post_scan', title: 't', detail: 'd', timestamp: '' } as Alert,
    ];
    expect(filterDismissed(alerts, [])).toBe(alerts);
  });

  it('removes alerts whose id matches a dismissed entry', () => {
    const alerts = [
      { id: 'a1' } as Alert,
      { id: 'a2' } as Alert,
      { id: 'a3' } as Alert,
    ];
    expect(filterDismissed(alerts, ['a2'])).toHaveLength(2);
    expect(filterDismissed(alerts, ['a2']).map(a => a.id)).toEqual(['a1', 'a3']);
  });
});

// ─── pruneDismissed ─────────────────────────────────────────────────────────

describe('pruneDismissed', () => {
  it('drops dismissed ids that no longer refer to a live alert', () => {
    const live = [{ id: 'a1' } as Alert, { id: 'a2' } as Alert];
    const dismissed = ['a1', 'a99-stale', 'a2', 'another-stale'];
    expect(pruneDismissed(live, dismissed)).toEqual(['a1', 'a2']);
  });

  it('returns the same array reference when nothing was dismissed', () => {
    const dismissed: string[] = [];
    expect(pruneDismissed([], dismissed)).toBe(dismissed);
  });
});
