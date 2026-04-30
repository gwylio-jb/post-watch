import type { AuditReport } from '../data/auditTypes';
import type { GapAnalysisSession } from '../data/types';

// ─── Shared alert model ───────────────────────────────────────────────────────
// Single source of truth for everything alert-shaped: the sidebar badge count,
// the Alerts tab list, and any future dashboard widget. Keep the rules here —
// never duplicate filter logic in a consumer.

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AlertSource = 'post_scan' | 'post_comply' | 'post_risk';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  detail: string;
  timestamp: string;
}

const severityOrder: Record<AlertSeverity, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3,
};

/**
 * Derive the raw (pre-dismissal) alert set from persisted data. Pure function:
 * same inputs → same outputs, no side effects.
 */
export function deriveAlerts(
  savedReports: AuditReport[],
  gapSessions: GapAnalysisSession[],
): Alert[] {
  const alerts: Alert[] = [];

  // 1. WP scan: Critical + High failures on the most recent scan per domain.
  const byDomain = new Map<string, AuditReport>();
  for (const r of savedReports) {
    const existing = byDomain.get(r.domain);
    if (!existing || new Date(r.startedAt) > new Date(existing.startedAt)) {
      byDomain.set(r.domain, r);
    }
  }

  for (const report of byDomain.values()) {
    for (const check of report.checks) {
      // Align with the scan report's severity summary: a Critical/High check
      // counts as a finding when status is "fail" OR "warning". Without this
      // the sidebar scorecard (2 High) and the alerts list (0) disagree.
      // Match the scan-report severity summary: a Critical/High check counts
      // as a finding when status is "fail" or "warning". Severity follows
      // worstCaseSeverity so the alert list agrees with the scorecard.
      const status = check.result?.status;
      if (status !== 'fail' && status !== 'warning') continue;
      const sev = check.worstCaseSeverity;
      if (sev !== 'Critical' && sev !== 'High') continue;
      alerts.push({
        id: `scan-${report.id}-${check.id}`,
        severity: sev as AlertSeverity,
        source: 'post_scan',
        title: `${check.name} — ${report.domain}`,
        detail: check.result!.detail,
        timestamp: report.completedAt ?? report.startedAt,
      });
    }

    // TLS cert expiry within 30 days — separate alert.
    const certCheck = report.checks.find(c => c.id === 'tls-cert-expiry');
    if (certCheck?.result?.status === 'warning' || certCheck?.result?.status === 'fail') {
      const daysMatch = certCheck.result.detail.match(/(\d+)\s*day/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        if (days <= 30) {
          alerts.push({
            id: `tls-expiry-${report.id}`,
            severity: days <= 7 ? 'Critical' : 'High',
            source: 'post_scan',
            title: `TLS cert expiring in ${days} days — ${report.domain}`,
            detail: certCheck.result.detail,
            timestamp: report.completedAt ?? report.startedAt,
          });
        }
      }
    }
  }

  // 2. Compliance: High-priority Non-Compliant items.
  for (const session of gapSessions) {
    const nonCompliant = session.items.filter(
      i => i.status === 'Non-Compliant' && i.priority === 'High'
    );
    if (nonCompliant.length > 0) {
      alerts.push({
        id: `comply-${session.id}`,
        severity: 'High',
        source: 'post_comply',
        title: `${nonCompliant.length} high-priority gap(s) in "${session.name}"`,
        detail: `${nonCompliant.length} items are Non-Compliant with High priority. Review and create remediation tasks.`,
        timestamp: session.updatedAt,
      });
    }
  }

  return alerts.sort((a, b) => {
    const sd = severityOrder[a.severity] - severityOrder[b.severity];
    if (sd !== 0) return sd;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/** Filter out any alerts whose id is in `dismissedIds`. */
export function filterDismissed(alerts: Alert[], dismissedIds: string[]): Alert[] {
  if (!dismissedIds.length) return alerts;
  const set = new Set(dismissedIds);
  return alerts.filter(a => !set.has(a.id));
}

/**
 * Prune `dismissedIds` down to only those that still refer to a live alert.
 * Without this, dismissing an alert and then clearing/re-running scans leaves
 * orphaned ids in localStorage forever, and could suppress a newly generated
 * alert that happened to reuse an id shape (unlikely, but tidy is better).
 */
export function pruneDismissed(alerts: Alert[], dismissedIds: string[]): string[] {
  if (!dismissedIds.length) return dismissedIds;
  const live = new Set(alerts.map(a => a.id));
  return dismissedIds.filter(id => live.has(id));
}
