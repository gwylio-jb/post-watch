import { Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { pdfColors, pdfFontSizes, pdfSpacing } from './theme';

/*
 * Reusable PDF layout primitives.
 *
 * @react-pdf/renderer ships its own React reconciler — we cannot use HTML tags
 * or CSS classes from the web app. Every visual primitive here is built from
 * <View>, <Text>, and <Image>, styled with inline StyleSheet objects.
 *
 * Sprint 6 brand signatures (carried through every template):
 *   - `// <name>` mono tag above section titles — mirrors the in-app monospace motif
 *   - 2pt mint→violet gradient rule (simulated with two adjacent Views)
 *   - Corner mint glow accent on the cover page
 *   - "powered by gwylio" footer badge on every page
 *
 * All colours/sizes pull from `./theme` so a single change propagates across
 * every template.
 */

// ── Mono tag ("// wp security") ─────────────────────────────────────────────
/**
 * Signature monospace label that echoes the in-app `.mono-tag` class.
 * Used as a kicker above section titles and on the cover.
 */
export function PdfMonoTag({ label, color }: { label: string; color?: string }) {
  return (
    <Text style={{
      fontSize: pdfFontSizes.tiny,
      fontFamily: 'Courier',
      color: color ?? pdfColors.mintInk,
      letterSpacing: 1.2,
      marginBottom: 3,
    }}>
      {`// ${label.toLowerCase()}`}
    </Text>
  );
}

// ── Gradient rule (mint → violet) ───────────────────────────────────────────
/**
 * Signature 2-tone divider. @react-pdf has no linear-gradient support, so we
 * fake it with two adjacent View blocks — crisp in print, zero-cost.
 */
export function PdfGradientRule({ height = 2, marginBottom = 14 }: { height?: number; marginBottom?: number }) {
  return (
    <View style={{ flexDirection: 'row', height, marginBottom }}>
      <View style={{ flex: 3, backgroundColor: pdfColors.mint }} />
      <View style={{ flex: 2, backgroundColor: pdfColors.mintMuted }} />
      <View style={{ flex: 2, backgroundColor: pdfColors.violet }} />
    </View>
  );
}

// ── Corner glow (decorative) ────────────────────────────────────────────────
/**
 * Subtle pale-mint square pinned to a page corner. Zero-content decorative
 * accent — read as a "brand stamp" without competing with body text.
 */
export function PdfCornerGlow({
  corner = 'top-right',
  size = 180,
  color,
}: {
  corner?: 'top-right' | 'bottom-left';
  size?: number;
  color?: string;
}) {
  // Keep entirely within the parent bounds (no negative offsets) — negative
  // positions combined with opacity have tripped yoga's layout pass on some
  // documents, producing "unsupported number" layout errors.
  const r = Math.round(size / 2);
  const base: Record<string, number | string> = {
    position: 'absolute',
    width: size,
    height: size,
    backgroundColor: color ?? pdfColors.mintGlow,
    borderRadius: r,
  };
  if (corner === 'top-right') {
    base.top = -r;
    base.right = -r;
  } else {
    base.bottom = -r;
    base.left = -r;
  }
  return <View style={base} />;
}

// ── Footer ───────────────────────────────────────────────────────────────────
/**
 * Fixed footer rendered on every page via `fixed` prop. Shows attribution,
 * domain/confidentiality line, and auto page numbering. The `render` callback
 * gives us pageNumber / totalPages which aren't available at mount time.
 */
export function PdfFooter({ meta }: { meta: string }) {
  return (
    <View fixed style={footerStyles.wrap}>
      <View style={footerStyles.leftGroup}>
        <View style={footerStyles.brandDot} />
        <Text style={footerStyles.left}>Post_Watch · powered by gwylio</Text>
      </View>
      <Text style={footerStyles.center}>{meta}</Text>
      <Text
        style={footerStyles.right}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

const footerStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 18,
    left: pdfSpacing.page,
    right: pdfSpacing.page,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.inkSoft,
    borderTop: `0.5px solid ${pdfColors.border}`,
    paddingTop: 6,
  },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: pdfColors.mint },
  left:   { color: pdfColors.mintInk, fontFamily: 'Courier', letterSpacing: 0.6 },
  center: { color: pdfColors.inkSoft },
  right:  { color: pdfColors.inkSoft, fontFamily: 'Courier' },
});

// ── Header strip (non-cover pages) ──────────────────────────────────────────
export function PdfHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View fixed style={headerStyles.wrap}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={headerStyles.dot} />
        <Text style={headerStyles.title}>{title}</Text>
      </View>
      {right && <Text style={headerStyles.right}>{right}</Text>}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 14,
    borderBottom: `2px solid ${pdfColors.mint}`,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: pdfColors.mint },
  title: {
    fontSize: pdfFontSizes.h3,
    fontWeight: 700,
    color: pdfColors.ink,
  },
  right: {
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.inkSoft,
    fontFamily: 'Courier',
    letterSpacing: 0.8,
  },
});

// ── Section heading ─────────────────────────────────────────────────────────
export function PdfSection({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <View style={sectionStyles.wrap} wrap>
      <View style={sectionStyles.header}>
        {tag && <PdfMonoTag label={tag} />}
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: pdfSpacing.section },
  header: {
    marginBottom: 10,
    paddingBottom: 5,
    borderBottom: `1px solid ${pdfColors.border}`,
  },
  title: {
    fontSize: pdfFontSizes.h2,
    fontWeight: 700,
    color: pdfColors.ink,
  },
});

