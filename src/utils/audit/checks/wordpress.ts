import type { CheckResult } from '../../../data/auditTypes';
import { auditFetch, isTauri, SKIPPED_TAURI, describeError } from '../fetchUtil';

// ─── WP version detection ─────────────────────────────────────────────────────

const WP_VERSION_API = 'https://api.wordpress.org/core/version-check/1.7/';

async function getLatestWpVersion(): Promise<string> {
  const res = await fetch(WP_VERSION_API, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return '';
  const data = await res.json() as { offers?: Array<{ version: string; response: string }> };
  return data.offers?.find(o => o.response === 'upgrade')?.version
    ?? data.offers?.[0]?.version
    ?? '';
}

function parseVersionFromSource(html: string): string | null {
  // <meta name="generator" content="WordPress X.Y.Z" />
  const meta = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+([\d.]+)["']/i);
  if (meta) return meta[1];
  // /wp-includes/js/wp-emoji-release.min.js?ver=X.Y.Z
  const ver = html.match(/[?&]ver=([\d.]+)["']/);
  return ver ? ver[1] : null;
}

async function checkWpVersion(baseUrl: string): Promise<CheckResult> {
  try {
    const [pageRes, latestVersion] = await Promise.all([
      auditFetch(baseUrl, { method: 'GET' }),
      getLatestWpVersion(),
    ]);

    const html = await pageRes.text();
    const detected = parseVersionFromSource(html);

    if (!detected) {
      return {
        status: 'info',
        detail: 'Could not detect WordPress version from page source. Version may be hidden (good).',
        recommendation: 'Confirm that remove_action("wp_head", "wp_generator") is in your theme functions.php.',
      };
    }

    if (!latestVersion) {
      return {
        status: 'warning',
        detail: `WordPress version ${detected} detected but could not verify against WP.org latest version.`,
        evidence: `Detected: ${detected}`,
      };
    }

    const detectedParts = detected.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);
    const isOutdated = detectedParts[0] < latestParts[0]
      || (detectedParts[0] === latestParts[0] && detectedParts[1] < latestParts[1])
      || (detectedParts[0] === latestParts[0] && detectedParts[1] === latestParts[1] && (detectedParts[2] ?? 0) < (latestParts[2] ?? 0));

    if (isOutdated) {
      return {
        status: 'fail',
        detail: `WordPress ${detected} detected — latest is ${latestVersion}. Known vulnerabilities may exist.`,
        evidence: `Detected: ${detected}, Latest: ${latestVersion}`,
        recommendation: `Update WordPress to ${latestVersion} immediately. Enable auto-updates in wp-config.php.`,
      };
    }

    return {
      status: 'pass',
      detail: `WordPress ${detected} is up to date (latest: ${latestVersion}).`,
      evidence: `Detected: ${detected}, Latest: ${latestVersion}`,
    };
  } catch (e) {
    return { status: 'error', detail: `WP version check failed: ${describeError(e)}` };
  }
}

// ─── XML-RPC ──────────────────────────────────────────────────────────────────

async function checkXmlRpc(baseUrl: string): Promise<CheckResult> {
  try {
    const url = `${baseUrl}/xmlrpc.php`;
    const res = await auditFetch(url, {
      method: 'POST',
      body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>',
      headers: { 'Content-Type': 'text/xml' },
    });

    if (res.status === 404 || res.status === 403) {
      return { status: 'pass', detail: `XML-RPC disabled or blocked (HTTP ${res.status}).` };
    }
    if (res.status === 200) {
      const body = await res.text();
      if (body.includes('methodResponse') || body.includes('xml')) {
        return {
          status: 'fail',
          detail: 'XML-RPC is active and responding to method calls. Can be used for brute-force amplification (hundreds of passwords per request) and DDoS reflection.',
          evidence: `HTTP ${res.status} — XML response returned`,
          recommendation: 'Disable XML-RPC. Add to .htaccess: <Files xmlrpc.php>\n  Order Allow,Deny\n  Deny from all\n</Files>\nOr use the Disable XML-RPC plugin.',
        };
      }
    }
    return {
      status: 'warning',
      detail: `XML-RPC returned HTTP ${res.status}. Verify it is not accessible.`,
      evidence: `HTTP ${res.status}`,
    };
  } catch (e) {
    return { status: 'error', detail: `XML-RPC check failed: ${describeError(e)}` };
  }
}

// ─── REST API user enumeration ────────────────────────────────────────────────

async function checkRestUsers(baseUrl: string): Promise<CheckResult> {
  try {
    const url = `${baseUrl}/wp-json/wp/v2/users`;
    const res = await auditFetch(url);

    if (res.status === 401 || res.status === 403) {
      return { status: 'pass', detail: 'REST API /wp/v2/users endpoint requires authentication.' };
    }
    if (res.status === 404) {
      return { status: 'pass', detail: 'REST API /wp/v2/users endpoint not found (may be disabled).' };
    }
    if (res.status === 200) {
      const data = await res.json() as Array<{ id?: number; slug?: string; name?: string }>;
      if (Array.isArray(data) && data.length > 0) {
        const names = data.slice(0, 5).map(u => u.slug ?? u.name ?? `id:${u.id}`).join(', ');
        return {
          status: 'fail',
          detail: `REST API exposes ${data.length} user(s) publicly. Usernames leaked: ${names}.`,
          evidence: `Endpoint: ${url}\nUsers: ${names}`,
          recommendation: 'Add to functions.php:\nadd_filter("rest_endpoints", function($e){ unset($e["/wp/v2/users"]); unset($e["/wp/v2/users/(?P<id>[\\\\d]+)"]); return $e; });',
        };
      }
    }
    return { status: 'info', detail: `REST API /wp/v2/users returned HTTP ${res.status} with no user data.` };
  } catch (e) {
    return { status: 'error', detail: `REST users check failed: ${describeError(e)}` };
  }
}

// ─── Author scan (/?author=1) ─────────────────────────────────────────────────

async function checkAuthorScan(baseUrl: string): Promise<CheckResult> {
  try {
    const url = `${baseUrl}/?author=1`;
    const res = await auditFetch(url, { redirect: 'manual' });

    const location = res.headers.get('location') ?? '';
    if (res.status >= 301 && res.status <= 302 && location.includes('/author/')) {
      // Extract username from redirect URL
      const match = location.match(/\/author\/([^/?#]+)/);
      const username = match?.[1] ?? 'unknown';
      return {
        status: 'fail',
        detail: `/?author=1 redirects to /author/${username} — admin username exposed.`,
        evidence: `Redirect: ${location}`,
        recommendation: 'Prevent author URL enumeration via a plugin (e.g., "Stop User Enumeration") or add to functions.php:\nadd_action("template_redirect", function(){ if(is_author()) wp_redirect(home_url(), 301); exit; });',
      };
    }
    return { status: 'pass', detail: '/?author=1 does not redirect to an author archive — username not enumerable this way.' };
  } catch (e) {
    return { status: 'error', detail: `Author scan check failed: ${describeError(e)}` };
  }
}

// ─── wp-cron exposure ─────────────────────────────────────────────────────────

async function checkWpCron(baseUrl: string): Promise<CheckResult> {
  try {
    const url = `${baseUrl}/wp-cron.php`;
    const res = await auditFetch(url);
    if (res.status === 200) {
      return {
        status: 'warning',
        detail: 'wp-cron.php is publicly accessible. Can be used to trigger heavy scheduled tasks (resource abuse).',
        evidence: `HTTP ${res.status}`,
        recommendation: "Disable default cron: add define('DISABLE_WP_CRON', true) to wp-config.php and add a real server cron: * * * * * php /var/www/wp-cron.php >/dev/null 2>&1",
      };
    }
    return { status: 'pass', detail: `wp-cron.php not directly accessible (HTTP ${res.status}).` };
  } catch (e) {
    return { status: 'error', detail: `wp-cron check failed: ${describeError(e)}` };
  }
}

// ─── Pingback / X-Pingback header ────────────────────────────────────────────

async function checkPingback(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await auditFetch(baseUrl, { method: 'HEAD' });
    const xpb = res.headers.get('x-pingback');
    if (xpb) {
      return {
        status: 'warning',
        detail: 'X-Pingback header present. Pingbacks can be used for DDoS reflection and SSRF.',
        evidence: xpb,
        recommendation: 'Disable pingbacks via Settings > Discussion > Allow link notifications, or add to functions.php:\nadd_filter("xmlrpc_enabled", "__return_false");\nadd_filter("pings_open", "__return_false");',
      };
    }
    return { status: 'pass', detail: 'X-Pingback header absent — pingbacks appear disabled.' };
  } catch (e) {
    return { status: 'error', detail: `Pingback check failed: ${describeError(e)}` };
  }
}

// ─── WP_DEBUG active ─────────────────────────────────────────────────────────

async function checkWpDebug(baseUrl: string): Promise<CheckResult> {
  try {
    const res = await auditFetch(baseUrl, { method: 'GET' });
    const html = await res.text();

    // PHP notices / warnings / fatal errors in source = WP_DEBUG on
    const debugPatterns = [
      { pattern: /<b>Notice<\/b>:/i, label: 'PHP Notice' },
      { pattern: /<b>Warning<\/b>:/i, label: 'PHP Warning' },
      { pattern: /<b>Fatal error<\/b>:/i, label: 'PHP Fatal Error' },
      { pattern: /PHP Stack trace/i, label: 'PHP Stack Trace' },
      { pattern: /wp-content\/debug\.log/i, label: 'debug.log reference' },
    ];

    const found = debugPatterns.filter(p => p.pattern.test(html)).map(p => p.label);

    if (found.length > 0) {
      return {
        status: 'fail',
        detail: `PHP/WP debug output visible in page source: ${found.join(', ')}. Server paths and code internals are exposed.`,
        evidence: found.join(', '),
        recommendation: "Set WP_DEBUG to false in wp-config.php:\ndefine('WP_DEBUG', false);\ndefine('WP_DEBUG_LOG', false);\ndefine('WP_DEBUG_DISPLAY', false);",
      };
    }
    return { status: 'pass', detail: 'No PHP error output or debug notices found in page source.' };
  } catch (e) {
    return { status: 'error', detail: `WP debug check failed: ${describeError(e)}` };
  }
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runWordPressChecks(baseUrl: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  if (!isTauri()) {
    const checkIds = [
      'wp-version', 'wp-xmlrpc', 'wp-rest-users',
      'wp-author-scan', 'wp-cron-exposed', 'wp-pingback', 'wp-debug',
    ];
    checkIds.forEach(id => results.set(id, SKIPPED_TAURI));
    return results;
  }

  const [version, xmlrpc, restUsers, authorScan, wpCron, pingback, wpDebug] = await Promise.all([
    checkWpVersion(baseUrl),
    checkXmlRpc(baseUrl),
    checkRestUsers(baseUrl),
    checkAuthorScan(baseUrl),
    checkWpCron(baseUrl),
    checkPingback(baseUrl),
    checkWpDebug(baseUrl),
  ]);

  results.set('wp-version', version);
  results.set('wp-xmlrpc', xmlrpc);
  results.set('wp-rest-users', restUsers);
  results.set('wp-author-scan', authorScan);
  results.set('wp-cron-exposed', wpCron);
  results.set('wp-pingback', pingback);
  results.set('wp-debug', wpDebug);

  return results;
}
