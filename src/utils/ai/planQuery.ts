/**
 * Sprint 20: end-to-end NL → results pipeline.
 *
 * Thin orchestration layer: it asks Ollama for a JSON plan, parses it,
 * and runs it. The UI layer doesn't need to know about prompts or
 * NDJSON; it calls `planAndExecute(question, data, settings)` and gets
 * back either a list of results or a structured failure.
 *
 * Failures are explicit and non-throwing — the search UI falls back to
 * substring search whenever this returns `kind: 'failed'`.
 */
import { generate, OllamaError } from './ollama';
import {
  parseQueryPlan, PLANNER_SYSTEM_PROMPT,
  type QueryPlan,
} from './queryPlan';
import { executeQueryPlan, type ExecuteOptions, type QueryResult } from './queryExecutor';
import type { AiSettings } from '../../data/auditTypes';

export type PlanOutcome =
  | { kind: 'ok'; plan: QueryPlan; results: QueryResult[] }
  | { kind: 'failed'; reason: 'no-model' | 'unreachable' | 'model-missing' | 'unparseable' | 'aborted' | 'http'; detail?: string };

export interface PlanAndExecuteOptions {
  question: string;
  data: ExecuteOptions;
  settings: AiSettings;
  signal?: AbortSignal;
}

export async function planAndExecute(opts: PlanAndExecuteOptions): Promise<PlanOutcome> {
  const { question, data, settings, signal } = opts;
  if (!settings.model) {
    return { kind: 'failed', reason: 'no-model' };
  }

  let raw: string;
  try {
    raw = await generate({
      baseUrl: settings.baseUrl,
      model: settings.model,
      system: PLANNER_SYSTEM_PROMPT,
      user: question,
      // Small budget: the plan is a tiny JSON object. Keeps the round
      // trip snappy and bounds the worst case if the model rambles.
      maxTokens: 256,
      // Very low temperature — we want deterministic structure, not
      // creative variation in field names.
      temperature: 0.1,
      signal,
    });
  } catch (e) {
    if (e instanceof OllamaError) {
      const cause = e.cause ?? 'http';
      // Narrow to PlanOutcome's reason union — drop anything else.
      if (cause === 'unreachable' || cause === 'model-missing' || cause === 'aborted' || cause === 'http') {
        return { kind: 'failed', reason: cause, detail: e.message };
      }
    }
    return { kind: 'failed', reason: 'http', detail: (e as Error).message };
  }

  const plan = parseQueryPlan(raw);
  if (!plan) {
    return { kind: 'failed', reason: 'unparseable', detail: raw.slice(0, 200) };
  }

  const results = executeQueryPlan(plan, data);
  return { kind: 'ok', plan, results };
}
