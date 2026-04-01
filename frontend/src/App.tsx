import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './lib/store';
import { canAccessRoute } from './config/permissions';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './features/dashboard/Dashboard';
import AssuresList from './features/assures/AssuresList';
import AssureDetail from './features/assures/AssureDetail';
import CedantesList from './features/cedantes/CedantesList';
import CedanteDetail from './features/cedantes/CedanteDetail';
import ReassureursList from './features/reassureurs/ReassureursList';
import AffairesList from './features/affaires/AffairesList';
import AffaireDetail from './features/affaires/AffaireDetail';

import SinistresList from './features/sinistres/SinistresList';
import SinistreAnalytics from './features/sinistres/SinistreAnalytics';
import SinistreForm from './features/sinistres/SinistreForm';
import SinistreDetail from './features/sinistres/SinistreDetail';
import BordereauxList from './features/bordereaux/BordereauxList';
import BordereauDetail from './features/bordereaux/BordereauDetail';
import FinancesPage from './features/finances/FinancesPage';
import CommissionsPage from './features/finances/CommissionsPage';
import SettlementsPage from './features/finances/SettlementsPage';
import PaymentOrdersPage from './features/finances/PaymentOrdersPage';
import FinancialDashboard from './features/finances/FinancialDashboard';
import GEDDashboard from './features/documents/GEDDashboard';
import CoCourtiersList from './features/co-courtiers/CoCourtiersList';
import {
  ComptabiliteDashboard,
  JournalVentes,
  JournalAchats,
  EcrituresBancaires,
  PlanComptable,
  Reconciliation,
  Balance,
  BalanceSheet,
  ProfitLoss,
  GrandLivre,
} from './features/comptabilite';
import PortfolioReport from './features/reports/PortfolioReport';
import ExportsPage from './features/reports/ExportsPage';
import WorkflowHistory from './features/workflow/WorkflowHistory';
import UserManagement from './features/admin/UserManagement';
import CompanySettings from './features/system/CompanySettings';
import AuditLogs from './features/system/AuditLogs';
import BackupRestore from './features/system/BackupRestore';
import DemoGuide from './features/guide/DemoGuide';
import FourStepPaymentWizard from './features/finances/FourStepPaymentWizard';
import SituationBuilder from './features/finances/SituationBuilder';
import DashboardPanels from './features/dashboard/DashboardPanels';
import CompanySettingsTabs from './features/system/CompanySettingsTabs';
import ExchangeRatesManager from './features/system/ExchangeRatesManager';
import ReportGenerator from './features/reports/ReportGenerator';
import WorkflowNotifications from './features/workflow/WorkflowNotifications';

function ProtectedRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { user } = useAuthStore();
  
  if (!canAccessRoute(user?.role || '', path)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { token } = useAuthStore();

  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
      <Routes>
        {!token ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="assures" element={<ProtectedRoute path="/assures"><AssuresList /></ProtectedRoute>} />
              <Route path="assures/:id" element={<ProtectedRoute path="/assures"><AssureDetail /></ProtectedRoute>} />
              <Route path="cedantes" element={<ProtectedRoute path="/cedantes"><CedantesList /></ProtectedRoute>} />
              <Route path="cedantes/:id" element={<ProtectedRoute path="/cedantes"><CedanteDetail /></ProtectedRoute>} />
              <Route path="reassureurs" element={<ProtectedRoute path="/reassureurs"><ReassureursList /></ProtectedRoute>} />
              <Route path="affaires" element={<ProtectedRoute path="/affaires"><AffairesList /></ProtectedRoute>} />
              <Route path="affaires/:id" element={<ProtectedRoute path="/affaires"><AffaireDetail /></ProtectedRoute>} />
              <Route path="sinistres" element={<ProtectedRoute path="/sinistres"><SinistresList /></ProtectedRoute>} />
              <Route path="sinistres/suivi" element={<ProtectedRoute path="/sinistres"><SinistreAnalytics /></ProtectedRoute>} />
              <Route path="sinistres/new" element={<ProtectedRoute path="/sinistres"><SinistreForm /></ProtectedRoute>} />
              <Route path="sinistres/:id" element={<ProtectedRoute path="/sinistres"><SinistreDetail /></ProtectedRoute>} />
              <Route path="bordereaux" element={<ProtectedRoute path="/bordereaux"><BordereauxList /></ProtectedRoute>} />
              <Route path="bordereaux/:id" element={<ProtectedRoute path="/bordereaux"><BordereauDetail /></ProtectedRoute>} />
              <Route path="finances" element={<ProtectedRoute path="/finances"><FinancesPage /></ProtectedRoute>} />
              <Route path="finances/commissions" element={<ProtectedRoute path="/finances"><CommissionsPage /></ProtectedRoute>} />
              <Route path="finances/settlements" element={<ProtectedRoute path="/finances"><SettlementsPage /></ProtectedRoute>} />
              <Route path="finances/payment-orders" element={<ProtectedRoute path="/finances"><PaymentOrdersPage /></ProtectedRoute>} />
              <Route path="finances/dashboard" element={<ProtectedRoute path="/finances"><FinancialDashboard /></ProtectedRoute>} />
              <Route path="finances/4-step-wizard" element={<ProtectedRoute path="/finances"><FourStepPaymentWizard affaireId="" affaireNumero="" assure={{ id: '', raisonSociale: '' }} cedante={{ id: '', raisonSociale: '' }} reassureurs={[]} prime100={0} primeCedee={0} commissionCedante={0} devise="TND" /></ProtectedRoute>} />
              <Route path="finances/situation-builder" element={<ProtectedRoute path="/finances"><SituationBuilder /></ProtectedRoute>} />
              <Route path="co-courtiers" element={<ProtectedRoute path="/co-courtiers"><CoCourtiersList /></ProtectedRoute>} />
              <Route path="comptabilite" element={<ProtectedRoute path="/comptabilite"><ComptabiliteDashboard /></ProtectedRoute>} />
              <Route path="comptabilite/dashboard" element={<ProtectedRoute path="/comptabilite"><ComptabiliteDashboard /></ProtectedRoute>} />
              <Route path="comptabilite/plan-comptable" element={<ProtectedRoute path="/comptabilite"><PlanComptable /></ProtectedRoute>} />
              <Route path="comptabilite/grand-livre" element={<ProtectedRoute path="/comptabilite"><GrandLivre /></ProtectedRoute>} />
              <Route path="comptabilite/balance" element={<ProtectedRoute path="/comptabilite"><Balance /></ProtectedRoute>} />
              <Route path="comptabilite/bilan" element={<ProtectedRoute path="/comptabilite"><BalanceSheet /></ProtectedRoute>} />
              <Route path="comptabilite/resultat" element={<ProtectedRoute path="/comptabilite"><ProfitLoss /></ProtectedRoute>} />
              <Route path="comptabilite/journal-ventes" element={<ProtectedRoute path="/comptabilite"><JournalVentes /></ProtectedRoute>} />
              <Route path="comptabilite/journal-achats" element={<ProtectedRoute path="/comptabilite"><JournalAchats /></ProtectedRoute>} />
              <Route path="comptabilite/journal-banque" element={<ProtectedRoute path="/comptabilite"><EcrituresBancaires /></ProtectedRoute>} />
              <Route path="comptabilite/reconciliation" element={<ProtectedRoute path="/comptabilite"><Reconciliation /></ProtectedRoute>} />
              <Route path="reporting" element={<ProtectedRoute path="/reporting"><Dashboard /></ProtectedRoute>} />
              <Route path="reporting/dashboard" element={<ProtectedRoute path="/reporting"><Dashboard /></ProtectedRoute>} />
              <Route path="reporting/portfolio" element={<ProtectedRoute path="/reporting"><PortfolioReport /></ProtectedRoute>} />
              <Route path="reporting/exports" element={<ProtectedRoute path="/reporting"><ExportsPage /></ProtectedRoute>} />
              <Route path="reporting/generator" element={<ProtectedRoute path="/reporting"><ReportGenerator type="note_debit" /></ProtectedRoute>} />
              <Route path="reporting/dashboard-panels" element={<ProtectedRoute path="/reporting"><DashboardPanels /></ProtectedRoute>} />
              <Route path="workflow/history" element={<ProtectedRoute path="/workflow"><WorkflowHistory /></ProtectedRoute>} />
              <Route path="workflow/notifications" element={<ProtectedRoute path="/workflow"><WorkflowNotifications /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute path="/admin"><UserManagement /></ProtectedRoute>} />
              <Route path="admin/settings" element={<ProtectedRoute path="/admin"><CompanySettings /></ProtectedRoute>} />
              <Route path="admin/exchange-rates" element={<ProtectedRoute path="/admin"><ExchangeRatesManager /></ProtectedRoute>} />
              <Route path="admin/company-settings" element={<ProtectedRoute path="/admin"><CompanySettingsTabs /></ProtectedRoute>} />
              <Route path="admin/backups" element={<ProtectedRoute path="/admin"><BackupRestore /></ProtectedRoute>} />
              <Route path="admin/import-export" element={<ProtectedRoute path="/admin"><ExportsPage /></ProtectedRoute>} />
              <Route path="admin/system" element={<ProtectedRoute path="/admin"><AuditLogs /></ProtectedRoute>} />
              <Route path="documents" element={<ProtectedRoute path="/documents"><GEDDashboard /></ProtectedRoute>} />
              <Route path="guide" element={<DemoGuide />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;
