import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router';

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
