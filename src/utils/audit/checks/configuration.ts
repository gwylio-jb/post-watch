import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, isTauri, SKIPPED_TAURI, describeError } from '../fetchUtil';

// ─── HTTPS redirect ───────────────────────────────────────────────────────────

async function checkHttpsRedirect(domain: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const httpUrl = `http://${domain}/`;
    const res = await auditFetch(httpUrl, { method: 'HEAD', redirect: 'manual' });

    const loc = res.headers.get('location') ?? '';
    if ((res.status >= 301 && res.status <= 302) && loc.startsWith('https://')) {
      return {
        status: 'pass',
        detail: `HTTP redirects to HTTPS (${res.status}). Cleartext access is prevented.`,
        evidence: `${httpUrl} → ${loc}`,
      };
    }
    if (res.status === 200) {
      return {
        status: 'fail',
        detail: 'Site is accessible over plain HTTP without redirect. Credentials and data can be intercepted.',
        evidence: `HTTP ${res.status} — no redirect`,
        recommendation: 'Enforce HTTPS redirect. In .htaccess:\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
      };
    }
    return { status: 'info', detail: `HTTP request returned ${res.status}. Manual verification recommended.` };
  } catch (e) {
    return { status: 'error', detail: `HTTPS redirect check failed: ${describeError(e)}` };
  }
}

// ─── WWW consistency ──────────────────────────────────────────────────────────

async function checkWwwConsistency(domain: string, targetUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const isWww = domain.startsWith('www.');
    const altDomain = isWww ? domain.slice(4) : `www.${domain}`;
    const protocol = targetUrl.startsWith('https://') ? 'https://' : 'http://';
    const altUrl = `${protocol}${altDomain}/`;

    const res = await auditFetch(altUrl, { method: 'HEAD', redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';

    if (res.status >= 300 && res.status < 400 && (loc.includes(domain) || loc.includes(targetUrl))) {
      return {
        status: 'pass',
        detail: `www/non-www redirect is consistent. ${altDomain} → ${domain}`,
        evidence: `${altUrl} → ${loc}`,
      };
    }
    if (res.status === 200) {
      return {
        status: 'warning',
        detail: `Both ${domain} and ${altDomain} respond with 200 — content may be duplicated (SEO impact, inconsistent cookies).`,
        evidence: `${altUrl}: HTTP 200`,
        recommendation: 'Set a canonical domain and redirect the other with a 301.',
      };
    }
    return { status: 'info', detail: `${altDomain} returned HTTP ${res.status}.` };
  } catch {
    return { status: 'info', detail: 'Could not check www/non-www consistency (alternative domain unreachable).' };
  }
}

// ─── robots.txt ───────────────────────────────────────────────────────────────

const SENSITIVE_ROBOTS_PATHS = [
  '/wp-admin', '/wp-includes', '/wp-content/uploads', '/wp-login.php',
  '/phpmyadmin', '/cpanel', '/admin', '/.env', '/config', '/backup',
  '/wp-config.php', '/xmlrpc.php', '/wp-cron.php',
];

async function checkRobotsTxt(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(`${baseUrl}/robots.txt`);
    if (res.status === 404) {
      return {
        status: 'info',
        detail: 'No robots.txt found. Search engines will crawl everything.',
        recommendation: 'Add a robots.txt. For WordPress: Disallow: /wp-admin/ (but ensure the admin-ajax.php is still allowed for AJAX).',
      };
    }
    if (res.status !== 200) {
      return { status: 'info', detail: `robots.txt returned HTTP ${res.status}.` };
    }

    const text = await res.text();
    const exposedPaths = SENSITIVE_ROBOTS_PATHS.filter(p => text.includes(p));

    if (exposedPaths.length > 0) {
      return {
        status: 'warning',
        detail: `robots.txt lists ${exposedPaths.length} sensitive path(s) in Disallow rules. Paradoxically, this reveals what attackers should target.`,
        evidence: exposedPaths.join('\n'),
        recommendation: 'While Disallow rules are not a security control, avoid listing highly sensitive paths. Use security-through-obscurity sparingly; rely on proper access controls instead.',
      };
    }
    return { status: 'pass', detail: 'robots.txt present. No overly sensitive paths found in Disallow rules.' };
  } catch (e) {
    return { status: 'error', detail: `robots.txt check failed: ${describeError(e)}` };
  }
}

// ─── jQuery version ───────────────────────────────────────────────────────────

