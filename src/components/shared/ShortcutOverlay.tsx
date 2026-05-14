/**
 * Sprint 19: keyboard shortcut help overlay.
 *
 * Pressing `?` (when no input is focused) toggles a modal listing every
 * shortcut the app supports. The list is hand-maintained here — there's
 * no global registry of shortcuts to enumerate, and individual screens
 * own their own keybindings, so this is a documentation surface rather
 * than a generated one.
 *
 * Keep it accurate: any time a new shortcut lands, add a row.
 */
import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutRow { keys: string[]; label: string; }
interface ShortcutGroup { title: string; rows: ShortcutRow[]; }

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    rows: [
      { keys: ['?'], label: 'Show this overlay' },
      { keys: ['Esc'], label: 'Close modals / overlays' },
      { keys: ['⌘', 'K'], label: 'Open search (Sprint 20)' },
      { keys: ['⌘', '⇧', 'N'], label: 'New window' },
      { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Navigation',
    rows: [
      { keys: ['g', 'd'], label: 'Go to Dashboard' },
      { keys: ['g', 'r'], label: 'Go to Risk Register' },
      { keys: ['g', 'a'], label: 'Go to Audit' },
      { keys: ['g', 'w'], label: 'Go to WP Audit' },
    ],
  },
  {
    title: 'Lists & tables',
    rows: [
      { keys: ['↑', '↓'], label: 'Move selection' },
      { keys: ['Enter'], label: 'Open selected row' },
      { keys: ['⌫'], label: 'Delete selected (with undo)' },
    ],
  },
];

export default function ShortcutOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      // ? opens the overlay (no modifiers, not while typing).
      if (e.key === '?' && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // Cmd/Ctrl+/ is the alternative trigger common in dev tools.
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.50)',
        display: 'grid', placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bubble"
        style={{
          width: '100%', maxWidth: 560,
          maxHeight: '80vh', overflow: 'auto',
          padding: 24,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'grid', placeItems: 'center',
            background: 'rgba(123,107,237,0.14)',
            border: '1px solid rgba(123,107,237,0.30)',
            color: 'var(--violet)',
          }}>
            <Keyboard className="w-4 h-4" />
          </div>
          <h2 style={{
            margin: 0, flex: 1,
            fontFamily: 'var(--font-redesign-display)',
            fontSize: 18, fontWeight: 700, color: 'var(--ink-1)',
          }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', padding: 4, display: 'inline-flex',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {GROUPS.map(group => (
          <section key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{
              margin: 0, fontSize: 11, fontWeight: 600,
              color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: 'var(--font-redesign-mono)',
            }}>
              {group.title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.rows.map(row => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0',
                    fontSize: 13, color: 'var(--ink-2)',
                  }}
                >
                  <span>{row.label}</span>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {row.keys.map((k, i) => (
                      <kbd key={i} style={{
                        fontFamily: 'var(--font-redesign-mono)',
                        fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-2)',
                        border: '1px solid var(--line-2)',
                        borderRadius: 6,
                        padding: '2px 7px',
                        color: 'var(--ink-1)',
                        minWidth: 22, textAlign: 'center',
                      }}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
          Press <kbd style={{
            fontFamily: 'var(--font-redesign-mono)',
            background: 'var(--bg-2)', border: '1px solid var(--line-2)',
            borderRadius: 5, padding: '1px 5px',
          }}>?</kbd> any time to reopen.
        </p>
      </div>
    </div>
  );
}
