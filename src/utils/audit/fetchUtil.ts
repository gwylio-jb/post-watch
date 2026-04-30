import type { CheckResult } from '../../data/auditTypes';

/**
 * True when running inside the Tauri desktop app.
 *
 * Tauri v2 exposes its bridge as `window.__TAURI_INTERNALS__` (the older v1
 * key `__TAURI__` is no longer injected by default). We check both so the
 * app keeps working in v1-era builds and dev previews.
 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

// ─── Per-host concurrency gate ────────────────────────────────────────────────
// The scanner fires 30+ checks in parallel; if they all hit the same origin at
// once, Tauri's HTTP plugin and/or upstream CDN/server cancels the overflow.
// Cap to MAX_PER_HOST in-flight per hostname; queue the rest.

const MAX_PER_HOST = 4;
const hostQueues = new Map<string, { active: number; waiters: Array<() => void> }>();

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

async function acquireHostSlot(host: string): Promise<() => void> {
  let entry = hostQueues.get(host);
  if (!entry) {
    entry = { active: 0, waiters: [] };
    hostQueues.set(host, entry);
  }
  if (entry.active < MAX_PER_HOST) {
    entry.active++;
  } else {
    await new Promise<void>(resolve => entry!.waiters.push(resolve));
    entry.active++;
  }
  return () => {
    entry!.active--;
    const next = entry!.waiters.shift();
    if (next) next();
  };
}

// ─── In-flight request dedup ──────────────────────────────────────────────────
// Several checks independently fetch the homepage HTML (jQuery detection, SRI,
// cookies, GDPR consent). Dedupe identical GETs so the page is fetched once
// and the Response is cloned for each caller.

// A neutral browser-like User-Agent. Some APIs (SSL Labs / Cloudflare-fronted
// services) 403 requests that look like bots or scanners, so we avoid any
// "scanner"/"bot" substrings here.
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Safari/605.1.15 Post_Watch/2.1';

const inflightGets = new Map<string, Promise<Response>>();

function dedupKey(url: string, method: string): string {
  return `${method.toUpperCase()} ${url}`;
}

/**
 * Fetch that uses the Tauri HTTP plugin (which bypasses CORS via OS-level HTTP)
 * when running in the desktop app, and falls back to the browser fetch API otherwise.
 *
 * - Caps in-flight requests per host to avoid upstream cancellation
 * - Dedupes simultaneous identical GET/HEAD requests (same URL+method) so
 *   overlapping checks share one network call
 * - Sends a User-Agent (required by SSL Labs and polite to any upstream)
 * - Default 25s timeout (TLS handshake + slow hosts can legitimately take 10s+)
 *
 * CORS-restricted checks return SKIPPED_TAURI in browser mode — not an error.
 */
export async function auditFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const canDedupe = method === 'GET' || method === 'HEAD';
  const key = dedupKey(url, method);

  if (canDedupe) {
    const existing = inflightGets.get(key);
    if (existing) {
      // Clone the response so each caller can consume the body independently.
      return existing.then(r => r.clone());
    }
  }

  const promise = (async () => {
    const headers = new Headers(options?.headers as HeadersInit | undefined);
    if (!headers.has('user-agent') && !headers.has('User-Agent')) {
      headers.set('User-Agent', DEFAULT_USER_AGENT);
    }
    const opts: RequestInit = {
      signal: AbortSignal.timeout(25_000),
      ...options,
      headers,
    };
    const release = await acquireHostSlot(hostOf(url));
    try {
      if (isTauri()) {
        try {
          const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
          return (await tauriFetch(url, opts)) as unknown as Response;
        } catch (e) {
          throw new Error(`Tauri fetch failed for ${url}: ${describeError(e)}`);
        }
      }
      return await fetch(url, opts);
    } finally {
      release();
    }
  })();

  if (canDedupe) {
    inflightGets.set(key, promise);
    promise.finally(() => {
      // Evict once settled so stale responses don't accumulate across scans.
      if (inflightGets.get(key) === promise) inflightGets.delete(key);
    });
    return promise.then(r => r.clone());
  }
  return promise;
}

/**
 * Extract a useful human-readable string from any thrown value.
 *
 * Browsers often throw errors with empty `.message` fields (e.g. WebKit
 * produces "Load failed" with no further detail on CORS/network failures);
 * Tauri sometimes throws plain strings or objects. We normalise them all
 * so check results never surface literal `undefined` to users.
 */
export function describeError(e: unknown): string {
  if (e == null) return 'unknown error';
  if (typeof e === 'string') return e || 'unknown error';
  if (e instanceof Error) {
    const msg = e.message?.trim();
    if (msg) return msg;
    if (e.name) return e.name;
    return 'unknown error';
  }
  if (typeof e === 'object') {
    const obj = e as { message?: unknown; error?: unknown };
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    try {
      return JSON.stringify(e);
    } catch {
      return 'unknown error';
    }
  }
  return String(e);
}

/** Returned by checks that need Tauri when running in browser. */
export const SKIPPED_TAURI: CheckResult = {
  status: 'skipped',
  detail: 'Browser fetch blocked by CORS — this check only runs in the Post_Watch desktop app.',
  recommendation: 'Open this scan inside the Post_Watch desktop build for full coverage.',
};

/** Returned when an API key is missing for an optional check. */
export function skippedApiKey(apiName: string): CheckResult {
  return {
    status: 'skipped',
    detail: `${apiName} API key not configured — check skipped.`,
    recommendation: `Add your ${apiName} API key in the API Keys section to enable this check.`,
  };
}
