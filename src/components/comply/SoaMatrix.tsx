/**
 * Sprint 23 (v3.0 pillar #1): Statement of Applicability matrix.
 *
 * One row per Annex A control per client: applicable toggle,
 * justification, implementation status, evidence attachments. Grouped
 * by the four 2022 themes with per-theme bulk actions. A completeness
 * meter tracks justification coverage — the number an auditor drills.
 *
 * Data lives at `clause-control:soa` (SoaStore, per-client). Rows are
 * seeded lazily on first visit via ensureSeeded. Justification edits
 * commit on blur — committing per keystroke would rewrite the 93-entry
 * array into (potentially encrypted) localStorage on every key.
 */
import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Download, Paperclip, Import } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { SoaStore, SoaEntry, Client, GapAnalysisSession, ImplementationStatus } from '../../data/types';
import { allControls } from '../../data/controls';
import {
  ensureSeeded, updateEntry, setThemeApplicability, computeStats, seedFromGapSession, soaToCsv,
} from '../../utils/soa';
import { exportAsCsv } from '../../utils/export';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { confirmDialog } from '../../utils/dialog';
import AttachmentList from '../shared/AttachmentList';
import { exportSoaPdf } from '../../pdf/exportSoa';

const THEMES = ['Organisational', 'People', 'Physical', 'Technological'] as const;

const IMPL_OPTIONS: ImplementationStatus[] = ['Not Started', 'In Progress', 'Implemented', 'Verified'];

const IMPL_COLOR: Record<ImplementationStatus, string> = {
  'Not Started': 'var(--ink-3)',
  'In Progress': 'var(--violet)',
  'Implemented': 'var(--mint)',
  'Verified':    'var(--mint)',
};

