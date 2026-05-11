/**
 * Tests for the prompt builders. Pure functions — we assert the structural
 * properties (correct fields land in the system/user prompts, sensitive
 * fields like client.notes don't get duplicated, length limits are
 * respected). We DON'T snapshot exact prompt text — the wording will tune
 * over time and snapshots would just be noise.
 *
 * Sprint 13 adds two builders here. Existing builders aren't covered by
 * tests yet (Sprint 11 originally tested behaviour, not prompts). When we
 * touch those for tier 2 / 3, we'll backfill.
 */
import {
  statementOfApplicabilityPrompt,
  riskTreatmentPlanPrompt,
  policyStubPrompt,
  clientCommsEmailPrompt,
} from './prompts';
import type { GapAnalysisSession, RiskItem, AnnexAControl, Client } from '../../data/types';
import type { AuditReport, AuditCheck } from '../../data/auditTypes';

function fakeControl(over: Partial<AnnexAControl> = {}): AnnexAControl {
  return {
    id: 'A.5.1',
    title: 'Information security policies',
    summary: 'A set of policies for information security',
    category: 'Organisational',
    controlType: ['Preventive'],
    securityProperties: ['Confidentiality', 'Integrity', 'Availability'],
    cybersecurityConcepts: ['Identify'],
    operationalCapabilities: [],
    securityDomains: ['Governance and Ecosystem'],
    implementationGuidance: '',
    auditQuestions: [],
    typicalEvidence: [],
    commonGaps: [],
    tips: [],
    relatedControls: [],
    relatedClauses: [],
    isNew2022: false,
    ...over,
  };
}

function fakeSession(items: GapAnalysisSession['items'] = []): GapAnalysisSession {
  return {
    id: 'sess-1',
    name: 'Acme ISMS gap',
    items,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    clientId: 'c-1',
  };
}

const fakeClient: Client = {
  id: 'c-1',
  name: 'Acme Corp',
  industry: 'Manufacturing',
  notes: 'Single-site UK operation, ISO 9001 already.',
  createdAt: '2026-01-01T00:00:00Z',
};

// ─── statementOfApplicabilityPrompt ─────────────────────────────────────────

describe('statementOfApplicabilityPrompt', () => {
  it('returns a system + user pair', () => {
    const result = statementOfApplicabilityPrompt(fakeSession(), [], { client: fakeClient });
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('embeds the client name + industry + notes in the user prompt', () => {
    const { user } = statementOfApplicabilityPrompt(fakeSession(), [], { client: fakeClient });
    expect(user).toContain('Acme Corp');
    expect(user).toContain('Manufacturing');
    expect(user).toContain('Single-site UK operation');
  });

  it('lists each control item with its resolved title and status', () => {
    const session = fakeSession([
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', priority: 'High', notes: '', responsible: '' },
      { itemId: 'A.5.2', itemType: 'control', status: 'Non-Compliant', priority: 'High', notes: 'Missing', responsible: '' },
    ]);
    const controls = [
      fakeControl({ id: 'A.5.1', title: 'Information security policies' }),
      fakeControl({ id: 'A.5.2', title: 'Information security roles and responsibilities' }),
    ];
    const { user } = statementOfApplicabilityPrompt(session, controls, { client: fakeClient });
    expect(user).toContain('A.5.1 Information security policies');
    expect(user).toContain('Compliant');
    expect(user).toContain('A.5.2 Information security roles and responsibilities');
    expect(user).toContain('Non-Compliant');
    expect(user).toContain('Missing');
  });

  it('filters out clause items — SoA covers Annex A controls only', () => {
    const session = fakeSession([
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', priority: 'High', notes: '', responsible: '' },
      { itemId: '4.1',   itemType: 'clause',  status: 'Compliant', priority: 'High', notes: '', responsible: '' },
    ]);
    const { user } = statementOfApplicabilityPrompt(session, [fakeControl()], { client: fakeClient });
    expect(user).toContain('A.5.1');
    expect(user).not.toContain('4.1');
  });

  it('caps the control list at 30 items to keep prompt within budget', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      itemId: `A.${i}`, itemType: 'control' as const, status: 'Compliant' as const,
      priority: 'High' as const, notes: '', responsible: '',
    }));
    const session = fakeSession(items);
    const { user } = statementOfApplicabilityPrompt(session, [], { client: fakeClient });
    // Rough check: count distinct control-row lines (start with "- A.")
    const matches = user.match(/^- A\.\d+/gm) ?? [];
    expect(matches.length).toBeLessThanOrEqual(30);
  });

  it('survives empty input gracefully', () => {
    const result = statementOfApplicabilityPrompt(fakeSession(), [], {});
    expect(result.user).toContain('(none recorded)');
  });

  it('system prompt instructs UK English + no preamble', () => {
    const { system } = statementOfApplicabilityPrompt(fakeSession(), [], { client: fakeClient });
    expect(system).toContain('UK English');
    expect(system).toContain('No preamble');
  });
});

// ─── riskTreatmentPlanPrompt ────────────────────────────────────────────────

function fakeRisk(over: Partial<RiskItem> = {}): RiskItem {
  return {
    id: 'r-1',
    name: 'Outdated WordPress core',
    description: 'Three client sites running WP < 6.5',
    category: 'Technical',
    likelihood: 4,
    impact: 5,
    score: 20,
    treatment: 'Mitigate',
    owner: 'JB',
    dueDate: '2026-06-01',
    status: 'Open',
    clientId: 'c-1',
    cia: ['C', 'I'],
    ...over,
  };
}

