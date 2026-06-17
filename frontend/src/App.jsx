import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import Sidebar from './components/layout/Sidebar';
import Home from './pages/home/Home';
import KanbanBoard from './pages/kanbanboard/KanbanBoard';
import SpacesPage from './pages/spaces/SpacesPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import LandingPage from './pages/landing/LandingPage'
import OnboardingPage from './pages/onboarding/OnboardingPage';
import WhiteBoardPage from './pages/whiteboard/WhiteBoardPage';
import ReportsPage from './pages/reports/ReportsPage';
import { useTranslation } from "react-i18next";
import SettingsPage from './pages/settings/settingsPage';
import InboxPage from './pages/Inbox/InboxPage';
function App() {
  
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [path, setPath] = useState([]);
  const [language, setLanguage] = useState("en");

const { i18n } = useTranslation();

  useEffect(() => {
  document.documentElement.dir =
    language === "ar" ? "rtl" : "ltr";
    i18n.changeLanguage(language);
}, [language]);

  return (
    
    
    <BrowserRouter>
    {
      isLoggedIn
      &&
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
        {isLoggedIn && <div className="hidden lg:block shrink-0"><Sidebar /></div>}
        <Routes>
          <Route path='/' element={<Home path={path}/>}>
            <Route path='/' element={<KanbanBoard setPath={setPath}/>}/>
            <Route
                path='/spaces'
                element={<SpacesPage setPath={setPath}/>}
            />
            <Route
                path='/whiteboard'
                element={<WhiteBoardPage/>}
            />
            <Route
                path='/reports'
                element={<ReportsPage setPath={setPath}/>}
            />
            <Route
                path='/settings'
                element={<SettingsPage setPath={setPath}/>}
            />
            <Route
                path='/inbox'
                element={<InboxPage setPath={setPath}/>}
            />
          </Route>
            <Route
                path='/'
                element={<Home />}
            />

            
        </Routes>
      </div>
    }
    {
      !isLoggedIn && 
      <div>
        <Routes>
          <Route path='/' element={<LandingPage />}/>
          <Route path='/onboarding' element={<OnboardingPage />}/>
          <Route path='login' element={<LoginPage />}/>
          <Route path='register' element={<RegisterPage />} />
        </Routes>
      </div>
    }
    
      
    </BrowserRouter>
    
  )
}

export default App
        