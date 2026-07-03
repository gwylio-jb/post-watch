import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ManagementReview } from '../data/types';
import { pdfColors, pdfFontSizes, pdfSpacing, formatFullTimestamp } from './theme';
import { PdfFooter, PdfHeader, PdfSection, PdfMeta } from './primitives';
import { MR_AGENDA_TOPICS } from '../utils/isms';

/*
 * Management review minutes (Sprint 25, v3.0 pillar #3).
 *
 * Single-artifact minutes document: attendees, the frozen posture
 * snapshot, minutes per clause-9.3.2 agenda topic, decisions. This is
 * the record auditors sample when they ask for "your last three
 * management reviews".
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
  topic: { marginBottom: 8 },
  topicTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  topicBody: { fontSize: 8.5, color: pdfColors.inkSoft },
});

export default function MrPdf({ review, clientName }: {
  review: ManagementReview;
  clientName?: string;
}) {
  const timestamp = formatFullTimestamp(new Date());
  const snap = review.snapshot;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader title={`Management review — ${review.date}`} right={clientName} />

        <PdfSection title="Record">
          <PdfMeta rows={[
            { label: 'Date', value: review.date },
            { label: 'Client', value: clientName ?? '—' },
            { label: 'Attendees', value: review.attendees.length > 0 ? review.attendees.join(', ') : 'Not recorded' },
          ]} />
        </PdfSection>

        <PdfSection title="Posture at review" tag="auto-snapshot">
          <PdfMeta rows={[
            { label: 'Open findings (CAPA)', value: String(snap.openFindings) },
            { label: 'Overdue corrective actions', value: String(snap.overdueFindings) },
            { label: 'Compliance (latest gap analysis)', value: snap.compliancePct !== null ? `${snap.compliancePct}%` : 'No assessment' },
            { label: 'Latest WP security score', value: snap.latestWpScore !== null ? `${snap.latestWpScore}/100` : 'No scan' },
            { label: 'SoA justification coverage', value: snap.soaCompleteness !== null ? `${snap.soaCompleteness}%` : 'No SoA' },
          ]} />
        </PdfSection>

        <PdfSection title="Minutes" tag="clause 9.3.2 inputs">
          {MR_AGENDA_TOPICS.map(topic => (
            <View key={topic} style={styles.topic} wrap={false}>
              <Text style={styles.topicTitle}>{topic}</Text>
              <Text style={styles.topicBody}>
                {(review.minutes[topic] ?? '').trim() || 'Not discussed / not recorded.'}
              </Text>
            </View>
          ))}
        </PdfSection>

        <PdfSection title="Decisions & actions">
          {review.decisions.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: pdfColors.inkSoft }}>No decisions recorded.</Text>
          ) : (
            review.decisions.map((d, i) => (
              <Text key={i} style={{ fontSize: 8.5, marginBottom: 3 }}>
                {i + 1}. {d}
              </Text>
            ))
          )}
        </PdfSection>

        <PdfFooter meta={`Post_Watch · Management review minutes · ${timestamp}`} />
      </Page>
    </Document>
  );
}
