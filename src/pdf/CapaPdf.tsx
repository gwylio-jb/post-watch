import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Finding, FindingSeverity } from '../data/types';
import { pdfColors, pdfFontSizes, pdfSpacing, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter, PdfHeader, PdfSection, PdfMeta } from './primitives';
import { STATUS_LABEL, isOverdue } from '../utils/findings';

/*
 * CAPA register report (Sprint 24, v3.0 pillar #2).
 *
 * Cover with lifecycle counts, then one card per finding: severity,
 * lifecycle status, root cause, corrective action (owner + due date,
 * overdue flagged), effectiveness check outcome. Ordered as the board
 * orders them — overdue first, then severity.
 */

const styles = StyleSheet.create({
  page: {
    padding: pdfSpacing.page,
    paddingBottom: 44,
    backgroundColor: pdfColors.paper,
    color: pdfColors.ink,
    fontSize: pdfFontSizes.body,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  card: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: pdfColors.surfaceAlt,
    borderRadius: 6,
  },
  label: { fontSize: 7, color: pdfColors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  value: { fontSize: 8.5 },
});

const sevColor = (s: FindingSeverity): string => {
  switch (s) {
    case 'critical': return pdfColors.critical;
    case 'high':     return pdfColors.warn;
    case 'medium':   return pdfColors.info;
    case 'low':      return pdfColors.inkSoft;
  }
};

export default function CapaPdf({ findings, clientNameById, clientName, clientLogo, brand }: {
  findings: Finding[];
  clientNameById: Map<string, string>;
  clientName?: string;
  clientLogo?: string;
  brand?: { primary: string; secondary: string };
}) {
  const timestamp = formatFullTimestamp(new Date());
  const open = findings.filter(f => f.status !== 'closed').length;
  const overdue = findings.filter(f => isOverdue(f)).length;
  const verifiedOrClosed = findings.filter(f => f.status === 'verified' || f.status === 'closed').length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfCover
          clientLogo={clientLogo}
          clientName={clientName}
          documentType="CAPA Register"
          title="Corrective & Preventive Actions"
          subtitle="Nonconformities and improvement findings tracked through corrective action to verified close (ISO/IEC 27001:2022 clause 10.2)"
          timestamp={timestamp}
          brand={brand}
          scoreBlock={
            <PdfMeta rows={[
              { label: 'Findings on register', value: String(findings.length) },
              { label: 'Open', value: String(open) },
              { label: 'Overdue actions', value: String(overdue) },
              { label: 'Verified / closed', value: String(verifiedOrClosed) },
            ]} />
          }
        />
        <PdfFooter meta={`Post_Watch · CAPA Register · ${timestamp}`} />
      </Page>

      <Page size="A4" style={styles.page}>
        <PdfHeader title="CAPA register" right={clientName} />
        <PdfSection title="Findings" tag={`${findings.length} total`}>
          {findings.map(f => {
            const overdueFlag = isOverdue(f);
            return (
              <View key={f.id} style={styles.card} wrap={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', flex: 1 }}>{f.title}</Text>
                  <Text style={{ fontSize: 7, color: sevColor(f.severity), textTransform: 'uppercase' }}>{f.severity}</Text>
                  <Text style={{ fontSize: 7, color: pdfColors.inkSoft }}>{STATUS_LABEL[f.status]}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  <View style={{ width: 110 }}>
                    <Text style={styles.label}>Client</Text>
                    <Text style={styles.value}>{clientNameById.get(f.clientId) ?? '—'}</Text>
                  </View>
                  <View style={{ width: 70 }}>
                    <Text style={styles.label}>Source</Text>
                    <Text style={styles.value}>{f.source}</Text>
                  </View>
                  <View style={{ width: 70 }}>
                    <Text style={styles.label}>Raised</Text>
                    <Text style={styles.value}>{f.raisedAt.slice(0, 10)}</Text>
                  </View>
                  <View style={{ width: 110 }}>
                    <Text style={styles.label}>Action owner / due</Text>
                    <Text style={[styles.value, overdueFlag ? { color: pdfColors.critical } : {}]}>
                      {f.action ? `${f.action.owner || '—'} · ${f.action.dueDate}${overdueFlag ? ' (overdue)' : ''}` : '—'}
                    </Text>
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={styles.label}>Effectiveness</Text>
                    <Text style={styles.value}>
                      {f.effectivenessCheck ? (f.effectivenessCheck.passed ? `Passed ${f.effectivenessCheck.date}` : `Failed ${f.effectivenessCheck.date}`) : '—'}
                    </Text>
                  </View>
                </View>
                {f.rootCause && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.label}>Root cause</Text>
                    <Text style={[styles.value, { color: pdfColors.inkSoft }]}>{f.rootCause}</Text>
                  </View>
                )}
                {f.action?.description && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.label}>Corrective action</Text>
                    <Text style={[styles.value, { color: pdfColors.inkSoft }]}>{f.action.description}</Text>
                  </View>
                )}
              </View>
            );
          })}
          {findings.length === 0 && (
            <Text style={{ fontSize: 9, color: pdfColors.inkSoft }}>No findings on the register.</Text>
          )}
        </PdfSection>
        <PdfFooter meta={`Post_Watch · CAPA Register · ${timestamp}`} />
      </Page>
    </Document>
  );
}
