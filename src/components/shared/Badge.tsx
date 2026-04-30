import { motion } from 'framer-motion';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'new' | 'preventive' | 'detective' | 'corrective' | 'green' | 'amber' | 'red' | 'blue';
  small?: boolean;
}

// Use inline styles so they work in both dark and light modes via CSS variables
// rather than Tailwind opacity-tinted classes which only look right on dark.
const variantStyles: Record<string, React.CSSProperties> = {
  default: { background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' },
  new:        { background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)' },
  preventive: { background: 'color-mix(in srgb, var(--color-status-blue) 15%, transparent)', color: 'var(--color-status-blue)' },
  detective:  { background: 'color-mix(in srgb, #a855f7 15%, transparent)', color: '#a855f7' },
  corrective: { background: 'color-mix(in srgb, var(--color-copper) 15%, transparent)', color: 'var(--color-copper)' },
  green:      { background: 'color-mix(in srgb, var(--color-status-green) 15%, transparent)', color: 'var(--color-status-green)' },
  amber:      { background: 'color-mix(in srgb, var(--color-status-amber) 15%, transparent)', color: 'var(--color-status-amber)' },
  red:        { background: 'color-mix(in srgb, var(--color-status-red) 15%, transparent)', color: 'var(--color-status-red)' },
  blue:       { background: 'color-mix(in srgb, var(--color-status-blue) 15%, transparent)', color: 'var(--color-status-blue)' },
};

export default function Badge({ children, variant = 'default', small }: BadgeProps) {
  const style = { ...variantStyles[variant] };
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={style}
      className={`inline-flex items-center rounded-md font-medium font-mono ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}`}
    >
      {children}
    </motion.span>
  );
}
