/**
 * Sprint 23: SoA PDF download wrapper.
 *
 * Separate from generate.tsx's downloadReportPdf switch on purpose —
 * that module's GenerateArgs shape is report/session-centric and the
 * SoA export needs neither. Same dynamic-import discipline though:
 * @react-pdf only enters the bundle when the user clicks Download.
 */
import type { Client, SoaEntry } from '../data/types';

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function exportSoaPdf(client: Client | null, entries: SoaEntry[]): Promise<string> {
  const [{ pdf }, { default: SoaPdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./SoaPdf'),
    import('react'),
  ]);

  const doc = createElement(SoaPdf, {
    entries,
    clientName: client?.name,
    clientLogo: client?.logo,
    brand: client?.brandColors,
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `PostWatch_SoA_${safeFilename(client?.name ?? 'Unassigned')}_${dateStamp}.pdf`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
