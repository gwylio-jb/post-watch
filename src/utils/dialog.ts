/**
 * Tauri-aware dialogs (confirm / alert / prompt).
 *
 * Synchronous `window.confirm()` / `alert()` / `prompt()` are unreliable
 * inside the Tauri v2 WKWebView — they return immediately (false / no-op /
 * null) because the IPC thread can't be blocked. That made every
 * `if (!confirm(...)) return;` branch silently early-exit, which was the
 * root cause of the "Delete client doesn't work" bug, and made the backup
 * passphrase prompts silently produce empty passphrases.
 *
 * These helpers:
 *   - inside Tauri, defer to the dialog plugin's async `confirm`/`message`
 *     so the user actually sees a native dialog
 *   - `promptDialog` has no native equivalent (the plugin has no text
 *     input), so it renders through <PromptHost /> — a small in-app modal
 *     mounted once near the App root (same bus pattern as UndoHost)
 *   - everywhere else (tests, web preview), fall back to the browser
 *     primitives so behaviour stays predictable
 *
 * Callers must `await` the result.
 */

interface ConfirmOptions {
  /** Window title (Tauri-only; ignored by the browser fallback). */
  title?: string;
  /** Label for the destructive/affirmative button. Defaults to "OK". */
  okLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Visual treatment hint in the Tauri dialog. */
  kind?: 'info' | 'warning' | 'error';
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (inTauri()) {
    try {
      const mod = await import('@tauri-apps/plugin-dialog');
      return await mod.confirm(message, {
        title: options.title,
        okLabel: options.okLabel,
        cancelLabel: options.cancelLabel,
        kind: options.kind,
      });
    } catch (e) {
      // If the plugin call itself blows up (capabilities misconfig,
      // mocked test runtime that lies about __TAURI_INTERNALS__),
      // fall back to the browser primitive rather than silently
      // returning false — silent-false is the exact failure mode we're
      // trying to escape here.
      console.warn('[dialog] Tauri confirm failed, falling back to window.confirm', e);
    }
  }
  try {
    return window.confirm(message);
  } catch {
    return false;
  }
}

/**
 * Tauri-aware alert. Resolves once the user dismisses the dialog.
 * Fire-and-forget callers may skip awaiting, but flows that continue
 * after acknowledgement should await.
 */
export async function alertDialog(
  message: string,
  options: Pick<ConfirmOptions, 'title' | 'kind'> = {},
): Promise<void> {
  if (inTauri()) {
    try {
      const mod = await import('@tauri-apps/plugin-dialog');
      await mod.message(message, { title: options.title, kind: options.kind });
      return;
    } catch (e) {
      console.warn('[dialog] Tauri message failed, falling back to window.alert', e);
    }
  }
  try {
    window.alert(message);
  } catch { /* headless env — nothing to show */ }
}

/* ─── promptDialog — in-app modal via PromptHost ─────────────────────── */

export interface PromptOptions {
  title?: string;
  /** Placeholder text inside the input. */
  placeholder?: string;
  /** Render the input as type=password (passphrase entry). */
  mask?: boolean;
  okLabel?: string;
  cancelLabel?: string;
  /** Pre-filled value. */
  defaultValue?: string;
}

export interface PendingPrompt {
  message: string;
  options: PromptOptions;
  /** Called exactly once — string on submit, null on cancel. */
  resolve: (value: string | null) => void;
}

let pendingPrompt: PendingPrompt | null = null;
const promptListeners = new Set<() => void>();

function emitPrompt(): void {
  for (const l of promptListeners) l();
}

/** PromptHost subscribes here to know when to render. */
export function subscribePrompt(listener: () => void): () => void {
  promptListeners.add(listener);
  return () => { promptListeners.delete(listener); };
}

export function getPendingPrompt(): PendingPrompt | null {
  return pendingPrompt;
}

/** PromptHost calls this to settle the active prompt. */
export function settlePrompt(value: string | null): void {
  const p = pendingPrompt;
  pendingPrompt = null;
  emitPrompt();
  p?.resolve(value);
}

/**
 * Ask the user for a line of text. Returns the entered string, or null
 * if they cancelled — mirroring window.prompt's contract.
 *
 * Requires <PromptHost /> to be mounted (it is, next to UndoHost in
 * App.tsx). If no host is listening — a test environment, or a call
 * before mount — falls back to window.prompt so the contract holds.
 */
export function promptDialog(message: string, options: PromptOptions = {}): Promise<string | null> {
  if (promptListeners.size === 0) {
    // No host mounted (tests / early boot) — browser fallback.
    try {
      return Promise.resolve(window.prompt(message, options.defaultValue ?? ''));
    } catch {
      return Promise.resolve(null);
    }
  }
  // Only one prompt at a time; a second call cancels the first rather
  // than queueing (matches how modal UIs behave everywhere else).
  if (pendingPrompt) pendingPrompt.resolve(null);
  return new Promise(resolve => {
    pendingPrompt = { message, options, resolve };
    emitPrompt();
  });
}
