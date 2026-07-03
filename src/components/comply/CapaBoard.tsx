/**
 * Sprint 24 (v3.0 pillar #2): CAPA register — the nonconformity /
 * corrective-action board (clause 10.2).
 *
 * Layout: filter strip → findings list grouped by lifecycle status,
 * overdue rows flagged. Clicking a row opens a detail modal where the
 * user records the root cause, corrective action, effectiveness check
 * and evidence, and advances the status. Transitions run through
 * utils/findings.transition so the UI can't skip lifecycle steps.
 */
import { useState, useMemo } from 'react';
import { Plus, AlertTriangle, Download, Clock } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Finding, FindingSeverity, FindingStatus, Client } from '../../data/types';
import {
  newFinding, transition, isOverdue, sortForBoard, findingsToCsv,
  NEXT_STATUS, STATUS_LABEL,
} from '../../utils/findings';
import { exportAsCsv } from '../../utils/export';
import { exportCapaPdf } from '../../pdf/exportCapa';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { pushUndo } from '../../utils/undoBus';
import Modal from '../shared/Modal';
import EmptyState from '../shared/EmptyState';
import FormField from '../shared/FormField';
import AttachmentList from '../shared/AttachmentList';

const SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];

const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  critical: 'var(--ember)',
  high: '#F59E0B',
  medium: 'var(--violet)',
  low: 'var(--ink-3)',
};

const STATUS_ORDER: FindingStatus[] = ['open', 'action-planned', 'implemented', 'verified', 'closed'];

