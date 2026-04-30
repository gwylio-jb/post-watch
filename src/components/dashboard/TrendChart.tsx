import { motion } from 'framer-motion';
import { useState } from 'react';

interface TrendDataPoint {
  date: string;
  score: number;
  domain?: string;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  height?: number;
}

export default function TrendChart({ data, height = 180 }: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, color: 'var(--color-text-muted)', fontSize: '13px', fontFamily: '"JetBrains Mono", monospace' }}
      >
        // No scan data yet
      </div>
    );
  }

  const W = 480;
  const H = height;
  const padX = 32;
  const padY = 20;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const minScore = 0;
  const maxScore = 100;

  const points = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * plotW,
    y: padY + (1 - (d.score - minScore) / (maxScore - minScore)) * plotH,
    score: d.score,
    date: d.date,
    domain: d.domain,
  }));

  // SVG path for the line
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  // SVG path for the filled area
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padY + plotH}` +
    ` L ${points[0].x} ${padY + plotH}` +
    ' Z';

  // Y-axis labels
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={height}
      style={{ overflow: 'visible' }}
      aria-label="WP scan score trend chart"
    >
      <defs>
        <linearGradient id="trend-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00D9A3" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00D9A3" stopOpacity="0" />
        </linearGradient>
        <clipPath id="trend-clip">
          <rect x={padX} y={padY} width={plotW} height={plotH} />
        </clipPath>
      </defs>

      {/* Y-axis grid lines */}
      {yTicks.map(tick => {
        const y = padY + (1 - tick / 100) * plotH;
        return (
          <g key={tick}>
            <line
              x1={padX} y1={y} x2={padX + plotW} y2={y}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              strokeDasharray="3 4"
            />
            <text
              x={padX - 6} y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="var(--color-text-muted)"
              fontFamily='"JetBrains Mono", monospace'
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Area fill (clipped) */}
      <motion.path
        d={areaPath}
        fill="url(#trend-area-gradient)"
        clipPath="url(#trend-clip)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />

      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="#00D9A3"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#trend-clip)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(0 0 4px rgba(0,217,163,0.4))' }}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          {/* Hover hit area */}
          <circle
            cx={p.x} cy={p.y} r={14}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
          {/* Dot */}
          <circle
            cx={p.x} cy={p.y} r={hoveredIndex === i ? 5 : 3.5}
            fill="#00D9A3"
            stroke="var(--color-surface)"
            strokeWidth={2}
            style={{ transition: 'r 0.15s ease', filter: 'drop-shadow(0 0 3px rgba(0,217,163,0.5))' }}
          />

          {/* Tooltip */}
          {hoveredIndex === i && (
            <g>
              <rect
                x={Math.min(p.x - 42, W - 90)} y={p.y - 48}
                width={84} height={38}
                rx={6}
                fill="var(--color-navy)"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
              />
              <text
                x={Math.min(p.x - 42, W - 90) + 42} y={p.y - 31}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="#00D9A3"
                fontFamily='var(--font-display)'
              >
                {p.score}
              </text>
              <text
                x={Math.min(p.x - 42, W - 90) + 42} y={p.y - 16}
                textAnchor="middle"
                fontSize={8}
                fill="rgba(248,249,250,0.6)"
                fontFamily='"JetBrains Mono", monospace'
              >
                {p.date}
              </text>
            </g>
          )}

          {/* X-axis label (first, last, or every other for small sets) */}
          {(i === 0 || i === points.length - 1 || (data.length <= 5)) && (
            <text
              x={p.x} y={padY + plotH + 14}
              textAnchor="middle"
              fontSize={8}
              fill="var(--color-text-muted)"
              fontFamily='"JetBrains Mono", monospace'
            >
              {p.date}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