// jQuery versions with known major CVEs
const VULNERABLE_JQUERY: Record<string, string[]> = {
  '1.x': ['XSS in .html()', 'CSRF via jQuery.ajax()', 'Prototype Pollution'],
  '2.x': ['XSS in .html()', 'Prototype Pollution'],
  '3.0': ['Prototype Pollution (CVE-2019-11358)'],
  '3.1': ['Prototype Pollution (CVE-2019-11358)'],
  '3.2': ['Prototype Pollution (CVE-2019-11358)'],
  '3.3': ['Prototype Pollution (CVE-2019-11358)'],
  '3.4': ['Prototype Pollution (CVE-2019-11358)'],
  '3.5': ['XSS (CVE-2020-11022, CVE-2020-11023)'],
};

async function checkJqueryVersion(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();

    // Detect from script src tags
    const jqMatch = html.match(/jquery[.-]([\d.]+)(?:\.min)?\.js/i);
    const verMatch = html.match(/jquery\/?([\d.]+)(?:\.min)?\.js/i);
    const detected = jqMatch?.[1] ?? verMatch?.[1] ?? null;

    if (!detected) {
      return {
        status: 'info',
        detail: 'Could not detect jQuery version from page source (may be bundled or loaded dynamically).',
      };
    }

    const major = detected.split('.')[0];
    const key = Object.keys(VULNERABLE_JQUERY).find(k => {
      if (k.endsWith('.x')) return k[0] === major;
      return detected.startsWith(k);
    });

    if (key) {
      const cves = VULNERABLE_JQUERY[key];
      return {
        status: 'fail',
        detail: `jQuery ${detected} has known vulnerabilities: ${cves.slice(0, 2).join(', ')}.`,
        evidence: `Detected: ${detected}`,
        recommendation: 'Update to jQuery 3.7+ (latest stable). WordPress ships a bundled jQuery — update WordPress core to get the latest version.',
      };
    }

    return { status: 'pass', detail: `jQuery ${detected} — no known critical CVEs.`, evidence: `Detected: ${detected}` };
  } catch (e) {
    return { status: 'error', detail: `jQuery version check failed: ${describeError(e)}` };
  }
}

// ─── Subresource Integrity ────────────────────────────────────────────────────

async function checkSri(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();

    // Find external scripts (CDN/third-party)
    const scriptPattern = /<script[^>]+src=["']https?:\/\/(?!(?:[^"']*\.)?(wordpress\.org|wp\.com|your-domain))[^"']+["'][^>]*>/gi;
    const matches = [...html.matchAll(scriptPattern)];

    if (matches.length === 0) {
      return { status: 'pass', detail: 'No external third-party scripts detected (or all loaded from same origin).' };
    }

    const withoutSri = matches.filter(m => !m[0].includes('integrity=')).map(m => {
      const srcMatch = m[0].match(/src=["']([^"']+)["']/);
      return srcMatch?.[1] ?? m[0];
    });

    if (withoutSri.length === 0) {
      return {
        status: 'pass',
        detail: `${matches.length} external script(s) found — all have SRI integrity hashes.`,
      };
    }

    return {
      status: 'warning',
      detail: `${withoutSri.length}/${matches.length} external scripts lack Subresource Integrity (SRI) hashes. A CDN compromise could inject malicious code.`,
      evidence: withoutSri.slice(0, 5).join('\n'),
      recommendation: 'Add integrity= and crossorigin= attributes to all external scripts. Generate hashes at: https://www.srihash.org/',
    };
  } catch (e) {
    return { status: 'error', detail: `SRI check failed: ${describeError(e)}` };
  }
}

// ─── Cookie security flags ────────────────────────────────────────────────────