// ── Severity / status pill ──────────────────────────────────────────────────
export function PdfPill({ label, color, inverted }: { label: string; color: string; inverted?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: inverted ? color : mix(color, 15),
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderLeft: inverted ? undefined : `2px solid ${color}`,
      }}
    >
      <Text style={{ fontSize: pdfFontSizes.tiny, fontWeight: 700, color: inverted ? '#FFFFFF' : color, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Callout box (for explainer blocks) ──────────────────────────────────────
// Sprint 6 note: an earlier rewrite used `fontFamily: 'Courier' + letterSpacing`
// on the kicker. That combination — applied to many small Texts in a single
// page — caused @react-pdf's yoga layout to throw "unsupported number" during
// width measurement. Reverting to Helvetica-uppercase keeps the kicker visually
// strong (bold + colour + letter-spacing) without tripping yoga.
export function PdfCallout({ title, body, accent }: { title: string; body: string; accent?: string }) {
  const color = accent ?? pdfColors.mintInk;
  return (
    <View style={{
      backgroundColor: pdfColors.surfaceAlt,
      borderLeft: `3px solid ${color}`,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginBottom: 4,
      borderRadius: 2,
    }}>
      <Text style={{ fontSize: pdfFontSizes.tiny, color, fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>
        {title.toUpperCase()}
      </Text>
      <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, lineHeight: 1.45 }}>{body}</Text>
    </View>
  );
}

// ── Key/value metadata row ──────────────────────────────────────────────────
export function PdfMeta({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View style={{ marginBottom: pdfSpacing.block }}>
      {rows.map(r => (
        <View key={r.label} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.inkSoft, width: 100, fontFamily: 'Courier', letterSpacing: 0.4 }}>{r.label}</Text>
          <Text style={{ fontSize: pdfFontSizes.small, color: pdfColors.ink, flex: 1 }}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Cover block (logo + titles + score) ─────────────────────────────────────
export function PdfCover({
  clientLogo,
  clientName,
  documentType,
  title,
  subtitle,
  scoreBlock,
  timestamp,
}: {
  clientLogo?: string;
  clientName?: string;
  documentType: string;
  title: string;
  subtitle?: string;
  scoreBlock?: ReactNode;
  timestamp: string;
}) {
  // Strip a leading "// " if the caller passed it — we now render the tag
  // ourselves via PdfMonoTag for consistent styling.
  const cleanDocType = documentType.replace(/^\/\/\s*/, '');

  return (
    <View style={coverStyles.wrap}>
      <PdfCornerGlow corner="top-right" size={220} />

      {/* Top row: mono tag + client + brand */}
      <View style={coverStyles.topRow}>
        <View style={{ flex: 1 }}>
          <PdfMonoTag label={cleanDocType} />
          <Text style={coverStyles.clientName}>{clientName ?? 'Unassigned'}</Text>
        </View>
        <View style={coverStyles.brandColumn}>
          {clientLogo ? (
            <Image src={clientLogo} style={coverStyles.logo} />
          ) : (
            <View style={coverStyles.logoPlaceholder}>
              <Text style={coverStyles.logoPlaceholderText}>{(clientName ?? 'C').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={coverStyles.brand}>Post_Watch</Text>
          <Text style={coverStyles.brandSub}>by gwylio</Text>
        </View>
      </View>

      <PdfGradientRule height={3} marginBottom={18} />

      {/* Title block */}
      <Text style={coverStyles.title}>{title}</Text>
      {subtitle && <Text style={coverStyles.subtitle}>{subtitle}</Text>}
      <Text style={coverStyles.timestamp}>{`// generated ${timestamp}`}</Text>

      {scoreBlock}

      <View style={coverStyles.confidentiality}>
        <Text style={coverStyles.confidentialityKicker}>// confidential</Text>
        <Text style={coverStyles.confidentialityText}>
          This document is prepared for {clientName ?? 'the client'} and may contain information about
          security vulnerabilities. Redistribute only to authorised personnel.
        </Text>
      </View>
    </View>
  );
}

const coverStyles = StyleSheet.create({
  wrap: {
    marginBottom: pdfSpacing.section,
    position: 'relative',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  brandColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
    marginBottom: 4,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: pdfColors.mintSubtle,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: `3px solid ${pdfColors.mint}`,
    marginBottom: 4,
  },
  logoPlaceholderText: {
    fontSize: 22,
    fontWeight: 700,
    color: pdfColors.mintInk,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 700,
    color: pdfColors.ink,
    marginTop: 2,
  },
  brand: {
    fontSize: pdfFontSizes.h3,
    fontWeight: 700,
    color: pdfColors.ink,
  },
  brandSub: {
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.mintInk,
    fontFamily: 'Courier',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: pdfFontSizes.h1,
    fontWeight: 700,
    color: pdfColors.ink,
    marginBottom: 6,
    lineHeight: 1.15,
  },
  subtitle: {
    fontSize: pdfFontSizes.subtitle,
    color: pdfColors.ink,
    marginBottom: 6,
    lineHeight: 1.35,
  },
  timestamp: {
    fontSize: pdfFontSizes.small,
    color: pdfColors.inkSoft,
    fontFamily: 'Courier',
    letterSpacing: 0.6,
    marginBottom: pdfSpacing.section,
  },
  confidentiality: {
    marginTop: pdfSpacing.section,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: pdfColors.mintSubtle,
    borderLeft: `3px solid ${pdfColors.mintInk}`,
    borderRadius: 2,
  },
  confidentialityKicker: {
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.mintInk,
    fontFamily: 'Courier',
    letterSpacing: 1,
    marginBottom: 2,
  },
  confidentialityText: {
    fontSize: pdfFontSizes.tiny,
    color: pdfColors.ink,
    lineHeight: 1.45,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Blend a hex colour with white at the given percentage (0-100).
 * Used to build translucent-looking pill backgrounds — @react-pdf doesn't
 * support `color-mix()` or rgba in all shorthand forms cleanly.
 */
function mix(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const alpha = pct / 100;
  const blend = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}
