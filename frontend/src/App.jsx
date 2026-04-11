import { useState } from 'react'

import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import Home from './pages/Home'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'

function App() {
  const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
    <Sidebar />
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
