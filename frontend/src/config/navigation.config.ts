import {
  Home, Database, FileText, AlertTriangle, DollarSign, BookOpen,
  BarChart3, FolderOpen, Settings, Receipt, ListTodo, BookOpenCheck,
} from 'lucide-react';

export interface SubMenuItem {
  nameKey: string;
  href: string;
}

export interface NavigationItem {
  nameKey: string;
  href?: string;
  icon: React.ElementType;
  subItems?: SubMenuItem[];
}

export const navigation: NavigationItem[] = [
  { nameKey: 'nav.dashboard', href: '/', icon: Home },
  {
    nameKey: 'nav.referentiel', icon: Database,
    subItems: [
      { nameKey: 'nav.clients', href: '/assures' },
      { nameKey: 'nav.cedantes', href: '/cedantes' },
      { nameKey: 'nav.reassureurs', href: '/reassureurs' },
      { nameKey: 'nav.coCourtiers', href: '/co-courtiers' },
      { nameKey: 'nav.referentielHistory', href: '/referentiel/history' },
    ],
  },
  {
    nameKey: 'nav.affaires', icon: FileText,
    subItems: [
      { nameKey: 'nav.affairesToutes', href: '/affaires' },
      { nameKey: 'nav.facultatives', href: '/facultatives' },
      { nameKey: 'nav.traites', href: '/traites' },
    ],
  },
  { nameKey: 'nav.bordereaux', icon: Receipt, href: '/bordereaux' },
  {
    nameKey: 'nav.sinistres', icon: AlertTriangle,
    subItems: [
      { nameKey: 'nav.sinistresListe', href: '/sinistres' },
      { nameKey: 'nav.sinistresDeclarer', href: '/sinistres/new' },
      { nameKey: 'nav.sinistresAnalytique', href: '/sinistres/suivi' },
    ],
  },
  {
    nameKey: 'nav.finances', icon: DollarSign,
    subItems: [
      { nameKey: 'nav.financesTransactions', href: '/finances' },
      { nameKey: 'nav.financesCommissions', href: '/finances/commissions' },
      { nameKey: 'nav.financesSituations', href: '/finances/situations' },
      { nameKey: 'nav.financesCompilerSituation', href: '/finances/situation-builder' },
      { nameKey: 'nav.financesOrdresPaiement', href: '/finances/payment-orders' },
      { nameKey: 'nav.financesDashboard', href: '/finances/dashboard' },
    ],
  },
  {
    nameKey: 'nav.comptabilite', icon: BookOpen,
    subItems: [
      { nameKey: 'nav.comptaDashboard', href: '/comptabilite/dashboard' },
      { nameKey: 'nav.comptaPlanComptable', href: '/comptabilite/plan-comptable' },
      { nameKey: 'nav.comptaGrandLivre', href: '/comptabilite/grand-livre' },
      { nameKey: 'nav.comptaBalance', href: '/comptabilite/balance' },
      { nameKey: 'nav.comptaBilan', href: '/comptabilite/bilan' },
      { nameKey: 'nav.comptaResultat', href: '/comptabilite/resultat' },
      { nameKey: 'nav.comptaJournalVentes', href: '/comptabilite/journal-ventes' },
      { nameKey: 'nav.comptaJournalAchats', href: '/comptabilite/journal-achats' },
      { nameKey: 'nav.comptaJournalBanque', href: '/comptabilite/journal-banque' },
      { nameKey: 'nav.comptaReconciliation', href: '/comptabilite/reconciliation' },
    ],
  },
  {
    nameKey: 'nav.reporting', icon: BarChart3,
    subItems: [
      { nameKey: 'nav.reportingDashboard', href: '/reporting/dashboard' },
      { nameKey: 'nav.reportingPortfolio', href: '/reporting/portfolio' },
      { nameKey: 'nav.reportingGenerateur', href: '/reporting/generator' },
      { nameKey: 'nav.reportingExports', href: '/reporting/exports' },
    ],
  },
  { nameKey: 'nav.ged', href: '/documents', icon: FolderOpen },
  {
    nameKey: 'nav.workflow', icon: ListTodo,
    subItems: [
      { nameKey: 'nav.workflowTaches', href: '/workflow/notifications' },
      { nameKey: 'nav.workflowHistorique', href: '/workflow/history' },
    ],
  },
  {
    nameKey: 'nav.administration', icon: Settings,
    subItems: [
      { nameKey: 'nav.adminUtilisateurs', href: '/admin/users' },
      { nameKey: 'nav.adminParametresSociete', href: '/admin/company-settings' },
      { nameKey: 'nav.adminTauxChange', href: '/admin/exchange-rates' },
      { nameKey: 'nav.adminSauvegardes', href: '/admin/backups' },
      { nameKey: 'nav.adminImportExport', href: '/admin/import-export' },
      { nameKey: 'nav.adminAudit', href: '/admin/system' },
    ],
  },
  { nameKey: 'nav.guide', href: '/guide', icon: BookOpenCheck },
];