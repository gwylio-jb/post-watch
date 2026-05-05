import {
  LayoutDashboard, ClipboardCheck, ShieldCheck, ScanSearch,
  AlertTriangle, Eye, Bell, FileText, Building2,
} from 'lucide-react';
import type { AppSection } from '../../data/types';

/*
 * Sidebar (Sprint-10 redesign)
 *
 * Plain CSS — no Tailwind, no framer-motion. Layout + look are owned by
 * `src/styles/redesign.css` (`.sidebar`, `.brand`, `.nav-item.active`,
 * etc.). This component just renders the structure and toggles the
 * active class.
 *
 * Active-state colour: each nav item carries an `accent` of mint/violet/
 * ember. The CSS picks the matching inset stripe and gradient wash. Mint
 * is the default; the Intelligence group switches to violet/ember.
 */

interface SidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  alertCount?: number;
}

type Accent = 'mint' | 'violet' | 'ember';

interface NavItem {
  id: AppSection;
  label: string;
  Icon: React.ElementType;
  accent: Accent;
  badge?: number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

function buildGroups(alertCount: number): NavGroup[] {
  return [
    {
      items: [
        { id: 'post_status',  label: 'Dashboard',          Icon: LayoutDashboard, accent: 'mint' },
        { id: 'post_clients', label: 'Clients',            Icon: Building2,       accent: 'mint' },
        { id: 'post_audit',   label: '27001 helper',       Icon: ClipboardCheck,  accent: 'mint' },
        { id: 'post_comply',  label: 'Compliance',         Icon: ShieldCheck,     accent: 'mint' },
        { id: 'post_scan',    label: 'WordPress security', Icon: ScanSearch,      accent: 'mint' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'post_risk',  label: 'Risk hub',     Icon: AlertTriangle, accent: 'violet' },
        { id: 'post_intel', label: 'Threat intel', Icon: Eye,           accent: 'violet' },
        { id: 'post_alert', label: 'Alerts',       Icon: Bell,          accent: 'ember',  badge: alertCount > 0 ? alertCount : undefined },
      ],
    },
    {
      label: 'Output',
      items: [
        { id: 'post_report', label: 'Reports', Icon: FileText, accent: 'mint' },
      ],
    },
  ];
}

export default function Sidebar({ activeSection, onSectionChange, alertCount = 0 }: SidebarProps) {
  const groups = buildGroups(alertCount);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src="/favicon.png" alt="" />
        </div>
        <div>
          <div className="brand-name">
            Post<span className="u">_</span><span className="w">Watch</span>
          </div>
          <div className="brand-sub">a gwylio product</div>
        </div>
      </div>

      {groups.map((g, gi) => (
        <div className="nav-group" key={gi}>
          {g.label && <div className="nav-label">// {g.label}</div>}
          {g.items.map(it => {
            const active = activeSection === it.id;
            const cls = ['nav-item'];
            if (active) cls.push('active');
            // Active stripe colour follows the item's accent. Inactive
            // items don't need the accent class — keeps the CSS terse.
            if (active && it.accent !== 'mint') cls.push(it.accent);
            return (
              <button
                key={it.id}
                type="button"
                className={cls.join(' ')}
                onClick={() => onSectionChange(it.id)}
                aria-current={active ? 'page' : undefined}
              >
                <it.Icon />
                <span>{it.label}</span>
                {it.badge != null && <span className="badge">{it.badge}</span>}
              </button>
            );
          })}
        </div>
      ))}

      <div className="sidebar-foot">
        // Stay compliant.<br />// Stay secure.
      </div>
    </aside>
  );
}
