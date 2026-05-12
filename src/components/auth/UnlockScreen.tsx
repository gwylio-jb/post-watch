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
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the passphrase input on mount — keyboard users land in the
  // right place without having to tab.
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await cryptoStorage.unlock(passphrase);
      if (!ok) {
        setError('Incorrect passphrase. Try again, or reset below if you no longer have it.');
        // Clear the field so the user can re-type without a backspace.
        setPassphrase('');
        inputRef.current?.focus();
      }
      // On success, cryptoStorage.subscribe fires; LockGate re-renders
      // and replaces us with AppContent. Nothing else to do here.
    } catch (err) {
      setError((err as Error).message || 'Unexpected unlock failure');
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
            Passphrase
          </label>
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
            disabled={!passphrase || submitting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {submitting ? 'Verifying…' : 'Unlock'}
          </button>
        </form>

        <ResetSection showReset={showReset} setShowReset={setShowReset} />
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
