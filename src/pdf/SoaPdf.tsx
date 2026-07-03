import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SoaEntry, ImplementationStatus } from '../data/types';
import { allControls } from '../data/controls';
import { pdfColors, pdfFontSizes, pdfSpacing, formatFullTimestamp } from './theme';
import { PdfCover, PdfFooter, PdfHeader, PdfSection, PdfMeta } from './primitives';

/*
 * Statement of Applicability (Sprint 23, v3.0 pillar #1).
 *
 * The auditor handoff artifact: one row per Annex A control, grouped by
 * the four 2022 themes — applicability, justification, implementation
 * status. Cover carries the summary stats; each theme gets its own
 * section with a compact table.
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
  row: {
    flexDirection: 'row',
    borderBottom: `1px solid ${pdfColors.border}`,
    paddingVertical: 5,
    gap: 6,
  },
  headRow: {
    flexDirection: 'row',
    borderBottom: `2px solid ${pdfColors.border}`,
    paddingVertical: 4,
    gap: 6,
  },
  colId:     { width: 42, fontFamily: 'Courier', fontSize: 8 },
  colTitle:  { width: 120, fontSize: 8 },
  colApp:    { width: 34, fontSize: 8 },
  colStatus: { width: 62, fontSize: 8 },
  colJust:   { flex: 1, fontSize: 8, color: pdfColors.inkSoft },
  headText:  { fontSize: 7, color: pdfColors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const THEMES = ['Organisational', 'People', 'Physical', 'Technological'] as const;

const implColor = (s: ImplementationStatus): string => {
  switch (s) {
    case 'Verified':
    case 'Implemented': return pdfColors.pass;
    case 'In Progress': return pdfColors.warn;
    default:            return pdfColors.inkSoft;
  }
};

export default function SoaPdf({ entries, clientName, clientLogo, brand }: {
  entries: SoaEntry[];
  clientName?: string;
  clientLogo?: string;
  brand?: { primary: string; secondary: string };
}) {
  const timestamp = formatFullTimestamp(new Date());
  const byId = new Map(entries.map(e => [e.controlId, e]));
  const total = entries.length;
  const applicable = entries.filter(e => e.applicable).length;
  const justified = entries.filter(e => e.justification.trim() !== '').length;
  const implemented = entries.filter(
    e => e.applicable && (e.implementationStatus === 'Implemented' || e.implementationStatus === 'Verified')
  ).length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfCover
          clientLogo={clientLogo}
          clientName={clientName}
          documentType="Statement of Applicability"
          title="Statement of Applicability"
          subtitle="ISO/IEC 27001:2022 Annex A control applicability, justification and implementation status"
          timestamp={timestamp}
          brand={brand}
          scoreBlock={
            <PdfMeta rows={[
              { label: 'Controls assessed', value: String(total) },
              { label: 'Applicable', value: `${applicable} (${total - applicable} excluded)` },
              { label: 'Justification coverage', value: `${total === 0 ? 0 : Math.round((justified / total) * 100)}%` },
              { label: 'Implemented / verified', value: `${implemented} of ${applicable} applicable` },
            ]} />
          }
        />
        <PdfFooter meta={`Post_Watch · Statement of Applicability · ${timestamp}`} />
      </Page>

      {THEMES.map(theme => {
        const rows = allControls
          .filter(c => c.category === theme)
          .map(c => ({ control: c, entry: byId.get(c.id) }))
          .filter((r): r is { control: typeof allControls[number]; entry: SoaEntry } => !!r.entry);
        if (rows.length === 0) return null;
        return (
          <Page key={theme} size="A4" style={styles.page}>
            <PdfHeader title={`Annex A — ${theme}`} right={clientName} />
            <PdfSection title={`${theme} controls`} tag={`${rows.filter(r => r.entry.applicable).length}/${rows.length} applicable`}>
              <View style={styles.headRow}>
                <Text style={[styles.colId, styles.headText]}>ID</Text>
                <Text style={[styles.colTitle, styles.headText]}>Control</Text>
                <Text style={[styles.colApp, styles.headText]}>Appl.</Text>
                <Text style={[styles.colStatus, styles.headText]}>Status</Text>
                <Text style={[styles.colJust, styles.headText]}>Justification</Text>
              </View>
              {rows.map(({ control, entry }) => (
                <View key={control.id} style={styles.row} wrap={false}>
                  <Text style={styles.colId}>{control.id}</Text>
                  <Text style={styles.colTitle}>{control.title}</Text>
                  <Text style={[styles.colApp, { color: entry.applicable ? pdfColors.pass : pdfColors.critical }]}>
                    {entry.applicable ? 'Yes' : 'No'}
                  </Text>
                  <Text style={[styles.colStatus, { color: entry.applicable ? implColor(entry.implementationStatus) : pdfColors.inkSoft }]}>
                    {entry.applicable ? entry.implementationStatus : '—'}
                  </Text>
                  <Text style={styles.colJust}>
                    {entry.justification.trim() || '(no justification recorded)'}
                  </Text>
                </View>
              ))}
            </PdfSection>
            <PdfFooter meta={`Post_Watch · Statement of Applicability · ${timestamp}`} />
          </Page>
        );
      })}
    </Document>
  );
}
