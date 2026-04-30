/**
 * Open an external URL in the user's default browser.
 *
 * In Tauri, `<a target="_blank">` and `window.open` do not navigate — the
 * webview is sandboxed. We use the `tauri-plugin-opener` plugin which routes
 * the request through the OS shell. In a regular browser context, we fall
 * back to `window.open`.
 *
 * Safe against missing plugin: if the opener plugin fails to load for any
 * reason, we fall back to `window.open` so at least non-Tauri builds work.
 */

import { isTauri } from './audit/fetchUtil';

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (e) {
      // Plugin missing or permission denied — fall through to browser.
      console.warn('openExternal: Tauri opener unavailable, falling back to window.open', e);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
