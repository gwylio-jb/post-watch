/**
 * Post_Watch brand components (V2.0)
 *
 * Wordmark rules per design spec:
 * - Font: JetBrains Mono (monospace fallback)
 * - "Post" — full opacity navy (dark) or cloud (on dark bg)
 * - "_"    — always Mint #00D9A3
 * - "Watch" — 50% opacity
 * - Attribution: "// by gwylio" in 11px mono, muted
 *
 * Usage in app UI: always rendered in code (never image).
 * Gwylio image assets (public/gwylio-*.png) are reserved for print reports.
 */

interface LogoWordmarkProps {
  /** 'dark' = white text for dark sidebar/navy bg; 'light' = navy text for light bg */
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showAttribution?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { wordmark: '14px', attribution: '9px' },
  md: { wordmark: '17px', attribution: '10px' },
  lg: { wordmark: '22px', attribution: '12px' },
};

/** Full Post_Watch wordmark with optional "// by gwylio" attribution line. */
export function LogoWordmark({
  variant = 'dark',
  size = 'md',
  showAttribution = true,
  className = '',
}: LogoWordmarkProps) {
  const { wordmark, attribution } = sizeMap[size];
  const baseColor = variant === 'dark' ? '#F8F9FA' : '#1A2332';

  return (
    <div className={`flex flex-col ${className}`} style={{ gap: '2px' }}>
      <span
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: wordmark,
          fontWeight: 500,
          color: baseColor,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        Post
        <span style={{ color: '#00D9A3' }}>_</span>
        <span style={{ opacity: 0.5 }}>Watch</span>
      </span>

      {showAttribution && (
        <span
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: attribution,
            color: '#9CA3AF',
            lineHeight: 1,
            letterSpacing: '0.02em',
            userSelect: 'none',
          }}
        >
          // by gwylio
        </span>
      )}
    </div>
  );
}

/** Compact P_ mark for collapsed sidebar or tight spaces. */
export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: size * 0.58,
        fontWeight: 600,
        color: '#F8F9FA',
        letterSpacing: '-0.04em',
        lineHeight: 1,
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: 'rgba(0,217,163,0.15)',
        borderRadius: '8px',
        border: '1px solid rgba(0,217,163,0.25)',
      }}
    >
      P<span style={{ color: '#00D9A3' }}>_</span>
    </span>
  );
}

/**
 * Legacy aliases — kept so any existing imports of LogoIcon / LogoFull
 * don't break while components are being migrated.
 */
export function LogoIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <LogoMark size={size} className={className} />;
}

export function LogoFull({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <LogoWordmark
      variant="light"
      size={size >= 20 ? 'md' : 'sm'}
      showAttribution={false}
      className={className}
    />
  );
}
