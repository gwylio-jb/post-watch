import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { AppSection } from '../../data/types';

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

// Sections that manage their own padding/scrolling
const FULL_BLEED: AppSection[] = ['post_status', 'post_audit', 'post_comply', 'post_scan', 'post_risk', 'post_intel', 'post_alert', 'post_report'];

export default function Layout({
  children,
  activeSection,
  onSectionChange,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenSearch,
  theme,
  onToggleTheme,
  alertCount = 0,
}: LayoutProps) {
  const fullBleed = FULL_BLEED.includes(activeSection);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
        alertCount={alertCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          onOpenSearch={onOpenSearch}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        <main className={`flex-1 overflow-y-auto ${fullBleed ? '' : 'p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
