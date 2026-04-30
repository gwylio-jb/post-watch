import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, RefreshCw, CheckCircle2, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { generate, OllamaError } from '../../utils/ai/ollama';

/**
 * Universal AI output modal.
 *
 * Renders the streamed Ollama response with mint-gradient signature framing,
 * a `// local ai` mono kicker, copy / regenerate controls, and a
 * non-intrusive disclaimer. All three Sprint 8 features (finding explainer,
 * gap narrative, remediation snippet) funnel through this component — the
 * caller passes the prompt + the user's chosen model.
 *
 * Switched from Anthropic-hosted Claude to a local Ollama daemon in Sprint
 * 8b: pay-as-you-go billing was a non-starter for consultants. Ollama is
 * free, runs on the consultant's machine, and means no client data leaves
 * the device.
 */

export interface AiPanelProps {
  /** Modal title — appears top-left next to the // local ai kicker. */
  title: string;
  /** One-line subtitle clarifying what's being generated. */
  subtitle?: string;
  /** Selected Ollama model — caller is responsible for guarding the trigger
   *  when this is empty, but if it ever lands here unset we surface a clear
   *  error rather than calling the API. */
  model: string;
  /** Optional base URL override (defaults to http://localhost:11434). */
  baseUrl?: string;
  /** Prompt pair from one of the prompts.ts builders. */
  prompt: { system: string; user: string };
  /** Token cap. Defaults to 1024 — bump for narrative memos / long code. */
  maxTokens?: number;
  /** Temperature override — Ollama wrapper default (0.3) is good for most
   *  prompts; bump to 0.5 for creative writing. */
  temperature?: number;
  /** When the user closes the modal. */
  onClose: () => void;
  /** Renders prose vs monospace code. */
  outputKind?: 'prose' | 'code';
}

export default function AiPanel({
  title,
  subtitle,
  model,
  baseUrl,
  prompt,
  maxTokens = 1024,
  temperature,
  onClose,
  outputKind = 'prose',
}: AiPanelProps) {
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Versioned run counter — increments on regenerate, lets the effect
  // re-fire and any in-flight stream's onDelta land in the right state slot.
  const [runId, setRunId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Run on mount + every regenerate.
  useEffect(() => {
    if (!model) {
      setError('Pick a model in Settings → Local AI to use this feature.');
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setOutput('');
    setError(null);
    setStreaming(true);

    generate({
      model,
      baseUrl,
      system: prompt.system,
      user: prompt.user,
      maxTokens,
      temperature,
      signal: ctrl.signal,
      onDelta: chunk => setOutput(prev => prev + chunk),
    })
      .then(final => {
        // Prefer the assembled `final` over accumulated state — onDelta loses
        // chunks if React batches a setState across a paused stream.
        setOutput(final);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof OllamaError) {
          // Map cause → friendly message. Each cause has a distinct fix-it
          // path so being specific shortens the user's debug loop.
          if (e.cause === 'unreachable') {
            setError('Ollama isn\'t running. Open the Ollama app (or run `ollama serve`) and try again.');
          } else if (e.cause === 'model-missing') {
            setError(e.message);
          } else if (e.cause === 'aborted') {
            // Silent — user closed modal.
          } else {
            setError(e.message);
          }
        } else {
          setError(e instanceof Error ? e.message : 'AI request failed');
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setStreaming(false);
      });

    return () => { ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Tauri WKWebView usually grants clipboard, but fail open with no UI noise.
    }
  };

  const handleRegenerate = () => {
    abortRef.current?.abort();
    setRunId(n => n + 1);
  };

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  // Portal to <body> so the modal isn't trapped inside the TopBar's
  // backdrop-filter (which would otherwise pin `position: fixed` descendants
  // to the TopBar's box). See SettingsPanel.tsx for the full rationale.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        // Mint→violet gradient border (signature) using a 2-layer trick:
        // outer div has the gradient as background, inner has solid surface.
        className="rounded-2xl w-full max-w-2xl"
        style={{
          padding: 1.5,
          background: 'linear-gradient(135deg, #00D9A3 0%, #00B589 50%, #7C3AED 100%)',
          maxHeight: '85vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--color-surface)',
            maxHeight: 'calc(85vh - 3px)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between p-5"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="min-w-0 flex-1">
              <span className="mono-tag mb-1">local ai · {model || 'no model'}</span>
              <h2 className="font-display font-bold text-lg flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#00D9A3' }} />
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg mb-3"
                style={{
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!error && streaming && output.length === 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  Generating with {model}…
                  {/* First call after a cold start is slow while the model loads
                      into RAM. Tell the user so they don't think we've wedged. */}
                  <span className="block text-[10px] mt-0.5 opacity-70">
                    First request loads the model — this can take 10–30s.
                  </span>
                </span>
              </div>
            )}

            {output && (
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: outputKind === 'code'
                    ? 'var(--font-mono, ui-monospace, monospace)'
                    : 'inherit',
                  background: outputKind === 'code' ? 'var(--color-surface-alt)' : 'transparent',
                  padding: outputKind === 'code' ? 12 : 0,
                  borderRadius: outputKind === 'code' ? 6 : 0,
                  margin: 0,
                }}
              >
                {output}
                {streaming && <span className="opacity-50">▋</span>}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-2 px-5 py-3"
            style={{
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
            }}
          >
            <p className="text-[10px] flex-1 min-w-0" style={{ color: 'var(--color-text-muted)' }}>
              AI-generated locally. Review before sending to a client.
            </p>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={streaming || !model}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${streaming ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!output || streaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                background: copied ? 'var(--color-status-green, #059669)' : '#00D9A3',
                color: '#1A2332',
                border: 'none',
              }}
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
