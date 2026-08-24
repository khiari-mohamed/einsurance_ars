import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelLeft, LogOut, User, Search } from 'lucide-react';
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
  // Purely visual for now — no search logic wired up yet.
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const layout = useThemeStore((s) => s.layout);

  const pageTitle = t(getPageTitleKey(location.pathname));
  const userDisplayName = user ? `${user.prenom} ${user.nom}`.trim() : '';

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const HeaderSearch = () => (
    <div className="hidden md:flex items-center gap-2 w-full max-w-sm px-3 py-2 rounded-lg bg-secondary border border-secondary-border text-muted-foreground focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40 transition-colors">
      <Search size={15} className="flex-shrink-0" />
      <input
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder={t('common.search', 'Rechercher...')}
        className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-muted-foreground text-foreground"
      />
      <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded border border-border text-[10px] font-mono-label tracking-normal text-muted-foreground">
        ⌘K
      </kbd>
    </div>
  );

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden transition-colors">
        <HorizontalNav onOpenAppearance={() => setAppearanceOpen(true)} />
        <main className="flex-1 overflow-auto pt-16 bg-background transition-colors">
          <Outlet />
        </main>
        <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden transition-colors">
      <SidebarNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenAppearance={() => setAppearanceOpen(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden pt-16">
        <header className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-[60] flex items-center gap-4 px-4 lg:px-6 transition-colors">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeft size={18} />
            </button>
            <div className="hidden sm:block leading-tight">
              <h1 className="font-display text-[16px] font-semibold text-foreground m-0">
                {pageTitle}
              </h1>
              <p className="font-mono-label text-[9px] text-muted-foreground m-0">
                {t('sidebar.appName')} · {t('sidebar.appSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <HeaderSearch />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <User size={20} className="text-muted-foreground" />
                <span className="text-[13px] text-secondary-foreground hidden md:block">
                  {userDisplayName}
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-2xl border border-border py-1 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-[12px] font-medium text-foreground">{userDisplayName}</p>
                    <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                    <p className="text-[10px] text-primary mt-1 uppercase font-mono-label">{user?.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut size={16} />
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background transition-colors">
          <Outlet />
        </main>
      </div>

      <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </div>
  );
}