import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SidebarNav from './navigation/SidebarNav';
import HorizontalNav from './navigation/HorizontalNav';
import NotificationBell from './NotificationBell';
import AppearanceDialog from './settings/AppearanceDialog';
import { useAuthStore } from '../lib/store';
import { useThemeStore } from '../lib/theme-store';

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/': 'pageTitles.dashboard',
  '/assures': 'pageTitles.assures',
  '/cedantes': 'pageTitles.cedantes',
  '/reassureurs': 'pageTitles.reassureurs',
  '/co-courtiers': 'pageTitles.coCourtiers',
  '/affaires/facultatives': 'pageTitles.affairesFacultatives',
  '/affaires/traites': 'pageTitles.affairesTraites',
  '/bordereaux': 'pageTitles.bordereaux',
  '/sinistres': 'pageTitles.sinistres',
  '/sinistres/new': 'pageTitles.sinistresNew',
  '/sinistres/bordereaux': 'pageTitles.sinistresBordereaux',
  '/sinistres/reserves': 'pageTitles.sinistresReserves',
  '/finances/encaissements': 'pageTitles.financesEncaissements',
  '/finances/decaissements': 'pageTitles.financesDecaissements',
  '/finances/ordres-virement': 'pageTitles.financesOrdresVirement',
  '/finances/commissions': 'pageTitles.financesCommissions',
  '/finances/settlements': 'pageTitles.financesSettlements',
  '/finances/lettrage': 'pageTitles.financesLettrage',
  '/comptabilite/ventes': 'pageTitles.comptaVentes',
  '/comptabilite/achats': 'pageTitles.comptaAchats',
  '/comptabilite/banque': 'pageTitles.comptaBanque',
  '/comptabilite/plan-comptable': 'pageTitles.comptaPlanComptable',
  '/comptabilite/reconciliation': 'pageTitles.comptaReconciliation',
  '/reporting/bordereaux': 'pageTitles.reportingBordereaux',
  '/reporting/portfolio': 'pageTitles.reportingPortfolio',
  '/reporting/exports': 'pageTitles.reportingExports',
  '/documents': 'pageTitles.documents',
  '/admin/users': 'pageTitles.adminUsers',
  '/admin/settings': 'pageTitles.adminSettings',
  '/admin/exchange-rates': 'pageTitles.adminExchangeRates',
  '/admin/backups': 'pageTitles.adminBackups',
  '/admin/import-export': 'pageTitles.adminImportExport',
  '/admin/system': 'pageTitles.adminSystem',
};

const getPageTitleKey = (pathname: string): string =>
  PAGE_TITLE_KEYS[pathname] || 'pageTitles.dashboard';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const layout = useThemeStore((s) => s.layout);

  const pageTitle = t(getPageTitleKey(location.pathname));

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-col h-screen bg-[#f1f1f1] dark:bg-[#0a0a0f] overflow-hidden transition-colors">
        <HorizontalNav onOpenAppearance={() => setAppearanceOpen(true)} />
        <main className="flex-1 overflow-auto bg-[#f1f1f1] dark:bg-[#0a0a0f] transition-colors">
          <Outlet />
        </main>
        <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f1f1f1] dark:bg-[#0a0a0f] overflow-hidden transition-colors">
      <SidebarNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenAppearance={() => setAppearanceOpen(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-[#f1f1f1] dark:bg-[#0a0a0f] border-b border-gray-200 dark:border-[#262636] z-[60] flex items-center justify-between px-4 lg:px-6 relative transition-colors">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1e2c] text-gray-600 dark:text-gray-400 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white ml-2">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-[#1e1e2c] transition-colors"
              >
                <User size={20} className="text-gray-600 dark:text-gray-400" />
                <span className="text-[13px] text-gray-700 dark:text-gray-300 hidden md:block">
                  {user?.firstName} {user?.lastName}
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#16161f] rounded-lg shadow-lg border border-gray-200 dark:border-[#262636] py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-[#1e1e2c]">
                    <p className="text-[12px] font-medium text-gray-900 dark:text-white">{user?.firstName} {user?.lastName}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{user?.email}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 uppercase">{user?.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut size={16} />
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#f1f1f1] dark:bg-[#0a0a0f] transition-colors">
          <Outlet />
        </main>
      </div>

      <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </div>
  );
}