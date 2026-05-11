/**
 * ScheduleDialog — small modal for creating a recurring scan schedule.
 *
 * Pack 2 of Sprint 13. The user picks one of three cadences (weekly /
 * monthly / interval), a time-of-day, and an optional alert threshold
 * (post-watch raises an alert if a future scan score drops by ≥ this
 * many points vs the most recent).
 *
 * Pure presentation — the actual `Schedule` object is constructed in the
 * caller via the `onSave` callback. The dialog never touches localStorage
 * itself; that contract lives in `useScanScheduler`.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, CheckCircle2 } from 'lucide-react';
import type { SchedulerCadence } from '../../data/types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ScheduleDialogProps {
  /** Domain the schedule is for. Pre-filled, not editable here. */
  domain: string;
  /** Optional initial cadence — currently only used for "edit" flows
   *  (Sprint 14 may add inline editing of an existing schedule). */
  initial?: { cadence: SchedulerCadence; alertOnDrop?: number };
  onSave: (cadence: SchedulerCadence, alertOnDrop: number | undefined) => void;
  onClose: () => void;
}

type CadenceKind = SchedulerCadence['kind'];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleDialog({ domain, initial, onSave, onClose }: ScheduleDialogProps) {
  const [kind, setKind] = useState<CadenceKind>(initial?.cadence.kind ?? 'weekly');
  // Sub-state per cadence kind — kept as separate fields so switching
  // back-and-forth doesn't lose user input.
  const [weekday, setWeekday] = useState<number>(initial?.cadence.kind === 'weekly' ? initial.cadence.weekday : 1);
  const [monthlyDay, setMonthlyDay] = useState<number>(initial?.cadence.kind === 'monthly' ? initial.cadence.day : 1);
  const [hour, setHour] = useState<number>(
    initial?.cadence.kind === 'weekly' || initial?.cadence.kind === 'monthly'
      ? initial.cadence.hour : 6
  );
  const [intervalDays, setIntervalDays] = useState<number>(
    initial?.cadence.kind === 'interval' ? initial.cadence.days : 7
  );
  const [alertOnDrop, setAlertOnDrop] = useState<string>(
    initial?.alertOnDrop != null ? String(initial.alertOnDrop) : '5'
  );
  const [alertEnabled, setAlertEnabled] = useState<boolean>(initial?.alertOnDrop != null);

  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Escape closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function handleSave() {
    const cadence: SchedulerCadence =
        kind === 'weekly'   ? { kind: 'weekly',   weekday: weekday as 0|1|2|3|4|5|6, hour }
      : kind === 'monthly'  ? { kind: 'monthly',  day: monthlyDay, hour }
      : { kind: 'interval', days: intervalDays };
    const drop = alertEnabled ? parseInt(alertOnDrop, 10) : undefined;
    onSave(cadence, Number.isFinite(drop) ? drop : undefined);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10,
    border: '1px solid var(--line-2)', background: 'var(--bg-2)',
    color: 'var(--ink-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
    fontFamily: 'var(--font-redesign-mono)', marginBottom: 6,
  };

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
        aria-labelledby="schedule-dialog-title"
        className="bubble"
        style={{ width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar className="w-4 h-4" style={{ color: 'var(--mint)' }} />
            <h3 id="schedule-dialog-title" style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700 }}>
              Schedule re-scan
            </h3>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" style={{ width: 28, height: 28, borderRadius: 8 }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-redesign-mono)' }}>
          Domain: <strong style={{ color: 'var(--ink-1)' }}>{domain}</strong>
        </div>

        {/* Cadence picker */}
        <div>
          <label style={labelStyle}>Cadence</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['weekly', 'monthly', 'interval'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 10,
                  background: kind === k ? 'rgba(0,217,163,0.16)' : 'transparent',
                  border: `1px solid ${kind === k ? 'rgba(0,217,163,0.40)' : 'var(--line-2)'}`,
                  color: kind === k ? 'var(--mint)' : 'var(--ink-2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Cadence detail per kind */}
        {kind === 'weekly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Day of week</label>
              <select style={inputStyle} value={weekday} onChange={e => setWeekday(parseInt(e.target.value, 10))}>
                {WEEKDAY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Hour (local)</label>
              <select style={inputStyle} value={hour} onChange={e => setHour(parseInt(e.target.value, 10))}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {kind === 'monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Day of month</label>
              <select style={inputStyle} value={monthlyDay} onChange={e => setMonthlyDay(parseInt(e.target.value, 10))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Hour (local)</label>
              <select style={inputStyle} value={hour} onChange={e => setHour(parseInt(e.target.value, 10))}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {kind === 'interval' && (
          <div>
            <label style={labelStyle}>Every</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" min={1} max={365}
                value={intervalDays}
                onChange={e => setIntervalDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>days since last scan</span>
            </div>
          </div>
        )}

        {/* Drop alert */}
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={e => setAlertEnabled(e.target.checked)}
              style={{ accentColor: 'var(--mint)', cursor: 'pointer' }}
            />
            Alert me if the score drops
          </label>
          {alertEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>by</span>
              <input
                type="number" min={1} max={100}
                value={alertOnDrop}
                onChange={e => setAlertOnDrop(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>or more points</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
            <CheckCircle2 className="w-4 h-4" />
            Save schedule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
