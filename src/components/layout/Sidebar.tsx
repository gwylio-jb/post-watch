import {
  LayoutDashboard, ClipboardCheck, ShieldCheck, ScanSearch,
  AlertTriangle, Eye, Bell, FileText, Building2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppSection } from '../../data/types';
import { LogoWordmark, LogoMark } from '../shared/Logo';

interface SidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  alertCount?: number;
}

type NavItem = {
  id: AppSection;
  label: string;
  icon: React.ElementType;
  accent?: 'mint' | 'violet' | 'ember';
  badge?: number;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

function buildNavGroups(alertCount: number): NavGroup[] {
  return [
    {
      items: [
        { id: 'post_status',  label: 'Dashboard',           icon: LayoutDashboard },
        { id: 'post_clients', label: 'Clients',             icon: Building2 },
        { id: 'post_audit',   label: '27001 helper',        icon: ClipboardCheck },
        { id: 'post_comply',  label: 'Compliance',          icon: ShieldCheck },
        { id: 'post_scan',    label: 'WordPress security',  icon: ScanSearch },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'post_risk',  label: 'Risk hub',             icon: AlertTriangle, accent: 'violet' },
        { id: 'post_intel', label: 'Threat intel',         icon: Eye,           accent: 'violet' },
        { id: 'post_alert', label: 'Alerts',               icon: Bell,          accent: 'ember',  badge: alertCount > 0 ? alertCount : undefined },
      ],
    },
    {
      label: 'Output',
      items: [
        { id: 'post_report', label: 'Reports', icon: FileText },
      ],
    },
  ];
}

const accentColors: Record<string, string> = {
  mint:   '#00D9A3',
  violet: '#8B5CF6',
  ember:  '#FF4A1C',
};

export default function Sidebar({ activeSection, onSectionChange, collapsed, onToggleCollapse, alertCount = 0 }: SidebarProps) {
  const navGroups = buildNavGroups(alertCount);

  return (
    <nav
      className={`no-print flex flex-col h-screen sticky top-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: 'var(--color-navy)', borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Brand header */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-5`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {collapsed ? (
          <LogoMark size={30} />
        ) : (
          <LogoWordmark variant="dark" size="md" showAttribution={true} />
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggleCollapse}
          className="mx-auto mt-3 p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Nav groups */}
      <div className="flex-1 py-4 overflow-y-auto space-y-1">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
            {!collapsed && group.label && (
              <div
                className="px-4 mb-2 text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: '"JetBrains Mono", monospace' }}
              >
                // {group.label}
              </div>
            )}
            <div className={`space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const accentColor = item.accent ? accentColors[item.accent] : '#00D9A3';
                const iconColor = item.accent ? accentColors[item.accent] : (isActive ? '#00D9A3' : 'rgba(255,255,255,0.55)');

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 py-2.5 text-sm rounded-lg transition-all relative ${collapsed ? 'justify-center px-0' : 'px-3'}`}
                    style={
                      isActive
                        ? {
                            background: accentColor,
                            borderLeft: `3px solid ${accentColor}`,
                            paddingLeft: collapsed ? undefined : '9px',
                            color: '#0A1628',
                            fontWeight: 700,
                          }
                        : {
                            color: 'rgba(255,255,255,0.55)',
                            borderLeft: '3px solid transparent',
                            paddingLeft: collapsed ? undefined : '9px',
                          }
                    }
                    whileHover={{ x: collapsed ? 0 : 1 }}
                    title={collapsed ? item.label : undefined}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = '';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                      }
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: isActive ? '#0A1628' : iconColor }}
                    />
                    {!collapsed && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge != null && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: '#FF4A1C', color: '#ffffff', minWidth: '18px', textAlign: 'center' }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge != null && (
                      <span
                        className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                        style={{ background: '#FF4A1C' }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer tagline */}
      {!collapsed && (
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.03em',
              lineHeight: 1.4,
            }}
          >
            // Stay compliant. Stay secure.
          </p>
        </div>
      )}
    </nav>
  );
}
