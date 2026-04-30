import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { AuditReport } from '../data/auditTypes';
import type { GapAnalysisSession } from '../data/types';

/*
 * Single entry point for triggering a PDF download. All callers go through
 * here so `@react-pdf/renderer` (~500 kB) only enters the bundle when the
 * user actually clicks Download — every other tab stays lean.
 *
 * Tauri v2 note: @react-pdf generates a Blob client-side, which we hand to
 * an <a download> click. WKWebView handles this reliably — unlike
 * `window.print()`, which is what broke in the V2.1 UAT.
 */

type ReportKind = 'wp-security' | 'compliance' | 'executive-summary';

interface GenerateArgs {
  kind: ReportKind;
  report?: AuditReport | null;
  session?: GapAnalysisSession | null;
  clientName?: string;
  clientLogo?: string;
}

/**
 * Sanitise a string for use in a filename. Keeps alphanumerics, replaces
 * everything else with `_`. Prevents any path-traversal or reserved-char
 * issues in Windows/macOS/Linux file systems.
 */
function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Generate a PDF blob and trigger a browser/OS download.
 *
 * Returns the filename used, so callers can surface it in a toast/log. Throws
 * if the required source data is missing — callers should keep the button
 * disabled until the relevant data exists to avoid hitting that path.
 */
export async function downloadReportPdf(args: GenerateArgs): Promise<string> {
  // Dynamic import pulls the renderer and templates into a separate chunk.
  // Vite/Rolldown splits per-import — everything inside the closures becomes
  // `pdf-<hash>.js` and is only fetched on first Download click.
  const [{ pdf }, { default: WpSecurityPdf }, { default: CompliancePdf }, { default: ExecutiveSummaryPdf }] =
    await Promise.all([
      import('@react-pdf/renderer'),
      import('./WpSecurityPdf'),
      import('./CompliancePdf'),
      import('./ExecutiveSummaryPdf'),
    ]);

  // `pdf()` expects a ReactElement whose props extend DocumentProps — the
  // <Document> root is what satisfies that constraint in each template.
  let doc: ReactElement<DocumentProps>;
  let filename: string;
  const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  switch (args.kind) {
    case 'wp-security': {
      if (!args.report) throw new Error('WP Security PDF requires a scan report');
      doc = <WpSecurityPdf report={args.report} clientName={args.clientName} />;
      filename = `PostWatch_WP_${safeFilename(args.report.domain)}_${dateStamp}.pdf`;
      break;
    }
    case 'compliance': {
      if (!args.session) throw new Error('Compliance PDF requires a gap analysis session');
      doc = <CompliancePdf session={args.session} clientName={args.clientName} clientLogo={args.clientLogo} />;
      filename = `PostWatch_Compliance_${safeFilename(args.session.name)}_${dateStamp}.pdf`;
      break;
    }
    case 'executive-summary': {
      doc = (
        <ExecutiveSummaryPdf
          report={args.report ?? null}
          session={args.session ?? null}
          clientName={args.clientName}
          clientLogo={args.clientLogo}
        />
      );
      filename = `PostWatch_Executive_${safeFilename(args.clientName ?? 'Summary')}_${dateStamp}.pdf`;
      break;
    }
  }

  const blob = await pdf(doc).toBlob();

  // Trigger download via a synthetic anchor click. createObjectURL +
  // revoke-after-click is the standard pattern; WKWebView in Tauri v2
  // honours the `download` attribute and routes through the OS save dialog.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
