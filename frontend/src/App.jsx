import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router';
import Sidebar from './components/Sidebar';
import Home from './pages/home/Home'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
    <BrowserRouter>
    {isLoggedIn && <div className="hidden lg:block shrink-0"><Sidebar /></div>}
    <Routes>
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
        