import { useState, useRef, useEffect } from 'react';
import { Settings, Download, Upload, SlidersHorizontal } from 'lucide-react';
import { exportBackup, importBackup, summariseStorage, detectBackupFormat } from '../../utils/backup';
import { confirmDialog, promptDialog } from '../../utils/dialog';
import { pushToast } from '../../utils/toastBus';
import SettingsPanel from '../settings/SettingsPanel';

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const summary = summariseStorage();

  // When the modal panel closes, return focus to the cog trigger so keyboard
  // users land back where they started rather than at the document root.
  // Tracks the previous value via a ref so we only fire on the open→close
  // transition (not on initial mount, which would steal focus on first paint).
  const wasSettingsOpen = useRef(false);
  useEffect(() => {
    if (wasSettingsOpen.current && !settingsOpen) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    wasSettingsOpen.current = settingsOpen;
  }, [settingsOpen]);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleExport = async () => {
    try {
      // Offer an optional encryption passphrase. Empty ⇒ plain backup.
      // promptDialog, not window.prompt — sync prompt() is blocked in the
      // Tauri WKWebView and silently returns null in production.
      const pass = await promptDialog(
        'Optional: enter a passphrase to encrypt the backup file.\n\nLeave blank for an unencrypted (human-readable) backup.',
        { title: 'Export backup', mask: true, okLabel: 'Export', placeholder: 'Passphrase (optional)' },
      );
      // null === cancel
      if (pass === null) { setOpen(false); return; }
      await exportBackup(pass ? { passphrase: pass } : {});
      pushToast('success', pass ? 'Encrypted backup downloaded' : 'Backup downloaded');
    } catch (e) {
      pushToast('error', (e as Error).message);
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

    // Tauri-aware async confirm — window.confirm returns false synchronously
    // inside the Tauri WKWebView, which would silently skip every import.
    const ok = await confirmDialog(
      'Importing will overwrite any existing projects, cheatsheets and settings with matching keys. Continue?',
      { title: 'Import backup', okLabel: 'Import', kind: 'warning' },
    );
    if (!ok) return;

    try {
      // Sniff format first so we can prompt for a passphrase when needed,
      // rather than letting importBackup throw and forcing the user to
      // re-select the file.
      const fmt = await detectBackupFormat(file);
      let passphrase: string | undefined;
      if (fmt === 'encrypted') {
        const p = await promptDialog(
          'This backup is encrypted. Enter the passphrase to decrypt:',
          { title: 'Import backup', mask: true, okLabel: 'Decrypt' },
        );
        if (p === null) return; // user cancelled
        passphrase = p;
      }
      const result = await importBackup(file, passphrase);
      pushToast(
        'success',
        `Imported ${result.imported} item${result.imported === 1 ? '' : 's'}${
          result.replaced > 0 ? ` (${result.replaced} replaced)` : ''
        }. Reloading…`,
      );
      setOpen(false);
      // Give the toast a beat to flash, then reload so hooks re-read localStorage
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      pushToast('error', (e as Error).message);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="icon-btn"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Settings className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-card-hover overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            // Above .topbar's z:30 stacking context — the topbar lifts to render
            // over .page metric tiles, this dropdown rides above the topbar.
            zIndex: 60,
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
    </div>
  );
}
