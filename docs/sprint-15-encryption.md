# Sprint 15 — Encrypted localStorage (focused plan)

**Goal:** opt-in passphrase-locked storage. Crypto primitives shipped in
v2.6.0 (`src/utils/crypto.ts`). Sprint 15 builds the integration:
boot-flow lock gate, one-time data migration, sync-preserving
`useLocalStorage` shim, Settings UI.

## Design decisions

**1. Scope: all-or-nothing, opt-in.**
When enabled, every `clause-control:*` key is encrypted. No per-key
config. Default off — existing users see no change unless they choose to
enable it.

**2. Storage shape: prefixed encrypted keys.**
- Plain key:     `clause-control:wp-audit-reports`
- Encrypted key: `clause-control:enc:wp-audit-reports`
A salt at `clause-control:storage-encrypted-salt` is the on/off flag and
holds the PBKDF2 salt in plain base64 (salt is non-secret). Migration
is one-shot: when the user enables, every plain key is read, encrypted,
written to the enc-prefixed slot, then the plain slot is deleted.

**3. Sync API preserved via in-memory cache.**
After successful unlock, before AppContent mounts, decrypt every
`clause-control:enc:*` key into an in-memory `Map`. `useLocalStorage`
reads from the cache (sync), writes update the cache (sync) AND schedule
an async encrypt-and-persist. The cache is the source of truth at
runtime; localStorage is the durable backup.

**4. Boot flow.**
```
App.tsx → LockGate
   ├─ no salt key in localStorage    → render AppContent (current behaviour)
   ├─ salt exists, master key unset  → render UnlockScreen
   └─ master key set                 → render AppContent
```
A `<CryptoProvider>` near the App root owns the master-key state +
the cache. `useLocalStorage` becomes cache-aware.

**5. Forgot passphrase = clean wipe.**
The setup wizard makes this explicit ("if you forget this passphrase
your data is gone forever — back up first"). On the unlock screen, a
"Reset" button confirms-then-wipes every `clause-control:*` key and
returns to a fresh-install state. No recovery key for v1 — adding one
later is purely additive.

**6. Storage version 2 → 3.**
Migration runner gets a v3 step. The step is a no-op for users who
haven't enabled encryption — it just records that this device has been
through v3. The actual enable-encryption operation is triggered by the
user, not the migration.

## Implementation order

1. **Crypto state module** (`src/utils/cryptoStorage.ts`) — pure state
   machine over the encryption singleton. Tests.
2. **CryptoProvider + useLocalStorage shim** — provider near App root
   exposes the cache. The hook reads from cache when encryption is on,
   localStorage when off. Tests for the cache path.
3. **LockGate component** — replaces AppContent until unlocked.
   UnlockScreen + SetupWizard.
4. **Migration: enable encryption** — `enableEncryption(passphrase)`
   walks every plain key, encrypts, persists, deletes plain. Atomic
   enough that a crash mid-way is recoverable. Tests for happy path +
   partial-failure.
5. **Settings UI** — "Encryption" section in SettingsPanel: enable /
   change passphrase / disable.
6. **v3 migration step** — records version, no data movement.
7. **End-to-end tests** — encrypt, lock, unlock, decrypt, verify
   round-trip on representative keys.

## Risk register

| Risk | Mitigation |
|---|---|
| Crash during enable → half-migrated state | Walk in two passes: first write all `enc:X`, then delete all plain X. If we crash between, next boot sees BOTH a salt AND plain keys → run cleanup pass. |
| Crash during disable → half-migrated state | Same pattern, reversed. |
| User forgets passphrase | Explicit setup-wizard language; reset-with-wipe path on unlock screen. v1 = no recovery key. |
| In-memory cache desyncs from disk | Cache is source of truth; every write goes cache-first, persist-second. Only after-unlock pre-warm reads from disk. |
| Old `useLocalStorage` callers expecting sync init | Cache pre-warm during unlock means cache is populated before AppContent mounts → sync init still works. |
| Tests of `useLocalStorage` previously assumed plain disk reads | Tests stay on the plain path (no CryptoProvider mounted in the test harness). The new encrypted path gets its own test surface. |

## Out of scope (Sprint 16+)

- Recovery key / printable codes.
- Tauri OS-keychain integration (skip the passphrase on devices the OS
  knows about).
- Encrypted backup exports (the export is currently a plain JSON file).
- Per-key encryption (everything is all-or-nothing).