export default function SoaMatrix() {
  const [store, setStore] = useLocalStorage<SoaStore>('soa', {});
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);

  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);
  const pickerClients = useMemo<Client[]>(() => {
    if (safeClients.some(c => c.id === UNASSIGNED_CLIENT_ID)) return safeClients;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...safeClients,
    ];
  }, [safeClients]);

  const [clientId, setClientId] = useState<string>(
    () => pickerClients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  /** Row whose evidence panel is open (controlId), or null. */
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<'all' | 'applicable' | 'excluded' | 'unjustified'>('all');

  const safeStore = useMemo<SoaStore>(
    () => (store && typeof store === 'object' && !Array.isArray(store)) ? store : {},
    [store],
  );

  // Seed missing rows for the selected client. Runs after render so the
  // seeded array lands in storage exactly once per client visit.
  const { entries } = useMemo(() => ensureSeeded(safeStore, clientId), [safeStore, clientId]);
  useEffect(() => {
    const check = ensureSeeded(safeStore, clientId);
    if (check.changed) {
      setStore(prev => ({ ...(prev ?? {}), [clientId]: check.entries }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, safeStore]);

  const stats = useMemo(() => computeStats(entries), [entries]);

  const controlsByTheme = useMemo(() => {
    const map = new Map<string, typeof allControls>();
    for (const theme of THEMES) {
      map.set(theme, allControls.filter(c => c.category === theme));
    }
    return map;
  }, []);

  const entryById = useMemo(() => new Map(entries.map(e => [e.controlId, e])), [entries]);

  const latestSession = useMemo(() => {
    const sessions = (Array.isArray(gapSessions) ? gapSessions : [])
      .filter(s => (s.clientId ?? UNASSIGNED_CLIENT_ID) === clientId)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return sessions[0] ?? null;
  }, [gapSessions, clientId]);

  const commit = (next: SoaEntry[]) => {
    setStore(prev => ({ ...(prev ?? {}), [clientId]: next }));
  };

  const patchRow = (controlId: string, patch: Partial<Pick<SoaEntry, 'applicable' | 'justification' | 'implementationStatus'>>) => {
    commit(updateEntry(entries, controlId, patch));
  };

  const handleSeedFromGap = async () => {
    if (!latestSession) return;
    const ok = await confirmDialog(
      `Pre-fill untouched rows from "${latestSession.name}"? Rows you've already edited are never overwritten.`,
      { title: 'Seed from gap analysis', okLabel: 'Pre-fill' },
    );
    if (!ok) return;
    commit(seedFromGapSession(entries, latestSession));
    pushToast('success', 'Untouched rows pre-filled from the latest gap session');
  };

  const clientName = pickerClients.find(c => c.id === clientId)?.name ?? 'Unassigned';

  const handleExportCsv = () => {
    exportAsCsv(`soa-${clientName}`, soaToCsv(entries));
    pushToast('success', 'SoA exported as CSV');
  };

  const handleExportPdf = async () => {
    try {
      const client = pickerClients.find(c => c.id === clientId) ?? null;
      await exportSoaPdf(client, entries);
      pushToast('success', 'SoA PDF downloaded');
    } catch (e) {
      pushToast('error', (e as Error).message);
    }
  };

  const rowVisible = (e: SoaEntry): boolean => {
    switch (rowFilter) {
      case 'applicable':  return e.applicable;
      case 'excluded':    return !e.applicable;
      case 'unjustified': return e.justification.trim() === '';
      default:            return true;
    }
  };

  const toggleTheme = (theme: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header strip: client picker + stats + actions */}
      <div className="bubble" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: 'var(--font-redesign-mono)',
            }}>
              Client
            </span>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setEvidenceFor(null); }}
              style={{
                padding: '6px 10px', borderRadius: 10,
                border: '1px solid var(--line-2)',
                background: 'var(--bg-2)', color: 'var(--ink-1)',
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            >
              {pickerClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {latestSession && (
              <button type="button" className="btn btn-ghost" onClick={() => void handleSeedFromGap()}>
                <Import className="w-3.5 h-3.5" />
                Pre-fill from gap session
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleExportPdf()}>
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* Stats + completeness meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {[
            { l: 'Controls', v: String(stats.total) },
            { l: 'Applicable', v: String(stats.applicable) },
            { l: 'Excluded', v: String(stats.excluded) },
            { l: 'Implemented', v: `${stats.implemented}/${stats.applicable}` },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>{s.v}</div>
            </div>
          ))}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)', marginBottom: 4 }}>
              <span>Justification coverage</span>
              <span>{stats.completeness}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--line-2)' }}>
              <div style={{
                width: `${stats.completeness}%`, height: '100%', borderRadius: 3,
                background: stats.completeness === 100 ? 'var(--mint)' : 'var(--violet)',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Row filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            ['all', 'All'], ['applicable', 'Applicable'], ['excluded', 'Excluded'], ['unjustified', 'Needs justification'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRowFilter(id)}
              style={{
                padding: '5px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                background: rowFilter === id ? 'rgba(0,217,163,0.14)' : 'transparent',
                border: `1px solid ${rowFilter === id ? 'rgba(0,217,163,0.30)' : 'var(--line-2)'}`,
                color: rowFilter === id ? 'var(--mint)' : 'var(--ink-3)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme groups */}
      {THEMES.map(theme => {
        const themeControls = controlsByTheme.get(theme) ?? [];
        const rows = themeControls
          .map(c => ({ control: c, entry: entryById.get(c.id) }))
          .filter((r): r is { control: typeof themeControls[number]; entry: SoaEntry } => !!r.entry && rowVisible(r.entry));
        const isCollapsed = collapsed.has(theme);
        const themeApplicable = themeControls.filter(c => entryById.get(c.id)?.applicable).length;

        return (
          <section key={theme} className="bubble" style={{ padding: 0, overflow: 'hidden' }}>
            <header
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--line-2)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleTheme(theme)}
                aria-expanded={!isCollapsed}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)',
                  fontSize: 15, fontWeight: 700, padding: 0,
                }}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {theme}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {themeApplicable}/{themeControls.length} applicable
                </span>
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => commit(setThemeApplicability(entries, theme, true))}
                >
                  All applicable
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => commit(setThemeApplicability(entries, theme, false))}
                >
                  All excluded
                </button>
              </div>
            </header>

            {!isCollapsed && rows.map(({ control, entry }) => (
              <div key={control.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px minmax(140px, 1fr) 90px 150px minmax(160px, 1.4fr) 36px',
                    gap: 10,
                    alignItems: 'center',
                    padding: '10px 18px',
                    opacity: entry.applicable ? 1 : 0.55,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 12, color: 'var(--mint)' }}>
                    {control.id}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={control.title}>
                    {control.title}
                  </span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={entry.applicable}
                      onChange={e => patchRow(control.id, { applicable: e.target.checked })}
                    />
                    {entry.applicable ? 'Yes' : 'No'}
                  </label>
                  <select
                    value={entry.implementationStatus}
                    disabled={!entry.applicable}
                    onChange={e => patchRow(control.id, { implementationStatus: e.target.value as ImplementationStatus })}
                    style={{
                      padding: '4px 8px', borderRadius: 8,
                      border: '1px solid var(--line-2)',
                      background: 'var(--bg-2)',
                      color: IMPL_COLOR[entry.implementationStatus],
                      fontSize: 12, outline: 'none', fontFamily: 'inherit',
                      cursor: entry.applicable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {IMPL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <JustificationInput
                    key={`${clientId}-${control.id}`}
                    value={entry.justification}
                    applicable={entry.applicable}
                    onCommit={v => patchRow(control.id, { justification: v })}
                  />
                  <button
                    type="button"
                    aria-label={`Evidence for ${control.id}`}
                    onClick={() => setEvidenceFor(evidenceFor === control.id ? null : control.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: evidenceFor === control.id ? 'var(--mint)' : 'var(--ink-3)',
                      padding: 4, display: 'inline-flex',
                    }}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>
                </div>
                {evidenceFor === control.id && (
                  <div style={{ padding: '0 18px 12px 118px' }}>
                    <AttachmentList ownerKind="soa" ownerId={`${clientId}:${control.id}`} compact />
                  </div>
                )}
              </div>
            ))}
            {!isCollapsed && rows.length === 0 && (
              <p style={{ padding: '14px 18px', margin: 0, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                // No rows match this filter in {theme}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Justification cell with local draft state — commits on blur so we
 * don't rewrite the whole client's SoA array on every keystroke.
 * Keyed by client+control in the parent so switching client resets it.
 */
function JustificationInput({ value, applicable, onCommit }: {
  value: string;
  applicable: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Re-sync when the underlying value changes externally (seed-from-gap).
  useEffect(() => { setDraft(value); }, [value]);

  return (
    <input
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      placeholder={applicable ? 'Why is this control included?' : 'Why is this control excluded?'}
      style={{
        padding: '5px 10px', borderRadius: 8,
        border: `1px solid ${draft.trim() === '' ? 'rgba(255,74,28,0.35)' : 'var(--line-2)'}`,
        background: 'var(--bg-2)', color: 'var(--ink-1)',
        fontSize: 12, outline: 'none', fontFamily: 'inherit',
        width: '100%',
      }}
    />
  );
}
