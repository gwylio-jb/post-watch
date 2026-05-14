/**
 * Sprint 20: structured query plan emitted by the NL → query planner.
 *
 * The plan schema is deliberately small. Every additional field is
 * another thing the local model might hallucinate. We strictly validate
 * on parse and fall back to substring search on any rejection.
 *
 * The planner runs Ollama with a system prompt that asks for ONLY JSON
 * matching this schema. In practice 3B-class models add a markdown
 * fence or a trailing "here's your JSON:" preamble — `extractJson`
 * tolerates both shapes.
 */

export type QueryCollection = 'risks' | 'reports' | 'sessions' | 'clients';

export type SeverityBucket = 'low' | 'medium' | 'high' | 'critical';
export const SEVERITY_BUCKETS: SeverityBucket[] = ['low', 'medium', 'high', 'critical'];

/** Discriminated union — each filter shape is explicit so executor is exhaustive. */
export type QueryFilter =
  | { field: 'clientName'; op: 'equals' | 'contains'; value: string }
  | { field: 'severity';   op: 'in'; value: SeverityBucket[] }
  | { field: 'status';     op: 'in'; value: string[] }
  | { field: 'createdAt';  op: 'after' | 'before'; value: string };

export interface QueryPlan {
  collection: QueryCollection;
  filters: QueryFilter[];
  /** Optional one-line caption the model produced (shown above results). */
  summary?: string;
}

const VALID_COLLECTIONS: ReadonlySet<string> = new Set(['risks', 'reports', 'sessions', 'clients']);
const VALID_FILTER_FIELDS: ReadonlySet<string> = new Set(['clientName', 'severity', 'status', 'createdAt']);

/**
 * Pull a JSON object out of raw model output. Handles:
 *   - bare JSON
 *   - ```json … ``` fences
 *   - leading / trailing prose around an object
 */
export function extractJson(raw: string): unknown {
  if (!raw) return null;
  // First try a fenced block.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // Then try the first {...} we can find that balances.
  const start = raw.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(raw.slice(start, i + 1));
          break;
        }
      }
    }
  }

  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return null;
}

function isQueryFilter(v: unknown): v is QueryFilter {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.field !== 'string' || !VALID_FILTER_FIELDS.has(o.field)) return false;
  if (typeof o.op !== 'string') return false;

  switch (o.field) {
    case 'clientName':
      return (o.op === 'equals' || o.op === 'contains') && typeof o.value === 'string';
    case 'severity':
      return o.op === 'in'
        && Array.isArray(o.value)
        && o.value.every(x => typeof x === 'string' && SEVERITY_BUCKETS.includes(x as SeverityBucket));
    case 'status':
      return o.op === 'in'
        && Array.isArray(o.value)
        && o.value.every(x => typeof x === 'string');
    case 'createdAt':
      return (o.op === 'after' || o.op === 'before')
        && typeof o.value === 'string'
        && !Number.isNaN(Date.parse(o.value));
    default:
      return false;
  }
}

/**
 * Parse + validate a QueryPlan from raw LLM output. Returns null when
 * the output can't be coerced into the schema; callers should fall back
 * to substring search rather than surfacing an error.
 */
export function parseQueryPlan(raw: string): QueryPlan | null {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.collection !== 'string' || !VALID_COLLECTIONS.has(obj.collection)) return null;

  const filtersRaw = Array.isArray(obj.filters) ? obj.filters : [];
  const filters: QueryFilter[] = [];
  for (const f of filtersRaw) {
    if (isQueryFilter(f)) filters.push(f);
  }

  return {
    collection: obj.collection as QueryCollection,
    filters,
    summary: typeof obj.summary === 'string' ? obj.summary : undefined,
  };
}

/**
 * The system prompt sent to Ollama. Inlining here so it's testable and
 * version-controlled alongside the schema definition.
 */
export const PLANNER_SYSTEM_PROMPT = `You convert a user's natural-language question about a security/compliance dataset into a JSON query plan.

Reply ONLY with a JSON object — no prose, no markdown fences. The object must match this TypeScript type:

type QueryPlan = {
  collection: "risks" | "reports" | "sessions" | "clients";
  filters: Array<
    | { field: "clientName"; op: "equals" | "contains"; value: string }
    | { field: "severity"; op: "in"; value: ("low"|"medium"|"high"|"critical")[] }
    | { field: "status"; op: "in"; value: string[] }
    | { field: "createdAt"; op: "after" | "before"; value: string /* ISO date */ }
  >;
  summary?: string; // one short sentence describing what you returned
};

Guidance:
- Pick the single most relevant collection. Risks = risk register entries. Reports = WordPress audit reports. Sessions = ISO gap analysis sessions. Clients = customer records.
- Map severity words: "critical" → ["critical"], "high"/"severe" → ["high","critical"], "low" → ["low"]. Score 20+ = critical, 12-19 = high, 6-11 = medium, <6 = low.
- For "last month" / "this week" etc., emit an ISO date in the appropriate "after" filter.
- If unsure about a filter, omit it. Empty filters[] is fine — better to over-return than to invent.
- Status values for risks are "Open" | "In Treatment" | "Closed". Use exact casing.`;
