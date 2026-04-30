import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterGroupProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function FilterGroup({ label, options, selected, onChange }: FilterGroupProps) {
  const [open, setOpen] = useState(false);

  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        <span>
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 text-accent">({selected.length})</span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-0.5">
              {options.map(opt => (
                <label
                  key={opt}
                  className="flex items-center gap-2 py-0.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="rounded border-border bg-surface accent-accent w-3.5 h-3.5"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterPanelProps {
  groups: { label: string; options: string[]; selected: string[]; onChange: (s: string[]) => void }[];
  onClearAll: () => void;
  activeCount: number;
}

export default function FilterPanel({ groups, onClearAll, activeCount }: FilterPanelProps) {
  return (
    <div className="bg-surface rounded-lg border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Filters</span>
        {activeCount > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors"
          >
            <X className="w-3 h-3" />
            Clear ({activeCount})
          </button>
        )}
      </div>
      {groups.map(group => (
        <FilterGroup key={group.label} {...group} />
      ))}
    </div>
  );
}
