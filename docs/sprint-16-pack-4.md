# Sprint 16 — Pack 4: Reports + evidence (focused plan)

**Status:** discovery (no code yet)
**Sprint 16 scope:** the lighter half of Pack 4 from the original
discovery doc — diff engine, gap-session snapshots, portfolio summary
template. Heavyweight items (evidence vault with Tauri fs plugin,
customisable PDF templates) move to Sprint 17.

The TL;DR:

- **Diff feature.** A pure `src/utils/diff.ts` over gap items + risk
  registers, used by both the per-session snapshot diff (Sprint 16) and
  any future "what changed across the portfolio since date X" view.
- **Snapshots are explicit, named, per-session.** v1 doesn't ship
  auto-snapshots — the user clicks "Save snapshot" with a label (e.g.
  "Pre-audit baseline"). Auto-snapshots are deferable to Sprint 17 if
  the manual flow turns out to be the wrong UX shape.
- **Cross-client view = summary, not diff.** Without historical
  snapshots for risks / scans / clients, true "cross-client diff" needs
  an auto-snapshot foundation we're not yet building. v1 ships a
  Portfolio Summary report template — every client + their current
  score / risk count / compliance %. Diff comes later.
- **Evidence vault + customisable PDF templates → Sprint 17.** These
  need a Tauri fs plugin and a separate UI focus; they get their own
  sprint.

## What ships in Sprint 16

### 1. Pure diff engine

`src/utils/diff.ts`:

```ts
type GapItemChange =
  | { kind: 'added';    item: GapAnalysisItem }
  | { kind: 'removed';  item: GapAnalysisItem }
  | { kind: 'changed';  before: GapAnalysisItem; after: GapAnalysisItem;
                        fields: (keyof GapAnalysisItem)[] };

export function diffGapItems(before: GapAnalysisItem[], after: GapAnalysisItem[]): GapItemChange[];
```

Pure function. Easy to test. Drives two consumers (snapshot diff in
gap analysis; potential future cross-client diff).

### 2. Gap-session snapshots

New persisted shape:

```ts
interface GapSessionSnapshot {
  id: string;
  sessionId: string;
  name: string;
  createdAt: string;
  /** Frozen copy of session.items at the time of save. */
  items: GapAnalysisItem[];
  /** Engagement context — captured at save time so a comparison
   *  can label "what was X then vs now". */
  notes?: string;
}
```

Storage key: `clause-control:gap-session-snapshots` → `GapSessionSnapshot[]`.

UI in `GapAnalysis.tsx`:

- "Save snapshot" toolbar button on the session view → small dialog
  asking for a name. Persists current `items`.
- "Compare with…" dropdown next to it lists prior snapshots for this
  session. Selecting one opens a `<SnapshotDiff>` panel rendering the
  `diffGapItems` output: added rows (mint), removed rows (red), changed
  rows (violet, with before/after status + priority side by side).

### 3. Portfolio summary report template

New entry in `ReportHub`'s template picker: "Portfolio summary". Picks
up every client + their:

- Latest WP scan score (or "no scan" if absent)
- Open + critical risk counts
- Compliance % across all gap sessions for this client
- Last activity date (most recent of all the above)

Renders as a React-PDF document mirroring the existing layout. No new
PDF infrastructure — extends `pdf/generate.ts` with a third
`generatePortfolioSummary()` entry alongside the existing two.

## What's deferred to Sprint 17

- **Evidence vault** — file attachments on gap items + scan reports.
  Needs `tauri-plugin-fs` registered in `src-tauri/Cargo.toml` + a JS
  wrapper for read / write / list. Encrypted attachments piggyback on
  Sprint 15's `cryptoStorage` only if we extend that to wrap binary
  buffers, which we haven't. Sprint 17 sets that up.
- **Customisable PDF templates** — per-client logo / colour / font
  overrides. React-PDF supports it via prop drilling; needs a settings
  UI per client to set the overrides. Pairs naturally with evidence
  vault because both touch client-level persistence.
- **Monthly executive PDF schedule** — Schedule `kind: 'report-export'`
  needs the fs plugin to land generated PDFs somewhere. Sprint 17
  alongside evidence vault.
- **Auto-snapshots** — daily snapshot of every gap session for true
  time-series diff. Defer unless user feedback says the manual flow is
  insufficient.

## File-level plan (Sprint 16)

**Net new:**
- `src/utils/diff.ts` (pure)
- `src/utils/diff.test.ts`
- `src/components/gap-analysis/SnapshotDialog.tsx` (name + save)
- `src/components/gap-analysis/SnapshotDiff.tsx` (render diff)
- `src/pdf/PortfolioSummaryPdf.tsx` (React-PDF doc)

**Touched:**
- `src/data/types.ts` — `GapSessionSnapshot` type
- `src/components/gap-analysis/GapAnalysis.tsx` — toolbar buttons + diff panel mount
- `src/components/reports/ReportHub.tsx` — new template option
- `src/pdf/generate.ts` — new generator
- `src/utils/migrations/v4.ts` — version stamp, no data movement

## Sequencing

1. **Day 1:** Diff engine + tests. `GapSessionSnapshot` type. v4 migration step.
2. **Day 2:** Snapshot save/list UI in GapAnalysis. SnapshotDialog component.
3. **Day 3:** SnapshotDiff panel. Visual review.
4. **Day 4:** Portfolio summary PDF — generator + ReportHub template option.
5. **Day 5:** Buffer + v2.8.0 tag.

## Risk register

| Risk | Mitigation |
|---|---|
| Snapshots bloat localStorage (90 controls × N sessions × M snapshots) | Cap at 20 snapshots per session; oldest auto-pruned. Surface count in UI. |
| Diff rendering on 90-item session is slow | Pre-compute once; memoize. Pure function so React Compiler can hoist. |
| Portfolio summary on first-launch users with no data | Empty state with "Run your first scan / start your first gap analysis →" CTAs. Matches existing dashboard pattern. |
| Storage version bump 3 → 4 conflicts with the encryption migration | v3 is a stamp-only step (no data movement); v4 adds the new snapshots key. Idempotent and additive — no overlap. |

## Decisions worth a yes/no before code starts

1. **Manual named snapshots in v1, no auto-snapshots?**
   Recommend: **yes.** Simpler UX, defer the auto pattern.
2. **Portfolio summary instead of cross-client diff in v1?**
   Recommend: **yes.** True cross-client diff needs auto-snapshots; the
   summary delivers most of the value today.
3. **Sprint 16 ships as v2.8.0?**
   Recommend: **yes.** Material new capability — minor bump.
4. **Evidence vault + customisable templates wait for Sprint 17?**
   Recommend: **yes.** Tauri fs plugin is a clean breakpoint.
