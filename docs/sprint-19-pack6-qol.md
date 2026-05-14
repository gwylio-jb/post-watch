# Sprint 19 — Pack 6 quality-of-life

**Target version:** 2.11.0
**Theme:** the small things that make daily use less annoying.

Four deliverables, none of them deep — they each touch one or two
components plus a small utility. The point is to land them all together
because individually they don't justify a release.

## 1. Global undo toast

A lightweight "Undo" toast that pops up after any destructive action
(delete client, delete risk, delete report, delete schedule, soft-delete
attachment, etc.). 8-second window, single button.

**Mechanism.** A tiny module-scope undo bus:

```ts
// src/utils/undoBus.ts
type UndoEntry = { label: string; revert: () => void; expiresAt: number };
```

Components publish an undo by calling `pushUndo({ label, revert })`. A
single `<UndoHost />` mounted near the app root subscribes and renders
the toast. The revert callback closes over the deleted record so the
host doesn't have to know the data model.

Hooks already exist on every list view that does deletes — wrap them.

**Out of scope.** Multi-level undo, redo, undo across reload. Single
in-memory entry, replaced when a new one pushes.

## 2. Keyboard shortcut overlay

Pressing `?` (or `Cmd/Ctrl+/`) brings up a modal listing every shortcut
the app supports. Shortcuts already exist scattered across the app
(Cmd+K coming in Sprint 20, Cmd+B for sidebar, Esc to close modals,
arrow keys in tables) — the overlay just documents them.

**Implementation.** `src/components/shared/ShortcutOverlay.tsx` —
hard-coded list, grouped by section. Listens for `?` at window level
when no input is focused.

## 3. Multi-window support

Currently a second Post_Watch launch just focuses the existing window
(Tauri default). Add a "New window" menu item (`Cmd+Shift+N`) that
opens a fresh window pointed at a chosen page (Dashboard, Risk Register,
Audit Reports). Useful for cross-referencing.

**Implementation.** Tauri v2 has `WebviewWindow.create` — call it from
a small `openNewWindow(pagePath: string)` helper. New windows reuse the
same localStorage so unlocked state propagates.

**Risk.** Encryption status is per-process — both windows share
localStorage but each one has its own in-memory `masterKey`. Sprint 15
already designed `cryptoStorage` around this; the second window has to
prompt for unlock on launch. Acceptable.

## 4. Search history

Cmd+K (Sprint 20) hasn't shipped yet, but the existing in-page search
inputs (clients filter, risks filter, audit reports filter) can keep a
local history of the last 8 distinct queries per scope. Show as a
dropdown when the input is focused and empty.

**Implementation.** `useSearchHistory(scope: string, limit = 8)` —
returns `[history, push, clear]`. Backed by a single
`clause-control:search-history` key, scoped object inside.

## Acceptance

- Deleting a client and clicking Undo restores it (toast counts down)
- Pressing `?` from any page opens the overlay; Esc closes it
- `Cmd+Shift+N` opens a second window that prompts for unlock
- Typing "auth" into the risks filter, clearing it, refocusing →
  "auth" appears as a recent-search chip

## Test plan

- `undoBus.test.ts`: push/pop/expiry
- `useSearchHistory.test.ts`: ordering, dedup, limit, clear
- ShortcutOverlay: open/close keyboard wiring (jsdom)

## Out of scope (stays for Sprint 20)

- Cmd+K natural-language search (separate sprint)
- Persisting undo across reload
- Window position memory
