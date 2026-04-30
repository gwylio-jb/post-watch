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

const severityColors: Record<Severity, { bg: string; text: string; border: string }> = {
  Critical: { bg: '#FFF1EE', text: '#FF4A1C', border: 'rgba(255,74,28,0.3)' },
  High:     { bg: '#FFF7ED', text: '#D97706', border: 'rgba(217,119,6,0.3)' },
  Medium:   { bg: '#F3F0FF', text: '#8B5CF6', border: 'rgba(139,92,246,0.3)' },
  Low:      { bg: '#E6FAF5', text: '#00B589', border: 'rgba(0,181,137,0.3)' },
};

function TacticTag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#8B5CF6',
        background: 'rgba(139,92,246,0.1)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: '3px',
        padding: '1px 5px',
      }}
    >
      {label}
    </span>
  );
}

export default function ThreatIntel() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-8 space-y-6">

        {/* V2.1 teaser banner */}
        <div
          className="glass-card-navy rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: 'rgba(26,35,50,0.85)' }}
        >
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5" style={{ color: '#00D9A3' }} />
            <div>
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  color: '#00D9A3',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                // Live in V2.1
              </div>
              <p style={{ fontSize: '13px', color: '#F8F9FA', fontWeight: 500 }}>
                Real-time feed powered by WPScan Database API + NVD CVE feed
              </p>
            </div>
          </div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: 'rgba(248,249,250,0.45)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '3px 8px',
            }}
          >
            post_intel
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
              // Sample data — connect WPScan API token in Settings for live feed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Last updated: just now</span>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {MOCK_FEED.map((item, i) => {
            const sc = severityColors[item.severity];
            return (
              <motion.div
                key={item.id}
                className="card-elevated p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                style={{ borderLeft: `3px solid ${sc.text}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Timestamp + source */}
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '10px',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {item.published}
                      </span>
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '9px',
                          color: 'var(--color-text-muted)',
                          background: 'var(--color-surface-alt)',
                          borderRadius: '3px',
                          padding: '1px 5px',
                        }}
                      >
                        {item.source}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="font-semibold text-sm mb-1.5"
                      style={{ color: 'var(--color-text-primary)', lineHeight: 1.4 }}
                    >
                      {item.title}
                    </h3>

                    {/* Description */}
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                      {item.description}
                    </p>

                    {/* Tags row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Severity badge */}
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: sc.bg,
                          color: sc.text,
                          border: `1px solid ${sc.border}`,
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                      >
                        {item.severity}
                      </span>

                      {/* CVE ID */}
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '10px',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {item.cveId}
                      </span>

                      {/* Component + versions */}
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {item.component} · <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px' }}>{item.affectedVersions}</span>
                      </span>

                      {/* MITRE tactics */}
                      {item.tactics.map(t => <TacticTag key={t} label={t} />)}
                    </div>
                  </div>

                  <a
                    href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${item.cveId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs flex-shrink-0"
                    style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-mint)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <div
          className="card-elevated p-4"
          style={{ border: '1px solid rgba(0,217,163,0.2)', background: 'var(--color-mint-subtle)' }}
        >
          <div className="flex items-start gap-3">
            <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#00B589' }} />
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#00B589', marginBottom: 2 }}>V2.1: Live threat intelligence</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                In V2.1, this module will connect to the WPScan Vulnerability Database API (free tier: 25 req/day) for live plugin and theme CVEs, filtered to your scanned site's detected plugins. Add your WPScan API token in Settings.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
