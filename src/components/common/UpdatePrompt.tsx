import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, CheckCircle2, Loader2, AlertCircle, Sparkles } from 'lucide-react';

/*
 * In-app auto-update prompt.
 *
 * Mounted once near the top of the tree. On launch (one-time, after a small
 * delay so it doesn't compete with the splash render), it asks the Tauri
 * updater plugin whether a newer release is available. If yes — surfaces a
 * dismissable corner toast; if the user clicks Install we download, verify
 * the Ed25519 signature, and trigger a relaunch.
 *
 * Design notes:
 *   - Non-blocking: it never interrupts the user's flow. They can ignore it
 *     and it'll re-offer on the next launch.
 *   - Bottom-right corner so it doesn't overlap the always-pinned TopBar.
 *   - Mint→violet gradient frame to match the AiPanel signature look.
 *   - Tauri-only: dynamic-imports the plugin so a browser-mode dev build
 *     (npm run dev without `tauri dev`) doesn't choke on the missing IPC.
 */

type State =
  | { kind: 'idle' }                // before any check
  | { kind: 'no-update' }           // checked, nothing to install
  | { kind: 'available'; version: string; notes?: string }
  | { kind: 'installing'; pct: number }
  | { kind: 'installed' }           // ready to relaunch
  | { kind: 'error'; message: string };

const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export default function UpdatePrompt() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  // One-shot probe on mount.
  useEffect(() => {
    if (!isTauri()) return; // browser-mode dev: nothing to do
    let cancelled = false;

    // Defer the check by ~3s so it never blocks first render.
    const timer = setTimeout(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (cancelled) return;
        if (update) {
          setState({ kind: 'available', version: update.version, notes: update.body });
        } else {
          setState({ kind: 'no-update' });
        }
      } catch (err) {
        if (cancelled) return;
        // Network errors / endpoint unreachable land here. Silent — don't
        // pester the user with a "could not check for updates" toast every
        // launch. They can manually re-check from a future Settings entry.
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }, 3000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const handleInstall = async () => {
    if (state.kind !== 'available') return;
    setState({ kind: 'installing', pct: 0 });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        // Race — manifest changed between probe and click. Treat as no-op.
        setState({ kind: 'no-update' });
        return;
      }

      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall(event => {
        // Progress events: 'Started' (with content_length), 'Progress' (chunks), 'Finished'.
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength ?? 0;
          const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          setState({ kind: 'installing', pct });
        }
      });

      setState({ kind: 'installed' });

      // The plugin auto-relaunches on macOS/Linux but not Windows; calling
      // `relaunch` explicitly covers both. Wrap in plugin-process import.
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Update failed',
      });
    }
  };

  // Hide states the user shouldn't see at all.
  if (state.kind === 'idle' || state.kind === 'no-update' || state.kind === 'error') return null;
  if (dismissed) return null;

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-50 rounded-2xl"
      style={{
        padding: 1.5,
        background: 'linear-gradient(135deg, #00D9A3 0%, #00B589 50%, #7C3AED 100%)',
        maxWidth: 360,
      }}
    >
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-surface)' }}
      >
        {state.kind === 'available' && (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--color-accent-soft)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#00D9A3' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  Update available
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Post_Watch v{state.version} is ready to install.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="p-1 rounded text-text-muted hover:text-text-primary"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {state.notes && (
              <p className="text-[11px] leading-relaxed mb-3 line-clamp-3"
                style={{ color: 'var(--color-text-secondary)' }}>
                {state.notes}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center"
                style={{ background: '#00D9A3', color: '#1A2332' }}
              >
                <Download className="w-3.5 h-3.5" />
                Install & restart
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Later
              </button>
            </div>
          </>
        )}

        {state.kind === 'installing' && (
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#00D9A3' }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Downloading update…
              </div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-alt)' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${state.pct}%`, background: '#00D9A3' }}
                />
              </div>
              <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {state.pct}%
              </div>
            </div>
          </div>
        )}

        {state.kind === 'installed' && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#00D9A3' }} />
            <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Installed. Relaunching…
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
