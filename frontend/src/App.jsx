import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, useLocation, Navigate, Outlet } from 'react-router';
import ProtectedLayout from './components/layout/ProtectedLayout';
import Home from './pages/home/Home';
import { useTranslation } from "react-i18next";
import { useAuthSessionQuery } from "./hooks/useAuthQueries";

// Lazy-loaded pages
const KanbanBoard = lazy(() => import('./pages/kanbanboard/KanbanBoard'));
const SpacesPage = lazy(() => import('./pages/spaces/SpacesPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const WhiteBoardPage = lazy(() => import('./pages/whiteboard/WhiteBoardPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const MembersPage = lazy(() => import('./pages/settings/MembersPage'));
const InboxPage = lazy(() => import('./pages/Inbox/InboxPage'));
const SearchPage = lazy(() => import('./pages/search/SearchPage'));
const MyWorkPage = lazy(() => import('./pages/mywork/MyWorkPage'));
const SecurityPage = lazy(() => import('./pages/security/SecurityPage'));
const AuditLogPage = lazy(() => import('./pages/audit-log/AuditLogPage'));

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-body">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-text-secondary text-sm">Loading workspace...</span>
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

function ProtectedShell({ isAuthenticated, authReady, allowBypass }) {
  const location = useLocation();

  if (!authReady) {
    return <FullScreenLoader />;
  }

  if (!allowBypass && !isAuthenticated) {
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
    i18n.changeLanguage(language);
  }, [language]);

  if (!authReady) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <LandingPage />
            </PublicOnlyRoute>
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
          path="/register"
          element={
            <PublicOnlyRoute authReady={authReady} isAuthenticated={isAuthenticated}>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />

        {/* Onboarding Guard */}
        <Route element={<ProtectedShell authReady={authReady} isAuthenticated={isAuthenticated} allowBypass={false} />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>

        {/* Protected Authenticated Routes */}
        <Route element={<ProtectedShell authReady={authReady} isAuthenticated={isAuthenticated} allowBypass={false} />}>
          <Route element={<ProtectedLayout setLanguage={setLanguage} language={language} />}>
            <Route path="/" element={<Home path={path} />}>
              <Route index element={<Navigate to="/spaces" replace />} />
              <Route path="boards/:boardId" element={<KanbanBoard setPath={setPath} />} />
              <Route path="spaces" element={<SpacesPage setPath={setPath} />} />
              <Route path="whiteboard" element={<WhiteBoardPage />} />
              <Route path="reports" element={<ReportsPage setPath={setPath} />} />
              <Route path="settings" element={<SettingsPage setPath={setPath} />} />
              <Route path="settings/members" element={<MembersPage setPath={setPath} />} />
              <Route path="inbox" element={<InboxPage setPath={setPath} />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="my-work" element={<MyWorkPage setPath={setPath} />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="settings/security" element={<SecurityPage setPath={setPath} />} />
              
              {/* Backward compatibility redirects */}
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="calendar" element={<Navigate to="/" replace />} />
              <Route path="timeline" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/spaces" : "/"} replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
