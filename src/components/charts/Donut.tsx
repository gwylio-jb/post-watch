/*
 * Donut — segmented ring (Sprint-10 redesign).
 *
 * Hand-rolled SVG. Each segment is a `<circle>` with strokeDasharray
 * sized to the segment's share of the total, rotated by the running
 * offset. Track is a single grey circle drawn first.
 *
 * Sized via the wrapping `.donut` class (130×130 by default — see
 * src/styles/redesign.css). Caller composes the centre label / legend
 * outside the SVG.
 *
 * A11y: hidden `<table>` mirroring the segment data, referenced via
 * aria-describedby. Per spec §6 — tone never carries meaning alone.
 */

import { useId } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  /** CSS color string. Use redesign tokens (`var(--mint)` etc.) where possible. */
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  /** Override the inferred total (default: sum of segment values). */
  total?: number;
  /** Override the visual radius (default: 52, fits the .donut 130px box). */
  radius?: number;
  /** Stroke width — default 14. */
  strokeWidth?: number;
}

export default function Donut({ segments, total, radius = 52, strokeWidth = 14 }: DonutProps) {
  const tableId = useId();
  const r = radius;
  const c = 2 * Math.PI * r;
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0) ?? 1;

  // Pre-compute the running offset for each segment instead of mutating a
  // `let off` during render. Render-time reassignment trips React Compiler-
  // aware lint rules (immutability) and would prevent React 19 auto-
  // memoisation from kicking in on this component.
  // segmentOffsets[i] = sum of arc lengths for segments[0..i-1].
  const segmentOffsets = segments.map((_seg, i) => {
    let acc = 0;
    for (let j = 0; j < i; j++) acc += (segments[j].value / sum) * c;
    return acc;
  });

  return (
    <>
      <svg
        viewBox="0 0 130 130"
        className="donut"
        role="img"
        aria-describedby={tableId}
      >
        {/* Track */}
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        {/* Segments */}
        {segments.map((s, i) => {
          const len = (s.value / sum) * c;
          const dash = `${len} ${c - len}`;
          const dashoff = -segmentOffsets[i];
          return (
            <circle
              key={i}
              cx="65" cy="65" r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={dash}
              strokeDashoffset={dashoff}
              transform="rotate(-90 65 65)"
            />
          );
        })}
      </svg>
      {/* Hidden a11y table — same data, screen-reader navigable */}
      <table id={tableId} className="sr-only" aria-hidden={false}>
        <caption>Donut chart segments</caption>
        <thead><tr><th>Label</th><th>Value</th><th>Share</th></tr></thead>
        <tbody>
          {segments.map(s => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.value}</td>
              <td>{Math.round((s.value / sum) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
