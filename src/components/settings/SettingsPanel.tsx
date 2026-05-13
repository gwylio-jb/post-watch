/**
 * Global Settings panel — modal opened from the TopBar gear.
 *
 * Centralises API-key configuration for all external services the WordPress
 * Security module uses. Each provider has:
 *   - A display name and description
 *   - A correct "Get key" URL (the WpAuditHub inline form had broken/stale links)
 *   - Free-tier info to help users pick which keys are worth setting up
 *
 * Keys persist to the existing localStorage entry `wp-audit-api-keys` so the
 * scan engine picks them up with no other changes.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Eye, EyeOff, Save, CheckCircle2, Sparkles, RefreshCw, Copy, AlertCircle, ShieldCheck, ShieldAlert, Archive, Calendar, Lock, Unlock, Loader2 } from 'lucide-react';
import * as cryptoStorage from '../../utils/cryptoStorage';
import type { AuditReport } from '../../data/auditTypes';
import type { Schedule, SchedulerCadence } from '../../data/types';
import { verifyChain, type VerificationResult } from '../../utils/integrity';
import { useSchedulerContext } from '../../hooks/scanQueueContextRef';
import { exportBackup } from '../../utils/backup';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { AuditApiKeys, AiSettings } from '../../data/auditTypes';
import { openExternal } from '../../utils/openExternal';
import { listModels, ping, RECOMMENDED_MODEL, type OllamaModel } from '../../utils/ai/ollama';

interface SettingsPanelProps {
  onClose: () => void;
}

type ProviderKey = keyof AuditApiKeys;

interface ProviderMeta {
  key: ProviderKey;
  name: string;
  description: string;
  getKeyUrl: string;
  freeTier: string;
}

const API_KEY_PROVIDERS: ProviderMeta[] = [
  {
    key: 'googleSafeBrowsing',
    name: 'Google Safe Browsing',
    description: 'Checks whether the domain is flagged for malware, phishing or unwanted software.',
    getKeyUrl: 'https://developers.google.com/safe-browsing/v4/get-started',
    freeTier: 'Free — 10,000 requests/day',
  },
  {
    key: 'virusTotal',
    name: 'VirusTotal',
    description: 'Aggregated reputation across 70+ antivirus and URL-scanning engines.',
    getKeyUrl: 'https://www.virustotal.com/gui/my-apikey',
    freeTier: 'Free — 4 req/min, 500/day',
  },
  {
    key: 'wpscan',
    name: 'WPScan',
    description: 'WordPress-specific vulnerability database covering core, plugins and themes.',
    getKeyUrl: 'https://wpscan.com/api',
    freeTier: 'Free — 25 requests/day',
  },
  {
    key: 'urlscanIo',
    name: 'URLScan.io',
    description: 'Full sandboxed scan of the page — redirects, resources, technology fingerprinting.',
    getKeyUrl: 'https://urlscan.io/user/signup',
    freeTier: 'Free — 5,000 public scans/month',
  },
  {
    key: 'abuseIpDb',
    name: 'AbuseIPDB',
    description: 'IP-address reputation lookups for the domain\'s hosting server.',
    getKeyUrl: 'https://www.abuseipdb.com/register',
    freeTier: 'Free — 1,000 checks/day',
  },
];

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [stored, setStored] = useLocalStorage<AuditApiKeys>('wp-audit-api-keys', {});
  const [draft, setDraft] = useState<AuditApiKeys>(stored);
  const [revealed, setRevealed] = useState<Set<ProviderKey>>(new Set());
  const [justSaved, setJustSaved] = useState(false);

  // ── Local AI (Ollama) state ─────────────────────────────────────────────
  // Persists separately from external API keys — see AiSettings type doc.
  const [aiStored, setAiStored] = useLocalStorage<AiSettings>('ai-settings', {});
  const [aiDraft, setAiDraft] = useState<AiSettings>(aiStored);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'reachable' | 'unreachable'>('checking');
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [pullCmdCopied, setPullCmdCopied] = useState(false);

  const refreshOllama = useCallback(async () => {
    setOllamaStatus('checking');
    const ok = await ping(aiDraft.baseUrl);
    if (!ok) {
      setOllamaStatus('unreachable');
      setInstalledModels([]);
      return;
    }
    setOllamaStatus('reachable');
    try {
      const models = await listModels(aiDraft.baseUrl);
      setInstalledModels(models);
    } catch {
      setInstalledModels([]);
    }
  }, [aiDraft.baseUrl]);

  // Sync draft if parent storage changes (unlikely while open, but safe)
  useEffect(() => { setDraft(stored); }, [stored]);
  useEffect(() => { setAiDraft(aiStored); }, [aiStored]);
  // Probe Ollama on mount + whenever the base URL changes.
  useEffect(() => { refreshOllama(); }, [refreshOllama]);
  // Escape closes the modal — modal is portal'd, so this listener catches all
  // keypresses while the panel is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateDraft = (key: ProviderKey, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const toggleReveal = (key: ProviderKey) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    // Strip empty strings so `apiKeys.virusTotal` stays falsy when unset
    const cleaned: AuditApiKeys = {};
    for (const p of API_KEY_PROVIDERS) {
      const val = draft[p.key]?.trim();
      if (val) cleaned[p.key] = val;
    }
    setStored(cleaned);
    // Persist AI settings alongside the keys — same Save button, two stores.
    const cleanedAi: AiSettings = {};
    if (aiDraft.model?.trim()) cleanedAi.model = aiDraft.model.trim();
    if (aiDraft.baseUrl?.trim()) cleanedAi.baseUrl = aiDraft.baseUrl.trim();
    setAiStored(cleanedAi);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const copyPullCmd = async () => {
    try {
      await navigator.clipboard.writeText(`ollama pull ${RECOMMENDED_MODEL}`);
      setPullCmdCopied(true);
      setTimeout(() => setPullCmdCopied(false), 1800);
    } catch { /* clipboard may be denied; fail open */ }
  };

  const configuredCount = API_KEY_PROVIDERS.filter(p => draft[p.key]?.trim()).length;

  // Portal the modal to <body> so its `position: fixed` is genuinely
  // viewport-relative. The TopBar uses `backdrop-blur-md`, which (per CSS
  // containing-block rules) traps `position: fixed` descendants — without
  // the portal, the modal centres inside the TopBar's strip instead of the
  // window, and you lose the top half of the panel off-screen at large
  // window sizes. Belt-and-braces: we also want the bigger sibling overlay
  // (the dimmed backdrop) to genuinely cover the viewport.
  // Reusable styling for the inner provider blocks — glass-on-glass against
  // the modal's bubble surface, with redesign tokens throughout.
  const innerBlockStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: 16,
    background: 'color-mix(in oklab, var(--bg-2) 50%, transparent)',
    border: '1px solid var(--line)',
  };
  const innerInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid var(--line-2)',
    background: 'var(--bg-2)',
    color: 'var(--ink-1)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'var(--font-redesign-mono)',
  };
  const innerIconBtnStyle: React.CSSProperties = {
    padding: 8,
    borderRadius: 10,
    background: 'var(--bg-2)',
    border: '1px solid var(--line-2)',
    color: 'var(--ink-3)',
    cursor: 'pointer',
    display: 'grid', placeItems: 'center',
  };

  // Trap focus inside the modal — Escape-to-close already lives in an
  // earlier useEffect.
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  return createPortal(
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
        aria-labelledby="settings-panel-title"
        className="bubble"
        style={{
          width: '100%', maxWidth: 640,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-head">
          <div>
            <span className="kicker">settings</span>
            <h3 id="settings-panel-title">Integrations &amp; AI</h3>
            <div className="desc">
              {configuredCount}/{API_KEY_PROVIDERS.length} API keys configured · local Ollama for AI assist features.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 6, borderRadius: 8, color: 'var(--ink-3)', background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Local AI (Ollama) ─────────────────────────────────────────── */}
          <div style={innerBlockStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--mint)' }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>
                    Local AI (Ollama)
                  </span>
                  {ollamaStatus === 'reachable' && (
                    <span className="pill mint" style={{ fontSize: 10, padding: '2px 8px' }}>
                      <span className="dot" style={{ background: 'var(--mint)' }} />Detected
                    </span>
                  )}
                  {ollamaStatus === 'unreachable' && (
                    <span className="pill ember" style={{ fontSize: 10, padding: '2px 8px' }}>
                      <span className="dot" style={{ background: 'var(--ember)' }} />Not running
                    </span>
                  )}
                  {ollamaStatus === 'checking' && (
                    <span className="pill muted" style={{ fontSize: 10, padding: '2px 8px' }}>
                      <span className="dot" style={{ background: 'var(--ink-3)' }} />Checking…
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Powers Explain-to-client, Draft-commentary and Generate-fix. Runs locally — no client data leaves this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openExternal('https://ollama.com/download')}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '6px 10px', flexShrink: 0 }}
              >
                Get Ollama <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Unreachable: install / start instructions */}
            {ollamaStatus === 'unreachable' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-2)', border: '1px dashed var(--line-2)', marginBottom: 12 }}>
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--ink-3)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  Ollama isn't running. Install it from <span style={{ color: 'var(--mint)' }}>ollama.com</span>, open the app (or run <code style={{ fontFamily: 'var(--font-redesign-mono)', background: 'color-mix(in oklab, var(--bg-2) 50%, transparent)', padding: '1px 6px', borderRadius: 4 }}>ollama serve</code>), then click <em>Re-check</em>.
                </div>
              </div>
            )}

            {/* Reachable but no models installed */}
            {ollamaStatus === 'reachable' && installedModels.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, background: 'var(--bg-2)', border: '1px dashed var(--line-2)', marginBottom: 12 }}>
                <AlertCircle className="w-4 h-4" style={{ color: 'var(--ink-3)', marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>
                  <p style={{ margin: '0 0 6px' }}>No models installed yet. Pull the recommended one (≈2 GB):</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <code style={{ flex: 1, fontFamily: 'var(--font-redesign-mono)', fontSize: 11, background: 'color-mix(in oklab, var(--bg-2) 50%, transparent)', padding: '6px 10px', borderRadius: 6, color: 'var(--ink-1)' }}>
                      ollama pull {RECOMMENDED_MODEL}
                    </code>
                    <button
                      type="button"
                      onClick={copyPullCmd}
                      style={{ ...innerIconBtnStyle, padding: 6 }}
                      aria-label="Copy command"
                    >
                      {pullCmdCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reachable + models installed: model picker */}
            {ollamaStatus === 'reachable' && installedModels.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, fontFamily: 'var(--font-redesign-mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Model</label>
                <select
                  value={aiDraft.model ?? ''}
                  onChange={e => setAiDraft(prev => ({ ...prev, model: e.target.value || undefined }))}
                  style={{ ...innerInputStyle, fontFamily: 'inherit' }}
                >
                  <option value="">— Select a model —</option>
                  {installedModels.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={refreshOllama}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '5px 10px', marginTop: 12 }}
            >
              <RefreshCw className={`w-3 h-3 ${ollamaStatus === 'checking' ? 'animate-spin' : ''}`} />
              Re-check
            </button>
          </div>

          {/* ── Tamper-evident scan history (Sprint 14) ───────────────────── */}
          <IntegrityVerifier innerBlockStyle={innerBlockStyle} />

          {/* ── Auto-backup reminders (Sprint 14) ─────────────────────────── */}
          <BackupReminder innerBlockStyle={innerBlockStyle} />

          {/* ── Encryption (Sprint 15) ────────────────────────────────────── */}
          <EncryptionPanel innerBlockStyle={innerBlockStyle} />

          {/* ── External API providers ────────────────────────────────────── */}
          {API_KEY_PROVIDERS.map(p => {
            const value = draft[p.key] ?? '';
            const isRevealed = revealed.has(p.key);
            const isSet = !!value.trim();
            return (
              <div key={p.key} style={innerBlockStyle}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>{p.name}</span>
                      {isSet && (
                        <span className="pill mint" style={{ fontSize: 10, padding: '2px 8px' }}>
                          <span className="dot" style={{ background: 'var(--mint)' }} />Configured
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, marginTop: 4, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                    <p style={{ fontSize: 10, marginTop: 4, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                      {p.freeTier}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternal(p.getKeyUrl)}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '6px 10px', flexShrink: 0 }}
                  >
                    Get key <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type={isRevealed ? 'text' : 'password'}
                    value={value}
                    onChange={e => updateDraft(p.key, e.target.value)}
                    placeholder="Paste your API key"
                    style={innerInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(p.key)}
                    style={innerIconBtnStyle}
                    aria-label={isRevealed ? 'Hide key' : 'Reveal key'}
                  >
                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px dashed var(--line-2)' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              background: justSaved ? 'var(--mint-2)' : undefined,
            }}
          >
            {justSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Tamper-evident scan history verifier ─────────────────────────────────
//
// Sprint 14 Pack 3. Sits in the Settings panel as a one-button check —
// walks every saved AuditReport and confirms its hash + chain. Surfaces
// any mismatch as a flag with the offending report's id + domain.

function IntegrityVerifier({ innerBlockStyle }: { innerBlockStyle: React.CSSProperties }) {
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const safe = Array.isArray(savedReports) ? savedReports : [];

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const r = await verifyChain(safe);
      setResult(r);
    } finally {
      setVerifying(false);
    }
  };

  const errors = result?.flags.filter(f => f.kind !== 'pre-v2.6-baseline') ?? [];
  const baselines = result?.flags.filter(f => f.kind === 'pre-v2.6-baseline') ?? [];

  return (
    <div style={innerBlockStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--mint)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>
              Scan history integrity
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            Walks {safe.length} saved scan report{safe.length === 1 ? '' : 's'} and verifies the tamper-evident chain. Reports created before v2.6 are reported as unverified baselines, not errors.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleVerify}
          disabled={verifying || safe.length === 0}
          style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12 }}
        >
          {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {verifying ? 'Verifying…' : 'Verify integrity'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 6 }}>
          {result.ok && errors.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(0,217,163,0.12)',
              color: 'var(--mint)', fontSize: 12, fontWeight: 600,
            }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              All {result.totalChecked} report{result.totalChecked === 1 ? '' : 's'} verified.
              {baselines.length > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>
                  &nbsp;({baselines.length} pre-v2.6 baseline{baselines.length === 1 ? '' : 's'} — chain begins from there.)
                </span>
              )}
            </div>
          )}
          {errors.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,74,28,0.10)',
              border: '1px solid rgba(255,74,28,0.30)',
              color: 'var(--ember)', fontSize: 12,
            }}>
              <ShieldAlert className="w-3.5 h-3.5" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {errors.length} integrity issue{errors.length === 1 ? '' : 's'} detected.
                </div>
                <ul style={{ marginTop: 6, paddingLeft: 16, color: 'var(--ink-2)', fontSize: 11 }}>
                  {errors.slice(0, 10).map((f, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>
                      <strong style={{ color: 'var(--ink-1)' }}>{f.domain}</strong>
                      {' '}
                      <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 10 }}>{f.reportId.slice(0, 8)}</span>
                      {' — '}
                      {f.kind === 'hash-mismatch' ? 'contents have been edited' : 'chain link broken'}
                    </li>
                  ))}
                </ul>
                {errors.length > 10 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                    … {errors.length - 10} more not shown.
                  </div>
                )}
              </div>
            </div>
          )}
          {!result.ok && errors.length === 0 && baselines.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(217,119,6,0.10)',
              color: '#D97706', fontSize: 12,
            }}>
              <AlertCircle className="w-3.5 h-3.5" />
              {baselines.length} pre-v2.6 report{baselines.length === 1 ? '' : 's'} — re-scan to bring them into the chain.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Auto-backup reminders (Sprint 14) ────────────────────────────────────
