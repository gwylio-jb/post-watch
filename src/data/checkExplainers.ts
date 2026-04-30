/**
 * Per-check narrative metadata — the "what this means" block rendered under
 * every scan finding, and in the printed report's expanded view.
 *
 * Four facets per check, keyed by the engine's `check.id`:
 *   - attackerNarrative: what a real threat actor does with this fact
 *   - plainEnglish:      one-line restatement for non-technical readers
 *   - whyItMatters:      business impact / risk exposure
 *   - whatToDo:          remediation in plain English
 *
 * Missing keys render no explainer block — presence is purely additive.
 *
 * Voice: terse, second-person ("your site"), concrete. No marketing.
 */

export interface CheckExplainer {
  attackerNarrative: string;
  plainEnglish: string;
  whyItMatters: string;
  whatToDo: string;
}

export const checkExplainers: Record<string, CheckExplainer> = {
  // ── DNS & Email Security ────────────────────────────────────────────────
  'dns-mx': {
    attackerNarrative: 'An attacker mapping your infrastructure starts with MX records to learn which mail provider handles your email and which inbox system (Google, Microsoft, Proofpoint) to target for phishing.',
    plainEnglish: 'MX records tell the world which servers receive mail for your domain.',
    whyItMatters: 'Missing MX records mean email addressed to your domain goes nowhere. Present records leak the mail platform, which shapes a phishing attacker\'s lure.',
    whatToDo: 'If you send/receive email, confirm at least one MX record is published at your DNS provider. Otherwise publish a null MX ("." with priority 0) to signal "does not accept mail".',
  },
  'dns-spf': {
    attackerNarrative: 'Without SPF, an attacker can spoof email from your domain to your own staff, suppliers and customers — no server compromise required.',
    plainEnglish: 'SPF lists the servers allowed to send email on behalf of your domain.',
    whyItMatters: 'Absent or permissive SPF is the single most common enabler of invoice fraud, CEO impersonation and supplier payment redirects.',
    whatToDo: 'Publish a TXT record starting v=spf1 that includes every legitimate sender (your mail provider, marketing platform, CRM) and ends with -all (hard fail) once you\'ve confirmed coverage.',
  },
  'dns-dmarc': {
    attackerNarrative: 'Attackers actively look for domains without DMARC enforcement because spoofed mail from those domains lands directly in recipient inboxes.',
    plainEnglish: 'DMARC tells recipient mail servers what to do when a message claiming to be from you fails SPF or DKIM.',
    whyItMatters: 'Without p=reject or p=quarantine, SPF and DKIM give you reporting only — no actual protection against spoofing.',
    whatToDo: 'Publish _dmarc.yourdomain TXT: start at p=none with rua reporting, review a week of reports, then move to quarantine and finally reject.',
  },
  'dns-dkim': {
    attackerNarrative: 'Missing DKIM means the attacker can strip the SPF check by bouncing mail through a permitted relay, because there\'s no cryptographic signature pinning the body to your domain.',
    plainEnglish: 'DKIM cryptographically signs outbound mail so recipients can verify it really came from you and wasn\'t modified.',
    whyItMatters: 'DKIM is half of the DMARC pass condition. Without it, legitimate forwarded mail often fails DMARC and gets dropped.',
    whatToDo: 'Enable DKIM signing in your mail provider\'s admin console and publish the provided public key at selector._domainkey.yourdomain.',
  },
  'dns-caa': {
    attackerNarrative: 'A determined attacker with some ability to manipulate DNS validation can trick a second CA into issuing a certificate for your domain — CAA records slam that door shut.',
    plainEnglish: 'CAA records tell certificate authorities which of them are allowed to issue TLS certificates for your domain.',
    whyItMatters: 'Mis-issuance is rare but catastrophic. A rogue cert lets the attacker MITM your HTTPS traffic without browser warnings.',
    whatToDo: 'Publish CAA records at your DNS provider naming only the CA(s) you actually use (letsencrypt.org, digicert.com, etc.).',
  },
  'dns-dnssec': {
    attackerNarrative: 'Without DNSSEC, an attacker positioned upstream (coffee-shop Wi-Fi, compromised router, BGP hijack) can forge DNS responses and redirect your visitors to a lookalike site.',
    plainEnglish: 'DNSSEC cryptographically signs DNS records so resolvers can detect tampering.',
    whyItMatters: 'DNSSEC is the only defence against cache poisoning and DNS hijacking that doesn\'t rely on endpoint software.',
    whatToDo: 'Enable DNSSEC in your registrar control panel. Most modern registrars (Cloudflare, Google Domains, Gandi) do this in one click.',
  },
  'dns-bimi': {
    attackerNarrative: 'BIMI is a trust signal — without it, attackers\' phishing emails and your legitimate ones look identical in the inbox.',
    plainEnglish: 'BIMI displays your brand logo next to legitimate emails in supporting clients (Gmail, Apple Mail).',
    whyItMatters: 'Not a security control on its own, but the presence of a logo trains users to notice its absence on spoofed mail.',
    whatToDo: 'After DMARC is at p=quarantine or p=reject, obtain a Verified Mark Certificate and publish the BIMI record.',
  },
  'dns-mta-sts': {
    attackerNarrative: 'Without MTA-STS, an active MITM can downgrade SMTP connections to plaintext and read every inbound email in transit.',
    plainEnglish: 'MTA-STS enforces TLS for servers delivering mail TO your domain.',
    whyItMatters: 'SMTP opportunistic TLS is trivially downgradeable. MTA-STS closes that door.',
    whatToDo: 'Publish a policy at https://mta-sts.yourdomain/.well-known/mta-sts.txt and a _mta-sts TXT record. Start in testing mode.',
  },

  // ── TLS / SSL ───────────────────────────────────────────────────────────
  'tls-grade': {
    attackerNarrative: 'A low SSL Labs grade means the attacker has a choice of known cipher/protocol weaknesses — POODLE, BEAST, Logjam — to attack your HTTPS with.',
    plainEnglish: 'SSL Labs grades your overall TLS configuration from A+ down to F.',
    whyItMatters: 'Anything below A is an unforced error — modern servers achieve A+ with default settings.',
    whatToDo: 'Apply the Mozilla "Intermediate" SSL configuration for your web server, then re-test.',
  },
  'tls-cert-expiry': {
    attackerNarrative: 'An expired certificate forces browsers to show a full-page warning that most users will dismiss — training them to accept warnings an attacker can later exploit.',
    plainEnglish: 'Days remaining until your TLS certificate expires.',
    whyItMatters: 'Expired certs produce outages and erode user trust. Short-lived certs (< 14 days remaining) indicate renewal has failed.',
    whatToDo: 'Set up auto-renewal (certbot, ACME client, hosting provider setting). Aim for renewal 30 days before expiry.',
  },
  'tls-protocols': {
    attackerNarrative: 'If TLS 1.0 or 1.1 are enabled, a MITM attacker can downgrade modern browsers onto those broken protocols and read or inject traffic.',
    plainEnglish: 'Which TLS/SSL protocol versions your server will negotiate.',
    whyItMatters: 'TLS 1.0/1.1 have been deprecated since 2020. Still accepting them is a compliance failure (PCI DSS, HIPAA) and a real attack surface.',
    whatToDo: 'Disable TLS 1.0, TLS 1.1, SSLv2, and SSLv3 in your web server config. Require TLS 1.2+ only.',
  },
  'tls-pfs': {
    attackerNarrative: 'Without Perfect Forward Secrecy, an attacker who records traffic today and later obtains the server\'s private key can decrypt every past session.',
    plainEnglish: 'PFS ensures each session uses ephemeral keys — compromising the server key doesn\'t reveal past traffic.',
    whyItMatters: 'Relevant to any site handling sensitive data — past logins, invoices, personal information can be retrospectively decrypted.',
    whatToDo: 'Configure ECDHE cipher suites first in your cipher preference order. The Mozilla Intermediate config gets this right by default.',
  },

  // ── Security Headers ────────────────────────────────────────────────────
  'header-csp': {
    attackerNarrative: 'Without CSP, any XSS the attacker finds lets them load malicious scripts from any origin, steal cookies, and pivot into admin sessions.',
    plainEnglish: 'Content-Security-Policy tells the browser which script/style sources are allowed.',
    whyItMatters: 'CSP is the most effective mitigation for XSS. A weak CSP (unsafe-inline, unsafe-eval) is barely better than none.',
    whatToDo: 'Start with Report-Only CSP, catalogue your real resource origins, then enforce. Use nonces rather than unsafe-inline.',
  },
  'header-x-frame-options': {
    attackerNarrative: 'Without X-Frame-Options or frame-ancestors in CSP, an attacker can iframe your admin/banking pages inside a decoy and clickjack users into authorising actions.',
    plainEnglish: 'X-Frame-Options controls whether other sites can embed your pages in an iframe.',
    whyItMatters: 'Clickjacking attacks are invisible to users — they think they\'re clicking the attacker\'s page but are actually interacting with your embedded site.',
    whatToDo: 'Send X-Frame-Options: DENY (or SAMEORIGIN if you embed internally). Or use CSP frame-ancestors for finer control.',
  },
  'header-x-content-type': {
    attackerNarrative: 'Without this header, an attacker who uploads a file with a misleading MIME type can trick the browser into executing it as script.',
    plainEnglish: 'Stops browsers guessing ("sniffing") a file\'s type from content instead of trusting the server.',
    whyItMatters: 'MIME sniffing enables XSS via uploaded files (classic "upload an image, have it executed as JavaScript").',
    whatToDo: 'Send X-Content-Type-Options: nosniff on every response. It\'s a one-line fix with no downside.',
  },
  'header-hsts': {
    attackerNarrative: 'Without HSTS, an attacker on the visitor\'s network can intercept the first HTTP request and strip the upgrade to HTTPS — visitors never realise.',
    plainEnglish: 'HSTS forces browsers to use HTTPS for your domain for a period of time.',
    whyItMatters: 'HSTS closes the SSL-stripping gap. Preload adds your domain to a hardcoded browser list, protecting first-ever visits.',
    whatToDo: 'Send Strict-Transport-Security: max-age=63072000; includeSubDomains; preload. Submit to hstspreload.org once stable.',
  },
  'header-referrer-policy': {
    attackerNarrative: 'The attacker data-mines your users\' Referer headers to learn what pages they came from — often leaking session tokens embedded in URLs.',
    plainEnglish: 'Controls how much URL detail is sent to other sites when your users follow a link.',
    whyItMatters: 'Default browser behaviour leaks full URLs on cross-origin navigation, which is a privacy and sometimes-security issue.',
    whatToDo: 'Send Referrer-Policy: strict-origin-when-cross-origin at minimum. Or no-referrer if you never need it.',
  },
  'header-permissions-policy': {
    attackerNarrative: 'Compromised third-party scripts on your site can silently ask for camera, mic, or geolocation. Permissions-Policy revokes those capabilities wholesale.',
    plainEnglish: 'Limits which browser features (camera, mic, geolocation, etc.) can run on your pages.',
    whyItMatters: 'Primarily privacy, but also a defence-in-depth layer if a CDN-hosted script is ever swapped under you.',
    whatToDo: 'Send a Permissions-Policy header disabling every feature you don\'t actively use.',
  },
  'header-coop': {
    attackerNarrative: 'Without COOP, a malicious tab opened from your site keeps a window reference that can be used for XS-Leaks and Spectre-style cross-origin attacks.',
    plainEnglish: 'Cross-Origin-Opener-Policy isolates your site from any other window that opens it.',
    whyItMatters: 'Required for some advanced web APIs (SharedArrayBuffer) and defends against a growing class of cross-origin leaks.',
    whatToDo: 'Send Cross-Origin-Opener-Policy: same-origin.',
  },
  'header-server': {
    attackerNarrative: 'The Server header tells the attacker exactly which web server and version you\'re running — they cross-reference against the CVE database and pick their exploit.',
    plainEnglish: 'Your web server\'s identity, often including version numbers.',
    whyItMatters: 'Information disclosure. Not a vuln by itself, but it accelerates an attacker\'s reconnaissance.',
    whatToDo: 'Remove or genericise the Server header (ServerTokens Prod in Apache, server_tokens off in nginx).',
  },
  'header-x-powered-by': {
    attackerNarrative: 'X-Powered-By often exposes the exact PHP version, letting the attacker immediately pull CVEs for that build.',
    plainEnglish: 'Legacy header that exposes the runtime (PHP/ASP.NET/etc.) and often its version.',
    whyItMatters: 'Version leakage speeds up attacker recon. No legitimate user sees this header.',
    whatToDo: 'Disable in PHP (expose_php = Off) or strip at the web server. Zero functional cost.',
  },

  // ── WordPress Core ──────────────────────────────────────────────────────
  'wp-version': {
    attackerNarrative: 'An attacker knowing you\'re three WordPress versions behind simply pulls the matching exploit from public databases and runs it.',
    plainEnglish: 'Which version of WordPress your site is running.',
    whyItMatters: 'Out-of-date core is the single largest driver of mass WordPress compromise. Attackers scan for known-vulnerable versions at internet scale.',
    whatToDo: 'Enable auto-updates for minor releases at minimum. Test and apply major releases within two weeks.',
  },
  'wp-xmlrpc': {
    attackerNarrative: 'Attackers use XML-RPC\'s system.multicall to try thousands of username/password combinations in a single HTTP request — bypassing most rate limits.',
    plainEnglish: 'XML-RPC is a legacy WordPress API rarely needed on modern sites.',
    whyItMatters: 'Primary vector for brute-force and DDoS amplification against WordPress installs.',
    whatToDo: 'Block /xmlrpc.php at the web server or via a plugin (Disable XML-RPC). Only leave enabled if Jetpack or the mobile app absolutely requires it.',
  },
  'wp-rest-users': {
    attackerNarrative: 'The attacker grabs every username on the site in a single unauthenticated request, then brute-forces passwords against those accounts.',
    plainEnglish: 'A WordPress API endpoint that can list all user accounts without logging in.',
    whyItMatters: 'Gives an attacker half of every login credential for free.',
    whatToDo: 'Install a plugin that restricts /wp-json/wp/v2/users to authenticated requests, or block it at the web server.',
  },
  'wp-author-scan': {
    attackerNarrative: 'Requesting /?author=N redirects to the username\'s author page, silently revealing admin account names for brute-force.',
    plainEnglish: 'A side-channel that leaks usernames through redirect URLs.',
    whyItMatters: 'Same risk as REST user enumeration, different vector. Attackers try both.',
    whatToDo: 'Redirect /?author= queries to the homepage, or use a hardening plugin (WPS Hide Login, iThemes Security).',
  },
  'wp-cron-exposed': {
    attackerNarrative: 'The attacker can hammer wp-cron.php to trigger CPU-heavy maintenance tasks over and over, starving the site of resources.',
    plainEnglish: 'WordPress\'s scheduled-task endpoint reachable from the open internet.',
    whyItMatters: 'Denial of service by amplification — one request can cascade into dozens of internal jobs.',
    whatToDo: 'Disable public wp-cron in wp-config (DISABLE_WP_CRON = true) and run it from a system cron every 5 minutes.',
  },
  'wp-pingback': {
    attackerNarrative: 'Attackers chain thousands of pingback-enabled WordPress sites together to launch reflected DDoS attacks at a third-party target.',
    plainEnglish: 'A legacy feature that lets other blogs notify yours of links.',
    whyItMatters: 'Your site becomes an unwitting participant in attacks on others. Also an SSRF vector.',
    whatToDo: 'Disable pingbacks (Settings → Discussion, uncheck "Allow link notifications") or block at web server.',
  },
  'wp-debug': {
    attackerNarrative: 'Error output tells the attacker your PHP version, installed plugins, filesystem layout, and often database queries — a reconnaissance jackpot.',
    plainEnglish: 'Debug mode prints raw PHP errors to your public pages.',
    whyItMatters: 'Massive information leak. Also suggests the site was deployed by someone who didn\'t follow basic hygiene — more weaknesses likely.',
    whatToDo: 'Set WP_DEBUG = false in wp-config.php. Log errors to a file instead (WP_DEBUG_LOG = true).',
  },
  'wp-plugin-detection': {
    attackerNarrative: 'The attacker enumerates your plugins, cross-references versions against wpscan.com\'s vulnerability feed, and fires the first working exploit.',
    plainEnglish: 'Which WordPress plugins are installed and whether they\'re current.',
    whyItMatters: 'Plugins are the #1 source of WordPress vulnerabilities. Out-of-date ones are a live fire risk.',
    whatToDo: 'Enable auto-updates for plugins. Remove any you\'re not using. Subscribe to a plugin-vulnerability feed (Patchstack, Wordfence).',
  },
  'wp-malware-patterns': {
    attackerNarrative: 'These patterns are how prior attackers persist — web shells, cryptocurrency miners, SEO-spam redirects. Finding them means the site is actively compromised.',
    plainEnglish: 'Known indicators of compromise in the page source.',
    whyItMatters: 'If any pattern matches, the site is already owned. Treat as an incident.',
    whatToDo: 'Take the site offline, restore from a clean backup, rotate all credentials, then investigate how the attacker got in before returning to production.',
  },
  'wp-login-protection': {
    attackerNarrative: 'Without rate-limiting or a CAPTCHA, the attacker can try millions of passwords against wp-login.php until one works.',
    plainEnglish: 'Whether the login page resists automated password-guessing.',
    whyItMatters: 'Brute-force is the most common attack on WordPress. Unprotected login pages are compromised within days.',
    whatToDo: 'Install a hardening plugin (Wordfence, Solid Security, Limit Login Attempts Reloaded) and enable 2FA for every admin account.',
  },
  'wp-upload-php': {
    attackerNarrative: 'If uploads can execute PHP, the attacker uploads a web shell disguised as an image and owns the server.',
    plainEnglish: 'Whether PHP files in the uploads directory will actually run.',
    whyItMatters: 'Privilege escalation from "can upload a file" to "can run any code". Game over.',
    whatToDo: 'Add a .htaccess or nginx rule blocking PHP execution in /wp-content/uploads/.',
  },
  'wp-rest-routes': {
    attackerNarrative: 'Non-standard REST routes (plugin-added endpoints) are less battle-tested and often expose data the plugin author didn\'t intend to.',
    plainEnglish: 'Extra API endpoints exposed by plugins.',
    whyItMatters: 'Plugin REST endpoints have been a steady source of authentication bypasses and data-leak CVEs.',
    whatToDo: 'Review each namespace. If the plugin isn\'t needed, remove it. If it is, confirm the endpoints are authenticated as expected.',
  },
  'wp-admin-custom': {
    attackerNarrative: 'Default /wp-admin/ is the first thing every brute-force bot hits. A custom path breaks the automated attacks entirely.',
    plainEnglish: 'Whether the admin URL is at its default location.',
    whyItMatters: 'Obscurity isn\'t security on its own, but it dramatically reduces brute-force traffic and log noise.',
    whatToDo: 'Use WPS Hide Login or equivalent to move wp-admin to a non-guessable path. Keep 2FA as the real defence.',
  },
  'wp-php-version': {
    attackerNarrative: 'EOL PHP versions receive no security patches — the attacker picks any published CVE post-EOL and it will work forever.',
    plainEnglish: 'The version of PHP your server is running.',
    whyItMatters: 'PHP 7.x and earlier are unsupported. Staying on them guarantees unpatched vulnerabilities over time.',
    whatToDo: 'Upgrade to PHP 8.2 or later in your hosting control panel. Test in staging first.',
  },

  // ── File Exposure ───────────────────────────────────────────────────────
  'file-wp-config': {
    attackerNarrative: 'A readable wp-config.php hands the attacker your database credentials, auth salts, and keys — instant full-site takeover.',
    plainEnglish: 'Your WordPress configuration file, directly downloadable.',
    whyItMatters: 'Category-defining breach. Any exposure here is a P0.',
    whatToDo: 'Block direct access at the web server (deny from all in .htaccess, or location block in nginx). Move wp-config one directory above the web root if possible.',
  },
  'file-wp-config-bak': {
    attackerNarrative: 'Attackers know developers leave backup copies (wp-config.php.bak, wp-config.old) after edits — they scan for exactly these filenames.',
    plainEnglish: 'Backup copies of wp-config sitting in the web root.',
    whyItMatters: 'Same severity as exposing wp-config itself — credentials in plaintext.',
    whatToDo: 'Delete the backup files. Educate whoever is editing on the server to use a real backup strategy.',
  },
  'file-env': {
    attackerNarrative: '.env files commonly contain API keys, cloud credentials, and database URLs in plaintext — a one-stop shop for lateral movement.',
    plainEnglish: 'A .env configuration file publicly downloadable.',
    whyItMatters: '.env exposure often leaks credentials for dozens of upstream services, not just the site itself.',
    whatToDo: 'Move .env outside the web root. Rotate every credential it contained. Audit access logs for prior downloads.',
  },
  'file-git-config': {
    attackerNarrative: 'With .git/config reachable, the attacker walks the git tree and downloads your entire source history, including any secrets previously committed.',
    plainEnglish: 'Your Git repository exposed on the public web.',
    whyItMatters: 'Full source-code disclosure, often including historical secrets never rotated.',
    whatToDo: 'Delete the .git directory from the deployed web root. Never deploy by git-clone into a public path.',
  },
  'file-debug-log': {
    attackerNarrative: 'debug.log accumulates errors containing file paths, query snippets, and occasionally credentials — a running commentary on your infrastructure.',
    plainEnglish: 'WordPress\'s debug log, readable from the internet.',
    whyItMatters: 'Ongoing information leak. Errors logged there can include sensitive data.',
    whatToDo: 'Delete the file. Disable WP_DEBUG_LOG or redirect logs outside the web root.',
  },
  'file-readme': {
    attackerNarrative: 'readme.html confirms WordPress is installed and often reveals the exact version — shortening the attacker\'s recon phase.',
    plainEnglish: 'A WordPress-shipped readme file that announces the version.',
    whyItMatters: 'Minor — just information disclosure. But zero legitimate users need it.',
    whatToDo: 'Delete it, or block access in your web server config.',
  },
  'file-license': {
    attackerNarrative: 'Confirms WordPress is installed. The attacker now knows which CMS-specific attacks to try.',
    plainEnglish: 'WordPress\'s GPL licence file, present by default.',
    whyItMatters: 'Minor fingerprinting signal. Easy to remove.',
    whatToDo: 'Delete or block access. No functional impact.',
  },
  'file-phpinfo': {
    attackerNarrative: 'phpinfo() pages dump every PHP setting, server path, and often database credentials — the holy grail of server fingerprinting.',
    plainEnglish: 'Developer diagnostic files leaking your server config.',
    whyItMatters: 'Should never exist in production. Their presence usually signals a sloppy deployment.',
    whatToDo: 'Delete all phpinfo.php / info.php / test.php files immediately. Audit for other leftover diagnostic scripts.',
  },
  'file-backup': {
    attackerNarrative: 'Attackers scan for common backup names (backup.zip, site.sql, wp-content.tar.gz) because full-site backups often sit in the web root for years.',
    plainEnglish: 'Archive or SQL dump files downloadable from your site.',
    whyItMatters: 'A database backup exposed is a full credential breach. Archive backups often contain wp-config and more.',
    whatToDo: 'Move backups off the web server entirely. Use your hosting provider\'s backup feature or an off-site service.',
  },
  'file-htaccess': {
    attackerNarrative: '.htaccess reveals which paths you\'ve deliberately denied — which is a roadmap to where the juicy files are.',
    plainEnglish: 'Your Apache configuration file, readable from outside.',
    whyItMatters: 'Information disclosure — tells the attacker what you were trying to hide.',
    whatToDo: 'Add a <Files ".htaccess"> deny block or equivalent to ensure .htaccess itself is not served.',
  },
  'file-upload-listing': {
    attackerNarrative: 'Directory listing in /uploads/ lets the attacker browse every file ever uploaded, including unreferenced ones — often containing PII.',
    plainEnglish: 'The uploads folder showing a file index when browsed directly.',
    whyItMatters: 'Privacy exposure of user-uploaded content. Also makes finding legacy / orphaned files trivial.',
    whatToDo: 'Add Options -Indexes to .htaccess (Apache) or autoindex off (nginx).',
  },
  'file-wp-includes-listing': {
    attackerNarrative: 'Listing wp-includes confirms WP is present and occasionally exposes debug scripts left by plugins.',
    plainEnglish: 'WordPress\'s core includes directory browsable as a file list.',
    whyItMatters: 'Fingerprinting signal; lower severity than uploads listing.',
    whatToDo: 'Disable directory listing globally in your web server config.',
  },

  // ── Reputation ──────────────────────────────────────────────────────────
  'rep-safe-browsing': {
    attackerNarrative: 'If Google has already flagged your domain, every Chrome/Firefox visitor sees a full-screen warning — business stops immediately.',
    plainEnglish: 'Whether Google has flagged your site for malware or phishing.',
    whyItMatters: 'A Safe Browsing flag collapses traffic in hours and stays sticky for days after cleanup.',
    whatToDo: 'If flagged, clean the compromise, then request review via Google Search Console > Security Issues.',
  },
  'rep-virustotal': {
    attackerNarrative: 'Security vendor flags tell the attacker which defenders are paying attention — and they\'ll avoid targeting users of those vendors to stay undetected.',
    plainEnglish: 'Aggregated view of which security vendors have flagged your domain.',
    whyItMatters: 'Multiple flags mean something is wrong or once was. Single flags are sometimes false positives.',
    whatToDo: 'Investigate flagged categories, confirm the issue is resolved, then request removal via each vendor\'s portal.',
  },
  'rep-crt-sh': {
    attackerNarrative: 'Certificate transparency logs are public — an attacker doing recon uses them to discover subdomains you forgot you had.',
    plainEnglish: 'Public logs of every TLS certificate issued for your domain.',
    whyItMatters: 'Reveals forgotten staging/dev subdomains that are often unprotected and compromisable.',
    whatToDo: 'Audit every certificate listed. Take down or secure any subdomain you don\'t recognise.',
  },

  // ── Configuration ───────────────────────────────────────────────────────
  'config-https-redirect': {
    attackerNarrative: 'If HTTP isn\'t redirected, an attacker on the network serves plaintext forever — no SSL-stripping needed.',
    plainEnglish: 'Whether http:// requests get automatically upgraded to https://.',
    whyItMatters: 'Without redirect, users who type the domain without "https" are interceptable.',
    whatToDo: 'Add a 301 redirect from http to https at the web server. Pair with HSTS for full protection.',
  },
  'config-www-consistency': {
    attackerNarrative: 'Split www / non-www can be abused for session fixation or cookie-separation tricks. More importantly, it\'s a sign of sloppy configuration.',
    plainEnglish: 'Whether www and non-www URLs end up at the same final domain.',
    whyItMatters: 'Cookie handling and SEO break when both variants resolve independently.',
    whatToDo: 'Pick one canonical (usually apex) and 301-redirect the other. Configure everywhere: web server, WordPress Site URL, DNS.',
  },
  'config-robots-txt': {
    attackerNarrative: 'robots.txt is the attacker\'s cheat sheet — admin paths, test endpoints and backup folders you Disallow are exactly where they look first.',
    plainEnglish: 'The file telling search engines which paths to skip.',
    whyItMatters: 'Disallow lines leak sensitive paths to anyone reading the file. Security through obscurity fails here specifically.',
    whatToDo: 'Never list "secret" URLs in robots.txt. Protect sensitive paths with authentication instead.',
  },
  'config-jquery-version': {
    attackerNarrative: 'jQuery < 3.5 has known XSS sinks (.html, .append with malicious selectors) the attacker uses to escalate reflected XSS into full session hijack.',
    plainEnglish: 'The version of jQuery loaded on your pages.',
    whyItMatters: 'Outdated jQuery is the long tail of front-end XSS exposure.',
    whatToDo: 'Update to jQuery 3.5+. WordPress sites: ensure your theme and plugins are current — they bundle their own jQuery.',
  },
  'config-sri': {
    attackerNarrative: 'Without SRI, the attacker who compromises the CDN (or intercepts the traffic) can silently inject code into any external script you load.',
    plainEnglish: 'Hash-verification of scripts loaded from other sites.',
    whyItMatters: 'Matters when you load scripts from CDNs you don\'t control. A defence against supply-chain attacks on those CDNs.',
    whatToDo: 'Add integrity="sha384-..." and crossorigin="anonymous" attributes to every <script src="https://other-domain/...">.',
  },
  'config-cookies': {
    attackerNarrative: 'Cookies without HttpOnly can be stolen by any XSS. Without Secure they leak over HTTP. Without SameSite they\'re used in CSRF attacks.',
    plainEnglish: 'How your session cookies are flagged for browser security.',
    whyItMatters: 'These flags are free defence-in-depth. Missing them turns small bugs into account takeover.',
    whatToDo: 'Set Secure, HttpOnly, and SameSite=Lax (or Strict) on every session cookie.',
  },
  'config-gdpr-cookie': {
    attackerNarrative: 'Not a direct attacker target — but the absence of consent tooling usually indicates no one is watching for front-end script injection either.',
    plainEnglish: 'Whether you ask EU/UK visitors for cookie consent.',
    whyItMatters: 'Legal requirement under GDPR/UK GDPR. Fines are significant; class actions are growing.',
    whatToDo: 'Install a consent-management plugin (CookieYes, Complianz, Cookiebot). Block non-essential scripts until consent.',
  },
  'config-privacy-policy': {
    attackerNarrative: 'The absence of a privacy policy signals weak governance. Attackers correlate — sites without policies are more likely to have weak incident response.',
    plainEnglish: 'A published page describing what data you collect and why.',
    whyItMatters: 'Legal requirement under GDPR/UK GDPR/CCPA. Also a trust signal to customers.',
    whatToDo: 'Publish a privacy policy at /privacy/ (or /privacy-policy/). Link from every page footer.',
  },
};

/** Safe accessor — returns null when no explainer exists for this check id. */
export function getExplainer(checkId: string): CheckExplainer | null {
  return checkExplainers[checkId] ?? null;
}
