import {
  deliverables as standardDeliverables,
  milestones as standardMilestones,
  type DocStatus,
  type WorkshopStatus,
  type MilestoneStatus,
  type Deliverable,
  type Milestone,
} from './implementationData';

export type TemplateType = 'standard' | 'custom';

export interface ProjectClient {
  name: string;
  /** base64 data URL */
  logo?: string;
  /** optional display tint, used as a fallback when no logo is set */
  color?: string;
  /**
   * V2.1: link to the central Clients directory. Optional so legacy projects
   * keep working with just an embedded `name`. New projects created via the
   * NewProjectModal client picker always set this.
   */
  clientId?: string;
}

export interface Project {
  id: string;
  client: ProjectClient;
  templateType: TemplateType;
  /** Only used when templateType === 'custom' */
  customDeliverables?: Deliverable[];
  customMilestones?: Milestone[];
  /** Per-project state */
  docStatuses: Record<string, DocStatus>;
  workshopStatuses: Record<string, WorkshopStatus>;
  milestoneStatuses: Record<string, MilestoneStatus>;
  consultantComments: Record<string, string>;
  clientComments: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getProjectDeliverables(p: Project): Deliverable[] {
  return p.templateType === 'custom' ? p.customDeliverables ?? [] : standardDeliverables;
}

export function getProjectMilestones(p: Project): Milestone[] {
  return p.templateType === 'custom' ? p.customMilestones ?? [] : standardMilestones;
}

export function getProjectSections(p: Project): string[] {
  const items = getProjectDeliverables(p);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of items) {
    if (!seen.has(d.section)) {
      seen.add(d.section);
      out.push(d.section);
    }
  }
  return out;
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface ProjectMetrics {
  totalDocs: number;
  totalWorkshops: number;
  totalMilestones: number;

  docsCompleted: number;     // Published/Finalised + Not Required
  docsInProgress: number;    // In Progress + Under Review + Awaiting Publication
  docsNotStarted: number;

  workshopsCompleted: number;
  workshopsScheduled: number;
  workshopsNotScheduled: number;

  milestonesCompleted: number;
  milestonesInProgress: number;

  /** Composite percentage 0-100 representing overall project progress */
  overallPercent: number;
}

export function computeMetrics(p: Project): ProjectMetrics {
  const items = getProjectDeliverables(p);
  const milestones = getProjectMilestones(p);
  const docs = items.filter(d => d.type === 'document');
  const workshops = items.filter(d => d.type === 'workshop');

  let docsCompleted = 0, docsInProgress = 0, docsNotStarted = 0;
  for (const d of docs) {
    const s = p.docStatuses[d.id] ?? 'Not Started';
    if (s === 'Published/Finalised' || s === 'Not Required') docsCompleted++;
    else if (s === 'Not Started') docsNotStarted++;
    else docsInProgress++;
  }

  let workshopsCompleted = 0, workshopsScheduled = 0, workshopsNotScheduled = 0;
  for (const w of workshops) {
    const s = p.workshopStatuses[w.id] ?? 'Not Scheduled';
    if (s === 'Completed') workshopsCompleted++;
    else if (s === 'Scheduled') workshopsScheduled++;
    else workshopsNotScheduled++;
  }

  let milestonesCompleted = 0, milestonesInProgress = 0;
  for (const m of milestones) {
    const s = p.milestoneStatuses[m.id] ?? 'Not Started';
    if (s === 'Completed') milestonesCompleted++;
    else if (s === 'In Progress') milestonesInProgress++;
  }

  const total = docs.length + workshops.length + milestones.length;
  const completed = docsCompleted + workshopsCompleted + milestonesCompleted;
  const partial = (docsInProgress + workshopsScheduled + milestonesInProgress) * 0.5;
  const overallPercent = total > 0 ? Math.round(((completed + partial) / total) * 100) : 0;

  return {
    totalDocs: docs.length,
    totalWorkshops: workshops.length,
    totalMilestones: milestones.length,
    docsCompleted, docsInProgress, docsNotStarted,
    workshopsCompleted, workshopsScheduled, workshopsNotScheduled,
    milestonesCompleted, milestonesInProgress,
    overallPercent,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createProject(input: {
  clientName: string;
  clientLogo?: string;
  /** V2.1: link to the central Clients directory if the user picked an existing client. */
  clientId?: string;
  templateType: TemplateType;
}): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    client: { name: input.clientName, logo: input.clientLogo, clientId: input.clientId },
    templateType: input.templateType,
    customDeliverables: input.templateType === 'custom' ? [] : undefined,
    customMilestones: input.templateType === 'custom' ? [] : undefined,
    docStatuses: {},
    workshopStatuses: {},
    milestoneStatuses: {},
    consultantComments: {},
    clientComments: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Migrates the old single-tracker localStorage keys (impl-doc-statuses etc.)
 * into a "Default Project" if any data exists. Returns the new project, or null.
 */
export function migrateLegacyTracker(): Project | null {
  const PREFIX = 'clause-control:';
  const keys = ['impl-doc-statuses', 'impl-workshop-statuses', 'impl-milestone-statuses', 'impl-consultant-comments', 'impl-client-comments'];
  const read = (k: string): Record<string, string> => {
    try {
      const raw = localStorage.getItem(PREFIX + k);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const docStatuses = read('impl-doc-statuses') as Record<string, DocStatus>;
  const workshopStatuses = read('impl-workshop-statuses') as Record<string, WorkshopStatus>;
  const milestoneStatuses = read('impl-milestone-statuses') as Record<string, MilestoneStatus>;
  const consultantComments = read('impl-consultant-comments');
  const clientComments = read('impl-client-comments');

  const hasData =
    Object.keys(docStatuses).length > 0 ||
    Object.keys(workshopStatuses).length > 0 ||
    Object.keys(milestoneStatuses).length > 0 ||
    Object.keys(consultantComments).length > 0 ||
    Object.keys(clientComments).length > 0;

  if (!hasData) return null;

  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    client: { name: 'Default Project' },
    templateType: 'standard',
    docStatuses,
    workshopStatuses,
    milestoneStatuses,
    consultantComments,
    clientComments,
    createdAt: now,
    updatedAt: now,
  };

  // Clear legacy keys
  for (const k of keys) {
    try { localStorage.removeItem(PREFIX + k); } catch { /* ignore */ }
  }

  return project;
}
