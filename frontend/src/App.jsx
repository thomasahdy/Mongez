import { useState, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from 'react-router';
import Sidebar from './components/layout/Sidebar';
import Home from './pages/home/Home';
import KanbanBoard from './pages/kanbanboard/KanbanBoard';
import SpacesPage from './pages/spaces/SpacesPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import LandingPage from './pages/landing/LandingPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import WhiteBoardPage from './pages/whiteboard/WhiteBoardPage';

function AuthenticatedApp({ path, setPath }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans animate-fadeIn">
      <div className="hidden lg:block shrink-0"><Sidebar /></div>
      <Routes>
        <Route path='/' element={<Home path={path}/>}>
          <Route index element={<KanbanBoard setPath={setPath}/>}/>
          <Route path='spaces' element={<SpacesPage setPath={setPath}/>}/>
          <Route path='whiteboard' element={<WhiteBoardPage/>}/>
        </Route>
      </Routes>
    </div>
  );
}

function PublicApp() {
  return (
    <Routes>
      <Route path='/' element={<LandingPage />}/>
      <Route path='/onboarding' element={<OnboardingPage />}/>
      <Route path='/login' element={<LoginPage />}/>
      <Route path='/register' element={<RegisterPage />} />
    </Routes>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [path, setPath] = useState([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/v1/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          setIsLoggedIn(true);
          // If user is on login/register page after OAuth callback, redirect to dashboard
          if (location.pathname === '/login' || location.pathname === '/register') {
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-body">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-text-secondary text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return isLoggedIn ? (
    <AuthenticatedApp path={path} setPath={setPath} />
  ) : (
    <PublicApp />
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