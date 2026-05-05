import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, RefreshCw, ArrowLeft, Loader2, Sparkles, Wrench, FileText } from 'lucide-react';
import type { AuditCheck, AuditReport, CheckStatus, SeverityLevel, AiSettings } from '../../data/auditTypes';
import { CATEGORY_ORDER } from '../../utils/audit/scanEngine';
import { getExplainer } from '../../data/checkExplainers';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Client } from '../../data/types';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { explainFindingPrompt, remediationSnippetPrompt, actionPlanPrompt } from '../../utils/ai/prompts';
import Gauge from '../charts/Gauge';

// AiPanel is heavyweight (modal + fetch glue); lazy-loaded so it only enters
// the chunk graph when the user actually opens it.
const AiPanel = lazy(() => import('../common/AiPanel'));

interface ScanReportProps {
  report: AuditReport;
  onRescan: () => void;
  onBack: () => void;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEV_ORDER: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Info', 'Pass'];

const sevColor: Record<SeverityLevel, string> = {
  Critical: 'var(--color-status-red)',
  High:     'var(--color-accent-danger)',
  Medium:   'var(--color-status-amber)',
  Low:      'var(--color-status-blue)',
  Info:     'var(--color-text-muted)',
  Pass:     'var(--color-status-green)',
};

function SeverityBadge({ level }: { level: SeverityLevel }) {
  const color = sevColor[level];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide font-mono flex-shrink-0"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {level}
    </span>
  );
}

const statusColor: Record<CheckStatus, string> = {
  pass:    'var(--color-status-green)',
  fail:    'var(--color-status-red)',
  warning: 'var(--color-status-amber)',
  info:    'var(--color-status-blue)',
  skipped: 'var(--color-text-muted)',
  error:   'var(--color-accent-danger)',
};

// ─── Finding row ──────────────────────────────────────────────────────────────

// Heuristic for whether "Generate fix" is likely to produce a useful snippet.
// We only enable it on findings whose category is plausibly fixable via a
// config snippet (.htaccess, wp-config, headers, etc). For "DNS & Email
// Security" or "Dark Web & Reputation" the answer is usually a third-party
// action, not a code paste — disable the button to avoid hallucinated fixes.
const FIXABLE_CATEGORIES: Set<AuditCheck['category']> = new Set([
  'Security Headers',
  'TLS / SSL',
  'Information Disclosure',
  'Authentication',
  'File Exposure',
  'Configuration',
]);

