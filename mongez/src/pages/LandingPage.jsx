import AiAssistantSection from './landing/AiAssistantSection'
import FeaturesSection from './landing/FeaturesSection'
import FinalCtaSection from './landing/FinalCtaSection'
import HeroSection from './landing/HeroSection'
import ProblemSection from './landing/ProblemSection'
import ResultsSection from './landing/ResultsSection'
import TestimonialsSection from './landing/TestimonialsSection'
import FooterSection from '../components/FooterSection'
import OuterNavbar from '../components/OuterNavbar'

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
