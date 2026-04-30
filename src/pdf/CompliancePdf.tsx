import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { GapAnalysisSession, ComplianceStatus, Priority } from '../data/types';
import { pdfColors, pdfFontSizes, pdfSpacing, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter, PdfHeader, PdfSection, PdfPill, PdfMeta } from './primitives';

/*
 * ISO 27001 Compliance Status Report.
 *
 * Structure:
 *   1. Cover — client logo, session title, compliance percentage
 *   2. Executive summary — status counts, priority backlog
 *   3+. Non-compliant / partial items with notes and responsible owner
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

const statusColor = (s: ComplianceStatus): string => {
  switch (s) {
    case 'Compliant':           return pdfColors.pass;
    case 'Partially Compliant': return pdfColors.warn;
    case 'Non-Compliant':       return pdfColors.critical;
    case 'Not Applicable':      return pdfColors.info;
    default:                    return pdfColors.inkSoft;
  }
};

const priorityColor = (p: Priority): string => {
  switch (p) {
    case 'High':   return pdfColors.critical;
    case 'Medium': return pdfColors.warn;
    case 'Low':    return pdfColors.info;
  }
};

function ComplianceCallout({ pct, compliant, total, highGaps }: { pct: number; compliant: number; total: number; highGaps: number }) {
  const color = pct >= 80 ? pdfColors.pass : pct >= 50 ? pdfColors.warn : pdfColors.critical;
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
        <Text style={{ fontSize: pdfFontSizes.display, fontWeight: 700, color, lineHeight: 1 }}>{pct}</Text>
        <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.inkSoft, fontFamily: 'Courier', marginTop: 2 }}>percent</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.mintInk, fontFamily: 'Courier', letterSpacing: 1, marginBottom: 2 }}>
          {'// compliance position'}
        </Text>
        <Text style={{ fontSize: pdfFontSizes.h2, fontWeight: 700, color, marginBottom: 4 }}>
          {pct >= 80 ? 'On track' : pct >= 50 ? 'In progress' : 'Early stage'}
        </Text>
        <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, marginBottom: 2 }}>
          {compliant} of {total} items fully compliant
        </Text>
        {highGaps > 0 && (
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.critical, fontFamily: 'Courier' }}>
            ▲ {highGaps} high-priority gap{highGaps === 1 ? '' : 's'} outstanding
          </Text>
        )}
      </View>
    </View>
  );
}

export interface CompliancePdfProps {
  session: GapAnalysisSession;
  clientName?: string;
  clientLogo?: string;
}

export default function CompliancePdf({ session, clientName, clientLogo }: CompliancePdfProps) {
  const total = session.items.length;
  const compliant    = session.items.filter(i => i.status === 'Compliant').length;
  const partial      = session.items.filter(i => i.status === 'Partially Compliant').length;
  const nonCompliant = session.items.filter(i => i.status === 'Non-Compliant').length;
  const notAssessed  = session.items.filter(i => i.status === 'Not Assessed').length;
  const notApplicable = session.items.filter(i => i.status === 'Not Applicable').length;
  const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  const gaps = session.items
    .filter(i => i.status === 'Non-Compliant' || i.status === 'Partially Compliant')
    .sort((a, b) => {
      const pOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

  const timestamp = formatFullTimestamp(new Date(session.updatedAt));
  const footerMeta = `${session.name} · Confidential`;

  return (
    <Document
      title={`Post_Watch — ${session.name} — Compliance Status`}
      author="gwylio"
      subject="ISO 27001 Compliance Status Report"
      creator="Post_Watch"
    >
      {/* Cover */}
      <Page size="A4" style={styles.page}>
        <PdfCover
          clientLogo={clientLogo}
          clientName={clientName}
          documentType="// post_comply report"
          title="ISO 27001 Compliance Status"
          subtitle={session.name}
          timestamp={timestamp}
          scoreBlock={<ComplianceCallout pct={pct} compliant={compliant} total={total} highGaps={gaps.filter(g => g.priority === 'High').length} />}
        />

        <PdfMeta rows={[
          { label: 'Session',         value: session.name },
          { label: 'Items assessed',  value: `${total}` },
          { label: 'Last updated',    value: timestamp },
          { label: 'Priority gaps',   value: `${gaps.filter(g => g.priority === 'High').length} high, ${gaps.filter(g => g.priority === 'Medium').length} medium, ${gaps.filter(g => g.priority === 'Low').length} low` },
        ]} />

        <PdfFooter meta={footerMeta} />
      </Page>

      {/* Executive summary */}
      <Page size="A4" style={styles.page}>
        <PdfHeader title="Executive Summary" right={session.name} />

        <PdfSection title="Status distribution" tag="where you stand">
          <View>
            {([
              ['Compliant',           compliant,      pdfColors.pass],
              ['Partially Compliant', partial,        pdfColors.warn],
              ['Non-Compliant',       nonCompliant,   pdfColors.critical],
              ['Not Assessed',        notAssessed,    pdfColors.inkSoft],
              ['Not Applicable',      notApplicable,  pdfColors.info],
            ] as const).map(([label, count, color]) => {
              const barPct = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={label} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
                      <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, fontWeight: 700 }}>{label}</Text>
                    </View>
                    <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft, fontFamily: 'Courier' }}>
                      {count} · {total > 0 ? Math.round(barPct) : 0}%
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: pdfColors.surfaceAlt, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
                    {/* Leading highlight (first 20% of the filled length) then solid */}
                    {barPct > 0 && (
                      <View style={{ width: `${barPct}%`, height: '100%', flexDirection: 'row' }}>
                        <View style={{ width: '18%', height: '100%', backgroundColor: color, opacity: 0.75 }} />
                        <View style={{ flex: 1, height: '100%', backgroundColor: color }} />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </PdfSection>

        {gaps.length > 0 && (
          <PdfSection title="Priority backlog" tag="remediate first">
            <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft, marginBottom: 6 }}>
              Items requiring remediation, ordered by priority.
            </Text>
            <View>
              {gaps.slice(0, 8).map((item, idx) => (
                <View key={item.itemId} style={{
                  flexDirection: 'row',
                  gap: 8,
                  paddingVertical: 6,
                  borderBottom: idx < gaps.slice(0, 8).length - 1 ? `0.5px solid ${pdfColors.border}` : undefined,
                }}>
                  <View style={{ width: 20, alignItems: 'center', paddingTop: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor(item.priority) }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: pdfFontSizes.small, fontWeight: 700, fontFamily: 'Courier' }}>
                        {item.itemType === 'clause' ? 'Clause' : 'Control'} {item.itemId}
                      </Text>
                      <PdfPill label={item.priority} color={priorityColor(item.priority)} />
                      <PdfPill label={item.status} color={statusColor(item.status)} />
                    </View>
                    {item.notes && (
                      <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, marginTop: 2 }}>
                        {item.notes}
                      </Text>
                    )}
                    {item.responsible && (
                      <Text style={{ fontSize: pdfFontSizes.tiny, color: pdfColors.inkSoft, marginTop: 2, fontFamily: 'Courier' }}>
                        Owner: {item.responsible}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </PdfSection>
        )}

        <PdfFooter meta={footerMeta} />
      </Page>

      {/* Full gap register */}
      {gaps.length > 8 && (
        <Page size="A4" style={styles.page}>
          <PdfHeader title="Gap Register (continued)" right={session.name} />

          <PdfSection title="All remaining non-compliant / partial items" tag="gap register">
            <View>
              {gaps.slice(8).map((item, idx) => (
                <View key={item.itemId} style={{
                  flexDirection: 'row',
                  gap: 8,
                  paddingVertical: 6,
                  borderBottom: idx < gaps.slice(8).length - 1 ? `0.5px solid ${pdfColors.border}` : undefined,
                }} minPresenceAhead={40}>
                  <View style={{ width: 20, alignItems: 'center', paddingTop: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor(item.priority) }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: pdfFontSizes.small, fontWeight: 700, fontFamily: 'Courier' }}>
                        {item.itemType === 'clause' ? 'Clause' : 'Control'} {item.itemId}
                      </Text>
                      <PdfPill label={item.priority} color={priorityColor(item.priority)} />
                      <PdfPill label={item.status} color={statusColor(item.status)} />
                    </View>
                    {item.notes && (
                      <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, marginTop: 2 }}>{item.notes}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </PdfSection>

          <PdfFooter meta={footerMeta} />
        </Page>
      )}
    </Document>
  );
}
