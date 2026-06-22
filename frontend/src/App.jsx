import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useOutletContext } from "react-router";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import { AppProvider } from "./pages/AppContext";
import ErrorBoundary from "./components/error-boundary/ErrorBoundary";
import { useAuthSessionQuery } from "./hooks/useAuthQueries";

const LandingPage = lazy(() => import("./pages/landing/LandingPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const OAuthCallbackPage = lazy(() => import("./pages/auth/OAuthCallbackPage"));
const OnboardingPage = lazy(() => import("./pages/onboarding/OnboardingPage"));
const WhiteBoardPage = lazy(() => import("./pages/whiteboard/WhiteBoardPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const RedesignView = lazy(() => import("./pages/dashboard/RedesignView"));
const ListView = lazy(() => import("./pages/dashboard/ListView"));
const TableView = lazy(() => import("./pages/dashboard/TableView"));
const TimelineView = lazy(() => import("./pages/dashboard/TimelineView"));
const TaskDetailsPage = lazy(() => import("./pages/dashboard/TaskDetailsPage"));
const BillingPage = lazy(() => import("./pages/dashboard/BillingPage"));
const AiAssistantPage = lazy(() => import("./pages/aiChat/AiAssistantPage"));
const SpacesPage = lazy(() => import("./pages/spaces/SpacesPage"));
const MyWorkPage = lazy(() => import("./pages/mywork/MyWorkPage"));
const InboxPage = lazy(() => import("./pages/Inbox/InboxPage"));
const SearchPage = lazy(() => import("./pages/search/SearchPage"));
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const IntegrationsPage = lazy(() => import("./pages/settings/IntegrationsPage"));
const SettingsMembersPage = lazy(() => import("./pages/settings/SettingsMembersPage"));
const SettingsPlaceholderPage = lazy(() => import("./pages/settings/SettingsPlaceholderPage"));
const SettingsAuditLogPage = lazy(() => import("./pages/settings/SettingsAuditLogPage"));
const bypassAuth = true; 

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
        <p className="text-sm text-slate-500">Loading workspace...</p>
      </div>
    </div>
  );
}

function PublicOnlyRoute({ isAuthenticated, authReady, children }) {
  if (!authReady) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedShell({ isAuthenticated, authReady, allowBypass }) {
  const location = useLocation();

  if (!authReady) {
    return <FullScreenLoader />;
  }

  if (!allowBypass && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <AppProvider>
      <DashboardLayout />
    </AppProvider>
  );
}

function RoutedWorkspacePage({ Component, componentProps = {} }) {
  const context = useOutletContext() || {};
  return <Component {...context} {...componentProps} />;
}

function AppRoutes() {
  const authSession = useAuthSessionQuery();
  const authReady = !authSession.isLoading;
  const isAuthenticated = Boolean(authSession.data?.isAuthenticated);

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route
          path="/"
          element={(
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <LandingPage />
            </PublicOnlyRoute>
          )}
        />
        <Route
          path="/login"
          element={(
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <LoginPage />
            </PublicOnlyRoute>
          )}
        />
        <Route
          path="/register"
          element={(
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <RegisterPage />
            </PublicOnlyRoute>
          )}
        />
        <Route path="/forgot-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

        <Route element={<ProtectedShell authReady={authReady} isAuthenticated={isAuthenticated} allowBypass={bypassAuth} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/my-work" element={<RoutedWorkspacePage Component={MyWorkPage} />} />
          <Route path="/inbox" element={<RoutedWorkspacePage Component={InboxPage} />} />
          <Route path="/search" element={<RoutedWorkspacePage Component={SearchPage} />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<RoutedWorkspacePage Component={ReportsPage} />} />
          <Route path="/settings" element={<RoutedWorkspacePage Component={SettingsPage} />} />
          <Route
            path="/settings/notifications"
            element={<RoutedWorkspacePage Component={SettingsPlaceholderPage} componentProps={{ activeId: "notifications" }} />}
          />
          <Route
            path="/settings/security"
            element={<RoutedWorkspacePage Component={SettingsPlaceholderPage} componentProps={{ activeId: "security" }} />}
          />
          <Route path="/settings/members" element={<RoutedWorkspacePage Component={SettingsMembersPage} />} />
          <Route path="/settings/billing" element={<Navigate to="/billing" replace />} />
          <Route path="/settings/integrations" element={<RoutedWorkspacePage Component={IntegrationsPage} />} />
          <Route path="/settings/reports" element={<Navigate to="/reports" replace />} />
          <Route path="/settings/audit-log" element={<RoutedWorkspacePage Component={SettingsAuditLogPage} />} />
          <Route path="/whiteboard" element={<WhiteBoardPage />} />
          <Route path="/ai-assistant" element={<AiAssistantPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/board/:boardId" element={<RedesignView />} />
          <Route path="/board/:boardId/list" element={<ListView />} />
          <Route path="/board/:boardId/table" element={<TableView />} />
          <Route path="/board/:boardId/timeline" element={<TimelineView />} />
          <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary fallbackMessage="The application shell failed to load.">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
