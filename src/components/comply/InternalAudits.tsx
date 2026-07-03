/**
 * Sprint 25 (v3.0 pillar #3): internal audit programme (clause 9.2).
 *
 * Per-client audit list + rolling-12-month ISMS coverage meter.
 * Creating an audit picks a scope (full standard / clauses / one theme);
 * executing it walks the scoped items as a checklist. Findings raised
 * from checklist lines land on the CAPA register with source
 * 'internal-audit' and this audit's id as sourceRef.
 */
import { useState, useMemo } from 'react';
import { Plus, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { InternalAudit, Client, Finding, FindingSeverity } from '../../data/types';
import {
  newInternalAudit, checklistProgress, updateChecklistItem, completeAudit, ismsCoverage,
} from '../../utils/isms';
import { newFinding } from '../../utils/findings';
import { allControls } from '../../data/controls';
import { managementClauses } from '../../data/clauses';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { confirmDialog } from '../../utils/dialog';
import Modal from '../shared/Modal';
import EmptyState from '../shared/EmptyState';
import FormField from '../shared/FormField';

type ScopePreset = 'full' | 'clauses' | 'Organisational' | 'People' | 'Physical' | 'Technological';

const SCOPE_LABEL: Record<ScopePreset, string> = {
  full: 'Full standard (clauses + Annex A)',
  clauses: 'Management clauses 4–10',
  Organisational: 'Annex A — Organisational',
  People: 'Annex A — People',
  Physical: 'Annex A — Physical',
  Technological: 'Annex A — Technological',
};

function refIdsForScope(scope: ScopePreset): string[] {
  switch (scope) {
    case 'full':    return [...managementClauses.map(c => c.id), ...allControls.map(c => c.id)];
    case 'clauses': return managementClauses.map(c => c.id);
    default:        return allControls.filter(c => c.category === scope).map(c => c.id);
  }
}

const titleByRefId = new Map<string, string>([
  ...managementClauses.map(c => [c.id, c.title] as const),
  ...allControls.map(c => [c.id, c.title] as const),
]);

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)', color: 'var(--ink-1)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%',
};

