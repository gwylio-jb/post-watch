/*
 * Trend — sparkline / area chart (Sprint-10 redesign).
 *
 * Single-pass SVG: a polyline path for the stroke, plus the same path
 * closed back along the bottom edge for the gradient fill. Mint→violet
 * gradient on the line, mint area fade. Last point gets an accent dot.
 *
 * Sized via parent — the SVG fills 100% width and renders at 200px tall
 * by default (matched to `.trend svg` in redesign.css).
 *
 * A11y: hidden table of points, referenced via aria-describedby.
 */

import { useId } from 'react';

export interface TrendPoint {
  /** Display label for the x-axis tick (e.g. "12 Mar"). */
  date: string;
  /** Y-axis value, 0–100 by default. */
  score: number;
}

interface TrendProps {
  data: TrendPoint[];
  /** Y-axis cap. Defaults to 100 — works for posture / scan scores. */
  max?: number;
  /** Y-axis floor. Defaults to 0. */
  min?: number;
  /** Hide x-axis date labels — useful in tight cards. */
  hideAxis?: boolean;
}

export default function Trend({ data, max = 100, min = 0, hideAxis = false }: TrendProps) {
  const tableId = useId();
  const gradFillId = `trendFill-${tableId.replace(/:/g, '')}`;
  const gradLineId = `trendLine-${tableId.replace(/:/g, '')}`;

  const w = 700, h = 200, pad = 28;
  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="No trend data">
        <text x={w / 2} y={h / 2} textAnchor="middle" fill="var(--ink-3)" fontSize="12" fontFamily="var(--font-redesign-mono)">
          // no data yet
        </text>
      </svg>
    );
  }

  // Single-point edge case — render just the dot, centred.
  const xs = (i: number) => data.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (data.length - 1);
  const ys = (v: number) => pad + ((max - v) * (h - pad * 2)) / (max - min);

  const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(p.score)}`).join(' ');
  const fill = data.length > 1
    ? `${path} L ${xs(data.length - 1)} ${h - pad} L ${xs(0)} ${h - pad} Z`
    : '';

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-describedby={tableId}>
        <defs>
          <linearGradient id={gradFillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#00D9A3" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#00D9A3" stopOpacity="0"    />
          </linearGradient>
          <linearGradient id={gradLineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#00D9A3" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>

        {/* Reference grid */}
        {[25, 50, 75].map(v => (
          <line key={v} x1={pad} x2={w - pad} y1={ys(v)} y2={ys(v)}
            stroke="var(--line)" strokeDasharray="3 5" />
        ))}

        {fill && <path d={fill} fill={`url(#${gradFillId})`} />}
        <path d={path} fill="none" stroke={`url(#${gradLineId})`}
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((p, i) => (
          <circle key={i} cx={xs(i)} cy={ys(p.score)} r="5"
            fill="var(--bg-2)" stroke={`url(#${gradLineId})`} strokeWidth="2.5" />
        ))}

        {!hideAxis && data.map((p, i) => (
          <text key={`l${i}`} x={xs(i)} y={h - 8} fontSize="10"
            fill="var(--ink-3)" textAnchor="middle"
            fontFamily="var(--font-redesign-mono)">{p.date}</text>
        ))}
      </svg>

      <table id={tableId} className="sr-only">
        <caption>Trend chart values over time</caption>
        <thead><tr><th>Date</th><th>Score</th></tr></thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={i}><td>{p.date}</td><td>{p.score}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
