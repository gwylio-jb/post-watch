import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { AppSection } from '../../data/types';

/*
 * AppShell — full-bleed wrapper with aurora + grain overlay.
 *
 * The Sprint-10 redesign moved every page into a single `.app-shell` grid
 * (240px sidebar + main column). The decorative `.aurora` blobs and the
 * `.grain` SVG noise overlay live here so they sit behind every page
 * uniformly.
 *
 * The component is still called `Layout` to keep imports stable across
 * `App.tsx` and the rest of the codebase. Internally it composes Sidebar
 * + TopBar + a `.page` content slot per the handoff.
 */

interface LayoutProps {
  children: React.ReactNode;
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  alertCount?: number;
}

export default function Layout({
  children,
  activeSection,
  onSectionChange,
  onOpenSearch,
  theme,
  onToggleTheme,
  alertCount = 0,
}: LayoutProps) {
  // The redesign drops "collapsible sidebar" — the column is always 240px.
  // We accept the prop for backwards-compat but ignore the value.

  // Track theme via state so TopBar's toggle re-renders the icon.
  // Mirrors the .dark / .theme-* classes on <html>.
  const [, force] = useState(0);
  useEffect(() => { force(n => n + 1); }, [theme]);

  return (
    <div className={`app-shell theme-${theme}`}>
      {/* Skip-to-content — invisible until focused. Lets keyboard / screen-reader
          users jump past the sidebar and topbar in one tab. */}
      <a href="#post-watch-main" className="skip-link">Skip to main content</a>
      <div className="aurora"><div className="blob" /></div>
      <Sidebar activeSection={activeSection} onSectionChange={onSectionChange} alertCount={alertCount} />
      <main className="main" id="post-watch-main" tabIndex={-1}>
        <TopBar
          activeSection={activeSection}
          onOpenSearch={onOpenSearch}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSectionChange={onSectionChange}
          alertCount={alertCount}
        />
        {children}
      </main>
      <div className="grain" />
    </div>
  );
}
