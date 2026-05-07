import { useMemo, useState, useEffect } from 'react';
import { ScanSearch, BarChart3, AlertTriangle, FileText, ArrowRight, Zap, X, Sparkles } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { AuditReport } from '../../data/auditTypes';
import type { GapAnalysisSession } from '../../data/types';
import Gauge from '../charts/Gauge';
import Trend from '../charts/Trend';
import type { TrendPoint } from '../charts/Trend';
import Donut from '../charts/Donut';
import type { DonutSegment } from '../charts/Donut';

interface DashboardProps {
  onNavigate: (section: import('../../data/types').AppSection) => void;
  /** Deep-link to a specific saved scan report inside post_scan. */
  onOpenReport: (reportId: string) => void;
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Dashboard({ onNavigate, onOpenReport }: DashboardProps) {
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  const metrics = useMemo(() => {
    const allReports: AuditReport[] = Array.isArray(savedReports) ? savedReports : [];
    const allSessions: GapAnalysisSession[] = Array.isArray(gapSessions) ? gapSessions : [];

    const sortedReports = [...allReports].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const latestReport = sortedReports[0];
    const postureScore = latestReport?.score ?? null;

    const alertCount = latestReport
      ? latestReport.checks.filter(
          c => c.result?.status === 'fail' && (c.worstCaseSeverity === 'Critical' || c.worstCaseSeverity === 'High')
        ).length
      : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const scansThisMonth = allReports.filter(r => new Date(r.startedAt) >= monthStart).length;

    let compliant = 0, partial = 0, nonCompliant = 0, notAssessed = 0;
    for (const session of allSessions) {
      for (const item of session.items) {
        if (item.status === 'Compliant') compliant++;
        else if (item.status === 'Partially Compliant') partial++;
        else if (item.status === 'Non-Compliant') nonCompliant++;
        else notAssessed++;
      }
    }
    const totalAssessed = compliant + partial + nonCompliant + notAssessed;
    const compliancePct = totalAssessed > 0 ? Math.round((compliant / totalAssessed) * 100) : null;

    const trendData: TrendPoint[] = sortedReports.slice(0, 10).reverse().map(r => ({
      date: new Date(r.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: r.score,
    }));

    const recentScans = sortedReports.slice(0, 4);

    // Unique domains across all reports
    const uniqueDomains = new Set(allReports.map(r => r.domain)).size;

    return {
      postureScore,
      alertCount,
      scansThisMonth,
      compliancePct,
      compliant,
      partial,
      nonCompliant,
      notAssessed,
      totalAssessed,
      trendData,
      recentScans,
      totalScans: allReports.length,
      uniqueDomains,
    };
  }, [savedReports, gapSessions]);

  const complianceSegments: DonutSegment[] = [
    { label: 'Compliant',     value: metrics.compliant,    color: '#00D9A3' },
    { label: 'Partial',       value: metrics.partial,      color: '#8B5CF6' },
    { label: 'Non-Compliant', value: metrics.nonCompliant, color: '#FF4A1C' },
    { label: 'Not Assessed',  value: metrics.notAssessed,  color: '#9CA3AF' },
  ].filter(s => s.value > 0);

  const scoreTone = (metrics.postureScore ?? 0) >= 50 ? 'good' : 'bad';
  const scoreDelta = metrics.trendData.length >= 2
    ? metrics.trendData[metrics.trendData.length - 1].score - metrics.trendData[metrics.trendData.length - 2].score
    : null;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker">post_status · live posture</span>
          <h1 className="h-condensed title">
            Always watching<span className="u">_</span><br />always ready.
          </h1>
          <p className="sub">
            {metrics.uniqueDomains > 0
              ? `Unified ISO 27001 compliance and external WordPress security across ${metrics.uniqueDomains} client site${metrics.uniqueDomains !== 1 ? 's' : ''}. Last sync ${metrics.recentScans.length > 0 ? formatTimeAgo(new Date(metrics.recentScans[0].startedAt)) : 'never'}.`
              : 'Unified ISO 27001 compliance and external WordPress security. Run your first scan to begin.'}
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">Clients</div>
              <div className="v">{metrics.uniqueDomains || '—'}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Scans / mo</div>
              <div className="v">{metrics.scansThisMonth || '—'}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Open risks</div>
              <div className="v">{metrics.alertCount} <small>/ {metrics.totalScans}</small></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn btn-primary" onClick={() => onNavigate('post_scan')}>
              <ScanSearch className="w-4 h-4" /> Run new scan
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('post_report')}>
              <FileText className="w-4 h-4" /> Generate report
            </button>
          </div>
        </div>
        <div className="gauge-wrap">
          <div className="gauge">
            <Gauge score={metrics.postureScore ?? 0} tone={scoreTone} />
            <div className="gauge-center">
              <div className="lbl">posture score</div>
              <div className="score">{metrics.postureScore ?? '—'}<sub>/100</sub></div>
              {scoreDelta !== null && (
                <div className="delta-pill">
                  {scoreDelta >= 0 ? '▲' : '▼'} {scoreDelta >= 0 ? '+' : ''}{scoreDelta} this week
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* First-launch welcome — shown when there's truly no data yet. Swaps
          out the metric strip (which would otherwise read "0 / 0 / — / 0"
          and look broken). Once any data lands, the strip takes over. */}
      {metrics.totalScans === 0 && metrics.totalAssessed === 0 ? (
        <section
          className="bubble"
          style={{
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: 18,
              display: 'grid', placeItems: 'center',
              background: 'color-mix(in oklab, var(--mint) 15%, transparent)',
              border: '1px solid color-mix(in oklab, var(--mint) 30%, transparent)',
              flexShrink: 0,
            }}
          >
            <ScanSearch className="w-7 h-7" style={{ color: 'var(--mint)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="kicker">welcome</span>
            <h3 style={{ margin: '6px 0 4px', fontFamily: 'var(--font-redesign-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
              Three steps to a first report
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--mint)' }}>1.</strong> Add a client →{' '}
              <strong style={{ color: 'var(--mint)' }}>2.</strong> Run a WordPress scan →{' '}
              <strong style={{ color: 'var(--mint)' }}>3.</strong> Generate a branded PDF.
              Compliance gap-analysis sits alongside whenever you're ready.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('post_clients')}>
              Add client
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onNavigate('post_scan')}>
              <ScanSearch className="w-4 h-4" /> First scan
            </button>
          </div>
        </section>
      ) : (
        <section className="metric-strip">
          <div className="metric mint">
            <span className="k">WP scans · all time</span>
            <div className="v">{metrics.totalScans}</div>
            <div className="s">{metrics.scansThisMonth} this month</div>
            <div className="blob" />
          </div>
          <div className="metric violet">
            <span className="k">Compliance</span>
            <div className="v">{metrics.compliancePct !== null ? <>{metrics.compliancePct}<small>%</small></> : '—'}</div>
            <div className="s">{metrics.totalAssessed > 0 ? `${metrics.compliant} of ${metrics.totalAssessed} controls` : 'Start a gap analysis'}</div>
            <div className="blob" />
          </div>
          <div className="metric ember">
            <span className="k">Active alerts</span>
            <div className="v">{metrics.alertCount}</div>
            <div className="s">{metrics.alertCount > 0 ? 'Critical & high findings' : 'All clear'}</div>
            <div className="blob" />
          </div>
          <div className="metric navy">
            <span className="k">Unique domains</span>
            <div className="v">{metrics.uniqueDomains}</div>
            <div className="s">Monitored sites</div>
            <div className="blob" />
          </div>
        </section>
      )}

      {/* Two-up: trend + breakdown */}
      <section className="row-2">
        <div className="bubble">
          <div className="card-head">
            <div>
              <span className="kicker">post_scan</span>
              <h3>Posture trend</h3>
              <div className="desc">Aggregate score across all client sites · last {metrics.trendData.length} scans</div>
            </div>
            <span className="tag-mod">post_scan</span>
          </div>
          <div className="trend">
            <Trend data={metrics.trendData} />
          </div>
        </div>
        <div className="bubble">
          <div className="card-head">
            <div>
              <span className="kicker violet">post_comply</span>
              <h3>Compliance breakdown</h3>
              <div className="desc">Gap analysis · {metrics.totalAssessed} controls assessed</div>
            </div>
            <span className="tag-mod" style={{ background: 'rgba(139,92,246,0.16)', color: 'var(--violet)', border: '1px solid rgba(139,92,246,0.3)' }}>post_comply</span>
          </div>
          <div className="donut-wrap">
            {complianceSegments.length > 0 ? (
              <>
                <div style={{ position: 'relative' }}>
                  <Donut segments={complianceSegments} />
                  <div className="center">
                    <div className="n">{metrics.compliancePct}%</div>
                    <div className="l">compliant</div>
                  </div>
                </div>
                <div className="legend">
                  {complianceSegments.map(s => (
                    <div className="legend-row" key={s.label}>
                      <span className="sw" style={{ background: s.color }} />
                      <span>{s.label}</span>
                      <span className="n">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                <BarChart3 style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 11 }}>// No gap analysis data</div>
                <button
                  onClick={() => onNavigate('post_comply')}
                  style={{ color: 'var(--mint)', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
                >
                  Start a gap analysis →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent scans + Quick actions */}
      <section className="row-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="bubble">
          <div className="card-head">
            <div>
              <span className="kicker">post_scan · recent</span>
              <h3>Recent scans</h3>
            </div>
            {metrics.recentScans.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onNavigate('post_scan')}>
                View all <ArrowRight className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle' }} />
              </button>
            )}
          </div>
          {metrics.recentScans.length > 0 ? (
            <div className="scan-list">
              {metrics.recentScans.map(r => {
                const critCount = r.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'Critical').length;
                const highCount = r.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'High').length;
                const checkCount = r.checks.filter(c => c.result).length;
                const tone = r.score >= 80 ? 'good' : r.score >= 50 ? 'warn' : 'bad';
                const ts = new Date(r.completedAt ?? r.startedAt);

                return (
                  <button
                    type="button"
                    className="scan-row"
                    key={r.id}
                    onClick={() => onOpenReport(r.id)}
                    aria-label={`View scan for ${r.domain}, score ${r.score} out of 100`}
                  >
                    <div className={`scan-score ${tone}`} aria-hidden>{r.score}</div>
                    <div>
                      <div className="scan-domain">{r.domain}</div>
                      <div className="scan-meta">{checkCount} checks · WP scan</div>
                    </div>
                    <div className="scan-issues">
                      {critCount > 0 && <span className="pill ember"><span className="dot" style={{ background: 'var(--ember)' }} />{critCount} critical</span>}
                      {highCount > 0 && <span className="pill violet"><span className="dot" style={{ background: 'var(--violet)' }} />{highCount} high</span>}
                      {critCount === 0 && highCount === 0 && <span className="pill mint"><span className="dot" style={{ background: 'var(--mint)' }} />clean</span>}
                    </div>
                    <div className="scan-time">{formatTimeAgo(ts)}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
              <ScanSearch style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 8px' }} />
              <div style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 11 }}>// No scans yet</div>
              <button
                onClick={() => onNavigate('post_scan')}
                style={{ color: 'var(--mint)', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}
              >
                Run your first WordPress scan →
              </button>
            </div>
          )}
        </div>

        <div className="bubble">
          <div className="card-head">
            <div>
              <span className="kicker">quick actions</span>
              <h3>Get going</h3>
            </div>
          </div>
          <div className="qa-list">
            <button type="button" className="qa primary" onClick={() => onNavigate('post_scan')}>
              <ScanSearch className="w-4 h-4" /> Run new scan
            </button>
            <button type="button" className="qa" onClick={() => onNavigate('post_comply')}>
              <BarChart3 className="w-4 h-4" /> New gap analysis
            </button>
            <button type="button" className="qa" onClick={() => onNavigate('post_risk')}>
              <AlertTriangle className="w-4 h-4" /> Add risk
            </button>
            <button type="button" className="qa" onClick={() => onNavigate('post_report')}>
              <FileText className="w-4 h-4" /> Generate report
            </button>
            <hr className="divider" style={{ margin: '6px 4px' }} />
            <button type="button" className="qa" onClick={() => setRoadmapOpen(true)}>
              <Zap className="w-4 h-4" /> V2.1 AI roadmap
            </button>
          </div>
        </div>
      </section>

      {roadmapOpen && <RoadmapModal onClose={() => setRoadmapOpen(false)} />}
    </div>
  );
}

// ─── V2.1 AI roadmap modal ────────────────────────────────────────────────────

const ROADMAP_ITEMS: { title: string; description: string }[] = [
  { title: 'Plain-English finding explainer', description: 'Every scan finding translated into attacker-narrative prose for non-technical clients.' },
  { title: 'Priority action plans', description: 'Claude-generated, client-ready remediation roadmaps sorted by impact and effort.' },
  { title: 'Compliance gap narratives', description: 'Turn raw gap-analysis percentages into clear stories the board will actually read.' },
  { title: 'Automated report writing', description: 'Full-length executive and technical reports generated from your scan + risk data.' },
  { title: 'Security posture coach', description: 'Conversational Q&A over your clients\' combined scan, risk and audit history.' },
  { title: 'Attacker reconnaissance framing', description: 'Each WordPress finding reframed as "what an attacker would do next".' },
  { title: 'Risk register intelligence', description: 'AI-assisted risk scoring, treatment suggestions and appetite alignment.' },
  { title: 'Client-branded outputs', description: 'Per-client logo, tone and formatting applied automatically to every export.' },
];

function RoadmapModal({ onClose }: { onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-modal-title"
        className="rounded-2xl overflow-hidden max-w-2xl w-full"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--mint)' }} />
              <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 10, color: 'var(--mint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                V2.1 roadmap
              </span>
            </div>
            <h2 id="roadmap-modal-title" style={{ fontFamily: 'var(--font-redesign)', fontWeight: 700, fontSize: 20, color: 'var(--ink-1)' }}>
              AI-powered security intelligence
            </h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              What's landing in the next release, all powered by Claude.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: 'var(--ink-3)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ROADMAP_ITEMS.map((item, i) => (
            <div
              key={i}
              style={{ padding: 16, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-bd)' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-1)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
