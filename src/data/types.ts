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
