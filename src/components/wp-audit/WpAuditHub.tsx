import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Key, ChevronDown, ChevronUp, Globe, Trash2, Clock, ExternalLink, Users } from 'lucide-react';
import type { AuditCheck, AuditReport, AuditApiKeys, CheckResult } from '../../data/auditTypes';
import { runScan, buildCheckCatalogue, normaliseUrl } from '../../utils/audit/scanEngine';
import { isTauri } from '../../utils/audit/fetchUtil';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Client } from '../../data/types';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import ScanProgress from './ScanProgress';
import ScanReport from './ScanReport';

type Phase = 'idle' | 'scanning' | 'report';

const MAX_SAVED = 20;

interface WpAuditHubProps {
  /** When set, WpAuditHub mounts straight into the matching report. */
  targetReportId?: string | null;
  /** Called once the target has been consumed so App can clear the state. */
  onTargetConsumed?: () => void;
}

export default function WpAuditHub({ targetReportId, onTargetConsumed }: WpAuditHubProps = {}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [scanError, setScanError] = useState('');
  const [liveChecks, setLiveChecks] = useState<AuditCheck[]>([]);
  const [completedReport, setCompletedReport] = useState<AuditReport | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);

  const [savedReports, setSavedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [apiKeys, setApiKeys] = useLocalStorage<AuditApiKeys>('wp-audit-api-keys', {});
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [scanClientId, setScanClientId] = useState<string>(UNASSIGNED_CLIENT_ID);

  // The scan's report is tagged with this client + a frozen snapshot of the
  // client's logo. Freezing the logo means historical reports keep their
  // branding even if the user later changes the client's logo.
  const clientsList: Client[] = useMemo(() => {
    const arr = Array.isArray(clients) ? clients : [];
    if (arr.some(c => c.id === UNASSIGNED_CLIENT_ID)) return arr;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...arr,
    ];
  }, [clients]);

  const abortRef = useRef<AbortController | null>(null);
  const tauriAvailable = isTauri();

  // ── URL validation ──────────────────────────────────────────────────────────

  function validateUrl(raw: string): string | null {
    const url = normaliseUrl(raw);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'URL must start with http:// or https://';
      if (!parsed.hostname.includes('.')) return 'Please enter a valid domain name.';
      return null;
    } catch {
      return 'Please enter a valid URL (e.g. https://example.com).';
    }
  }

  // ── Scan lifecycle ──────────────────────────────────────────────────────────

  const startScan = useCallback(async (rawUrl: string) => {
    const error = validateUrl(rawUrl);
    if (error) { setUrlError(error); return; }
    setUrlError('');
    setScanError('');

    const targetUrl = normaliseUrl(rawUrl);
    const checks = buildCheckCatalogue();
    setLiveChecks(checks);
    setPhase('scanning');

    const controller = new AbortController();
    abortRef.current = controller;

    const onCheckComplete = (checkId: string, result: CheckResult) => {
      setLiveChecks(prev => prev.map(c => c.id === checkId ? { ...c, result } : c));
    };

    try {
      const rawReport = await runScan(targetUrl, apiKeys, onCheckComplete, controller.signal);

      // Tag with the chosen client + snapshot their logo at this moment in time
      // so the report keeps its branding even if the client's logo changes later.
      const client = clientsList.find(c => c.id === scanClientId);
      const report: AuditReport = {
        ...rawReport,
        clientId: scanClientId,
        clientLogo: client?.logo,
      };

      // Save to history
      setSavedReports(prev => [report, ...prev.filter(r => r.id !== report.id)].slice(0, MAX_SAVED));
      setCompletedReport(report);
      setPhase('report');
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase('idle');
      } else {
        setScanError(`Scan failed: ${(e as Error).message}`);
        setPhase('idle');
      }
    }
  }, [apiKeys, setSavedReports, scanClientId, clientsList]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRescan = useCallback(() => {
    if (completedReport) {
      startScan(completedReport.targetUrl);
    }
  }, [completedReport, startScan]);

  const handleBack = useCallback(() => {
    setPhase('idle');
    setCompletedReport(null);
  }, []);

  const handleLoadReport = useCallback((report: AuditReport) => {
    setCompletedReport(report);
    setPhase('report');
  }, []);

  // Deep-link: when App passes a `targetReportId` (e.g. user clicked a recent
  // scan tile on the dashboard), jump straight into that report. We consume
  // the target on the way in so a subsequent "back" doesn't trap the user
  // re-opening the same report. Guarded by `phase` to skip if a scan is
  // already running — the in-flight scan takes precedence.
  useEffect(() => {
    if (!targetReportId) return;
    if (phase === 'scanning') return;
    const list = Array.isArray(savedReports) ? savedReports : [];
    const hit = list.find(r => r.id === targetReportId);
    if (hit) {
      setCompletedReport(hit);
      setPhase('report');
    }
    onTargetConsumed?.();
    // Intentionally only depends on the target id — savedReports churn
    // shouldn't re-open the same report after user navigates away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetReportId]);

  const handleDeleteReport = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedReports(prev => prev.filter(r => r.id !== id));
  }, [setSavedReports]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'scanning') {
    return <ScanProgress checks={liveChecks} onCancel={handleCancel} targetUrl={normaliseUrl(urlInput)} />;
  }

  if (phase === 'report' && completedReport) {
    return (
      <>
        <ScanReport report={completedReport} onRescan={handleRescan} onBack={handleBack} />
      </>
    );
  }

  // ── Idle / landing ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
          style={{ background: 'var(--gradient-accent)' }}
        >
          <ShieldAlert className="w-8 h-8 text-white" />
        </div>
        <span className="mono-tag mb-1">wp audit</span>
        <h2 className="font-display font-bold text-3xl text-text-primary">WP Security Audit</h2>
        <p className="text-text-muted max-w-md mx-auto">
          An external attacker-perspective scan of any WordPress site. No plugin access required — this is what a real threat actor sees.
        </p>
      </div>

      {/* Tauri banner (browser mode) */}
      {!tauriAvailable && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'color-mix(in srgb, var(--color-status-amber) 12%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-status-amber) 30%, var(--color-border))' }}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-status-amber)' }} />
          <div>
            <p className="font-medium" style={{ color: 'var(--color-status-amber)' }}>Browser mode — limited coverage</p>
            <p className="text-text-muted mt-0.5">
              DNS, TLS, and reputation checks run in any browser. Security header, WordPress core, file exposure, and configuration checks require the desktop app (bypasses CORS).
            </p>
          </div>
        </div>
      )}

      {/* URL Input card */}
      <div className="card-elevated p-6 space-y-4">
        <div>
          <label htmlFor="wp-url" className="block text-sm font-semibold text-text-primary mb-2">
            Target URL
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                id="wp-url"
                type="url"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
                onKeyDown={e => e.key === 'Enter' && startScan(urlInput)}
                placeholder="https://example.com"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-muted bg-surface-alt outline-none focus:ring-2 transition-all"
                style={{
                  border: urlError ? '1px solid var(--color-status-red)' : '1px solid var(--color-border)',
                  '--tw-ring-color': 'var(--color-accent)',
                } as React.CSSProperties}
                autoComplete="url"
                spellCheck={false}
              />
            </div>
            <button
              onClick={() => startScan(urlInput)}
              disabled={!urlInput.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              style={{ background: 'var(--gradient-accent)' }}
            >
              Scan
            </button>
          </div>
          {urlError && <p className="text-xs mt-1.5" style={{ color: 'var(--color-status-red)' }}>{urlError}</p>}
          {scanError && <p className="text-xs mt-1.5" style={{ color: 'var(--color-status-red)' }}>{scanError}</p>}
        </div>

        {/* Client tag — the scan is filed under this client in the Report Hub */}
        <div>
          <label htmlFor="wp-client" className="block text-sm font-semibold text-text-primary mb-2">
            Client
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <select
              id="wp-client"
              value={scanClientId}
              onChange={e => setScanClientId(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-text-primary bg-surface-alt outline-none focus:ring-2 transition-all appearance-none"
              style={{
                border: '1px solid var(--color-border)',
                '--tw-ring-color': 'var(--color-accent)',
              } as React.CSSProperties}
            >
              {clientsList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            The scan is tagged to this client. Their logo is frozen onto the report so reprints stay on-brand.
          </p>
        </div>

        {/* What we check */}
        <div className="flex flex-wrap gap-1.5">
          {['DNS & Email', 'TLS/SSL', 'Security Headers', 'WP Core', 'File Exposure', 'Reputation', 'Configuration'].map(tag => (
            <span
              key={tag}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md font-mono"
              style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* API Keys (optional) */}
      <div className="card-elevated overflow-hidden">
        <button
          onClick={() => setShowApiKeys(s => !s)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-alt transition-colors"
        >
          <Key className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary flex-1">API Keys (optional)</span>
          <span className="text-xs text-text-muted">
            {(apiKeys.googleSafeBrowsing ? 1 : 0) + (apiKeys.virusTotal ? 1 : 0)} configured
          </span>
          {showApiKeys ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        </button>
        <AnimatePresence>
          {showApiKeys && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs text-text-muted pt-3">
                  All checks that require API keys are skipped if not provided. Keys are stored locally and never sent to any server other than the API endpoint.
                </p>
                <ApiKeyField
                  label="Google Safe Browsing"
                  value={apiKeys.googleSafeBrowsing ?? ''}
                  onChange={v => setApiKeys(k => ({ ...k, googleSafeBrowsing: v || undefined }))}
                  docsUrl="https://console.cloud.google.com/"
                  placeholder="AIzaSy…"
                />
                <ApiKeyField
                  label="VirusTotal"
                  value={apiKeys.virusTotal ?? ''}
                  onChange={v => setApiKeys(k => ({ ...k, virusTotal: v || undefined }))}
                  docsUrl="https://www.virustotal.com/gui/my-apikey"
                  placeholder="64-character hex key"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Saved scans */}
      {savedReports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">Recent Scans</h3>
          <div className="space-y-2">
            {savedReports.slice(0, 10).map(report => (
              <RecentScanRow
                key={report.id}
                report={report}
                clientName={clientsList.find(c => c.id === report.clientId)?.name}
                onLoad={handleLoadReport}
                onDelete={handleDeleteReport}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ApiKeyField({
  label, value, onChange, docsUrl, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  docsUrl: string;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs flex items-center gap-0.5 transition-colors"
          style={{ color: 'var(--color-accent)' }}
        >
          Get key <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-xs text-text-primary placeholder-text-muted bg-surface-alt outline-none focus:ring-2 transition-all font-mono"
        style={{ border: '1px solid var(--color-border)', '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

function RecentScanRow({
  report,
  clientName,
  onLoad,
  onDelete,
}: {
  report: AuditReport;
  clientName?: string;
  onLoad: (r: AuditReport) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const score = report.score;
  const color =
    score >= 90 ? 'var(--color-status-green)'
    : score >= 70 ? 'var(--color-status-blue)'
    : score >= 40 ? 'var(--color-status-amber)'
    : 'var(--color-status-red)';

  const date = new Date(report.completedAt ?? report.startedAt);
  const issueCount = report.checks.filter(c => c.result?.status === 'fail').length;

  return (
    <button
      onClick={() => onLoad(report)}
      className="w-full card-elevated p-3 flex items-center gap-3 text-left hover:shadow-card-hover transition-all group"
    >
      {/* Score circle */}
      <div
        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: `color-mix(in srgb, ${color} 15%, var(--color-surface-alt))`, color, border: `2px solid color-mix(in srgb, ${color} 40%, transparent)` }}
      >
        {score}
      </div>

      {report.clientLogo && (
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          <img src={report.clientLogo} alt="" className="w-full h-full object-contain" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{report.domain}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Clock className="w-3 h-3 text-text-muted flex-shrink-0" />
          <span className="text-xs text-text-muted">
            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {clientName && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              {clientName}
            </span>
          )}
          {issueCount > 0 && (
            <span className="text-xs font-medium" style={{ color: 'var(--color-status-red)' }}>
              {issueCount} issue{issueCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={e => onDelete(report.id, e)}
        className="p-1.5 rounded-lg text-text-muted hover:text-status-red opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        aria-label="Delete scan"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </button>
  );
}
