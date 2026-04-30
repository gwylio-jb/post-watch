# Post_Watch
### by gwylio

> ISO 27001 compliance and WordPress security, unified.

---

## What is Post_Watch?

Post_Watch is a professional security toolkit for consultants, agencies, and security-conscious businesses. It combines **ISO 27001:2022 compliance management** with **external WordPress security auditing** in a single desktop application — eliminating the context-switch between compliance frameworks and operational security tooling.

Built with Tauri (Rust + WebView) for native OS-level HTTP access, Post_Watch runs external security checks against WordPress sites **without installing anything on the target site** — the attacker's view, not the plugin's view.

---

## Who is it for?

| Persona | Use case |
|---|---|
| **ISO 27001 consultant** | Audit clause and control compliance, build gap analyses, generate evidence checklists |
| **WordPress security specialist** | External attack-surface scanning across client sites |
| **IT Manager / CISO** | Unified risk register, compliance tracking, executive reporting |
| **Managed service provider** | Multi-client security posture dashboard and report generation |

---

## Core modules

### `post_status` — Dashboard
The security operations centre for your data. Live posture score, WP scan trend chart, compliance breakdown donut, recent scan mini-cards, and quick-action shortcuts to every module. Glass-morphism hero panel over navy-to-mint gradient.

### `post_audit` — ISO 27001 Audit
Full ISO 27001:2022 reference library:
- **Clauses 4–10** — Management system requirements with audit questions, typical evidence, and common gaps
- **Annex A Controls** — All 93 controls across Organisational, People, Physical, and Technological themes
- **Cross-reference matrix** — How clauses, controls, SOC 2, NIST CSF, and Cyber Essentials relate
- **Quick reference cards** — At-a-glance practitioner guidance

### `post_comply` — Compliance Hub
Active compliance management tools:
- **Gap analysis** — Assess current state (Compliant / Partial / Non-Compliant / Not Assessed) per clause and control
- **Implementation projects** — Track control implementation with owners, target dates, and status
- **Audit checklists** — Build bespoke checklists for surveillance and certification audits
- **Saved items** — Bookmarked clauses and controls for quick reference

### `post_scan` — WordPress Security (57 checks)
See below — the scanner section explains this in depth.

### `post_risk` — Risk Register
Functional ISO 27001-aligned risk register:
- Add, edit, and delete risks with full metadata
- **Likelihood × Impact (1–5)** scoring with automatic risk level classification
- **5×5 visual risk matrix** — heat-map SVG with your risks plotted at their L × I position
- Risk treatments: Mitigate, Accept, Transfer, Avoid
- Filter by status (Open / In Treatment / Closed), sort by score, name, or status
- Data persisted locally (no cloud dependency)

### `post_intel` — Threat Intelligence *(V2.1: live feed)*
WordPress vulnerability intelligence module. In V2.0 ships with curated sample data demonstrating the UI. V2.1 connects to the WPScan Vulnerability Database API for live plugin and theme CVEs filtered to your scanned sites' detected plugins.

### `post_alert` — Alerts
Automatic alert aggregation from all modules:
- Critical and High WP scan findings per domain (most recent scan)
- TLS certificate expiry < 30 days
- High-priority Non-Compliant gap analysis items
- Dismissable per-alert with severity filtering
- Badge count in sidebar navigation

### `post_report` — Reports
Generate and print client-ready reports:
- **WP Security Report** — full findings, score, and remediation guide
- **Compliance Status Report** — gap analysis results with compliance percentage
- **Executive Summary** — one-page posture scorecard combining WP score + compliance percentage
- In-page preview before printing; native print/PDF via browser

---

## The WordPress scanner in depth

Post_Watch performs **external, unauthenticated security analysis** — the same checks an attacker would run from outside the network. No plugin needed, no site access required. Just a URL.

### Why external scanning matters

Most WordPress security plugins are inside-out: they can read the filesystem, hook into authentication, and inspect database queries. What they **cannot** do is see what an external attacker sees — misconfigured headers, exposed sensitive files, server-level information disclosure, or whether your TLS certificate is about to expire.

Post_Watch is outside-in: it audits your site's attack surface from the internet, exactly as a threat actor would. This complements in-plugin security tools rather than replacing them.

### Desktop app vs browser mode

Post_Watch is a Tauri desktop app. This matters for the scanner because:

| Check type | Browser mode | Desktop mode |
|---|---|---|
| DNS records (DoH) | ✅ | ✅ |
| SSL Labs TLS grade | ✅ | ✅ |
| VirusTotal / Safe Browsing | ✅ (with API key) | ✅ |
| Security headers | ❌ CORS blocked | ✅ |
| WordPress paths & files | ❌ CORS blocked | ✅ |
| File exposure checks | ❌ CORS blocked | ✅ |
| Plugin detection | ❌ CORS blocked | ✅ |

