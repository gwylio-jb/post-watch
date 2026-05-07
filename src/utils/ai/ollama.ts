/**
 * Local-LLM wrapper for Post_Watch's AI features.
 *
 * Talks to Ollama (https://ollama.com) over its REST API on the consultant's
 * machine — no API keys, no Anthropic billing, no data leaves the device.
 * That privacy story is the whole reason we picked this over a hosted LLM:
 * a security/compliance tool sending client gap analyses to a third-party
 * model is a tough sell.
 *
 * Endpoints used:
 *   GET  /api/tags    → list installed models
 *   POST /api/chat    → chat completion (NDJSON streaming)
 *
 * NDJSON streaming format (one JSON object per line):
 *   { "model": "...", "message": { "role": "assistant", "content": "..." }, "done": false }
 *   ...
 *   { "model": "...", "message": { "role": "assistant", "content": "" }, "done": true, ... }
 */

const DEFAULT_BASE_URL = 'http://localhost:11434';

/*
 * Why plain `fetch` (not `@tauri-apps/plugin-http`):
 *
 * Recent Ollama builds set `OLLAMA_ORIGINS` to include `tauri://*` by default
 * (visible in the `ollama serve` startup log) — i.e. it explicitly accepts
 * cross-origin requests from the Tauri WKWebView. So we don't need the
 * plugin-http indirection that we'd otherwise reach for to escape browser
 * CORS. Going direct is one fewer moving part: no Tauri capability config to
 * keep in sync, no risk of the plugin's URL-pattern matcher rejecting the
 * localhost host, no streaming-API mismatches between plugin and native
 * Response.
 *
 * If a future Ollama drops `tauri://*` from the default origins, restore
 * the plugin-http path — but until then, native is simpler and works.
 */
/**
 * Recommended model — small enough to run on most consultant laptops (≈ 2GB
 * RAM footprint), fast first-token latency, and the prompt complexity in
 * `prompts.ts` is well within its capability (rephrase / restructure /
 * format — not deep reasoning).
 */
export const RECOMMENDED_MODEL = 'llama3.2:3b';

export interface OllamaModel {
  name: string;            // e.g. "llama3.2:3b"
  size: number;            // bytes on disk
  modified_at: string;     // ISO timestamp
}

export interface GenerateOptions {
  baseUrl?: string;
  model: string;
  system: string;
  user: string;
  /** Cap output. Ollama will stop early if the model decides it's done. */
  maxTokens?: number;
  /** Temperature — 0.3 default keeps output focused and on-template. */
  temperature?: number;
  /** Live-stream callback for the AiPanel's typing-cursor effect. */
  onDelta?: (delta: string) => void;
  signal?: AbortSignal;
}

export type OllamaErrorCause = 'unreachable' | 'model-missing' | 'http' | 'aborted';

export class OllamaError extends Error {
  // Declared as a normal field — `erasableSyntaxOnly` (TS 5.8+) bans
  // constructor parameter properties because they emit runtime assignments.
  readonly cause?: OllamaErrorCause;
  constructor(message: string, cause?: OllamaErrorCause) {
    super(message);
    this.name = 'OllamaError';
    this.cause = cause;
  }
}

/**
 * Cheap reachability probe — used by the Settings panel to colour the
 * "Local AI" status pill green/amber. Returns `true` only if Ollama responds
 * to /api/tags within ~2 seconds.
 */
export async function ping(baseUrl: string = DEFAULT_BASE_URL): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * List models the user has actually `ollama pull`-ed. Used to populate the
 * model dropdown in Settings — we never default to a model that isn't
 * installed (the chat call would 404 and the failure would be confusing).
 */
export async function listModels(baseUrl: string = DEFAULT_BASE_URL): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) throw new OllamaError(`Ollama returned ${res.status}`, 'http');
    const data = await res.json() as { models?: OllamaModel[] };
    return data.models ?? [];
  } catch (e) {
    if (e instanceof OllamaError) throw e;
    throw new OllamaError(
      'Could not reach Ollama. Is it running? (`ollama serve` in a terminal, or open the Ollama app.)',
      'unreachable',
    );
  }
}

/**
 * Run a single chat completion. Streams NDJSON, assembles into one string,
 * fires `onDelta(chunk)` as content arrives.
 *
 * Errors:
 *   - 'unreachable' → Ollama isn't running
 *   - 'model-missing' → user picked a model they haven't pulled
 *   - 'aborted' → caller cancelled via AbortSignal
 *   - 'http' → anything else
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;

  const body = {
    model: opts.model,
    stream: true,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    options: {
      temperature: opts.temperature ?? 0.3,
      // Ollama uses `num_predict` for the equivalent of max_tokens.
      // -1 = no cap; -2 = fill context. We pass an explicit cap when set.
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch {
    if (opts.signal?.aborted) throw new OllamaError('Aborted', 'aborted');
    throw new OllamaError(
      'Could not reach Ollama at ' + baseUrl + '. Make sure it is running.',
      'unreachable',
    );
  }

  if (!res.ok) {
    // Ollama returns 404 with `{"error":"model 'foo' not found, try pulling it first"}`
    // for unknown models — surface that as a distinct cause so Settings can
    // tell the user *exactly* which `ollama pull` command to run.
    let detail = '';
    try {
      const j = await res.json() as { error?: string };
      detail = j.error ?? '';
    } catch { /* fall through */ }
    if (res.status === 404 || /not found|try pulling/i.test(detail)) {
      throw new OllamaError(
        detail || `Model "${opts.model}" not installed. Run \`ollama pull ${opts.model}\`.`,
        'model-missing',
      );
    }
    throw new OllamaError(detail || `Ollama HTTP ${res.status}`, 'http');
  }

  if (!res.body) throw new OllamaError('Ollama returned an empty body', 'http');

  // NDJSON: one JSON object per line. Buffer partial lines across chunks.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assembled = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };
          if (evt.error) throw new OllamaError(evt.error, 'http');
          const chunk = evt.message?.content;
          if (chunk) {
            assembled += chunk;
            opts.onDelta?.(chunk);
          }
          if (evt.done) {
            // Drain — server will close the stream after this anyway.
            break;
          }
        } catch (e) {
          if (e instanceof OllamaError) throw e;
          // Ignore malformed lines — Ollama occasionally pads with empty
          // keepalive frames during long generations.
        }
      }
    }
  } catch (e) {
    if (opts.signal?.aborted) throw new OllamaError('Aborted', 'aborted');
    if (e instanceof OllamaError) throw e;
    throw new OllamaError(e instanceof Error ? e.message : 'Stream error', 'http');
  } finally {
    reader.releaseLock();
  }

  return assembled;
}
