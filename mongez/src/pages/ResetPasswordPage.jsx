import mongezMark from '../assets/MongezMLogo.svg'

function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <header className="auth-brand-row">
        <a href="#landing" className="auth-brand" aria-label="Mongez home">
          <img src={mongezMark} alt="" className="auth-brand-mark" />
          <span className="auth-brand-text">Mongez</span>
        </a>
      </header>

      <main className="auth-main">
        <section className="auth-card reset-card">
          <div className="auth-icon-shell" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="auth-icon" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 11a5 5 0 1 1 9.9 1H19v4h-3v-2h-2v2h-2v2H9v-4.1A5 5 0 0 1 7 11Z" />
              <circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </div>

          <div className="auth-copy">
            <h1>Reset your password</h1>
            <p>Choose how you&apos;d like to receive your password reset link.</p>
          </div>

          <div className="auth-methods" role="tablist" aria-label="Reset methods">
            <button type="button" className="auth-method auth-method-active" role="tab" aria-selected="true">
              <svg viewBox="0 0 24 24" className="auth-method-icon" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <span>Email</span>
            </button>

            <button type="button" className="auth-method" role="tab" aria-selected="false">
              <svg viewBox="0 0 24 24" className="auth-method-icon" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16.6 13.4c-.3-.2-1.8-.9-2-.9s-.5-.1-.8.2-.9 1.1-1.1 1.3-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5A9.1 9.1 0 0 1 8 10.4c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.8-1.9-1-2.5c-.2-.5-.5-.5-.7-.5H6a1.4 1.4 0 0 0-1 .5A4.2 4.2 0 0 0 3.7 8c0 1.4 1 2.7 1.1 2.9a11.9 11.9 0 0 0 4.6 4.1c3 .9 3 .6 3.6.6s1.8-.7 2-1.4.3-1.3.2-1.4-.3-.2-.6-.4Z" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span>WhatsApp</span>
            </button>
          </div>

          <label className="auth-field">
            <span className="auth-label">Email address</span>
            <span className="auth-input-shell">
              <svg viewBox="0 0 24 24" className="auth-input-icon" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <input type="email" placeholder="you@organization.com" defaultValue="" />
            </span>
          </label>

          <button type="button" className="auth-primary-button">
            <svg viewBox="0 0 24 24" className="auth-button-icon" fill="currentColor">
              <path d="M21.8 3.6 3.9 10.8c-.8.3-.8 1.4 0 1.7l6 2.3 2.3 6c.3.8 1.4.8 1.7 0l7.2-17.9c.3-.8-.5-1.6-1.3-1.3Zm-8.4 15-1.6-4.2 6.3-6.3-8 5.1-4.1-1.6 13.3-5.3-5.9 12.3Z" />
            </svg>
            <span>Send Reset Link</span>
          </button>
        </section>

        <p className="auth-footer-note">
          Remember your password? <a href="#landing">Log in</a>
        </p>
      </main>
    </div>
  )
}

export default ResetPasswordPage
