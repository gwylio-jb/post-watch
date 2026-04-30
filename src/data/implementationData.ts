export type DocStatus = 'Not Started' | 'Not Required' | 'In Progress' | 'Under Review' | 'Awaiting Publication' | 'Published/Finalised';
export type WorkshopStatus = 'Not Scheduled' | 'Scheduled' | 'Completed';
export type MilestoneStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface Deliverable {
  id: string;
  ref: string;
  name: string;
  section: string;
  type: 'document' | 'workshop';
  bold?: boolean;   // section parent rows like "ISMS Handbook"
  indent?: boolean; // child rows indented under a parent
}

export interface Milestone {
  id: string;
  name: string;
}

// ── Status colour map ────────────────────────────────────────────────────────

export const docStatusStyles: Record<DocStatus, { bg: string; text: string }> = {
  'Not Started':          { bg: 'rgba(220,38,38,0.15)',  text: '#dc2626' },
  'Not Required':         { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
  'In Progress':          { bg: 'rgba(37,99,235,0.15)',  text: '#2563eb' },
  'Under Review':         { bg: 'rgba(217,119,6,0.15)',  text: '#d97706' },
  'Awaiting Publication': { bg: 'rgba(124,58,237,0.15)', text: '#7c3aed' },
  'Published/Finalised':  { bg: 'rgba(5,150,105,0.15)',  text: '#059669' },
};

export const workshopStatusStyles: Record<WorkshopStatus, { bg: string; text: string }> = {
  'Not Scheduled': { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
  'Scheduled':     { bg: 'rgba(217,119,6,0.15)',   text: '#d97706' },
  'Completed':     { bg: 'rgba(5,150,105,0.15)',   text: '#059669' },
};

export const milestoneStatusStyles: Record<MilestoneStatus, { bg: string; text: string }> = {
  'Not Started': { bg: 'rgba(220,38,38,0.15)', text: '#dc2626' },
  'In Progress': { bg: 'rgba(37,99,235,0.15)', text: '#2563eb' },
  'Completed':   { bg: 'rgba(5,150,105,0.15)', text: '#059669' },
};

// ── Milestones ────────────────────────────────────────────────────────────────

export const milestones: Milestone[] = [
  { id: 'm1', name: 'Project Kick Off Call' },
  { id: 'm2', name: 'Confirm Document Repository' },
  { id: 'm3', name: 'Discovery Calls Scheduled' },
  { id: 'm4', name: 'Discovery Completed' },
  { id: 'm5', name: 'Gap Report Published' },
  { id: 'm6', name: 'Schedule Weekly Meeting' },
  { id: 'm7', name: 'CB Quotes Obtained' },
  { id: 'm8', name: 'Stage 1 & 2 Booked' },
];

// ── Deliverables ──────────────────────────────────────────────────────────────

export const deliverables: Deliverable[] = [
  // Project Startup
  { id: 'd1',  ref: '',                          name: 'Benchmark Assessment Report',               section: 'Project Startup',          type: 'document' },
  { id: 'd2',  ref: '',                          name: 'Continual Improvement Plan (CIP)',           section: 'Project Startup',          type: 'document' },

  // ISMS Core Documentation
  { id: 'd3',  ref: 'Clause 4',                  name: 'ISMS Handbook',                             section: 'ISMS Core Documentation',  type: 'document', bold: true },
  { id: 'd4',  ref: 'Clause 4',                  name: 'Scope',                                     section: 'ISMS Core Documentation',  type: 'document', indent: true },
  { id: 'd5',  ref: 'Clause 4',                  name: 'Context of the Organisation',               section: 'ISMS Core Documentation',  type: 'document', indent: true },
  { id: 'd6',  ref: 'Clause 4',                  name: 'Define the needs and expectations of interested parties', section: 'ISMS Core Documentation', type: 'document', indent: true },
  { id: 'd7',  ref: 'Clause 4',                  name: 'Authorities and Specialist Groups',         section: 'ISMS Core Documentation',  type: 'document', indent: true },
  { id: 'd8',  ref: 'A.5.1',                     name: 'Information Security Policy',               section: 'ISMS Core Documentation',  type: 'document' },
  { id: 'd9',  ref: 'Clause 6.1.3',              name: 'Statement of Applicability',                section: 'ISMS Core Documentation',  type: 'document' },
  { id: 'd10', ref: 'Clause 6.2',                name: 'ISMS Objectives Tracker',                   section: 'ISMS Core Documentation',  type: 'document' },

  // Asset Management
  { id: 'd11', ref: 'A.5.9, A.5.10, A.5.11',    name: 'Asset Management Policy',                   section: 'Asset Management',         type: 'document' },
  { id: 'd12', ref: 'A.5.9, A.5.10, A.5.11',    name: 'Asset Register',                            section: 'Asset Management',         type: 'document' },

  // Business Continuity
  { id: 'd13', ref: 'A.5.29',                    name: 'Business Continuity Policy',                section: 'Business Continuity',      type: 'document' },
  { id: 'd14', ref: 'A.5.29',                    name: 'Business Continuity Plan Template',         section: 'Business Continuity',      type: 'document' },
  { id: 'd15', ref: 'A.5.29',                    name: 'Business Continuity Plan',                  section: 'Business Continuity',      type: 'document' },
  { id: 'd16', ref: 'A.5.29',                    name: 'Business Continuity Test Schedule',         section: 'Business Continuity',      type: 'document' },
  { id: 'd17', ref: 'A.5.29',                    name: 'Business Continuity Test Procedure',        section: 'Business Continuity',      type: 'document' },
  { id: 'd18', ref: 'A.5.29',                    name: 'Business Continuity Test Report Template',  section: 'Business Continuity',      type: 'document' },
  { id: 'd19', ref: 'A.5.29',                    name: 'Business Continuity Test Report',           section: 'Business Continuity',      type: 'document' },
  { id: 'd20', ref: 'A.5.27',                    name: 'Business Continuity Incident Response Plan',section: 'Business Continuity',      type: 'document' },
  { id: 'd21', ref: 'A.8.14, A.5.30',            name: 'Business Impact Analyses',                  section: 'Business Continuity',      type: 'document' },

  // Data Protection
  { id: 'd22', ref: 'A.5.34',                    name: 'Data Protection Guidelines',                section: 'Data Protection',          type: 'document' },
  { id: 'd23', ref: 'A.5.34',                    name: 'Data Protection Policy',                    section: 'Data Protection',          type: 'document' },
  { id: 'd24', ref: 'A.5.34',                    name: 'Data Subject Rights Procedure',             section: 'Data Protection',          type: 'document' },
  { id: 'd25', ref: 'A.5.34',                    name: 'Personal Data Breach Procedure',            section: 'Data Protection',          type: 'document' },

  // Human Resources
  { id: 'd26', ref: 'A.6.3',                     name: 'HR Security Policy',                        section: 'Human Resources',          type: 'document' },
  { id: 'd27', ref: 'A.6.3',                     name: 'ISO 27001 Training Slides',                 section: 'Human Resources',          type: 'document' },
  { id: 'd28', ref: 'A.5.16',                    name: 'Joiner, Mover, Leaver Policy',              section: 'Human Resources',          type: 'document' },
  { id: 'd29', ref: 'A.6.3',                     name: 'Competency/Skills Matrices [Review Existing]',         section: 'Human Resources', type: 'document' },
  { id: 'd30', ref: 'A.6.2',                     name: 'Contract/Terms of Employment [Review Existing]',       section: 'Human Resources', type: 'document' },
  { id: 'd31', ref: 'A.6.2',                     name: 'Contractor Agreements [Review Existing]',              section: 'Human Resources', type: 'document' },
  { id: 'd32', ref: 'A.6.4',                     name: 'Disciplinary Procedure [Review Existing]',             section: 'Human Resources', type: 'document' },
  { id: 'd33', ref: 'A.6.3',                     name: 'Employee Induction Process and/or Checklist [Review Existing]', section: 'Human Resources', type: 'document' },
  { id: 'd34', ref: 'A.6.1, A.6.2',              name: 'Job Descriptions [Review Existing]',                   section: 'Human Resources', type: 'document' },
  { id: 'd35', ref: 'A.6.6',                     name: 'Non-disclosure Agreements [Review Existing]',          section: 'Human Resources', type: 'document' },
  { id: 'd36', ref: 'A.6.5',                     name: 'Termination Letter Template [Review Existing]',        section: 'Human Resources', type: 'document' },

  // Incident Management
  { id: 'd37', ref: 'A.6.8',                     name: 'Security Incident Management Policy',       section: 'Incident Management',      type: 'document' },
  { id: 'd38', ref: 'A.6.8',                     name: 'Security Incident Response Plan',           section: 'Incident Management',      type: 'document' },

  // Internal Audit
  { id: 'd39', ref: 'Clause 9.2',                name: 'Internal Audit Plan Template',              section: 'Internal Audit',           type: 'document' },
  { id: 'd40', ref: 'Clause 9.2',                name: 'Internal Audit Procedure',                  section: 'Internal Audit',           type: 'document' },
  { id: 'd41', ref: 'Clause 9.2',                name: 'Internal Audit Schedule',                   section: 'Internal Audit',           type: 'document' },
  { id: 'd42', ref: 'Clause 9.2',                name: 'Internal Audit Report Template',            section: 'Internal Audit',           type: 'document' },
  { id: 'd43', ref: 'Clause 9.2',                name: 'Internal Audit Reports',                    section: 'Internal Audit',           type: 'document' },

  // Management Review
  { id: 'd44', ref: 'A.5.1 / Clause 9.3',        name: 'Management Review Agenda Template',         section: 'Management Review',        type: 'document' },
  { id: 'd45', ref: 'A.5.1 / Clause 9.3',        name: 'Management Review Minutes',                 section: 'Management Review',        type: 'document' },

  // Risk Management
  { id: 'd46', ref: 'Clause 8.2',                name: 'IS Risk Assessment Procedure',              section: 'Risk Management',          type: 'document' },
  { id: 'd47', ref: 'Clause 8.2',                name: 'Risk Management Guide to Asset Identification', section: 'Risk Management',      type: 'document' },
  { id: 'd48', ref: 'Clause 8.2',                name: 'Risk Management Guide to Risk Assessment',  section: 'Risk Management',          type: 'document' },
  { id: 'd49', ref: 'Clause 8.2',                name: 'Risk Management Tool Register',             section: 'Risk Management',          type: 'document' },

  // Supplier Management
  { id: 'd50', ref: 'A.5.19',                    name: 'Supplier Management & Security Policy',     section: 'Supplier Management',      type: 'document' },
  { id: 'd51', ref: 'A.5.20',                    name: 'Supplier Assurance Questionnaire',          section: 'Supplier Management',      type: 'document' },
  { id: 'd52', ref: 'A.5.20',                    name: 'Supplier Assurance Questionnaire Benchmark',section: 'Supplier Management',      type: 'document' },
  { id: 'd53', ref: 'A.5.23',                    name: 'Cloud Security Policy',                     section: 'Supplier Management',      type: 'document' },
  { id: 'd54', ref: 'A.5.23',                    name: 'CSP Supplier Assurance Assessment Template',section: 'Supplier Management',      type: 'document' },

  // Policies and Procedures
  { id: 'd55', ref: 'A.5.10',                    name: 'Acceptable Use Policy',                     section: 'Policies and Procedures',  type: 'document' },
  { id: 'd56', ref: 'A.5.15',                    name: 'Access Control Policy',                     section: 'Policies and Procedures',  type: 'document' },
  { id: 'd57', ref: 'A.5.18',                    name: 'Access Control Register',                   section: 'Policies and Procedures',  type: 'document' },
  { id: 'd58', ref: 'A.8.13',                    name: 'Backup and Restore Policy',                 section: 'Policies and Procedures',  type: 'document' },
  { id: 'd59', ref: 'A.8.1',                     name: 'BYOD Policy',                               section: 'Policies and Procedures',  type: 'document' },
  { id: 'd60', ref: 'A.8.6',                     name: 'Capacity Planning Policy',                  section: 'Policies and Procedures',  type: 'document' },
  { id: 'd61', ref: 'A.8.32',                    name: 'Change Management Policy',                  section: 'Policies and Procedures',  type: 'document' },
  { id: 'd62', ref: 'A.8.32',                    name: 'Change Register',                           section: 'Policies and Procedures',  type: 'document' },
  { id: 'd63', ref: 'A.7.7',                     name: 'Clear Desk and Clear Screen Policy',        section: 'Policies and Procedures',  type: 'document' },
  { id: 'd64', ref: 'A.5.31',                    name: 'Compliance Policy',                         section: 'Policies and Procedures',  type: 'document' },
  { id: 'd65', ref: 'Clause 9.3.2.e',            name: 'Complaints & Compliments Procedure',        section: 'Policies and Procedures',  type: 'document' },
  { id: 'd66', ref: 'Clause 9.3.2.e',            name: 'Complaints & Compliments Register',         section: 'Policies and Procedures',  type: 'document' },
  { id: 'd67', ref: 'A.8.24',                    name: 'Cryptography Policy',                       section: 'Policies and Procedures',  type: 'document' },
  { id: 'd68', ref: 'Clause 7.5.3',              name: 'Document Control Procedure',                section: 'Policies and Procedures',  type: 'document' },
  { id: 'd69', ref: 'Clause 7.5',                name: 'Document Register & Awareness Record',      section: 'Policies and Procedures',  type: 'document' },
  { id: 'd70', ref: 'A.5.31',                    name: 'Generative AI Policy',                      section: 'Policies and Procedures',  type: 'document' },
  { id: 'd71', ref: 'A.5.10, A.5.12, A.5.13',   name: 'Information Classification Policy',         section: 'Policies and Procedures',  type: 'document' },
  { id: 'd72', ref: 'A7.10, A8.1, A8.3, A8.7, A8.9, A8.12, A8.22, A8.23', name: 'IT Security Policy', section: 'Policies and Procedures', type: 'document' },
  { id: 'd73', ref: 'A.5.9, A.5.10, A.5.11',    name: 'IS/IT Asset Register',                      section: 'Policies and Procedures',  type: 'document' },
  { id: 'd74', ref: 'A.8.15',                    name: 'Logging and Monitoring Policy',             section: 'Policies and Procedures',  type: 'document' },
  { id: 'd75', ref: 'A.8.20, A.8.21, A.8.22',   name: 'Network Management Policy',                 section: 'Policies and Procedures',  type: 'document' },
  { id: 'd76', ref: 'Clause 10.1',               name: 'Non-Conformity and Corrective Action Procedure', section: 'Policies and Procedures', type: 'document' },
  { id: 'd77', ref: 'A.5.17',                    name: 'Password & Authentication Policy',          section: 'Policies and Procedures',  type: 'document' },
  { id: 'd78', ref: 'A.7',                       name: 'Physical Security Policy',                  section: 'Policies and Procedures',  type: 'document' },
  { id: 'd79', ref: 'A.5.8',                     name: 'Project Management Policy',                 section: 'Policies and Procedures',  type: 'document' },
  { id: 'd80', ref: 'A.8.10',                    name: 'Records Management & Protection Policy',    section: 'Policies and Procedures',  type: 'document' },
  { id: 'd81', ref: 'A.8.28',                    name: 'Secure Coding Principles',                  section: 'Policies and Procedures',  type: 'document' },
  { id: 'd82', ref: 'A.8.27',                    name: 'Secure Engineering Principles',             section: 'Policies and Procedures',  type: 'document' },
  { id: 'd83', ref: 'A.6.7',                     name: 'Secure Remote Working Policy',              section: 'Policies and Procedures',  type: 'document' },
  { id: 'd84', ref: 'A.8.25',                    name: 'Secure Software & System Development Policy',section: 'Policies and Procedures', type: 'document' },
  { id: 'd85', ref: 'A.8.25',                    name: 'Software Development Process',              section: 'Policies and Procedures',  type: 'document' },
  { id: 'd86', ref: 'A.5.37',                    name: 'Standard Operating Procedures [Review Existing]', section: 'Policies and Procedures', type: 'document' },
  { id: 'd87', ref: 'A.7.10',                    name: 'Storage Media Policy',                      section: 'Policies and Procedures',  type: 'document' },
  { id: 'd88', ref: 'A.5.7',                     name: 'Threat Intelligence Policy',                section: 'Policies and Procedures',  type: 'document' },
  { id: 'd89', ref: 'A.5.18',                    name: 'User Access Management Procedure',          section: 'Policies and Procedures',  type: 'document' },
  { id: 'd90', ref: 'A.8.1',                     name: 'User Endpoints Policy',                     section: 'Policies and Procedures',  type: 'document' },
  { id: 'd91', ref: 'A.8.8, A.8.7',              name: 'Vulnerability Management & Patching Policy',section: 'Policies and Procedures',  type: 'document' },

  // Workshops
  { id: 'd92', ref: 'Clause 4',    name: 'Organisational Context Workshop', section: 'Workshops', type: 'workshop' },
  { id: 'd93', ref: 'Clause 6.2',  name: 'Risk Management Workshop',        section: 'Workshops', type: 'workshop' },
  { id: 'd94', ref: 'A.5.29',      name: 'Business Continuity Workshop (1)',section: 'Workshops', type: 'workshop' },
  { id: 'd95', ref: 'A.5.29',      name: 'Business Continuity Workshop (2)',section: 'Workshops', type: 'workshop' },
  { id: 'd96', ref: 'Clause 9.2',  name: 'Internal Audit Workshop',         section: 'Workshops', type: 'workshop' },
  { id: 'd97', ref: 'Clause 9.3',  name: 'Management Review Meeting',       section: 'Workshops', type: 'workshop' },
  { id: 'd98', ref: 'Clause 7.3',  name: 'ISO27001 Awareness Training',     section: 'Workshops', type: 'workshop' },
];

export const sections = [
  'Project Startup',
  'ISMS Core Documentation',
  'Asset Management',
  'Business Continuity',
  'Data Protection',
  'Human Resources',
  'Incident Management',
  'Internal Audit',
  'Management Review',
  'Risk Management',
  'Supplier Management',
  'Policies and Procedures',
  'Workshops',
] as const;
