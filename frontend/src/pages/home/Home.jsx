import { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import Avatar from "../../components/Avatar";
import AISidebar from "../../components/AISidebar";
import AINudge from "../../components/AINudge";
import FAB from "../../components/FAB";
import KanbanBoard from "../kanbanboard/KanbanBoard";
import Toolbar from "./toolbar/Toolbar";
import ViewTabs from "./viewtabs/ViewTabs";
import { Outlet } from "react-router";


// ─────────────────────────────────────────────
// DESIGN TOKENS (mirrors CSS custom-props)
// ─────────────────────────────────────────────
const STATUS_COLORS = {
  todo:     { dot: "#94a3b8", bg: "#f1f5f9", text: "#475569", label: "To Do" },
  waiting:  { dot: "#ea580c", bg: "#fff7ed", text: "#ea580c", label: "Waiting" },
  progress: { dot: "#00a8e8", bg: "#e8f7fd", text: "#0077b6", label: "In Progress" },
  review:   { dot: "#6366f1", bg: "#eef0ff", text: "#6366f1", label: "In Review" },
  done:     { dot: "#10b981", bg: "#ecfdf5", text: "#10b981", label: "Done & Signed" },
};


const Home = ({path}) => {
  
  const [aiOpen, setAiOpen] = useState(false);

  const toggleAI = useCallback(() => setAiOpen((v) => !v), []);

  return (
    <>
      {/* Font Awesome CDN — injected via link tag in index.html normally */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Navbar onToggleAI={toggleAI} path={path}/>
          <Outlet />
          {/* <KanbanBoard columns={BOARD_COLUMNS} /> */}
        </main>

      {/* Portals / overlays */}
      <FAB />
      <AINudge onYes={toggleAI} />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}

export default Home
