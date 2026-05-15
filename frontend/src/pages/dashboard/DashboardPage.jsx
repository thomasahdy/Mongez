import { useState, useCallback } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AISidebar from "../../components/ai/AISidebar";
import AINudge from "../../components/ai/AINudge";
import FAB from "../../components/ui/FAB";


const DashboardLayout = ({ children, path }) => {
  const [aiOpen, setAiOpen] = useState(false);
  const toggleAI = useCallback(() => setAiOpen((v) => !v), []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Navbar onToggleAI={toggleAI} path={path} />
        {children}
      </main>

      {/* Portals / overlays */}
      <FAB />
      <AINudge onYes={toggleAI} />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
};

export default DashboardLayout;