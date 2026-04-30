import type { CheckResult } from '../../../data/auditTypes';
import type { AuditApiKeys } from '../../../data/auditTypes';
import { auditFetch, skippedApiKey, describeError } from '../fetchUtil';

// ─── Google Safe Browsing ─────────────────────────────────────────────────────
// Docs: https://developers.google.com/safe-browsing/v4/lookup-api
// Free API key: https://console.cloud.google.com/

async function checkSafeBrowsing(url: string, apiKey: string): Promise<CheckResult> {
  try {
    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
    const body = {
      client: { clientId: 'post-watch', clientVersion: '2.1' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    };

    const res = await auditFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 400) return { status: 'error', detail: 'Google Safe Browsing: invalid API key or request.' };
      return { status: 'error', detail: `Google Safe Browsing API error: HTTP ${res.status}` };
    }

    const data = await res.json() as { matches?: Array<{ threatType: string }> };

    if (data.matches?.length) {
      const threats = [...new Set(data.matches.map(m => m.threatType))].join(', ');
      return {
        status: 'fail',
        detail: `Domain flagged by Google Safe Browsing: ${threats}.`,
        evidence: threats,
        recommendation: 'Search Google Search Console for security issues and submit a review request once malware/phishing has been removed.',
      };
    }

    return { status: 'pass', detail: 'Not flagged by Google Safe Browsing.' };
  } catch (e) {
    return { status: 'error', detail: `Safe Browsing check failed: ${describeError(e)}` };
  }
}

// ─── VirusTotal ───────────────────────────────────────────────────────────────
// Docs: https://developers.virustotal.com/reference/domain-info
// Free API: 4 requests/minute, 500/day

async function checkVirusTotal(domain: string, apiKey: string): Promise<CheckResult> {
  try {
    const res = await auditFetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
      headers: { 'x-apikey': apiKey },
    });

    if (res.status === 401) return { status: 'error', detail: 'VirusTotal: invalid API key.' };
    if (res.status === 404) return { status: 'info', detail: 'Domain not found in VirusTotal database (may be new/low traffic).' };
    if (!res.ok) return { status: 'error', detail: `VirusTotal API error: HTTP ${res.status}` };

    const data = await res.json() as {
      data?: {
        attributes?: {
          last_analysis_stats?: {
            malicious: number;
            suspicious: number;
            undetected: number;
            harmless: number;
          };
          reputation?: number;
        };
      };
    };

    const stats = data.data?.attributes?.last_analysis_stats;
    const reputation = data.data?.attributes?.reputation ?? 0;

    if (!stats) return { status: 'error', detail: 'VirusTotal returned unexpected data structure.' };

    const { malicious, suspicious } = stats;
    const total = malicious + suspicious + (stats.undetected ?? 0) + (stats.harmless ?? 0);

    if (malicious > 0) {
      return {
        status: 'fail',
        detail: `VirusTotal: ${malicious}/${total} security vendors flag this domain as malicious.`,
        evidence: `Malicious: ${malicious}, Suspicious: ${suspicious}, Harmless: ${stats.harmless}, Reputation score: ${reputation}`,
        recommendation: 'Check VirusTotal.com for the specific vendors flagging the domain. Investigate for malware injection.',
      };
    }
    if (suspicious > 0) {
      return {
        status: 'warning',
        detail: `VirusTotal: ${suspicious}/${total} vendors flag this domain as suspicious.`,
        evidence: `Suspicious: ${suspicious}, Malicious: ${malicious}, Reputation: ${reputation}`,
        recommendation: 'Review VirusTotal.com for details. May be a false positive, but investigate nonetheless.',
      };
    }
    return {
      status: 'pass',
      detail: `Not flagged by any of ${total} VirusTotal security vendors. Reputation score: ${reputation}.`,
    };
  } catch (e) {
    return { status: 'error', detail: `VirusTotal check failed: ${describeError(e)}` };
  }
}

// ─── Certificate Transparency (crt.sh) ───────────────────────────────────────
// Checks for unexpected certificates issued for the domain.
// CORS-safe: crt.sh allows cross-origin JSON requests.

interface CrtShEntry {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
}

async function checkCrtSh(domain: string): Promise<CheckResult> {
  try {
    const res = await auditFetch(`https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`);

    if (!res.ok) return { status: 'error', detail: `crt.sh API error: HTTP ${res.status}` };

    const certs = await res.json() as CrtShEntry[];

    if (!Array.isArray(certs) || certs.length === 0) {
      return {
        status: 'info',
        detail: 'No certificates found in Certificate Transparency logs. Domain may be new or using a private CA.',
      };
    }

    // Deduplicate by issuer_name
    const issuers = [...new Set(certs.map(c => c.issuer_name.split(',')[0].replace('O=', '').trim()))];

    // Look for very recently-issued certs from unusual CAs (potential mis-issuance / takeover)
    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const recentCerts = certs.filter(c => new Date(c.entry_timestamp).getTime() > thirtyDaysAgo);
    const recentIssuers = [...new Set(recentCerts.map(c => c.issuer_name.split(',')[0].replace('O=', '').trim()))];

    return {
      status: 'pass',
      detail: `${certs.length} certificate(s) found in CT logs across ${issuers.length} CA(s).${recentCerts.length > 0 ? ` ${recentCerts.length} issued in the last 30 days.` : ''}`,
      evidence: `CAs: ${issuers.slice(0, 5).join(', ')}${issuers.length > 5 ? ` (+${issuers.length - 5} more)` : ''}\nRecent CAs: ${recentIssuers.join(', ') || 'none'}`,
    };
  } catch (e) {
    return { status: 'error', detail: `crt.sh check failed: ${describeError(e)}` };
  }
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runReputationChecks(
  targetUrl: string,
  domain: string,
  apiKeys: AuditApiKeys,
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  const [safeBrowsing, virusTotal, crtSh] = await Promise.all([
    apiKeys.googleSafeBrowsing
      ? checkSafeBrowsing(targetUrl, apiKeys.googleSafeBrowsing)
      : Promise.resolve(skippedApiKey('Google Safe Browsing')),
    apiKeys.virusTotal
      ? checkVirusTotal(domain, apiKeys.virusTotal)
      : Promise.resolve(skippedApiKey('VirusTotal')),
    checkCrtSh(domain),
  ]);

  results.set('rep-safe-browsing', safeBrowsing);
  results.set('rep-virustotal', virusTotal);
  results.set('rep-crt-sh', crtSh);

  return results;
}
