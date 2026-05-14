/**
 * UnlockScreen — full-bleed passphrase prompt rendered by LockGate when
 * encryption is enabled but locked.
 *
 * Sits outside the app shell on purpose: nothing else renders behind it,
 * so there's no flash of an empty Dashboard / un-styled sidebar while
 * the user is unlocking. The redesign aurora + grain match the rest of
 * the app so it doesn't feel like a different application.
 *
 * Three actions:
 *   - Unlock with passphrase (primary).
 *   - Reset / wipe everything (destructive, behind a confirm input).
 *   - Quit (footer link — informational; closing the window does the
 *     same thing and is the actual escape hatch).
 */
import { useState, useRef, useEffect } from 'react';
import { Lock, AlertTriangle, Loader2 } from 'lucide-react';
import * as cryptoStorage from '../../utils/cryptoStorage';

export default function UnlockScreen() {
  // Sprint 18: two unlock modes — passphrase (default) or recovery code.
  // Recovery success forces the user to set a fresh passphrase before
  // continuing.
  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  /** After recovery unlock succeeds, we render an inline "set new passphrase"
   *  step. Status is already 'unlocked' so technically AppContent could mount,
   *  but we keep the lock screen rendered until the user finishes rotating. */
  const [postRecoveryRotate, setPostRecoveryRotate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the passphrase input on mount — keyboard users land in the
  // right place without having to tab.
  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'passphrase') {
        if (!passphrase) return;
        const ok = await cryptoStorage.unlock(passphrase);
        if (!ok) {
          setError('Incorrect passphrase. Try again, switch to recovery, or reset below.');
          setPassphrase('');
          inputRef.current?.focus();
        }
        return;
      }
      // recovery mode
      if (!recoveryCode) return;
      const ok = await cryptoStorage.unlockWithRecovery(recoveryCode);
      if (!ok) {
        setError('Recovery code did not unlock this device. Check the format — 8 groups of 4 hex characters.');
        setRecoveryCode('');
        inputRef.current?.focus();
        return;
      }
      // Success — gate AppContent behind a forced passphrase rotation.
      setPostRecoveryRotate(true);
    } catch (err) {
      setError((err as Error).message || 'Unexpected unlock failure');
    } finally {
      setSubmitting(false);
    }
  };

  if (postRecoveryRotate) {
    return <PostRecoveryRotate onDone={() => setPostRecoveryRotate(false)} />;
  }

  return (
    <div className="app-shell theme-dark" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="aurora"><div className="blob" /></div>
      <div className="grain" />

      <div
        className="bubble"
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 420,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'grid', placeItems: 'center',
              background: 'rgba(0,217,163,0.14)',
              border: '1px solid rgba(0,217,163,0.30)',
              color: 'var(--mint)',
            }}
          >
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)' }}>
              Locked
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
              Enter your passphrase to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-redesign-mono)',
          }}>
            {mode === 'passphrase' ? 'Passphrase' : 'Recovery code'}
          </label>
          {mode === 'passphrase' ? (
            <input
              ref={inputRef}
              type="password"
              value={passphrase}
              onChange={e => { setPassphrase(e.target.value); setError(null); }}
              autoComplete="current-password"
              spellCheck={false}
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--line-2)',
                background: 'var(--bg-2)',
                color: 'var(--ink-1)',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={recoveryCode}
              onChange={e => { setRecoveryCode(e.target.value); setError(null); }}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              placeholder="AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-AAAA-BBBB"
              disabled={submitting}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid var(--line-2)',
                background: 'var(--bg-2)',
                color: 'var(--ink-1)',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'var(--font-redesign-mono)',
                letterSpacing: '0.05em',
              }}
            />
          )}

          {error && (
            <div
              role="alert"
              style={{
                fontSize: 12, color: 'var(--ember)',
                background: 'rgba(255,74,28,0.10)',
                border: '1px solid rgba(255,74,28,0.30)',
                borderRadius: 10,
                padding: '8px 12px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (mode === 'passphrase' ? !passphrase : !recoveryCode)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {submitting ? 'Verifying…' : (mode === 'passphrase' ? 'Unlock' : 'Unlock with recovery code')}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'passphrase' ? 'recovery' : 'passphrase');
                setError(null);
                setPassphrase('');
                setRecoveryCode('');
              }}
              style={{
                fontSize: 12, color: 'var(--ink-3)',
                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              {mode === 'passphrase' ? 'Use recovery code instead' : 'Use passphrase instead'}
            </button>
          </div>
        </form>

        <ResetSection showReset={showReset} setShowReset={setShowReset} />
      </div>
    </div>
  );
}

/**
 * Sprint 18: rendered after a successful recovery-code unlock. The
 * session is technically unlocked at this point, but we keep the lock
 * screen up until the user picks a fresh passphrase — both as a clear
 * UX signal that recovery is a one-shot path and because the previous
 * passphrase is still valid against the wrapped DEK until rotated.
 *
 * On success, `setPassphraseFromRecovery` rewrites the __dek-pass
 * wrapper under the new KEK, invalidating the old passphrase.
 */
function PostRecoveryRotate({ onDone }: { onDone: () => void }) {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (next.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('Passphrases do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await cryptoStorage.setPassphraseFromRecovery(next);
      if (!ok) {
        setError('Could not set new passphrase. Try locking and unlocking again.');
        return;
      }
      onDone();
    } catch (err) {
      setError((err as Error).message || 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell theme-dark" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="aurora"><div className="blob" /></div>
      <div className="grain" />
      <div
        className="bubble"
        style={{
          position: 'relative', zIndex: 2, width: '100%', maxWidth: 420,
          padding: 32, display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)' }}>
            Set a new passphrase
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
            Recovery unlock succeeded. Choose a new passphrase to replace the forgotten one — the old passphrase will no longer work.
          </p>
        </div>

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            value={next}
            onChange={e => { setNext(e.target.value); setError(null); }}
            placeholder="New passphrase"
            autoComplete="new-password"
            disabled={submitting}
            style={{
              padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--line-2)', background: 'var(--bg-2)',
              color: 'var(--ink-1)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <input
            type="password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(null); }}
            placeholder="Confirm new passphrase"
            autoComplete="new-password"
            disabled={submitting}
            style={{
              padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--line-2)', background: 'var(--bg-2)',
              color: 'var(--ink-1)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />

          {error && (
            <div role="alert" style={{
              fontSize: 12, color: 'var(--ember)',
              background: 'rgba(255,74,28,0.10)',
              border: '1px solid rgba(255,74,28,0.30)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!next || !confirm || submitting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {submitting ? 'Saving…' : 'Save passphrase'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Destructive escape hatch — "I forgot my passphrase, wipe and start
 * over". Two-stage confirmation: the user has to type "wipe" literally
 * before the button activates. Sprint 15 v1 has no recovery key; this
 * is the only way out.
 */
function ResetSection({
  showReset, setShowReset,
}: { showReset: boolean; setShowReset: (b: boolean) => void }) {
  const [confirm, setConfirm] = useState('');

  if (!showReset) {
    return (
      <div style={{ textAlign: 'center', borderTop: '1px solid var(--line-2)', paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          style={{
            fontSize: 12, color: 'var(--ink-3)',
            background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
            fontFamily: 'inherit',
          }}
        >
          I've forgotten my passphrase
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--line-2)',
        paddingTop: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        fontSize: 12, color: 'var(--ember)',
        background: 'rgba(255,74,28,0.10)',
        border: '1px solid rgba(255,74,28,0.30)',
        borderRadius: 10,
        padding: '10px 12px',
      }}>
        <AlertTriangle className="w-4 h-4" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 600, color: 'var(--ink-1)' }}>This will wipe all data on this device.</div>
          <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>
            Every saved scan, risk register entry, client record, gap analysis and configuration will be permanently
            deleted. There's no recovery key — your passphrase is the only key. Type <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-redesign-mono)' }}>wipe</code> below to confirm.
          </div>
        </div>
      </div>

      <input
        type="text"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        placeholder="Type 'wipe' to confirm"
        autoComplete="off"
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--bg-2)',
          color: 'var(--ink-1)',
          fontSize: 13,
          outline: 'none',
          fontFamily: 'var(--font-redesign-mono)',
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={() => { setShowReset(false); setConfirm(''); }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={confirm !== 'wipe'}
          onClick={() => cryptoStorage.wipeEverything()}
          style={{
            flex: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 14px',
            borderRadius: 12,
            background: confirm === 'wipe' ? 'var(--ember)' : 'rgba(255,74,28,0.20)',
            color: confirm === 'wipe' ? '#fff' : 'var(--ember)',
            border: 'none',
            cursor: confirm === 'wipe' ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit',
            opacity: confirm === 'wipe' ? 1 : 0.6,
          }}
        >
          Wipe everything
        </button>
      </div>
    </div>
  );
}
