/**
 * Prompt builders for the three Sprint 8 AI features.
 *
 * Each builder returns a `{ system, user }` pair fed straight into
 * `claude.generate()`. Keep prompts small and concrete — Opus 4.7 follows
 * instructions literally, so over-prompting causes overtriggering.
 *
 * Convention: every prompt instructs Claude to OMIT preamble ("Here is...")
 * and respond with the substantive content directly. The consultant copies
 * the body into a client email or appends it to a PDF — they don't want
 * Claude's framing.
 */

import type { AuditCheck } from '../../data/auditTypes';
import type { GapAnalysisSession, ManagementClause, AnnexAControl, Client } from '../../data/types';

interface ClientContext {
  client?: Client;
}

// ─── Feature 1: Plain-English finding explainer ──────────────────────────────

/**
 * "Explain to my client" — takes a single WP scan finding plus optional
 * client context (industry, notes) and returns a short, audience-tuned
 * paragraph the consultant can paste into an email.
 */
export function explainFindingPrompt(
  check: AuditCheck,
  ctx: ClientContext,
): { system: string; user: string } {
  const result = check.result;
  const industry = ctx.client?.industry?.trim();
  const clientName = ctx.client?.name?.trim();
  const audience = industry
    ? `a non-technical decision-maker at a ${industry} business`
    : 'a non-technical business owner';

  const system = [
    'You are a security consultant explaining technical findings to clients.',
    'Audience: ' + audience + '.',
    'Tone: calm, professional, jargon-free. No alarmism, no condescension.',
    'Length: 100–180 words, two short paragraphs.',
    'Structure: paragraph 1 explains what was found and why it matters in business terms; paragraph 2 explains the recommended next step.',
    'Output the explanation directly — no preamble, no "Here is...", no headings, no lists.',
  ].join('\n');

  const user = [
    `Finding: ${check.name}`,
    `Severity: ${check.worstCaseSeverity}`,
    `What we observed: ${result?.detail ?? 'N/A'}`,
    result?.recommendation ? `Standard remediation: ${result.recommendation}` : '',
    clientName ? `\nClient: ${clientName}` : '',
    industry ? `Industry: ${industry}` : '',
    ctx.client?.notes ? `Context notes: ${ctx.client.notes}` : '',
    '\nWrite the client-facing explanation now.',
  ].filter(Boolean).join('\n');

  return { system, user };
}

// ─── Feature 2: Compliance gap narrative ─────────────────────────────────────

/**
 * "Draft management commentary" — takes a gap analysis session and produces
 * a board-pack-ready narrative memo summarising compliance position, key
 * gaps, and recommended priorities.
 */
export function gapNarrativePrompt(
  session: GapAnalysisSession,
  clauses: ManagementClause[],
  controls: AnnexAControl[],
  ctx: ClientContext,
): { system: string; user: string } {
  const total = session.items.length;
  const compliant = session.items.filter(i => i.status === 'Compliant').length;
  const partial = session.items.filter(i => i.status === 'Partially Compliant').length;
  const nonCompliant = session.items.filter(i => i.status === 'Non-Compliant').length;
  const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  // Resolve titles for the top gaps so Claude can name them in the narrative
  // without us having to send the entire 27001 catalogue (most of which is
  // irrelevant to this session's gaps).
  const lookupTitle = (id: string, type: 'clause' | 'control'): string => {
    const src = type === 'clause'
      ? clauses.find(c => c.id === id)
      : controls.find(c => c.id === id);
    return src?.title ?? id;
  };

  const topGaps = session.items
    .filter(i => i.status === 'Non-Compliant' || i.status === 'Partially Compliant')
    .sort((a, b) => {
      const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    })
    .slice(0, 12)
    .map(i => `- [${i.priority}] ${i.itemType === 'clause' ? 'Clause' : 'Control'} ${i.itemId} — ${lookupTitle(i.itemId, i.itemType)} (${i.status})${i.notes ? `: ${i.notes}` : ''}`)
    .join('\n');

  const system = [
    'You are an ISO 27001 lead auditor drafting management commentary for a board pack.',
    'Tone: concise, factual, executive-friendly. No filler ("It is important to note..."), no speculation.',
    'Length: 250–400 words.',
    'Structure (use these exact section headings as plain text on their own lines, no markdown):',
    '  Position summary — one short paragraph: where the organisation stands.',
    '  Material gaps — bullet list of the 3–6 most material gaps, each one line.',
    '  Recommended priorities — numbered list of the next 3–5 actions in order.',
    'Output the memo directly — no preamble, no opening salutation, no closing sign-off.',
  ].join('\n');

  const user = [
    ctx.client?.name ? `Client: ${ctx.client.name}` : '',
    ctx.client?.industry ? `Industry: ${ctx.client.industry}` : '',
    `Session: ${session.name}`,
    `Items assessed: ${total}`,
    `Compliant: ${compliant} (${pct}%)`,
    `Partially Compliant: ${partial}`,
    `Non-Compliant: ${nonCompliant}`,
    '',
    'Top open gaps (highest priority first):',
    topGaps || '(none)',
    '',
    'Write the management commentary now.',
  ].filter(Boolean).join('\n');

  return { system, user };
}

// ─── Feature 3: Remediation snippet generator ────────────────────────────────

/**
 * "Generate fix" — takes a WP scan finding and produces a ready-to-paste
 * code snippet (.htaccess directive, wp-config.php constant, nginx block,
 * etc.) with inline comments. Only enabled in the UI for findings whose
 * remediation involves config files (the wiring layer decides; this prompt
 * trusts the caller).
 */
export function remediationSnippetPrompt(
  check: AuditCheck,
  ctx: ClientContext,
): { system: string; user: string } {
  const system = [
    'You are a senior WordPress / web security engineer.',
    'Produce a single ready-to-paste configuration snippet that fixes the finding below.',
    'Choose the most appropriate target file (.htaccess, wp-config.php, nginx.conf, functions.php, etc.) based on the finding.',
    'Format:',
    '  Line 1: a single comment line stating the target file path and what the snippet does.',
    '  Lines 2+: the snippet itself, with inline comments explaining each non-obvious directive.',
    'Wrap the entire output in a fenced code block with the right language hint (apache, php, nginx, etc.).',
    'After the code block, add ONE short paragraph (≤ 60 words) covering: where to paste, what to test, any rollback note.',
    'No preamble. No "Here is your fix:" — start with the code block.',
    'If the finding cannot be fixed with a config snippet (e.g. it requires a plugin update or a third-party API key), say so in one sentence instead of inventing a snippet.',
  ].join('\n');

  const user = [
    `Finding: ${check.name}`,
    `Category: ${check.category}`,
    `Severity: ${check.worstCaseSeverity}`,
    `What we observed: ${check.result?.detail ?? 'N/A'}`,
    check.result?.evidence ? `Evidence: ${check.result.evidence.slice(0, 600)}` : '',
    check.result?.recommendation ? `Standard remediation guidance: ${check.result.recommendation}` : '',
    ctx.client?.name ? `\nTarget site context: ${ctx.client.name}` : '',
    '\nGenerate the fix now.',
  ].filter(Boolean).join('\n');

  return { system, user };
}
