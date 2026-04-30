import type { CheckResult } from '../../../data/auditTypes';
import { describeError } from '../fetchUtil';

// ─── Cloudflare DNS-over-HTTPS ────────────────────────────────────────────────
// CORS-safe: Cloudflare explicitly allows browser requests to their DoH endpoint.
// We use JSON format (application/dns-json) rather than the binary wire format.

const DOH = 'https://cloudflare-dns.com/dns-query';

interface DoHRecord {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DoHResponse {
  Status: number;
  AD: boolean;           // Authenticated Data — true if DNSSEC validated
  Answer?: DoHRecord[];
}

async function dohQuery(name: string, type: string): Promise<DoHResponse> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`DoH query failed for ${name}/${type}: HTTP ${res.status}`);
  return res.json() as Promise<DoHResponse>;
}

/** Strip surrounding quotes that Cloudflare DoH adds to TXT record data. */
function unquote(s: string): string {
  return s.replace(/^"|"$/g, '');
}

// ─── Individual check runners ─────────────────────────────────────────────────

async function checkMx(domain: string): Promise<CheckResult> {
  try {
    const resp = await dohQuery(domain, 'MX');
    if (!resp.Answer?.length) {
      return {
        status: 'fail',
        detail: 'No MX records found — the domain cannot receive email.',
        recommendation: 'If the domain sends transactional email, add MX records with your mail provider.',
      };
    }
    const hosts = resp.Answer.map(a => a.data).join(', ');
    return { status: 'pass', detail: `${resp.Answer.length} MX record(s) found.`, evidence: hosts };
  } catch (e) {
    return { status: 'error', detail: `MX lookup failed: ${describeError(e)}` };
  }
}

async function checkSpf(_domain: string, txtAnswers: DoHRecord[]): Promise<CheckResult> {
  const spf = txtAnswers.find(a => {
    const d = unquote(a.data);
    return d.startsWith('v=spf1');
  });

  if (!spf) {
    return {
      status: 'fail',
      detail: 'No SPF record found. Anyone can spoof email from this domain.',
      recommendation: 'Add a TXT record: v=spf1 include:<your-mail-provider> -all',
    };
  }

  const data = unquote(spf.data);
  if (data.includes('-all')) {
    return { status: 'pass', detail: 'SPF record found with hard-fail (-all) policy.', evidence: data };
  }
  if (data.includes('~all')) {
    return {
      status: 'warning',
      detail: 'SPF uses soft-fail (~all). Spoofed emails may still be delivered.',
      evidence: data,
      recommendation: 'Upgrade to hard-fail: replace ~all with -all once sure all sending sources are listed.',
    };
  }
  return {
    status: 'warning',
    detail: 'SPF record found but missing an "all" qualifier — policy is incomplete.',
    evidence: data,
    recommendation: 'Add -all at the end of your SPF record.',
  };
}

async function checkDmarc(domain: string): Promise<CheckResult> {
  try {
    const resp = await dohQuery(`_dmarc.${domain}`, 'TXT');
    const record = resp.Answer?.find(a => unquote(a.data).startsWith('v=DMARC1'));

    if (!record) {
      return {
        status: 'fail',
        detail: 'No DMARC record found. Phishing using your domain is undetected.',
        recommendation: 'Add a TXT record at _dmarc.yourdomain.com:\nv=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
      };
    }

    const data = unquote(record.data);
    const pMatch = data.match(/p=(\w+)/);
    const policy = pMatch?.[1] ?? 'none';

    if (policy === 'none') {
      return {
        status: 'warning',
        detail: 'DMARC found with p=none (monitoring only). No enforcement — phishing emails are not blocked.',
        evidence: data,
        recommendation: 'Upgrade to p=quarantine or p=reject once you have reviewed DMARC reports.',
      };
    }
    return {
      status: 'pass',
      detail: `DMARC policy: ${policy}. Spoofed emails will be ${policy === 'reject' ? 'rejected' : 'quarantined'}.`,
      evidence: data,
    };
  } catch (e) {
    return { status: 'error', detail: `DMARC lookup failed: ${describeError(e)}` };
  }
}

async function checkDkim(domain: string): Promise<CheckResult> {
  const selectors = ['google', 'default', 'k1', 'mail', 'selector1', 'selector2', 'dkim', 'email', 's1', 's2'];
  const found: string[] = [];

  await Promise.all(
    selectors.map(async sel => {
      try {
        const resp = await dohQuery(`${sel}._domainkey.${domain}`, 'TXT');
        if (resp.Answer?.some(a => unquote(a.data).includes('v=DKIM1'))) {
          found.push(`${sel}._domainkey.${domain}`);
        }
      } catch { /* ignore per-selector errors */ }
    })
  );

  if (found.length === 0) {
    return {
      status: 'warning',
      detail: 'No DKIM records found at common selectors. DKIM may use a non-standard selector.',
      recommendation: 'Configure DKIM signing with your email provider. Check provider docs for the selector name.',
    };
  }
  return {
    status: 'pass',
    detail: `DKIM record(s) found at ${found.length} selector(s).`,
    evidence: found.join('\n'),
  };
}

