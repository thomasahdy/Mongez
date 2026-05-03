import mongezMark from '../assets/MongezMLogo.svg'

const codeDigits = ['4', '7', '', '', '', '']

function VerifyEmailPage() {
  return (
    <div className="auth-page">
      <header className="auth-brand-row">
        <a href="#landing" className="auth-brand" aria-label="Mongez home">
          <img src={mongezMark} alt="" className="auth-brand-mark" />
          <span className="auth-brand-text">Mongez</span>
        </a>
      </header>

      <main className="auth-main">
        <section className="auth-card verify-card">
          <div className="verify-progress" aria-label="Verification progress">
            <span className="verify-progress-dot verify-progress-dot-done" />
            <span className="verify-progress-bar" />
            <span className="verify-progress-dot verify-progress-dot-current" />
            <span className="verify-progress-dot" />
            <span className="verify-progress-dot" />
          </div>

          <div className="verify-mail-badge" aria-hidden="true">
            <div className="verify-mail-badge-ring" />
            <svg viewBox="0 0 24 24" className="auth-icon" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </div>

          <div className="auth-copy verify-copy">
            <h1>Verify your email</h1>
            <p>
              We&apos;ve sent a 6-digit verification code to
              <strong> alsherif@gmail.com</strong>
            </p>
          </div>

          <div className="verify-code-grid" aria-label="Verification code">
            {codeDigits.map((digit, index) => {
              const className = ['verify-code-box']

              if (digit && index < 2) className.push('verify-code-box-filled')
              if (index === 2) className.push('verify-code-box-active')

              return (
                <input
                  key={`${index}-${digit || 'empty'}`}
                  className={className.join(' ')}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  readOnly
                  aria-label={`Verification code digit ${index + 1}`}
                />
              )
            })}
          </div>

          <button type="button" className="auth-primary-button verify-button">
            Verify &amp; Continue
          </button>

          <button type="button" className="auth-secondary-button">
            <svg viewBox="0 0 24 24" className="auth-method-icon whatsapp-icon" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16.6 13.4c-.3-.2-1.8-.9-2-.9s-.5-.1-.8.2-.9 1.1-1.1 1.3-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5A9.1 9.1 0 0 1 8 10.4c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.8-1.9-1-2.5c-.2-.5-.5-.5-.7-.5H6a1.4 1.4 0 0 0-1 .5A4.2 4.2 0 0 0 3.7 8c0 1.4 1 2.7 1.1 2.9a11.9 11.9 0 0 0 4.6 4.1c3 .9 3 .6 3.6.6s1.8-.7 2-1.4.3-1.3.2-1.4-.3-.2-.6-.4Z" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span>Verify via WhatsApp instead</span>
          </button>

          <p className="verify-resend">
            Didn&apos;t receive it? <a href="#verify-email">Resend in 0:42</a>
          </p>

          <div className="verify-divider" />

          <div className="verify-links">
            <p>
              Wrong email? <a href="#landing">Go back to registration</a>
            </p>
            <p>
              Need help? <a href="#landing">Contact Support</a>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default VerifyEmailPage
