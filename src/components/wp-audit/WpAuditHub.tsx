import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Key, ChevronDown, ChevronUp, Globe, Trash2, ExternalLink, Users, Zap } from 'lucide-react';
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

  const safeReports = Array.isArray(savedReports) ? savedReports : [];
  const lastScan = safeReports[0];
  const apiKeysConfigured = (apiKeys.googleSafeBrowsing ? 1 : 0) + (apiKeys.virusTotal ? 1 : 0);
  const checkCategories = [
    { label: 'DNS & Email',      accent: 'mint'   as const },
    { label: 'TLS / SSL',        accent: 'mint'   as const },
    { label: 'Security headers', accent: 'mint'   as const },
    { label: 'WordPress core',   accent: 'violet' as const },
    { label: 'File exposure',    accent: 'ember'  as const },
    { label: 'Reputation',       accent: 'violet' as const },
    { label: 'Configuration',    accent: 'mint'   as const },
  ];

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker">post_scan · external audit</span>
          <h1 className="h-condensed title">
            Run a scan<span className="u">_</span><br />without ever logging in.
          </h1>
          <p className="sub">
            External attacker-perspective scan of any WordPress site. No plugin access required — this is what a real threat actor would see from the outside.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">Saved scans</div>
              <div className="v">{safeReports.length}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Checks per run</div>
              <div className="v">~{buildCheckCatalogue().length}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Runtime</div>
              <div className="v" style={{ fontSize: 22 }}>
                {tauriAvailable ? 'Desktop' : 'Browser'}
                <small> {tauriAvailable ? 'full' : 'partial'}</small>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane — coverage panel. Replaces the dashboard's Gauge slot since
            there's no score before the first scan completes. */}
        <div className="gauge-wrap" style={{ alignItems: 'stretch' }}>
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 22,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-bd)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: 'var(--glass-shadow)',
              display: 'flex', flexDirection: 'column', gap: 10,
              minWidth: 240,
            }}
          >
            <span className="kicker violet">coverage</span>
            <div style={{ fontFamily: 'var(--font-redesign-condensed)', fontWeight: 800, fontSize: 64, lineHeight: 1, color: 'var(--ink-1)', letterSpacing: '-0.04em' }}>
              {buildCheckCatalogue().length}
              <small style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 14, color: 'var(--ink-3)', fontWeight: 500, marginLeft: 6 }}>checks</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {checkCategories.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background:
                      c.accent === 'mint'   ? 'var(--mint)'   :
                      c.accent === 'violet' ? 'var(--violet)' :
                                              'var(--ember)',
                    flexShrink: 0,
                  }} />
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Browser-mode warning — only when we can't reach the full catalogue */}
      {!tauriAvailable && (
        <div
          className="bubble"
          style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', background: 'color-mix(in oklab, var(--ember) 10%, var(--glass-bg))', borderColor: 'color-mix(in oklab, var(--ember) 30%, var(--glass-bd))' }}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ember)', marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ember)' }}>Browser mode — limited coverage</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.5 }}>
              DNS, TLS and reputation checks run in any browser. Security headers, WordPress core, file-exposure and configuration checks require the desktop app (CORS bypass).
            </div>
          </div>
        </div>
      )}

      {/* Target form — primary action */}
      <section className="bubble">
        <div className="card-head">
          <div>
            <span className="kicker">target</span>
            <h3>New scan</h3>
            <div className="desc">Type a domain, pick the client to file the report under, then hit scan.</div>
          </div>
          <span className="tag-mod">post_scan</span>
        </div>
        <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* URL */}
          <div>
            <label htmlFor="wp-url" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)', marginBottom: 6 }}>
              Target URL
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Globe className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
                <input
                  id="wp-url"
                  type="url"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
                  onKeyDown={e => e.key === 'Enter' && startScan(urlInput)}
                  placeholder="https://example.com"
                  autoComplete="url"
                  spellCheck={false}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 36px',
                    borderRadius: 12,
                    border: `1px solid ${urlError ? 'var(--ember)' : 'var(--line-2)'}`,
                    background: 'var(--bg-2)',
                    color: 'var(--ink-1)',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startScan(urlInput)}
                disabled={!urlInput.trim()}
                style={{ flexShrink: 0, padding: '10px 18px' }}
              >
                <Zap className="w-4 h-4" /> Scan
              </button>
            </div>
            {(urlError || scanError) && (
              <p style={{ fontSize: 12, color: 'var(--ember)', marginTop: 6, fontFamily: 'var(--font-redesign-mono)' }}>
                {urlError || scanError}
              </p>
            )}
          </div>

          {/* Client */}
          <div>
            <label htmlFor="wp-client" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)', marginBottom: 6 }}>
              File under client
            </label>
            <div style={{ position: 'relative' }}>
              <Users className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
              <select
                id="wp-client"
                value={scanClientId}
                onChange={e => setScanClientId(e.target.value)}
                style={{
                  width: '100%', appearance: 'none',
                  padding: '10px 36px 10px 36px',
                  borderRadius: 12,
                  border: '1px solid var(--line-2)',
                  background: 'var(--bg-2)',
                  color: 'var(--ink-1)',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, fontFamily: 'var(--font-redesign-mono)' }}>
              // logo is frozen onto the report so reprints stay on-brand.
            </p>
          </div>
        </div>
      </section>

      {/* API Keys (optional, collapsible) */}
      <section className="bubble">
        <button
          type="button"
          onClick={() => setShowApiKeys(s => !s)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '18px 22px',
            background: 'transparent',
            border: 0,
            color: 'inherit',
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'left',
          }}
          aria-expanded={showApiKeys}
        >
          <Key className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>API keys (optional)</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            {apiKeysConfigured} configured
          </span>
          {showApiKeys ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--ink-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />}
        </button>
        <AnimatePresence initial={false}>
          {showApiKeys && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px dashed var(--line-2)' }}>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', paddingTop: 12, lineHeight: 1.5 }}>
                  Checks that need an API key are skipped when no key is set. Keys live in localStorage and only travel to the matching API endpoint.
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
      </section>

      {/* Saved scans */}
      {safeReports.length > 0 && (
        <section className="bubble">
          <div className="card-head">
            <div>
              <span className="kicker">post_scan · history</span>
              <h3>Recent scans</h3>
              <div className="desc">
                Last scan {lastScan ? new Date(lastScan.completedAt ?? lastScan.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} · keeping the last {MAX_SAVED}.
              </div>
            </div>
            <span className="tag-mod">post_scan</span>
          </div>
          <div className="scan-list">
            {safeReports.slice(0, 10).map(report => (
              <RecentScanRow
                key={report.id}
                report={report}
                clientName={clientsList.find(c => c.id === report.clientId)?.name}
                onLoad={handleLoadReport}
                onDelete={handleDeleteReport}
              />
            ))}
          </div>
        </section>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>
          {label}
        </label>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--mint)', fontFamily: 'var(--font-redesign-mono)', textDecoration: 'none' }}
        >
          Get key <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--bg-2)',
          color: 'var(--ink-1)',
          fontSize: 12,
          fontFamily: 'var(--font-redesign-mono)',
          outline: 'none',
        }}
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
  const tone: 'good' | 'warn' | 'bad' = score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad';
  const date = new Date(report.completedAt ?? report.startedAt);
  const critCount = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'Critical').length;
  const highCount = report.checks.filter(c => c.result?.status === 'fail' && c.worstCaseSeverity === 'High').length;

  return (
    <button
      type="button"
      className="scan-row"
      onClick={() => onLoad(report)}
      aria-label={`Open scan for ${report.domain}, score ${score} out of 100`}
      style={{ gridTemplateColumns: '56px 1fr auto auto auto' }}
    >
      <div className={`scan-score ${tone}`} aria-hidden>{score}</div>
      <div style={{ minWidth: 0 }}>
        <div className="scan-domain" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.domain}</div>
        <div className="scan-meta">
          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {clientName ? ` · ${clientName}` : ''}
        </div>
      </div>
      <div className="scan-issues">
        {critCount > 0 && <span className="pill ember"><span className="dot" style={{ background: 'var(--ember)' }} />{critCount} crit</span>}
        {highCount > 0 && <span className="pill violet"><span className="dot" style={{ background: 'var(--violet)' }} />{highCount} high</span>}
        {critCount === 0 && highCount === 0 && <span className="pill mint"><span className="dot" style={{ background: 'var(--mint)' }} />clean</span>}
      </div>
      {report.clientLogo
        ? <img src={report.clientLogo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'contain', background: 'var(--bg-2)', border: '1px solid var(--line)' }} />
        : <span style={{ width: 28 }} aria-hidden />
      }
      <span
        role="button"
        tabIndex={0}
        onClick={e => onDelete(report.id, e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDelete(report.id, e as unknown as React.MouseEvent); } }}
        aria-label={`Delete scan for ${report.domain}`}
        style={{
          padding: 6, borderRadius: 8,
          color: 'var(--ink-3)',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ember)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--ember) 15%, transparent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
