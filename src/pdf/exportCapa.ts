/**
 * Sprint 24: CAPA register PDF download wrapper. Same dynamic-import
 * shape as exportSoa.ts.
 */
import type { Client, Finding } from '../data/types';
import { sortForBoard } from '../utils/findings';

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function exportCapaPdf(args: {
  findings: Finding[];
  clientNameById: Map<string, string>;
  /** When the register is filtered to one client, brands the cover. */
  client?: Client | null;
}): Promise<string> {
  const [{ pdf }, { default: CapaPdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./CapaPdf'),
    import('react'),
  ]);

  const doc = createElement(CapaPdf, {
    findings: sortForBoard(args.findings),
    clientNameById: args.clientNameById,
    clientName: args.client?.name,
    clientLogo: args.client?.logo,
    brand: args.client?.brandColors,
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `PostWatch_CAPA_${safeFilename(args.client?.name ?? 'All')}_${dateStamp}.pdf`;

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
