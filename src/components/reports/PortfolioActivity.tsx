/**
 * Portfolio activity panel — Sprint 13.5 (deferred from Sprint 13 Pack 2).
 *
 * Cross-client diff for consultants running multiple engagements at once.
 * Per-client one-row summary covering:
 *   - Latest scan score + delta vs the previous scan of the same domain
 *   - Number of open / critical risks
 *   - Gap-analysis status mix (% Compliant across most recent session)
 *
 * Lives in the Reports module rather than the Dashboard because the
 * Dashboard view is "this consultant right now" and this is "the
 * portfolio over time" — two different framings.
 *
 * Discovery doc §5.2: a real PDF version is Pack 4's "Portfolio change
 * report" template. v1 here is the inline view; the PDF generator can
 * sit on top of the same row computation when we get there.
 */
import { useMemo } from 'react';
import { Users, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { Client, GapAnalysisSession, RiskItem } from '../../data/types';
import type { AuditReport } from '../../data/auditTypes';

export interface PortfolioActivityProps {
  clients: Client[];
  reports: AuditReport[];
  sessions: GapAnalysisSession[];
  risks: RiskItem[];
}

interface ClientRow {
  client: Client;
  /** Most recent scan score for any domain associated with the client. null if no scans. */
  latestScore: number | null;
  /** Score delta vs the previous scan of the same domain. null if only one or zero scans. */
  scoreDelta: number | null;
  /** Latest scan timestamp, ISO. */
  latestScanAt: string | null;
  openRisks: number;
  criticalRisks: number;
  /** Compliance % from the most recently updated gap session for the client. null if no sessions. */
  compliancePct: number | null;
}

function compute(props: PortfolioActivityProps): ClientRow[] {
  const { clients, reports, sessions, risks } = props;

  // Group reports by clientId for fast lookup, sorted newest-first within each.
  const reportsByClient = new Map<string, AuditReport[]>();
  for (const r of reports) {
    const cid = r.clientId ?? 'unassigned';
    const arr = reportsByClient.get(cid) ?? [];
    arr.push(r);
    reportsByClient.set(cid, arr);
  }
  for (const arr of reportsByClient.values()) {
    arr.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  const sessionsByClient = new Map<string, GapAnalysisSession[]>();
  for (const s of sessions) {
    const cid = s.clientId ?? 'unassigned';
    const arr = sessionsByClient.get(cid) ?? [];
    arr.push(s);
    sessionsByClient.set(cid, arr);
  }
  for (const arr of sessionsByClient.values()) {
    arr.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  const risksByClient = new Map<string, RiskItem[]>();
  for (const r of risks) {
    const cid = r.clientId ?? 'unassigned';
    const arr = risksByClient.get(cid) ?? [];
    arr.push(r);
    risksByClient.set(cid, arr);
  }

  return clients.map(client => {
    const clientReports = reportsByClient.get(client.id) ?? [];
    const clientSessions = sessionsByClient.get(client.id) ?? [];
    const clientRisks = risksByClient.get(client.id) ?? [];

    let latestScore: number | null = null;
    let scoreDelta: number | null = null;
    let latestScanAt: string | null = null;
    if (clientReports.length > 0) {
      const newest = clientReports[0];
      latestScore = newest.score;
      latestScanAt = newest.startedAt;
      // Previous scan of the SAME domain — comparing different domains
      // would be apples-to-oranges.
      const prev = clientReports.slice(1).find(r => r.domain === newest.domain);
      if (prev) scoreDelta = newest.score - prev.score;
    }

    const openRisks = clientRisks.filter(r => r.status !== 'Closed').length;
    const criticalRisks = clientRisks.filter(r => r.score > 15 && r.status !== 'Closed').length;

    let compliancePct: number | null = null;
    if (clientSessions.length > 0) {
      const newest = clientSessions[0];
      const total = newest.items.length;
      if (total > 0) {
        const compliant = newest.items.filter(i => i.status === 'Compliant').length;
        compliancePct = Math.round((compliant / total) * 100);
      }
    }

    return {
      client,
      latestScore, scoreDelta, latestScanAt,
      openRisks, criticalRisks,
      compliancePct,
    };
  });
}

function DeltaIndicator({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>—</span>;
  }
  if (delta === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--font-redesign-mono)' }}>
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color: positive ? 'var(--mint)' : 'var(--ember)',
      fontSize: 11, fontFamily: 'var(--font-redesign-mono)', fontWeight: 600,
    }}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{delta}
    </span>
  );
}

export default function PortfolioActivity(props: PortfolioActivityProps) {
  const rows = useMemo(() => compute(props), [props]);

  // Hide entirely if there's nothing meaningful to show — keeps the page
  // from feeling broken when a user opens Reports before importing data.
  if (rows.length === 0) {
    return null;
  }

  // Sort by client name for stable display. A future tweak might surface
  // "biggest score drops" at top — defer to user feedback.
  const sorted = [...rows].sort((a, b) => a.client.name.localeCompare(b.client.name));

  return (
    <section className="bubble">
      <div className="card-head">
        <div>
          <span className="kicker violet">post_report · portfolio</span>
          <h3>Portfolio activity</h3>
          <div className="desc">
            One-row summary per client — latest scan score, score delta vs
            the previous scan of the same domain, open risks, gap-analysis
            position.
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)',
        }}>
          <Users className="w-3 h-3" /> {rows.length} client{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ padding: '0 18px 18px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-2)' }}>
              {['Client', 'Latest score', 'Δ', 'Last scan', 'Risks', 'Compliance'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left',
                  fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.client.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '12px', fontWeight: 600, color: 'var(--ink-1)' }}>
                  {row.client.name}
                  {row.client.industry && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>
                      {row.client.industry}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-redesign-condensed)', fontWeight: 700, fontSize: 18 }}>
                  {row.latestScore !== null
                    ? <span style={{
                        color: row.latestScore >= 80 ? 'var(--mint)'
                          : row.latestScore >= 50 ? 'var(--violet)' : 'var(--ember)',
                      }}>{row.latestScore}</span>
                    : <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>—</span>}
                </td>
                <td style={{ padding: '12px' }}>
                  <DeltaIndicator delta={row.scoreDelta} />
                </td>
                <td style={{ padding: '12px', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {row.latestScanAt
                    ? new Date(row.latestScanAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                    : '—'}
                </td>
                <td style={{ padding: '12px', fontSize: 12 }}>
                  {row.openRisks > 0
                    ? <span>{row.openRisks} open{row.criticalRisks > 0 ? <span style={{ color: 'var(--ember)', fontFamily: 'var(--font-redesign-mono)' }}> · {row.criticalRisks} crit</span> : null}</span>
                    : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                </td>
                <td style={{ padding: '12px', fontFamily: 'var(--font-redesign-mono)' }}>
                  {row.compliancePct !== null
                    ? <span style={{ color: row.compliancePct >= 80 ? 'var(--mint)' : row.compliancePct >= 50 ? 'var(--violet)' : 'var(--ember)' }}>{row.compliancePct}%</span>
                    : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
