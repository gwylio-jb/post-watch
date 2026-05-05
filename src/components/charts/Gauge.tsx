/*
 * Gauge — chunky circular progress (Sprint-10 redesign).
 *
 * Hero score on the dashboard + scan-results page. Two stacked
 * `<circle>`s: a flat track, then a gradient fill whose dasharray is
 * sized to the score's share of 100. Caller composes the centre label
 * (number, /100, delta pill) outside the SVG.
 *
 * Tone: by default mint→violet (good). Pass `tone="bad"` to flip the
 * gradient to ember→violet for a sub-50 score. The gradient stops are
 * locked to brand hex values so they render identically across themes.
 */

import { useId } from 'react';

interface GaugeProps {
  /** 0–100 score. Clamped at the boundaries. */
  score: number;
  /** Visual tone — default 'good' (mint→violet). 'bad' flips to ember→violet. */
  tone?: 'good' | 'bad';
}

export default function Gauge({ score, tone = 'good' }: GaugeProps) {
  const id = useId();
  const gradId = `gauge-${id.replace(/:/g, '')}`;

  const clamped = Math.max(0, Math.min(100, score));
  const r = 116;
  const C = 2 * Math.PI * r;
  const fill = (clamped / 100) * C;

  const stops = tone === 'good'
    ? [
        { offset: '0%',   color: '#00D9A3' }, // mint
        { offset: '60%',  color: '#A78BFA' }, // violet-2
        { offset: '100%', color: '#FF8C5A' }, // ember-2
      ]
    : [
        { offset: '0%',   color: '#FF4A1C' },
        { offset: '60%',  color: '#A78BFA' },
        { offset: '100%', color: '#00D9A3' },
      ];

  return (
    <svg viewBox="0 0 280 280" role="img" aria-label={`Score ${clamped} out of 100`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          {stops.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      </defs>
      <circle className="gauge-track" cx="140" cy="140" r={r} />
      <circle
        className="gauge-fill"
        cx="140" cy="140" r={r}
        stroke={`url(#${gradId})`}
        strokeDasharray={`${fill} ${C - fill}`}
        strokeDashoffset="0"
      />
    </svg>
  );
}
