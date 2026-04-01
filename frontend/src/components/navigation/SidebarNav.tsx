import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, AlertTriangle, DollarSign, LogOut, X, ChevronDown, ChevronRight, BookOpen, BarChart3, FolderOpen, Settings, Receipt, BookOpenCheck } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { canAccessRoute } from '../../config/permissions';

interface SubMenuItem {
  name: string;
  href: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  subItems?: SubMenuItem[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },

  { 
    name: 'Données de Base', 
    icon: Users,
    subItems: [
      { name: 'Assurés', href: '/assures' },
      { name: 'Cédantes', href: '/cedantes' },
      { name: 'Réassureurs', href: '/reassureurs' },
      { name: 'Co-Courtiers', href: '/co-courtiers' },
    ]
  },

  { 
    name: 'Affaires', 
    icon: FileText,
    href: '/affaires',
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
      { name: 'Liste', href: '/sinistres' },
      { name: 'Enregistrer', href: '/sinistres/new' },
      { name: 'Suivi', href: '/sinistres/suivi' },
    ]
  },

  { 
    name: 'Finance', 
    icon: DollarSign,
    subItems: [
      { name: 'Transactions', href: '/finances' },
      { name: 'Commissions', href: '/finances/commissions' },
      { name: 'Situations', href: '/finances/settlements' },
      { name: 'Générateur Situation', href: '/finances/situation-builder' },
      { name: 'Flux 4 Étapes', href: '/finances/4-step-wizard' },
      { name: 'Ordres Paiement', href: '/finances/payment-orders' },
      { name: 'Dashboard', href: '/finances/dashboard' },
    ]
  },

  { 
    name: 'Comptabilité', 
    icon: BookOpen,
    subItems: [
      { name: 'Dashboard', href: '/comptabilite/dashboard' },
      { name: 'Plan Comptable', href: '/comptabilite/plan-comptable' },
      { name: 'Grand Livre', href: '/comptabilite/grand-livre' },
      { name: 'Balance', href: '/comptabilite/balance' },
      { name: 'Bilan', href: '/comptabilite/bilan' },
      { name: 'Compte Résultat', href: '/comptabilite/resultat' },
      { name: 'Journal Ventes', href: '/comptabilite/journal-ventes' },
      { name: 'Journal Achats', href: '/comptabilite/journal-achats' },
      { name: 'Journal Banque', href: '/comptabilite/journal-banque' },
      { name: 'Réconciliation', href: '/comptabilite/reconciliation' },
    ]
  },

  { 
    name: 'Reporting', 
    icon: BarChart3,
    subItems: [
      { name: 'Dashboard', href: '/reporting/dashboard' },
      { name: 'Tableaux de Bord', href: '/reporting/dashboard-panels' },
      { name: 'Portfolio', href: '/reporting/portfolio' },
      { name: 'Générateur Rapports', href: '/reporting/generator' },
      { name: 'Exports & Rapports', href: '/reporting/exports' },
    ]
  },

  { 
    name: 'GED', 
    href: '/documents',
    icon: FolderOpen,
  },

  { 
    name: 'Guide Démo', 
    href: '/guide',
    icon: BookOpenCheck,
  },

  { 
    name: 'Workflow', 
    icon: BookOpen,
    subItems: [
      { name: 'Historique', href: '/workflow/history' },
      { name: 'Notifications', href: '/workflow/notifications' },
    ]
  },

  { 
    name: 'Administration', 
    icon: Settings,
    subItems: [
      { name: 'Utilisateurs', href: '/admin/users' },
      { name: 'Paramètres Société', href: '/admin/company-settings' },
      { name: 'Taux de Change', href: '/admin/exchange-rates' },
      { name: 'Sauvegardes', href: '/admin/backups' },
      { name: 'Import/Export', href: '/admin/import-export' },
      { name: 'Système', href: '/admin/system' },
    ]
  },
];

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SidebarNav({ isOpen, onClose }: SidebarNavProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };
  
  const filteredNavigation = navigation.filter(item => {
    if (item.href) {
      return canAccessRoute(user?.role || '', item.href);
    }
  
    if (item.subItems) {
      return item.subItems.some(sub => canAccessRoute(user?.role || '', sub.href));
    }
    return true;
  });

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={onClose}
        />
      )}

      <aside
  className={`fixed lg:relative inset-y-0 left-0 z-50 bg-[#f1f1f1] shadow-[0_0_40px_rgba(0,0,0,0.08)]
  transition-all duration-900 ease-[cubic-bezier(0.22,1,0.36,1)]
  will-change-transform will-change-width flex flex-col
  ${isOpen ? 'w-64 translate-x-0' : 'w-0 lg:w-16 -translate-x-full lg:translate-x-0'}`}
>

        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100 overflow-hidden flex-shrink-0">
          <div className={`flex items-center gap-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'lg:opacity-0'}`}>
            <img src="/Image1.png" alt="ARS Logo" className="w-8 h-8 object-contain flex-shrink-0" />
            <span className="text-[15px] font-semibold text-gray-900 tracking-tight whitespace-nowrap">ARS Tunisie</span>
          </div>
          <img src="/Image1.png" alt="ARS Logo" className={`w-8 h-8 object-contain ${isOpen ? 'hidden' : 'hidden lg:flex'}`} />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.includes(item.name);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isActive = item.href ? location.pathname === item.href : false;
            const isParentActive = hasSubItems && item.subItems?.some(sub => location.pathname === sub.href);
            
            return (
              <div key={item.name}>
                {item.href ? (
                  <Link
                    to={item.href}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={!isOpen ? item.name : ''}
                  >
                    <Icon size={18} strokeWidth={2} className="flex-shrink-0" />
                    <span className={`text-[13px] font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'lg:opacity-0'}`}>{item.name}</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isParentActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={!isOpen ? item.name : ''}
                  >
                    <Icon size={18} strokeWidth={2} className="flex-shrink-0" />
                    <span className={`flex-1 text-left text-[13px] font-medium whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'lg:opacity-0'}`}>{item.name}</span>
                    {hasSubItems && isOpen && (
                      isExpanded ? <ChevronDown size={16} className="flex-shrink-0" /> : <ChevronRight size={16} className="flex-shrink-0" />
                    )}
                  </button>
                )}
                
                {hasSubItems && isExpanded && isOpen && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {item.subItems?.filter(sub => canAccessRoute(user?.role || '', sub.href)).map((subItem) => {
                      const isSubActive = location.pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.href}
                          to={subItem.href}
                          onClick={() => window.innerWidth < 1024 && onClose()}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-[12px] ${
                            isSubActive
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 bg-[#f1f1f1] overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className={`flex-1 min-w-0 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'lg:opacity-0'}`}>
              <p className="text-[13px] font-medium text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className={`p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all ${isOpen ? 'opacity-0 group-hover:opacity-100' : 'lg:opacity-0'}`}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