When running in browser mode (e.g. during development), CORS-blocked checks display `SKIPPED (Tauri required)` rather than failing — the score is calculated only from the checks that could run.

### All 57 checks

#### DNS & Email Security (8 checks)
| ID | Check | Why it matters |
|---|---|---|
| `dns-mx` | MX Records | Domain can receive email |
| `dns-spf` | SPF Record | Prevents email spoofing |
| `dns-dmarc` | DMARC Policy | Enforces SPF/DKIM for reporting and action |
| `dns-dkim` | DKIM Records | Proves email origin cryptographically |
| `dns-caa` | CAA Records | Restricts which CAs can issue certificates |
| `dns-dnssec` | DNSSEC | DNS responses are cryptographically signed |
| `dns-bimi` | BIMI Record | Brand logo display in email clients |
| `dns-mta-sts` | MTA-STS Policy | Forces TLS for inbound email delivery |

#### TLS / SSL (4 checks)
| ID | Check | Why it matters |
|---|---|---|
| `tls-grade` | SSL Labs Grade | Holistic TLS configuration quality (A+ to F) |
| `tls-cert-expiry` | Certificate Expiry | Days until expiry — < 14 days is critical |
| `tls-protocols` | Deprecated Protocols | TLS 1.0/1.1, SSL 2/3 disabled |
| `tls-pfs` | Perfect Forward Secrecy | Past traffic stays private if key is compromised |

#### Security Headers (9 checks)
| ID | Check | Why it matters |
|---|---|---|
| `header-csp` | Content-Security-Policy | Mitigates XSS — checks for unsafe-inline |
| `header-x-frame-options` | X-Frame-Options | Clickjacking prevention |
| `header-x-content-type` | X-Content-Type-Options | MIME sniffing prevention |
| `header-hsts` | HSTS | Forces HTTPS at browser level |
| `header-referrer-policy` | Referrer-Policy | Controls referrer data to third parties |
| `header-permissions-policy` | Permissions-Policy | Restricts camera, mic, geolocation |
| `header-coop` | Cross-Origin-Opener-Policy | XS-Leaks protection |
| `header-server` | Server Header | Version disclosure |
| `header-x-powered-by` | X-Powered-By | PHP version disclosure |

#### WordPress Core (14 checks)
| ID | Check | Why it matters |
|---|---|---|
| `wp-version` | WordPress Version | Outdated core = known CVEs |
| `wp-xmlrpc` | XML-RPC | Brute-force amplification and DDoS vector |
| `wp-rest-users` | REST API User Enum | Username harvesting |
| `wp-author-scan` | Author URL Enumeration | Admin username disclosure |
| `wp-cron-exposed` | WP-Cron Accessible | External cron triggering |
| `wp-pingback` | Pingbacks Enabled | DDoS reflection / SSRF |
| `wp-debug` | Debug Mode Active | Error output reveals paths and DB |
| `wp-plugin-detection` | Plugin Detection + Versions | Outdated plugins = known CVEs |
| `wp-malware-patterns` | Malware Indicators | PHP backdoors, crypto miners, injections |
| `wp-login-protection` | Login Page Protection | Brute-force exposure |
| `wp-upload-php` | Upload PHP Execution | Uploaded shell execution |
| `wp-rest-routes` | REST API Namespaces | Non-standard endpoints exposing data |
| `wp-admin-custom` | Custom Admin URL | Admin URL relocation reduces brute-force |
| `wp-php-version` | PHP Version (EOL) | PHP < 8.1 has no security patches |

#### File Exposure (12 checks)
| ID | Check | Why it matters |
|---|---|---|
| `file-wp-config` | wp-config.php | DB credentials, auth keys |
| `file-wp-config-bak` | wp-config backups | Backup copies of credentials |
| `file-env` | .env File | API keys, DB passwords |
| `file-git-config` | .git/config | Full repo download possible |
| `file-debug-log` | Debug Log | Paths, queries, plugin names |
| `file-readme` | readme.html | WP version disclosure |
| `file-license` | license.txt | WordPress installation confirmed |
| `file-phpinfo` | phpinfo() Files | Full server configuration |
| `file-backup` | Backup Archives | Full site dump download |
| `file-htaccess` | .htaccess | Server config disclosure |
| `file-upload-listing` | Upload Dir Listing | Enumerate all uploaded files |
| `file-wp-includes-listing` | WP-Includes Listing | Core file enumeration |