async function checkCookies(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];

    if (setCookieHeaders.length === 0) {
      // Try to get set-cookie from the raw headers
      const rawCookie = res.headers.get('set-cookie');
      if (!rawCookie) {
        return { status: 'info', detail: 'No Set-Cookie headers found on the homepage (cookies may be set after login).' };
      }
      setCookieHeaders.push(rawCookie);
    }

    const issues: string[] = [];
    const cookieNames: string[] = [];

    for (const cookieHeader of setCookieHeaders) {
      const name = cookieHeader.split('=')[0].trim();
      cookieNames.push(name);

      if (!cookieHeader.toLowerCase().includes('httponly')) issues.push(`${name}: missing HttpOnly`);
      if (baseUrl.startsWith('https://') && !cookieHeader.toLowerCase().includes('secure')) {
        issues.push(`${name}: missing Secure flag`);
      }
      if (!cookieHeader.toLowerCase().includes('samesite')) issues.push(`${name}: missing SameSite`);
    }

    if (issues.length === 0) {
      return {
        status: 'pass',
        detail: `${cookieNames.length} cookie(s) all have HttpOnly, Secure, and SameSite flags.`,
        evidence: cookieNames.join(', '),
      };
    }

    return {
      status: 'fail',
      detail: `${issues.length} cookie security flag issue(s) found.`,
      evidence: issues.join('\n'),
      recommendation: 'Ensure all cookies set HttpOnly (prevents JS theft), Secure (HTTPS only), and SameSite=Strict or Lax (CSRF protection).',
    };
  } catch (e) {
    return { status: 'error', detail: `Cookie check failed: ${describeError(e)}` };
  }
}

// ─── GDPR Cookie consent ──────────────────────────────────────────────────────

const COOKIE_CONSENT_PATTERNS = [
  'cookiebot', 'cookieconsent', 'cookie-consent', 'cc-banner', 'cookie-notice',
  'gdpr-cookie', 'CookieConsentAPI', 'onetrust', 'trustarcnotice', 'cookie_notice',
  'cookie-law-info', 'complianz', 'eu-cookie', 'cookie_popup',
];

async function checkGdprCookie(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();
    const lower = html.toLowerCase();

    const found = COOKIE_CONSENT_PATTERNS.filter(p => lower.includes(p.toLowerCase()));
    if (found.length > 0) {
      return {
        status: 'pass',
        detail: `Cookie consent mechanism detected (${found[0]}).`,
        evidence: `Patterns matched: ${found.join(', ')}`,
      };
    }

    return {
      status: 'warning',
      detail: 'No cookie consent banner detected in page source. GDPR/ePrivacy compliance may be at risk if the site sets non-essential cookies.',
      recommendation: 'Implement a cookie consent solution (e.g. CookieYes, Cookiebot, or a GDPR cookie plugin) to meet EU ePrivacy Directive requirements.',
    };
  } catch (e) {
    return { status: 'error', detail: `Cookie consent check failed: ${describeError(e)}` };
  }
}

// ─── Privacy policy ───────────────────────────────────────────────────────────

async function checkPrivacyPolicy(baseUrl: string): Promise<CheckResult> {
  if (!isTauri()) return SKIPPED_TAURI;
  const paths = ['/privacy-policy', '/privacy', '/legal/privacy', '/cookie-policy', '/privacy-policy/', '/data-privacy'];
  try {
    for (const path of paths) {
      const res = await auditFetch(`${baseUrl}${path}`, { method: 'HEAD', redirect: 'follow' });
      if (res.status === 200) {
        return {
          status: 'pass',
          detail: `Privacy policy found at ${baseUrl}${path}.`,
          evidence: `URL: ${baseUrl}${path}`,
        };
      }
    }
    return {
      status: 'fail',
      detail: 'No privacy policy found at common URLs. A privacy policy is legally required under GDPR and similar regulations.',
      recommendation: 'Create a privacy policy and publish it at /privacy-policy. Include: data collected, legal basis, retention periods, subject rights, and contact information.',
    };
  } catch (e) {
    return { status: 'error', detail: `Privacy policy check failed: ${describeError(e)}` };
  }
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runConfigurationChecks(
  baseUrl: string,
  domain: string,
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  const [httpsRedirect, wwwConsistency, robotsTxt, jqueryVersion, sri, cookies, gdprCookie, privacyPolicy] = await Promise.all([
    checkHttpsRedirect(domain),
    checkWwwConsistency(domain, baseUrl),
    checkRobotsTxt(baseUrl),
    checkJqueryVersion(baseUrl),
    checkSri(baseUrl),
    checkCookies(baseUrl),
    checkGdprCookie(baseUrl),
    checkPrivacyPolicy(baseUrl),
  ]);

  results.set('config-https-redirect', httpsRedirect);
  results.set('config-www-consistency', wwwConsistency);
  results.set('config-robots-txt', robotsTxt);
  results.set('config-jquery-version', jqueryVersion);
  results.set('config-sri', sri);
  results.set('config-cookies', cookies);
  results.set('config-gdpr-cookie', gdprCookie);
  results.set('config-privacy-policy', privacyPolicy);

  return results;
}
