/**
 * v3.0 ship: demo data seeder.
 *
 * One fictional client ("Meridian Books") with enough populated records
 * to make every v3.0 surface explorable — SoA rows with justifications,
 * risks across the severity range, CAPA findings at different lifecycle
 * stages, an internal audit in progress, a management review, KPIs with
 * a few periods of history, and all three registers.
 *
 * Only writes when the demo client isn't already present, so clicking
 * twice can't duplicate. All records carry the fixed DEMO_CLIENT_ID so
 * removeSampleData() can cleanly sweep them later.
 */
import type {
  Client, RiskItem, SoaStore, Finding, InternalAudit, ManagementReview,
  Kpi, TrainingRecord, IncidentRecord, AssetRecord, GapAnalysisSession,
} from '../data/types';
import { ensureSeeded, updateEntry } from './soa';
import { newFinding, setAction, setEffectivenessCheck } from './findings';
import { newInternalAudit, updateChecklistItem, newManagementReview, buildMrSnapshot } from './isms';
import { newKpi, recordKpiValue } from './kpis';
import { newTrainingRecord, newIncidentRecord, newAssetRecord } from './registers';

export const DEMO_CLIENT_ID = 'client-demo-meridian';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`clause-control:${key}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(`clause-control:${key}`, JSON.stringify(value));
}

export function hasSampleData(): boolean {
  const clients = read<Client[]>('clients', []);
  return Array.isArray(clients) && clients.some(c => c.id === DEMO_CLIENT_ID);
}

/**
 * Seed the demo client + records. Returns false when already present.
 *
 * NOTE: writes via raw localStorage (through the same prefixed keys the
 * hooks use). Callers reload the app afterwards so useLocalStorage
 * re-reads everything — same pattern as backup import.
 */
export function loadSampleData(): boolean {
  if (hasSampleData()) return false;
  const iso = (d: string) => new Date(d).toISOString();

  // Client
  const clients = read<Client[]>('clients', []);
  const demo: Client = {
    id: DEMO_CLIENT_ID,
    name: 'Meridian Books (demo)',
    industry: 'E-commerce / retail',
    primaryContact: 'Dana Whitfield',
    notes: 'Sample engagement seeded by "Load sample data" — safe to delete.',
    createdAt: iso('2026-01-05'),
  };
  write('clients', [...(Array.isArray(clients) ? clients : []), demo]);

  // Risks
  const risks = read<RiskItem[]>('post-watch:risks', []);
  const demoRisks: RiskItem[] = [
    {
      id: 'risk-demo-1', name: 'Unpatched WordPress plugins on storefront',
      description: 'Six plugins more than 90 days behind current versions.',
      category: 'Technical', likelihood: 4, impact: 5, score: 20,
      treatment: 'Mitigate', owner: 'Dana Whitfield', dueDate: '2026-08-15',
      status: 'In Treatment', clientId: DEMO_CLIENT_ID,
      cia: ['C', 'I', 'A'],
    },
    {
      id: 'risk-demo-2', name: 'No offboarding checklist for leavers',
      description: 'Accounts of two former staff still active.',
      category: 'People', likelihood: 3, impact: 4, score: 12,
      treatment: 'Mitigate', owner: 'HR', dueDate: '2026-09-01',
      status: 'Open', clientId: DEMO_CLIENT_ID,
    },
    {
      id: 'risk-demo-3', name: 'Office visitor log not maintained',
      description: 'Reception occasionally skips visitor sign-in.',
      category: 'Operational', likelihood: 2, impact: 2, score: 4,
      treatment: 'Accept', owner: 'Office manager', dueDate: '2026-12-01',
      status: 'Open', clientId: DEMO_CLIENT_ID,
    },
  ];
  write('post-watch:risks', [...(Array.isArray(risks) ? risks : []), ...demoRisks]);

  // Gap session (small, so compliance % computes)
  const sessions = read<GapAnalysisSession[]>('gap-sessions', []);
  const demoSession: GapAnalysisSession = {
    id: 'gap-demo-1', name: 'Meridian — initial assessment',
    createdAt: iso('2026-02-10'), updatedAt: iso('2026-02-12'),
    clientId: DEMO_CLIENT_ID,
    items: [
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', notes: 'Policy suite approved Jan 2026.', priority: 'Low', responsible: 'Dana' },
      { itemId: 'A.5.17', itemType: 'control', status: 'Non-Compliant', notes: 'No password manager rollout.', priority: 'High', responsible: 'IT' },
      { itemId: 'A.8.8', itemType: 'control', status: 'Partially Compliant', notes: 'Scanning ad-hoc, not scheduled.', priority: 'Medium', responsible: 'IT' },
      { itemId: 'A.6.3', itemType: 'control', status: 'Non-Compliant', notes: 'No awareness training since 2024.', priority: 'High', responsible: 'HR' },
    ],
  };
  write('gap-sessions', [...(Array.isArray(sessions) ? sessions : []), demoSession]);

  // SoA — seed all 93, curate a few
  const soaStore = read<SoaStore>('soa', {});
  let { entries } = ensureSeeded(soaStore, DEMO_CLIENT_ID);
  entries = updateEntry(entries, 'A.5.1', { justification: 'Core governance requirement for all engagements.', implementationStatus: 'Implemented' });
  entries = updateEntry(entries, 'A.5.17', { justification: 'Password controls required; manager rollout planned Q3.', implementationStatus: 'In Progress' });
  entries = updateEntry(entries, 'A.7.9', { applicable: false, justification: 'No off-site working of physical assets — fully office-based hardware.' });
  entries = updateEntry(entries, 'A.6.3', { justification: 'Awareness programme mandated by contract with key customer.', implementationStatus: 'Not Started' });
  write('soa', { ...(soaStore && typeof soaStore === 'object' ? soaStore : {}), [DEMO_CLIENT_ID]: entries });

  // Findings across the lifecycle
  const findings = read<Finding[]>('findings', []);
  let f1 = newFinding({
    clientId: DEMO_CLIENT_ID, source: 'gap', sourceRef: 'A.5.17',
    title: 'A.5.17 Authentication information: Non-Compliant',
    description: 'No password manager; shared credentials found in a spreadsheet.',
    severity: 'high', refIds: ['A.5.17'],
  });
  f1 = setAction(f1, { owner: 'IT lead', dueDate: '2026-08-30', description: 'Roll out password manager to all staff; rotate shared credentials.' });
  f1 = { ...f1, status: 'action-planned' };

  let f2 = newFinding({
    clientId: DEMO_CLIENT_ID, source: 'wp-scan', sourceRef: 'demo-check',
    title: 'WP scan: XML-RPC endpoint exposed',
    description: 'xmlrpc.php responds; brute-force amplification vector.',
    severity: 'medium',
  });
  f2 = setAction(f2, { owner: 'Web agency', dueDate: '2026-06-01', description: 'Disable XML-RPC via filter.' });
  f2 = setEffectivenessCheck({ ...f2, status: 'implemented' }, { date: '2026-06-20', passed: true, notes: 'Re-scan confirms 403.' });
  f2 = { ...f2, status: 'verified' };

  const f3 = newFinding({
    clientId: DEMO_CLIENT_ID, source: 'manual',
    title: 'Supplier contracts missing security clauses',
    description: 'Three of five key supplier contracts predate the ISMS.',
    severity: 'medium', refIds: ['A.5.20'],
  });
  write('findings', [...(Array.isArray(findings) ? findings : []), f1, f2, f3]);

  // Internal audit, part-executed
  const audits = read<InternalAudit[]>('internal-audits', []);
  let audit = newInternalAudit({
    clientId: DEMO_CLIENT_ID, title: 'H1 2026 — management clauses',
    auditor: 'J. Bedford', plannedDate: '2026-06-15',
    refIds: ['4.1', '4.2', '4.3', '5.1', '5.2'],
  });
  audit = updateChecklistItem(audit, '4.1', { covered: true, notes: 'Context register reviewed; current.' });
  audit = updateChecklistItem(audit, '4.2', { covered: true, notes: 'Interested parties list needs the new payment provider.' });
  write('internal-audits', [...(Array.isArray(audits) ? audits : []), audit]);

  // Management review
  const reviews = read<ManagementReview[]>('management-reviews', []);
  const mr = newManagementReview({
    clientId: DEMO_CLIENT_ID, date: '2026-06-30', attendees: ['D. Whitfield (MD)', 'J. Bedford (consultant)'],
    snapshot: buildMrSnapshot({
      clientId: DEMO_CLIENT_ID,
      findings: [f1, f2, f3],
      gapSessions: [demoSession],
      reports: [],
      soaStore: { [DEMO_CLIENT_ID]: entries },
    }),
  });
  mr.minutes['Nonconformities and corrective actions'] = 'Three findings open; password-manager rollout is the priority action.';
  mr.minutes['Audit results'] = 'H1 internal audit in progress; context clauses covered, no majors.';
  mr.decisions.push('Approve password manager budget (£1.2k/yr).');
  mr.decisions.push('Awareness training to run quarterly from Q3.');
  write('management-reviews', [...(Array.isArray(reviews) ? reviews : []), mr]);

  // KPIs with history
  const kpis = read<Kpi[]>('kpis', []);
  let kpi1 = newKpi({ clientId: DEMO_CLIENT_ID, name: 'Staff with current security training', unit: '%', target: 90, cadence: 'monthly' });
  kpi1 = recordKpiValue(kpi1, '2026-04', 55);
  kpi1 = recordKpiValue(kpi1, '2026-05', 70);
  kpi1 = recordKpiValue(kpi1, '2026-06', 85);
  let kpi2 = newKpi({ clientId: DEMO_CLIENT_ID, name: 'Critical findings closed within SLA', unit: '%', target: 95, cadence: 'quarterly' });
  kpi2 = recordKpiValue(kpi2, '2026-Q1', 100);
  kpi2 = recordKpiValue(kpi2, '2026-Q2', 96);
  write('kpis', [...(Array.isArray(kpis) ? kpis : []), kpi1, kpi2]);

  // Registers
  const training = read<TrainingRecord[]>('training', []);
  write('training', [...(Array.isArray(training) ? training : []),
    newTrainingRecord({ clientId: DEMO_CLIENT_ID, employee: 'Dana Whitfield', topic: 'Phishing awareness', date: '2026-05-12', passed: true }),
    newTrainingRecord({ clientId: DEMO_CLIENT_ID, employee: 'Sam Okafor', topic: 'Phishing awareness', date: '2026-05-12', passed: true }),
    newTrainingRecord({ clientId: DEMO_CLIENT_ID, employee: 'Lee Trent', topic: 'Phishing awareness', date: '2026-05-12', passed: false, notes: 'Re-sit booked.' }),
  ]);

  const incidents = read<IncidentRecord[]>('incidents', []);
  const inc = {
    ...newIncidentRecord({
      clientId: DEMO_CLIENT_ID, title: 'Phishing email reported by staff',
      description: 'Credential-harvesting email spoofing the MD; reported before any click.',
      severity: 'medium' as const, date: '2026-04-22',
    }),
    status: 'resolved' as const, resolvedAt: '2026-04-23',
    rootCause: 'External spoof; SPF present but DMARC only in monitor mode.',
    lessonsLearned: 'Move DMARC to quarantine; add banner on external mail.',
  };
  write('incidents', [...(Array.isArray(incidents) ? incidents : []), inc]);

  const assets = read<AssetRecord[]>('assets', []);
  write('assets', [...(Array.isArray(assets) ? assets : []),
    { ...newAssetRecord({ clientId: DEMO_CLIENT_ID, name: 'Customer database (orders + PII)', type: 'Data', owner: 'Dana Whitfield', confidentiality: 5, integrity: 5, availability: 4 }), controlIds: ['A.8.24', 'A.5.33'] },
    newAssetRecord({ clientId: DEMO_CLIENT_ID, name: 'WooCommerce storefront', type: 'System', owner: 'Web agency', confidentiality: 4, integrity: 5, availability: 5 }),
    newAssetRecord({ clientId: DEMO_CLIENT_ID, name: 'Office NAS', type: 'Infrastructure', owner: 'IT lead', confidentiality: 3, integrity: 4, availability: 3 }),
  ]);

  return true;
}
