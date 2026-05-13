/**
 * buildPortfolioSummary — pure aggregator separated from the React-PDF
 * component so the PDF file can export only the component (satisfies
 * react-refresh/only-export-components). Tested independently.
 */
import type { AuditReport } from '../data/auditTypes';
import type { GapAnalysisSession, Client, RiskItem } from '../data/types';
import { UNASSIGNED_CLIENT_ID } from '../utils/clientMigration';

export interface ClientSummaryRow {
  clientId: string;
  clientName: string;
  industry?: string;
  /** Most recent WP scan score for any domain owned by this client. */
  latestScore: number | null;
  latestScanDomain?: string;
  latestScanAt?: string;
  /** Open risks (not Closed). */
  openRisks: number;
  /** Score-greater-than-15 risks (Critical band). */
  criticalRisks: number;
  /** Compliance percentage across all gap sessions for this client. */
  compliancePct: number | null;
  /** Count of items contributing to the % calculation. */
  complianceItemCount: number;
  /** Most-recent activity timestamp across scans / risks / gap sessions. */
  lastActivityAt: string | null;
}

export function buildPortfolioSummary(
  clients: Client[],
  reports: AuditReport[],
  sessions: GapAnalysisSession[],
  risks: RiskItem[],
): ClientSummaryRow[] {
  return clients.map(client => {
    const clientReports  = reports.filter(r => (r.clientId  ?? UNASSIGNED_CLIENT_ID) === client.id);
    const clientSessions = sessions.filter(s => (s.clientId ?? UNASSIGNED_CLIENT_ID) === client.id);
    const clientRisks    = risks.filter(r => (r.clientId    ?? UNASSIGNED_CLIENT_ID) === client.id);

    // Latest scan — most recent completed across any of this client's domains.
    let latestScore: number | null = null;
    let latestScanDomain: string | undefined;
    let latestScanAt: string | undefined;
    for (const r of clientReports) {
      const ts = r.completedAt ?? r.startedAt;
      if (!latestScanAt || ts > latestScanAt) {
        latestScanAt = ts;
        latestScore = r.score;
        latestScanDomain = r.domain;
      }
    }

    const openRisks     = clientRisks.filter(r => r.status !== 'Closed').length;
    const criticalRisks = clientRisks.filter(r => r.status !== 'Closed' && r.score > 15).length;

    // Compliance — sum of every NA-excluded item across all sessions.
    let totalItems = 0;
    let compliantItems = 0;
    let lastSessionAt: string | null = null;
    for (const s of clientSessions) {
      if (!lastSessionAt || s.updatedAt > lastSessionAt) lastSessionAt = s.updatedAt;
      for (const item of s.items) {
        if (item.status === 'Not Applicable') continue;
        totalItems++;
        if (item.status === 'Compliant') compliantItems++;
      }
    }
    const compliancePct = totalItems > 0 ? Math.round((compliantItems / totalItems) * 100) : null;

    const candidates: (string | undefined)[] = [latestScanAt, lastSessionAt ?? undefined];
    for (const r of clientRisks) candidates.push(r.dueDate || undefined);
    const lastActivityAt = candidates
      .filter((c): c is string => !!c)
      .sort()
      .pop() ?? null;

    return {
      clientId: client.id,
      clientName: client.name,
      industry: client.industry,
      latestScore,
      latestScanDomain,
      latestScanAt,
      openRisks,
      criticalRisks,
      compliancePct,
      complianceItemCount: totalItems,
      lastActivityAt,
    };
  })
  .sort((a, b) => {
    const aT = a.lastActivityAt ?? '';
    const bT = b.lastActivityAt ?? '';
    return bT.localeCompare(aT);
  });
}
