import { useEffect, useRef } from 'react'
import AiAssistantSection from './sections/AiAssistantSection'
import FeaturesSection from './sections/FeaturesSection'
import FinalCtaSection from './sections/FinalCtaSection'
import HeroSection from './sections/HeroSection'
import ProblemSection from './sections/ProblemSection'
import ResultsSection from './sections/ResultsSection'
import TestimonialsSection from './sections/TestimonialsSection'
import FooterSection from '../../components/landing/FooterSection'
import OuterNavbar from '../../components/landing/OuterNavbar'
import { useLocaleDirection } from '../../hooks/useLocaleDirection'

function LandingPage() {
  const { isRTL } = useLocaleDirection()
  const pageRef = useRef(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return undefined

    const sections = Array.from(page.querySelectorAll('.landing-section'))
    page.classList.add('landing-page-scroll-observed')

    const resetSections = () => {
      sections.forEach((section) => {
        section.classList.remove('landing-section-ready', 'landing-section-visible')
        section.style.removeProperty('--landing-scroll-index')
      })
      page.classList.remove('landing-page-scroll-observed')
    }

    sections.forEach((section, index) => {
      section.style.setProperty('--landing-scroll-index', index)
      section.classList.add('landing-section-ready')
    })

    const hero = page.querySelector('.landing-hero')
    hero?.classList.add('landing-section-visible')

    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('landing-section-visible'))
      return resetSections
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('landing-section-visible')
          observer.unobserve(entry.target)
        })
      },
      {
        rootMargin: '0px 0px -16% 0px',
        threshold: 0.18,
      },
    )

    sections
      .filter((section) => !section.classList.contains('landing-hero'))
      .forEach((section) => observer.observe(section))

    return () => {
      observer.disconnect()
      resetSections()
    }
  }, [])

  return (
    <div ref={pageRef} className="landing-page bg-white text-slate-900" dir={isRTL ? "rtl" : "ltr"}>
      <OuterNavbar/>
      <main className="landing-main">
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <ResultsSection />
        <AiAssistantSection />
        <TestimonialsSection />
        <FinalCtaSection />
        <FooterSection />
      </main>
    </div>
  )
}

export default LandingPage
