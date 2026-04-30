import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, isTauri, SKIPPED_TAURI, describeError } from '../fetchUtil';

// ─── Plugin detection ─────────────────────────────────────────────────────────
// Parses page HTML for /wp-content/plugins/{name}/ path references.
// Also checks ?ver= query params on plugin assets to detect versions.
// Compares detected versions against WordPress.org plugin API.

export interface DetectedPlugin {
  name: string;
  detectedVersion: string | null;
  latestVersion: string | null;
  upToDate: boolean | null;
}

async function fetchPluginLatestVersion(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.wordpress.org/plugins/info/1.0/${encodeURIComponent(slug)}.json`,
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

async function checkPluginDetection(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();

    // Extract plugin slugs from wp-content/plugins/
    const pluginMatches = [...html.matchAll(/wp-content\/plugins\/([a-z0-9_-]+)\//gi)];
    const slugs = [...new Set(pluginMatches.map(m => m[1].toLowerCase()))];

    if (slugs.length === 0) {
      return {
        status: 'info',
        detail: 'No plugin references detected in page source (plugins may be properly enqueued without path exposure).',
      };
    }

    // Detect versions from ?ver= on plugin asset URLs
    const versionMap = new Map<string, string>();
    for (const slug of slugs) {
      const verMatch = html.match(new RegExp(`plugins/${slug}/[^"'?]+\\?ver=([\\d.]+)`, 'i'));
      if (verMatch) {
        versionMap.set(slug, verMatch[1]);
      }
    }

    // Fetch latest versions from WP.org for the first 10 plugins (API rate limit consideration)
    const checkSlugs = slugs.slice(0, 10);
    const latestVersions = await Promise.all(checkSlugs.map(fetchPluginLatestVersion));

    const plugins: DetectedPlugin[] = checkSlugs.map((slug, i) => {
      const detected = versionMap.get(slug) ?? null;
      const latest = latestVersions[i];
      const upToDate = detected && latest ? detected === latest : null;
      return { name: slug, detectedVersion: detected, latestVersion: latest, upToDate };
    });

    const outdated = plugins.filter(p => p.upToDate === false);
    const status = outdated.length > 0 ? 'warning' : 'pass';
    const detail = outdated.length > 0
      ? `${slugs.length} plugin(s) detected. ${outdated.length} may be outdated: ${outdated.map(p => `${p.name} (${p.detectedVersion} → ${p.latestVersion})`).join(', ')}.`
      : `${slugs.length} plugin(s) detected in page source.`;

    // Store the plugin list in the evidence as JSON for the UI to parse
    return {
      status,
      detail,
      evidence: JSON.stringify(plugins),
      recommendation: outdated.length > 0
        ? 'Update outdated plugins via WP Admin → Plugins. Enable auto-updates for security plugins.'
        : undefined,
    };
  } catch (e) {
    return { status: 'error', detail: `Plugin detection failed: ${describeError(e)}` };
  }
}

// ─── Malware pattern scan ─────────────────────────────────────────────────────

interface MalwarePattern {
  pattern: RegExp;
  description: string;
  severity: 'critical' | 'high';
}

