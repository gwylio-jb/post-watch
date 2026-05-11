/**
 * CsvImportDialog — generic file-picker → preview → confirm flow.
 *
 * Sprint 13 Pack 2. Shared by ClientsHub and (later) GapAnalysis. The
 * caller provides:
 *   - `parse` — takes the raw text and returns a preview of what would
 *     happen. Lives in the caller because each importer maps the
 *     column-name aliases its target type needs.
 *   - `onConfirm` — called with the parsed rows the user has approved.
 *
 * The dialog itself owns: file picker, drop zone, preview table render,
 * confirm button. No localStorage I/O, no business logic.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface CsvImportDialogProps<TRow> {
  /** Modal title. */
  title: string;
  /** Short instruction line shown below the title. */
  subtitle?: string;
  /** Convert the CSV text into a preview the dialog can render. */
  parse: (text: string) => {
    rows: TRow[];
    errors: { line: number; reason: string }[];
    warnings: string[];
  };
  /** Render a single preview row. The dialog wraps in a table. */
  renderRow: (row: TRow, i: number) => React.ReactNode;
  /** Column headings shown above the preview rows. */
  previewHeaders: string[];
  /** Called with the rows the user confirmed. */
  onConfirm: (rows: TRow[]) => void;
  onClose: () => void;
}

export default function CsvImportDialog<TRow>({
  title, subtitle, parse, renderRow, previewHeaders, onConfirm, onClose,
}: CsvImportDialogProps<TRow>) {
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Escape closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setFileText(text);
    setFileName(file.name);
  };

  const preview = fileText ? parse(fileText) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        className="bubble"
        style={{ width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--line-2)' }}>
          <div>
            <h3 id="csv-import-title" style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700 }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>{subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" style={{ width: 28, height: 28, borderRadius: 8 }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!fileText && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--line-2)', borderRadius: 14,
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                color: 'var(--ink-2)',
              }}
            >
              <Upload className="w-6 h-6" style={{ margin: '0 auto 8px', color: 'var(--mint)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>
                Choose a CSV file
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                First row is the header. Comma or semicolon delimited. ≤ 1000 rows.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {fileText && preview && (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', marginBottom: 10 }}>
                {fileName} · {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} ready
                {preview.errors.length > 0 && ` · ${preview.errors.length} error${preview.errors.length === 1 ? '' : 's'}`}
              </div>

              {preview.warnings.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(217,119,6,0.12)', color: '#D97706', fontSize: 12, marginBottom: 8 }}>
                  <AlertCircle className="w-3.5 h-3.5" /> {w}
                </div>
              ))}

              {preview.errors.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--ember)', fontFamily: 'var(--font-redesign-mono)' }}>
                    {preview.errors.length} rows skipped — show details
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)', maxHeight: 100, overflowY: 'auto' }}>
                    {preview.errors.slice(0, 50).map((e, i) => (
                      <div key={i}>Line {e.line}: {e.reason}</div>
                    ))}
                  </div>
                </details>
              )}

              {preview.rows.length > 0 && (
                <div style={{ borderRadius: 12, border: '1px solid var(--line-2)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-2)' }}>
                        {previewHeaders.map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-redesign-mono)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                          {renderRow(row, i)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 100 && (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', textAlign: 'center', background: 'var(--bg-2)' }}>
                      … {preview.rows.length - 100} more row{preview.rows.length - 100 === 1 ? '' : 's'} not shown
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => { setFileText(null); setFileName(null); }}
                style={{
                  marginTop: 10, fontSize: 11, color: 'var(--ink-3)',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Pick a different file
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--line-2)' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={!preview || preview.rows.length === 0}
            onClick={() => preview && onConfirm(preview.rows)}
          >
            <CheckCircle2 className="w-4 h-4" />
            Import {preview ? preview.rows.length : 0}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

