/**
 * Sprint 21: in-app text-input prompt modal, driven by promptDialog()
 * in src/utils/dialog.ts.
 *
 * window.prompt() is blocked inside the Tauri WKWebView and the dialog
 * plugin has no text-input variant, so passphrase entry (backup
 * export/import) silently broke in production. This host renders a
 * minimal modal wherever promptDialog() is awaited.
 *
 * Mounted once next to UndoHost in App.tsx. Same module-scope bus
 * pattern as undoBus: the util owns the pending state, this component
 * just renders and settles it.
 */
import { useEffect, useRef, useState } from 'react';
import { subscribePrompt, getPendingPrompt, settlePrompt } from '../../utils/dialog';

export default function PromptHost() {
  const [, force] = useState(0);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribePrompt(() => {
      const p = getPendingPrompt();
      setValue(p?.options.defaultValue ?? '');
      force(n => n + 1);
    });
  }, []);

  const pending = getPendingPrompt();

  // Focus the input when a prompt appears.
  useEffect(() => {
    if (pending) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [pending]);

  if (!pending) return null;

  const { message, options } = pending;

  const submit = () => settlePrompt(value);
  const cancel = () => settlePrompt(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={options.title ?? 'Input required'}
      onClick={cancel}
      onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(10,14,21,0.78)',
        display: 'grid', placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        className="bubble"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        {options.title && (
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-redesign-display)',
            fontSize: 17, fontWeight: 700, color: 'var(--ink-1)',
          }}>
            {options.title}
          </h2>
        )}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>
          {message}
        </p>
        <form
          onSubmit={e => { e.preventDefault(); submit(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            ref={inputRef}
            type={options.mask ? 'password' : 'text'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={options.placeholder}
            autoComplete={options.mask ? 'off' : undefined}
            spellCheck={false}
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={cancel}>
              {options.cancelLabel ?? 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary">
              {options.okLabel ?? 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
