import { motion } from 'framer-motion';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface ComplianceRingProps {
  segments: Segment[];
  size?: number;
}

export default function ComplianceRing({ segments, size = 120 }: ComplianceRingProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size, color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', textAlign: 'center' }}
      >
        // No data
      </div>
    );
  }

  const r = 38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = 3; // gap between segments in px

  // Build segment arcs
  let offset = 0; // offset in degrees, starting from top (−90°)
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const arcLen = circumference * pct;
    const startOffset = offset;
    offset += circumference * pct;
    return {
      ...seg,
      arcLen: Math.max(arcLen - gap, 0),
      dashOffset: -(startOffset),
    };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={10}
        />
        {arcs.map((arc, i) => (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={10}
            strokeLinecap="butt"
            strokeDasharray={`${arc.arcLen} ${circumference - arc.arcLen}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: arc.dashOffset }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
            transform={`rotate(-90, ${cx}, ${cy})`}
            style={{ filter: `drop-shadow(0 0 3px ${arc.color}55)` }}
          />
        ))}
        {/* Centre text — largest segment */}
        {segments.length > 0 && (
          <>
            <text
              x={cx} y={cy - 4}
              textAnchor="middle"
              fontSize={16}
              fontWeight={700}
              fill="var(--color-text-primary)"
              fontFamily="var(--font-display)"
            >
              {Math.round((segments[0].value / total) * 100)}%
            </text>
            <text
              x={cx} y={cy + 10}
              textAnchor="middle"
              fontSize={7}
              fill="var(--color-text-muted)"
              fontFamily='"JetBrains Mono", monospace'
            >
              {segments[0].label.toLowerCase()}
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5" style={{ minWidth: 130 }}>
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
