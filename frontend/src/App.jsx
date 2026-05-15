import { useEffect, useState, useCallback } from "react";
import "./App.css";
import LandingPage from "./pages/landing/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import DashboardLayout from "./pages/dashboard/DashboardPage";
import SpacesPage from "./pages/spaces/SpacesPage";
import WhiteBoardPage from "./pages/whiteboard/WhiteBoardPage";
import KanbanBoard from "./pages/kanban/KanbanBoard";

// ─── Pages that sit INSIDE the dashboard shell (sidebar + navbar) ───
const IN_DASHBOARD = {
  "#dashboard": KanbanBoard, // default dashboard view is kanban
  "#kanban": KanbanBoard,
  "#spaces": SpacesPage,
  "#whiteboard": WhiteBoardPage,
};

// ─── Standalone pages (full-screen, no sidebar) ───
const STANDALONE = {
  "#landing": LandingPage,
  "#login": LoginPage,
  "#register": RegisterPage,
  "#onboarding": OnboardingPage,
  "#reset-password": ResetPasswordPage,
  "#verify-email": VerifyEmailPage,
};

function App() {
  const [hash, setHash] = useState(window.location.hash || "#landing");
  const [breadcrumbPath, setBreadcrumbPath] = useState([
    { name: "Al-Noor Foundation", color: "text-slate-400", ref: "" },
    { name: "Dashboard", color: "text-slate-800", ref: "" },
  ]);

  useEffect(() => {
    const syncHash = () => {
      setHash(window.location.hash || "#landing");
    };
    window.addEventListener("hashchange", syncHash);
    syncHash();
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const onSetPath = useCallback((p) => setBreadcrumbPath(p), []);

  // ── Standalone pages ──
  const StandaloneComponent = STANDALONE[hash];
  if (StandaloneComponent) return <StandaloneComponent />;

  // ── Dashboard pages (wrapped in layout) ──
  const DashboardComponent = IN_DASHBOARD[hash];
  if (DashboardComponent) {
    return (
      <DashboardLayout path={breadcrumbPath}>
        <DashboardComponent setPath={onSetPath} />
      </DashboardLayout>
    );
  }

  // ── 404 – unknown hash ──
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-600">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
        <p className="text-lg mb-6">Page not found</p>
        <a
          href="#landing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition-colors"
        >
          ← Go Home
        </a>
      </div>
    </div>
  );
}

export default App;