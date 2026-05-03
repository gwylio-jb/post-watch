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

import type { AuditCheck, AuditReport, SeverityLevel } from '../../data/auditTypes';
import type { GapAnalysisSession, ManagementClause, AnnexAControl, Client } from '../../data/types';
import type { Deliverable } from '../../data/implementationData';

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

// ─── Feature 4: Prioritised action plan (Sprint 9) ───────────────────────────

/**
 * "Prioritised action plan" — takes a complete WP scan report and produces a
 * 1-week / 1-month / 1-quarter remediation roadmap the consultant can paste
 * into a client email. Triages all findings in one pass instead of the
 * per-finding explainer flow.
 *
 * Why this is its own prompt rather than a longer explainer: the consultant
 * needs *ordering* (do X before Y), not just per-finding rationale. Forcing
 * the model to bucket by timeline produces a more decisive output.
 */
export function actionPlanPrompt(
  report: AuditReport,
  ctx: ClientContext,
): { system: string; user: string } {
  // Group failing/warning findings by severity so the prompt has a clear
  // signal about what's urgent vs. tidy-up.
  const SEV: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
  const issueChecks = report.checks
    .filter(c => c.result?.status === 'fail' || c.result?.status === 'warning');
  const grouped = SEV.map(sev => ({
    sev,
    items: issueChecks.filter(c => c.worstCaseSeverity === sev),
  })).filter(g => g.items.length > 0);

  // Cap each severity bucket at 8 items in the prompt — beyond that the model
  // gets verbose and the consultant just wants the headlines anyway. The full
  // detail is in the scan report itself.
  const summary = grouped
    .map(g => {
      const sample = g.items.slice(0, 8)
        .map(c => `  - ${c.name}${c.result?.detail ? ` — ${c.result.detail.slice(0, 140)}` : ''}`)
        .join('\n');
      const more = g.items.length > 8 ? `\n  - …and ${g.items.length - 8} more ${g.sev.toLowerCase()} findings` : '';
      return `${g.sev} (${g.items.length}):\n${sample}${more}`;
    })
    .join('\n\n');

  const passedCount = report.checks.filter(c => c.result?.status === 'pass').length;

  const system = [
    'You are a security consultant translating a WordPress audit into a remediation plan.',
    'Audience: an SMB business owner or operations lead — assume non-technical.',
    'Tone: pragmatic, decisive, no alarmism. You are giving them a path forward.',
    'Length: 250–400 words.',
    'Structure (use these exact section headings as plain text on their own lines, no markdown):',
    '  This week — bullet list of 2–4 most urgent actions (Critical + High severity work). Each item: short imperative + one-line "why".',
    '  This month — bullet list of 3–5 medium-priority actions. Same format.',
    '  This quarter — bullet list of 2–4 strategic improvements (Low severity, hardening, monitoring).',
    '  Standing strong — 1 short paragraph crediting what is already in good shape, based on what passed.',
    'Decisive ordering matters: if action A is a prerequisite for action B, A goes first.',
    'No preamble, no salutation, no closing sign-off — start with "This week".',
  ].join('\n');

  const user = [
    ctx.client?.name ? `Client: ${ctx.client.name}` : '',
    ctx.client?.industry ? `Industry: ${ctx.client.industry}` : '',
    `Domain scanned: ${report.domain}`,
    `Overall score: ${report.score}/100`,
    `Findings requiring attention: ${issueChecks.length}`,
    `Checks passed: ${passedCount}`,
    '',
    'Findings by severity:',
    summary || '(none — all checks passed or were skipped)',
    '',
    'Write the prioritised action plan now.',
  ].filter(Boolean).join('\n');

  return { system, user };
}

// ─── Feature 5: Implementation deliverable drafter (Sprint 9) ────────────────

/**
 * "Draft starter content" — given an implementation deliverable (a policy
 * doc or workshop placeholder) plus the client context, produce a tailored
 * first-draft body the consultant can edit into final form.
 *
 * Two output shapes depending on `deliverable.type`:
 *   - `document`  → policy/procedure body with sections.
 *   - `workshop`  → facilitator agenda with timing.
 *
 * The prompt deliberately keeps the output short — first-draft, not final.
 * The consultant's job is to tailor it; ours is to remove the blank-page
 * problem.
 */
export function implementationDraftPrompt(
  deliverable: Deliverable,
  projectClientName: string,
  ctx: ClientContext,
): { system: string; user: string } {
  // Combine the project's embedded client name (always set, even for ad-hoc
  // projects with no Clients-hub link) with whatever extra context we have
  // from the central record.
  const clientName = ctx.client?.name?.trim() || projectClientName;
  const industry = ctx.client?.industry?.trim();
  const notes = ctx.client?.notes?.trim();

  if (deliverable.type === 'workshop') {
    const system = [
      'You are an ISO 27001 implementation lead drafting a workshop agenda.',
      'Audience: the facilitator (the consultant). The output goes into their notes app, not to the client.',
      'Length: 180–280 words.',
      'Structure (plain text section headings, no markdown):',
      '  Workshop purpose — 1–2 sentence statement of the session\'s objective.',
      '  Duration — recommended length (e.g. "60–90 minutes").',
      '  Attendees — who needs to be in the room.',
      '  Agenda — numbered list of 4–8 segments, each with an estimated duration in parentheses.',
      '  Outputs — bullet list of artefacts the workshop should produce.',
      'No preamble, no closing.',
    ].join('\n');

    const user = [
      `Workshop: ${deliverable.name}`,
      deliverable.section ? `Programme section: ${deliverable.section}` : '',
      `Client: ${clientName}`,
      industry ? `Industry: ${industry}` : '',
      notes ? `Client context notes: ${notes}` : '',
      '',
      'Draft the workshop agenda now.',
    ].filter(Boolean).join('\n');

    return { system, user };
  }

  // type === 'document'
  const system = [
    'You are an ISO 27001 implementation lead drafting a starter policy/procedure document.',
    'Audience: the consultant, who will tailor this draft into the client\'s final document.',
    'Tone: formal, ISO-aligned, but human — written for an SMB, not an enterprise.',
    'Length: 350–550 words. First draft only — focus on structure and key clauses; the consultant will fill in client-specific details.',
    'Structure (plain text section headings, no markdown):',
    '  Purpose — 1 paragraph stating what this document covers and why.',
    '  Scope — 1 paragraph stating who/what this applies to.',
    '  Policy / Procedure — the substantive content as numbered or bulleted clauses, depending on what suits the document.',
    '  Roles & responsibilities — short bullet list.',
    '  Review cycle — 1 sentence noting how often this is reviewed (default: annually).',
    'Use square-bracket placeholders like [Client Name] or [Date of last review] only where genuinely client-specific.',
    'No preamble, no closing — start with "Purpose".',
  ].join('\n');

  const user = [
    `Document: ${deliverable.name}`,
    deliverable.section ? `Programme section: ${deliverable.section}` : '',
    `Client: ${clientName}`,
    industry ? `Industry: ${industry}` : '',
    notes ? `Client context notes: ${notes}` : '',
    '',
    'Draft the starter document now.',
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
