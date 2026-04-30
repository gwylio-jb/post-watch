import { Download, Printer, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ExportButtonProps {
  onExportMarkdown?: () => void;
  onExportHTML?: () => void;
  onPrint?: () => void;
}

export default function ExportButton({ onExportMarkdown, onExportHTML, onPrint }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-border rounded-md hover:border-accent/50 transition-colors text-text-secondary hover:text-accent"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-md shadow-lg z-20 min-w-[160px]">
          {onExportMarkdown && (
            <button
              onClick={() => { onExportMarkdown(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Markdown
            </button>
          )}
          {onExportHTML && (
            <button
              onClick={() => { onExportHTML(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Print HTML
            </button>
          )}
          {onPrint && (
            <button
              onClick={() => { onPrint(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          )}
        </div>
      )}
    </div>
  );
}
