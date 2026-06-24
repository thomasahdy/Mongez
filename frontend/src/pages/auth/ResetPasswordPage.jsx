import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import mongezMark from "../../assets/MongezMLogo.svg";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResetTokenVerificationQuery,
} from "../../hooks/useAuthQueries";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function getPasswordIssues(password, confirmPassword) {
  const issues = [];

  if (password.length < 8) {
    issues.push("Use at least 8 characters.");
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    issues.push("Use both uppercase and lowercase letters.");
  }

  if (!/\d/.test(password)) {
    issues.push("Include at least one number.");
  }

  if (confirmPassword && password !== confirmPassword) {
    issues.push("Passwords do not match.");
  }

  return issues;
}

function StrengthHint({ password }) {
  const checks = [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Upper and lower case", valid: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "Number", valid: /\d/.test(password) },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {checks.map((check) => (
        <div
          key={check.label}
          className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold ${
            check.valid
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {check.label}
        </div>
      ))}
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const mode = token ? "reset" : "request";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const forgotPasswordMutation = useForgotPasswordMutation();
  const resetPasswordMutation = useResetPasswordMutation();
  const tokenVerificationQuery = useResetTokenVerificationQuery(token);
  const submitting = forgotPasswordMutation.isPending || resetPasswordMutation.isPending;
  const tokenChecking = mode === "reset" ? tokenVerificationQuery.isLoading : false;
  const tokenValid = mode === "request" || tokenVerificationQuery.isSuccess;
  const passwordIssues = getPasswordIssues(password, confirmPassword);
  const trimmedEmail = email.trim();

  // Auto-focus email input when in request mode
  useEffect(() => {
    if (mode === "request" && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [mode]);

  // Auto-focus password input when token is verified
  useEffect(() => {
    if (mode === "reset" && tokenValid && !tokenChecking && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [mode, tokenValid, tokenChecking]);

  useEffect(() => {
    if (tokenVerificationQuery.isError) {
      setError(tokenVerificationQuery.error?.message || "This reset link is invalid or expired.");
    }
  }, [tokenVerificationQuery.error?.message, tokenVerificationQuery.isError]);

  useEffect(() => {
    if (!(mode === "reset" && success)) {
      return undefined;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1800);

    return () => window.clearTimeout(redirectTimer);
  }, [mode, navigate, success]);

  const handleRequestReset = async (event) => {
    event.preventDefault();

    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address to receive a reset link.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const result = await forgotPasswordMutation.mutateAsync(trimmedEmail);
      setSuccess(result.message || "If the account exists, a reset link has been sent.");
    } catch (requestError) {
      setError(requestError.message || "Unable to send the reset email.");
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (passwordIssues.length > 0) {
      setError(passwordIssues[0]);
      return;
    }

    setError("");
    setSuccess("");

    try {
      const result = await resetPasswordMutation.mutateAsync({
        token,
        password,
        confirmPassword,
      });
      setSuccess(result.message || "Password reset successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (resetError) {
      setError(resetError.message || "Unable to reset the password.");
    }
  };

  const canSubmitRequest = !submitting && isValidEmail(trimmedEmail);
  const canSubmitReset = tokenValid && !tokenChecking && password && confirmPassword && passwordIssues.length === 0;

  return (
    <div className="auth-page">
      <header className="auth-brand-row">
        <NavLink to="/" className="auth-brand" aria-label="Mongez home">
          <img src={mongezMark} alt="" className="auth-brand-mark" />
          <span className="auth-brand-text">Mongez</span>
        </NavLink>
      </header>

      <main className="auth-main">
        <section className="auth-card reset-card">
          <div className="auth-copy">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.12))] text-sky-500">
              <i className={`fa-solid ${mode === "reset" ? "fa-shield-heart" : "fa-envelope-open-text"} text-[24px]`} />
            </div>
            <h1>{mode === "reset" ? "Create a new password" : "Reset your password"}</h1>
            <p>
              {mode === "reset"
                ? "This secure link is connected to the live reset-password flow. Choose a new password to restore access."
                : "Enter the email for your account and we will send a secure reset link to your inbox."}
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Request", active: mode === "request" },
              { label: "Verify link", active: mode === "reset" || tokenChecking },
              { label: "Update password", active: mode === "reset" && tokenValid },
            ].map((step, index) => (
              <div
                key={step.label}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  step.active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">Step {index + 1}</div>
                <div className="mt-1 text-sm font-semibold">{step.label}</div>
              </div>
            ))}
          </div>

          {mode === "request" && (
            <form className="space-y-4" onSubmit={handleRequestReset}>
              <label className="auth-field">
                <span className="auth-label">Email address</span>
                <span className="auth-input-shell">
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <button type="submit" className="auth-primary-button" disabled={!canSubmitRequest}>
                <span>{submitting ? "Sending..." : "Send reset link"}</span>
              </button>
              {!trimmedEmail || canSubmitRequest ? null : (
                <p className="text-xs text-rose-600">Enter a valid work email before sending the reset link.</p>
              )}
            </form>
          )}

          {mode === "reset" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {tokenChecking
                  ? "Checking the reset link..."
                  : tokenValid
                    ? "Reset link verified. You can safely create a new password."
                    : "This link could not be verified. Request a new reset email to continue."}
              </div>

              {tokenValid && !tokenChecking ? (
                <form className="space-y-4" onSubmit={handleResetPassword}>
                  <label className="auth-field">
                    <span className="auth-label">New password</span>
                    <span className="auth-input-shell">
                      <input
                        ref={passwordInputRef}
                        type="password"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="auth-field">
                    <span className="auth-label">Confirm password</span>
                    <span className="auth-input-shell">
                      <input
                        type="password"
                        placeholder="Repeat your new password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <StrengthHint password={password} />
                  {passwordIssues.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      {passwordIssues[0]}
                    </div>
                  ) : null}

                  <button type="submit" className="auth-primary-button" disabled={submitting || !canSubmitReset}>
                    <span>{submitting ? "Updating..." : "Update password"}</span>
                  </button>
                </form>
              ) : (
                <div className="grid gap-3">
                  <NavLink
                    to="/reset-password"
                    className="auth-primary-button text-center"
                  >
                    Request a new reset link
                  </NavLink>
                  <p className="text-xs text-slate-500">
                    Reset links can expire or become invalid after use. Requesting a fresh email is the safest recovery path.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-600">
              {success}
              {mode === "reset" ? " Redirecting to login..." : ""}
            </p>
          )}

          <div className="grid gap-2 pt-2 text-[13px] text-slate-500">
            <p>
              Remember your password? <NavLink to="/login">Log in</NavLink>
            </p>
            {mode === "reset" ? (
              <p>
                Need a fresh link? <NavLink to="/reset-password">Request another reset email</NavLink>
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
