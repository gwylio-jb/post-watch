import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import type { AppSection } from './data/types';
import { managementClauses } from './data/clauses';
import { allControls } from './data/controls';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSearch } from './hooks/useSearch';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Layout from './components/layout/Layout';
import GlobalSearch from './components/search/GlobalSearch';
import Dashboard from './components/dashboard/Dashboard';

// Heavy modules lazy-loaded — each only parses when first navigated to
const ClientsHub    = lazy(() => import('./components/clients/ClientsHub'));
const AuditModule   = lazy(() => import('./components/audit/AuditModule'));
const ComplyModule  = lazy(() => import('./components/comply/ComplyModule'));
const WpAuditHub    = lazy(() => import('./components/wp-audit/WpAuditHub'));
const RiskRegister  = lazy(() => import('./components/risk/RiskRegister'));
const ThreatIntel   = lazy(() => import('./components/intel/ThreatIntel'));
const AlertCenter   = lazy(() => import('./components/alerts/AlertCenter'));
const ReportHub     = lazy(() => import('./components/reports/ReportHub'));
// Mounted once near the top of the tree — checks for updates on launch and
// surfaces a corner toast. No-op outside the Tauri runtime.
const UpdatePrompt  = lazy(() => import('./components/common/UpdatePrompt'));
import type { SearchResult } from './hooks/useSearch';
import type { AuditReport } from './data/auditTypes';
import type { GapAnalysisSession } from './data/types';
import { deriveAlerts, filterDismissed } from './utils/deriveAlerts';
import { runClientMigration } from './utils/clientMigration';

export default function App() {
  const [activeSection, setActiveSection] = useLocalStorage<AppSection>('active-section', 'post_status');
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('theme', 'dark');
  const [searchOpen, setSearchOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  // Alert badge — derived from the SAME logic as the Alerts tab so the
  // count on the sidebar always matches the list inside. Also honours
  // dismissals so clearing the list clears the badge.
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [dismissedAlertIds] = useLocalStorage<string[]>('post-watch:dismissed-alerts', []);
  const alertCount = useMemo(() => {
    const reports = Array.isArray(savedReports) ? savedReports : [];
    const sessions = Array.isArray(gapSessions) ? gapSessions : [];
    const dismissed = Array.isArray(dismissedAlertIds) ? dismissedAlertIds : [];
    return filterDismissed(deriveAlerts(reports, sessions), dismissed).length;
  }, [savedReports, gapSessions, dismissedAlertIds]);

  // V2.1 one-shot migration: seed "Unassigned" client + back-fill clientId
  // onto legacy risks/cheatsheets/gap sessions/scans. Guarded by a flag so it
  // runs exactly once per device, before any child module reads its data.
  useEffect(() => {
    const res = runClientMigration();
    if (res.ran) {
      // eslint-disable-next-line no-console
      console.info('[post-watch] V2.1 migration ran:', res.counts);
    }
  }, []);

  useEffect(() => {
    // Two parallel classes: `.dark` keeps Tailwind `dark:` modifiers in
    // untouched modules working; `.theme-dark` / `.theme-light` is what the
    // redesign CSS (src/styles/redesign.css) reads from. They always agree
    // on which theme is active.
    const cl = document.documentElement.classList;
    if (theme === 'dark') {
      cl.add('dark');
      cl.add('theme-dark');
      cl.remove('theme-light');
    } else {
      cl.remove('dark');
      cl.add('theme-light');
      cl.remove('theme-dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const { query, setQuery, results } = useSearch(managementClauses, allControls);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, [setQuery]);

  const handleSearchResult = useCallback((result: SearchResult) => {
    const clauseIds = new Set(managementClauses.map(c => c.id));
    const controlIds = new Set(allControls.map(c => c.id));
    const itemId = result.parentId ?? result.id;

    if (clauseIds.has(itemId)) {
      setActiveSection('post_audit');
      setTargetId(itemId);
    } else if (controlIds.has(itemId)) {
      setActiveSection('post_audit');
      setTargetId(itemId);
    } else {
      if (clauseIds.has(result.id)) {
        setActiveSection('post_audit');
        setTargetId(result.id);
      } else {
        setActiveSection('post_audit');
        setTargetId(result.id);
      }
    }
  }, [setActiveSection]);

  const handleSectionChange = useCallback((section: AppSection) => {
    if (section === 'search') {
      handleOpenSearch();
      return;
    }
    setActiveSection(section);
    setTargetId(null);
  }, [setActiveSection, handleOpenSearch]);

  const handleAddToCheatsheet = useCallback((_controlId: string) => {
    setActiveSection('post_comply');
  }, [setActiveSection]);

  const shortcuts = useMemo(() => ({
    '/': () => handleOpenSearch(),
    'Escape': () => handleCloseSearch(),
  }), [handleOpenSearch, handleCloseSearch]);

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      <Layout
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
        onOpenSearch={handleOpenSearch}
        theme={theme}
        onToggleTheme={toggleTheme}
        alertCount={alertCount}
      >
        {activeSection === 'post_status' && (
          <Dashboard onNavigate={handleSectionChange} />
        )}
        <Suspense fallback={null}>
          {activeSection === 'post_clients' && <ClientsHub />}
          {activeSection === 'post_audit' && (
            <AuditModule
              clauses={managementClauses}
              controls={allControls}
              targetId={targetId}
              onTargetConsumed={() => setTargetId(null)}
              onAddToCheatsheet={handleAddToCheatsheet}
            />
          )}
          {activeSection === 'post_comply' && (
            <ComplyModule clauses={managementClauses} controls={allControls} />
          )}
          {activeSection === 'post_scan' && <WpAuditHub />}
          {activeSection === 'post_risk' && <RiskRegister />}
          {activeSection === 'post_intel' && <ThreatIntel />}
          {activeSection === 'post_alert' && <AlertCenter onNavigate={handleSectionChange} />}
          {activeSection === 'post_report' && <ReportHub />}
        </Suspense>
      </Layout>

      <GlobalSearch
        isOpen={searchOpen}
        onClose={handleCloseSearch}
        query={query}
        onQueryChange={setQuery}
        results={results}
        onResultClick={(result) => { handleSearchResult(result); handleCloseSearch(); }}
        onNavigate={(section) => setActiveSection(section as AppSection)}
      />

      <Suspense fallback={null}>
        <UpdatePrompt />
      </Suspense>
    </>
  );
}
