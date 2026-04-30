import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ScanSearch, BarChart3, AlertTriangle, FileText, X, Sparkles } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { AuditReport } from '../../data/auditTypes';
import type { GapAnalysisSession } from '../../data/types';
import MetricCard from './MetricCard';
import TrendChart from './TrendChart';
import ComplianceRing from './ComplianceRing';

interface DashboardProps {
  onNavigate: (section: import('../../data/types').AppSection) => void;
}

// ─── Mini score circle ─────────────────────────────────────────────────────────

function MiniScore({ score }: { score: number }) {
  const color =
    score >= 90 ? '#059669'
    : score >= 70 ? '#0284C7'
    : score >= 40 ? '#D97706'
    : '#DC2626';

  return (
    <div
      className="flex items-center justify-center rounded-full font-bold"
      style={{
        width: 44,
        height: 44,
        background: `${color}18`,
        border: `2px solid ${color}40`,
        color,
        fontSize: '14px',
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}

// ─── Recent scan mini-card ─────────────────────────────────────────────────────

function RecentScanCard({ report, onClick }: { report: AuditReport; onClick: () => void }) {
  const critCount = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'Critical').length;
  const highCount = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'High').length;
  const ts = new Date(report.completedAt ?? report.startedAt);
  const timeAgo = formatTimeAgo(ts);

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
      whileHover={{ scale: 1.005 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
    >
      <MiniScore score={report.score} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
          {report.domain}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {critCount > 0 && (
            <span style={{ fontSize: '11px', color: '#DC2626', fontFamily: '"JetBrains Mono", monospace' }}>
              {critCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span style={{ fontSize: '11px', color: '#D97706', fontFamily: '"JetBrains Mono", monospace' }}>
              {highCount} high
            </span>
          )}
          {critCount === 0 && highCount === 0 && (
            <span style={{ fontSize: '11px', color: '#00D9A3', fontFamily: '"JetBrains Mono", monospace' }}>
              no critical issues
            </span>
          )}
        </div>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{timeAgo}</span>
    </motion.button>
  );
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

// ─── Quick action button ───────────────────────────────────────────────────────

function QuickAction({ label, icon: Icon, primary, onClick }: { label: string; icon: React.ElementType; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
      style={
        primary
          ? { background: '#00D9A3', color: '#1A2332', border: 'none' }
          : { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }
      }
      onMouseEnter={e => {
        if (primary) {
          (e.currentTarget as HTMLElement).style.background = '#00B589';
        } else {
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (primary) {
          (e.currentTarget as HTMLElement).style.background = '#00D9A3';
        } else {
          (e.currentTarget as HTMLElement).style.boxShadow = '';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
        }
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  // Derived metrics
  const metrics = useMemo(() => {
    const allReports: AuditReport[] = Array.isArray(savedReports) ? savedReports : [];
    const allSessions: GapAnalysisSession[] = Array.isArray(gapSessions) ? gapSessions : [];

    // Latest score (most recent scan)
    const sortedReports = [...allReports].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    const latestReport = sortedReports[0];
    const postureScore = latestReport?.score ?? null;

    // Alert count — critical + high fails from most recent scan
    const alertCount = latestReport
      ? latestReport.checks.filter(
          c => c.result?.status === 'fail' && (c.worstCaseSeverity === 'Critical' || c.worstCaseSeverity === 'High')
        ).length
      : 0;

    // WP scans this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const scansThisMonth = allReports.filter(r => new Date(r.startedAt) >= monthStart).length;

    // Compliance stats — aggregate across all gap sessions
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

    // Trend data — last 10 scans across all domains
    const trendData = sortedReports.slice(0, 10).reverse().map(r => ({
      date: new Date(r.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: r.score,
      domain: r.domain,
    }));

    // Recent scans — last 3
    const recentScans = sortedReports.slice(0, 3);

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
    };
  }, [savedReports, gapSessions]);

  const complianceSegments = [
    { label: 'Compliant',     value: metrics.compliant,    color: '#00D9A3' },
    { label: 'Partial',       value: metrics.partial,      color: '#8B5CF6' },
    { label: 'Non-Compliant', value: metrics.nonCompliant, color: '#FF4A1C' },
    { label: 'Not Assessed',  value: metrics.notAssessed,  color: '#D1D5DB' },
  ].filter(s => s.value > 0);

  return (
    <div className="p-8 space-y-6 overflow-auto h-full">

      {/* ── Row 1: Hero posture bar ── */}
      <motion.div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--gradient-hero)', position: 'relative' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="glass-card-navy p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="font-display font-black text-xl"
                style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}
              >
                Security posture
              </h2>
              <p style={{ fontSize: '12px', color: 'rgba(248,249,250,0.5)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
                // across all modules
              </p>
            </div>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px',
                color: '#00D9A3',
                background: 'rgba(0,217,163,0.15)',
                border: '1px solid rgba(0,217,163,0.25)',
                borderRadius: '4px',
                padding: '2px 8px',
              }}
            >
              post_status
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* Posture score */}
            <MetricCard
              label="Posture score"
              value={metrics.postureScore !== null ? `${metrics.postureScore}/100` : '—'}
              sublabel={metrics.postureScore !== null
                ? metrics.postureScore >= 90 ? 'Excellent'
                : metrics.postureScore >= 70 ? 'Good'
                : metrics.postureScore >= 40 ? 'Needs work'
                : 'Critical issues'
                : 'Run a scan to start'
              }
              accent={
                metrics.postureScore === null ? 'neutral'
                : metrics.postureScore >= 70 ? 'mint'
                : metrics.postureScore >= 40 ? 'neutral'
                : 'ember'
              }
              glass
              darkBg
            />

            {/* WP scans */}
            <MetricCard
              label="WP scans"
              value={metrics.totalScans}
              sublabel={metrics.scansThisMonth > 0 ? `${metrics.scansThisMonth} this month` : 'total scans'}
              accent="mint"
              glass
              darkBg
            />

            {/* Compliance */}
            <MetricCard
              label="Compliance"
              value={metrics.compliancePct !== null ? `${metrics.compliancePct}%` : '—'}
              sublabel={metrics.totalAssessed > 0
                ? `${metrics.compliant} of ${metrics.totalAssessed} items`
                : 'Start a gap analysis'
              }
              accent="violet"
              glass
              darkBg
            />

            {/* Alerts */}
            <MetricCard
              label="Active alerts"
              value={metrics.alertCount}
              sublabel={metrics.alertCount > 0 ? 'critical & high findings' : 'All clear'}
              accent={metrics.alertCount > 0 ? 'ember' : 'mint'}
              glass
              darkBg
            />
          </div>
        </div>
      </motion.div>

      {/* ── Row 2: Charts ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* WP Scan trend */}
        <motion.div
          className="card-elevated p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                WP scan score trend
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Last {metrics.trendData.length} scans
              </p>
            </div>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                color: 'var(--color-mint)',
                background: 'var(--color-mint-subtle)',
                borderRadius: '3px',
                padding: '1px 5px',
              }}
            >
              post_scan
            </span>
          </div>
          <TrendChart data={metrics.trendData} height={160} />
        </motion.div>

        {/* Compliance breakdown */}
        <motion.div
          className="card-elevated p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Compliance breakdown
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Gap analysis aggregate
              </p>
            </div>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                color: 'var(--color-violet)',
                background: 'var(--color-violet-subtle)',
                borderRadius: '3px',
                padding: '1px 5px',
              }}
            >
              post_comply
            </span>
          </div>
          <div className="flex justify-center">
            {complianceSegments.length > 0 ? (
              <ComplianceRing segments={complianceSegments} size={130} />
            ) : (
              <div
                className="flex flex-col items-center justify-center py-8 gap-3"
                style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}
              >
                <BarChart3 className="w-10 h-10 opacity-30" />
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>
                  // No gap analysis data
                </span>
                <button
                  onClick={() => onNavigate('post_comply')}
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-mint)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Start a gap analysis →
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Row 3: Recent scans + Quick actions ── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent scans — 2/3 width */}
        <motion.div
          className="card-elevated p-6 col-span-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Recent scans
            </h3>
            {metrics.recentScans.length > 0 && (
              <button
                onClick={() => onNavigate('post_scan')}
                className="text-xs"
                style={{ color: 'var(--color-mint)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View all →
              </button>
            )}
          </div>
          {metrics.recentScans.length > 0 ? (
            <div className="space-y-2">
              {metrics.recentScans.map(r => (
                <RecentScanCard
                  key={r.id}
                  report={r}
                  onClick={() => onNavigate('post_scan')}
                />
              ))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-10 gap-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ScanSearch className="w-10 h-10 opacity-30" />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>
                // No scans yet
              </span>
              <button
                onClick={() => onNavigate('post_scan')}
                className="text-xs font-medium"
                style={{ color: 'var(--color-mint)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Run your first WordPress scan →
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick actions — 1/3 width */}
        <motion.div
          className="card-elevated p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Quick actions
          </h3>
          <div className="space-y-2">
            <QuickAction
              label="Run new scan"
              icon={ScanSearch}
              primary
              onClick={() => onNavigate('post_scan')}
            />
            <QuickAction
              label="New gap analysis"
              icon={BarChart3}
              onClick={() => onNavigate('post_comply')}
            />
            <QuickAction
              label="Add risk"
              icon={AlertTriangle}
              onClick={() => onNavigate('post_risk')}
            />
            <QuickAction
              label="Generate report"
              icon={FileText}
              onClick={() => onNavigate('post_report')}
            />
          </div>
        </motion.div>
      </div>

      {/* ── V2.1 AI teaser ── */}
      <motion.div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--gradient-navy-mint)', position: 'relative' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="glass-card-navy p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    color: '#00D9A3',
                    background: 'rgba(0,217,163,0.15)',
                    border: '1px solid rgba(0,217,163,0.25)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Coming in V2.1
                </span>
              </div>
              <h3 className="font-display font-black text-base" style={{ color: '#F8F9FA', letterSpacing: '-0.01em' }}>
                AI-powered security intelligence
              </h3>
              <p style={{ fontSize: '12px', color: 'rgba(248,249,250,0.55)', marginTop: 4, maxWidth: 500 }}>
                Plain-English finding explainer, priority action plans, compliance gap narratives, automated report writing, and a security posture coach — all powered by Claude.
              </p>
            </div>
            <button
              onClick={() => setRoadmapOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(0,217,163,0.2)', color: '#00D9A3', border: '1px solid rgba(0,217,163,0.3)', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,163,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,217,163,0.2)'; }}
            >
              Learn more →
            </button>
          </div>
        </div>
      </motion.div>

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden max-w-2xl w-full"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                V2.1 roadmap
              </span>
            </div>
            <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text-primary)' }}>
              AI-powered security intelligence
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              What's landing in the next release, all powered by Claude.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-alt)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {ROADMAP_ITEMS.map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
            >
              <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {item.title}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
