/**
 * SnapshotDiff — renders the result of `diffGapItems(snapshot, current)`
 * as a compact table with removed / changed / added rows.
 *
 * Sprint 16. Lives inside GapAnalysis below the snapshot toolbar.
 */
import { useMemo } from 'react';
import { ArrowRight, X as XIcon, Plus, Minus } from 'lucide-react';
import type { GapAnalysisItem, GapSessionSnapshot } from '../../data/types';
import { diffGapItems } from '../../utils/diff';

export interface SnapshotDiffProps {
  snapshot: GapSessionSnapshot;
  current: GapAnalysisItem[];
  onClose: () => void;
}

export default function SnapshotDiff({ snapshot, current, onClose }: SnapshotDiffProps) {
  // Pure diff — memoise so re-renders of GapAnalysis don't recompute.
  const changes = useMemo(
    () => diffGapItems(snapshot.items, current),
    [snapshot.items, current],
  );

  const counts = useMemo(() => {
    let added = 0, removed = 0, changed = 0;
    for (const c of changes) {
      if (c.kind === 'added') added++;
      else if (c.kind === 'removed') removed++;
      else if (c.kind === 'changed') changed++;
    }
    return { added, removed, changed };
  }, [changes]);

  return (
    <div className="bubble" style={{ padding: 18, marginTop: 10 }}>
      {/* Heading + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            comparing
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-1)' }}>
            <strong style={{ color: 'var(--mint)' }}>{snapshot.name}</strong> → current
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Snapshot from {new Date(snapshot.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button onClick={onClose} className="icon-btn" aria-label="Close diff" style={{ width: 28, height: 28, borderRadius: 8 }}>
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, fontSize: 12 }}>
        <span style={{ color: counts.added > 0 ? 'var(--mint)' : 'var(--ink-3)' }}>
          <Plus className="w-3 h-3" style={{ display: 'inline', verticalAlign: -2 }} /> {counts.added} added
        </span>
        <span style={{ color: counts.changed > 0 ? 'var(--violet)' : 'var(--ink-3)' }}>
          <ArrowRight className="w-3 h-3" style={{ display: 'inline', verticalAlign: -2 }} /> {counts.changed} changed
        </span>
        <span style={{ color: counts.removed > 0 ? 'var(--ember)' : 'var(--ink-3)' }}>
          <Minus className="w-3 h-3" style={{ display: 'inline', verticalAlign: -2 }} /> {counts.removed} removed
        </span>
      </div>

      {changes.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--font-redesign-mono)' }}>
          // No changes since this snapshot
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--line-2)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)' }}>
                <th style={th}>Change</th>
                <th style={th}>Item</th>
                <th style={th}>Status</th>
                <th style={th}>Priority</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, i) => (
                <DiffRow key={i} change={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left',
  fontSize: 10, fontWeight: 600,
  color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
  fontFamily: 'var(--font-redesign-mono)',
};

const td: React.CSSProperties = {
  padding: '8px 12px', verticalAlign: 'top',
  borderTop: '1px solid var(--line)',
};

function DiffRow({ change }: { change: ReturnType<typeof diffGapItems>[number] }) {
  if (change.kind === 'added') {
    return (
      <tr style={{ background: 'rgba(0,217,163,0.05)' }}>
        <td style={td}>
          <span style={pill('var(--mint)')}><Plus className="w-3 h-3" /> added</span>
        </td>
        <td style={td}>
          <code style={mono}>{change.item.itemId}</code>
        </td>
        <td style={td}>{change.item.status}</td>
        <td style={td}>{change.item.priority}</td>
        <td style={td}>{change.item.notes || '—'}</td>
      </tr>
    );
  }
  if (change.kind === 'removed') {
    return (
      <tr style={{ background: 'rgba(255,74,28,0.05)' }}>
        <td style={td}>
          <span style={pill('var(--ember)')}><Minus className="w-3 h-3" /> removed</span>
        </td>
        <td style={td}>
          <code style={mono}>{change.item.itemId}</code>
        </td>
        <td style={td}>{change.item.status}</td>
        <td style={td}>{change.item.priority}</td>
        <td style={td}>{change.item.notes || '—'}</td>
      </tr>
    );
  }
  // changed
  const showField = (f: keyof GapAnalysisItem) => change.fields.includes(f);
  return (
    <tr style={{ background: 'rgba(139,92,246,0.04)' }}>
      <td style={td}>
        <span style={pill('var(--violet)')}><ArrowRight className="w-3 h-3" /> changed</span>
      </td>
      <td style={td}>
        <code style={mono}>{change.before.itemId}</code>
      </td>
      <td style={td}>{showField('status') ? <BeforeAfter b={change.before.status} a={change.after.status} /> : change.after.status}</td>
      <td style={td}>{showField('priority') ? <BeforeAfter b={change.before.priority} a={change.after.priority} /> : change.after.priority}</td>
      <td style={td}>{showField('notes') ? <BeforeAfter b={change.before.notes || '—'} a={change.after.notes || '—'} /> : (change.after.notes || '—')}</td>
    </tr>
  );
}

function BeforeAfter({ b, a }: { b: string; a: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--ink-3)', textDecoration: 'line-through' }}>{b}</span>
      <ArrowRight className="w-3 h-3" style={{ color: 'var(--violet)' }} />
      <strong style={{ color: 'var(--ink-1)' }}>{a}</strong>
    </span>
  );
}

function pill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 999,
    background: `color-mix(in oklab, ${color} 14%, transparent)`,
    border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
    color,
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    fontFamily: 'var(--font-redesign-mono)',
    letterSpacing: '0.05em',
  };
}

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-redesign-mono)',
  fontSize: 11,
  color: 'var(--ink-1)',
  background: 'rgba(0,0,0,0.15)',
  padding: '1px 6px',
  borderRadius: 4,
};
