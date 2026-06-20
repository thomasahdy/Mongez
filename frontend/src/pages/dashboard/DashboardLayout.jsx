import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import AISidebar from '../../components/ai/AISidebar';
import AINudge from '../../components/ai/AINudge';
import FAB from '../../components/ui/FAB';
import { useAppContext } from '../AppContext';

const DEFAULT_BREADCRUMB_PATH = [
  { name: 'Workspace', color: 'text-slate-400', ref: '/spaces' },
  { name: 'Dashboard', color: 'text-slate-800', ref: '' },
];

const DashboardLayout = () => {
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [breadcrumbPath, setBreadcrumbPath] = useState(DEFAULT_BREADCRUMB_PATH);
  const { user, activeBoard, fetchSpaces } = useAppContext();

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const toggleAI = useCallback(() => setAiOpen((value) => !value), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((value) => !value), []);
  const onSetPath = useCallback((nextPath) => {
    setBreadcrumbPath(nextPath?.length ? nextPath : DEFAULT_BREADCRUMB_PATH);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-[260px] shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40 w-[260px] lg:hidden">
            <Sidebar onCloseMobile={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <Navbar onToggleAI={toggleAI} onToggleSidebar={toggleSidebar} path={breadcrumbPath} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet context={{ setPath: onSetPath, user, activeBoard }} />
        </div>
      </main>

      <FAB />
      <AINudge onYes={toggleAI} />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} boardId={activeBoard?.id} />
    </div>
  );
};

export default DashboardLayout;