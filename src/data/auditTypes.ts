// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the WordPress Security Audit feature
// ─────────────────────────────────────────────────────────────────────────────

export type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error';

/** Worst-case impact level — drives scoring deductions. */
export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' | 'Pass';

/** Per-check outcome once the check has run. */
export type CheckStatus = 'pass' | 'fail' | 'warning' | 'info' | 'skipped' | 'error';

export type AuditCheckCategory =
  | 'WordPress Core'
  | 'Security Headers'
  | 'TLS / SSL'
  | 'Information Disclosure'
  | 'Authentication'
  | 'DNS & Email Security'
  | 'Dark Web & Reputation'
  | 'File Exposure'
  | 'Configuration';

export interface CheckResult {
  status: CheckStatus;
  /** One-line human-readable summary of what was found. */
  detail: string;
  /** Raw evidence (header value, DNS record, API response snippet, etc.). */
  evidence?: string;
  /** Actionable fix guidance. */
  recommendation?: string;
}

export interface AuditCheck {
  id: string;
  category: AuditCheckCategory;
  name: string;
  description: string;
  /** Maximum severity if this check fails — used for score deduction. */
  worstCaseSeverity: SeverityLevel;
  /** Checks that need the Tauri native HTTP plugin to bypass CORS. */
  requiresTauri?: boolean;
  /** 'virustotal' | 'googleSafeBrowsing' — marks optional API key requirement. */
  requiresApiKey?: string;
  result?: CheckResult;
}

export interface AuditReport {
  id: string;
  targetUrl: string;
  domain: string;
  startedAt: string;
  completedAt?: string;
  checks: AuditCheck[];
  /** Composite score 0–100. Higher is better. */
  score: number;
  /** V2.1: owning client. Pre-V2.1 reports are back-filled to 'unassigned'. */
  clientId?: string;
  /** V2.1: base64 data URL shown in the scan report header and printed output. */
  clientLogo?: string;
}

export interface AuditApiKeys {
  googleSafeBrowsing?: string;
  virusTotal?: string;
  wpscan?: string;
  urlscanIo?: string;
  abuseIpDb?: string;
}

/**
 * V2.1 (Sprint 8b): Local-AI settings — Ollama-backed.
 *
 * Kept separate from `AuditApiKeys` because (a) it isn't an API key, (b) the
 * UI flow is different (detect a running daemon and pick from installed
 * models, not paste a secret), and (c) keeping concerns split avoids forcing
 * a localStorage migration on the existing keys blob.
 *
 * Persisted at localStorage key `ai-settings`.
 */
export interface AiSettings {
  /** Selected model name, e.g. "llama3.2:3b". Empty/absent → AI features disabled. */
  model?: string;
  /** Override for non-default Ollama installs (defaults to http://localhost:11434). */
  baseUrl?: string;
}
