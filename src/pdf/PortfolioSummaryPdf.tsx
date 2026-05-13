/**
 * PortfolioSummaryPdf — Sprint 16 Pack 4 #2.
 *
 * One-page-per-client roll-up across the entire roster. For each client:
 *   - Latest WP scan score (or "not yet scanned")
 *   - Open + critical risk counts
 *   - Compliance % across their gap analysis sessions
 *   - Last activity date (most recent of any of the above)
 *
 * Not a "diff" — true cross-client diff needs auto-snapshots we're not
 * yet building. The summary is the current state of every client, in
 * one PDF, sorted by last-activity newest-first.
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { pdfColors, pdfFontSizes, pdfSpacing, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter } from './primitives';
import type { ClientSummaryRow } from './portfolioSummary';

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

interface PortfolioSummaryPdfProps {
  rows: ClientSummaryRow[];
  /** Sprint 17: per-org brand override. Portfolio summary is cross-client
   *  so there's no per-client brand to pick — caller passes the org's
   *  default (Settings) here. */
  brand?: { primary: string; secondary: string };
}

export default function PortfolioSummaryPdf({ rows, brand }: PortfolioSummaryPdfProps) {
  const generatedAt = formatFullTimestamp(new Date());
  return (
    <Document title={`Post_Watch Portfolio Summary — ${generatedAt}`}>
      <PdfCover
        documentType="post_watch · portfolio"
        title="Portfolio summary"
        subtitle={`Current state across ${rows.length} client${rows.length === 1 ? '' : 's'}`}
        timestamp={generatedAt}
        brand={brand}
      />

      <Page size="A4" style={styles.page} wrap>
        {/* Header row */}
        <View style={{
          flexDirection: 'row',
          paddingVertical: 6,
          borderBottom: `1.5px solid ${pdfColors.border}`,
          marginBottom: 4,
        }}>
          <Text style={[colStyle.head, { flex: 2.2 }]}>Client</Text>
          <Text style={[colStyle.head, { flex: 1 }]}>WP score</Text>
          <Text style={[colStyle.head, { flex: 1.1 }]}>Compliance</Text>
          <Text style={[colStyle.head, { flex: 1.1 }]}>Risks</Text>
          <Text style={[colStyle.head, { flex: 1.4 }]}>Last activity</Text>
        </View>

        {rows.length === 0 ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: pdfColors.inkSoft, fontSize: pdfFontSizes.body }}>
              No clients yet — add some in post_clients to populate this report.
            </Text>
          </View>
        ) : (
          rows.map(row => <SummaryRow key={row.clientId} row={row} />)
        )}

        <PdfFooter meta={`Generated ${generatedAt}`} />
      </Page>
    </Document>
  );
}

const colStyle = StyleSheet.create({
  head: {
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.inkSoft,
    fontFamily: 'Courier',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cell: {
    fontSize: pdfFontSizes.body,
    color: pdfColors.ink,
  },
  cellMuted: {
    fontSize: pdfFontSizes.body,
    color: pdfColors.inkSoft,
  },
});

function SummaryRow({ row }: { row: ClientSummaryRow }) {
  const scoreColor = row.latestScore === null
    ? pdfColors.inkSoft
    : row.latestScore >= 80 ? pdfColors.mintInk
    : row.latestScore >= 50 ? pdfColors.warn
    : pdfColors.critical;
  const compColor = row.compliancePct === null
    ? pdfColors.inkSoft
    : row.compliancePct >= 80 ? pdfColors.mintInk
    : row.compliancePct >= 50 ? pdfColors.warn
    : pdfColors.critical;
  const riskColor = row.criticalRisks > 0
    ? pdfColors.critical
    : row.openRisks > 0 ? pdfColors.warn
    : pdfColors.mintInk;

  return (
    <View style={{
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottom: `0.5px solid ${pdfColors.border}`,
      alignItems: 'flex-start',
    }} wrap={false}>
      {/* Client */}
      <View style={{ flex: 2.2, paddingRight: 8 }}>
        <Text style={[colStyle.cell, { fontWeight: 700 }]}>{row.clientName}</Text>
        {row.industry && (
          <Text style={[colStyle.cellMuted, { fontSize: pdfFontSizes.small, marginTop: 2 }]}>
            {row.industry}
          </Text>
        )}
      </View>

      {/* Score */}
      <View style={{ flex: 1 }}>
        {row.latestScore !== null ? (
          <>
            <Text style={[colStyle.cell, { color: scoreColor, fontWeight: 700, fontSize: pdfFontSizes.h2 }]}>
              {row.latestScore}<Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft }}>/100</Text>
            </Text>
            {row.latestScanDomain && (
              <Text style={[colStyle.cellMuted, { fontSize: pdfFontSizes.tiny, marginTop: 2 }]}>
                {row.latestScanDomain}
              </Text>
            )}
          </>
        ) : (
          <Text style={colStyle.cellMuted}>—</Text>
        )}
      </View>

      {/* Compliance */}
      <View style={{ flex: 1.1 }}>
        {row.compliancePct !== null ? (
          <>
            <Text style={[colStyle.cell, { color: compColor, fontWeight: 700 }]}>
              {row.compliancePct}%
            </Text>
            <Text style={[colStyle.cellMuted, { fontSize: pdfFontSizes.tiny, marginTop: 2 }]}>
              {row.complianceItemCount} item{row.complianceItemCount === 1 ? '' : 's'} assessed
            </Text>
          </>
        ) : (
          <Text style={colStyle.cellMuted}>—</Text>
        )}
      </View>

      {/* Risks */}
      <View style={{ flex: 1.1 }}>
        <Text style={[colStyle.cell, { color: riskColor, fontWeight: 700 }]}>
          {row.openRisks} open
        </Text>
        {row.criticalRisks > 0 && (
          <Text style={[colStyle.cellMuted, { fontSize: pdfFontSizes.tiny, marginTop: 2, color: pdfColors.critical }]}>
            {row.criticalRisks} critical
          </Text>
        )}
      </View>

      {/* Last activity */}
      <View style={{ flex: 1.4 }}>
        {row.lastActivityAt ? (
          <Text style={colStyle.cellMuted}>
            {new Date(row.lastActivityAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : (
          <Text style={colStyle.cellMuted}>—</Text>
        )}
      </View>
    </View>
  );
}
