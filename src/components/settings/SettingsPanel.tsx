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
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text-primary)' }}>
              Settings
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              API keys for the WP scanner ({configuredCount}/{API_KEY_PROVIDERS.length}) and local AI for the assist features.
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── Local AI (Ollama) ─────────────────────────────────────────── */}
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#00D9A3' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    Local AI (Ollama)
                  </span>
                  {/* Status pill — colour-coded by reachability */}
                  {ollamaStatus === 'reachable' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-accent-soft)', color: 'var(--color-text-accent)' }}>
                      Detected
                    </span>
                  )}
                  {ollamaStatus === 'unreachable' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(220,38,38,0.12)', color: '#DC2626' }}>
                      Not running
                    </span>
                  )}
                  {ollamaStatus === 'checking' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                      Checking…
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Powers Explain-to-client, Draft-commentary and Generate-fix. Runs locally — no client data leaves this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openExternal('https://ollama.com/download')}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors flex-shrink-0"
                style={{
                  color: 'var(--color-text-accent)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                Get Ollama <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Unreachable: install / start instructions */}
            {ollamaStatus === 'unreachable' && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg mb-3"
                style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <p>Ollama isn't running. Install it from <span style={{ color: 'var(--color-text-accent)' }}>ollama.com</span>, open the app (or run <code className="font-mono" style={{ background: 'var(--color-surface-alt)', padding: '1px 4px', borderRadius: 3 }}>ollama serve</code>), then click <em>Re-check</em>.</p>
                </div>
              </div>
            )}

            {/* Reachable but no models installed */}
            {ollamaStatus === 'reachable' && installedModels.length === 0 && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg mb-3"
                style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
                <div className="text-xs flex-1" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <p className="mb-1.5">No models installed yet. Pull the recommended one (≈2GB):</p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 font-mono text-[11px]" style={{ background: 'var(--color-surface-alt)', padding: '4px 8px', borderRadius: 4 }}>
                      ollama pull {RECOMMENDED_MODEL}
                    </code>
                    <button
                      type="button"
                      onClick={copyPullCmd}
                      className="p-1 rounded"
                      style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
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
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>Model</label>
                <select
                  value={aiDraft.model ?? ''}
                  onChange={e => setAiDraft(prev => ({ ...prev, model: e.target.value || undefined }))}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                  }}
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
              className="flex items-center gap-1 text-[11px] mt-3 px-2 py-1 rounded transition-colors"
              style={{
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
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
              <div
                key={p.key}
                className="rounded-xl p-4"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {p.name}
                      </span>
                      {isSet && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-text-accent)' }}
                        >
                          Configured
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {p.description}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.freeTier}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternal(p.getKeyUrl)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors flex-shrink-0"
                    style={{
                      color: 'var(--color-text-accent)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-soft)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
                  >
                    Get key <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type={isRevealed ? 'text' : 'password'}
                    value={value}
                    onChange={e => updateDraft(p.key, e.target.value)}
                    placeholder="Paste your API key"
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-mono"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => toggleReveal(p.key)}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
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
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-alt)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: justSaved ? 'var(--color-status-green)' : 'var(--color-accent)',
              color: '#1A2332',
              border: 'none',
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
