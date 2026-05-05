import { Search, Sun, Moon, Bell } from 'lucide-react';
import type { AppSection } from '../../data/types';
import SettingsMenu from '../shared/SettingsMenu';

/*
 * TopBar (Sprint-10 redesign)
 *
 * Slim crumb-trail + glass search-pill + icon actions + avatar.
 * Visuals owned by `.topbar`, `.crumbs`, `.search-pill`, `.icon-btn`,
 * `.avatar` in `src/styles/redesign.css`.
 *
 * The crumb shows `post_watch / <section>` per the handoff. The settings
 * menu (`SettingsMenu`) keeps its existing dropdown — it's launched from
 * the cog icon and lives on top of everything via React portal.
 */

interface TopBarProps {
  activeSection: AppSection;
  onOpenSearch: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSectionChange: (section: AppSection) => void;
  alertCount?: number;
}

const crumbForSection: Record<AppSection, string> = {
  post_status:  'post_status',
  post_clients: 'post_clients',
  post_audit:   'post_audit',
  post_comply:  'post_comply',
  post_risk:    'post_risk',
  post_intel:   'post_intel',
  post_scan:    'post_scan',
  post_alert:   'post_alert',
  post_report:  'post_report',
  search:       'search',
};

export default function TopBar({ activeSection, onOpenSearch, theme, onToggleTheme, onSectionChange, alertCount = 0 }: TopBarProps) {
  const crumb = crumbForSection[activeSection];

  return (
    <nav className="topbar no-print" aria-label="Section breadcrumb and global actions">
      <div className="crumbs" aria-live="polite">
        <span>post_watch</span>
        <span aria-hidden>/</span>
        <strong>{crumb}</strong>
      </div>

      <button
        type="button"
        className="search-pill"
        onClick={onOpenSearch}
        aria-label="Open global search"
      >
        <Search />
        <span>Search clauses, controls, scans…</span>
        <span className="kbd">/</span>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onSectionChange('post_alert')}
          aria-label={alertCount > 0 ? `Notifications, ${alertCount} active alert${alertCount === 1 ? '' : 's'}` : 'Notifications'}
          style={{ position: 'relative' }}
        >
          <Bell />
          {alertCount > 0 && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 4, right: 4,
                minWidth: 14, height: 14,
                padding: '0 4px',
                borderRadius: 999,
                background: 'var(--ember)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'var(--font-redesign-mono)',
                display: 'grid', placeItems: 'center',
                boxShadow: '0 0 0 2px var(--bg-1)',
              }}
            >
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <SettingsMenu />
        <div className="avatar" aria-hidden>JB</div>
      </div>
    </nav>
  );
}
