# Sprint 13+ Discovery — Drafter suite, Portfolio mode, and the road behind them

**Status:** discovery (no code yet)
**Sprint 13 scope:** feature packs 1 (Drafter suite) and 2 (Portfolio mode) — full plans
**Future sprints:** packs 3–6 are scoped lightly here so the architectural
choices we make now don't paint us into a corner later.

The TL;DR for an impatient reader:

- **Sprint 13 is two parallel tracks.** Pack 1 reuses the existing
  `prompts.ts` + `AiPanel` + Ollama plumbing — every new drafter is one
  prompt builder + one entry point button. Pack 2 needs new infrastructure
  (background-task queue, cron-style scheduler) that downstream sprints
  also benefit from.
- **The single biggest cross-cutting decision** is whether scheduled
  re-scans run while the app is closed (full background daemon) or only
  while the app is open (foreground queue). Recommend **foreground-only
  for v1**, daemon mode flagged as a future sprint. Reasoning in §3.2.
- **Storage version bump to 2** lands in Sprint 13 — Pack 2 adds
  `wp-audit-queue` and `wp-audit-schedule` keys; Pack 3 (encryption) will
  bump to 3. Migration helper extended.
- Packs 3–6 don't change Sprint 13's plan, but a couple of architectural
  hooks save real refactor pain later. Flagged in §6.

---

## 1. Why this doc exists

User has approved the six-pack roadmap from the previous discussion and
wants 1+2 next. Without a written discovery the risk is that we make
implementation choices in Sprint 13 that turn into expensive refactors
during Sprints 14–17. This doc:

1. Pins down the UX shape, data model, and prompt scaffolding for Sprint 13
   so the implementation can run in one focused pass without re-asking
   "wait, where does this live?"
2. Surfaces a small number of cross-cutting architectural decisions that
   have to be made now (e.g. background-task plugin, prompt registry
   shape, storage migration timing).
3. Captures lighter scoping for Packs 3–6 so future sprints have a
   starting point.

**Out of scope here:** pixel-level UI mocks, full TSX, complete prompt
text. Those land at implementation time.

---

## 2. Sprint 13, Pack 1 — Drafter suite (full plan)

### 2.1 Goals

Extend the existing AI assist pattern (currently three buttons:
`Explain to my client`, `Action plan`, `Generate fix`) across the
deliverable boundaries consultants charge for. Every drafter:

- Runs locally via Ollama. No client data leaves the device.
- Shares the existing `AiPanel` modal — same streaming output, same
  copy/regenerate/close UX.
