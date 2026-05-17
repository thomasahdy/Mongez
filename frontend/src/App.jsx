import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import Sidebar from './components/layout/Sidebar';
import Home from './pages/home/Home';
import KanbanBoard from './pages/kanbanboard/KanbanBoard';
import SpacesPagee from './pages/spaces/SpacesPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import LandingPage from './pages/landing/LandingPage'
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
                element={<SpacesPagee setPath={setPath}/>}
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
            
          <Route path='login' element={<LoginPage />}/>
          <Route path='register' element={<RegisterPage />} />
        </Routes>
      </div>
    }
    
      
    </BrowserRouter>
    
  )
}

export default App
        