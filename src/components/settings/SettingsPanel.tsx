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

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Eye, EyeOff, Save, CheckCircle2, Sparkles, RefreshCw, Copy, AlertCircle } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
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