//
// Schedules a recurring reminder. When the schedule fires (via the
// scheduler hook in ScanQueueProvider), a flag is written to localStorage.
// This component reads the flag and surfaces a banner — clicking
// 'Export now' triggers the existing exportBackup download and clears
// the flag.
//
// We deliberately do NOT auto-trigger the download on the schedule.
// Silent file writes on a timer would be hostile UX; the consultant
// should consent to each download.

const BACKUP_PENDING_KEY = 'post-watch:backup-pending';

function BackupReminder({ innerBlockStyle }: { innerBlockStyle: React.CSSProperties }) {
  const scheduler = useSchedulerContext();
  const [pendingAt, setPendingAt] = useLocalStorage<string | null>(BACKUP_PENDING_KEY, null);

  const existing = scheduler.schedules.find(
    s => s.kind === 'backup' && !s.deletedAt && s.active
  ) as Extract<Schedule, { kind: 'backup' }> | undefined;

  // Cadence picker state — only relevant when there's no existing schedule.
  const [pickerKind, setPickerKind] = useState<SchedulerCadence['kind']>('weekly');
  const [weekday, setWeekday] = useState(1);
  const [intervalDays, setIntervalDays] = useState(7);

  const buildCadence = (): SchedulerCadence =>
      pickerKind === 'weekly'   ? { kind: 'weekly',   weekday: weekday as 0|1|2|3|4|5|6, hour: 9 }
    : pickerKind === 'monthly'  ? { kind: 'monthly',  day: 1, hour: 9 }
    : { kind: 'interval', days: intervalDays };

  const handleEnable = () => {
    scheduler.addBackupSchedule(buildCadence());
  };

  const handleDisable = () => {
    if (existing) scheduler.removeSchedule(existing.id);
  };

  const handleExportNow = () => {
    exportBackup();
    setPendingAt(null);
  };

  const handleDismiss = () => setPendingAt(null);

  return (
    <div style={innerBlockStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive className="w-4 h-4" style={{ color: 'var(--mint)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>
              Backup reminders
            </span>
            {existing && (
              <span style={{ fontSize: 10, color: 'var(--mint)', fontFamily: 'var(--font-redesign-mono)' }}>
                active
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            We never auto-download anything. When a backup is due, you'll see a banner here and choose when to export.
          </div>
        </div>
      </div>

      {/* Pending banner */}
      {pendingAt && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(217,119,6,0.12)',
          border: '1px solid rgba(217,119,6,0.30)',
          marginBottom: 10,
        }}>
          <AlertCircle className="w-4 h-4" style={{ color: '#D97706', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-1)' }}>
            Backup is overdue — last reminder fired on{' '}
            {new Date(pendingAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
          </div>
          <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={handleExportNow}>
            Export now
          </button>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {/* Active schedule summary or cadence picker */}
      {existing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--ink-3)' }} />
          <span style={{ color: 'var(--ink-2)' }}>
            {summariseCadence(existing.cadence)} · next due{' '}
            {new Date(existing.nextDueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}
            onClick={handleDisable}
          >
            Turn off
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={pickerKind}
            onChange={e => setPickerKind(e.target.value as SchedulerCadence['kind'])}
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--line-2)', background: 'var(--bg-2)',
              color: 'var(--ink-1)', fontSize: 12, fontFamily: 'inherit',
            }}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="interval">Every N days</option>
          </select>
          {pickerKind === 'weekly' && (
            <select
              value={weekday}
              onChange={e => setWeekday(parseInt(e.target.value, 10))}
              style={{
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--line-2)', background: 'var(--bg-2)',
                color: 'var(--ink-1)', fontSize: 12, fontFamily: 'inherit',
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          )}
          {pickerKind === 'interval' && (
            <input
              type="number" min={1} max={365} value={intervalDays}
              onChange={e => setIntervalDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
              style={{
                width: 70, padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--line-2)', background: 'var(--bg-2)',
                color: 'var(--ink-1)', fontSize: 12, fontFamily: 'inherit',
              }}
            />
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '4px 12px', fontSize: 11 }}
            onClick={handleEnable}
          >
            <CheckCircle2 className="w-3 h-3" /> Enable
          </button>
        </div>
      )}
    </div>
  );
}

function summariseCadence(c: SchedulerCadence): string {
  if (c.kind === 'interval') return `Every ${c.days} day${c.days === 1 ? '' : 's'}`;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (c.kind === 'weekly')   return `Weekly on ${weekdays[c.weekday]}`;
  if (c.kind === 'monthly')  return `Monthly on day ${c.day}`;
  return 'Custom';
}

// ─── Encryption (Sprint 15) ───────────────────────────────────────────────
//
// Three states surfaced to the user:
//   - disabled (default): big 'Enable encryption' button + warning text.
//   - unlocked (after enable): 'Encryption active' confirmation + a 'Lock
//     now' button (next launch will prompt for the passphrase).
//   - locked: not reachable via this panel — the LockGate replaces
//     AppContent, so SettingsPanel can't open in this state. Still
//     handled defensively below.
//
// The enable flow is a small in-component wizard, not a separate modal —
// keeps Settings UX consistent and avoids modal-on-modal stacking.

function EncryptionPanel({ innerBlockStyle }: { innerBlockStyle: React.CSSProperties }) {
  // useSyncExternalStore so this component re-renders the instant
  // status() flips after enable / lock.
  const status = useSyncExternalStore(
    cryptoStorage.subscribe,
    cryptoStorage.status,
    cryptoStorage.status,
  );

  return (
    <div style={innerBlockStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'disabled'
              ? <Unlock className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
              : <Lock className="w-4 h-4" style={{ color: 'var(--mint)' }} />}
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>
              Encryption at rest
            </span>
            {status !== 'disabled' && (
              <span style={{ fontSize: 10, color: 'var(--mint)', fontFamily: 'var(--font-redesign-mono)' }}>
                active
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {status === 'disabled'
              ? "Lock everything you've saved — scan reports, risks, clients, gap analyses — behind a passphrase. AES-GCM 256, derived from your passphrase with 250 000 PBKDF2 iterations. No data ever leaves the device."
              : "Your storage is encrypted at rest. Next time you launch the app you'll be prompted to enter your passphrase before any saved data is visible."}
          </div>
        </div>
      </div>

      {status === 'disabled' && <EnableEncryptionWizard />}
      {status === 'unlocked' && <UnlockedActions />}
      {status === 'locked' && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Storage is currently locked — close Settings and unlock to continue.
        </div>
      )}
    </div>
  );
}

/**
 * Three-step wizard: warning → passphrase + confirm → submit. State is
 * local because once submitted, status flips and EncryptionPanel
 * re-renders the unlocked branch, so the wizard naturally unmounts.
 */
function EnableEncryptionWizard() {
  const [step, setStep] = useState<'warning' | 'passphrase'>('warning');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = pass.length > 0 && confirmPass.length > 0 && pass !== confirmPass;
  const tooShort = pass.length > 0 && pass.length < 8;
  const canSubmit = pass.length >= 8 && pass === confirmPass && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await cryptoStorage.enableEncryption(pass);
      // Success → status flips → EncryptionPanel re-renders. No further
      // action needed here.
    } catch (err) {
      setError((err as Error).message || 'Could not enable encryption.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'warning') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          fontSize: 12, color: 'var(--ink-2)',
          background: 'rgba(217,119,6,0.08)',
          border: '1px solid rgba(217,119,6,0.30)',
          borderRadius: 10,
          padding: '10px 12px',
        }}>
          <AlertCircle className="w-4 h-4" style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>Back up your data first.</div>
            <div style={{ marginTop: 4 }}>
              If you forget your passphrase there's no way to recover what's stored — your passphrase is the only key. Use the Export Backup option before enabling so you have a copy you can re-import if anything goes wrong.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => setStep('passphrase')}>
            <Lock className="w-3.5 h-3.5" />
            I've backed up — set a passphrase
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'var(--font-redesign-mono)',
        }}>
          Passphrase (minimum 8 characters)
        </label>
        <input
          type="password"
          value={pass}
          onChange={e => { setPass(e.target.value); setError(null); }}
          autoComplete="new-password"
          spellCheck={false}
          disabled={submitting}
          style={inputCss}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'var(--font-redesign-mono)',
        }}>
          Confirm passphrase
        </label>
        <input
          type="password"
          value={confirmPass}
          onChange={e => { setConfirmPass(e.target.value); setError(null); }}
          autoComplete="new-password"
          spellCheck={false}
          disabled={submitting}
          style={inputCss}
        />
      </div>
      {(tooShort || mismatch || error) && (
        <div style={{
          fontSize: 12, color: 'var(--ember)',
          background: 'rgba(255,74,28,0.10)',
          border: '1px solid rgba(255,74,28,0.30)',
          borderRadius: 10,
          padding: '8px 12px',
        }}>
          {error
            ? error
            : tooShort
              ? 'Passphrase must be at least 8 characters.'
              : 'Passphrases do not match.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('warning')} disabled={submitting}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!canSubmit}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
          {submitting ? 'Encrypting…' : 'Enable encryption'}
        </button>
      </div>
    </form>
  );
}

function UnlockedActions() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => cryptoStorage.lock()}
        title="Lock now — you'll be prompted for your passphrase on next interaction or launch."
      >
        <Lock className="w-3.5 h-3.5" />
        Lock now
      </button>
    </div>
  );
}

const inputCss: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)',
  color: 'var(--ink-1)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
};
