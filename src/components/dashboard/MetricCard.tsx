interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'mint' | 'violet' | 'ember' | 'neutral';
  glass?: boolean;
  darkBg?: boolean;
}

const accentMap = {
  mint:    { color: '#00D9A3', bg: 'rgba(0,217,163,0.12)',   border: 'rgba(0,217,163,0.25)' },
  violet:  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)' },
  ember:   { color: '#FF4A1C', bg: 'rgba(255,74,28,0.12)',   border: 'rgba(255,74,28,0.25)' },
  neutral: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.2)' },
};

export default function MetricCard({ label, value, sublabel, accent = 'neutral', glass = false, darkBg = false }: MetricCardProps) {
  const ac = accentMap[accent];
  const textColor = darkBg ? '#F8F9FA' : 'var(--color-text-primary)';
  const mutedColor = darkBg ? 'rgba(248,249,250,0.55)' : 'var(--color-text-muted)';

  return (
    <div
      className={glass ? 'glass-card' : 'card-elevated'}
      style={
        glass
          ? { background: ac.bg, border: `1px solid ${ac.border}`, borderRadius: '12px', padding: '20px 24px' }
          : { padding: '20px 24px' }
      }
    >
      {/* Label — 11px uppercase monospace per spec Section 5.5 */}
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent !== 'neutral' ? ac.color : mutedColor,
          marginBottom: '6px',
        }}
      >
        {label}
      </div>

      {/* Value — 28px bold per spec */}
      <div
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: accent !== 'neutral' ? ac.color : textColor,
          fontFamily: 'var(--font-display)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>

      {/* Sublabel — 12px */}
      {sublabel && (
        <div
          style={{
            fontSize: '12px',
            color: mutedColor,
            marginTop: '4px',
            lineHeight: 1.3,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}
