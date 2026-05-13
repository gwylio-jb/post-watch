import { useState, useMemo, lazy, Suspense } from 'react';
import { Trash2, ChevronRight, Plus, Sparkles, Upload, Camera, GitBranch } from 'lucide-react';
import CsvImportDialog from '../shared/CsvImportDialog';
import { parseCsv } from '../../utils/csv/parseCsv';
import { parseGapItemsFromCsv, mergeGapItems, type GapItemImportRow } from '../../utils/csv/parseGapItems';
import type { AnnexAControl, ManagementClause, GapAnalysisSession, GapAnalysisItem, GapSessionSnapshot, ComplianceStatus, Priority, Client } from '../../data/types';
import type { AiSettings } from '../../data/auditTypes';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { exportAsMarkdown, exportAsPrintHTML } from '../../utils/export';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { gapNarrativePrompt, statementOfApplicabilityPrompt } from '../../utils/ai/prompts';
import ExportButton from '../shared/ExportButton';
import StatusIndicator from '../shared/StatusIndicator';
import GapDashboard from './GapDashboard';
import SnapshotDialog from './SnapshotDialog';
import SnapshotDiff from './SnapshotDiff';

// Lazy-loaded — see ScanReport.tsx for the rationale.
const AiPanel = lazy(() => import('../common/AiPanel'));

const MAX_SNAPSHOTS_PER_SESSION = 20;

interface GapAnalysisProps {
  controls: AnnexAControl[];
  clauses: ManagementClause[];
}

const complianceOptions: ComplianceStatus[] = ['Not Assessed', 'Compliant', 'Partially Compliant', 'Non-Compliant', 'Not Applicable'];
const priorityOptions: Priority[] = ['High', 'Medium', 'Low'];

