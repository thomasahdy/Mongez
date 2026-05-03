import mongezMark from '../assets/MongezMLogo.svg'

const onboardingSteps = [
  {
    title: 'Create your first project',
    description: 'Set up a board to organize your tasks',
  },
  {
    title: 'Invite team members',
    description: 'Bring your colleagues on board',
  },
  {
    title: 'Try AI assistant',
    description: 'Ask anything about your workspace',
  },
  {
    title: 'Set up your profile',
    description: 'Add photo, title, and preferences',
  },
]

function OnboardingPage() {
  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <a href="/" className="onboarding-brand" aria-label="Mongez home">
          <img src={mongezMark} alt="" className="onboarding-brand-mark" />
          <span className="onboarding-brand-text">Mongez</span>
        </a>

        <button type="button" className="onboarding-skip">
          Skip setup
          <span aria-hidden="true" className="onboarding-arrow">-&gt;</span>
        </button>
      </header>

      <main className="onboarding-main">
        <section className="onboarding-progress" aria-label="Setup progress">
          <div className="onboarding-progress-track">
            <div className="onboarding-progress-value" />
          </div>
          <p className="onboarding-progress-label">Step 1 of 4</p>
        </section>

        <section className="onboarding-card">
          <div className="onboarding-orb" aria-hidden="true" />

          <div className="onboarding-copy">
            <h1>Welcome to Mongez, Thomas!</h1>
            <p>Let&apos;s set up your workspace in just a few steps. This will take about 2 minutes.</p>
          </div>

          <div className="onboarding-steps" role="list" aria-label="Onboarding checklist">
            {onboardingSteps.map((step) => (
              <button key={step.title} type="button" className="onboarding-step" role="listitem">
                <span className="onboarding-step-radio" aria-hidden="true" />
                <span className="onboarding-step-copy">
                  <span className="onboarding-step-title">{step.title}</span>
                  <span className="onboarding-step-description">{step.description}</span>
                </span>
                <span className="onboarding-step-arrow" aria-hidden="true">&gt;</span>
              </button>
            ))}
          </div>

          <button type="button" className="onboarding-cta">
            Let&apos;s get started
            <span aria-hidden="true" className="onboarding-arrow">-&gt;</span>
          </button>
        </section>
      </main>
    </div>
  )
}

export default OnboardingPage