#### Dark Web & Reputation (3 checks)
| ID | Check | Why it matters |
|---|---|---|
| `rep-safe-browsing` | Google Safe Browsing | Malware/phishing flags (requires API key) |
| `rep-virustotal` | VirusTotal | Security vendor reputation (requires API key) |
| `rep-crt-sh` | Certificate Transparency | Unexpected certificate issuance |

#### Configuration (8 checks)
| ID | Check | Why it matters |
|---|---|---|
| `config-https-redirect` | HTTPS Redirect | Cleartext access prevention |
| `config-www-consistency` | WWW Consistency | Canonical domain / cookie scope |
| `config-robots-txt` | robots.txt | Sensitive path disclosure |
| `config-jquery-version` | jQuery Version | Known CVE detection |
| `config-sri` | Subresource Integrity | CDN tampering prevention |
| `config-cookies` | Cookie Security Flags | HttpOnly, Secure, SameSite |
| `config-gdpr-cookie` | Cookie Consent (GDPR) | ePrivacy compliance |
| `config-privacy-policy` | Privacy Policy | GDPR legal requirement |

### API key setup

For optional enhanced checks, add API keys in the **Settings** panel (gear icon in top bar):

| Key | Provider | Free tier | What it unlocks |
|---|---|---|---|
| Google Safe Browsing | [Google Cloud Console](https://console.cloud.google.com) | 10,000 req/day | `rep-safe-browsing` |
| VirusTotal | [VirusTotal](https://www.virustotal.com/gui/join-us) | 500 req/day | `rep-virustotal` |
| WPScan | [WPScan](https://wpscan.com/register) | 25 req/day | V2.1 threat intel feed |

---

## Getting started (developer setup)

### Prerequisites

- **Node.js** 20+ and npm
- **Rust** 1.77.2+ with `cargo`
- **Tauri CLI** v2 (`cargo install tauri-cli`)

### Install dependencies

```bash
npm install
```

### Run in browser mode (CORS-limited)

```bash
npm run dev
```

Opens at `http://localhost:1420`. DNS, TLS, and reputation checks work; all `requiresTauri` checks show as skipped.

### Run as Tauri desktop app (full functionality)

```bash
npm run tauri:dev
```

First run downloads the Tauri WebView runtime and compiles the Rust backend (~2–3 minutes). Subsequent runs are fast.

---

## Tauri desktop app build

### Production build

```bash
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/` — platform-appropriate installers (`.dmg` on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux).

### Permissions

Post_Watch uses the `tauri-plugin-http` plugin for native HTTP requests (bypasses browser CORS). The capability file at `src-tauri/capabilities/default.json` grants `http:default` to the main window.

---

## Data storage

All data is stored locally using `localStorage` — no cloud, no backend, no telemetry.

| Key | Content |
|---|---|
| `clause-control:wp-audit-reports` | WP scan reports |
| `clause-control:gap-sessions` | Gap analysis sessions |
| `clause-control:projects` | Implementation projects |
| `clause-control:post-watch:risks` | Risk register |
| `clause-control:post-watch:dismissed-alerts` | Dismissed alert IDs |

---

## V2.1 AI roadmap

Post_Watch V2.1 will integrate Claude AI across the product:

1. **Plain-English finding explainer** — Takes a technical scan finding and rewrites it for a non-technical site owner with specific remediation steps for their server/host.

2. **Priority action plan** — Analyses all findings and generates a ranked "fix these first" plan with effort estimates, tuned to the site's risk profile.

3. **Compliance gap narrative** — Converts gap analysis data into a written management summary suitable for board reporting or ISMS documentation.

4. **Automated report writing** — Generates full client-ready narrative from raw scan + compliance data, with the consultant's tone and branding.

5. **Security posture coach** — Conversational assistant trained on the current scan results that answers "what should I do about X?" with site-specific context.

6. **Remediation code generator** — Ready-to-paste server config snippets (nginx/Apache/.htaccess/wp-config.php) for each detected issue.

7. **Benchmark comparison** — "Your site scores better than X% of similar sites" using aggregated anonymised scan data.

8. **Threat narrative digest** — Weekly digest email summarising relevant threats for the site's specific tech stack.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Desktop | Tauri v2 (Rust) |
| HTTP | `tauri-plugin-http` (bypasses CORS for scanner) |
| Animation | Framer Motion |
| Icons | Lucide React |
| Fonts | Adobe Fonts (Azo Sans + Ingra) + Google Fonts fallbacks |
| Storage | localStorage (no cloud) |

---

*Post_Watch V2.0 · by gwylio*
