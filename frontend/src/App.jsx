import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedLayout from "./components/layout/ProtectedLayout";
import { useAuthSessionQuery } from "./hooks/useAuthQueries";
import { AppProvider } from "./pages/AppContext";
import Home from "./pages/home/Home";
import { useTranslation } from "react-i18next";
import AcceptInvitationPage from "./pages/AcceptInvitationPage.jsx/AcceptInvitationPage";

const LandingPage = lazy(() => import("./pages/landing/LandingPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const SpacesPage = lazy(() => import("./pages/spaces/SpacesPage"));
const WhiteBoardPage = lazy(() => import("./pages/whiteboard/WhiteBoardPage"));
const AiAssistantPage = lazy(() => import("./pages/aiChat/AiAssistantPage"));
const BillingPage = lazy(() => import("./pages/dashboard/BillingPage"));
const TaskDetailsPage = lazy(() => import("./pages/dashboard/TaskDetailsPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const TableView = lazy(() => import("./pages/dashboard/TableView"));
const TimelineView = lazy(() => import("./pages/dashboard/TimelineView"));
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage"));
const IntegrationsPage = lazy(() => import("./pages/settings/IntegrationsPage"));
const SettingsBillingPage = lazy(() => import("./pages/settings/SettingsBillingPage"));
const SettingsMembersPage = lazy(() => import("./pages/settings/SettingsMembersPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const SearchPage = lazy(() => import("./pages/search/SearchPage"));
const MyWorkPage = lazy(() => import("./pages/mywork/MyWorkPage"));
const InboxPage = lazy(() => import("./pages/Inbox/InboxPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));
const SecurityPage = lazy(() => import("./pages/security/SecurityPage"));
const AuditLogPage = lazy(() => import("./pages/audit-log/AuditLogPage"));
const KanbanBoard = lazy(() => import("./pages/kanbanboard/KanbanBoard"));
const ApprovalsPage = lazy(() => import("./pages/approvals/ApprovalsPage"));
const WorkflowInstancesList = lazy(() => import("./pages/workflow/WorkflowInstancesList"));
const WorkflowBuilder = lazy(() => import("./pages/workflow/WorkflowBuilder"));
const OAuthCallbackPage = lazy(() => import("./pages/auth/OAuthCallbackPage"));

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-slate-500 text-sm">Loading workspace...</span>
      </div>
    </div>
  );
}

function PublicOnlyRoute({ isAuthenticated, authReady, children }) {
  if (!authReady) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/spaces" replace />;
  }

  return children;
}

function ProtectedShell({ isAuthenticated, authReady }) {
  const location = useLocation();

  if (!authReady) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function AppContent() {
  const [path, setPath] = useState([]);
  const [language, setLanguage] = useState("en");
  const { i18n } = useTranslation();
  const authSession = useAuthSessionQuery();
  const authReady = !authSession.isLoading;
  const isAuthenticated = Boolean(authSession.data?.isAuthenticated);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    void i18n.changeLanguage(language);
  }, [i18n, language]);

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            !authReady ? (
              <FullScreenLoader />
            ) : isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LandingPage />
            )
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/invitation"
          element={
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <AcceptInvitationPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/forgot-password" element={<ResetPasswordPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedShell authReady={authReady} isAuthenticated={isAuthenticated} />}>
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route
            element={
              <AppProvider>
                <ProtectedLayout setLanguage={setLanguage} language={language} />
              </AppProvider>
            }
          >
            <Route element={<Home path={path} setPath={setPath} />}>
              <Route path="spaces" element={<SpacesPage setPath={setPath} />} />
              <Route path="board/:boardId/kanban" element={<KanbanBoard setPath={setPath} />} />
              <Route path="whiteboard" element={<WhiteBoardPage />} />
              <Route path="ai-assistant" element={<AiAssistantPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="tasks/:taskId" element={<TaskDetailsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="board/:boardId/table" element={<TableView />} />
              <Route path="board/:boardId/timeline" element={<TimelineView />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="workflows" element={<WorkflowInstancesList />} />
              <Route path="workflows/builder" element={<WorkflowBuilder />} />
              <Route path="settings/integrations" element={<IntegrationsPage setPath={setPath} />} />
              <Route path="settings/billing" element={<SettingsBillingPage />} />
              <Route path="settings/members" element={<SettingsMembersPage setPath={setPath} />} />
              <Route path="reports" element={<ReportsPage setPath={setPath} />} />
              <Route path="mywork" element={<MyWorkPage setPath={setPath} />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="my-work" element={<MyWorkPage setPath={setPath} />} />
              <Route path="inbox" element={<InboxPage setPath={setPath} />} />
              <Route path="settings" element={<SettingsPage setPath={setPath} />} />
              <Route path="settings/notifications" element={<NotificationsPage setPath={setPath} />} />
              <Route path="settings/security" element={<SecurityPage setPath={setPath} />} />
              <Route path="settings/audit-log" element={<AuditLogPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/invitation" element={<AcceptInvitationPage />} />

            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? "/spaces" : "/"} replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary fallbackMessage="The application shell failed to load.">
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
