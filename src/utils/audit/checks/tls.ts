import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, describeError } from '../fetchUtil';

// ─── SSL Labs API ─────────────────────────────────────────────────────────────
// Free public API. CORS-safe (Access-Control-Allow-Origin: *).
// Rate limit: 25 concurrent assessments. One assessment per IP per domain per hour.
// Docs: https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md

const SSL_LABS_BASE = 'https://api.ssllabs.com/api/v3';
const POLL_INTERVAL_MS = 12_000;
const MAX_WAIT_MS = 150_000; // 2.5 min — Labs can be slow for first-time scans

interface SslLabsCert {
  subject: string;
  notBefore: number; // Unix ms
  notAfter: number;  // Unix ms
  issues: number;    // Bitmask: 0 = OK
  keyStrength: number;
  revocationStatus: number; // 0=not checked, 1=stapled/good, 2=revoked, 3=not revoked, 4=staple missing, 5=status unknown
}

interface SslLabsProtocol {
  id: number;
  name: string;
  version: string; // '1.0', '1.1', '1.2', '1.3'
}

interface SslLabsEndpointDetails {
  cert: SslLabsCert;
  protocols: SslLabsProtocol[];
  forwardSecrecy: number; // 1=some, 2=all, 4=all+robust
  hstsPolicy?: {
    status: string; // 'present' | 'absent' | 'invalid'
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
}

interface SslLabsEndpoint {
  grade: string; // 'A+', 'A', 'A-', 'B', 'C', 'D', 'E', 'F', 'T', 'M'
  hasWarnings: boolean;
  isExceptional?: boolean;
  statusMessage: string;
  details?: SslLabsEndpointDetails;
}

interface SslLabsReport {
  host: string;
  status: 'DNS' | 'IN_PROGRESS' | 'READY' | 'ERROR';
  statusMessage?: string;
  startTime?: number;
  endpoints: SslLabsEndpoint[];
}

/**
 * SSL Labs asks API clients to hit /info first so they can register your
 * client and return current rate-limit headers. Skipping this step makes
 * some deployments 403 the subsequent /analyze calls. We fire-and-forget it
 * — failures are non-fatal.
 */
let infoChecked = false;
async function ensureInfoChecked(): Promise<void> {
  if (infoChecked) return;
  infoChecked = true;
  try { await auditFetch(`${SSL_LABS_BASE}/info`); } catch { /* ignore */ }
}

async function startOrGetAnalysis(host: string, startNew: boolean): Promise<SslLabsReport> {
  await ensureInfoChecked();

  const params = new URLSearchParams({ host, all: 'done' });
  if (startNew) params.set('startNew', 'on');

  const res = await auditFetch(`${SSL_LABS_BASE}/analyze?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error(`SSL Labs API error: HTTP ${res.status}`);

  return res.json() as Promise<SslLabsReport>;
}

/** Polls SSL Labs until status is READY or timeout is reached. */
async function pollUntilReady(host: string): Promise<SslLabsReport> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let report = await startOrGetAnalysis(host, true);

  while (report.status !== 'READY' && report.status !== 'ERROR') {
    if (Date.now() > deadline) {
      throw new Error(`SSL Labs analysis timed out after ${MAX_WAIT_MS / 1000}s. The server may be queued.`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    report = await startOrGetAnalysis(host, false);
  }

  if (report.status === 'ERROR') {
    throw new Error(`SSL Labs analysis error: ${report.statusMessage ?? 'Unknown error'}`);
  }
  return report;
}

// ─── Grade check ──────────────────────────────────────────────────────────────

function checkGrade(endpoints: SslLabsEndpoint[]): CheckResult {
  if (!endpoints.length) return { status: 'error', detail: 'No endpoints returned by SSL Labs.' };

  const best = endpoints.reduce((a, b) => {
    const order = ['A+', 'A', 'A-', 'B', 'C', 'D', 'E', 'F', 'T', 'M'];
    return order.indexOf(a.grade) <= order.indexOf(b.grade) ? a : b;
  });

  const grade = best.grade;
  if (grade === 'A+' || grade === 'A') {
    return { status: 'pass', detail: `SSL Labs grade: ${grade}${best.isExceptional ? ' (exceptional configuration)' : ''}.`, evidence: grade };
  }
  if (grade === 'A-' || grade === 'B') {
    return {
      status: 'warning',
      detail: `SSL Labs grade: ${grade}. Good but some improvements possible.`,
      evidence: grade,
      recommendation: 'Review the SSL Labs report at ssllabs.com for specific recommendations.',
    };
  }
  return {
    status: 'fail',
    detail: `SSL Labs grade: ${grade}. Significant TLS configuration issues detected.`,
    evidence: grade,
    recommendation: 'Review the full SSL Labs report and address cipher suites, protocol versions, and certificate issues.',
  };
}

// ─── Certificate expiry ───────────────────────────────────────────────────────

function checkCertExpiry(endpoints: SslLabsEndpoint[]): CheckResult {
  const cert = endpoints[0]?.details?.cert;
  if (!cert) return { status: 'error', detail: 'Certificate details not available from SSL Labs.' };

  const expiresAt = new Date(cert.notAfter);
  const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
  const formatted = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (daysLeft < 0) {
    return {
      status: 'fail',
      detail: `Certificate EXPIRED ${Math.abs(daysLeft)} days ago (${formatted}).`,
      evidence: `Expiry: ${formatted}`,
      recommendation: 'Renew the TLS certificate immediately. Consider enabling auto-renewal via Let\'s Encrypt.',
    };
  }
  if (daysLeft <= 14) {
    return {
      status: 'fail',
      detail: `Certificate expires in ${daysLeft} days (${formatted}) — URGENT renewal required.`,
      evidence: `Expiry: ${formatted}`,
      recommendation: 'Renew or replace the certificate immediately. Enable auto-renewal to prevent future outages.',
    };
  }
  if (daysLeft <= 30) {
    return {
      status: 'warning',
      detail: `Certificate expires in ${daysLeft} days (${formatted}).`,
      evidence: `Expiry: ${formatted}`,
      recommendation: 'Renew the certificate soon. Set up auto-renewal via Let\'s Encrypt (Certbot).',
    };
  }
  return { status: 'pass', detail: `Certificate valid for ${daysLeft} more days (expires ${formatted}).`, evidence: `Expiry: ${formatted}` };
}

// ─── Deprecated protocols ─────────────────────────────────────────────────────

function checkProtocols(endpoints: SslLabsEndpoint[]): CheckResult {
  const protocols = endpoints[0]?.details?.protocols ?? [];
  const deprecated = protocols.filter(p =>
    (p.name === 'SSL' && ['2.0', '3.0'].includes(p.version)) ||
    (p.name === 'TLS' && ['1.0', '1.1'].includes(p.version))
  );

  if (deprecated.length > 0) {
    const names = deprecated.map(p => `${p.name} ${p.version}`).join(', ');
    return {
      status: 'fail',
      detail: `Deprecated protocols enabled: ${names}. These have known vulnerabilities (POODLE, BEAST).`,
      evidence: names,
      recommendation: 'Disable TLS 1.0 and 1.1 in your web server config. Only TLS 1.2 and 1.3 should be enabled.',
    };
  }

  const supported = protocols.map(p => `${p.name} ${p.version}`).join(', ');
  const hasTls13 = protocols.some(p => p.name === 'TLS' && p.version === '1.3');
  return {
    status: 'pass',
    detail: `No deprecated protocols. Supported: ${supported}${hasTls13 ? ' (TLS 1.3 ✓)' : ''}.`,
    evidence: supported,
  };
}

// ─── Perfect Forward Secrecy ──────────────────────────────────────────────────

function checkPfs(endpoints: SslLabsEndpoint[]): CheckResult {
  const fs = endpoints[0]?.details?.forwardSecrecy ?? 0;
  // Bitmask: 1=some, 2=all, 4=robust (ECDHE preferred)
  if (fs >= 2) {
    return { status: 'pass', detail: 'Perfect Forward Secrecy: all cipher suites support it.' + (fs >= 4 ? ' ECDHE suites preferred.' : '') };
  }
  if (fs === 1) {
    return {
      status: 'warning',
      detail: 'PFS supported on some cipher suites only.',
      recommendation: 'Configure your web server to prefer ECDHE cipher suites for all connections.',
    };
  }
  return {
    status: 'fail',
    detail: 'No cipher suites support Perfect Forward Secrecy. Past session recordings could be decrypted if the private key is later compromised.',
    recommendation: 'Enable ECDHE key exchange. Disable static RSA key exchange in your cipher suite configuration.',
  };
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runTlsChecks(domain: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  try {
    const report = await pollUntilReady(domain);
    results.set('tls-grade', checkGrade(report.endpoints));
    results.set('tls-cert-expiry', checkCertExpiry(report.endpoints));
    results.set('tls-protocols', checkProtocols(report.endpoints));
    results.set('tls-pfs', checkPfs(report.endpoints));
  } catch (e) {
    const raw = describeError(e);
    // Degrade gracefully when SSL Labs is rate-limiting / blocking us.
    // Qualys SSL Labs enforces a strict per-IP rate limit on their free API
    // and will return 403/429 for several minutes once tripped.
    const isBlocked = raw === 'RATE_LIMIT' || raw === 'FORBIDDEN';
    const skipped: CheckResult = isBlocked
      ? {
          status: 'skipped',
          detail:
            raw === 'RATE_LIMIT'
              ? 'SSL Labs API rate limit reached. Qualys throttles free-tier scans per IP — wait ~10 minutes and re-run.'
              : 'SSL Labs API is temporarily rejecting this client (HTTP 403). This is usually a short-term rate-limit or an IP-based block. Retry in 10–15 minutes, or run the scan from a different network.',
          recommendation:
            'You can verify the cert manually at https://www.ssllabs.com/ssltest/analyze.html?d=' + encodeURIComponent(domain),
        }
      : { status: 'error', detail: `SSL Labs unavailable: ${raw}` };

    results.set('tls-grade', skipped);
    results.set('tls-cert-expiry', skipped);
    results.set('tls-protocols', skipped);
    results.set('tls-pfs', skipped);
  }

  return results;
}
