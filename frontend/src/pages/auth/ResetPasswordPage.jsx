import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import BrandLogo from "../../components/branding/BrandLogo";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResetTokenVerificationQuery,
} from "../../hooks/useAuthQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function getPasswordIssues(password, confirmPassword, t) {
  const issues = [];

  if (password.length < 8) {
    issues.push(t("resetPassword.errors.tooShort"));
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    issues.push(t("resetPassword.errors.letterCase"));
  }

  if (!/\d/.test(password)) {
    issues.push(t("resetPassword.errors.number"));
  }

  if (confirmPassword && password !== confirmPassword) {
    issues.push(t("resetPassword.errors.mismatch"));
  }

  return issues;
}

function StrengthHint({ password, labels }) {
  const checks = [
    { label: labels[0], valid: password.length >= 8 },
    { label: labels[1], valid: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: labels[2], valid: /\d/.test(password) },
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
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
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
  const passwordIssues = getPasswordIssues(password, confirmPassword, t);
  const strengthChecks = t("resetPassword.strengthChecks", { returnObjects: true });
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
      setError(t("resetPassword.errors.invalidEmail"));
      return;
    }

    setError("");
    setSuccess("");

    try {
      const result = await forgotPasswordMutation.mutateAsync(trimmedEmail);
      setSuccess(result.message || t("resetPassword.success.requestSent"));
    } catch (requestError) {
      setError(requestError.message || t("resetPassword.errors.sendFailed"));
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
      setSuccess(result.message || t("resetPassword.success.resetDone"));
      setPassword("");
      setConfirmPassword("");
    } catch (resetError) {
      setError(resetError.message || t("resetPassword.errors.resetFailed"));
    }
  };

  const canSubmitRequest = !submitting && isValidEmail(trimmedEmail);
  const canSubmitReset = tokenValid && !tokenChecking && password && confirmPassword && passwordIssues.length === 0;
  const displayError = error || (tokenVerificationQuery.isError ? tokenVerificationQuery.error?.message || t("resetPassword.errors.invalidLink") : "");

  return (
    <div className="auth-page" dir={isRTL ? "rtl" : "ltr"}>
      <header className="auth-brand-row">
        <BrandLogo
          to="/"
          ariaLabelKey="resetPassword.homeAria"
          className="auth-brand"
          markWrapperClassName="flex h-10 w-10 items-center justify-center rounded-xl"
          markClassName="auth-brand-mark object-contain"
          wordmarkClassName="h-10 w-auto object-contain"
        />
      </header>

      <main className="auth-main">
        <section className="auth-card reset-card">
          <div className="auth-copy">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.12))] text-sky-500">
              <i className={`fa-solid ${mode === "reset" ? "fa-shield-heart" : "fa-envelope-open-text"} text-[24px]`} />
            </div>
            <h1>{mode === "reset" ? t("resetPassword.resetTitle") : t("resetPassword.requestTitle")}</h1>
            <p>
              {mode === "reset"
                ? t("resetPassword.resetDescription")
                : t("resetPassword.requestDescription")}
            </p>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: t("resetPassword.steps.0"), active: mode === "request" },
              { label: t("resetPassword.steps.1"), active: mode === "reset" || tokenChecking },
              { label: t("resetPassword.steps.2"), active: mode === "reset" && tokenValid },
            ].map((step, index) => (
              <div
                key={step.label}
                className={`rounded-2xl border px-3 py-3 ${isRTL ? "text-right" : "text-left"} ${
                  step.active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">{t("resetPassword.stepLabel", { step: index + 1 })}</div>
                <div className="mt-1 text-sm font-semibold">{step.label}</div>
              </div>
            ))}
          </div>

          {mode === "request" && (
            <form className="space-y-4" onSubmit={handleRequestReset}>
              <label className="auth-field">
                <span className="auth-label">{t("resetPassword.emailLabel")}</span>
                <span className="auth-input-shell">
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder={t("resetPassword.emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <button type="submit" className="auth-primary-button" disabled={!canSubmitRequest}>
                <span>{submitting ? t("resetPassword.sending") : t("resetPassword.sendLink")}</span>
              </button>
              {!trimmedEmail || canSubmitRequest ? null : (
                <p className="text-xs text-rose-600">{t("resetPassword.validEmailHint")}</p>
              )}
            </form>
          )}

          {mode === "reset" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {tokenChecking
                  ? t("resetPassword.checkingLink")
                  : tokenValid
                    ? t("resetPassword.linkVerified")
                    : t("resetPassword.linkInvalid")}
              </div>

              {tokenValid && !tokenChecking ? (
                <form className="space-y-4" onSubmit={handleResetPassword}>
                  <label className="auth-field">
                    <span className="auth-label">{t("resetPassword.newPassword")}</span>
                    <span className="auth-input-shell">
                      <input
                        ref={passwordInputRef}
                        type="password"
                        placeholder={t("resetPassword.newPasswordPlaceholder")}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <label className="auth-field">
                    <span className="auth-label">{t("resetPassword.confirmPassword")}</span>
                    <span className="auth-input-shell">
                      <input
                        type="password"
                        placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </span>
                  </label>

                  <StrengthHint password={password} labels={strengthChecks} />
                  {passwordIssues.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      {passwordIssues[0]}
                    </div>
                  ) : null}

                  <button type="submit" className="auth-primary-button" disabled={submitting || !canSubmitReset}>
                    <span>{submitting ? t("resetPassword.updating") : t("resetPassword.updatePassword")}</span>
                  </button>
                </form>
              ) : (
                <div className="grid gap-3">
                  <NavLink
                    to="/reset-password"
                    className="auth-primary-button text-center"
                  >
                    {t("resetPassword.requestNewLink")}
                  </NavLink>
                  <p className="text-xs text-slate-500">
                    {t("resetPassword.requestFreshHint")}
                  </p>
                </div>
              )}
            </div>
          )}

          {displayError && <p className="text-sm text-rose-600">{displayError}</p>}
          {success && (
            <p className="text-sm text-emerald-600">
              {success}
              {mode === "reset" ? ` ${t("resetPassword.redirectingToLogin")}` : ""}
            </p>
          )}

          <div className="grid gap-2 pt-2 text-[13px] text-slate-500">
            <p>
              {t("resetPassword.rememberPassword")} <NavLink to="/login">{t("resetPassword.logIn")}</NavLink>
            </p>
            {mode === "reset" ? (
              <p>
                {t("resetPassword.freshLinkQuestion")} <NavLink to="/reset-password">{t("resetPassword.requestAnotherEmail")}</NavLink>
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
