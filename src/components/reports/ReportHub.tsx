import { useState, useMemo } from 'react';
import { FileText, Download, Users, Loader2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { AuditReport } from '../../data/auditTypes';
import type { GapAnalysisSession, Client } from '../../data/types';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';

// ─── Report type selector ─────────────────────────────────────────────────────

type ReportType = 'wp-security' | 'compliance-status' | 'executive-summary';

const REPORT_TYPES: { id: ReportType; label: string; description: string; icon: string }[] = [
  {
    id: 'wp-security',
    label: 'WP Security Report',
    description: 'Full WordPress security audit findings, score, and remediation guide',
    icon: '🛡️',
  },
  {
    id: 'compliance-status',
    label: 'Compliance Status Report',
    description: 'Gap analysis results and implementation progress across ISO 27001',
    icon: '📋',
  },
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'One-page combined security posture scorecard for leadership',
    icon: '📊',
  },
];

// ─── WP Security Report preview ───────────────────────────────────────────────

function WpSecurityPreview({ report, clientName }: { report: AuditReport; clientName?: string }) {
  const critical = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'Critical');
  const high = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'High');
  const medium = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'Medium');
  const passed = report.checks.filter(c => c.result?.status === 'pass');

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Cover header */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: 'var(--gradient-hero)', color: '#F8F9FA' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {report.clientLogo && (
            <div
              style={{
                width: 48, height: 48, borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <img src={report.clientLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: 'rgba(248,249,250,0.5)', marginBottom: 4 }}>
              // post_scan report{clientName ? ` · ${clientName}` : ''}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '20px', marginBottom: 4, letterSpacing: '-0.02em' }}>
              WordPress Security Report
            </h2>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>{report.domain} · {new Date(report.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: report.score >= 70 ? '#00D9A3' : report.score >= 40 ? '#F59E0B' : '#FF4A1C', lineHeight: 1 }}>
              {report.score}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(248,249,250,0.55)', fontFamily: '"JetBrains Mono", monospace' }}>security score</div>
          </div>
          {[
            { label: 'Critical', count: critical.length, color: '#FF4A1C' },
            { label: 'High',     count: high.length,     color: '#F59E0B' },
            { label: 'Medium',   count: medium.length,   color: '#8B5CF6' },
            { label: 'Passed',   count: passed.length,   color: '#00D9A3' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '10px', color: 'rgba(248,249,250,0.55)', fontFamily: '"JetBrains Mono", monospace' }}>{s.label.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings summary */}
      {critical.length + high.length > 0 && (
        <div className="space-y-2 mb-4">
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Priority findings
          </h3>
          {[...critical, ...high].slice(0, 8).map(check => (
            <div
              key={check.id}
              className="rounded-lg p-3"
              style={{
                borderLeft: `3px solid ${check.worstCaseSeverity === 'Critical' ? '#FF4A1C' : '#D97706'}`,
                background: 'var(--color-surface-alt)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{check.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{check.result?.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 16 }}>
        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
          // Generated by Post_Watch · by gwylio · {new Date().toLocaleDateString('en-GB')}
        </p>
      </div>
    </div>
  );
}

// ─── Compliance Report preview ────────────────────────────────────────────────

function CompliancePreview({ session }: { session: GapAnalysisSession }) {
  const compliant    = session.items.filter(i => i.status === 'Compliant').length;
  const partial      = session.items.filter(i => i.status === 'Partially Compliant').length;
  const nonCompliant = session.items.filter(i => i.status === 'Non-Compliant').length;
  const total        = session.items.length;
  const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  return (
    <div>
      <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--gradient-secondary)', color: '#F8F9FA' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: 'rgba(248,249,250,0.5)', marginBottom: 4 }}>// post_comply report</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '20px', marginBottom: 4, letterSpacing: '-0.02em' }}>
          Compliance Status Report
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.7 }}>{session.name}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
          {[
            { label: 'Compliant',    value: compliant,    color: '#00D9A3' },
            { label: 'Partial',      value: partial,      color: '#A78BFA' },
            { label: 'Non-Compliant',value: nonCompliant, color: '#FF4A1C' },
            { label: 'Score',        value: `${pct}%`,    color: '#F8F9FA' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: 'rgba(248,249,250,0.55)', fontFamily: '"JetBrains Mono", monospace' }}>{s.label.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        // Generated by Post_Watch · by gwylio · {new Date().toLocaleDateString('en-GB')}
      </p>
    </div>
  );
}

// ─── Executive Summary preview ────────────────────────────────────────────────

function ExecutiveSummaryPreview({
  report,
  session,
}: {
  report: AuditReport | null;
  session: GapAnalysisSession | null;
}) {
  return (
    <div>
      <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--gradient-hero)', color: '#F8F9FA' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: 'rgba(248,249,250,0.5)', marginBottom: 4 }}>// executive summary</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.02em' }}>
          Security Posture Summary
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.7, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="glass-card-navy rounded-lg p-4">
            <div style={{ fontSize: '10px', color: 'rgba(248,249,250,0.5)', fontFamily: '"JetBrains Mono", monospace', marginBottom: 4 }}>WP Security</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: report ? (report.score >= 70 ? '#00D9A3' : '#FF4A1C') : 'rgba(248,249,250,0.3)', lineHeight: 1 }}>
              {report ? `${report.score}/100` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(248,249,250,0.5)', marginTop: 2 }}>
              {report ? report.domain : 'No scan data'}
            </div>
          </div>
          <div className="glass-card-navy rounded-lg p-4">
            <div style={{ fontSize: '10px', color: 'rgba(248,249,250,0.5)', fontFamily: '"JetBrains Mono", monospace', marginBottom: 4 }}>ISO 27001 Compliance</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: session ? '#8B5CF6' : 'rgba(248,249,250,0.3)', lineHeight: 1 }}>
              {session
                ? `${Math.round((session.items.filter(i => i.status === 'Compliant').length / Math.max(session.items.length, 1)) * 100)}%`
                : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(248,249,250,0.5)', marginTop: 2 }}>
              {session ? session.name : 'No compliance data'}
            </div>
          </div>
        </div>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
        // Generated by Post_Watch · by gwylio · {new Date().toLocaleDateString('en-GB')}
      </p>
    </div>
  );
}

// ─── Main Reports Hub ─────────────────────────────────────────────────────────

export default function ReportHub() {
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);

  const [reportType, setReportType] = useState<ReportType>('wp-security');
  const [clientScope, setClientScope] = useState<'all' | string>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const safeReports: AuditReport[] = Array.isArray(savedReports) ? savedReports : [];
  const safeSessions: GapAnalysisSession[] = Array.isArray(gapSessions) ? gapSessions : [];
  const safeClients: Client[] = Array.isArray(clients) ? clients : [];

  // Scope selector always offers Unassigned so legacy untagged data stays reachable.
  const pickerClients = useMemo<Client[]>(() => {
    if (safeClients.some(c => c.id === UNASSIGNED_CLIENT_ID)) return safeClients;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...safeClients,
    ];
  }, [safeClients]);

  const scopedReports = useMemo(
    () => clientScope === 'all'
      ? safeReports
      : safeReports.filter(r => (r.clientId ?? UNASSIGNED_CLIENT_ID) === clientScope),
    [safeReports, clientScope]
  );
  const scopedSessions = useMemo(
    () => clientScope === 'all'
      ? safeSessions
      : safeSessions.filter(s => (s.clientId ?? UNASSIGNED_CLIENT_ID) === clientScope),
    [safeSessions, clientScope]
  );

  const sortedReports = useMemo(() =>
    [...scopedReports].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [scopedReports]
  );
  const sortedSessions = useMemo(() =>
    [...scopedSessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [scopedSessions]
  );

  const selectedReport = selectedReportId
    ? sortedReports.find(r => r.id === selectedReportId) ?? sortedReports[0]
    : sortedReports[0] ?? null;

  const selectedSession = selectedSessionId
    ? sortedSessions.find(s => s.id === selectedSessionId) ?? sortedSessions[0]
    : sortedSessions[0] ?? null;

  const clientNameFor = (clientId?: string): string | undefined => {
    if (!clientId) return undefined;
    return pickerClients.find(c => c.id === clientId)?.name;
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Download handler — picks the right template based on the currently
  // selected report type. Disables itself during generation; the underlying
  // module is imported lazily so the PDF renderer never touches the main
  // bundle for users who don't export.
  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const { downloadReportPdf } = await import('../../pdf/generate');
      const dataClientId = selectedReport?.clientId ?? selectedSession?.clientId;
      const client = dataClientId ? pickerClients.find(c => c.id === dataClientId) : undefined;
      await downloadReportPdf({
        kind: reportType === 'wp-security' ? 'wp-security'
            : reportType === 'compliance-status' ? 'compliance'
            : 'executive-summary',
        report: selectedReport,
        session: selectedSession,
        clientName: client?.name ?? (clientScope !== 'all' ? pickerClients.find(c => c.id === clientScope)?.name : undefined),
        clientLogo: selectedReport?.clientLogo ?? client?.logo,
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      setDownloadError(err instanceof Error ? err.message : 'PDF generation failed');
    } finally {
      setDownloading(false);
    }
  }

  // Can we download with the currently selected data?
  const canDownload =
    (reportType === 'wp-security'       && !!selectedReport) ||
    (reportType === 'compliance-status' && !!selectedSession) ||
    (reportType === 'executive-summary' && (!!selectedReport || !!selectedSession));

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text-primary)',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-8">
        <span className="mono-tag mb-3 block">reports</span>
        <div className="grid grid-cols-3 gap-6">

          {/* Left panel — controls */}
          <div className="space-y-5">
            {/* Client scope — filters everything below */}
            <div className="card-elevated p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                Client
              </h3>
              <select
                style={selectStyle}
                value={clientScope}
                onChange={e => {
                  setClientScope(e.target.value);
                  setSelectedReportId(null);
                  setSelectedSessionId(null);
                }}
              >
                <option value="all">All clients</option>
                {pickerClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                Scopes the scan + gap analysis dropdowns below to this client's records.
              </p>
            </div>

            {/* Report type */}
            <div className="card-elevated p-5">
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
                Report type
              </h3>
              <div className="space-y-2">
                {REPORT_TYPES.map(rt => (
                  <button
                    key={rt.id}
                    onClick={() => setReportType(rt.id)}
                    className="w-full text-left p-3 rounded-xl transition-all"
                    style={{
                      background: reportType === rt.id ? 'var(--color-mint-subtle)' : 'var(--color-surface-alt)',
                      border: `1px solid ${reportType === rt.id ? 'rgba(0,122,94,0.45)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span style={{ fontSize: '16px' }}>{rt.icon}</span>
                      <div>
                        {/* Pale-mint background is constant across themes, so we always
                            use the darker accent ink (#007A5E) + navy description for WCAG AA. */}
                        <div style={{ fontSize: '12px', fontWeight: 700, color: reportType === rt.id ? '#007A5E' : 'var(--color-text-primary)', marginBottom: 2 }}>
                          {rt.label}
                        </div>
                        <div style={{ fontSize: '11px', color: reportType === rt.id ? '#1A2332' : 'var(--color-text-muted)', lineHeight: 1.3 }}>
                          {rt.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data source selectors */}
            {(reportType === 'wp-security' || reportType === 'executive-summary') && (
              <div className="card-elevated p-5">
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  WP scan
                </h3>
                {sortedReports.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                    // No scans yet
                  </p>
                ) : (
                  <select
                    style={selectStyle}
                    value={selectedReport?.id ?? ''}
                    onChange={e => setSelectedReportId(e.target.value)}
                  >
                    {sortedReports.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.domain} · {r.score}/100 · {new Date(r.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {(reportType === 'compliance-status' || reportType === 'executive-summary') && (
              <div className="card-elevated p-5">
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Gap analysis
                </h3>
                {sortedSessions.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                    // No gap analysis yet
                  </p>
                ) : (
                  <select
                    style={selectStyle}
                    value={selectedSession?.id ?? ''}
                    onChange={e => setSelectedSessionId(e.target.value)}
                  >
                    {sortedSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Download PDF — generates via @react-pdf/renderer (lazy-loaded).
                Disabled when the underlying data isn't ready (no scan / no
                gap analysis) so we never produce an empty document. */}
            <button
              onClick={handleDownloadPdf}
              disabled={!canDownload || downloading}
              title={
                downloadError ?? (
                  !canDownload ? 'Select data in the dropdowns above to enable export' :
                  'Download a branded PDF of this report'
                )
              }
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: canDownload ? '#00D9A3' : 'var(--color-surface-alt)', color: canDownload ? '#1A2332' : 'var(--color-text-muted)', border: canDownload ? 'none' : '1px dashed var(--color-border)' }}
              onMouseEnter={e => { if (canDownload && !downloading) (e.currentTarget as HTMLElement).style.background = '#00B589'; }}
              onMouseLeave={e => { if (canDownload && !downloading) (e.currentTarget as HTMLElement).style.background = '#00D9A3'; }}
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </button>
            {downloadError && (
              <p style={{ fontSize: '11px', color: 'var(--color-status-red, #DC2626)', marginTop: 6 }}>
                {downloadError}
              </p>
            )}
          </div>

          {/* Right panel — preview */}
          <div className="col-span-2">
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Preview
                </h3>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    color: '#007A5E',
                    background: 'var(--color-mint-subtle)',
                    borderRadius: '3px',
                    padding: '1px 6px',
                  }}
                >
                  post_report
                </span>
              </div>

              {reportType === 'wp-security' && (
                selectedReport
                  ? <WpSecurityPreview report={selectedReport} clientName={clientNameFor(selectedReport.clientId)} />
                  : <EmptyPreview message={clientScope === 'all' ? 'Run a WordPress scan first to generate this report' : 'No scans for this client yet'} />
              )}
              {reportType === 'compliance-status' && (
                selectedSession
                  ? <CompliancePreview session={selectedSession} />
                  : <EmptyPreview message="Complete a gap analysis first to generate this report" />
              )}
              {reportType === 'executive-summary' && (
                <ExecutiveSummaryPreview report={selectedReport} session={selectedSession} />
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function EmptyPreview({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <FileText className="w-12 h-12 opacity-20" style={{ color: 'var(--color-text-muted)' }} />
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', textAlign: 'center' }}>
        // {message}
      </p>
    </div>
  );
}
