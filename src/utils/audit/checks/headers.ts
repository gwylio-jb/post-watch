import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, isTauri, SKIPPED_TAURI, describeError } from '../fetchUtil';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function h(headers: Headers, name: string): string | null {
  return headers.get(name.toLowerCase());
}

// ─── Individual header checks ─────────────────────────────────────────────────

function checkCsp(headers: Headers): CheckResult {
  const csp = h(headers, 'content-security-policy');
  if (!csp) {
    return {
      status: 'fail',
      detail: 'Content-Security-Policy header is missing. XSS attacks are unrestricted.',
      recommendation: "Add a CSP header. Start with: Content-Security-Policy: default-src 'self'",
    };
  }
  const issues: string[] = [];
  if (csp.includes("'unsafe-inline'") && !csp.includes('nonce-') && !csp.includes('hash-')) {
    issues.push("'unsafe-inline' without nonce/hash neutralises XSS protection");
  }
  if (csp.includes("'unsafe-eval'")) issues.push("'unsafe-eval' allows dynamic code execution");
  if (csp.includes('*') && !csp.includes('script-src')) issues.push('wildcard source in default-src');

  if (issues.length) {
    return {
      status: 'warning',
      detail: `CSP present but has weaknesses: ${issues.join('; ')}.`,
      evidence: csp,
      recommendation: 'Remove unsafe-inline/unsafe-eval and use nonces or hashes for inline scripts.',
    };
  }
  return { status: 'pass', detail: 'Content-Security-Policy header present and well-formed.', evidence: csp };
}

function checkXFrameOptions(headers: Headers): CheckResult {
  const xfo = h(headers, 'x-frame-options');
  if (!xfo) {
    return {
      status: 'fail',
      detail: 'X-Frame-Options missing. Page can be embedded in an iframe (clickjacking risk).',
      recommendation: "Add: X-Frame-Options: DENY (or SAMEORIGIN if you embed your own pages).",
    };
  }
  const val = xfo.toUpperCase();
  if (val === 'DENY' || val === 'SAMEORIGIN') {
    return { status: 'pass', detail: `X-Frame-Options: ${xfo}. Clickjacking protection enabled.`, evidence: xfo };
  }
  return {
    status: 'warning',
    detail: `Unusual X-Frame-Options value: "${xfo}".`,
    evidence: xfo,
    recommendation: 'Use DENY or SAMEORIGIN.',
  };
}

function checkXContentType(headers: Headers): CheckResult {
  const xcto = h(headers, 'x-content-type-options');
  if (!xcto || xcto.toLowerCase() !== 'nosniff') {
    return {
      status: 'fail',
      detail: 'X-Content-Type-Options: nosniff is missing. Browsers may MIME-sniff responses.',
      recommendation: 'Add: X-Content-Type-Options: nosniff',
    };
  }
  return { status: 'pass', detail: 'X-Content-Type-Options: nosniff prevents MIME-type sniffing.', evidence: xcto };
}

function checkHsts(headers: Headers): CheckResult {
  const hsts = h(headers, 'strict-transport-security');
  if (!hsts) {
    return {
      status: 'fail',
      detail: 'Strict-Transport-Security (HSTS) missing. Browsers may connect over HTTP first.',
      recommendation: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    };
  }
  const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
  const hasSub = hsts.toLowerCase().includes('includesubdomains');
  const hasPreload = hsts.toLowerCase().includes('preload');

  if (maxAge < 86_400) {
    return {
      status: 'warning',
      detail: `HSTS max-age too short (${maxAge}s). Browsers won't cache the HTTPS-only policy reliably.`,
      evidence: hsts,
      recommendation: 'Set max-age to at least 31536000 (1 year).',
    };
  }

  const issues = [];
  if (!hasSub) issues.push('includeSubDomains missing');
  if (!hasPreload) issues.push('preload missing (not in HSTS preload list)');

  if (issues.length) {
    return {
      status: 'warning',
      detail: `HSTS present but incomplete: ${issues.join(', ')}.`,
      evidence: hsts,
      recommendation: 'Add includeSubDomains and preload. Then submit at hstspreload.org.',
    };
  }
  return {
    status: 'pass',
    detail: `HSTS: max-age=${maxAge}s, includeSubDomains, preload. Excellent configuration.`,
    evidence: hsts,
  };
}

