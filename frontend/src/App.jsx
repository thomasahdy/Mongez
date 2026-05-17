import { useState } from 'react';
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
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [path, setPath] = useState([]);

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
        