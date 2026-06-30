import { useCallback, useState } from "react";
import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const ProtectedLayout = ({ setLanguage, language }) => {
  const { isRTL, dir } = useLocaleDirection();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((currentValue) => !currentValue);
  }, []);
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans animate-fadeIn dark:bg-slate-900" dir={dir}>
      {sidebarOpen ? (
        <div className="hidden shrink-0 lg:block">
          <Sidebar setLanguage={setLanguage} language={language} />
        </div>
      ) : null}

      {sidebarOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 animate-fadeIn lg:hidden" onClick={closeSidebar} />
          <div className={`fixed inset-y-0 z-40 w-[260px] lg:hidden ${isRTL ? "right-0 animate-slideLeft" : "left-0 animate-slideRight"}`}>
            <Sidebar onCloseMobile={closeSidebar} setLanguage={setLanguage} language={language} />
          </div>
        </>
      ) : null}

      <Outlet context={{ isSidebarOpen: sidebarOpen, onToggleSidebar: toggleSidebar }} />
    </div>
  );
};

export default ProtectedLayout;
