export interface ManagementClause {
  id: string;
  title: string;
  category: 'Context' | 'Leadership' | 'Planning' | 'Support' | 'Operation' | 'Performance' | 'Improvement';
  summary: string;
  requirements: string[];
  auditQuestions: string[];
  typicalEvidence: string[];
  commonGaps: string[];
  tips: string[];
  relatedClauses: string[];
  relatedControls: string[];
}

export type ControlCategory = 'Organisational' | 'People' | 'Physical' | 'Technological';
export type ControlType = 'Preventive' | 'Detective' | 'Corrective';
export type SecurityProperty = 'Confidentiality' | 'Integrity' | 'Availability';
export type CybersecurityConcept = 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover';
export type OperationalCapability =
  | 'Governance'
  | 'Asset management'
  | 'Information protection'
  | 'Human resource security'
  | 'Physical security'
  | 'System and network security'
  | 'Application security'
  | 'Secure configuration'
  | 'Identity and access management'
  | 'Threat and vulnerability management'
  | 'Continuity'
  | 'Supplier relationships security'
  | 'Legal and compliance'
  | 'Information security event management'
  | 'Information security assurance';
export type SecurityDomain = 'Governance and Ecosystem' | 'Protection' | 'Defence' | 'Resilience';

export interface AnnexAControl {
  id: string;
  title: string;
  category: ControlCategory;
  summary: string;
  controlType: ControlType[];
  securityProperties: SecurityProperty[];
  cybersecurityConcepts: CybersecurityConcept[];
  operationalCapabilities: OperationalCapability[];
  securityDomains: SecurityDomain[];
  implementationGuidance: string;
  auditQuestions: string[];
  typicalEvidence: string[];
  commonGaps: string[];
  tips: string[];
  relatedControls: string[];
  relatedClauses: string[];
  isNew2022: boolean;
}

export type ComplianceStatus = 'Compliant' | 'Partially Compliant' | 'Non-Compliant' | 'Not Assessed' | 'Not Applicable';
export type Priority = 'High' | 'Medium' | 'Low';
export type ImplementationStatus = 'Not Started' | 'In Progress' | 'Implemented' | 'Verified';

export interface GapAnalysisItem {
  itemId: string;
  itemType: 'clause' | 'control';
  status: ComplianceStatus;
  notes: string;
  priority: Priority;
  responsible: string;
}

export interface GapAnalysisSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: GapAnalysisItem[];
  /** V2.1: owning client. Pre-V2.1 sessions are back-filled to 'unassigned'. */
  clientId?: string;
  /**
   * V2.5: AI-drafted Statement of Applicability section. Persisted on the
   * session so re-opening shows the last generated version. Optional —
   * sessions created before V2.5 stay un-drafted until the user runs the
   * drafter.
   */
  soaDraft?: string;
}

export interface ImplementationItem {
  controlId: string;
  status: ImplementationStatus;
  owner: string;
  targetDate: string;
  notes: string;
}

export interface ImplementationSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ImplementationItem[];
  /** V2.1: owning client. Pre-V2.1 sessions are back-filled to 'unassigned'. */
  clientId?: string;
}

export interface CheatsheetItem {
  itemId: string;
  itemType: 'clause' | 'control';
  focus: 'full' | 'surveillance' | 'specific';
  notes: string;
  checkedEvidence: string[];
}

export interface SavedCheatsheet {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: CheatsheetItem[];
  /** V2.1: owning client. Pre-V2.1 cheatsheets are back-filled to 'unassigned'. */
  clientId?: string;
}

export interface CrossReference {
  controlId: string;
  relatedControlIds: string[];
  relatedClauseIds: string[];
  soc2Criteria: string[];
  cyberEssentials: string[];
  nistCsf: string[];
}

