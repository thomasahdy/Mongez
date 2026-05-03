import { useEffect, useState } from 'react'
import './App.css'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

const pageMap = {
  '#landing': <LandingPage />,
  '#onboarding': <OnboardingPage />,
  '#reset-password': <ResetPasswordPage />,
  '#verify-email': <VerifyEmailPage />,
}

function App() {
  const [hash, setHash] = useState(window.location.hash || '#landing')

  useEffect(() => {
    const syncHash = () => {
      setHash(window.location.hash || '#landing')
    }

    window.addEventListener('hashchange', syncHash)
    syncHash()

    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  return pageMap[hash] ?? <LandingPage />
}

export default App
