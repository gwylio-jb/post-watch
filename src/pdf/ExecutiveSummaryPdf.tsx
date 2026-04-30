import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AuditReport } from '../data/auditTypes';
import type { GapAnalysisSession } from '../data/types';
import { pdfColors, pdfFontSizes, pdfSpacing, scoreMeta, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter, PdfSection, PdfMeta } from './primitives';

/*
 * Executive Summary — a single-page leadership-facing scorecard combining
 * the latest WP scan and the latest ISO 27001 gap analysis. Terse on purpose:
 * decision-makers want the headline, not the detail. Detail lives in the
 * dedicated WP and Compliance PDFs.
 */

const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.page,
    paddingBottom: 44,
    backgroundColor: pdfColors.paper,
    color: pdfColors.ink,
    fontSize: pdfFontSizes.body,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },
});

function StatTile({ label, value, color, sub, trend }: { label: string; value: string; color: string; sub?: string; trend?: string }) {
  return (
    <View style={{
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: pdfColors.surfaceAlt,
      borderRadius: 8,
      borderLeft: `3px solid ${color}`,
      gap: 4,
    }}>
      <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.mintInk, fontFamily: 'Courier', letterSpacing: 1.1 }}>
        {`// ${label.toLowerCase()}`}
      </Text>
      <Text style={{ fontSize: pdfFontSizes.display, fontWeight: 700, color, lineHeight: 1 }}>{value}</Text>
      {sub && <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink }}>{sub}</Text>}
      {trend && (
        <Text style={{ fontSize: pdfFontSizes.tiny, color, fontFamily: 'Courier', letterSpacing: 0.6 }}>
          {trend}
        </Text>
      )}
    </View>
  );
}

export interface ExecutiveSummaryPdfProps {
  report: AuditReport | null;
  session: GapAnalysisSession | null;
  clientName?: string;
  clientLogo?: string;
}

export default function ExecutiveSummaryPdf({ report, session, clientName, clientLogo }: ExecutiveSummaryPdfProps) {
  const now = formatFullTimestamp(new Date());

  const wpScoreMeta = report ? scoreMeta(report.score) : null;
  const wpCritical = report?.checks.filter(c => c.worstCaseSeverity === 'Critical' && c.result?.status === 'fail').length ?? 0;
  const wpHigh     = report?.checks.filter(c => c.worstCaseSeverity === 'High'     && c.result?.status === 'fail').length ?? 0;

  const compTotal    = session?.items.length ?? 0;
  const compCount    = session?.items.filter(i => i.status === 'Compliant').length ?? 0;
  const compPct      = compTotal > 0 ? Math.round((compCount / compTotal) * 100) : 0;
  const compColor    = compPct >= 80 ? pdfColors.pass : compPct >= 50 ? pdfColors.warn : pdfColors.critical;
  const compGaps     = session?.items.filter(i => i.status === 'Non-Compliant' || i.status === 'Partially Compliant').length ?? 0;

  const footerMeta = `${clientName ?? 'Unassigned'} · Confidential`;

  return (
    <Document
      title={`Post_Watch — Executive Summary — ${clientName ?? 'Client'}`}
      author="gwylio"
      subject="Security Posture Executive Summary"
      creator="Post_Watch"
    >
      <Page size="A4" style={styles.page}>
        <PdfCover
          clientLogo={clientLogo}
          clientName={clientName}
          documentType="// executive summary"
          title="Security Posture Summary"
          subtitle="At-a-glance scorecard for leadership review"
          timestamp={now}
        />

        {/* Twin scorecard */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: pdfSpacing.section }}>
          <StatTile
            label="wp security"
            value={report ? `${report.score}` : '—'}
            color={wpScoreMeta?.color ?? pdfColors.inkSoft}
            sub={report ? `${report.domain} · ${wpScoreMeta?.label}` : 'No scan on file'}
            trend={report ? (wpCritical > 0 ? `▲ ${wpCritical} critical` : wpHigh > 0 ? `▲ ${wpHigh} high` : '✓ no urgent issues') : undefined}
          />
          <StatTile
            label="iso 27001"
            value={session ? `${compPct}%` : '—'}
            color={compColor}
            sub={session ? `${compCount} of ${compTotal} compliant` : 'No gap analysis on file'}
            trend={session ? (compGaps > 0 ? `▲ ${compGaps} gap${compGaps === 1 ? '' : 's'} to close` : '✓ no outstanding gaps') : undefined}
          />
        </View>

        <PdfSection title="Headline findings" tag="wp scan">
          {report ? (
            <PdfMeta rows={[
              { label: 'Domain scanned',   value: report.domain },
              { label: 'Critical issues',  value: `${wpCritical}` },
              { label: 'High issues',      value: `${wpHigh}` },
              { label: 'Total findings',   value: `${report.checks.filter(c => c.result?.status === 'fail' || c.result?.status === 'warning').length}` },
              { label: 'Passed checks',    value: `${report.checks.filter(c => c.result?.status === 'pass').length}` },
            ]} />
          ) : (
            <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>
              No WordPress scan data available for this client. Run a scan from the WP Audit module.
            </Text>
          )}
        </PdfSection>

        <PdfSection title="Compliance position" tag="iso 27001">
          {session ? (
            <PdfMeta rows={[
              { label: 'Session',             value: session.name },
              { label: 'Items assessed',      value: `${compTotal}` },
              { label: 'Compliant',           value: `${compCount}` },
              { label: 'Gaps to remediate',   value: `${compGaps}` },
              { label: 'Last updated',        value: formatFullTimestamp(new Date(session.updatedAt)) },
            ]} />
          ) : (
            <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>
              No ISO 27001 gap analysis available. Complete a gap analysis in the Compliance module to populate this section.
            </Text>
          )}
        </PdfSection>

        <PdfSection title="Recommended next actions" tag="what to do next">
          <View style={{ gap: 4 }}>
            {report && wpCritical > 0 && (
              <Text style={{ fontSize: pdfFontSizes.small }}>
                • Address {wpCritical} critical WordPress finding{wpCritical > 1 ? 's' : ''} immediately — see full WP Security Report.
              </Text>
            )}
            {report && wpHigh > 0 && (
              <Text style={{ fontSize: pdfFontSizes.small }}>
                • Plan remediation for {wpHigh} high-severity finding{wpHigh > 1 ? 's' : ''} within the next week.
              </Text>
            )}
            {session && compGaps > 0 && (
              <Text style={{ fontSize: pdfFontSizes.small }}>
                • Progress {compGaps} ISO 27001 gap{compGaps > 1 ? 's' : ''} — prioritise High-priority items in the Compliance Status Report.
              </Text>
            )}
            {report && wpCritical === 0 && wpHigh === 0 && (!session || compGaps === 0) && (
              <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.pass, fontWeight: 700 }}>
                • No immediate actions required. Maintain periodic scans and annual gap reviews.
              </Text>
            )}
            {!report && !session && (
              <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>
                • Begin with a WordPress security scan and an ISO 27001 gap analysis to establish a baseline.
              </Text>
            )}
          </View>
        </PdfSection>

        <PdfFooter meta={footerMeta} />
      </Page>
    </Document>
  );
}