describe('riskTreatmentPlanPrompt', () => {
  it('embeds every risk field that drives treatment choice', () => {
    const { user } = riskTreatmentPlanPrompt(fakeRisk(), { client: fakeClient });
    expect(user).toContain('Outdated WordPress core');
    expect(user).toContain('Technical');
    expect(user).toContain('4 × 5 = 20');
    expect(user).toContain('Mitigate');
    expect(user).toContain('JB');
    expect(user).toContain('C, I');
  });

  it('omits owner and CIA when not set on the risk', () => {
    const risk = fakeRisk({ owner: '', cia: [] });
    const { user } = riskTreatmentPlanPrompt(risk, {});
    expect(user).not.toMatch(/^Owner:/m);
    expect(user).not.toMatch(/^CIA properties/m);
  });

  it('threads client industry through when client present', () => {
    const { user } = riskTreatmentPlanPrompt(fakeRisk(), { client: fakeClient });
    expect(user).toContain('Acme Corp');
    expect(user).toContain('Manufacturing');
  });

  it('runs cleanly with no client context', () => {
    const result = riskTreatmentPlanPrompt(fakeRisk(), {});
    expect(result.user).toContain('Outdated WordPress core');
    expect(result.user).not.toContain('Client:');
  });

  it('system prompt asks for plain text (no markdown)', () => {
    const { system } = riskTreatmentPlanPrompt(fakeRisk(), { client: fakeClient });
    expect(system).toContain('Plain text');
  });
});

// ─── policyStubPrompt ──────────────────────────────────────────────────────

describe('policyStubPrompt', () => {
  it('embeds the control id, title and summary', () => {
    const c = fakeControl({ id: 'A.5.7', title: 'Threat intelligence', summary: 'Collect and use threat info' });
    const { user } = policyStubPrompt(c, { client: fakeClient });
    expect(user).toContain('A.5.7');
    expect(user).toContain('Threat intelligence');
    expect(user).toContain('Collect and use threat info');
  });

  it('threads client industry through when present', () => {
    const { user } = policyStubPrompt(fakeControl(), { client: fakeClient });
    expect(user).toContain('Acme Corp');
    expect(user).toContain('Manufacturing');
  });

  it('survives empty client context', () => {
    const result = policyStubPrompt(fakeControl(), {});
    expect(result.user).not.toContain('Client:');
    expect(result.user).not.toContain('Industry:');
  });

  it('system prompt asks for "starting outline" framing (not a finished policy)', () => {
    const { system } = policyStubPrompt(fakeControl(), {});
    expect(system).toMatch(/starting|outline|skeletal/i);
    expect(system).toMatch(/review|tailor/i);
  });

  it('truncates implementation guidance to 500 chars to keep prompt budget', () => {
    const c = fakeControl({ implementationGuidance: 'x'.repeat(2000) });
    const { user } = policyStubPrompt(c, {});
    const guidanceLine = user.split('\n').find(l => l.startsWith('Guidance:'));
    expect(guidanceLine?.length).toBeLessThan(550);
  });
});

// ─── clientCommsEmailPrompt ────────────────────────────────────────────────

function fakeReport(over: Partial<AuditReport> = {}, checks: AuditCheck[] = []): AuditReport {
  return {
    id: 'r-1',
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-05-01T00:00:00Z',
    completedAt: '2026-05-01T00:01:30Z',
    score: 72,
    checks,
    ...over,
  };
}

function fakeFailedCheck(severity: 'Critical' | 'High' | 'Medium' | 'Low', name = 'Bad'): AuditCheck {
  return {
    id: `c-${name}`,
    category: 'Configuration',
    name,
    description: '',
    worstCaseSeverity: severity,
    result: { status: 'fail', detail: `${name} failed in detail` },
  };
}

describe('clientCommsEmailPrompt', () => {
  it('embeds the domain and score in the user prompt', () => {
    const { user } = clientCommsEmailPrompt(fakeReport({ score: 88, domain: 'lawfirm.test' }), { client: fakeClient });
    expect(user).toContain('lawfirm.test');
    expect(user).toContain('88');
  });

  it('lists Critical and High failed checks as top findings', () => {
    const report = fakeReport({}, [
      fakeFailedCheck('Critical', 'Critical fail'),
      fakeFailedCheck('High', 'High fail'),
      fakeFailedCheck('Medium', 'Medium ignored'),
    ]);
    const { user } = clientCommsEmailPrompt(report, { client: fakeClient });
    expect(user).toContain('Critical fail');
    expect(user).toContain('High fail');
    expect(user).not.toContain('Medium ignored');
  });

  it('caps top findings at 5 to keep the prompt short', () => {
    const checks = Array.from({ length: 10 }, (_, i) => fakeFailedCheck('Critical', `Crit-${i}`));
    const report = fakeReport({}, checks);
    const { user } = clientCommsEmailPrompt(report, {});
    const matches = user.match(/^- \[Critical\]/gm) ?? [];
    expect(matches.length).toBeLessThanOrEqual(5);
  });

  it('frames a clean scan as a positive result', () => {
    const report = fakeReport({ score: 96 }, []);
    const { user } = clientCommsEmailPrompt(report, {});
    expect(user).toContain('no critical or high findings');
  });

  it('system prompt forbids salutation / signature so output is body-only', () => {
    const { system } = clientCommsEmailPrompt(fakeReport(), { client: fakeClient });
    expect(system).toMatch(/email body only/i);
    expect(system).toMatch(/no.*signature/i);
  });
});