export default function InternalAudits() {
  const [audits, setAudits] = useLocalStorage<InternalAudit[]>('internal-audits', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [, setFindings] = useLocalStorage<Finding[]>('findings', []);

  const safeAudits = useMemo<InternalAudit[]>(() => Array.isArray(audits) ? audits : [], [audits]);
  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const [clientId, setClientId] = useState<string>(
    () => safeClients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const clientAudits = useMemo(
    () => safeAudits
      .filter(a => a.clientId === clientId)
      .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate)),
    [safeAudits, clientId],
  );
  const coverage = useMemo(() => ismsCoverage(safeAudits, clientId), [safeAudits, clientId]);
  const detail = detailId ? safeAudits.find(a => a.id === detailId) ?? null : null;

  const patchAudit = (id: string, updater: (a: InternalAudit) => InternalAudit) => {
    setAudits(prev => (Array.isArray(prev) ? prev : []).map(a => a.id === id ? updater(a) : a));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bubble" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          aria-label="Client"
          style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
        >
          {safeClients.length === 0 && <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>}
          {safeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)', marginBottom: 4 }}>
            <span>ISMS audited, rolling 12 months</span>
            <span>{coverage.covered}/{coverage.total} · {coverage.pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--line-2)' }}>
            <div style={{
              width: `${coverage.pct}%`, height: '100%', borderRadius: 3,
              background: coverage.pct >= 100 ? 'var(--mint)' : 'var(--violet)',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" />
          Plan audit
        </button>
      </div>

      {clientAudits.length === 0 ? (
        <div className="bubble">
          <EmptyState
            icon={ClipboardCheck}
            title="No internal audits planned"
            detail="Clause 9.2 expects a programme that covers the whole ISMS over time. Plan an audit, walk its checklist, and raise findings straight onto the CAPA register."
            cta={{ label: 'Plan the first audit', onClick: () => setShowNew(true) }}
          />
        </div>
      ) : (
        <section className="bubble" style={{ padding: 0, overflow: 'hidden' }}>
          {clientAudits.map(a => {
            const prog = checklistProgress(a);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setDetailId(a.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px, 1fr) 110px 120px 140px',
                  gap: 12, alignItems: 'center',
                  width: '100%', textAlign: 'left',
                  padding: '12px 18px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--line-2)',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 600 }}>{a.title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {a.status === 'complete' ? `done ${a.completedDate}` : a.status}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  planned {a.plannedDate}
                </span>
                <span style={{ fontSize: 11, color: prog.pct === 100 ? 'var(--mint)' : 'var(--ink-2)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {prog.covered}/{prog.total} items · {a.findingIds.length} finding{a.findingIds.length === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {detail && (
        <AuditDetail
          audit={detail}
          onPatch={updater => patchAudit(detail.id, updater)}
          onRaiseFinding={(refId, notes) => {
            const f = newFinding({
              clientId: detail.clientId,
              source: 'internal-audit',
              sourceRef: detail.id,
              title: `Audit finding: ${refId} ${titleByRefId.get(refId) ?? ''}`.trim(),
              description: notes,
              severity: 'medium' as FindingSeverity,
              refIds: [refId],
            });
            setFindings(prev => [...(Array.isArray(prev) ? prev : []), f]);
            patchAudit(detail.id, a => ({ ...a, findingIds: [...a.findingIds, f.id] }));
            pushToast('success', 'Finding raised on the CAPA register');
          }}
          onClose={() => setDetailId(null)}
        />
      )}

      {showNew && (
        <NewAuditModal
          clientId={clientId}
          onCreate={a => {
            setAudits(prev => [...(Array.isArray(prev) ? prev : []), a]);
            setShowNew(false);
            setDetailId(a.id);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

/* ─── Detail: execution checklist ─────────────────────────────────────── */

function AuditDetail({ audit, onPatch, onRaiseFinding, onClose }: {
  audit: InternalAudit;
  onPatch: (updater: (a: InternalAudit) => InternalAudit) => void;
  onRaiseFinding: (refId: string, notes: string) => void;
  onClose: () => void;
}) {
  const prog = checklistProgress(audit);
  const done = audit.status === 'complete';

  const finish = async () => {
    if (prog.covered < prog.total) {
      const ok = await confirmDialog(
        `${prog.total - prog.covered} checklist item(s) are still unchecked. Complete the audit anyway? Unchecked items won't count toward ISMS coverage.`,
        { title: 'Complete audit', okLabel: 'Complete', kind: 'warning' },
      );
      if (!ok) return;
    }
    onPatch(completeAudit);
    pushToast('success', 'Audit marked complete');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={audit.title}
      subtitle={`${audit.auditor || 'Unassigned auditor'} · planned ${audit.plannedDate} · ${prog.covered}/${prog.total} covered`}
      size={680}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          {!done && (
            <button type="button" className="btn btn-primary" onClick={() => void finish()}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete audit
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {audit.checklist.map(item => (
          <div
            key={item.refId}
            style={{
              display: 'grid',
              gridTemplateColumns: '24px 80px minmax(120px, 1fr) minmax(140px, 1.2fr) 90px',
              gap: 10, alignItems: 'center',
              padding: '7px 0',
              borderBottom: '1px solid var(--line-2)',
            }}
          >
            <input
              type="checkbox"
              checked={item.covered}
              disabled={done}
              aria-label={`Covered ${item.refId}`}
              onChange={e => onPatch(a => updateChecklistItem(a, item.refId, { covered: e.target.checked }))}
            />
            <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 11, color: 'var(--mint)' }}>
              {item.refId}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={titleByRefId.get(item.refId)}>
              {titleByRefId.get(item.refId) ?? '—'}
            </span>
            <input
              type="text"
              value={item.notes}
              disabled={done}
              placeholder="Auditor notes…"
              onChange={e => onPatch(a => updateChecklistItem(a, item.refId, { notes: e.target.value }))}
              style={{ ...inputStyle, padding: '4px 8px', fontSize: 11 }}
            />
            <button
              type="button"
              disabled={done}
              onClick={() => onRaiseFinding(item.refId, item.notes)}
              style={{
                background: 'none', border: '1px solid var(--line-2)', borderRadius: 8,
                padding: '3px 8px', fontSize: 10, cursor: done ? 'not-allowed' : 'pointer',
                color: 'var(--ink-3)', fontFamily: 'inherit',
                opacity: done ? 0.5 : 1,
              }}
            >
              Raise finding
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ─── Create modal ────────────────────────────────────────────────────── */

function NewAuditModal({ clientId, onCreate, onClose }: {
  clientId: string;
  onCreate: (a: InternalAudit) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [auditor, setAuditor] = useState('');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState<ScopePreset>('clauses');
  const [touched, setTouched] = useState(false);

  const submit = () => {
    if (!title.trim()) { setTouched(true); return; }
    onCreate(newInternalAudit({
      clientId,
      title: title.trim(),
      auditor: auditor.trim(),
      plannedDate,
      refIds: refIdsForScope(scope),
    }));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Plan an internal audit"
      subtitle="Pick the scope — the audit's checklist walks every item in it"
      size={520}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Plan audit</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Title" required error={touched && !title.trim() ? 'A title is required' : null}>
          <input
            style={inputStyle}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. H2 2026 — management clauses"
          />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Auditor">
            <input style={inputStyle} value={auditor} onChange={e => setAuditor(e.target.value)} />
          </FormField>
          <FormField label="Planned date">
            <input style={inputStyle} type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Scope" hint={`${refIdsForScope(scope).length} checklist items`}>
          <select style={inputStyle} value={scope} onChange={e => setScope(e.target.value as ScopePreset)}>
            {(Object.keys(SCOPE_LABEL) as ScopePreset[]).map(s => (
              <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
            ))}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}
