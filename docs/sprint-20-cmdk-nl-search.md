# Sprint 20 — Cmd+K conversational search

**Target version:** 2.12.0
**Theme:** ask questions in plain English; get filtered local data back.

## Why

Cmd+K today is a substring matcher over clauses/controls/questions/
evidence. It's useful but it can't answer questions like:

- "show me high-severity risks for Acme that aren't accepted"
- "audit reports from last month with WordPress findings"
- "controls without evidence attached"

These are filter compositions over local data the app already holds.
We don't need a vector store or RAG — we need to turn the question
into a structured query and execute it locally.

## Approach

A small two-step pipeline that runs entirely on-device:

1. **Plan.** Send the user's question to Ollama with a system prompt
   that constrains output to a JSON `QueryPlan`. The plan names a
   `collection` and a list of typed `filters`.
2. **Execute.** Run the plan against in-memory data we already have
   (risks, clients, reports, sessions). No DB, no network.

The plan schema is intentionally tiny — fewer fields = fewer hallucination
surfaces. If the model produces malformed JSON or names an unknown
collection, we fall back to the existing substring search.

## Schema

```ts
type Collection = 'risks' | 'reports' | 'sessions' | 'clients';
type Filter =
  | { field: 'clientName'; op: 'equals' | 'contains'; value: string }
  | { field: 'severity'; op: 'in'; value: Severity[] }
  | { field: 'status'; op: 'in'; value: string[] }
  | { field: 'createdAt'; op: 'after' | 'before'; value: string /* ISO */ };
type QueryPlan = {
  collection: Collection;
  filters: Filter[];
  /** Plain-English summary the model produces to caption the results. */
  summary?: string;
};
```

## UX

Reuse the existing GlobalSearch modal:
- Detect "natural language" intent heuristically — query length > 12
  chars OR contains a verb-like token (`show`, `list`, `find`).
- Show an "Ask Post_Watch" affordance at the top of the dropdown
  while the input has focus. Clicking (or pressing ⌘↵) runs the plan.
- Streaming planner output renders as a one-line status; when the
  plan resolves, results render as a grouped list (same component as
  the existing search results, different result type).

## Out of scope

- Multi-step / agentic plans
- Aggregations (counts, averages) — list filters only
- Persisting plans for replay
- Fallback to a hosted LLM (Ollama-only stays the privacy promise)

## Tests

- `queryPlan.test.ts` — JSON extraction tolerant of markdown fences,
  trailing prose, missing-field defaults; rejects unknown collections.
- `queryExecutor.test.ts` — each filter shape against fixtures.

## Acceptance

- With Ollama running + a model pulled, typing "high risks for Acme"
  produces a filtered risk list within a few seconds.
- Without Ollama, the field falls back to substring search with no
  visible failure mode.
