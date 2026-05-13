# Sprint 18 — Encryption follow-ups (focused plan)

**Goal:** make Sprint 15's opt-in encryption safe to recommend by closing
the operational gaps. Current state: enable works, lock/unlock works,
but there's no recovery from a forgotten passphrase (only nuke-and-wipe),
no change-passphrase, no disable.

## Sprint 18 deliverables

1. **DEK refactor.** Current model derives the key directly from the
   passphrase. Sprint 18 introduces a per-installation Data Encryption
   Key that's wrapped by a Key Encryption Key (passphrase-derived). This
   unlocks recovery + change-passphrase without re-encrypting every blob.
2. **Recovery key.** A high-entropy random code (8 word-groups of 4 hex
   chars, easy to write down or store in a password manager) presented
   at setup. Wraps the DEK under a recovery KEK. Lets the user unlock
   even if they forget the passphrase.
3. **Change passphrase.** Re-derive the KEK from a new passphrase, re-
   wrap the DEK. Constant-time regardless of stored data volume.
4. **Disable encryption.** Reverse the migration — decrypt every
   `enc:*` key to plain, delete the salt + wrapped DEK + canary.
5. **Encrypted backup exports.** The current `exportBackup` produces
   plain JSON. Add an optional passphrase that wraps the JSON in
   AES-GCM. Import handles both formats (header magic).

**Out of scope this sprint** (moved to a later one if user asks):
- OS keychain integration (macOS Keychain / Windows Credential Manager).
  Needs new Tauri plugin bindings and breaks the "any device works"
  invariant — a separate sprint after we've seen real usage of the v1
  recovery key flow.

## DEK refactor — the architectural decision

**Before (Sprint 15 v1):**
```
passphrase + salt → PBKDF2 → KEK
KEK encrypts everything (canary + every enc:* blob).
```

Problem: changing the passphrase OR adding a recovery path requires
re-encrypting every blob.

**After (Sprint 18):**
```
passphrase + salt  → PBKDF2 → passKEK
recovery + salt    → PBKDF2 → recoveryKEK

generated random DEK (32 bytes)
DEK wrapped under passKEK     → stored at clause-control:enc:__dek-pass
DEK wrapped under recoveryKEK → stored at clause-control:enc:__dek-recovery
canary (constant plaintext) encrypted under DEK → clause-control:enc:__canary
every user value encrypted under DEK → clause-control:enc:<key>
```

Unlock:
1. Derive passKEK from passphrase.
2. Decrypt `__dek-pass` → DEK in memory.
3. Verify by decrypting canary (must equal the constant).
4. Pre-warm cache by decrypting every enc:* key with DEK.

Recovery unlock:
1. Derive recoveryKEK from recovery code.
2. Decrypt `__dek-recovery` → DEK.
3. Force the user into a "set new passphrase" flow that re-wraps the
   DEK under a new passKEK.

Change passphrase:
1. Derive new passKEK.
2. Re-wrap the in-memory DEK; replace `__dek-pass`.
3. Recovery wrapper untouched.

Disable encryption:
1. Decrypt every enc:* key with DEK.
2. Write plaintext to plain key, delete enc:* key.
3. Delete salt, both wrapped-DEK slots, canary.

## Migration from v1 encrypted users

Devices on Sprint 15-style encryption (key derived directly from
passphrase) need migration. On unlock, the cryptoStorage layer detects
the absence of `__dek-pass` and triggers a one-time re-wrap:
1. Old passphrase-derived KEK opens the canary (legacy path).
2. Generate a fresh DEK.
3. Re-encrypt every enc:* blob with DEK.
4. Wrap DEK with passphrase-derived passKEK → store `__dek-pass`.
5. Prompt user to set a recovery key (modal, can be deferred).

Migration is idempotent: if `__dek-pass` exists, skip.

## File-level plan

**New:**
- `src/utils/crypto.ts` — add `wrapKey(kek, dek): string`, `unwrapKey(kek, blob): Uint8Array`. Builds on existing primitives.
- `src/utils/recoveryCode.ts` — generate / format / parse the recovery code (32 random bytes, hex grouped 4-4-4-... for legibility).
- `src/utils/recoveryCode.test.ts`.
- `src/components/auth/SetupRecoveryModal.tsx` — printed-style display of the recovery code on first enable, with Copy + "I've saved this" confirm step.
- `src/components/settings/EncryptionAdvanced.tsx` — change-passphrase + disable-encryption sub-section in Settings.

**Touched:**
- `src/utils/cryptoStorage.ts` — DEK refactor + new `enableEncryption(pass, recoveryCode)`, `unlockWithRecovery(code)`, `changePassphrase(old, new)`, `disableEncryption(pass)`. v1-migration path inside `unlock`.
- `src/components/auth/UnlockScreen.tsx` — add "Use recovery key instead" toggle.
- `src/components/settings/SettingsPanel.tsx` — EncryptionPanel surfaces the new actions when unlocked.
- `src/utils/backup.ts` — `exportBackup(opts: { passphrase?: string })` + `importBackup(file, passphrase?)`.

**Tests:**
- crypto.test.ts: add wrap/unwrap round-trip + tamper detection.
- recoveryCode.test.ts: format stability, parse round-trip, malformed input.
- cryptoStorage.test.ts: DEK lifecycle, recovery unlock, change passphrase, disable, v1-migration (fresh DEK after upgrade).
- backup.test.ts (new): encrypted export round-trip, format magic detection.

## Sequencing

1. **Day 1:** DEK refactor inside cryptoStorage + tests. Migration of v1.
2. **Day 2:** Recovery code generation + setup modal + unlock-with-recovery flow.
3. **Day 3:** Change passphrase + disable encryption + Settings UI.
4. **Day 4:** Encrypted backup export + import + tests.
5. **Day 5:** Buffer + v2.10.0.

## Risk register

| Risk | Mitigation |
|---|---|
| v1 migration corrupts data mid-flow | Migration runs inside unlock(); old + new wrappers coexist until the rewrite confirms success. On failure, fall back to old wrapper — no destructive step until commit. |
| Recovery code exposed in console logs | Never log it; the setup modal is the only surface that ever sees it. Treat like a password. |
| User changes passphrase but recovery still uses old DEK | Recovery wrapper is unchanged through passphrase rotation — by design. Document this in the UI. |
| Encrypted export uses different format from current plain JSON | Header magic byte (`PWBK`+version) lets import detect format. Plain JSON imports continue to work (backwards compatible). |
| Disable encryption fails halfway | Two-phase like enable: decrypt + write plain first, only then delete enc:* keys. cleanupAfterCrash-equivalent sweep on next boot. |

## Decisions worth a yes/no

1. **Drop OS keychain to Sprint 19 or later?** Recommend: **yes.** It's
   a "convenience" tier feature; recovery + change-passphrase are the
   operational essentials. OS keychain wants a new Rust plugin which is
   its own focused work.
2. **Recovery code format: 32 hex chars (8 groups of 4) or BIP39
   mnemonic (24 words)?** Recommend: **hex.** Smaller surface area, no
   wordlist dependency, easier to validate on input. BIP39 is nicer to
   read aloud — defer unless user prefers it.
3. **Single passphrase entry on disable, or also a confirm dialog?**
   Recommend: passphrase + "type 'disable' to confirm". Mirrors the
   "wipe everything" pattern from Sprint 15.