export default function CapaBoard() {
  const [findings, setFindings] = useLocalStorage<Finding[]>('findings', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);

  const safeFindings = useMemo<Finding[]>(() => Array.isArray(findings) ? findings : [], [findings]);
  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const [clientFilter, setClientFilter] = useState<'all' | string>('all');
  const [showClosed, setShowClosed] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>(safeClients.map(c => [c.id, c.name]));
    if (!m.has(UNASSIGNED_CLIENT_ID)) m.set(UNASSIGNED_CLIENT_ID, 'Unassigned');
    return m;
  }, [safeClients]);

  const visible = useMemo(() => {
    let list = safeFindings;
    if (clientFilter !== 'all') list = list.filter(f => f.clientId === clientFilter);
    if (!showClosed) list = list.filter(f => f.status !== 'closed');
    return sortForBoard(list);
  }, [safeFindings, clientFilter, showClosed]);

  const overdueCount = useMemo(() => visible.filter(f => isOverdue(f)).length, [visible]);
  const detail = detailId ? safeFindings.find(f => f.id === detailId) ?? null : null;

  const updateFinding = (id: string, updater: (f: Finding) => Finding) => {
    setFindings(prev => (Array.isArray(prev) ? prev : []).map(f => f.id === id ? updater(f) : f));
  };

  const deleteFinding = (id: string) => {
    const snapshot = safeFindings.find(f => f.id === id);
    setFindings(prev => (Array.isArray(prev) ? prev : []).filter(f => f.id !== id));
    setDetailId(null);
    if (snapshot) {
      pushUndo({
        label: 'Finding deleted',
        revert: () => setFindings(prev => {
          const cur = Array.isArray(prev) ? prev : [];
          return cur.some(f => f.id === snapshot.id) ? cur : [...cur, snapshot];
        }),
      });
    }
  };

  const handleExportCsv = () => {
    exportAsCsv('capa-register', findingsToCsv(visible, clientNameById));
    pushToast('success', 'CAPA register exported as CSV');
  };

  const handleExportPdf = async () => {
    try {
      const client = clientFilter !== 'all'
        ? safeClients.find(c => c.id === clientFilter) ?? null
        : null;
      await exportCapaPdf({ findings: visible, clientNameById, client });
      pushToast('success', 'CAPA register PDF downloaded');
    } catch (e) {
      pushToast('error', (e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header strip */}
      <div className="bubble" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          aria-label="Filter by client"
          style={{
            padding: '6px 10px', borderRadius: 10,
            border: '1px solid var(--line-2)',
            background: 'var(--bg-2)', color: 'var(--ink-1)',
            fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="all">All clients</option>
          {safeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
          Show closed
        </label>

        {overdueCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--ember)', fontWeight: 600,
          }}>
            <Clock className="w-3.5 h-3.5" />
            {overdueCount} overdue
          </span>
        )}

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="button" className="btn btn-ghost" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleExportPdf()}>
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" />
            Raise finding
          </button>
        </div>
      </div>

      {/* List grouped by status */}
      {visible.length === 0 ? (
        <div className="bubble">
          <EmptyState
            icon={AlertTriangle}
            title="No findings on the register"
            detail="Findings land here from gap analysis, WordPress scans, internal audits and incidents — or raise one manually. Each carries its corrective action through to a verified close."
            cta={{ label: 'Raise the first finding', onClick: () => setShowNew(true) }}
          />
        </div>
      ) : (
        STATUS_ORDER.filter(s => showClosed || s !== 'closed').map(status => {
          const rows = visible.filter(f => f.status === status);
          if (rows.length === 0) return null;
          return (
            <section key={status} className="bubble" style={{ padding: 0, overflow: 'hidden' }}>
              <header style={{ padding: '12px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
                  {STATUS_LABEL[status]}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>{rows.length}</span>
              </header>
              {rows.map(f => {
                const overdue = isOverdue(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDetailId(f.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '10px minmax(160px, 1fr) 110px 130px 110px',
                      gap: 12, alignItems: 'center',
                      width: '100%', textAlign: 'left',
                      padding: '10px 18px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid var(--line-2)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span aria-hidden style={{
                      width: 8, height: 8, borderRadius: 4,
                      background: SEVERITY_COLOR[f.severity],
                    }} />
                    <span style={{ fontSize: 13, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.title}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                      {f.source}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clientNameById.get(f.clientId) ?? '—'}
                    </span>
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--font-redesign-mono)',
                      color: overdue ? 'var(--ember)' : 'var(--ink-3)',
                      fontWeight: overdue ? 700 : 400,
                    }}>
                      {f.action?.dueDate ? `due ${f.action.dueDate}${overdue ? ' ⚠' : ''}` : '—'}
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })
      )}

      {/* Detail modal */}
      {detail && (
        <FindingDetail
          finding={detail}
          clientName={clientNameById.get(detail.clientId) ?? 'Unassigned'}
          onPatch={updater => updateFinding(detail.id, updater)}
          onDelete={() => deleteFinding(detail.id)}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* New finding modal */}
      {showNew && (
        <NewFindingModal
          clients={safeClients}
          onCreate={f => {
            setFindings(prev => [...(Array.isArray(prev) ? prev : []), f]);
            setShowNew(false);
            setDetailId(f.id);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

/* ─── Detail modal ────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)', color: 'var(--ink-1)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%',
};

function FindingDetail({ finding, clientName, onPatch, onDelete, onClose }: {
  finding: Finding;
  clientName: string;
  onPatch: (updater: (f: Finding) => Finding) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const next = NEXT_STATUS[finding.status];
  const [rootCause, setRootCause] = useState(finding.rootCause ?? '');
  const [actionOwner, setActionOwner] = useState(finding.action?.owner ?? '');
  const [actionDue, setActionDue] = useState(finding.action?.dueDate ?? '');
  const [actionDesc, setActionDesc] = useState(finding.action?.description ?? '');
  const [checkPassed, setCheckPassed] = useState(finding.effectivenessCheck?.passed ?? true);
  const [checkNotes, setCheckNotes] = useState(finding.effectivenessCheck?.notes ?? '');

  const saveDetails = () => {
    onPatch(f => ({
      ...f,
      rootCause: rootCause.trim() || undefined,
      action: actionOwner.trim() || actionDue || actionDesc.trim()
        ? { owner: actionOwner.trim(), dueDate: actionDue, description: actionDesc.trim() }
        : f.action,
      effectivenessCheck: (f.status === 'implemented' || f.effectivenessCheck)
        ? { date: f.effectivenessCheck?.date ?? new Date().toISOString().slice(0, 10), passed: checkPassed, notes: checkNotes.trim() }
        : f.effectivenessCheck,
    }));
    pushToast('success', 'Finding saved');
  };

  const advance = () => {
    if (!next) return;
    // Persist any pending edits first so transition sees them.
    let staged: Finding = {
      ...finding,
      rootCause: rootCause.trim() || undefined,
      action: actionOwner.trim() || actionDue
        ? { owner: actionOwner.trim(), dueDate: actionDue, description: actionDesc.trim() }
        : finding.action,
      effectivenessCheck: finding.status === 'implemented'
        ? { date: new Date().toISOString().slice(0, 10), passed: checkPassed, notes: checkNotes.trim() }
        : finding.effectivenessCheck,
    };
    const out = transition(staged, next);
    if (typeof out === 'string') {
      pushToast('error', out);
      return;
    }
    staged = out;
    onPatch(() => staged);
    pushToast('success', `Moved to ${STATUS_LABEL[staged.status]}`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={finding.title}
      subtitle={`${clientName} · ${finding.source} · raised ${finding.raisedAt.slice(0, 10)} · ${STATUS_LABEL[finding.status]}`}
      size={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--ember)' }} onClick={onDelete}>
            Delete
          </button>
          <button type="button" className="btn btn-ghost" onClick={saveDetails}>Save</button>
          {next && (
            <button type="button" className="btn btn-primary" onClick={advance}>
              Move to {STATUS_LABEL[next]}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {finding.description && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{finding.description}</p>
        )}
        {finding.refIds.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {finding.refIds.map(id => (
              <span key={id} style={{
                fontSize: 11, fontFamily: 'var(--font-redesign-mono)',
                padding: '2px 8px', borderRadius: 999,
                background: 'rgba(123,107,237,0.10)',
                border: '1px solid rgba(123,107,237,0.25)',
                color: 'var(--violet)',
              }}>{id}</span>
            ))}
          </div>
        )}

        <FormField label="Root cause" hint="Why did this happen? Auditors expect more than a restatement of the symptom.">
          <textarea
            value={rootCause}
            onChange={e => setRootCause(e.target.value)}
            style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Action owner" required error={finding.status === 'open' && !actionOwner.trim() ? 'Needed before planning' : null}>
            <input style={inputStyle} value={actionOwner} onChange={e => setActionOwner(e.target.value)} />
          </FormField>
          <FormField label="Due date" required>
            <input style={inputStyle} type="date" value={actionDue} onChange={e => setActionDue(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Corrective action">
          <textarea
            value={actionDesc}
            onChange={e => setActionDesc(e.target.value)}
            style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
          />
        </FormField>

        {(finding.status === 'implemented' || finding.effectivenessCheck) && (
          <div style={{
            padding: 12, borderRadius: 12,
            border: '1px solid var(--line-2)', background: 'var(--bg-2)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>
              Effectiveness check
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-1)', cursor: 'pointer' }}>
              <input type="checkbox" checked={checkPassed} onChange={e => setCheckPassed(e.target.checked)} />
              The corrective action worked (re-test passed)
            </label>
            <textarea
              value={checkNotes}
              onChange={e => setCheckNotes(e.target.value)}
              placeholder="How was effectiveness verified?"
              style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }}
            />
          </div>
        )}

        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>
            Evidence
          </span>
          <div style={{ marginTop: 6 }}>
            <AttachmentList ownerKind="finding" ownerId={finding.id} compact />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─── New finding modal ───────────────────────────────────────────────── */

function NewFindingModal({ clients, onCreate, onClose }: {
  clients: Client[];
  onCreate: (f: Finding) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<FindingSeverity>('medium');
  const [clientId, setClientId] = useState(clients[0]?.id ?? UNASSIGNED_CLIENT_ID);
  const [touched, setTouched] = useState(false);

  const submit = () => {
    if (!title.trim()) { setTouched(true); return; }
    onCreate(newFinding({
      clientId, source: 'manual', title: title.trim(),
      description: description.trim(), severity,
    }));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Raise a finding"
      subtitle="A nonconformity or improvement opportunity, tracked through corrective action to verified close"
      size={520}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Raise finding</button>
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
            placeholder="e.g. Access reviews not performed quarterly"
          />
        </FormField>
        <FormField label="Description">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
          />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Severity">
            <select style={inputStyle} value={severity} onChange={e => setSeverity(e.target.value as FindingSeverity)}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Client">
            <select style={inputStyle} value={clientId} onChange={e => setClientId(e.target.value)}>
              {clients.length === 0 && <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>}
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

