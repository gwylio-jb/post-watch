import { useState, useRef, useEffect } from 'react';
import { Settings, Download, Upload, CheckCircle2, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { exportBackup, importBackup, summariseStorage } from '../../utils/backup';
import SettingsPanel from '../settings/SettingsPanel';

type Toast = { kind: 'success' | 'error'; message: string } | null;

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const summary = summariseStorage();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleExport = () => {
    try {
      exportBackup();
      setToast({ kind: 'success', message: 'Backup downloaded' });
    } catch (e) {
      setToast({ kind: 'error', message: (e as Error).message });
    }
    setOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be chosen again
    if (!file) return;

    const ok = confirm(
      'Importing will overwrite any existing projects, cheatsheets and settings with matching keys. Continue?'
    );
    if (!ok) return;

    try {
      const result = await importBackup(file);
      setToast({
        kind: 'success',
        message: `Imported ${result.imported} item${result.imported === 1 ? '' : 's'}${
          result.replaced > 0 ? ` (${result.replaced} replaced)` : ''
        }. Reloading…`,
      });
      setOpen(false);
      // Give the toast a beat to flash, then reload so hooks re-read localStorage
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setToast({ kind: 'error', message: (e as Error).message });
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary transition-all hover:shadow-card"
        style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        aria-label="Settings"
        aria-expanded={open}
      >
        <Settings className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-card-hover overflow-hidden z-20"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="font-display font-bold text-sm text-text-primary">Data & Backup</div>
            <div className="text-[10px] text-text-muted mt-0.5">
              {summary.keys} item{summary.keys === 1 ? '' : 's'} · {(summary.bytes / 1024).toFixed(1)} KB stored locally
            </div>
          </div>

          <button
            onClick={() => { setSettingsOpen(true); setOpen(false); }}
            className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-surface-alt transition-colors"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'var(--gradient-accent)' }}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary">Integrations & AI</div>
              <div className="text-[10px] text-text-muted">Scanner API keys + local AI model</div>
            </div>
          </button>

          <button
            onClick={handleExport}
            className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-surface-alt transition-colors border-t border-border"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'var(--gradient-info)' }}
            >
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary">Export backup</div>
              <div className="text-[10px] text-text-muted">Download all data as JSON</div>
            </div>
          </button>

          <button
            onClick={handleImportClick}
            className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-surface-alt transition-colors border-t border-border"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'var(--gradient-warning)' }}
            >
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-primary">Import backup</div>
              <div className="text-[10px] text-text-muted">Restore from a JSON file</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChosen}
            className="hidden"
          />
        </div>
      )}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card-hover max-w-sm"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-status-green flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-status-red flex-shrink-0" />
          )}
          <span className="text-xs text-text-primary">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
