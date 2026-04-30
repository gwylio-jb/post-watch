import type { AuditCheck, AuditCheckCategory, AuditReport, CheckResult, SeverityLevel, AuditApiKeys } from '../../data/auditTypes';
import { runDnsChecks } from './checks/dns';
import { runTlsChecks } from './checks/tls';
import { runHeaderChecks } from './checks/headers';
import { runWordPressChecks } from './checks/wordpress';
import { runWordPressAdvancedChecks } from './checks/wordpressAdvanced';
import { runFileExposureChecks } from './checks/fileExposure';
import { runReputationChecks } from './checks/reputation';
import { runConfigurationChecks } from './checks/configuration';

// ─── Check catalogue ──────────────────────────────────────────────────────────
// All checks with their metadata. Results are added by the engine at scan time.

function buildCheckCatalogue(): AuditCheck[] {
  type Def = Omit<AuditCheck, 'result'>;

  const checks: Def[] = [
    // ── DNS & Email Security ──
    { id: 'dns-mx',     category: 'DNS & Email Security', name: 'MX Records',    worstCaseSeverity: 'Low',    description: 'Verifies that the domain has MX records for receiving email.' },
    { id: 'dns-spf',    category: 'DNS & Email Security', name: 'SPF Record',    worstCaseSeverity: 'High',   description: 'Checks for a Sender Policy Framework record to prevent email spoofing.' },
    { id: 'dns-dmarc',  category: 'DNS & Email Security', name: 'DMARC Policy',  worstCaseSeverity: 'High',   description: 'Validates DMARC policy for reporting and enforcing email authentication.' },
    { id: 'dns-dkim',   category: 'DNS & Email Security', name: 'DKIM Records',  worstCaseSeverity: 'Medium', description: 'Checks for DKIM records at common selectors (google, default, k1, mail, selector1, selector2).' },
    { id: 'dns-caa',    category: 'DNS & Email Security', name: 'CAA Records',   worstCaseSeverity: 'Low',    description: 'Checks for Certification Authority Authorisation records that restrict which CAs can issue certificates.' },
    { id: 'dns-dnssec', category: 'DNS & Email Security', name: 'DNSSEC',        worstCaseSeverity: 'Low',    description: 'Checks if DNSSEC is enabled and validated by the Cloudflare resolver.' },

    // ── TLS / SSL ──
    { id: 'tls-grade',       category: 'TLS / SSL', name: 'SSL Labs Grade',          worstCaseSeverity: 'High',   description: 'Overall TLS configuration grade from Qualys SSL Labs (A+ to F).' },
    { id: 'tls-cert-expiry', category: 'TLS / SSL', name: 'Certificate Expiry',      worstCaseSeverity: 'High',   description: 'Days remaining until the TLS certificate expires. < 14 days is critical.' },
    { id: 'tls-protocols',   category: 'TLS / SSL', name: 'Deprecated Protocols',    worstCaseSeverity: 'High',   description: 'Checks that TLS 1.0, TLS 1.1, SSL 2, and SSL 3 are disabled.' },
    { id: 'tls-pfs',         category: 'TLS / SSL', name: 'Perfect Forward Secrecy', worstCaseSeverity: 'Medium', description: 'Verifies that cipher suites support PFS — past traffic stays private even if the private key is later compromised.' },

    // ── Security Headers ──
    { id: 'header-csp',               category: 'Security Headers', name: 'Content-Security-Policy', worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks for a CSP header and inspects for unsafe-inline/eval weaknesses.' },
    { id: 'header-x-frame-options',   category: 'Security Headers', name: 'X-Frame-Options',         worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Prevents clickjacking by controlling iframe embedding.' },
    { id: 'header-x-content-type',    category: 'Security Headers', name: 'X-Content-Type-Options',  worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Prevents MIME-type sniffing.' },
    { id: 'header-hsts',              category: 'Security Headers', name: 'HSTS Header',              worstCaseSeverity: 'High',   requiresTauri: true, description: 'Checks Strict-Transport-Security max-age, includeSubDomains, and preload.' },
    { id: 'header-referrer-policy',   category: 'Security Headers', name: 'Referrer-Policy',          worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Controls how much referrer information is sent to third parties.' },
    { id: 'header-permissions-policy',category: 'Security Headers', name: 'Permissions-Policy',       worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Restricts browser feature access (camera, microphone, geolocation, etc.).' },
    { id: 'header-coop',              category: 'Security Headers', name: 'Cross-Origin-Opener-Policy', worstCaseSeverity: 'Low',  requiresTauri: true, description: 'Protects against XS-Leaks cross-origin window reference attacks.' },
    { id: 'header-server',            category: 'Security Headers', name: 'Server Header',            worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks whether the Server header exposes software version numbers.' },
    { id: 'header-x-powered-by',      category: 'Security Headers', name: 'X-Powered-By Header',     worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks whether X-Powered-By exposes the PHP version.' },

    // ── WordPress Core ──
    { id: 'wp-version',      category: 'WordPress Core', name: 'WordPress Version',     worstCaseSeverity: 'High',   requiresTauri: true, description: 'Detects WordPress version from page source and compares to latest release.' },
    { id: 'wp-xmlrpc',       category: 'WordPress Core', name: 'XML-RPC Enabled',       worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Tests whether XML-RPC is active — exploitable for brute-force amplification and DDoS.' },
    { id: 'wp-rest-users',   category: 'WordPress Core', name: 'REST API User Enum',    worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks whether /wp-json/wp/v2/users exposes usernames without authentication.' },
    { id: 'wp-author-scan',  category: 'WordPress Core', name: 'Author URL Enumeration',worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Tests whether /?author=1 redirects reveal admin usernames.' },
    { id: 'wp-cron-exposed', category: 'WordPress Core', name: 'WP-Cron Exposed',       worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks if wp-cron.php is directly accessible to external triggers.' },
    { id: 'wp-pingback',     category: 'WordPress Core', name: 'Pingbacks Enabled',     worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks for X-Pingback header which enables DDoS reflection and SSRF.' },
    { id: 'wp-debug',        category: 'WordPress Core', name: 'Debug Mode Active',     worstCaseSeverity: 'High',   requiresTauri: true, description: 'Detects PHP/WP error output in page source (WP_DEBUG = true).' },

    // ── File Exposure ──
    { id: 'file-wp-config',     category: 'File Exposure', name: 'wp-config.php',          worstCaseSeverity: 'Critical', requiresTauri: true, description: 'Tests if wp-config.php is directly accessible (exposes DB credentials, auth keys).' },
    { id: 'file-wp-config-bak', category: 'File Exposure', name: 'wp-config Backup',       worstCaseSeverity: 'Critical', requiresTauri: true, description: 'Checks for backup copies of wp-config.php (.bak, .old, ~).' },
    { id: 'file-env',           category: 'File Exposure', name: '.env File',              worstCaseSeverity: 'Critical', requiresTauri: true, description: 'Tests if .env is publicly accessible (may contain API keys, DB passwords).' },
    { id: 'file-git-config',    category: 'File Exposure', name: '.git/config',            worstCaseSeverity: 'Critical', requiresTauri: true, description: 'Tests if .git/config is accessible — may allow full repository download.' },
    { id: 'file-debug-log',     category: 'File Exposure', name: 'Debug Log',              worstCaseSeverity: 'High',     requiresTauri: true, description: 'Checks if wp-content/debug.log is publicly accessible.' },
    { id: 'file-readme',        category: 'File Exposure', name: 'readme.html',            worstCaseSeverity: 'Low',      requiresTauri: true, description: 'Checks if readme.html discloses the WordPress version.' },
    { id: 'file-license',       category: 'File Exposure', name: 'license.txt',            worstCaseSeverity: 'Low',      requiresTauri: true, description: 'Checks if license.txt is accessible (confirms WordPress installation).' },
    { id: 'file-phpinfo',       category: 'File Exposure', name: 'phpinfo() Files',        worstCaseSeverity: 'High',     requiresTauri: true, description: 'Scans for phpinfo.php and similar diagnostic files.' },
    { id: 'file-backup',        category: 'File Exposure', name: 'Backup Files',           worstCaseSeverity: 'High',     requiresTauri: true, description: 'Scans for common backup archive/SQL files in the web root.' },
    { id: 'file-htaccess',      category: 'File Exposure', name: '.htaccess',              worstCaseSeverity: 'Medium',   requiresTauri: true, description: 'Checks if .htaccess is readable (discloses server rewrite rules and denied paths).' },

    // ── Dark Web & Reputation ──
    { id: 'rep-safe-browsing', category: 'Dark Web & Reputation', name: 'Google Safe Browsing', worstCaseSeverity: 'Critical', requiresApiKey: 'googleSafeBrowsing', description: 'Checks if the URL is flagged for malware, phishing, or unwanted software.' },
    { id: 'rep-virustotal',    category: 'Dark Web & Reputation', name: 'VirusTotal',           worstCaseSeverity: 'Critical', requiresApiKey: 'virusTotal',         description: 'Queries VirusTotal for security vendor flags and domain reputation score.' },
    { id: 'rep-crt-sh',        category: 'Dark Web & Reputation', name: 'Certificate Transparency', worstCaseSeverity: 'Low',                                        description: 'Reviews CT logs for unexpected or suspicious certificate issuance.' },

    // ── Configuration ──
    { id: 'config-https-redirect',  category: 'Configuration', name: 'HTTPS Redirect',        worstCaseSeverity: 'High',   requiresTauri: true, description: 'Verifies that HTTP connections are redirected to HTTPS.' },
    { id: 'config-www-consistency', category: 'Configuration', name: 'WWW Consistency',        worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks that www and non-www redirect consistently to one canonical domain.' },
    { id: 'config-robots-txt',      category: 'Configuration', name: 'robots.txt',              worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Parses robots.txt for sensitive path disclosures in Disallow rules.' },
    { id: 'config-jquery-version',  category: 'Configuration', name: 'jQuery Version',          worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Detects jQuery version and checks for known CVEs (XSS, prototype pollution).' },
    { id: 'config-sri',             category: 'Configuration', name: 'Subresource Integrity',   worstCaseSeverity: 'Low',    requiresTauri: true, description: 'Checks that external scripts include SRI integrity hashes to prevent CDN tampering.' },
    { id: 'config-cookies',         category: 'Configuration', name: 'Cookie Security Flags',   worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks homepage cookies for HttpOnly, Secure, and SameSite flags.' },
    { id: 'config-gdpr-cookie',     category: 'Configuration', name: 'Cookie Consent (GDPR)',   worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks for a cookie consent banner or GDPR consent mechanism on the homepage.' },
    { id: 'config-privacy-policy',  category: 'Configuration', name: 'Privacy Policy',          worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks common URLs for a published privacy policy page.' },

    // ── DNS additions ──
    { id: 'dns-bimi',    category: 'DNS & Email Security', name: 'BIMI Record',   worstCaseSeverity: 'Info', description: 'Checks for a BIMI record to display brand logo in email clients.' },
    { id: 'dns-mta-sts', category: 'DNS & Email Security', name: 'MTA-STS Policy', worstCaseSeverity: 'Medium', description: 'Checks for MTA-STS policy enforcing TLS for inbound email delivery.' },

    // ── File Exposure additions ──
    { id: 'file-upload-listing',     category: 'File Exposure', name: 'Upload Dir Listing',    worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks if /wp-content/uploads/ has directory listing enabled.' },
    { id: 'file-wp-includes-listing',category: 'File Exposure', name: 'WP-Includes Listing',   worstCaseSeverity: 'Medium', requiresTauri: true, description: 'Checks if /wp-includes/ has directory listing enabled.' },

    // ── WordPress Advanced ──
    { id: 'wp-plugin-detection', category: 'WordPress Core', name: 'Plugin Detection',       worstCaseSeverity: 'High',     requiresTauri: true, description: 'Detects installed plugins from page source and checks for outdated versions via WP.org API.' },
    { id: 'wp-malware-patterns', category: 'WordPress Core', name: 'Malware Indicators',     worstCaseSeverity: 'Critical', requiresTauri: true, description: 'Scans page source for known malware patterns including PHP backdoors, crypto miners, and injection indicators.' },
    { id: 'wp-login-protection', category: 'WordPress Core', name: 'Login Page Protection',  worstCaseSeverity: 'Medium',   requiresTauri: true, description: 'Checks for CAPTCHA, rate-limiting, or 2FA protection on the wp-login.php page.' },
    { id: 'wp-upload-php',       category: 'WordPress Core', name: 'Upload PHP Execution',   worstCaseSeverity: 'High',     requiresTauri: true, description: 'Tests whether PHP files in /wp-content/uploads/ can be executed.' },
    { id: 'wp-rest-routes',      category: 'WordPress Core', name: 'REST API Namespaces',    worstCaseSeverity: 'Medium',   requiresTauri: true, description: 'Checks /wp-json/ for non-standard namespaces that may expose sensitive data.' },
    { id: 'wp-admin-custom',     category: 'WordPress Core', name: 'Custom Admin URL',       worstCaseSeverity: 'Low',      requiresTauri: true, description: 'Checks if /wp-admin/ is relocated to a custom path to reduce brute-force exposure.' },
    { id: 'wp-php-version',      category: 'WordPress Core', name: 'PHP Version (EOL)',      worstCaseSeverity: 'Medium',   requiresTauri: true, description: 'Extracts PHP version from response headers and flags end-of-life versions.' },
  ];

  return checks.map(def => ({ ...def }));
}

// ─── Score computation ────────────────────────────────────────────────────────

const SEVERITY_DEDUCTION: Record<SeverityLevel, number> = {
  Critical: 20,
  High:     10,
  Medium:    5,
  Low:       2,
  Info:      0,
  Pass:      0,
};

export function computeScore(checks: AuditCheck[]): number {
  let score = 100;
  for (const check of checks) {
    const r = check.result;
    if (!r || r.status === 'skipped' || r.status === 'info') continue;
    const d = SEVERITY_DEDUCTION[check.worstCaseSeverity];
    if (r.status === 'fail')    score -= d;
    else if (r.status === 'warning') score -= Math.round(d * 0.4);
    else if (r.status === 'error')   score -= Math.round(d * 0.2);
  }
  return Math.max(0, score);
}

// ─── Domain/URL utilities ─────────────────────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

export function normaliseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

// ─── Main scan entry point ────────────────────────────────────────────────────

export async function runScan(
  targetUrl: string,
  apiKeys: AuditApiKeys,
  onCheckComplete: (checkId: string, result: CheckResult) => void,
  signal?: AbortSignal,
): Promise<AuditReport> {
  const domain = extractDomain(targetUrl);
  const checks = buildCheckCatalogue();

  const report: AuditReport = {
    id: crypto.randomUUID(),
    targetUrl,
    domain,
    startedAt: new Date().toISOString(),
    checks,
    score: 0,
  };

  // Helper: apply a result to a check and fire the progress callback
  function applyResult(checkId: string, result: CheckResult) {
    if (signal?.aborted) return;
    const check = checks.find(c => c.id === checkId);
    if (check) check.result = result;
    onCheckComplete(checkId, result);
  }

  // Helper: apply a whole module's result map
  function applyModule(resultMap: Map<string, CheckResult>) {
    for (const [id, result] of resultMap) {
      applyResult(id, result);
    }
  }

  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');

  // ── Phase 1: DNS first (fast, and used by other checks) ──
  const dnsResults = await runDnsChecks(domain);
  applyModule(dnsResults);

  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');

  // ── Phase 2: All other modules concurrently ──
  await Promise.allSettled([
    runTlsChecks(domain).then(applyModule),
    runHeaderChecks(targetUrl).then(applyModule),
    runWordPressChecks(targetUrl).then(applyModule),
    runWordPressAdvancedChecks(targetUrl).then(applyModule),
    runFileExposureChecks(targetUrl).then(applyModule),
    runReputationChecks(targetUrl, domain, apiKeys).then(applyModule),
    runConfigurationChecks(targetUrl, domain).then(applyModule),
  ]);

  if (signal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');

  // ── Finalise report ──
  report.completedAt = new Date().toISOString();
  report.score = computeScore(checks);

  return report;
}

// ─── Check catalogue for use in UI ───────────────────────────────────────────

export { buildCheckCatalogue };

export type { AuditCheckCategory };

export const CATEGORY_ORDER: AuditCheckCategory[] = [
  'Dark Web & Reputation',
  'TLS / SSL',
  'Security Headers',
  'WordPress Core',
  'File Exposure',
  'DNS & Email Security',
  'Configuration',
  'Authentication',
];
