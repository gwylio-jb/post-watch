/**
 * Sprint 22: shared form field wrapper — label + control + inline error.
 *
 * The error only renders once the field has been touched (caller decides
 * when that is, typically onBlur or on first submit attempt) so a fresh
 * form isn't a wall of red.
 *
 * ClientsHub had a private `Field` with the label/required part of this;
 * this is the shared version with error display for new v3.0 forms.
 */
import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  /** Inline validation message. Render only when the field is touched. */
  error?: string | null;
  /** Muted helper line below the control (hidden while an error shows). */
  hint?: string;
  children: ReactNode;
}

export default function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'var(--font-redesign-mono)',
      }}>
        {label}
        {required && <span style={{ color: 'var(--ember)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" style={{ fontSize: 11, color: 'var(--ember)' }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</span>
      ) : null}
    </label>
  );
}
