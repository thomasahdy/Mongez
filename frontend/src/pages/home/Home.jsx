import { useCallback, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import AISidebar from "../../components/ai/AISidebar";
import AINudge from "../../components/ai/AINudge";
import FAB from "../../components/ui/FAB";
import PostOnboardingWalkthrough from "../../components/onboarding/PostOnboardingWalkthrough";
import { Outlet, useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";
import { completePostOnboardingWalkthrough, shouldShowPostOnboardingWalkthrough } from "../../lib/onboardingStorage";
import { useEffect } from "react";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const Home = ({ path, setPath }) => {
  const { dir } = useLocaleDirection();
  const [aiOpen, setAiOpen] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const { activeBoard } = useAppContext();
  const layoutContext = useOutletContext() || {};
  const { onToggleSidebar, isSidebarOpen = true } = layoutContext;

  const toggleAI = useCallback(() => setAiOpen((v) => !v), []);
  const closeWalkthrough = useCallback(() => {
    completePostOnboardingWalkthrough();
    setWalkthroughOpen(false);
  }, []);

  useEffect(() => {
    if (shouldShowPostOnboardingWalkthrough()) {
      setWalkthroughOpen(true);
    }
  }, []);

  return (
    <>
        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden" dir={dir}>
          <Navbar
            onToggleAI={toggleAI}
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            path={path}
          />
          <Outlet context={{ setPath, activeBoard }} />
        </main>

      {/* Portals / overlays */}
      <FAB />
      <AINudge />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} />
      <PostOnboardingWalkthrough open={walkthroughOpen} onClose={closeWalkthrough} />
    </>
  );
}

export default Home;
