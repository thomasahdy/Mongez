import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router';
import Sidebar from './components/Sidebar';
import Home from './pages/home/Home'
import SpacesPagee from './pages/spaces/SpacesPage';
import KanbanBoard from './pages/kanbanboard/KanbanBoard';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [path, setPath] = useState([]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
    <BrowserRouter>
    {isLoggedIn && <div className="hidden lg:block shrink-0"><Sidebar /></div>}
    <Routes>
      <Route path='/' element={<Home path={path}/>}>
        <Route path='board' element={<KanbanBoard setPath={setPath}/>}/>
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
    </BrowserRouter>
    </div>
  )
}

export default App
        