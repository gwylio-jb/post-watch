import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AuditCheck, AuditReport, SeverityLevel } from '../data/auditTypes';
import { CATEGORY_ORDER } from '../utils/audit/scanEngine';
import { getExplainer } from '../data/checkExplainers';
import { pdfColors, pdfFontSizes, pdfSpacing, severityColor, scoreMeta, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter, PdfHeader, PdfSection, PdfPill, PdfCallout, PdfMeta } from './primitives';

/*
 * WordPress Security Report — full client-facing PDF.
 *
 * Pages:
 *   1. Cover — client logo, domain, score dial, confidentiality notice
 *   2. Executive summary — severity counts, priority actions
 *   3+. Findings by category — per-check explainer, evidence, remediation
 *   Last. Appendix — all passed/skipped checks summary
 *
 * Layout uses @react-pdf/renderer's Flexbox subset — no grid, no floats.
 */

const SEV_ORDER: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.page,
    paddingBottom: 44,              // room for the fixed footer
    backgroundColor: pdfColors.paper,
    color: pdfColors.ink,
    fontSize: pdfFontSizes.body,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },
});

// ── Score block shown inside the cover ──────────────────────────────────────
// Mirrors CompliancePdf.ComplianceCallout structure exactly — any deviation
// (e.g. lineHeight:1 on the hero number, or a flex-1 histogram with
// percentage-width children) has historically tripped yoga's "unsupported
// number" layout error. Keeping the shape parallel to Compliance prevents that.
function ScoreCallout({ score, counts }: { score: number; counts: Record<string, number> }) {
  const { label, color } = scoreMeta(score);
  const critical = counts.Critical ?? 0;
  const high = counts.High ?? 0;
  const totalIssues = (counts.Critical ?? 0) + (counts.High ?? 0) + (counts.Medium ?? 0) + (counts.Low ?? 0);

  return (
    <View style={{
      marginTop: pdfSpacing.section,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: pdfColors.surfaceAlt,
      borderRadius: 8,
      borderLeft: `3px solid ${color}`,
    }}>
      <View style={{
        width: 96, height: 96,
        borderRadius: 48,
        borderWidth: 6,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pdfColors.paper,
      }}>
        <Text style={{ fontSize: pdfFontSizes.display, fontWeight: 700, color, lineHeight: 1 }}>{score}</Text>
        <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.inkSoft, fontFamily: 'Courier', marginTop: 2 }}>/ 100</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.mintInk, fontFamily: 'Courier', letterSpacing: 1, marginBottom: 2 }}>
          {'// security score'}
        </Text>
        <Text style={{ fontSize: pdfFontSizes.h2, fontWeight: 700, color, marginBottom: 4 }}>{label}</Text>
        <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, marginBottom: 2 }}>
          {totalIssues === 0 ? 'No findings require attention' : `${totalIssues} finding${totalIssues === 1 ? '' : 's'} require attention`}
        </Text>
        {critical > 0 && (
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.critical, fontFamily: 'Courier' }}>
            ▲ {critical} critical · fix immediately
          </Text>
        )}
        {critical === 0 && high > 0 && (
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.high, fontFamily: 'Courier' }}>
            ▲ {high} high · fix within a week
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Executive summary table ─────────────────────────────────────────────────
function SeverityTable({ counts }: { counts: Record<string, number> }) {
  // Typed with Partial<> because SeverityLevel includes 'Info' / 'Pass' which
  // never appear in the severity table — they'd have an empty priority.
  const priorityLabel = (sev: SeverityLevel): string => {
    const map: Partial<Record<SeverityLevel, string>> = {
      Critical: 'Fix immediately',
      High:     'Fix within 1 week',
      Medium:   'Fix within 1 month',
      Low:      'Fix within quarter',
    };
    return map[sev] ?? '';
  };

  return (
    <View style={{ marginBottom: pdfSpacing.block }}>
      {/* Table header */}
      <View style={{ flexDirection: 'row', backgroundColor: pdfColors.surfaceAlt, padding: 6, borderRadius: 2 }}>
        <Text style={{ flex: 2, fontSize: pdfFontSizes.small, fontWeight: 700 }}>Severity</Text>
        <Text style={{ flex: 1, fontSize: pdfFontSizes.small, fontWeight: 700, textAlign: 'center' }}>Findings</Text>
        <Text style={{ flex: 3, fontSize: pdfFontSizes.small, fontWeight: 700 }}>Priority</Text>
      </View>
      {/* Rows */}
      {SEV_ORDER.map(sev => (
        <View key={sev} style={{ flexDirection: 'row', padding: 6, borderBottom: `0.5px solid ${pdfColors.border}` }}>
          <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: severityColor(sev) }} />
            <Text style={{ fontSize: pdfFontSizes.small, fontWeight: counts[sev] > 0 ? 700 : 400 }}>{sev}</Text>
          </View>
          <Text style={{ flex: 1, fontSize: pdfFontSizes.small, textAlign: 'center', fontWeight: counts[sev] > 0 ? 700 : 400, color: counts[sev] > 0 ? severityColor(sev) : pdfColors.inkSoft }}>
            {counts[sev] ?? 0}
          </Text>
          <Text style={{ flex: 3, fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>{priorityLabel(sev)}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Single finding block ────────────────────────────────────────────────────
function FindingBlock({ check }: { check: AuditCheck }) {
  const result = check.result!;
  const explainer = getExplainer(check.id);
  const color = severityColor(check.worstCaseSeverity);

  return (
    <View
      // `wrap={false}` on small blocks keeps them whole, but findings can be
      // long — allow them to wrap, with the heading row kept together via
      // `minPresenceAhead` so we never orphan a title at the bottom of a page.
      style={{
        marginBottom: pdfSpacing.block,
        borderLeft: `3px solid ${color}`,
        paddingLeft: 8,
      }}
      minPresenceAhead={80}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <Text style={{ fontSize: pdfFontSizes.h3, fontWeight: 700, flex: 1 }}>{check.name}</Text>
        <PdfPill label={check.worstCaseSeverity} color={color} />
      </View>
      <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, marginBottom: 4 }}>
        {result.detail}
      </Text>

      {explainer && (
        <View style={{ marginTop: 4 }}>
          <PdfCallout title="Attacker's view" body={explainer.attackerNarrative} accent={pdfColors.critical} />
          <PdfCallout title="Plain English" body={explainer.plainEnglish} />
          <PdfCallout title="Why it matters" body={explainer.whyItMatters} accent={pdfColors.warn} />
          <PdfCallout title="What to do" body={explainer.whatToDo} accent={pdfColors.pass} />
        </View>
      )}

      {result.evidence && (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: pdfFontSizes.tiny, fontWeight: 700, color: pdfColors.inkSoft, marginBottom: 2, letterSpacing: 0.5 }}>
            EVIDENCE
          </Text>
          <View style={{ backgroundColor: pdfColors.surfaceAlt, padding: 6, borderRadius: 2 }}>
            <Text style={{ fontSize: pdfFontSizes.tiny, fontFamily: 'Courier', color: pdfColors.ink }}>
              {result.evidence.slice(0, 400)}
            </Text>
          </View>
        </View>
      )}

      {result.recommendation && (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: pdfFontSizes.tiny, fontWeight: 700, color: pdfColors.mintInk, marginBottom: 2, letterSpacing: 0.5 }}>
            REMEDIATION
          </Text>
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink }}>
            {result.recommendation}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main document ───────────────────────────────────────────────────────────
export interface WpSecurityPdfProps {
  report: AuditReport;
  clientName?: string;
}

export default function WpSecurityPdf({ report, clientName }: WpSecurityPdfProps) {
  const completedAt = report.completedAt ? new Date(report.completedAt) : new Date();
  const timestamp = formatFullTimestamp(completedAt);

  const issueChecks = report.checks
    .filter(c => c.result?.status === 'fail' || c.result?.status === 'warning')
    .sort((a, b) => SEV_ORDER.indexOf(a.worstCaseSeverity) - SEV_ORDER.indexOf(b.worstCaseSeverity));

  const counts = SEV_ORDER.reduce<Record<string, number>>((acc, sev) => {
    acc[sev] = issueChecks.filter(c => c.worstCaseSeverity === sev).length;
    return acc;
  }, {});

  const grouped = CATEGORY_ORDER
    .map(cat => ({
      category: cat,
      checks: report.checks.filter(c => c.category === cat && (c.result?.status === 'fail' || c.result?.status === 'warning')),
    }))
    .filter(g => g.checks.length > 0);

  const footerMeta = `${report.domain} · Confidential`;

  return (
    <Document
      title={`Post_Watch — ${report.domain} — Security Report`}
      author="gwylio"
      subject="WordPress Security Audit"
      creator="Post_Watch"
    >
      {/* ── Cover page ── */}
      <Page size="A4" style={styles.page}>
        <PdfCover
          clientLogo={report.clientLogo}
          clientName={clientName}
          documentType="// post_scan report"
          title="WordPress Security Report"
          subtitle={report.domain}
          timestamp={timestamp}
          scoreBlock={<ScoreCallout score={report.score} counts={counts} />}
        />

        <PdfMeta rows={[
          { label: 'Target URL',    value: report.targetUrl },
          { label: 'Domain',        value: report.domain },
          { label: 'Scan duration', value: report.completedAt ? `${Math.round((new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime()) / 1000)}s` : '—' },
          { label: 'Total checks',  value: `${report.checks.length} (${report.checks.filter(c => c.result && c.result.status !== 'skipped').length} executed)` },
          { label: 'Findings',      value: `${issueChecks.length} requiring attention` },
        ]} />

        <PdfFooter meta={footerMeta} />
      </Page>

      {/* ── Executive summary ── */}
      <Page size="A4" style={styles.page}>
        <PdfHeader title="Executive Summary" right={report.domain} />

        <PdfSection title="Findings by severity" tag="breakdown">
          <SeverityTable counts={counts} />
        </PdfSection>

        {issueChecks.length > 0 && (
          <PdfSection title="Priority actions" tag="top 5 to fix">
            <View>
              {issueChecks.slice(0, 5).map((check, idx) => (
                <View key={check.id} style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: idx < 4 ? `0.5px solid ${pdfColors.border}` : undefined,
                }}>
                  <Text style={{ fontSize: pdfFontSizes.h2, fontWeight: 700, color: severityColor(check.worstCaseSeverity), width: 20 }}>
                    {idx + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={{ fontSize: pdfFontSizes.body, fontWeight: 700 }}>{check.name}</Text>
                      <PdfPill label={check.worstCaseSeverity} color={severityColor(check.worstCaseSeverity)} />
                    </View>
                    <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>
                      {check.result?.detail}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </PdfSection>
        )}

        {issueChecks.length === 0 && (
          <PdfSection title="Status" tag="all clear">
            <View style={{ padding: 12, backgroundColor: pdfColors.mintSubtle, borderLeft: `3px solid ${pdfColors.pass}` }}>
              <Text style={{ fontSize: pdfFontSizes.body, fontWeight: 700, color: pdfColors.pass, marginBottom: 2 }}>
                No issues detected
              </Text>
              <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink }}>
                All {report.checks.filter(c => c.result && c.result.status !== 'skipped').length} executed checks passed. Continue running periodic scans to catch regressions.
              </Text>
            </View>
          </PdfSection>
        )}

        <PdfFooter meta={footerMeta} />
      </Page>

      {/* ── Detailed findings by category ── */}
      {grouped.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PdfHeader title="Detailed Findings" right={report.domain} />

          {grouped.map(({ category, checks }) => (
            <PdfSection key={category} title={category} tag={`${checks.length} finding${checks.length === 1 ? '' : 's'}`}>
              {checks.map(c => <FindingBlock key={c.id} check={c} />)}
            </PdfSection>
          ))}

          <PdfFooter meta={footerMeta} />
        </Page>
      )}

      {/* ── Appendix ── */}
      <Page size="A4" style={styles.page}>
        <PdfHeader title="Appendix · Passed & Skipped Checks" right={report.domain} />

        <PdfSection title={`Passed (${report.checks.filter(c => c.result?.status === 'pass').length})`} tag="clean checks">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {report.checks.filter(c => c.result?.status === 'pass').map(c => (
              <Text key={c.id} style={{
                fontSize: pdfFontSizes.tiny,
                paddingVertical: 2, paddingHorizontal: 5,
                backgroundColor: pdfColors.mintSubtle,
                color: pdfColors.mintInk,
                borderRadius: 2,
              }}>{c.name}</Text>
            ))}
          </View>
        </PdfSection>

        {report.checks.some(c => c.result?.status === 'skipped') && (
          <PdfSection title={`Skipped (${report.checks.filter(c => c.result?.status === 'skipped').length})`} tag="not executable">
            <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft, marginBottom: 4 }}>
              These checks were not executable in the current scan environment.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {report.checks.filter(c => c.result?.status === 'skipped').map(c => (
                <Text key={c.id} style={{
                  fontSize: pdfFontSizes.tiny,
                  paddingVertical: 2, paddingHorizontal: 5,
                  backgroundColor: pdfColors.surfaceAlt,
                  color: pdfColors.inkSoft,
                  borderRadius: 2,
                }}>{c.name}</Text>
              ))}
            </View>
          </PdfSection>
        )}

        <View style={{ marginTop: pdfSpacing.section, paddingTop: 8, borderTop: `0.5px solid ${pdfColors.border}` }}>
          <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.inkSoft, lineHeight: 1.5 }}>
            Generated by Post_Watch — a product of gwylio. This report represents the state of {report.domain} at
            the time of the scan ({timestamp}). Findings and recommendations are based on publicly observable
            signals and should be verified against the current production environment before remediation.
          </Text>
        </View>

        <PdfFooter meta={footerMeta} />
      </Page>
    </Document>
  );
}
