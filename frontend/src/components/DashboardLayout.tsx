import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';
import SidebarNav from './navigation/SidebarNav';
import NotificationBell from './NotificationBell';
import { useAuthStore } from '../lib/store';

const getPageTitle = (pathname: string): string => {
  const routes: Record<string, string> = {
    '/': 'Dashboard',
    '/assures': 'Assurés',
    '/cedantes': 'Cédantes',
    '/reassureurs': 'Réassureurs',
    '/co-courtiers': 'Co-Courtiers',
    '/affaires/facultatives': 'Affaires Facultatives',
    '/affaires/traites': 'Traités',
    '/bordereaux': 'Bordereaux',
    '/sinistres': 'Sinistres',
    '/sinistres/new': 'Nouveau Sinistre',
    '/sinistres/bordereaux': 'Bordereaux Sinistres',
    '/sinistres/reserves': 'Réserves & Situations',
    '/finances/encaissements': 'Encaissements',
    '/finances/decaissements': 'Décaissements',
    '/finances/ordres-virement': 'Ordres de Virement',
    '/finances/commissions': 'Commissions',
    '/finances/settlements': 'Settlements',
    '/finances/lettrage': 'Lettrage',
    '/comptabilite/ventes': 'Journal des Ventes',
    '/comptabilite/achats': 'Journal des Achats',
    '/comptabilite/banque': 'Écritures Bancaires',
    '/comptabilite/plan-comptable': 'Plan Comptable',
    '/comptabilite/reconciliation': 'Réconciliation',
    '/reporting/bordereaux': 'Reporting Bordereaux',
    '/reporting/portfolio': 'Portfolio',
    '/reporting/exports': 'Exports',
    '/documents': 'GED',
    '/admin/users': 'Utilisateurs',
    '/admin/settings': 'Paramètres',
    '/admin/exchange-rates': 'Taux de Change',
    '/admin/backups': 'Sauvegardes',
    '/admin/import-export': 'Import/Export',
    '/admin/system': 'Système',
  };
  return routes[pathname] || 'Dashboard';
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-[#f1f1f1] overflow-hidden">
      <SidebarNav isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-[#f1f1f1] border-b border-gray-200 z-[60] flex items-center justify-between px-4 lg:px-6 relative">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-[15px] font-semibold text-gray-900 ml-2">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors"
              >
                <User size={20} className="text-gray-600" />
                <span className="text-[13px] text-gray-700 hidden md:block">
                  {user?.firstName} {user?.lastName}
                </span>
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-[12px] font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                    <p className="text-[11px] text-gray-500">{user?.email}</p>
                    <p className="text-[10px] text-blue-600 mt-1 uppercase">{user?.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                  >                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
