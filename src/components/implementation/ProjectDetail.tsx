import { useState, useMemo } from 'react';
import { ArrowLeft, Pencil } from 'lucide-react';
import {
  docStatusStyles, workshopStatusStyles, milestoneStatusStyles,
  type DocStatus, type WorkshopStatus, type MilestoneStatus,
} from '../../data/implementationData';
import {
  type Project,
  getProjectDeliverables,
  getProjectMilestones,
  getProjectSections,
  computeMetrics,
} from '../../data/projects';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'deliverables';

const docStatuses: DocStatus[] = ['Not Started', 'Not Required', 'In Progress', 'Under Review', 'Awaiting Publication', 'Published/Finalised'];
const workshopStatuses: WorkshopStatus[] = ['Not Scheduled', 'Scheduled', 'Completed'];
const milestoneStatusOptions: MilestoneStatus[] = ['Not Started', 'In Progress', 'Completed'];

// ── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutSegment { label: string; value: number; color: string }

function DonutChart({ segments, total, title }: { segments: DonutSegment[]; total: number; title: string }) {
  const r = 52;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;

  let offset = -circumference / 4;
  const paths = segments
    .filter(s => s.value > 0)
    .map(s => {
      const pct = s.value / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const el = (
        <circle
          key={s.label}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={18}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      );
      offset += dash;
      return el;
    });

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{title}</h3>
      <div className="relative">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-surface-alt)" strokeWidth={18} />
          {total > 0 ? paths : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-2xl text-text-primary">{total}</span>
          <span className="text-[10px] text-text-muted">items</span>
        </div>
      </div>
      <div className="space-y-1 w-full">
        {segments.map(s => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-text-secondary truncate">{s.label}</span>
            </div>
            <span className="font-mono text-text-muted ml-2">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status Selects ───────────────────────────────────────────────────────────

function DocStatusSelect({ value, onChange }: { value: DocStatus; onChange: (v: DocStatus) => void }) {
  const style = docStatusStyles[value];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as DocStatus)}
      className="text-[10px] rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer font-semibold w-full"
      style={{ background: style.bg, color: style.text }}
    >
      {docStatuses.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function WorkshopStatusSelect({ value, onChange }: { value: WorkshopStatus; onChange: (v: WorkshopStatus) => void }) {
  const style = workshopStatusStyles[value];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as WorkshopStatus)}
      className="text-[10px] rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer font-semibold w-full"
      style={{ background: style.bg, color: style.text }}
    >
      {workshopStatuses.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface ProjectDetailProps {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
  onBack: () => void;
  onEditCustom: () => void;
}

export default function ProjectDetail({ project, onUpdate, onBack, onEditCustom }: ProjectDetailProps) {
  const [tab, setTab] = useState<Tab>('dashboard');

  const deliverables = useMemo(() => getProjectDeliverables(project), [project]);
  const milestones = useMemo(() => getProjectMilestones(project), [project]);
  const sections = useMemo(() => getProjectSections(project), [project]);
  const metrics = useMemo(() => computeMetrics(project), [project]);

  // Helpers
  const getDocStatus = (id: string): DocStatus => project.docStatuses[id] ?? 'Not Started';
  const getWorkshopStatus = (id: string): WorkshopStatus => project.workshopStatuses[id] ?? 'Not Scheduled';
  const getMilestoneStatus = (id: string): MilestoneStatus => project.milestoneStatuses[id] ?? 'Not Started';

  const setDocStatus = (id: string, s: DocStatus) =>
    onUpdate(p => ({ ...p, docStatuses: { ...p.docStatuses, [id]: s }, updatedAt: new Date().toISOString() }));
  const setWorkshopStatus = (id: string, s: WorkshopStatus) =>
    onUpdate(p => ({ ...p, workshopStatuses: { ...p.workshopStatuses, [id]: s }, updatedAt: new Date().toISOString() }));
  const setMilestoneStatus = (id: string, s: MilestoneStatus) =>
    onUpdate(p => ({ ...p, milestoneStatuses: { ...p.milestoneStatuses, [id]: s }, updatedAt: new Date().toISOString() }));
  const setConsultantComment = (id: string, v: string) =>
    onUpdate(p => ({ ...p, consultantComments: { ...p.consultantComments, [id]: v }, updatedAt: new Date().toISOString() }));
  const setClientComment = (id: string, v: string) =>
    onUpdate(p => ({ ...p, clientComments: { ...p.clientComments, [id]: v }, updatedAt: new Date().toISOString() }));

  // Counts for charts
  const docItems = deliverables.filter(d => d.type === 'document');
  const workshopItems = deliverables.filter(d => d.type === 'workshop');

  const docCounts: Record<DocStatus, number> = { 'Not Started': 0, 'Not Required': 0, 'In Progress': 0, 'Under Review': 0, 'Awaiting Publication': 0, 'Published/Finalised': 0 };
  docItems.forEach(d => { docCounts[getDocStatus(d.id)]++; });
  const workshopCounts: Record<WorkshopStatus, number> = { 'Not Scheduled': 0, 'Scheduled': 0, 'Completed': 0 };
  workshopItems.forEach(d => { workshopCounts[getWorkshopStatus(d.id)]++; });

  const docSegments: DonutSegment[] = docStatuses.map(s => ({
    label: s, value: docCounts[s], color: docStatusStyles[s].text
  }));
  const workshopSegments: DonutSegment[] = workshopStatuses.map(s => ({
    label: s, value: workshopCounts[s], color: workshopStatusStyles[s].text
  }));

  const initials = project.client.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6">
      {/* ── Project header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-surface-alt text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Back to projects"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {project.client.logo ? (
          <img src={project.client.logo} alt="" className="w-14 h-14 rounded-2xl object-cover" />
        ) : (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-display font-bold text-lg"
            style={{ background: 'var(--gradient-accent)' }}
          >
            {initials || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-2xl text-text-primary truncate">{project.client.name}</h2>
          <div className="text-xs text-text-muted">
            {project.templateType === 'standard' ? 'Standard Template' : 'Custom Build'} ·
            {' '}
            Updated {new Date(project.updatedAt).toLocaleDateString('en-GB')} ·
            {' '}
            <span className="font-semibold text-accent">{metrics.overallPercent}% complete</span>
          </div>
        </div>
        {project.templateType === 'custom' && (
          <button
            onClick={onEditCustom}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-accent hover:opacity-90 transition-opacity"
            style={{ background: 'var(--gradient-accent)' }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Deliverables
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['dashboard', 'deliverables'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Dashboard tab ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {deliverables.length === 0 ? (
            <div className="card-elevated p-10 text-center">
              <p className="text-sm text-text-secondary mb-3">This custom project has no deliverables yet.</p>
              <button
                onClick={onEditCustom}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-accent"
                style={{ background: 'var(--gradient-accent)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Add Deliverables
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workshopItems.length > 0 && (
                  <div className="card-elevated p-6">
                    <DonutChart title="Workshops" segments={workshopSegments} total={workshopItems.length} />
                  </div>
                )}
                {docItems.length > 0 && (
                  <div className="card-elevated p-6">
                    <DonutChart title="Documentation" segments={docSegments} total={docItems.length} />
                  </div>
                )}
              </div>

              {milestones.length > 0 && (
                <div className="card-elevated p-5">
                  <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">Project Milestones</h3>
                  <div className="space-y-2">
                    {milestones.map((m, i) => {
                      const status = getMilestoneStatus(m.id);
                      const style = milestoneStatusStyles[status];
                      return (
                        <div key={m.id} className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-text-muted w-4">{i + 1}</span>
                          <span className="text-sm text-text-primary flex-1">{m.name}</span>
                          <select
                            value={status}
                            onChange={e => setMilestoneStatus(m.id, e.target.value as MilestoneStatus)}
                            className="text-[10px] rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer font-semibold"
                            style={{ background: style.bg, color: style.text }}
                          >
                            {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Deliverables tab ── */}
      {tab === 'deliverables' && (
        <div className="space-y-5">
          {sections.length === 0 ? (
            <div className="card-elevated p-10 text-center text-sm text-text-secondary">
              No deliverables to show.
            </div>
          ) : (
            sections.map(section => {
              const sectionItems = deliverables.filter(d => d.section === section);
              const isWorkshopSection = sectionItems.every(d => d.type === 'workshop');
              return (
                <div key={section} className="card-elevated overflow-hidden">
                  <div
                    className="px-5 py-3 border-b border-border"
                    style={{ background: 'var(--gradient-accent-soft)' }}
                  >
                    <h3 className="text-xs font-display font-bold uppercase tracking-wider text-accent">{section}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider w-32">Ref</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Deliverable</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider w-44">Status</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider w-44">Consultant Comments</th>
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider w-44">Client Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionItems.map(d => (
                          <tr key={d.id} className="border-b border-border/30 last:border-b-0 hover:bg-surface-alt/40 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-text-muted text-[10px] align-top">{d.ref}</td>
                            <td className={`px-4 py-2.5 text-text-primary align-top ${d.bold ? 'font-semibold' : ''} ${d.indent ? 'pl-8' : ''}`}>
                              {d.name}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {isWorkshopSection || d.type === 'workshop' ? (
                                <WorkshopStatusSelect value={getWorkshopStatus(d.id)} onChange={v => setWorkshopStatus(d.id, v)} />
                              ) : (
                                <DocStatusSelect value={getDocStatus(d.id)} onChange={v => setDocStatus(d.id, v)} />
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={project.consultantComments[d.id] ?? ''}
                                onChange={e => setConsultantComment(d.id, e.target.value)}
                                placeholder="Add comment..."
                                className="w-full bg-transparent border-b border-border/50 focus:border-accent outline-none text-[10px] text-text-secondary placeholder-text-muted py-0.5 transition-colors"
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="text"
                                value={project.clientComments[d.id] ?? ''}
                                onChange={e => setClientComment(d.id, e.target.value)}
                                placeholder="Add comment..."
                                className="w-full bg-transparent border-b border-border/50 focus:border-accent outline-none text-[10px] text-text-secondary placeholder-text-muted py-0.5 transition-colors"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
