import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Database,
  FileText,
  AlertTriangle,
  DollarSign,
  LogOut,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  BarChart3,
  FolderOpen,
  Settings,
  Receipt,
  ListTodo,
  BookOpenCheck,
  Scale,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { canAccessRoute } from '../../config/permissions.config';

// ── Navigation definition ─────────────────────────────────────────────────────

interface SubMenuItem {
  name: string;
  href: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  subItems?: SubMenuItem[];
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
  },

  // Renamed from "Données de Base" to "Référentiel" per client decision
  {
    name: 'Référentiel',
    icon: Database,
    subItems: [
      { name: 'Assurés',      href: '/assures' },
      { name: 'Cédantes',     href: '/cedantes' },
      { name: 'Réassureurs',  href: '/reassureurs' },
      { name: 'Co-Courtiers', href: '/co-courtiers' },
    ],
  },

  {
    name: 'Affaires',
    icon: FileText,
    subItems: [
      { name: 'Toutes les affaires', href: '/affaires' },
      { name: 'Traités',             href: '/traites' },
    ],
  },

  {
    name: 'Bordereaux',
    icon: Receipt,
    href: '/bordereaux',
  },

  {
    name: 'Sinistres',
    icon: AlertTriangle,
    subItems: [
      { name: 'Liste',       href: '/sinistres' },
      { name: 'Déclarer',   href: '/sinistres/new' },
      { name: 'Analytique', href: '/sinistres/suivi' },
    ],
  },

  {
    name: 'Finances',
    icon: DollarSign,
    subItems: [
      { name: 'Transactions',         href: '/finances' },
      { name: 'Commissions',          href: '/finances/commissions' },
      { name: 'Situations',           href: '/finances/settlements' },
      { name: 'Compiler Situation',   href: '/finances/situation-builder' },
      { name: 'Ordres de Paiement',   href: '/finances/payment-orders' },
      { name: 'Dashboard Financier',  href: '/finances/dashboard' },
    ],
  },

  {
    name: 'Comptabilité',
    icon: BookOpen,
    subItems: [
      { name: 'Dashboard',          href: '/comptabilite/dashboard' },
      { name: 'Plan Comptable',     href: '/comptabilite/plan-comptable' },
      { name: 'Grand Livre',        href: '/comptabilite/grand-livre' },
      { name: 'Balance',            href: '/comptabilite/balance' },
      { name: 'Bilan',              href: '/comptabilite/bilan' },
      { name: 'Compte Résultat',    href: '/comptabilite/resultat' },
      { name: 'Journal Ventes',     href: '/comptabilite/journal-ventes' },
      { name: 'Journal Achats',     href: '/comptabilite/journal-achats' },
      { name: 'Journal Banque',     href: '/comptabilite/journal-banque' },
      { name: 'Réconciliation',     href: '/comptabilite/reconciliation' },
    ],
  },

  {
    name: 'Reporting',
    icon: BarChart3,
    subItems: [
      { name: 'Tableaux de Bord', href: '/reporting/dashboard' },
      { name: 'Portfolio',        href: '/reporting/portfolio' },
      { name: 'Générateur',       href: '/reporting/generator' },
      { name: 'Exports',          href: '/reporting/exports' },
    ],
  },

  {
    name: 'GED',
    href: '/documents',
    icon: FolderOpen,
  },

  {
    name: 'Workflow',
    icon: ListTodo,
    subItems: [
      { name: 'Tâches en cours',   href: '/workflow/notifications' },
      { name: 'Historique',        href: '/workflow/history' },
    ],
  },

  {
    name: 'Administration',
    icon: Settings,
    subItems: [
      { name: 'Utilisateurs',        href: '/admin/users' },
      { name: 'Paramètres Société',  href: '/admin/company-settings' },
      { name: 'Taux de Change',      href: '/admin/exchange-rates' },
      { name: 'Sauvegardes',         href: '/admin/backups' },
      { name: 'Import / Export',     href: '/admin/import-export' },
      { name: 'Audit Système',       href: '/admin/system' },
    ],
  },

  {
    name: 'Guide',
    href: '/guide',
    icon: BookOpenCheck,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SidebarNav({ isOpen, onClose }: SidebarNavProps) {
  const location = useLocation();
  const { user, logout, initials, displayName } = useAuthStore();

  // Auto-expand parent sections based on the current URL
  const [expandedItems, setExpandedItems] = useState<string[]>(() =>
    navigation
      .filter(
        (item) =>
          item.subItems?.some((sub) =>
            location.pathname === sub.href ||
            location.pathname.startsWith(sub.href + '/'),
          ),
      )
      .map((item) => item.name),
  );

  // Keep expanded state in sync when navigating programmatically
  useEffect(() => {
    setExpandedItems((prev) => {
      const toAdd = navigation
        .filter(
          (item) =>
            item.subItems?.some(
              (sub) =>
                location.pathname === sub.href ||
                location.pathname.startsWith(sub.href + '/'),
            ) && !prev.includes(item.name),
        )
        .map((item) => item.name);
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
  }, [location.pathname]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((n) => n !== itemName)
        : [...prev, itemName],
    );
  };

  const role = user?.role ?? '';

  const filteredNavigation = navigation.filter((item) => {
    if (item.href) {
      return canAccessRoute(role, item.href);
    }
    if (item.subItems) {
      return item.subItems.some((sub) => canAccessRoute(role, sub.href));
    }
    return true;
  });

  const isSubItemActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          bg-[#f1f1f1] shadow-[0_0_40px_rgba(0,0,0,0.08)]
          flex flex-col
          transition-all duration-300 ease-in-out
          will-change-[width,transform]
          ${isOpen
            ? 'w-64 translate-x-0'
            : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'
          }
        `}
      >
        {/* ── Logo / header ─────────────────────────────────────────────── */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 flex-shrink-0 overflow-hidden">
          <div
            className={`flex items-center gap-3 transition-opacity duration-200 ${
              isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0 pointer-events-none'
            }`}
          >
            <img
              src="/Image1.png"
              alt="ARS"
              className="w-8 h-8 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900 leading-tight whitespace-nowrap">
                ARS Tunisie
              </p>
              <p className="text-[10px] text-gray-500 whitespace-nowrap">
                Réassurance ERP
              </p>
            </div>
          </div>

          {/* Collapsed: show only icon */}
          <img
            src="/Image1.png"
            alt="ARS"
            className={`w-7 h-7 object-contain flex-shrink-0 ${
              isOpen ? 'hidden' : 'hidden lg:block'
            }`}
          />

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav
          className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden
            scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        >
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.includes(item.name);
            const hasSubItems = !!item.subItems?.length;
            const isActive =
              item.href
                ? location.pathname === item.href
                : false;
            const isParentActive =
              hasSubItems &&
              item.subItems!.some((sub) => isSubItemActive(sub.href));

            return (
              <div key={item.name}>
                {item.href ? (
                  /* ── Direct link ────────────────────────────────────── */
                  <Link
                    to={item.href}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    title={!isOpen ? item.name : undefined}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-150 group
                      ${isActive
                        ? 'bg-red-50 text-[#d52b36] font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.5 : 2}
                      className="flex-shrink-0"
                    />
                    <span
                      className={`text-[13px] whitespace-nowrap transition-opacity duration-200 ${
                        isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
                      }`}
                    >
                      {item.name}
                    </span>
                  </Link>
                ) : (
                  /* ── Expandable parent ──────────────────────────────── */
                  <>
                    <button
                      onClick={() => toggleExpand(item.name)}
                      title={!isOpen ? item.name : undefined}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                        transition-all duration-150 text-left
                        ${isParentActive
                          ? 'bg-red-50 text-[#d52b36] font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon
                        size={17}
                        strokeWidth={isParentActive ? 2.5 : 2}
                        className="flex-shrink-0"
                      />
                      <span
                        className={`flex-1 text-[13px] whitespace-nowrap transition-opacity duration-200 ${
                          isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
                        }`}
                      >
                        {item.name}
                      </span>
                      {hasSubItems && isOpen && (
                        <span className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                      )}
                    </button>

                    {/* Sub-items */}
                    {hasSubItems && isExpanded && isOpen && (
                      <div className="ml-7 mt-0.5 space-y-0.5">
                        {item.subItems!
                          .filter((sub) => canAccessRoute(role, sub.href))
                          .map((sub) => {
                            const active = isSubItemActive(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                onClick={() =>
                                  window.innerWidth < 1024 && onClose()
                                }
                                className={`
                                  flex items-center gap-2 px-3 py-2 rounded-lg
                                  text-[12px] transition-all duration-150
                                  ${active
                                    ? 'bg-red-50 text-[#d52b36] font-medium'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                  }
                                `}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    active ? 'bg-[#d52b36]' : 'bg-gray-400'
                                  }`}
                                />
                                {sub.name}
                              </Link>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── User footer ──────────────────────────────────────────────── */}
        <div className="p-3 border-t border-gray-200 flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors group">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#d52b36] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none">
              {initials()}
            </div>

            {/* Name + role (only when expanded) */}
            <div
              className={`flex-1 min-w-0 transition-opacity duration-200 ${
                isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-0'
              }`}
            >
              <p className="text-[12px] font-semibold text-gray-900 truncate leading-tight">
                {displayName()}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>

            {/* Logout button (only when expanded + hovered) */}
            <button
              onClick={logout}
              title="Se déconnecter"
              className={`
                p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500
                transition-all flex-shrink-0
                ${isOpen
                  ? 'opacity-0 group-hover:opacity-100'
                  : 'opacity-0 lg:opacity-0'
                }
              `}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}