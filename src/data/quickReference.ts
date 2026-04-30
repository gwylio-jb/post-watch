export interface ReferenceCard {
  id: string;
  title: string;
  description: string;
  content: ReferenceSection[];
}

export interface ReferenceSection {
  heading: string;
  items: string[];
}

export const referenceCards: ReferenceCard[] = [
  {
    id: 'whats-new-2022',
    title: "What's New in 2022",
    description: 'Summary of structural changes and new controls in the 2022 revision',
    content: [
      {
        heading: 'Structural Changes',
        items: [
          'Annex A restructured from 14 categories (114 controls) to 4 categories (93 controls)',
          'New categories: Organisational (A.5), People (A.6), Physical (A.7), Technological (A.8)',
          'Control attributes introduced: control type, security properties, cybersecurity concepts, operational capabilities, security domains',
          'Clause 6.3 added: Planning of changes — requires structured change management for the ISMS itself',
          'Clause 4.2 updated to require identification of relevant requirements from interested parties that will be addressed through the ISMS',
        ],
      },
      {
        heading: '11 New Controls',
        items: [
          'A.5.7 — Threat intelligence: Collect and analyse threat information relevant to your organisation',
          'A.5.23 — Information security for use of cloud services: Establish security processes for cloud acquisition, use, management, and exit',
          'A.5.30 — ICT readiness for business continuity: Ensure ICT systems can be restored to support business operations during disruption',
          'A.7.4 — Physical security monitoring: Continuously monitor premises for unauthorised physical access',
          'A.8.9 — Configuration management: Establish and maintain secure configurations for hardware, software, services, and networks',
          'A.8.10 — Information deletion: Delete information when no longer required, in line with legal and policy requirements',
          'A.8.11 — Data masking: Use data masking techniques in accordance with access control and business requirements',
          'A.8.12 — Data leakage prevention: Apply DLP measures to systems, networks, and endpoints that process sensitive information',
          'A.8.16 — Monitoring activities: Monitor networks, systems, and applications for anomalous behaviour and take appropriate action',
          'A.8.23 — Web filtering: Manage access to external websites to reduce exposure to malicious content',
          'A.8.28 — Secure coding: Apply secure coding principles to software development',
        ],
      },
      {
        heading: 'Merged Controls (Examples)',
        items: [
          'Old A.11.1.2/A.11.1.6 merged into A.7.2 (Physical entry)',
          'Old A.6.2.1/A.6.2.2 merged into A.6.7 (Remote working)',
          'Old A.12.1.4 merged into A.8.31 (Separation of environments)',
          'Old A.14.2.1/A.14.2.5 merged into A.8.25 (Secure development life cycle)',
          'Old A.18.1.1/A.18.1.5 merged into A.5.31 (Legal, statutory, regulatory and contractual requirements)',
        ],
      },
      {
        heading: 'Transition Timeline',
        items: [
          'ISO 27001:2022 published October 2022',
          'Transition deadline: 31 October 2025 — all certified organisations must have transitioned',
          'New certifications against ISO 27001:2013 ceased from 30 April 2024',
          'Key transition activity: review and update Statement of Applicability to reflect new control structure',
        ],
      },
    ],
  },
  {
    id: 'mandatory-documented-info',
    title: 'Mandatory Documented Information',
    description: 'Every clause and control requiring documented information',
    content: [
      {
        heading: 'Clause 4 — Context',
        items: [
          '4.3 — Scope of the ISMS: documented and available',
        ],
      },
      {
        heading: 'Clause 5 — Leadership',
        items: [
          '5.2 — Information security policy: documented, communicated, available to interested parties as appropriate',
        ],
      },
      {
        heading: 'Clause 6 — Planning',
        items: [
          '6.1.2 — Information security risk assessment process and results',
          '6.1.3 — Information security risk treatment plan and results',
          '6.1.3 d) — Statement of Applicability (SoA)',
          '6.2 — Information security objectives: documented',
        ],
      },
      {
        heading: 'Clause 7 — Support',
        items: [
          '7.2 — Evidence of competence (training records, qualifications, experience)',
          '7.5 — Documented information required by the ISMS and by ISO 27001',
        ],
      },
      {
        heading: 'Clause 8 — Operation',
        items: [
          '8.1 — Operational planning and control documentation',
          '8.2 — Results of information security risk assessments',
          '8.3 — Results of information security risk treatment',
        ],
      },
      {
        heading: 'Clause 9 — Performance Evaluation',
        items: [
          '9.1 — Evidence of monitoring and measurement results',
          '9.2 — Evidence of audit programmes and audit results',
          '9.3 — Evidence of management review results',
        ],
      },
      {
        heading: 'Clause 10 — Improvement',
        items: [
          '10.2 — Evidence of nonconformities and corrective actions taken, and their results',
        ],
      },
    ],
  },
  {
    id: 'risk-based-thinking',
    title: 'Risk-Based Thinking Map',
    description: 'How risk flows through the standard from identification to treatment',
    content: [
      {
        heading: 'The Risk Flow',
        items: [
          '1. Context (4.1/4.2) → Understand internal/external issues and interested party requirements',
          '2. Scope (4.3) → Define ISMS boundaries based on context',
          '3. Risk Assessment Process (6.1.2) → Define criteria, identify risks to C/I/A, analyse likelihood and impact, evaluate against criteria',
          '4. Risk Treatment (6.1.3) → Select treatment options (mitigate, accept, transfer, avoid), select controls from Annex A or elsewhere',
          '5. Statement of Applicability (6.1.3d) → Document all Annex A controls, justify inclusion or exclusion, record implementation status',
          '6. Risk Treatment Plan (6.1.3e) → Document how selected controls will be implemented, assign owners, set timescales',
          '7. Implementation (8.1) → Execute risk treatment plans, implement controls',
          '8. Risk Assessment Execution (8.2) → Perform risk assessments at planned intervals or when significant changes occur',
          '9. Risk Treatment Execution (8.3) → Implement risk treatment plan',
          '10. Monitoring (9.1) → Monitor and measure control effectiveness',
          '11. Review (9.3) → Management review considers risk assessment results and risk treatment status',
          '12. Improvement (10.1/10.2) → Address nonconformities, drive continual improvement',
        ],
      },
      {
        heading: 'Common Risk Assessment Approaches',
        items: [
          'Asset-based: Identify assets → threats → vulnerabilities → calculate risk (traditional approach, thorough but time-consuming)',
          'Scenario-based: Identify risk scenarios directly, then assess likelihood and impact (faster, good for workshops)',
          'Process-based: Map business processes, identify risks to each process (good alignment with business)',
          'Whichever approach is used, it must be consistent, valid, and produce comparable results (clause 6.1.2)',
        ],
      },
      {
        heading: 'Risk Treatment Options',
        items: [
          'Modify (mitigate): Apply controls to reduce likelihood or impact',
          'Accept: Consciously accept the risk with documented management approval',
          'Avoid: Eliminate the activity or condition causing the risk',
          'Transfer (share): Share the risk with another party (e.g. insurance, outsourcing)',
          'Residual risk must be accepted by risk owners — this is a key audit point',
        ],
      },
    ],
  },
  {
    id: 'audit-programme-planning',
    title: 'Audit Programme Planning',
    description: 'Guidance on planning internal audit programmes and common approaches',
    content: [
      {
        heading: 'Audit Programme Requirements (Clause 9.2)',
        items: [
          'Plan an audit programme considering the importance of the processes and results of previous audits',
          'Define audit criteria and scope for each audit',
          'Select auditors who ensure objectivity and impartiality (cannot audit own work)',
          'Ensure results are reported to relevant management',
          'Retain documented information as evidence of the audit programme and audit results',
        ],
      },
      {
        heading: 'Common Audit Cycles',
        items: [
          'Full cycle in year 1: Audit all clauses (4-10) and all applicable Annex A controls across 2-4 internal audits',
          'Annual coverage: Ensure every clause and applicable control is audited at least once per certification cycle (typically 3 years)',
          'Risk-based frequency: Audit high-risk areas or areas with previous findings more frequently',
          'Pre-certification: Conduct a full-scope internal audit 2-3 months before the external audit',
          'Post-incident: Schedule additional audits in areas where incidents or nonconformities have occurred',
        ],
      },
      {
        heading: 'Sampling Approaches',
        items: [
          'Process sampling: Select a business process and trace controls through it end-to-end',
          'Control sampling: Pick a selection of controls and verify implementation across the organisation',
          'Location sampling: If multi-site, sample different locations each cycle',
          'Record sampling: When reviewing evidence, sample recent records (e.g. last 3 starters/leavers)',
          'Rule of thumb: sample size should be sufficient to give confidence — typically 5-10 records for key processes',
        ],
      },
      {
        heading: 'Audit Reporting Tips',
        items: [
          'Classify findings consistently: Major NC, Minor NC, Observation, Opportunity for Improvement',
          'Each finding must reference the specific clause or control requirement not met',
          'Include objective evidence (what was seen, not seen, or told)',
          'Track corrective actions with deadlines and verify effectiveness',
          'Present a summary to management review (feeds into clause 9.3)',
        ],
      },
    ],
  },
  {
    id: 'management-review-inputs',
    title: 'Management Review Inputs',
    description: 'Required inputs per clause 9.3 for management review meetings',
    content: [
      {
        heading: 'Required Inputs (9.3.2)',
        items: [
          'Status of actions from previous management reviews',
          'Changes in external and internal issues relevant to the ISMS',
          'Changes in needs and expectations of interested parties relevant to the ISMS',
          'Feedback on information security performance including trends in: nonconformities and corrective actions, monitoring and measurement results, audit results, fulfilment of information security objectives',
          'Feedback from interested parties',
          'Results of risk assessment and status of risk treatment plan',
          'Opportunities for continual improvement',
        ],
      },
      {
        heading: 'Expected Outputs (9.3.3)',
        items: [
          'Decisions related to continual improvement opportunities',
          'Any needs for changes to the ISMS',
          'Resource needs',
          'Minutes or records documenting the review and decisions taken',
        ],
      },
      {
        heading: 'Practical Tips for Management Reviews',
        items: [
          'Schedule at least annually (many organisations do quarterly)',
          'Use a standing agenda template that covers all required inputs',
          'Prepare a management pack/dashboard in advance — do not present raw data',
          'Ensure top management actually attends (a common audit finding is delegation to middle management)',
          'Record action items with owners and deadlines',
          'The management review is a key demonstration of leadership commitment (clause 5.1)',
        ],
      },
    ],
  },
  {
    id: 'soa-builder-guide',
    title: 'SoA Builder Guide',
    description: 'Guidance on building a Statement of Applicability',
    content: [
      {
        heading: 'What the SoA Must Include',
        items: [
          'All 93 Annex A controls listed (not just the applicable ones)',
          'For each control: whether it is applicable or not applicable',
          'Justification for inclusion (usually linked to risk treatment)',
          'Justification for exclusion (must be a genuine reason, not just "not relevant")',
          'Implementation status of each applicable control',
          'The SoA is required by clause 6.1.3 d) — it is a mandatory documented output',
        ],
      },
      {
        heading: 'Common SoA Mistakes',
        items: [
          'Excluding controls without proper justification ("N/A" is not sufficient — explain why)',
          'Not linking controls to risk treatment decisions',
          'Static document — not updated when risks, scope, or controls change',
          'Not including controls from sources other than Annex A (the standard allows additional controls)',
          'Missing version control and approval signatures',
          'Implementation status not reflecting reality (saying "implemented" when only partially done)',
        ],
      },
      {
        heading: 'SoA Best Practices',
        items: [
          'Link each applicable control to the risk(s) it treats — this creates traceability',
          'Include a column for the control owner/responsible person',
          'Use consistent implementation status categories: Not Started, In Progress, Implemented, Verified',
          'Review and update the SoA at least annually, or after significant changes',
          'The SoA is one of the first documents an external auditor will request — keep it current and accurate',
          'Consider using a traffic-light system for visual clarity in management reporting',
          'Cross-reference to evidence locations (e.g. policy document references, tool configurations)',
        ],
      },
    ],
  },
];
