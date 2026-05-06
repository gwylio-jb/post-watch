import { motion } from 'framer-motion';
import { Eye, RefreshCw, ExternalLink, Zap } from 'lucide-react';

// ─── Mock feed data ───────────────────────────────────────────────────────────
// V2.1 will replace this with live WPScan API / NVD feed

const MOCK_FEED = [
  {
    id: '1',
    title: 'WordPress Core 6.3.x – Authenticated XSS via Post Titles',
    cveId: 'CVE-2024-2961',
    severity: 'High' as const,
    component: 'WordPress Core',
    affectedVersions: '< 6.4.3',
    published: '2026-04-18',
    tactics: ['Initial Access', 'Execution'],
    description: 'A stored XSS vulnerability in post title handling allows authenticated contributors to inject scripts executed in the admin context.',
    source: 'WPScan Database',
  },
  {
    id: '2',
    title: 'WooCommerce – CSRF leads to Store Settings Modification',
    cveId: 'CVE-2024-3192',
    severity: 'Medium' as const,
    component: 'WooCommerce Plugin',
    affectedVersions: '< 8.7.0',
    published: '2026-04-15',
    tactics: ['Defense Evasion'],
    description: 'Missing nonce verification on store settings update endpoint allows unauthenticated attackers to change payment and tax settings via CSRF.',
    source: 'WPScan Database',
  },
  {
    id: '3',
    title: 'Elementor Page Builder – Path Traversal in Template Import',
    cveId: 'CVE-2024-4401',
    severity: 'Critical' as const,
    component: 'Elementor Plugin',
    affectedVersions: '< 3.21.5',
    published: '2026-04-10',
    tactics: ['Collection', 'Exfiltration'],
    description: 'Improper sanitisation of the template file path in the import functionality allows authenticated users to read arbitrary server files.',
    source: 'NVD / NIST',
  },
  {
    id: '4',
    title: 'Contact Form 7 – Open Redirect via Return URL',
    cveId: 'CVE-2024-1822',
    severity: 'Low' as const,
    component: 'Contact Form 7',
    affectedVersions: '< 5.8.7',
    published: '2026-04-05',
    tactics: ['Initial Access'],
    description: 'Unvalidated redirect in the form confirmation URL parameter can be used in phishing attacks to redirect users to attacker-controlled sites.',
    source: 'WPScan Database',
  },
];

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

const severityToken: Record<Severity, { color: string; pill: 'ember' | 'violet' | 'mint' }> = {
  Critical: { color: 'var(--ember)',  pill: 'ember'  },
  High:     { color: 'var(--ember-2, var(--ember))', pill: 'ember' },
  Medium:   { color: 'var(--violet)', pill: 'violet' },
  Low:      { color: 'var(--mint)',   pill: 'mint'   },
};

function TacticTag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-redesign-mono)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--violet)',
        background: 'color-mix(in oklab, var(--violet) 12%, transparent)',
        border: '1px solid color-mix(in oklab, var(--violet) 28%, transparent)',
        borderRadius: 4,
        padding: '2px 6px',
      }}
    >
      {label}
    </span>
  );
}

export default function ThreatIntel() {
  const counts = MOCK_FEED.reduce<Record<Severity, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc;
  }, { Critical: 0, High: 0, Medium: 0, Low: 0 });

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker violet">post_intel · feed</span>
          <h1 className="h-condensed title">
            Threat intelligence<span className="u">_</span><br />for the WordPress stack.
          </h1>
          <p className="sub">
            Curated CVEs from the WPScan Vulnerability Database and NVD, scoped to WordPress core, plugins and themes. Sample data shown — drop a WPScan API token in Settings to enable the live feed in V2.1.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">In feed</div>
              <div className="v">{MOCK_FEED.length}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Critical</div>
              <div className="v" style={{ color: counts.Critical > 0 ? 'var(--ember)' : undefined }}>{counts.Critical}</div>
            </div>
            <div className="hero-stat">
              <div className="l">High</div>
              <div className="v" style={{ color: counts.High > 0 ? 'var(--ember)' : undefined }}>{counts.High}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" disabled title="Live feed lands in V2.1" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
              <RefreshCw className="w-4 h-4" /> Refresh feed
            </button>
          </div>
        </div>

        {/* Right pane — V2.1 status */}
        <div className="gauge-wrap" style={{ alignItems: 'stretch' }}>
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 22,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-bd)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', gap: 10,
              minWidth: 240,
            }}
          >
            <span className="kicker">v2.1 roadmap</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--mint)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>Live feed coming</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
              Powered by the WPScan Database API (free tier: 25 req/day) + NVD CVE feed. Filtered to plugins detected on your scanned sites.
            </p>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
              <Eye className="w-3 h-3" /> sample data shown
            </div>
          </div>
        </div>
      </section>

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MOCK_FEED.map((item, i) => {
          const sc = severityToken[item.severity];
          return (
            <motion.div
              key={item.id}
              className="bubble"
              style={{ padding: 18, borderLeft: `3px solid ${sc.color}` }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Timestamp + source */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                      {item.published}
                    </span>
                    <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 9, color: 'var(--ink-3)', background: 'color-mix(in oklab, var(--bg-2) 50%, transparent)', borderRadius: 4, padding: '1px 6px', border: '1px solid var(--line)' }}>
                      {item.source}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink-1)', marginBottom: 6, lineHeight: 1.4 }}>
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 10 }}>
                    {item.description}
                  </p>

                  {/* Tags row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`pill ${sc.pill}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                      <span className="dot" style={{ background: sc.color }} />{item.severity}
                    </span>
                    <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                      {item.cveId}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                      {item.component} · <span style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 10 }}>{item.affectedVersions}</span>
                    </span>
                    {item.tactics.map(t => <TacticTag key={t} label={t} />)}
                  </div>
                </div>

                <a
                  href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${item.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${item.cveId} on cve.mitre.org`}
                  style={{
                    color: 'var(--ink-3)', textDecoration: 'none',
                    padding: 6, borderRadius: 8,
                    display: 'grid', placeItems: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--mint)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--mint) 12%, transparent)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
