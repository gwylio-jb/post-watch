// Shared design tokens for all PDF templates.
//
// PDFs can't resolve CSS custom properties, so every colour/size/spacing value
// the app's theme tokens express has to be mirrored here as a static value.
// Keep this file in sync with `src/index.css` whenever brand colours change.
//
// @react-pdf/renderer only supports a Flexbox subset (no grid, no inline-block),
// so layout primitives are expressed as px numbers — not rem/em.

export const pdfColors = {
  // Brand
  mint: '#00D9A3',
  mintMuted: '#00B589',
  mintInk: '#007A5E',      // Dark-mint for text on pale backgrounds (WCAG AA)
  mintSubtle: '#E6FAF5',   // Pale mint fill for callout boxes
  mintGlow: '#B5F1DF',     // Even paler mint for corner glows / translucent accents

  // Secondary brand accent — used with mint to create the signature gradient rule
  violet: '#7C3AED',
  violetInk: '#5B21B6',
  violetSubtle: '#EDE4FD',

  // Tertiary brand accent (alert / attention)
  ember: '#F97316',

  // Neutrals (paper-friendly)
  ink: '#1A2332',          // Primary body text on white
  inkSoft: '#5A6E87',      // Secondary/meta text
  border: '#DDE3EC',       // Card/divider lines
  surfaceAlt: '#F0F4F8',   // Evidence block fill
  paper: '#FFFFFF',

  // Severity — kept deliberately high-contrast on white
  critical: '#DC2626',
  high: '#D97706',
  medium: '#1D4ED8',
  low: '#16A34A',
  info: '#64748B',

  // Status
  pass: '#059669',
  fail: '#DC2626',
  warn: '#D97706',
} as const;

// All sizes integers. @react-pdf's yoga layout has accumulated decimal
// fontSizes across many Texts on a single page (e.g. detailed-findings) and
// produced the "unsupported number" NaN sentinel. Integers are safe.
export const pdfFontSizes = {
  display: 32,   // Hero number — e.g. WP score
  h1: 24,
  h2: 14,
  h3: 11,
  body: 10,
  subtitle: 13, // Cover subtitle — larger than body, not quite h2
  small: 8,
  tiny: 7,
} as const;

export const pdfSpacing = {
  // Page margins are set on <Page> via the `padding` prop.
  page: 36,          // ~1.25 cm — leaves room for footer
  section: 18,
  block: 10,
  tight: 4,
} as const;

/**
 * Map a severity label to its print-safe colour.
 * Defaulting to `info` keeps the PDF valid even if a new severity slips
 * through from the scan engine ahead of this table being updated.
 */
export function severityColor(
  sev: string,
): string {
  switch (sev) {
    case 'Critical': return pdfColors.critical;
    case 'High':     return pdfColors.high;
    case 'Medium':   return pdfColors.medium;
    case 'Low':      return pdfColors.low;
    case 'Pass':     return pdfColors.pass;
    default:         return pdfColors.info;
  }
}

/**
 * Human-readable score label + colour, mirroring the on-screen ScoreDial.
 */
export function scoreMeta(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: pdfColors.pass };
  if (score >= 70) return { label: 'Good', color: pdfColors.medium };
  if (score >= 40) return { label: 'Needs Work', color: pdfColors.warn };
  return { label: 'Critical Issues', color: pdfColors.critical };
}

/**
 * Format a Date as "24 April 2026, 14:32 BST" — the full-ISO display the
 * user asked for on every report. Falls back gracefully if Intl's
 * `timeZoneName` option isn't honoured by the runtime.
 */
export function formatFullTimestamp(d: Date): string {
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
  return `${date}, ${time}`;
}