const MALWARE_PATTERNS: MalwarePattern[] = [
  { pattern: /eval\s*\(\s*base64_decode\s*\(/i,   description: 'eval(base64_decode()) — PHP backdoor pattern',    severity: 'critical' },
  { pattern: /eval\s*\(\s*gzinflate\s*\(/i,        description: 'eval(gzinflate()) — obfuscated PHP execution',    severity: 'critical' },
  { pattern: /eval\s*\(\s*str_rot13\s*\(/i,         description: 'eval(str_rot13()) — obfuscated PHP execution',   severity: 'critical' },
  { pattern: /<iframe\s[^>]*src\s*=\s*["']http:\/\//i, description: 'HTTP iframe injection (non-HTTPS iframe source)', severity: 'high' },
  { pattern: /coinhive\.min\.js|cryptonight|CoinHive\.Anonymous|miner\.min\.js/i, description: 'Crypto miner script detected', severity: 'critical' },
  { pattern: /document\.write\s*\(\s*unescape\s*\(/i, description: 'document.write(unescape()) — XSS/injection pattern', severity: 'high' },
];

async function checkMalwarePatterns(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();

    const found = MALWARE_PATTERNS.filter(p => p.pattern.test(html));

    if (found.length === 0) {
      return {
        status: 'pass',
        detail: 'No malware patterns detected in page source.',
      };
    }

    const critical = found.filter(p => p.severity === 'critical');
    return {
      status: 'fail',
      detail: `${found.length} malware indicator(s) detected in page source.${critical.length > 0 ? ` ${critical.length} CRITICAL.` : ''}`,
      evidence: found.map(p => `• ${p.description}`).join('\n'),
      recommendation: 'Immediately investigate and remove malicious code. Consider: restoring from a clean backup, changing all passwords, scanning server-side files with a malware scanner (Maldet, ClamAV), and contacting your host.',
    };
  } catch (e) {
    return { status: 'error', detail: `Malware pattern check failed: ${describeError(e)}` };
  }
}

// ─── Login page protection ────────────────────────────────────────────────────

async function checkLoginProtection(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(`${baseUrl}/wp-login.php`, { method: 'GET' });

    if (res.status === 404 || res.status === 403) {
      return {
        status: 'pass',
        detail: `wp-login.php returns HTTP ${res.status} — login page is protected or relocated.`,
      };
    }

    if (res.status !== 200) {
      return {
        status: 'info',
        detail: `wp-login.php returned HTTP ${res.status}.`,
      };
    }

    // Check for rate-limiting or 2FA headers
    const headers = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase();
    const html = await res.text();
    const protectionIndicators = [
      { pattern: /x-ratelimit|retry-after/i, description: 'Rate limiting headers detected' },
      { pattern: /cf-ray|x-sucuri/i, description: 'WAF/Cloudflare protection detected' },
      { pattern: /recaptcha|hcaptcha|captcha/i, description: 'CAPTCHA detected' },
      { pattern: /two.?factor|2fa|totp/i, description: '2FA indicator detected' },
    ];

    const found = protectionIndicators.filter(p =>
      p.pattern.test(headers) || p.pattern.test(html)
    );

    if (found.length > 0) {
      return {
        status: 'pass',
        detail: `Login page accessible but protection detected: ${found.map(f => f.description).join(', ')}.`,
        evidence: found.map(f => f.description).join('\n'),
      };
    }

    return {
      status: 'warning',
      detail: 'wp-login.php is publicly accessible without detectable rate limiting, CAPTCHA, or 2FA. Susceptible to brute-force attacks.',
      recommendation: 'Protect wp-login.php:\n1. Install a security plugin with login limiting (Limit Login Attempts, Wordfence)\n2. Enable 2FA for admin accounts\n3. Consider relocating wp-login.php with a plugin\n4. Restrict access by IP if possible',
    };
  } catch (e) {
    return { status: 'error', detail: `Login protection check failed: ${describeError(e)}` };
  }
}

// ─── Upload directory PHP execution ──────────────────────────────────────────

async function checkUploadPhpExecution(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    // Test for a PHP file in uploads — if the path 403s or 404s, PHP execution is likely blocked
    const testPaths = [
      '/wp-content/uploads/test.php',
      '/wp-content/uploads/shell.php',
    ];
    const results = await Promise.all(testPaths.map(async path => {
      const res = await auditFetch(`${baseUrl}${path}`, { method: 'GET' });
      return { path, status: res.status };
    }));

    // If any returns 200, PHP execution may be enabled (though without actual PHP content this is unlikely)
    // Main indicator: 403 is better than 200 or 404
    const exposed = results.filter(r => r.status === 200);
    if (exposed.length > 0) {
      return {
        status: 'fail',
        detail: 'PHP files appear executable in /wp-content/uploads/ — uploaded malicious files could be executed.',
        evidence: exposed.map(r => r.path).join('\n'),
        recommendation: 'Block PHP execution in uploads directory. Add to /wp-content/uploads/.htaccess:\n<Files *.php>\n  Order Allow,Deny\n  Deny from all\n</Files>',
      };
    }

    return {
      status: 'pass',
      detail: 'PHP execution in /wp-content/uploads/ appears blocked (PHP files return 403 or 404).',
    };
  } catch (e) {
    return { status: 'error', detail: `Upload PHP execution check failed: ${describeError(e)}` };
  }
}

// ─── REST API exposure ────────────────────────────────────────────────────────

async function checkRestApiRoutes(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(`${baseUrl}/wp-json/`, { method: 'GET' });
    if (res.status === 404) {
      return { status: 'pass', detail: 'WordPress REST API is disabled or relocated (/wp-json/ returns 404).' };
    }
    if (res.status !== 200) {
      return { status: 'info', detail: `REST API endpoint returned HTTP ${res.status}.` };
    }

    const data = await res.json() as { namespaces?: string[] };
    const namespaces: string[] = data.namespaces ?? [];

    // Flag non-standard, potentially sensitive namespaces
    const coreNamespaces = new Set(['wp/v2', 'oembed/1.0', 'wp-site-health/v1']);
    const extraNamespaces = namespaces.filter(ns => !coreNamespaces.has(ns));

    if (extraNamespaces.length === 0) {
      return {
        status: 'pass',
        detail: `REST API active with ${namespaces.length} core namespace(s). No non-standard namespaces detected.`,
        evidence: namespaces.join('\n'),
      };
    }

    return {
      status: 'warning',
      detail: `REST API exposes ${extraNamespaces.length} non-core namespace(s). Review these for data exposure.`,
      evidence: `Extra namespaces:\n${extraNamespaces.join('\n')}`,
      recommendation: 'Audit non-standard REST API endpoints. Restrict unauthenticated access where possible:\nadd_filter("rest_authentication_errors", function($result) {\n  if (!is_user_logged_in()) return new WP_Error("rest_not_logged_in", "...", ["status" => 401]);\n  return $result;\n});',
    };
  } catch (e) {
    return { status: 'error', detail: `REST API check failed: ${describeError(e)}` };
  }
}

// ─── Custom admin URL ─────────────────────────────────────────────────────────

async function checkCustomAdminUrl(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(`${baseUrl}/wp-admin/`, { method: 'GET', redirect: 'manual' });

    if (res.status === 301 || res.status === 302) {
      const loc = res.headers.get('location') ?? '';
      if (!loc.includes('/wp-admin/') && !loc.includes('/wp-login.php')) {
        return {
          status: 'pass',
          detail: 'wp-admin/ redirects to a custom URL — admin URL relocation appears configured.',
          evidence: `Redirect to: ${loc}`,
        };
      }
    }

    if (res.status === 200 || res.status === 302) {
      return {
        status: 'info',
        detail: 'Default /wp-admin/ URL is reachable. Consider using a security plugin to relocate the admin URL.',
        recommendation: 'Use WPS Hide Login or All In One WP Security to relocate wp-admin/ to a non-standard URL — reduces automated login attacks significantly.',
      };
    }

    if (res.status === 403 || res.status === 404) {
      return {
        status: 'pass',
        detail: `wp-admin/ returns HTTP ${res.status} — access is restricted or URL is relocated.`,
      };
    }

    return { status: 'info', detail: `wp-admin/ returned HTTP ${res.status}.` };
  } catch (e) {
    return { status: 'error', detail: `Admin URL check failed: ${describeError(e)}` };
  }
}

// ─── PHP version (EOL check) ──────────────────────────────────────────────────

function classifyPhpVersion(version: string): CheckResult {
  const parts = version.split('.').map(Number);
  const major = parts[0];
  const minor = parts[1] ?? 0;

  if (major < 7) {
    return {
      status: 'fail',
      detail: `PHP ${version} is critically end-of-life. No security patches available since 2019 or earlier.`,
      evidence: `Detected: PHP ${version}`,
      recommendation: 'Upgrade to PHP 8.2 or 8.3 immediately. Contact your host for assistance.',
    };
  }
  if (major === 7) {
    return {
      status: 'fail',
      detail: `PHP ${version} is end-of-life (PHP 7.x support ended 2022). Critical vulnerabilities have no patches.`,
      evidence: `Detected: PHP ${version}`,
      recommendation: 'Upgrade to PHP 8.2+ urgently. All PHP 7.x versions are unsupported.',
    };
  }
  if (major === 8 && minor === 0) {
    return {
      status: 'fail',
      detail: `PHP ${version} reached end-of-life (November 2023). No security updates available.`,
      evidence: `Detected: PHP ${version}`,
      recommendation: 'Upgrade to PHP 8.2 or 8.3.',
    };
  }
  if (major === 8 && minor === 1) {
    return {
      status: 'warning',
      detail: `PHP ${version} is in security-fix-only mode (EOL December 2025). Plan your upgrade.`,
      evidence: `Detected: PHP ${version}`,
      recommendation: 'Upgrade to PHP 8.2+ for active support. PHP 8.1 security fixes end December 2025.',
    };
  }
  // 8.2+ = actively supported
  return {
    status: 'pass',
    detail: `PHP ${version} is an actively supported version.`,
    evidence: `Detected: PHP ${version}`,
  };
}

async function checkPhpVersion(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    // Try HEAD first (lighter), fall back to GET if needed
    const res = await auditFetch(baseUrl, { method: 'HEAD' });

    // Check X-Powered-By header
    const poweredBy = res.headers.get('x-powered-by') ?? '';
    const phpMatch = poweredBy.match(/PHP\/([\d.]+)/i);
    if (phpMatch) return classifyPhpVersion(phpMatch[1]);

    // Check Server header
    const server = res.headers.get('server') ?? '';
    const serverPhpMatch = server.match(/PHP\/([\d.]+)/i);
    if (serverPhpMatch) return classifyPhpVersion(serverPhpMatch[1]);

    return {
      status: 'info',
      detail: 'PHP version not disclosed in response headers (X-Powered-By header absent). This is good security practice.',
    };
  } catch (e) {
    return { status: 'error', detail: `PHP version check failed: ${describeError(e)}` };
  }
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runWordPressAdvancedChecks(baseUrl: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  const [pluginDetection, malwarePatterns, loginProtection, uploadPhp, restRoutes, customAdmin, phpVersion] = await Promise.all([
    checkPluginDetection(baseUrl),
    checkMalwarePatterns(baseUrl),
    checkLoginProtection(baseUrl),
    checkUploadPhpExecution(baseUrl),
    checkRestApiRoutes(baseUrl),
    checkCustomAdminUrl(baseUrl),
    checkPhpVersion(baseUrl),
  ]);

  results.set('wp-plugin-detection', pluginDetection);
  results.set('wp-malware-patterns', malwarePatterns);
  results.set('wp-login-protection', loginProtection);
  results.set('wp-upload-php', uploadPhp);
  results.set('wp-rest-routes', restRoutes);
  results.set('wp-admin-custom', customAdmin);
  results.set('wp-php-version', phpVersion);

  return results;
}

