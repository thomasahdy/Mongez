import AiAssistantSection from './sections/AiAssistantSection'
import FeaturesSection from './sections/FeaturesSection'
import FinalCtaSection from './sections/FinalCtaSection'
import HeroSection from './sections/HeroSection'
import ProblemSection from './sections/ProblemSection'
import ResultsSection from './sections/ResultsSection'
import TestimonialsSection from './sections/TestimonialsSection'
import FooterSection from '../../components/landing/FooterSection'
import OuterNavbar from '../../components/landing/OuterNavbar'

function LandingPage() {
  return (
    <div className="bg-[#f8f6f2] text-slate-900">
      <OuterNavbar/>
      <main>
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
