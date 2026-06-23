import { useCallback, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import AISidebar from "../../components/ai/AISidebar";
import AINudge from "../../components/ai/AINudge";
import FAB from "../../components/ui/FAB";
import { Outlet } from "react-router";
import { useAppContext } from "../AppContext";

const Home = ({ path, setPath }) => {
  const [aiOpen, setAiOpen] = useState(false);
  const { activeBoard } = useAppContext();

  const toggleAI = useCallback(() => setAiOpen((v) => !v), []);

  return (
    <>
        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Navbar onToggleAI={toggleAI} path={path} />
          <Outlet context={{ setPath, activeBoard }} />
        </main>

      {/* Portals / overlays */}
      <FAB />
      <AINudge onYes={toggleAI} />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}

export default Home;
