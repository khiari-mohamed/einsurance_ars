import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './lib/store';
import { canAccessRoute } from './config/permissions.config';

// ── Auth ─────────────────────────────────────────────────────────────────────────
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';

// ── Shell ────────────────────────────────────────────────────────────────────────
import DashboardLayout from './components/DashboardLayout';

// ── Dashboard ────────────────────────────────────────────────────────────────────
import Dashboard from './features/dashboard/Dashboard';
import DashboardPanels from './features/dashboard/DashboardPanels';

// ── Référentiel ──────────────────────────────────────────────────────────────────
import AssuresList from './features/assures/AssuresList';
import AssureDetail from './features/assures/AssureDetail';
import CedantesList from './features/cedantes/CedantesList';
import CedanteDetail from './features/cedantes/CedanteDetail';
import ReassureursList from './features/reassureurs/ReassureursList';
import ReassureurDetail from './features/reassureurs/ReassureurDetail';
import CoCourtiersList from './features/co-courtiers/CoCourtiersList';

// ── Affaires ──────────────────────────────────────────────────────────────────────
import AffairesList from './features/affaires/AffairesList';
import AffaireDetail from './features/affaires/AffaireDetail';

// ── Traités ───────────────────────────────────────────────────────────────────────
import TraitesList from './features/traites/TraitesList';

// ── Sinistres ─────────────────────────────────────────────────────────────────────
import SinistresList from './features/sinistres/SinistresList';
import SinistreAnalytics from './features/sinistres/SinistreAnalytics';
import SinistreForm from './features/sinistres/SinistreForm';
import SinistreDetail from './features/sinistres/SinistreDetail';

// ── Bordereaux ────────────────────────────────────────────────────────────────────
import BordereauxList from './features/bordereaux/BordereauxList';
import BordereauDetail from './features/bordereaux/BordereauDetail';

// ── Finances ──────────────────────────────────────────────────────────────────────
import FinancesPage from './features/finances/FinancesPage';
import CommissionsPage from './features/finances/CommissionsPage';
import SettlementsPage from './features/finances/SettlementsPage';
import PaymentOrdersPage from './features/finances/PaymentOrdersPage';
import FinancialDashboard from './features/finances/FinancialDashboard';
import SituationBuilder from './features/finances/SituationBuilder';

// ── Comptabilité ──────────────────────────────────────────────────────────────────
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

// ── Reporting ─────────────────────────────────────────────────────────────────────
import PortfolioReport from './features/reports/PortfolioReport';
import ExportsPage from './features/reports/ExportsPage';
import ReportGenerator from './features/reports/ReportGenerator';

// ── GED ───────────────────────────────────────────────────────────────────────────
import GEDDashboard from './features/documents/GEDDashboard';

// ── Workflow ──────────────────────────────────────────────────────────────────────
import WorkflowHistory from './features/workflow/WorkflowHistory';
import WorkflowNotifications from './features/workflow/WorkflowNotifications';

// ── Administration ────────────────────────────────────────────────────────────────
import UserManagement from './features/admin/UserManagement';
import CompanySettingsTabs from './features/system/CompanySettingsTabs';
import ExchangeRatesManager from './features/system/ExchangeRatesManager';
import BackupRestore from './features/system/BackupRestore';
import AuditLogs from './features/system/AuditLogs';
import ImportExport from './features/system/ImportExport';

// ── Guide ─────────────────────────────────────────────────────────────────────────
import DemoGuide from './features/guide/DemoGuide';

// ── Route guard ───────────────────────────────────────────────────────────────────