export type AppSection =
  | 'post_status'    // Dashboard
  | 'post_clients'   // Clients hub (V2.1 — central client directory)
  | 'post_audit'     // 27001 helper (clauses + controls + reference + cross-reference)
  | 'post_comply'    // Compliance Hub (gap analysis + implementations + audits + saved)
  | 'post_risk'      // Risk hub
  | 'post_intel'     // Threat Intelligence
  | 'post_scan'      // WordPress Security
  | 'post_alert'     // Alerts
  | 'post_report'    // Reports
  | 'search';        // Global search (overlay)

// ─── Risk Hub (V2.1) ──────────────────────────────────────────────────────────

export type RiskCategory = 'Operational' | 'Technical' | 'Legal' | 'People' | 'Third Party';
export type RiskTreatment = 'Accept' | 'Mitigate' | 'Transfer' | 'Avoid';
export type RiskStatus = 'Open' | 'In Treatment' | 'Closed';
export type CiaProperty = 'C' | 'I' | 'A';

export interface ApplicableControlRef {
  type: 'clause' | 'control' | 'custom';
  /** Clause/control id, or free-text for custom. */
  value: string;
}

export interface RiskItem {
  id: string;
  name: string;
  description: string;
  category: RiskCategory;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  treatment: RiskTreatment;
  owner: string;
  dueDate: string;
  status: RiskStatus;
  /** V2.1: owning client. Pre-V2.1 risks are back-filled to 'unassigned'. */
  clientId?: string;
  /** V2.1: free-text description of how the treatment will be executed. */
  treatmentDescription?: string;
  /** V2.1: applicable ISO 27001 clauses/controls + custom entries. */
  applicableControls?: ApplicableControlRef[];
  /** V2.1: CIA properties affected (any combination). */
  cia?: CiaProperty[];
}

/**
 * Client record — represents a billable engagement. All V2.1 modules attach
 * records (risks, audits, scans) to a clientId so output can be branded and
 * filtered per engagement. Migrations create a default "Unassigned" client
 * for any legacy data.
 */
export interface Client {
  id: string;
  name: string;
  /** Base64 data URL (PNG/JPG, ≤512 KB). Shown on reports and in the clients list. */
  logo?: string;
  industry?: string;
  primaryContact?: string;
  notes?: string;
  createdAt: string;
}

// ─── Portfolio mode (V2.5) ────────────────────────────────────────────────────
//
// Sprint 13 introduces batch scanning, scheduled re-scans, and CSV imports
// (see docs/sprint-13-discovery.md). Three new persisted shapes drive that:
//   - ScanQueueItem  — one row in the foreground scan queue
//   - Schedule       — generalised recurring task; v1 only fires `wp-scan`
//   - SchedulerCadence — when a schedule runs

export type ScanQueueStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ScanQueueItem {
  /** Queue-row id; distinct from the eventual AuditReport id. */
  id: string;
  targetUrl: string;
  /** Optional client tag — applied to the resulting AuditReport on success. */
  clientId?: string;
  status: ScanQueueStatus;
  /** Populated on success. */
  reportId?: string;
  error?: string;
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Recurring cadence for a Schedule. Discriminated union so we can add new
 * cadence kinds (e.g. `cron`) without breaking existing data.
 */
export type SchedulerCadence =
  | { kind: 'weekly';   weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number }
  | { kind: 'monthly';  day: number; hour: number }
  | { kind: 'interval'; days: number };

/**
 * Generalised recurring task. The `kind` discriminator picks what fires:
 * v2.5 ships only `wp-scan` (re-scan a domain). Pack 4's monthly executive
 * PDF will add `report-export` without touching this type's shape.
 */
export type Schedule =
  | {
      id: string;
      kind: 'wp-scan';
      domain: string;
      clientId?: string;
      cadence: SchedulerCadence;
      /** Score-drop threshold (points) that triggers an alert. Optional. */
      alertOnDrop?: number;
      active: boolean;
      lastFiredAt?: string;
      /** Pre-computed for efficient scan-on-launch matching. ISO string, UTC. */
      nextDueAt: string;
      /** Soft-delete marker. Omitted = live. */
      deletedAt?: string;
    };
    // Future: { kind: 'report-export'; ... } in Pack 4.

