/**
 * Sprint 26 (v3.0 pillar #4): KPI helpers (clause 9.1).
 *
 * Two KPI families:
 *  - Manual: user-defined metrics with hand-entered period values,
 *    persisted as Kpi records.
 *  - Auto: derived live from data the app already holds. Never stored —
 *    they're a projection, so they can't drift from the source.
 */
import type { Kpi, Finding, GapAnalysisSession } from '../data/types';
import type { AuditReport } from '../data/auditTypes';
import { openFindings, overdueFindings } from './findings';

export function newKpi(args: {
  clientId: string;
  name: string;
  unit: string;
  target?: number;
  cadence: 'monthly' | 'quarterly';
}): Kpi {
  return {
    id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...args,
    entries: [],
  };
}

/** Current period key for a cadence, e.g. "2026-07" / "2026-Q3". */
export function currentPeriod(cadence: Kpi['cadence'], now = new Date()): string {
  const y = now.getFullYear();
  if (cadence === 'monthly') {
    return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${y}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

/** Upsert one period's value; entries stay sorted by period. */
export function recordKpiValue(kpi: Kpi, period: string, value: number): Kpi {
  const rest = kpi.entries.filter(e => e.period !== period);
  return {
    ...kpi,
    entries: [...rest, { period, value }].sort((a, b) => a.period.localeCompare(b.period)),
  };
}

export function latestEntry(kpi: Kpi): { period: string; value: number } | null {
  return kpi.entries.length > 0 ? kpi.entries[kpi.entries.length - 1] : null;
}

/** Is the latest value on-target? null when no target or no entries. */
export function onTarget(kpi: Kpi): boolean | null {
  if (kpi.target === undefined) return null;
  const latest = latestEntry(kpi);
  if (!latest) return null;
  // Direction-agnostic default: treat target as a minimum. KPIs where
  // lower-is-better (e.g. "days to patch") should encode the target
  // accordingly in the name/unit; a direction flag is post-v3 polish.
  return latest.value >= kpi.target;
}

export interface AutoKpi {
  id: string;
  name: string;
  unit: string;
  value: number | null;
}

/**
 * Live-derived KPIs for one client. These are the metrics every ISMS
 * needs but nobody wants to type in monthly.
 */
export function computeAutoKpis(args: {
  clientId: string;
  findings: Finding[];
  gapSessions: GapAnalysisSession[];
  reports: AuditReport[];
}): AutoKpi[] {
  const clientFindings = args.findings.filter(f => f.clientId === args.clientId);

  const latestSession = args.gapSessions
    .filter(s => (s.clientId ?? 'unassigned') === args.clientId)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  const compliancePct = latestSession && latestSession.items.length > 0
    ? Math.round((latestSession.items.filter(i => i.status === 'Compliant').length / latestSession.items.length) * 100)
    : null;

  const clientReports = args.reports.filter(r => (r.clientId ?? 'unassigned') === args.clientId);
  const meanWp = clientReports.length > 0
    ? Math.round(clientReports.reduce((sum, r) => sum + r.score, 0) / clientReports.length)
    : null;

  return [
    { id: 'auto-compliance', name: 'Compliance (latest gap analysis)', unit: '%', value: compliancePct },
    { id: 'auto-wp-mean', name: 'Mean WP security score', unit: '/100', value: meanWp },
    { id: 'auto-open-capa', name: 'Open CAPA findings', unit: 'count', value: openFindings(clientFindings).length },
    { id: 'auto-overdue-capa', name: 'Overdue corrective actions', unit: 'count', value: overdueFindings(clientFindings).length },
  ];
}

/** CSV export: one row per (kpi, period). */
export function kpisToCsv(kpis: Kpi[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [['KPI', 'Unit', 'Target', 'Cadence', 'Period', 'Value'].join(',')];
  for (const k of kpis) {
    for (const e of k.entries) {
      rows.push([esc(k.name), esc(k.unit), k.target ?? '', k.cadence, e.period, e.value].join(','));
    }
    if (k.entries.length === 0) {
      rows.push([esc(k.name), esc(k.unit), k.target ?? '', k.cadence, '', ''].join(','));
    }
  }
  return rows.join('\n');
}