function ProtectedRoute({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string;
}) {
  const role = useAuthStore((s) => s.user?.role ?? '');

  if (!canAccessRoute(role, path)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────────

export default function App() {
  const token = useAuthStore((s) => s.token);

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Routes>
          {!token ? (
            /* ── Unauthenticated routes ─────────────────────────────────────── */
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            /* ── Authenticated routes ──────────────────────────────────────── */
            <Route path="/" element={<DashboardLayout />}>

              {/* Dashboard */}
              <Route index element={<Dashboard />} />

              {/* ── Référentiel ────────────────────────────────────────────── */}
              <Route
                path="assures"
                element={
                  <ProtectedRoute path="/assures">
                    <AssuresList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="assures/:id"
                element={
                  <ProtectedRoute path="/assures">
                    <AssureDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cedantes"
                element={
                  <ProtectedRoute path="/cedantes">
                    <CedantesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="cedantes/:id"
                element={
                  <ProtectedRoute path="/cedantes">
                    <CedanteDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reassureurs"
                element={
                  <ProtectedRoute path="/reassureurs">
                    <ReassureursList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reassureurs/:id"
                element={
                  <ProtectedRoute path="/reassureurs">
                    <ReassureurDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="co-courtiers"
                element={
                  <ProtectedRoute path="/co-courtiers">
                    <CoCourtiersList />
                  </ProtectedRoute>
                }
              />

              {/* ── Affaires ───────────────────────────────────────────────── */}
              <Route
                path="affaires"
                element={
                  <ProtectedRoute path="/affaires">
                    <AffairesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="affaires/:id"
                element={
                  <ProtectedRoute path="/affaires">
                    <AffaireDetail />
                  </ProtectedRoute>
                }
              />

              {/* ── Traités ────────────────────────────────────────────────── */}
              <Route
                path="traites"
                element={
                  <ProtectedRoute path="/affaires">
                    <TraitesList />
                  </ProtectedRoute>
                }
              />

              {/* ── Sinistres ──────────────────────────────────────────────── */}
              <Route
                path="sinistres"
                element={
                  <ProtectedRoute path="/sinistres">
                    <SinistresList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sinistres/new"
                element={
                  <ProtectedRoute path="/sinistres">
                    <SinistreForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sinistres/suivi"
                element={
                  <ProtectedRoute path="/sinistres">
                    <SinistreAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="sinistres/:id"
                element={
                  <ProtectedRoute path="/sinistres">
                    <SinistreDetail />
                  </ProtectedRoute>
                }
              />

              {/* ── Bordereaux ─────────────────────────────────────────────── */}
              <Route
                path="bordereaux"
                element={
                  <ProtectedRoute path="/bordereaux">
                    <BordereauxList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bordereaux/:id"
                element={
                  <ProtectedRoute path="/bordereaux">
                    <BordereauDetail />
                  </ProtectedRoute>
                }
              />

              {/* ── Finances ───────────────────────────────────────────────── */}
              <Route
                path="finances"
                element={
                  <ProtectedRoute path="/finances">
                    <FinancesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="finances/commissions"
                element={
                  <ProtectedRoute path="/finances">
                    <CommissionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="finances/settlements"
                element={
                  <ProtectedRoute path="/finances">
                    <SettlementsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="finances/payment-orders"
                element={
                  <ProtectedRoute path="/finances">
                    <PaymentOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="finances/dashboard"
                element={
                  <ProtectedRoute path="/finances">
                    <FinancialDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="finances/situation-builder"
                element={
                  <ProtectedRoute path="/finances">
                    <SituationBuilder />
                  </ProtectedRoute>
                }
              />
              {/* FourStepPaymentWizard is a modal launched from AffaireDetail —
                  redirect the bare route to finances to avoid broken empty-props render */}
              <Route
                path="finances/4-step-wizard"
                element={<Navigate to="/finances" replace />}
              />

              {/* ── Comptabilité ───────────────────────────────────────────── */}
              <Route
                path="comptabilite"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <ComptabiliteDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/dashboard"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <ComptabiliteDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/plan-comptable"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <PlanComptable />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/grand-livre"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <GrandLivre />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/balance"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <Balance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/bilan"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <BalanceSheet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/resultat"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <ProfitLoss />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/journal-ventes"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <JournalVentes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/journal-achats"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <JournalAchats />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/journal-banque"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <EcrituresBancaires />
                  </ProtectedRoute>
                }
              />
              <Route
                path="comptabilite/reconciliation"
                element={
                  <ProtectedRoute path="/comptabilite">
                    <Reconciliation />
                  </ProtectedRoute>
                }
              />

              {/* ── Reporting ──────────────────────────────────────────────── */}
              <Route
                path="reporting"
                element={
                  <ProtectedRoute path="/reporting">
                    <DashboardPanels />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reporting/dashboard"
                element={
                  <ProtectedRoute path="/reporting">
                    <DashboardPanels />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reporting/portfolio"
                element={
                  <ProtectedRoute path="/reporting">
                    <PortfolioReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reporting/exports"
                element={
                  <ProtectedRoute path="/reporting">
                    <ExportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reporting/generator"
                element={
                  <ProtectedRoute path="/reporting">
                    <ReportGenerator type="note_debit" />
                  </ProtectedRoute>
                }
              />

              {/* ── GED ────────────────────────────────────────────────────── */}
              <Route
                path="documents"
                element={
                  <ProtectedRoute path="/documents">
                    <GEDDashboard />
                  </ProtectedRoute>
                }
              />

              {/* ── Workflow ────────────────────────────────────────────────── */}
              <Route
                path="workflow/history"
                element={
                  <ProtectedRoute path="/workflow">
                    <WorkflowHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="workflow/notifications"
                element={
                  <ProtectedRoute path="/workflow">
                    <WorkflowNotifications />
                  </ProtectedRoute>
                }
              />

              {/* ── Administration ─────────────────────────────────────────── */}
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute path="/admin">
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/company-settings"
                element={
                  <ProtectedRoute path="/admin">
                    <CompanySettingsTabs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/exchange-rates"
                element={
                  <ProtectedRoute path="/admin">
                    <ExchangeRatesManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/backups"
                element={
                  <ProtectedRoute path="/admin">
                    <BackupRestore />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/import-export"
                element={
                  <ProtectedRoute path="/admin">
                    <ImportExport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/system"
                element={
                  <ProtectedRoute path="/admin">
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />

              {/* ── Guide ──────────────────────────────────────────────────── */}
              <Route path="guide" element={<DemoGuide />} />

              {/* ── Catch-all inside layout ────────────────────────────────── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </>
  );
}
