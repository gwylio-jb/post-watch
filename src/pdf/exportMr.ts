/**
 * Sprint 25: management review minutes PDF wrapper. Same dynamic-import
 * shape as exportSoa/exportCapa.
 */
import type { Client, ManagementReview } from '../data/types';

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function exportMrPdf(client: Client | null, review: ManagementReview): Promise<string> {
  const [{ pdf }, { default: MrPdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./MrPdf'),
    import('react'),
  ]);

  const doc = createElement(MrPdf, { review, clientName: client?.name });
  const filename = `PostWatch_MgmtReview_${safeFilename(client?.name ?? 'Unassigned')}_${review.date}.pdf`;

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
