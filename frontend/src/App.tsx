import { useState } from 'react'
import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import Home from './pages/Home'
import Sidebar from './components/home/Sidebar'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <BrowserRouter>
    {isLoggedIn && <Sidebar />}
    <Routes>
        <Route
            path='/'
            element={<Home />}
        />
    </Routes>
    </BrowserRouter>
  )
}

export default App
