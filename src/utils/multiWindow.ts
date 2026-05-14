/**
 * Sprint 19: open a second Post_Watch window pointed at a chosen page.
 *
 * Tauri v2 exposes `WebviewWindow` for creating extra windows. We give
 * each new window a unique label (`secondary-<n>`) that matches the
 * `secondary-*` glob in capabilities/default.json, so it inherits the
 * same permission set as the main window.
 *
 * The new window loads the same SPA bundle with a hash route. The
 * existing in-app router is hash-based, so the new window mounts the
 * requested section on first paint without an extra navigation tick.
 *
 * No-op (silent return) outside the Tauri runtime — useful for tests
 * and the web preview build.
 */
import type { AppSection } from '../data/types';

export interface NewWindowOptions {
  /** Initial section to mount in the new window. */
  section?: AppSection;
  /** Window title; default "Post_Watch". */
  title?: string;
}

let counter = 0;

export async function openNewWindow(opts: NewWindowOptions = {}): Promise<boolean> {
  // Dynamic import keeps the dependency out of the web bundle's
  // top-level — module resolution still works under Vite but the
  // runtime no-ops outside Tauri.
  let WebviewWindowCtor: typeof import('@tauri-apps/api/webviewWindow').WebviewWindow | null = null;
  try {
    const mod = await import('@tauri-apps/api/webviewWindow');
    WebviewWindowCtor = mod.WebviewWindow;
  } catch {
    // SDK not present (web build, jest env) — silently skip.
    return false;
  }

  // Detect non-Tauri runtime — the import resolves but the IPC bridge
  // isn't there, and constructing the window would throw async.
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return false;
  }

  counter += 1;
  const label = `secondary-${Date.now()}-${counter}`;
  const hash = opts.section ? `#/${opts.section}` : '';

  const win = new WebviewWindowCtor(label, {
    url: `/${hash}`,
    title: opts.title ?? 'Post_Watch',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    resizable: true,
    decorations: true,
    focus: true,
  });

  return new Promise(resolve => {
    win.once('tauri://created', () => resolve(true));
    win.once('tauri://error', e => {
      console.error('[multiWindow] failed to create window', e);
      resolve(false);
    });
  });
}
