/**
 * Sprint 20: execute a parsed QueryPlan against in-memory app data.
 *
 * The plan only carries the shape of the query; this module owns the
 * mapping from logical fields onto each collection's concrete fields.
 * That keeps the planner ignorant of schema drift — when (say) RiskItem
 * gains a new field, only this file needs to know.
 *
 * Severity mapping (risks): we bucket the raw 1–25 score into
 * low/medium/high/critical so the planner can speak in human terms
 * without knowing the formula.
 *
 *   score < 6   → low
 *   6 – 11      → medium
 *   12 – 19     → high
 *   20+         → critical
 */
import type { QueryFilter, QueryPlan, SeverityBucket } from './queryPlan';
import type { RiskItem, Client, GapAnalysisSession } from '../../data/types';
import type { AuditReport } from '../../data/auditTypes';

export interface ExecuteOptions {
  risks: RiskItem[];
  reports: AuditReport[];
  sessions: GapAnalysisSession[];
  clients: Client[];
}

/** A row + a uniform shape the search UI can render. */
export interface QueryResult {
  collection: QueryPlan['collection'];
  id: string;
  title: string;
  subtitle?: string;
  /** The original record, in case the UI wants to deep-link. */
  record: unknown;
}

export function severityBucketForScore(score: number): SeverityBucket {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

/* ─── Per-collection filter appliers ──────────────────────────────────── */

function clientName(clients: Client[], id: string | undefined): string {
  if (!id) return '';
  return clients.find(c => c.id === id)?.name ?? '';
}

function matchesClient(name: string, f: Extract<QueryFilter, { field: 'clientName' }>): boolean {
  if (f.op === 'equals') return name.toLowerCase() === f.value.toLowerCase();
  return name.toLowerCase().includes(f.value.toLowerCase());
}

function matchesCreatedAt(iso: string | undefined, f: Extract<QueryFilter, { field: 'createdAt' }>): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  const ref = Date.parse(f.value);
  if (Number.isNaN(t) || Number.isNaN(ref)) return false;
  return f.op === 'after' ? t >= ref : t <= ref;
}

function applyRiskFilters(risks: RiskItem[], clients: Client[], filters: QueryFilter[]): RiskItem[] {
  return risks.filter(r => filters.every(f => {
    switch (f.field) {
      case 'clientName': return matchesClient(clientName(clients, r.clientId), f);
      case 'severity':   return f.value.includes(severityBucketForScore(r.score));
      case 'status':     return f.value.some(v => v.toLowerCase() === r.status.toLowerCase());
      case 'createdAt':  return matchesCreatedAt(r.dueDate, f); // risks have no createdAt; use dueDate as best proxy
      default: return true;
    }
  }));
}

function applyReportFilters(reports: AuditReport[], clients: Client[], filters: QueryFilter[]): AuditReport[] {
  return reports.filter(r => filters.every(f => {
    switch (f.field) {
      case 'clientName': return matchesClient(clientName(clients, r.clientId), f);
      case 'severity': {
        // Map report score (0–100, higher = better) to severity buckets
        // inversely — a low score is a high-severity finding.
        const inv = 100 - (r.score ?? 0);
        const bucket = severityBucketForScore(Math.min(25, Math.max(0, inv / 4)));
        return f.value.includes(bucket);
      }
      case 'status':     return true;  // reports have no status field
      case 'createdAt':  return matchesCreatedAt(r.completedAt ?? r.startedAt, f);
      default: return true;
    }
  }));
}

function applySessionFilters(sessions: GapAnalysisSession[], clients: Client[], filters: QueryFilter[]): GapAnalysisSession[] {
  return sessions.filter(s => filters.every(f => {
    switch (f.field) {
      case 'clientName': return matchesClient(clientName(clients, (s as { clientId?: string }).clientId), f);
      case 'createdAt':  return matchesCreatedAt(
        (s as { createdAt?: string; date?: string }).createdAt
          ?? (s as { date?: string }).date,
        f,
      );
      // sessions have no severity/status concepts in this version
      default: return true;
    }
  }));
}

function applyClientFilters(clients: Client[], filters: QueryFilter[]): Client[] {
  return clients.filter(c => filters.every(f => {
    switch (f.field) {
      case 'clientName': return matchesClient(c.name, f);
      case 'createdAt':  return matchesCreatedAt(c.createdAt, f);
      default: return true;
    }
  }));
}

/* ─── Public entry ────────────────────────────────────────────────────── */

export function executeQueryPlan(plan: QueryPlan, data: ExecuteOptions): QueryResult[] {
  switch (plan.collection) {
    case 'risks': {
      const rows = applyRiskFilters(data.risks, data.clients, plan.filters);
      return rows.map(r => ({
        collection: 'risks',
        id: r.id,
        title: r.name,
        subtitle: `${r.status} · score ${r.score} · ${clientName(data.clients, r.clientId) || 'Unassigned'}`,
        record: r,
      }));
    }
    case 'reports': {
      const rows = applyReportFilters(data.reports, data.clients, plan.filters);
      return rows.map(r => ({
        collection: 'reports',
        id: r.id,
        title: r.domain || r.targetUrl,
        subtitle: `Score ${r.score} · ${(r.completedAt ?? r.startedAt).slice(0, 10)} · ${clientName(data.clients, r.clientId) || 'Unassigned'}`,
        record: r,
      }));
    }
    case 'sessions': {
      const rows = applySessionFilters(data.sessions, data.clients, plan.filters);
      return rows.map(s => ({
        collection: 'sessions',
        id: (s as { id: string }).id,
        title: (s as { title?: string; name?: string }).title
          ?? (s as { name?: string }).name
          ?? 'Gap analysis session',
        subtitle: clientName(data.clients, (s as { clientId?: string }).clientId) || 'Unassigned',
        record: s,
      }));
    }
    case 'clients': {
      const rows = applyClientFilters(data.clients, plan.filters);
      return rows.map(c => ({
        collection: 'clients',
        id: c.id,
        title: c.name,
        subtitle: c.industry ?? c.primaryContact,
        record: c,
      }));
    }
  }
}
