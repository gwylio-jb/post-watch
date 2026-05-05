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

export default function TopBar({ activeSection, onOpenSearch, theme, onToggleTheme }: TopBarProps) {
  const crumb = crumbForSection[activeSection];

  return (
    <div className="topbar no-print">
      <div className="crumbs">
        <span>post_watch</span>
        <span>/</span>
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
          onClick={() => {/* notifications surface lives in post_alert; placeholder for now */}}
          aria-label="Notifications"
        >
          <Bell />
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
    </div>
  );
}
