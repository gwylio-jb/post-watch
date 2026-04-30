import { Plus, FolderKanban, Trash2, Calendar, FileText, Users } from 'lucide-react';
import type { Project } from '../../data/projects';
import { computeMetrics } from '../../data/projects';

interface ProjectDashboardProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
}

export default function ProjectDashboard({ projects, onOpenProject, onNewProject, onDeleteProject }: ProjectDashboardProps) {
  // Aggregate metrics across all projects
  const aggregate = projects.reduce(
    (acc, p) => {
      const m = computeMetrics(p);
      acc.totalDocs += m.totalDocs;
      acc.totalWorkshops += m.totalWorkshops;
      acc.totalMilestones += m.totalMilestones;
      acc.docsCompleted += m.docsCompleted;
      acc.workshopsCompleted += m.workshopsCompleted;
      acc.milestonesCompleted += m.milestonesCompleted;
      acc.percentSum += m.overallPercent;
      return acc;
    },
    { totalDocs: 0, totalWorkshops: 0, totalMilestones: 0, docsCompleted: 0, workshopsCompleted: 0, milestonesCompleted: 0, percentSum: 0 }
  );
  const avgPercent = projects.length > 0 ? Math.round(aggregate.percentSum / projects.length) : 0;

  return (
    <div className="space-y-8">
      {/* ── Hero header ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-8 text-white shadow-card"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-8 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">
            <FolderKanban className="w-3.5 h-3.5" />
            Project Portfolio
          </div>
          <h2 className="font-display font-bold text-3xl mb-1">
            {projects.length === 0 ? 'Welcome to Post_Watch' : `${projects.length} active project${projects.length === 1 ? '' : 's'}`}
          </h2>
          <p className="text-white/80 text-sm max-w-xl">
            {projects.length === 0
              ? 'Create your first client implementation to start tracking deliverables, milestones and progress.'
              : `Average completion across all engagements: ${avgPercent}%.`}
          </p>
          <button
            onClick={onNewProject}
            className="mt-5 inline-flex items-center gap-2 bg-white text-accent px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg transition-shadow"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* ── Aggregate metric cards ── */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            label="Avg. Completion"
            value={`${avgPercent}%`}
            icon={<FolderKanban className="w-4 h-4" />}
            gradient="var(--gradient-accent)"
          />
          <MetricCard
            label="Documents"
            value={`${aggregate.docsCompleted} / ${aggregate.totalDocs}`}
            icon={<FileText className="w-4 h-4" />}
            gradient="var(--gradient-info)"
          />
          <MetricCard
            label="Workshops"
            value={`${aggregate.workshopsCompleted} / ${aggregate.totalWorkshops}`}
            icon={<Users className="w-4 h-4" />}
            gradient="var(--gradient-warning)"
          />
          <MetricCard
            label="Milestones"
            value={`${aggregate.milestonesCompleted} / ${aggregate.totalMilestones}`}
            icon={<Calendar className="w-4 h-4" />}
            gradient="var(--gradient-success)"
          />
        </div>
      )}

      {/* ── Project grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg text-text-primary">Projects</h3>
        </div>
        {projects.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <FolderKanban className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No projects yet. Create your first to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => onOpenProject(p.id)}
                onDelete={() => onDeleteProject(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, gradient }: { label: string; value: string; icon: React.ReactNode; gradient: string }) {
  return (
    <div className="card-elevated p-5 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-accent flex-shrink-0"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">{label}</div>
        <div className="font-display font-bold text-xl text-text-primary truncate">{value}</div>
      </div>
    </div>
  );
}

// ── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  const m = computeMetrics(project);
  const initials = project.client.name
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="card-elevated p-5 cursor-pointer group relative"
      onClick={onOpen}
    >
      {/* Header: logo + name */}
      <div className="flex items-center gap-3 mb-4">
        {project.client.logo ? (
          <img
            src={project.client.logo}
            alt=""
            className="w-12 h-12 rounded-xl object-cover bg-surface-alt flex-shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-bold flex-shrink-0"
            style={{ background: 'var(--gradient-accent)' }}
          >
            {initials || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-text-primary truncate">{project.client.name}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            {project.templateType === 'standard' ? 'Standard Template' : 'Custom Build'}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete project "${project.client.name}"?`)) onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-status-red transition-all rounded"
          aria-label="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress ring + percent */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted">Overall Progress</div>
          <div className="font-display font-bold text-2xl text-text-primary">{m.overallPercent}%</div>
        </div>
        <ProgressRing percent={m.overallPercent} />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-border">
        <Stat label="Docs"      value={`${m.docsCompleted}/${m.totalDocs}`} />
        <Stat label="Workshops" value={`${m.workshopsCompleted}/${m.totalWorkshops}`} />
        <Stat label="Milest."   value={`${m.milestonesCompleted}/${m.totalMilestones}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-mono font-semibold text-text-primary">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="56" y2="56">
          <stop offset="0%" stopColor="#7367f0" />
          <stop offset="100%" stopColor="#ce9ffc" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-surface-alt)" strokeWidth="5" />
      <circle
        cx="28" cy="28" r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  );
}