export default function GapAnalysis({ controls, clauses }: GapAnalysisProps) {
  const [sessions, setSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [ai] = useLocalStorage<AiSettings>('ai-settings', {});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  // Sprint 13 Pack 1 — separate state from `aiOpen` so the two drafters can't
  // accidentally double-mount AiPanel.
  const [soaDraftOpen, setSoaDraftOpen] = useState(false);
  // Sprint 13.5 — CSV import of gap items into an existing session.
  const [importOpen, setImportOpen] = useState(false);
  // Sprint 16 — gap-session snapshots: save / list / compare.
  const [snapshots, setSnapshots] = useLocalStorage<GapSessionSnapshot[]>('gap-session-snapshots', []);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionClientId, setSessionClientId] = useState<string>(UNASSIGNED_CLIENT_ID);
  const [scope, setScope] = useState<'full' | 'clauses' | 'controls'>('full');
  const [showDashboard, setShowDashboard] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ComplianceStatus | 'all'>('all');
  // List filter — when set, the saved-sessions list shows only sessions for
  // this client. 'all' shows the full cross-client list (consultants want to
  // see everything; per-client review hides noise).
  const [filterClientId, setFilterClientId] = useState<string>('all');

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const scopeItems = useMemo(() => {
    const items: { id: string; title: string; type: 'clause' | 'control'; category: string }[] = [];
    if (scope !== 'controls') {
      for (const c of clauses) items.push({ id: c.id, title: c.title, type: 'clause', category: c.category });
    }
    if (scope !== 'clauses') {
      for (const c of controls) items.push({ id: c.id, title: c.title, type: 'control', category: c.category });
    }
    return items;
  }, [clauses, controls, scope]);

  const createSession = () => {
    const name = sessionName || `Gap Analysis — ${new Date().toLocaleDateString('en-GB')}`;
    const now = new Date().toISOString();
    const items: GapAnalysisItem[] = scopeItems.map(item => ({
      itemId: item.id,
      itemType: item.type,
      status: 'Not Assessed' as ComplianceStatus,
      notes: '',
      priority: 'Medium' as Priority,
      responsible: '',
    }));
    const session: GapAnalysisSession = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      items,
      clientId: sessionClientId,
    };
    setSessions(prev => [...prev, session]);
    setActiveSessionId(session.id);
    setSessionName('');
    // Keep sessionClientId — consultant likely creates several sessions for
    // the same client in a row.
  };

  const updateItem = (itemId: string, updates: Partial<GapAnalysisItem>) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      return {
        ...s,
        updatedAt: new Date().toISOString(),
        items: s.items.map(i => i.itemId === itemId ? { ...i, ...updates } : i),
      };
    }));
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const filteredItems = activeSession?.items.filter(item => {
    if (filterStatus === 'all') return true;
    return item.status === filterStatus;
  }) || [];

  const generateMarkdown = (): string => {
    if (!activeSession) return '';
    let md = '';
    for (const item of activeSession.items) {
      const source = item.itemType === 'control'
        ? controls.find(c => c.id === item.itemId)
        : clauses.find(c => c.id === item.itemId);
      if (!source) continue;
      md += `| ${source.id} | ${source.title} | ${item.status} | ${item.priority} | ${item.responsible} | ${item.notes} |\n`;
    }
    return `| ID | Title | Status | Priority | Responsible | Notes |\n|---|---|---|---|---|---|\n${md}`;
  };

  const generateHTML = (): string => {
    if (!activeSession) return '';
    let rows = '';
    for (const item of activeSession.items) {
      const source = item.itemType === 'control'
        ? controls.find(c => c.id === item.itemId)
        : clauses.find(c => c.id === item.itemId);
      if (!source) continue;
      const statusClass = item.status === 'Compliant' ? 'status-compliant' : item.status === 'Non-Compliant' ? 'status-non-compliant' : item.status === 'Partially Compliant' ? 'status-partial' : '';
      rows += `<tr><td class="control-id">${source.id}</td><td>${source.title}</td><td class="${statusClass}">${item.status}</td><td>${item.priority}</td><td>${item.responsible}</td><td>${item.notes}</td></tr>`;
    }
    return `<table><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Responsible</th><th>Notes</th></tr>${rows}</table>`;
  };

  if (!activeSession) {
    return (
      <div className="space-y-4">
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">New Gap Analysis</h3>
          <input
            type="text"
            placeholder="Session name..."
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
          />
          {/* Client picker — V2.1 client-centric data model. Defaults to
              Unassigned so the create flow stays one-click for users who
              haven't built out their client list yet. */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted font-mono tracking-wider">// client</label>
            <select
              value={sessionClientId}
              onChange={e => setSessionClientId(e.target.value)}
              className="flex-1 bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
            >
              <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>
              {clients.filter(c => c.id !== UNASSIGNED_CLIENT_ID).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {(['full', 'clauses', 'controls'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${scope === s ? 'bg-accent/20 text-accent' : 'bg-surface-alt text-text-secondary hover:text-text-primary'}`}
              >
                {s === 'full' ? 'Full Standard' : s === 'clauses' ? 'Clauses Only' : 'Controls Only'}
              </button>
            ))}
          </div>
          <button
            onClick={createSession}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-base rounded-md hover:bg-accent-dim transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Session
          </button>
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-secondary">Saved Sessions</h3>
              {clients.length > 1 && (
                <select
                  value={filterClientId}
                  onChange={e => setFilterClientId(e.target.value)}
                  className="bg-surface-alt border border-border rounded px-2 py-1 text-xs text-text-secondary outline-none"
                  aria-label="Filter sessions by client"
                >
                  <option value="all">All clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            {sessions
              .filter(s => filterClientId === 'all' || (s.clientId ?? UNASSIGNED_CLIENT_ID) === filterClientId)
              .map(s => {
                const owner = clients.find(c => c.id === (s.clientId ?? UNASSIGNED_CLIENT_ID));
                return (
                  // Whole-row click resumes the session — feels like "open
                  // and keep working" rather than the old "edit" pencil. The
                  // outer is a div with role=button so the inner trash can be
                  // a real <button> (nested <button>s aren't valid HTML).
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSessionId(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSessionId(s.id); } }}
                    className="group w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-lg cursor-pointer hover:border-accent/50 hover:bg-surface-alt transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
                    aria-label={`Open ${s.name}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-text-primary truncate">{s.name}</p>
                        <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{owner?.name ?? 'Unassigned'}</span>
                      </div>
                      <p className="text-xs text-text-muted">{s.items.length} items · Updated {new Date(s.updatedAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                      className="p-1.5 rounded text-text-muted hover:text-status-red hover:bg-status-red/10 transition-colors"
                      aria-label={`Delete session ${s.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" aria-hidden />
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveSessionId(null)} className="text-xs text-text-muted hover:text-text-primary">← Back</button>
          <h3 className="text-sm font-semibold text-text-primary">{activeSession.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            disabled={!ai.model?.trim()}
            title={ai.model?.trim()
              ? 'Draft a board-pack management commentary locally'
              : 'Pick a model in Settings → Local AI to enable'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-accent-soft, rgba(0,217,163,0.12))',
              color: 'var(--color-text-accent, #007A5E)',
              border: '1px solid rgba(0,217,163,0.35)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            Draft commentary
          </button>
          <button
            type="button"
            onClick={() => setSoaDraftOpen(true)}
            disabled={!ai.model?.trim()}
            title={ai.model?.trim()
              ? 'Draft the Statement of Applicability section locally'
              : 'Pick a model in Settings → Local AI to enable'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(139,92,246,0.12)',
              color: 'var(--color-text-violet, #7C3AED)',
              border: '1px solid rgba(139,92,246,0.35)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            Draft SoA
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors bg-surface border border-border text-text-secondary hover:text-text-primary"
            title="Import gap statuses from a CSV"
          >
            <Upload className="w-3 h-3" /> Import CSV
          </button>

          {/* Sprint 16 — gap-session snapshots */}
          <SnapshotControls
            session={activeSession}
            snapshots={snapshots ?? []}
            onSave={() => setSnapshotDialogOpen(true)}
            onCompare={id => setCompareSnapshotId(id)}
            onDelete={id => {
              setSnapshots(prev => (Array.isArray(prev) ? prev : []).filter(s => s.id !== id));
              if (compareSnapshotId === id) setCompareSnapshotId(null);
            }}
          />
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${showDashboard ? 'bg-accent/20 text-accent' : 'bg-surface border border-border text-text-secondary hover:text-text-primary'}`}
          >
            Dashboard
          </button>
          <ExportButton
            onExportMarkdown={() => exportAsMarkdown(activeSession.name, generateMarkdown())}
            onExportHTML={() => exportAsPrintHTML(activeSession.name, generateHTML())}
            onPrint={() => window.print()}
          />
        </div>
      </div>

      {/* Sprint 16 — Snapshot diff panel renders inline below the toolbar */}
      {(() => {
        const cmp = (snapshots ?? []).find(s => s.id === compareSnapshotId);
        return cmp ? (
          <SnapshotDiff
            snapshot={cmp}
            current={activeSession.items}
            onClose={() => setCompareSnapshotId(null)}
          />
        ) : null;
      })()}

      {snapshotDialogOpen && (
        <SnapshotDialog
          sessionName={activeSession.name}
          defaultName={`Snapshot ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          onSave={(name, notes) => {
            const fresh: GapSessionSnapshot = {
              id: crypto.randomUUID(),
              sessionId: activeSession.id,
              name,
              createdAt: new Date().toISOString(),
              // Deep-clone items so future edits to the session don't mutate
              // the frozen snapshot. JSON round-trip is safe here — gap items
              // are plain data with no Dates / Maps.
              items: JSON.parse(JSON.stringify(activeSession.items)) as GapAnalysisItem[],
              notes: notes || undefined,
            };
            setSnapshots(prev => {
              const safe = Array.isArray(prev) ? prev : [];
              // Cap per-session: keep most recent MAX_SNAPSHOTS_PER_SESSION
              // for this session, plus all snapshots from other sessions.
              const sameSession = safe.filter(s => s.sessionId === activeSession.id);
              const others = safe.filter(s => s.sessionId !== activeSession.id);
              const trimmed = [fresh, ...sameSession]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, MAX_SNAPSHOTS_PER_SESSION);
              return [...others, ...trimmed];
            });
            setSnapshotDialogOpen(false);
          }}
          onClose={() => setSnapshotDialogOpen(false)}
        />
      )}

      {aiOpen && ai.model && (
        <Suspense fallback={null}>
          <AiPanel
            title="Management commentary"
            subtitle={activeSession.name}
            model={ai.model}
            baseUrl={ai.baseUrl}
            prompt={gapNarrativePrompt(
              activeSession,
              clauses,
              controls,
              { client: clients.find(c => c.id === (activeSession.clientId ?? UNASSIGNED_CLIENT_ID)) },
            )}
            maxTokens={1500}
            outputKind="prose"
            onClose={() => setAiOpen(false)}
          />
        </Suspense>
      )}

      {soaDraftOpen && ai.model && (
        <Suspense fallback={null}>
          <AiPanel
            title="Draft Statement of Applicability"
            subtitle={activeSession.name}
            model={ai.model}
            baseUrl={ai.baseUrl}
            prompt={statementOfApplicabilityPrompt(
              activeSession,
              controls,
              { client: clients.find(c => c.id === (activeSession.clientId ?? UNASSIGNED_CLIENT_ID)) },
            )}
            maxTokens={2000}
            outputKind="prose"
            // Land the accepted draft straight onto the session record so
            // re-opening the session shows the latest draft. The user can
            // regenerate at any time.
            onAccept={text => {
              setSessions(prev => (Array.isArray(prev) ? prev : []).map(s =>
                s.id === activeSession.id
                  ? { ...s, soaDraft: text, updatedAt: new Date().toISOString() }
                  : s
              ));
            }}
            acceptLabel="Save SoA draft"
            onClose={() => setSoaDraftOpen(false)}
          />
        </Suspense>
      )}

      {importOpen && (
        <CsvImportDialog<GapItemImportRow>
          title="Import gap analysis from CSV"
          subtitle="Updates existing rows by id and adds new ones. Untouched items stay as they are."
          parse={text => {
            const parsed = parseCsv(text);
            return parseGapItemsFromCsv(parsed, activeSession.items, clauses, controls);
          }}
          previewHeaders={['Id', 'Type', 'Status', 'Priority', 'Action']}
          renderRow={(row, i) => (
            <>
              <td key={`id-${i}`} style={{ padding: '8px 12px', fontFamily: 'var(--font-redesign-mono)' }}>{row.item.itemId}</td>
              <td key={`tp-${i}`} style={{ padding: '8px 12px', color: 'var(--ink-3)' }}>{row.item.itemType}</td>
              <td key={`st-${i}`} style={{ padding: '8px 12px' }}>{row.item.status}</td>
              <td key={`pr-${i}`} style={{ padding: '8px 12px' }}>{row.item.priority}</td>
              <td key={`ac-${i}`} style={{ padding: '8px 12px' }}>
                <span style={{
                  fontSize: 10,
                  color: row.isUpdate ? '#D97706' : 'var(--mint)',
                  fontFamily: 'var(--font-redesign-mono)',
                }}>
                  {row.isUpdate ? 'update' : 'new'}
                </span>
              </td>
            </>
          )}
          onConfirm={rows => {
            const items = rows.map(r => r.item);
            setSessions(prev => (Array.isArray(prev) ? prev : []).map(s =>
              s.id === activeSession.id
                ? { ...s, items: mergeGapItems(s.items, items), updatedAt: new Date().toISOString() }
                : s
            ));
            setImportOpen(false);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {showDashboard && <GapDashboard items={activeSession.items} />}

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted">Filter:</span>
        {['all' as const, ...complianceOptions].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${filterStatus === s ? 'bg-accent/20 text-accent' : 'bg-surface-alt text-text-muted hover:text-text-secondary'}`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filteredItems.map(item => {
          const source = item.itemType === 'control'
            ? controls.find(c => c.id === item.itemId)
            : clauses.find(c => c.id === item.itemId);
          if (!source) return null;
          return (
            <div key={item.itemId} className="flex items-center gap-2 p-2 bg-surface border border-border rounded-lg text-xs">
              <span className="font-mono text-accent w-14 flex-shrink-0">{source.id}</span>
              <span className="text-text-primary flex-1 min-w-0 truncate">{source.title}</span>
              <select
                value={item.status}
                onChange={e => updateItem(item.itemId, { status: e.target.value as ComplianceStatus })}
                className="bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] text-text-secondary outline-none w-32"
              >
                {complianceOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select
                value={item.priority}
                onChange={e => updateItem(item.itemId, { priority: e.target.value as Priority })}
                className="bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] text-text-secondary outline-none w-16"
              >
                {priorityOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="text"
                placeholder="Owner"
                value={item.responsible}
                onChange={e => updateItem(item.itemId, { responsible: e.target.value })}
                className="bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] text-text-secondary outline-none w-24"
              />
              <input
                type="text"
                placeholder="Notes..."
                value={item.notes}
                onChange={e => updateItem(item.itemId, { notes: e.target.value })}
                className="bg-surface-alt border border-border rounded px-1.5 py-1 text-[10px] text-text-secondary outline-none flex-1 min-w-0"
              />
              <StatusIndicator status={item.status} showLabel={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Snapshot toolbar control ─────────────────────────────────────────────
//
// Sprint 16. Renders two buttons inline:
//   - "Snapshot" → opens the SnapshotDialog to save a new one.
//   - "Compare ▾" → dropdown listing existing snapshots for THIS session;
//     each row picks a comparison target or deletes the snapshot.
// Stays compact in the toolbar — no separate panel until the user drills in.

function SnapshotControls({
  session, snapshots, onSave, onCompare, onDelete,
}: {
  session: GapAnalysisSession;
  snapshots: GapSessionSnapshot[];
  onSave: () => void;
  onCompare: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const forThisSession = useMemo(
    () => snapshots
      .filter(s => s.sessionId === session.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [snapshots, session.id],
  );

  return (
    <>
      <button
        type="button"
        onClick={onSave}
        title="Freeze the current session state as a comparison point"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors bg-surface border border-border text-text-secondary hover:text-text-primary"
      >
        <Camera className="w-3 h-3" /> Snapshot
      </button>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          disabled={forThisSession.length === 0}
          title={forThisSession.length === 0
            ? 'Save a snapshot first to enable comparison'
            : `${forThisSession.length} snapshot${forThisSession.length === 1 ? '' : 's'} for this session`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors bg-surface border border-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <GitBranch className="w-3 h-3" />
          Compare ({forThisSession.length})
        </button>
        {menuOpen && forThisSession.length > 0 && (
          <div
            role="menu"
            onMouseLeave={() => setMenuOpen(false)}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
              minWidth: 280, maxWidth: 360,
              background: 'var(--bg-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 10,
              boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
              padding: 6,
              maxHeight: 320, overflowY: 'auto',
            }}
          >
            {forThisSession.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onCompare(s.id); setMenuOpen(false); }}
                  style={{
                    flex: 1,
                    background: 'none', border: 'none', textAlign: 'left',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--ink-1)', fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                    {new Date(s.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{s.items.length} items
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  title="Delete this snapshot"
                  className="icon-btn"
                  style={{ width: 24, height: 24, borderRadius: 6 }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