function checkReferrerPolicy(headers: Headers): CheckResult {
  const rp = h(headers, 'referrer-policy');
  if (!rp) {
    return {
      status: 'warning',
      detail: 'Referrer-Policy header missing. Browsers use default policy (varies by browser).',
      recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
    };
  }
  const good = ['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin', 'same-origin', 'no-referrer-when-downgrade'];
  const val = rp.toLowerCase();
  if (good.some(v => val.includes(v))) {
    return { status: 'pass', detail: `Referrer-Policy: ${rp}.`, evidence: rp };
  }
  if (val.includes('unsafe-url') || val.includes('no-restriction')) {
    return {
      status: 'fail',
      detail: `Referrer-Policy: ${rp} sends full URLs including query strings to third parties.`,
      evidence: rp,
      recommendation: "Use: Referrer-Policy: strict-origin-when-cross-origin",
    };
  }
  return { status: 'info', detail: `Referrer-Policy: ${rp}.`, evidence: rp };
}

function checkPermissionsPolicy(headers: Headers): CheckResult {
  const pp = h(headers, 'permissions-policy');
  if (!pp) {
    return {
      status: 'warning',
      detail: 'Permissions-Policy header missing. Browser features (camera, geolocation, etc.) are unrestricted.',
      recommendation: "Add: Permissions-Policy: camera=(), microphone=(), geolocation=()",
    };
  }
  return { status: 'pass', detail: 'Permissions-Policy header present.', evidence: pp };
}

function checkCoop(headers: Headers): CheckResult {
  const coop = h(headers, 'cross-origin-opener-policy');
  if (!coop) {
    return {
      status: 'warning',
      detail: 'Cross-Origin-Opener-Policy missing. Site may be vulnerable to XS-Leaks attacks.',
      recommendation: 'Add: Cross-Origin-Opener-Policy: same-origin',
    };
  }
  return { status: 'pass', detail: `COOP: ${coop}.`, evidence: coop };
}

function checkServerHeader(headers: Headers): CheckResult {
  const server = h(headers, 'server');
  if (!server) return { status: 'pass', detail: 'Server header absent — no version information leaked.' };

  // Check for version numbers in server header
  const versionPattern = /[\d.]{3,}/;
  if (versionPattern.test(server)) {
    return {
      status: 'fail',
      detail: `Server header reveals version: "${server}". Attackers can target known CVEs.`,
      evidence: server,
      recommendation: 'Configure your web server to suppress or genericise the Server header.',
    };
  }
  return {
    status: 'warning',
    detail: `Server header reveals software type: "${server}".`,
    evidence: server,
    recommendation: 'Remove or genericise the Server header to avoid fingerprinting.',
  };
}

function checkXPoweredBy(headers: Headers): CheckResult {
  const xpb = h(headers, 'x-powered-by');
  if (!xpb) return { status: 'pass', detail: 'X-Powered-By header absent — technology stack not exposed.' };

  const phpMatch = xpb.match(/PHP\/([\d.]+)/i);
  if (phpMatch) {
    return {
      status: 'fail',
      detail: `X-Powered-By exposes PHP version: ${xpb}. Attackers can target known CVEs for that version.`,
      evidence: xpb,
      recommendation: 'Set expose_php = Off in php.ini and remove X-Powered-By via header_remove() or web server config.',
    };
  }
  return {
    status: 'warning',
    detail: `X-Powered-By reveals technology: "${xpb}".`,
    evidence: xpb,
    recommendation: 'Remove X-Powered-By header via web server config or PHP configuration.',
  };
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runHeaderChecks(targetUrl: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  if (!isTauri()) {
    const checkIds = [
      'header-csp', 'header-x-frame-options', 'header-x-content-type',
      'header-hsts', 'header-referrer-policy', 'header-permissions-policy',
      'header-coop', 'header-server', 'header-x-powered-by',
    ];
    checkIds.forEach(id => results.set(id, SKIPPED_TAURI));
    return results;
  }

  try {
    // Use GET rather than HEAD — some servers/CDNs handle HEAD inconsistently
    // (e.g. Cloudflare may return different headers or stall), and the Tauri
    // http plugin has been observed to cancel HEAD requests under load.
    const res = await auditFetch(targetUrl, { method: 'GET' });
    const headers = res.headers;

    results.set('header-csp', checkCsp(headers));
    results.set('header-x-frame-options', checkXFrameOptions(headers));
    results.set('header-x-content-type', checkXContentType(headers));
    results.set('header-hsts', checkHsts(headers));
    results.set('header-referrer-policy', checkReferrerPolicy(headers));
    results.set('header-permissions-policy', checkPermissionsPolicy(headers));
    results.set('header-coop', checkCoop(headers));
    results.set('header-server', checkServerHeader(headers));
    results.set('header-x-powered-by', checkXPoweredBy(headers));
  } catch (e) {
    const msg = `Could not fetch headers: ${describeError(e)}`;
    const checkIds = [
      'header-csp', 'header-x-frame-options', 'header-x-content-type',
      'header-hsts', 'header-referrer-policy', 'header-permissions-policy',
      'header-coop', 'header-server', 'header-x-powered-by',
    ];
    checkIds.forEach(id => results.set(id, { status: 'error', detail: msg }));
  }

  return results;
}
