import { Search, Sun, Moon } from 'lucide-react';
import type { AppSection } from '../../data/types';
import SettingsMenu from '../shared/SettingsMenu';

interface TopBarProps {
  activeSection: AppSection;
  onOpenSearch: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const sectionTitles: Record<AppSection, { title: string; subtitle: string; tag: string }> = {
  post_status:  { title: 'Dashboard',           subtitle: 'Audit. Protect. Report.',                                          tag: 'post_status'  },
  post_clients: { title: 'Clients',             subtitle: 'Billable engagements — one record per client',                    tag: 'post_clients' },
  post_audit:   { title: '27001 helper',         subtitle: 'Clauses 4–10 and Annex A controls',                               tag: 'post_audit'   },
  post_comply:  { title: 'Compliance',          subtitle: 'Gap analysis, implementation and checklists',                     tag: 'post_comply'  },
  post_risk:    { title: 'Risk hub',             subtitle: 'Identify, score and treat information security risks',             tag: 'post_risk'    },
  post_intel:   { title: 'Threat intelligence', subtitle: 'WordPress vulnerabilities and CVE feed',                          tag: 'post_intel'   },
  post_scan:    { title: 'WordPress security',  subtitle: 'External attack-surface analysis',                                tag: 'post_scan'    },
  post_alert:   { title: 'Alerts',              subtitle: 'Active issues across all modules',                                tag: 'post_alert'   },
  post_report:  { title: 'Reports',             subtitle: 'Generate and export client-ready reports',                        tag: 'post_report'  },
  search:       { title: 'Search',              subtitle: 'Find clauses, controls, audit questions and evidence',            tag: 'search'       },
};

export default function TopBar({ activeSection, onOpenSearch, theme, onToggleTheme }: TopBarProps) {
  const meta = sectionTitles[activeSection];
  return (
    <header
      className="no-print flex items-center justify-between px-8 py-4 sticky top-0 z-10 backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-baseline gap-3">
        <h1 className="font-display font-bold text-2xl text-text-primary leading-tight">
          {meta.title}
        </h1>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              fontWeight: 700,
              color: '#0A1628',
              background: 'var(--color-mint)',
              borderRadius: '4px',
              padding: '2px 8px',
              letterSpacing: '0.02em',
            }}
          >
            {meta.tag}
          </span>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl text-xs transition-all"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-mono ml-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            /
          </kbd>
        </button>

        <button
          onClick={onToggleTheme}
          className="p-2.5 rounded-xl transition-all"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <SettingsMenu />
      </div>
    </header>
  );
}