- Has one prompt builder in `src/utils/ai/prompts.ts`.
- Is reachable from the page where its input data lives (no global "AI
  hub" — discoverability follows the data).

### 2.2 Drafters in scope

Five drafters, ranked by effort. Sprint 13 ships **tier 1** (drafters 1
and 2). Tiers 2 and 3 are queued for the same release if Sprint 13 has
slack, otherwise they spill into a Sprint 13.5.

| # | Drafter | Lives in | Tier | Effort | Notes |
|---|---|---|---|---|---|
| 1 | **Statement of Applicability** drafter | ComplyModule → Gap Analysis session view | 1 | M | Highest commercial value — every ISO 27001 audit needs an SoA. Existing `gapNarrativePrompt` is a board-pack memo, not an SoA — distinct deliverable. |
| 2 | **Risk treatment plan** drafter | RiskRegister → row action | 1 | S | Per-risk inline button; outputs treatment paragraph + suggested actions. Reuses risk fields already captured. |
| 3 | **Policy stub** generator | AuditModule → ClauseExplorer / ControlExplorer per-row | 2 | M | "Draft a starter policy for A.5.1" → ISP outline. Useful for greenfield engagements. |
| 4 | **Client-comms email** composer | ScanReport — toolbar button | 2 | S | Turns a scan report into a sendable email. Variant of existing action-plan flow with a different system prompt and tone. |
| 5 | **Audit interview question** generator | ComplyModule → CheatsheetBuilder OR per-control row | 3 | S | Internal-audit interview questions per control area, scoped to industry. |

### 2.3 UX

For every drafter, the entry point is a button labelled with a clear
verb ("Draft SoA section", "Draft treatment plan", "Draft policy
outline", "Draft client email", "Draft audit questions"). Disabled when
no Ollama model is configured, with a tooltip pointing to Settings.

The `AiPanel` already supports the workflow we need (system + user
prompt, streaming output, regenerate, copy to clipboard, close). One
addition for Sprint 13: an **insert-at-cursor** option on the panel that
writes the generated text into the relevant freetext field (e.g. risk
`treatmentDescription`, gap item `notes`) instead of just exposing
copy/paste. Saves consultants a step. Two new props on AiPanel:

```ts
interface AiPanelProps {
  // ...existing props
  /** Optional callback fired when the user clicks "Use this draft". */
  onAccept?: (text: string) => void;
  /** Label for the accept button — defaults to "Use this draft". */
  acceptLabel?: string;
}
```

When `onAccept` is provided, AiPanel renders a primary "Use this draft"
button alongside Copy. Otherwise it falls back to current behaviour.

### 2.4 Prompt scaffolding

`src/utils/ai/prompts.ts` already exports five prompt builders. Adding
five more keeps the file at ~700 lines — no need to split yet. Pattern
stays the same:

```ts
export function statementOfApplicabilityPrompt(
  session: GapAnalysisSession,
  controls: AnnexAControl[],
  ctx: ClientContext,
): { system: string; user: string } { /* ... */ }
```

Each prompt builder returns `{ system, user }`. AiPanel passes both
through to the streaming chat endpoint.

**Common shape across all drafters:**

- **System prompt** sets the role ("You are an ISO 27001 lead consultant
  drafting a Statement of Applicability section for a client's ISMS"),
  the tone (formal-but-readable, UK English), the output format (markdown
  with explicit section headings), and constraints (no fabricated
  citations, defer to user override).
- **User prompt** carries the structured input (the session items, the
  client context, the relevant control title, etc.) plus a clear
  "Draft the following: ..." instruction.

**Token budgets** — current prompts stay under 1500 input tokens and
target ≤800 output tokens. New drafters target the same envelope. SoA
sections are the longest (≤1200 output) — bump that one's `maxTokens`.

**No prompt-injection surface to worry about.** Inputs are user-typed
in the consultant's own UI; there's no untrusted text being fed into
the prompt at runtime. We do still escape any `{` `}` template-syntax
characters in user input before interpolating, mirroring what the
existing builders do.

### 2.5 Data model

**Zero schema changes.** Every drafter operates on existing types
(`AuditReport`, `AuditCheck`, `RiskItem`, `GapAnalysisSession`,
`Client`). Output is text — when accepted via the new `onAccept`
callback, it lands in existing freetext fields:

| Drafter | Lands in |
|---|---|
| SoA | New `GapAnalysisSession.soaDraft?: string` (single field, optional) |
| Risk treatment | `RiskItem.treatmentDescription` (existing field) |
| Policy stub | Copy-only (no field for policies yet — could land in evidence vault, Pack 4) |
| Client email | Copy-only (no email-storage layer) |
| Audit questions | `SavedCheatsheet.notes` if invoked from a cheatsheet, else copy-only |

The single new field is `GapAnalysisSession.soaDraft` — additive, no
migration needed.

### 2.6 File-level plan

Net new:
- `src/utils/ai/prompts.ts` — 5 new exports (additive).
- `src/components/common/AiPanel.tsx` — `onAccept` + `acceptLabel`
  props (additive).

Touched:
- `src/components/risk/RiskRegister.tsx` — add "Draft treatment plan"
  button to the form modal next to the `treatmentDescription` field.
- `src/components/comply/GapAnalysis.tsx` (need to verify file path) —
  add "Draft SoA" CTA on the session view.
- Tier 2/3 touch ScanReport, ClauseExplorer, ControlCard,
  CheatsheetBuilder.

### 2.7 Sequencing

1. Tier 1 prompt builders + tests (1 day).
2. AiPanel `onAccept` extension + tests (½ day).
3. RiskRegister "Draft treatment plan" wiring (½ day).
4. ComplyModule "Draft SoA" wiring (½ day, incl. new `soaDraft` field).
5. Tier 2 builders + wiring if there's headroom (1 day).
6. Tier 3 if there's still headroom (½ day).

Total **estimate: 4 days for tiers 1+2, 4½ for all three.** Realistic
for one sprint alongside Pack 2.

### 2.8 Tests

- Prompt builders: snapshot the `{system, user}` output for a synthetic
  fixture so prompt drift is caught on review. Pure functions; trivial
  to test. Add to existing test infrastructure.
- AiPanel `onAccept`: component test asserting the button only renders
  when the prop is provided, and clicking it invokes the callback with
  the streamed text.
- No tests for the actual Ollama call — that's behaviour we don't own.

### 2.9 Risks / open questions

1. **Does running 5 prompts in a session blow Ollama's context window?**
   Each prompt is independent; no shared session. No issue.
2. **What if the user has a small/low-quality model installed?** SoA
   output quality will degrade. Mitigation: surface the recommended
   model (`qwen2.5:7b` or whatever Settings recommends) prominently in
   the empty-state of the AiPanel when output looks like a stub.
   Explicit non-goal for Sprint 13.
3. **Should the "Use this draft" button overwrite existing content?**
   Yes, with a confirm step if the field is non-empty. Standard UX.
4. **Output formatting — markdown vs plain?** Markdown. Existing
   AiPanel renders markdown already.
5. **Localisation.** Not a Sprint 13 concern. UK English only.

---

## 3. Sprint 13, Pack 2 — Portfolio mode (full plan)

### 3.1 Goals

Lift the WP-audit module from "one URL at a time" to "queue 12 URLs and
walk away". Schedule recurring re-scans. Bulk-import clients and gap
analyses from CSV.

### 3.2 Features in scope (and the one big architectural decision)

**Architectural decision up front: foreground-only background tasks
for v1.**

Tauri can host a long-running daemon process that runs even when the
window is closed. It would let a user schedule a weekly scan and have
it actually fire on Tuesday at 06:00 even if Post_Watch isn't open.
This sounds great. The cost:

- Tauri daemon mode requires a separate Rust binary entry point or a
  detached process.
- Auto-update gets messier (the updater needs to coordinate with the
  daemon).
- macOS LaunchAgent / Windows scheduled-task registration during
  install adds permission prompts and a brittle install flow.
- Logging becomes cross-process.
- Real risk of "stale daemon running an old version" after auto-update
  lands a new binary.

For a consultant tool that's used during work hours, **scheduled tasks
that fire when the app is foreground/open is a sensible v1** — most
users have Post_Watch open during their working day, the queue
processes when the app launches, and the worst case is "scan ran 4
hours later than scheduled because I had a long lunch."

**Recommend: foreground-only in Sprint 13, true daemon in Pack 7+.**
Architecturally we can keep the door open by putting all
schedule/queue logic behind a small Rust command interface — when we
later add daemon mode, the JS layer doesn't change.

Five features in scope:

| # | Feature | Effort | Notes |
|---|---|---|---|
| 1 | **Batch scan queue** | M | Queue 1–N URLs; sequential processing (no parallel — share rate-limited API keys); pause / resume / cancel; UI shows live progress per item. |
| 2 | **Scheduled re-scans** | M | Per-domain cron-ish ("weekly Mon 06:00", "monthly", "every 30 days since last scan"). Fires when app is open at the scheduled time, or on next launch if missed. Drop-detection alert ("score dropped ≥ 5"). |
| 3 | **CSV import — clients** | S | Map CSV columns → Client fields. Validation, dedup, dry-run preview. |
| 4 | **CSV import — gap analysis items** | S | Bulk-set status/priority/notes against existing controls. Useful for porting in a previously-completed spreadsheet. |
| 5 | **Cross-client diff view** | S | "Show me everything that changed in the portfolio between two dates" — risk delta, scan-score delta, gap-status delta. |

Feature 5 partially overlaps with Pack 4 (compliance snapshot diff). It
makes sense in Pack 2 if the data infra is already there; otherwise
push to Pack 4. Tentatively included; finalise during implementation.

### 3.3 UX

- **Batch scanning** → new entry point on the WP audit hub: "Run
  multiple". Opens a panel where the user pastes URLs (one per line),
  picks the client per URL (or "All to same client"), and hits Start.
  Hub shows a queue panel with per-URL status. Failed scans surface
  inline; succeeded scans link to their report.
- **Scheduled re-scans** → on each saved report, a "Schedule re-scan"
  button opens a small dialog (frequency picker + time-of-day +
  drop-alert threshold). Settings page gets a new "Schedules" tab
  listing all active schedules with edit/disable.
- **CSV import** → gear menu → "Import data" submenu with two options
  (clients / gap-analysis). File picker → mapping UI → preview → confirm.
- **Cross-client diff** → Reports module → new template option
  "Portfolio change report (since X)".

### 3.4 Data model

**New types:**

```ts
// src/data/types.ts

export interface ScanQueueItem {
  id: string;               // queue-row id (not report id)
  targetUrl: string;
  clientId?: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  reportId?: string;        // populated on success
  error?: string;
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ScanSchedule {
  id: string;
  domain: string;
  clientId?: string;
  cadence:
    | { kind: 'weekly';  weekday: 0|1|2|3|4|5|6; hour: number }
    | { kind: 'monthly'; day: number; hour: number }
    | { kind: 'interval'; days: number };       // since last scan
  alertOnDrop?: number;     // points; e.g. 5
  active: boolean;
  lastFiredAt?: string;
  nextDueAt: string;        // pre-computed for efficient scan-on-launch
}
```

**New localStorage keys:**

| Key | Type | Purpose |
|---|---|---|
| `wp-audit-queue` | `ScanQueueItem[]` | Persistent queue. Survives app close. |
| `wp-audit-schedules` | `ScanSchedule[]` | Active recurring jobs. |
| `wp-audit-queue-cursor` | `string \| null` | id of currently-running item, for resume after crash. |

**Storage version bump 1 → 2.** New migration in
`utils/clientMigration.ts` (or split it out — see §6.4) — back-fills
empty arrays for the new keys, no-op for existing data.

### 3.5 Background-task scaffolding

Two new modules:

- `src/utils/queue/scanQueue.ts` — pure queue manager. Reads/writes
  `wp-audit-queue`. `enqueue(items)`, `dequeueNext()`, `markDone(id, reportId)`,
  `markFailed(id, error)`, `cancel(id)`. No side effects beyond
  localStorage.
- `src/utils/queue/queueRunner.ts` — drives the queue. Singleton
  React-context-backed thing that the WP audit hub instantiates on
  mount. Picks up where it left off (queue-cursor recovery). Calls into
  the existing `runScan` for each item. Emits events (Zustand store or
  a small custom event emitter) so the queue panel UI can listen.

**Scheduler** — `src/utils/schedule/scanScheduler.ts`. On app launch
and on every minute-tick (intervalId), checks each `ScanSchedule` —
if `nextDueAt <= now` and `active`, enqueues a new `ScanQueueItem`,
recomputes `nextDueAt`, persists. Pure function on a timer.

**Crucial choice — no Web Workers.** Keep it on the main thread for
v1. The scan engine already uses async/await heavily; it cooperatively
yields. Web Workers add a serialisation boundary that complicates the
existing fetch-utility's Tauri-vs-browser branching.

### 3.6 File-level plan

**Net new:**
- `src/utils/queue/scanQueue.ts` (pure).
- `src/utils/queue/scanQueue.test.ts`.
- `src/utils/queue/queueRunner.ts` (effectful).
- `src/utils/schedule/scanScheduler.ts` (pure).
- `src/utils/schedule/scanScheduler.test.ts`.
- `src/utils/csv/parseClients.ts` + `parseGapItems.ts` (pure).
- `src/utils/csv/parse.test.ts`.
- `src/components/wp-audit/BatchScanPanel.tsx` (UI).
- `src/components/wp-audit/ScheduleDialog.tsx` (UI).
- `src/components/settings/SchedulesTab.tsx` (UI).
- `src/components/shared/CsvImportDialog.tsx` (UI, reusable across
  clients + gap-analysis imports).

**Touched:**
- `src/components/wp-audit/WpAuditHub.tsx` — add "Run multiple" entry
  point + queue panel rendering.
- `src/components/settings/SettingsPanel.tsx` — Schedules tab.
- `src/components/clients/ClientsHub.tsx` — Import CSV button.
- `src/components/comply/GapAnalysis.tsx` — Import CSV button.
- `src/utils/clientMigration.ts` — version 2 migration step.
- `src/data/types.ts` — `ScanQueueItem` + `ScanSchedule`.

### 3.7 Sequencing

1. Types + migration + queue/scheduler pure modules + tests (1.5 days).
2. queueRunner + WpAuditHub integration (UI, batch entry point, queue
   panel) (1.5 days).
3. ScheduleDialog + SchedulesTab + scheduler timer integration (1 day).
4. CsvImportDialog + the two parsers + ClientsHub/GapAnalysis wiring
   (1.5 days).
5. Cross-client diff (if time) (1 day).

Total **estimate: 5.5 days for items 1–4. Item 5 spills to Pack 4.**
Realistic in one sprint alongside Pack 1.

### 3.8 Tests

- Queue manager: enqueue / dequeue / mark / cancel pure logic.
- Scheduler: `nextDueAt` computation across all three cadences,
  including DST rollover and end-of-month edge cases.
- CSV parsers: malformed input, header missing, dedup logic,
  field-mapping cases.
- Migration: round-trip from v1 storage to v2.
- queueRunner: mock the scan engine, assert it processes the queue in
  order and survives a simulated crash (queue-cursor recovery).

### 3.9 Risks / open questions

1. **Rate-limiting third-party APIs** during batch — VirusTotal etc.
   have free-tier limits (4 req/min for VT). Fix: queue runs sequential,
   not parallel, and the existing scan engine respects API-key
   absence per-check. Should be fine but needs a regression check
   when batch ships.
2. **Scheduler timer + sleep/wake** — macOS putting the laptop to sleep
   pauses `setInterval`. On wake, the scheduler re-checks and fires
   anything due. Don't need to handle this specially.
3. **What happens if a scheduled scan is already running when the next
   one is due?** Skip. Add a regression test.
4. **CSV size** — limit to ~1000 rows for v1 (big enough for any real
   consultancy). Larger imports show a warning.
5. **Schedule UI with timezone** — store everything in UTC, display in
   the user's local timezone. Add a unit test on the boundary.
6. **Cross-client diff scope creep** — if it grows beyond a day, push
   to Pack 4. Honest deferral, not failure.

---

## 4. Sprint 13 — combined plan

### 4.1 Sequencing

Pack 1 and Pack 2 run in parallel. Pack 1 is mostly self-contained
(prompts + existing UI). Pack 2 has more new infrastructure but is
similarly self-contained.

Suggested working order:

| Day | Pack 1 | Pack 2 |
|---|---|---|
| 1 | Tier-1 prompt builders + AiPanel onAccept | Types, migration, queue/scheduler pure modules |
| 2 | Risk treatment + SoA wiring | queueRunner + WpAuditHub batch UI |
| 3 | Tier-2 prompt builders + tests | ScheduleDialog + SchedulesTab + timer integration |
| 4 | ScanReport email + ControlCard policy stubs | CsvImportDialog + parsers + import wiring |
| 5 | Tier-3 audit-q + buffer for slippage | Cross-client diff if time, otherwise polish |

### 4.2 Version bumps + release

- Sprint 13 lands as **v2.5.0** (minor — significant new capability).
- Single tag at the end of the sprint, full release notes covering
  both packs.
- `wp-audit-reports` storage version bumps to 2 (Pack 2 migration).

### 4.3 Tests added

Approximate:

- Pack 1: ~12 prompt-builder snapshot tests, ~3 AiPanel component tests.
- Pack 2: ~8 queue-manager tests, ~6 scheduler tests, ~5 CSV-parser
  tests, ~2 migration tests, ~3 queueRunner integration tests.

Total ≈ 39 new tests. Suite goes from 60 to ~99. Still fast (<3s).

---

## 5. Future sprints — compact scoping

### 5.1 Pack 3 — Trust hardening (Sprint 14 candidate)

**Three sub-features**:

- **Encrypted localStorage** — passphrase prompt on first launch,
  AES-GCM around the `useLocalStorage` boundary. Single chokepoint, so
  the encryption layer is one file (`src/utils/cryptoStorage.ts`).
- **Auto-rotating backups** — extend the existing export plumbing with
  a scheduled task. Reuses the scheduler from Pack 2 — that's why we
  build the scheduler general-purpose.
- **Tamper-evident scan history** — chained SHA-256 hashes on
  `wp-audit-reports`. Verification mode in Settings.

**Pre-decisions Sprint 13 needs to make:**

- The new `useLocalStorage` interface in Pack 3 will be a thin
  in-memory cache backed by an async `cryptoStorage.get/set` layer.
  Today everything is synchronous. **Sprint 13 should not introduce
  any code that assumes synchronous storage where it doesn't already.**
  In practice the existing hook already serialises through `useState`
  with a sync initial-load — so async swaps in cleanly later.
- Storage version bump path: v1 → v2 (Sprint 13) → v3 (encryption,
  Sprint 14). Keep `clientMigration.ts` extensible by version step
  rather than monolithic.

### 5.2 Pack 4 — Reports + evidence (Sprint 15 candidate)

**Sub-features**:

- **Compliance snapshot diff** (small, same engine as Pack 2's
  cross-client diff if we built it).
- **Evidence vault** — file attachments on gap items. **This needs a
  real local-file API.** Tauri's `fs` plugin handles it; we'd add
  `tauri-plugin-fs` to Cargo and a small wrapper.
- **Customisable PDF templates** — the React-PDF docs already have
  this story; no new infra.
- **Monthly executive PDF subscription** — reuses Pack 2's scheduler.

**Pre-decisions Sprint 13 needs to make:**

- Don't paint ourselves into a "scheduler only knows about scans"
  corner. **The `ScanSchedule` type should generalise to a `Schedule`
  abstraction with a `kind` discriminator.** Trivial when we're
  designing it; expensive to refactor later.

### 5.3 Pack 5 — Conversational search (Sprint 16 candidate)

NL → JSON query plan → in-memory query → render results.

**Pre-decisions Sprint 13 needs to make:**

- **The prompt registry pattern.** Currently `prompts.ts` is a flat
  set of named exports. Pack 5 needs a "query planner" prompt that's
  a different shape (returns JSON, not prose). Sprint 13 can either:
  - (a) Keep the flat registry and just add another shape later. Fine.
  - (b) Introduce a typed `Prompt<TInput, TOutput>` registry now.
  - **Recommend (a) for Sprint 13**, revisit at Pack 5. Premature
    abstraction is more expensive than the eventual refactor.

### 5.4 Pack 6 — Quality of life (continuous, not a single sprint)

Each sub-feature is a half-day. They land alongside other sprints:

- **Global undo** — soft-delete table in localStorage, 30-day
  retention. Easy.
- **Keyboard shortcut overlay** — `?` opens a modal listing all
  shortcuts. Pure UI.
- **Multi-window** — Tauri supports multiple windows; route the same
  React app at a different URL hash; render only the relevant page.
  Bigger than it looks (state isolation, focus-trap interactions).
- **Search history** — add to `useSearch` hook.

**Pre-decisions Sprint 13 needs to make:**

- **Soft-delete pattern.** If Sprint 13 adds any new "delete
  permanently" buttons (Pack 2 batch cancel, scheduled-scan delete),
  use a soft-delete pattern from the outset (`deletedAt: string`)
  rather than splicing arrays. Free; saves a refactor.

---

## 6. Cross-cutting concerns

### 6.1 Prompt registry shape

**Decision: keep the existing flat-export pattern** in Sprint 13. Add
new functions; don't introduce a typed registry. Revisit when Pack 5
forces a different prompt shape (JSON output).

### 6.2 Background-task plugin

**Decision: foreground-only for Sprint 13.** Daemon mode is its own
sprint (call it Pack 7). Architectural hooks:

- Queue persistence in localStorage so foreground/daemon modes share
  the same state.
- Schedule storage uses pre-computed `nextDueAt` so a daemon could
  read it without re-running JS scheduler logic.
- All scan-execution logic stays in the JS layer (Tauri commands
  remain thin). When daemon mode comes, it'll embed a JS runtime via
  Tauri's command invocation pattern.

### 6.3 Storage migration discipline

**Decision: extract a versioned migration runner.** Today
`clientMigration.ts` is a single bottom-up function. Refactor into:

```ts
// src/utils/migrations/index.ts
const MIGRATIONS: Record<number, () => void> = {
  2: migrateToV2,  // Sprint 13: queue + schedule scaffolding
  3: migrateToV3,  // Sprint 14: encryption envelope
};
```

The runner reads the current version from the version key, runs each
pending step in order. Idempotent. Tested.

This refactor is **a half-day of Sprint 13 work** but pays back
enormously across packs 3–6.

### 6.4 Migration runner — done in Sprint 13

The Pack 2 migration step is the trigger to do this refactor. Don't
add another bottom-up `runClientMigration2`-style function.

### 6.5 Performance — what changes when Ollama loads

When AI features fire, the user's machine spikes — local 7B model
inference uses 4–8 GB RAM and spins fans. UX implications:

- **Show a clear progress + cost signal.** AiPanel already shows
  streaming output, but on a slow machine the first token can take
  10+ seconds. Add an interstitial: "Starting model… (≈10s on first
  prompt)" if no token has streamed in 3 seconds.
- **Don't auto-fire AI on page load.** All entry points are explicit
  user actions. Already the case; mention in code review.
- **One concurrent generation max.** AiPanel already enforces this
  (single modal). Confirm Pack 1 doesn't accidentally allow two via
  the new onAccept inline pattern.

### 6.6 Telemetry / observability

We don't have any. **Don't add it in Sprint 13.** When Pack 3 lands
(encrypted local storage, posture as a brand promise), telemetry has
to be opt-in only and clearly framed. Defer to Sprint 14 explicitly.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sprint 13 underestimated; one of the two packs slips | Medium | Medium | Tier-2/3 drafters in Pack 1 are explicitly cuttable; Cross-client diff in Pack 2 is explicitly cuttable. Honest deferral plan in §2.7 / §3.7. |
| AI output quality varies wildly between Ollama models | Medium | Low | Recommend `qwen2.5:7b` or similar in Settings; surface an empty-state nudge if output is short. Not Sprint 13 work; mention in release notes. |
| Background task scheduler interacts badly with macOS sleep | Low | Low | Tested; setInterval pauses on sleep, fires on wake — acceptable behaviour. |
| Migration v1 → v2 corrupts user data | Low | High | Extensive migration tests; backup auto-created on first v2 boot before any writes. |
| Storage version bump conflicts with manual JSON imports | Low | Medium | Import path validates version; offers to migrate or refuse. Existing import code already handles missing keys gracefully — verify in test. |
| Prompt-registry refactor pressure during Pack 5 | Low | Low | Documented in §5.3 — accept the eventual refactor. |

---

## 8. Decisions to make before Sprint 13 starts

These are the concrete forks where we want a yes/no before code starts.
None of these are blockers — defaults are sensible — but flagging for
visibility:

1. **Foreground-only background tasks for v1?**
   Recommend: **yes**. Daemon mode = Pack 7+.

2. **Generalise `ScanSchedule` → `Schedule` discriminated union now,
   or specialise then refactor?**
   Recommend: **generalise now** — Pack 4 needs it for monthly
   executive PDFs. Cost: 2 hours.

3. **Migration runner refactor inside Sprint 13?**
   Recommend: **yes** — Pack 2 forces a v2 migration anyway, and we
   need to add a v3 in Sprint 14. Cost: half a day, recouped 3×.

4. **Tier-3 drafters (audit interview questions) in Sprint 13 or
   13.5?**
   Recommend: **drop to Sprint 13.5 / when slack appears.** Tiers 1
   and 2 are higher value.

5. **Cross-client diff in Pack 2 or Pack 4?**
   Recommend: **flexible — start in Pack 2, push to Pack 4 if it grows
   past 1 day.**

6. **Add telemetry?**
   Recommend: **no, defer to Pack 3 explicitly.** Premature for a
   privacy-positioned tool.

---

## 9. What "done" looks like for Sprint 13

- v2.5.0 tagged and released.
- 5 (or 4 if Tier-3 deferred) new AI drafters working end-to-end with
  Ollama, accessible from the right pages.
- `AiPanel.onAccept` extension pattern with at least 2 consumers.
- Batch scan queue working: 12 URLs queued, processed sequentially,
  pause / resume / cancel functional, queue persists across app
  restarts.
- At least one scheduled re-scan firing on time.
- CSV import for clients + gap items working with malformed-input
  graceful handling.
- 99 tests passing in CI.
- No new lint warnings.
- Migration runner refactored and v2 migration tested.
- Release notes describing both packs in plain English for users.

If we hit all of that, Sprint 14 (Pack 3 — trust hardening) starts
from a clean platform.