async function checkCaa(domain: string): Promise<CheckResult> {
  try {
    const resp = await dohQuery(domain, 'CAA');
    if (!resp.Answer?.length) {
      return {
        status: 'warning',
        detail: 'No CAA records found. Any Certificate Authority can issue TLS certificates for this domain.',
        recommendation: 'Add CAA records to restrict certificate issuance:\n0 issue "letsencrypt.org"\n0 issuewild ";"',
      };
    }
    const issuers = resp.Answer.map(a => a.data).join(', ');
    return { status: 'pass', detail: `${resp.Answer.length} CAA record(s) restrict certificate issuance.`, evidence: issuers };
  } catch (e) {
    return { status: 'error', detail: `CAA lookup failed: ${describeError(e)}` };
  }
}

async function checkDnssec(domain: string): Promise<CheckResult> {
  try {
    const resp = await dohQuery(domain, 'A');
    if (resp.AD) {
      return { status: 'pass', detail: 'DNSSEC is enabled and validated by Cloudflare resolver.' };
    }
    return {
      status: 'warning',
      detail: 'DNSSEC is not enabled. DNS responses are not cryptographically verified.',
      recommendation: 'Enable DNSSEC through your domain registrar or DNS provider.',
    };
  } catch (e) {
    return { status: 'error', detail: `DNSSEC check failed: ${describeError(e)}` };
  }
}

// ─── BIMI check ───────────────────────────────────────────────────────────────

async function checkBimi(domain: string): Promise<CheckResult> {
  try {
    const resp = await dohQuery(`default._bimi.${domain}`, 'TXT');
    const record = resp.Answer?.find(a => unquote(a.data).includes('v=BIMI1'));
    if (!record) {
      return {
        status: 'info',
        detail: 'No BIMI record found. BIMI (Brand Indicators for Message Identification) lets you display a verified logo in email clients.',
        recommendation: 'Consider adding BIMI after achieving DMARC enforcement (p=quarantine or reject). Requires a verified SVG logo at a public URL.',
      };
    }
    const data = unquote(record.data);
    const hasLogo = data.includes('l=');
    return {
      status: 'pass',
      detail: `BIMI record found${hasLogo ? ' with logo URL' : ''}.`,
      evidence: data,
    };
  } catch (e) {
    return { status: 'error', detail: `BIMI lookup failed: ${describeError(e)}` };
  }
}

// ─── MTA-STS check ────────────────────────────────────────────────────────────

async function checkMtaSts(domain: string): Promise<CheckResult> {
  try {
    // Step 1: Check TXT record
    const txtResp = await dohQuery(`_mta-sts.${domain}`, 'TXT');
    const txtRecord = txtResp.Answer?.find(a => unquote(a.data).includes('v=STSv1'));

    if (!txtRecord) {
      return {
        status: 'warning',
        detail: 'No MTA-STS record found. Email in transit to this domain is not enforced to use TLS.',
        recommendation: 'Implement MTA-STS to force SMTP servers to use TLS when delivering email to your domain. Publish a TXT record at _mta-sts.yourdomain.com and host a policy file at https://mta-sts.yourdomain.com/.well-known/mta-sts.txt.',
      };
    }

    // Step 2: Fetch policy file
    try {
      const policyRes = await fetch(`https://mta-sts.${domain}/.well-known/mta-sts.txt`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (policyRes.ok) {
        const policy = await policyRes.text();
        const modeMatch = policy.match(/mode:\s*(\w+)/);
        const mode = modeMatch?.[1] ?? 'unknown';
        return {
          status: mode === 'enforce' ? 'pass' : 'warning',
          detail: `MTA-STS policy found. Mode: ${mode}.${mode === 'testing' ? ' Currently in testing mode — not yet enforced.' : ''}`,
          evidence: policy.slice(0, 200),
        };
      }
    } catch { /* policy file not reachable */ }

    return {
      status: 'warning',
      detail: 'MTA-STS TXT record exists but policy file not reachable at https://mta-sts.' + domain + '/.well-known/mta-sts.txt.',
      evidence: unquote(txtRecord.data),
      recommendation: 'Ensure the MTA-STS policy file is hosted and accessible.',
    };
  } catch (e) {
    return { status: 'error', detail: `MTA-STS check failed: ${describeError(e)}` };
  }
}

// ─── Module entry point ───────────────────────────────────────────────────────

export async function runDnsChecks(domain: string): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  // Fetch TXT records once and reuse for both SPF and any other TXT-based checks
  let txtAnswers: DoHRecord[] = [];
  try {
    const txt = await dohQuery(domain, 'TXT');
    txtAnswers = txt.Answer ?? [];
  } catch { /* individual checks handle their own errors */ }

  const [mx, dmarc, dkim, caa, dnssec, spf, bimi, mtaSts] = await Promise.all([
    checkMx(domain),
    checkDmarc(domain),
    checkDkim(domain),
    checkCaa(domain),
    checkDnssec(domain),
    checkSpf(domain, txtAnswers),
    checkBimi(domain),
    checkMtaSts(domain),
  ]);

  results.set('dns-mx', mx);
  results.set('dns-spf', spf);
  results.set('dns-dmarc', dmarc);
  results.set('dns-dkim', dkim);
  results.set('dns-caa', caa);
  results.set('dns-dnssec', dnssec);
  results.set('dns-bimi', bimi);
  results.set('dns-mta-sts', mtaSts);

  return results;
}
