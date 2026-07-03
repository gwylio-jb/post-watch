/**
 * Sprint 25 (v3.0 pillar #3): management review records (clause 9.3).
 *
 * Auditors ask for two-plus years of MR minutes covering the standard's
 * required inputs. Each record freezes a snapshot of the live numbers
 * (open/overdue CAPAs, compliance %, WP score, SoA completeness) at
 * creation, carries minutes per fixed agenda topic, and lists decisions.
 * PDF export produces the minutes document.
 */
import { useState, useMemo } from 'react';
import { Plus, Users2, Download, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type {
  ManagementReview, Client, Finding, GapAnalysisSession, SoaStore,
} from '../../data/types';
import type { AuditReport } from '../../data/auditTypes';
import {
  MR_AGENDA_TOPICS, buildMrSnapshot, newManagementReview, mrCompleteness,
} from '../../utils/isms';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { pushUndo } from '../../utils/undoBus';
import { confirmDialog } from '../../utils/dialog';
import { exportMrPdf } from '../../pdf/exportMr';
import Modal from '../shared/Modal';
import EmptyState from '../shared/EmptyState';
import FormField from '../shared/FormField';

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)', color: 'var(--ink-1)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%',
};

export default function ManagementReviews() {
  const [reviews, setReviews] = useLocalStorage<ManagementReview[]>('management-reviews', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [findings] = useLocalStorage<Finding[]>('findings', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [reports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [soaStore] = useLocalStorage<SoaStore>('soa', {});

  const safeReviews = useMemo<ManagementReview[]>(() => Array.isArray(reviews) ? reviews : [], [reviews]);
  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const [clientId, setClientId] = useState<string>(
    () => safeClients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const clientReviews = useMemo(
    () => safeReviews.filter(r => r.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date)),
    [safeReviews, clientId],
  );
  const detail = detailId ? safeReviews.find(r => r.id === detailId) ?? null : null;
  const client = safeClients.find(c => c.id === clientId) ?? null;

  const createReview = () => {
    const snapshot = buildMrSnapshot({
      clientId,
      findings: Array.isArray(findings) ? findings : [],
      gapSessions: Array.isArray(gapSessions) ? gapSessions : [],
      reports: Array.isArray(reports) ? reports : [],
      soaStore: (soaStore && typeof soaStore === 'object' && !Array.isArray(soaStore)) ? soaStore : {},
    });
    const mr = newManagementReview({
      clientId,
      date: new Date().toISOString().slice(0, 10),
      attendees: [],
      snapshot,
    });
    setReviews(prev => [...(Array.isArray(prev) ? prev : []), mr]);
    setDetailId(mr.id);
  };

  const patchReview = (id: string, updater: (r: ManagementReview) => ManagementReview) => {
    setReviews(prev => (Array.isArray(prev) ? prev : []).map(r => r.id === id ? updater(r) : r));
  };

  const deleteReview = async (id: string) => {
    const snapshot = safeReviews.find(r => r.id === id);
    if (!snapshot) return;
    const ok = await confirmDialog(
      `Delete the management review dated ${snapshot.date}? Auditors expect a multi-year MR history — only delete records created in error.`,
      { title: 'Delete review', okLabel: 'Delete', kind: 'warning' },
    );
    if (!ok) return;
    setReviews(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== id));
    setDetailId(null);
    pushUndo({
      label: 'Management review deleted',
      revert: () => setReviews(prev => {
        const cur = Array.isArray(prev) ? prev : [];
        return cur.some(r => r.id === snapshot.id) ? cur : [...cur, snapshot];
      }),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bubble" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          aria-label="Client"
          style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
        >
          {safeClients.length === 0 && <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>}
          {safeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
          {clientReviews.length} review{clientReviews.length === 1 ? '' : 's'} on record
        </span>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={createReview}>
          <Plus className="w-3.5 h-3.5" />
          New review
        </button>
      </div>

      {clientReviews.length === 0 ? (
        <div className="bubble">
          <EmptyState
            icon={Users2}
            title="No management reviews recorded"
            detail="Clause 9.3 requires periodic top-management reviews with documented minutes. Creating one snapshots today's compliance numbers automatically — you fill in the discussion."
            cta={{ label: 'Record the first review', onClick: createReview }}
          />
        </div>
      ) : (
        <section className="bubble" style={{ padding: 0, overflow: 'hidden' }}>
          {clientReviews.map(r => {
            const c = mrCompleteness(r);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setDetailId(r.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px minmax(140px, 1fr) 150px 130px',
                  gap: 12, alignItems: 'center',
                  width: '100%', textAlign: 'left',
                  padding: '12px 18px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--line-2)',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {r.date}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.attendees.length > 0 ? r.attendees.join(', ') : 'No attendees recorded'}
                </span>
                <span style={{ fontSize: 11, color: c.done === c.total ? 'var(--mint)' : 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {c.done}/{c.total} topics minuted
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                  {r.decisions.length} decision{r.decisions.length === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {detail && (
        <ReviewDetail
          review={detail}
          clientName={client?.name ?? 'Unassigned'}
          onPatch={updater => patchReview(detail.id, updater)}
          onDelete={() => void deleteReview(detail.id)}
          onExport={async () => {
            try {
              await exportMrPdf(client, detail);
              pushToast('success', 'Minutes PDF downloaded');
            } catch (e) {
              pushToast('error', (e as Error).message);
            }
          }}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ─── Detail: agenda minutes ──────────────────────────────────────────── */

function ReviewDetail({ review, clientName, onPatch, onDelete, onExport, onClose }: {
  review: ManagementReview;
  clientName: string;
  onPatch: (updater: (r: ManagementReview) => ManagementReview) => void;
  onDelete: () => void;
  onExport: () => Promise<void>;
  onClose: () => void;
}) {
  const [attendeesDraft, setAttendeesDraft] = useState(review.attendees.join(', '));
  const [decisionDraft, setDecisionDraft] = useState('');
  const snap = review.snapshot;

  const commitAttendees = () => {
    const list = attendeesDraft.split(',').map(s => s.trim()).filter(Boolean);
    onPatch(r => ({ ...r, attendees: list }));
  };

  const addDecision = () => {
    const d = decisionDraft.trim();
    if (!d) return;
    onPatch(r => ({ ...r, decisions: [...r.decisions, d] }));
    setDecisionDraft('');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Management review — ${review.date}`}
      subtitle={clientName}
      size={680}
      footer={
        <>
          <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--ember)' }} onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void onExport()}>
            <Download className="w-3.5 h-3.5" />
            Minutes PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Frozen snapshot */}
        <div style={{
          display: 'flex', gap: 18, flexWrap: 'wrap',
          padding: 12, borderRadius: 12,
          border: '1px solid var(--line-2)', background: 'var(--bg-2)',
        }}>
          {[
            { l: 'Open findings', v: String(snap.openFindings) },
            { l: 'Overdue actions', v: String(snap.overdueFindings) },
            { l: 'Compliance', v: snap.compliancePct !== null ? `${snap.compliancePct}%` : '—' },
            { l: 'WP score', v: snap.latestWpScore !== null ? `${snap.latestWpScore}/100` : '—' },
            { l: 'SoA coverage', v: snap.soaCompleteness !== null ? `${snap.soaCompleteness}%` : '—' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>{s.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>{s.v}</div>
            </div>
          ))}
          <span style={{ alignSelf: 'flex-end', marginLeft: 'auto', fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            snapshot at creation
          </span>
        </div>

        <FormField label="Attendees" hint="Comma-separated; top management must be represented.">
          <input
            style={inputStyle}
            value={attendeesDraft}
            onChange={e => setAttendeesDraft(e.target.value)}
            onBlur={commitAttendees}
            placeholder="e.g. J. Bedford (CEO), A. N. Other (CISO)"
          />
        </FormField>

        {/* Agenda minutes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MR_AGENDA_TOPICS.map(topic => (
            <MinutesField
              key={topic}
              topic={topic}
              value={review.minutes[topic] ?? ''}
              onCommit={v => onPatch(r => ({ ...r, minutes: { ...r.minutes, [topic]: v } }))}
            />
          ))}
        </div>

        {/* Decisions */}
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>
            Decisions & actions
          </span>
          <ul style={{ margin: '8px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {review.decisions.map((d, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--ink-1)' }}>
                {d}
                <button
                  type="button"
                  aria-label={`Remove decision ${i + 1}`}
                  onClick={() => onPatch(r => ({ ...r, decisions: r.decisions.filter((_, j) => j !== i) }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 11, marginLeft: 8 }}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              value={decisionDraft}
              onChange={e => setDecisionDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDecision(); } }}
              placeholder="Record a decision or agreed action…"
            />
            <button type="button" className="btn btn-ghost" onClick={addDecision}>Add</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Minutes textarea with blur-commit (same rationale as the SoA input). */
function MinutesField({ topic, value, onCommit }: {
  topic: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <FormField label={topic}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onCommit(draft); }}
        placeholder="Minutes…"
        style={{ ...inputStyle, minHeight: 48, resize: 'vertical', fontSize: 12 }}
      />
    </FormField>
  );
}