function FindingRow({ check, client, ai }: { check: AuditCheck; client?: Client; ai: AiSettings }) {
  const [expanded, setExpanded] = useState(false);
  // Discriminated union of which AI panel (if any) is open for this row.
  const [aiOpen, setAiOpen] = useState<null | 'explain' | 'fix'>(null);
  const result = check.result!;
  const isActionable = result.status === 'fail' || result.status === 'warning';
  const color = statusColor[result.status];
  const explainer = getExplainer(check.id);
  const canFix = FIXABLE_CATEGORIES.has(check.category);
  const aiEnabled = !!ai.model?.trim();

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid var(--color-border)` }}
    >
      <button
        onClick={() => isActionable && setExpanded(e => !e)}
        className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${isActionable ? 'hover:bg-surface-alt cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{check.name}</span>
              {(result.status === 'fail' || result.status === 'warning') && (
                <SeverityBadge level={check.worstCaseSeverity} />
              )}
              {result.status === 'pass' && (
                <span className="text-[10px] font-semibold text-status-green font-mono">PASS</span>
              )}
              {result.status === 'skipped' && (
                <span className="text-[10px] text-text-muted font-mono">SKIPPED</span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5 leading-snug">{result.detail}</p>
          </div>
        </div>
        {isActionable && (
          <div className="flex-shrink-0 mt-0.5 text-text-muted">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        )}
      </button>

      {expanded && isActionable && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="p-4 space-y-3" style={{ background: 'var(--color-surface-alt)' }}>
            {explainer && (
              <div className="space-y-2 pb-3" style={{ borderBottom: '1px dashed var(--color-border)' }}>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">What this means</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Attacker's view</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{explainer.attackerNarrative}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Plain English</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{explainer.plainEnglish}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Why it matters</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{explainer.whyItMatters}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">What to do</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{explainer.whatToDo}</p>
                  </div>
                </div>
              </div>
            )}
            {result.evidence && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">Evidence</p>
                <pre className="text-xs text-text-secondary font-mono bg-surface rounded p-2 overflow-x-auto whitespace-pre-wrap" style={{ border: '1px solid var(--color-border)' }}>
                  {result.evidence}
                </pre>
              </div>
            )}
            {result.recommendation && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">Recommendation</p>
                <p className="text-xs text-text-secondary leading-relaxed">{result.recommendation}</p>
              </div>
            )}
            {/* AI assist row — only the two buttons whose context is sensible
                here. Buttons disable with a tooltip when no key is set. */}
            <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px dashed var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setAiOpen('explain')}
                disabled={!aiEnabled}
                title={aiEnabled ? 'Draft a client-facing explanation locally' : 'Pick a model in Settings → Local AI to enable'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--color-accent-soft, rgba(0,217,163,0.12))',
                  color: 'var(--color-text-accent, #007A5E)',
                  border: '1px solid rgba(0,217,163,0.35)',
                }}
              >
                <Sparkles className="w-3 h-3" />
                Explain to my client
              </button>
              {canFix && (
                <button
                  type="button"
                  onClick={() => setAiOpen('fix')}
                  disabled={!aiEnabled}
                  title={aiEnabled ? 'Generate a config-snippet fix locally' : 'Pick a model in Settings → Local AI to enable'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(124,58,237,0.10)',
                    color: '#7C3AED',
                    border: '1px solid rgba(124,58,237,0.30)',
                  }}
                >
                  <Wrench className="w-3 h-3" />
                  Generate fix
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {aiOpen === 'explain' && ai.model && (
        <Suspense fallback={null}>
          <AiPanel
            title="Explain to my client"
            subtitle={check.name}
            model={ai.model}
            baseUrl={ai.baseUrl}
            prompt={explainFindingPrompt(check, { client })}
            maxTokens={800}
            outputKind="prose"
            onClose={() => setAiOpen(null)}
          />
        </Suspense>
      )}
      {aiOpen === 'fix' && ai.model && (
        <Suspense fallback={null}>
          <AiPanel
            title="Generate fix"
            subtitle={check.name}
            model={ai.model}
            baseUrl={ai.baseUrl}
            prompt={remediationSnippetPrompt(check, { client })}
            maxTokens={1500}
            temperature={0.2}
            outputKind="code"
            onClose={() => setAiOpen(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ category, checks, client, ai }: { category: string; checks: AuditCheck[]; client?: Client; ai: AiSettings }) {
  const [collapsed, setCollapsed] = useState(false);
  const failCount = checks.filter(c => c.result?.status === 'fail').length;
  const warnCount = checks.filter(c => c.result?.status === 'warning').length;
  const passCount = checks.filter(c => c.result?.status === 'pass').length;

  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-alt transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        <span className="font-semibold text-text-primary flex-1">{category}</span>
        <div className="flex items-center gap-2 text-xs font-mono">
          {failCount > 0 && <span style={{ color: 'var(--color-status-red)' }}>{failCount} fail</span>}
          {warnCount > 0 && <span style={{ color: 'var(--color-status-amber)' }}>{warnCount} warn</span>}
          {passCount > 0 && <span style={{ color: 'var(--color-status-green)' }}>{passCount} pass</span>}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {/* Failures first, then warnings, then passes, then skipped */}
          {['fail', 'warning', 'pass', 'info', 'skipped', 'error'].flatMap(status =>
            checks
              .filter(c => c.result?.status === status)
              .map(c => <FindingRow key={c.id} check={c} client={client} ai={ai} />)
          )}
          {checks.filter(c => !c.result).map(c => (
            <FindingRow key={c.id} check={{ ...c, result: { status: 'info', detail: 'Check did not run.' } }} client={client} ai={ai} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main report ──────────────────────────────────────────────────────────────

export default function ScanReport({ report, onRescan, onBack }: ScanReportProps) {
  const completedAt = report.completedAt ? new Date(report.completedAt) : new Date();
  const [clients] = useLocalStorage<Client[]>('clients', []);
  // V2.1 (Sprint 8b): local Ollama drives the AI assist buttons in FindingRow.
  const [ai] = useLocalStorage<AiSettings>('ai-settings', {});
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Top-level AI panel for the cross-finding action plan. Kept separate from
  // FindingRow's per-finding `aiOpen` so the two never compete for the modal
  // surface — opening one closes whatever's already open.
  const [planAiOpen, setPlanAiOpen] = useState(false);
  const aiEnabled = !!ai.model?.trim();

  // Resolve the full client record (used by AI prompts for industry context)
  // plus the display name for the PDF cover.
  const client = (() => {
    const id = report.clientId ?? UNASSIGNED_CLIENT_ID;
    if (id === UNASSIGNED_CLIENT_ID) return undefined;
    const safe = Array.isArray(clients) ? clients : [];
    return safe.find(c => c.id === id);
  })();
  const clientName = client?.name ?? 'Unassigned';

  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // Dynamic import — keeps @react-pdf/renderer (~500 kB) out of the
      // main scan-hub chunk. First click triggers a one-off fetch, then
      // subsequent downloads are instant.
      const { downloadReportPdf } = await import('../../pdf/generate');
      await downloadReportPdf({ kind: 'wp-security', report, clientName });
    } catch (err) {
      console.error('PDF generation failed', err);
      setDownloadError(err instanceof Error ? err.message : 'PDF generation failed');
    } finally {
      setDownloading(false);
    }
  }
  const duration = report.completedAt
    ? Math.round((new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime()) / 1000)
    : 0;

  // Finding counts by severity (fails and warnings only)
  const counts = SEV_ORDER.slice(0, 4).reduce<Record<string, number>>((acc, sev) => {
    acc[sev] = report.checks.filter(
      c => c.worstCaseSeverity === sev && (c.result?.status === 'fail' || c.result?.status === 'warning')
    ).length;
    return acc;
  }, {});

  const totalIssues = Object.values(counts).reduce((a, b) => a + b, 0);

  // Group checks by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    checks: report.checks.filter(c => c.category === cat),
  })).filter(g => g.checks.length > 0);

  const passCount = report.checks.filter(c => c.result?.status === 'pass').length;
  const tone = report.score >= 50 ? 'good' : 'bad';

  return (
    <div className="page">
      {/* Back nav */}
      <div style={{ marginBottom: -8 }}>
        <button
          onClick={onBack}
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          New scan
        </button>
      </div>

      {/* Hero */}
      <section className="hero" style={{ gridTemplateColumns: '1.2fr 1fr', padding: '24px 28px' }}>
        <div className="hero-l">
          <span className="kicker">post_scan · external audit</span>
          <h1 className="h-condensed" style={{ fontSize: 46, marginTop: 6, wordBreak: 'break-word' }}>
            {report.clientLogo && (
              <img
                src={report.clientLogo}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain', verticalAlign: 'middle', marginRight: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-bd)' }}
              />
            )}
            {report.domain}
          </h1>
          <p className="sub">
            External, unauthenticated attack-surface audit. {report.checks.filter(c => c.result && c.result.status !== 'skipped').length} of {report.checks.length} checks completed
            {duration > 0 && ` · ${duration}s`}
            {' · '}
            {completedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
          </p>
          <div className="hero-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            <div className="hero-stat">
              <div className="l">Critical</div>
              <div className="v" style={{ color: 'var(--ember)' }}>{counts.Critical ?? 0}</div>
            </div>
            <div className="hero-stat">
              <div className="l">High</div>
              <div className="v" style={{ color: 'var(--ember-2)' }}>{counts.High ?? 0}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Medium</div>
              <div className="v" style={{ color: 'var(--violet)' }}>{counts.Medium ?? 0}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Pass</div>
              <div className="v" style={{ color: 'var(--mint)' }}>{passCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onRescan}>
              <RefreshCw className="w-4 h-4" /> Re-run scan
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPlanAiOpen(true)}
              disabled={!aiEnabled}
              title={aiEnabled
                ? 'Generate a 1-week / 1-month / 1-quarter remediation plan locally'
                : 'Pick a model in Settings → Local AI to enable'}
              style={!aiEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              <Sparkles className="w-4 h-4" style={{ color: aiEnabled ? 'var(--mint)' : undefined }} />
              Action plan
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleDownloadPdf}
              disabled={downloading}
              title={downloadError ?? 'Generate a branded PDF of this scan report'}
              style={downloading ? { opacity: 0.6, cursor: 'wait' } : undefined}
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {downloading ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </div>
        <div className="gauge-wrap">
          <div className="gauge" style={{ width: 240, height: 240 }}>
            <Gauge score={report.score} tone={tone} />
            <div className="gauge-center">
              <div className="lbl">scan score</div>
              <div className="score">{report.score}<sub>/100</sub></div>
              <div className="delta-pill">
                {report.score >= 90 ? '▲ excellent' : report.score >= 70 ? '▲ good' : report.score >= 40 ? '— needs work' : '▼ critical'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {totalIssues === 0 && (
        <div className="bubble" style={{ padding: 18, color: 'var(--mint)', fontWeight: 600, fontSize: 14, textAlign: 'center' }}>
          ✓ No issues found across {passCount + (counts.Critical ?? 0) + (counts.High ?? 0) + (counts.Medium ?? 0)} completed checks.
        </div>
      )}

      {/* Findings by category */}
      <div className="space-y-4">
        {grouped.map(({ category, checks }) => (
          <CategorySection key={category} category={category} checks={checks} client={client} ai={ai} />
        ))}
      </div>

      {/* Cross-finding action plan modal — opened from the toolbar button. */}
      {planAiOpen && ai.model && (
        <Suspense fallback={null}>
          <AiPanel
            title="Prioritised action plan"
            subtitle={`${report.domain} · ${totalIssues} finding${totalIssues === 1 ? '' : 's'}`}
            model={ai.model}
            baseUrl={ai.baseUrl}
            prompt={actionPlanPrompt(report, { client })}
            // Bigger token budget — 1-week/1-month/1-quarter plan with rationale
            // can run 400–500 words. Give the model headroom.
            maxTokens={1600}
            outputKind="prose"
            onClose={() => setPlanAiOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
