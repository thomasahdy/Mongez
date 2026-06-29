import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import mongezMark from "../../assets/MongezMLogo.svg";
import {
  useSendVerificationEmailMutation,
  useVerificationStatusQuery,
  useVerifyEmailTokenQuery,
} from "../../hooks/useAuthQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

function TokenPreview({ token, fallback }) {
  const preview = token ? `${token.slice(0, 3)} ${token.slice(3, 6)} ${token.slice(6, 9)}`.trim() : fallback;

  return (
    <div className="flex justify-center gap-2">
      {preview.split(" ").map((chunk, index) => (
        <div
          key={`${chunk}-${index}`}
          className="min-w-[74px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-[18px] font-black tracking-[0.25em] text-slate-800"
        >
          {chunk || "..."}
        </div>
      ))}
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendButtonRef = useRef(null);
  const verificationTokenQuery = useVerifyEmailTokenQuery(token);
  const verificationStatusQuery = useVerificationStatusQuery(!token);
  const sendVerificationMutation = useSendVerificationEmailMutation();
  const loading = token ? verificationTokenQuery.isLoading : verificationStatusQuery.isLoading;
  const data = token ? verificationTokenQuery.data : verificationStatusQuery.data;
  const verified = Boolean(data?.verified);
  const isOAuthUser = Boolean(data?.isOAuthUser);
  const isAuthenticated = Boolean(data?.isAuthenticated);
  const sending = sendVerificationMutation.isPending;
  const showResend = !loading && !verified && !token && !isOAuthUser && isAuthenticated;

  // Auto-focus resend button when shown and cooldown expires
  useEffect(() => {
    if (showResend && resendCooldown === 0 && resendButtonRef.current) {
      resendButtonRef.current.focus();
    }
  }, [showResend, resendCooldown]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!verified) {
      return undefined;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate(isAuthenticated ? "/dashboard" : "/login", { replace: true });
    }, 1800);

    return () => window.clearTimeout(redirectTimer);
  }, [isAuthenticated, navigate, verified]);

  const handleResend = async () => {
    setError("");
    setMessage("");

    try {
      const result = await sendVerificationMutation.mutateAsync();
      setMessage(result.message || t("verifyEmail.success.resendSent"));
      setResendCooldown(45);
    } catch (sendError) {
      setError(sendError.message || t("verifyEmail.errors.resendFailed"));
    }
  };

  const displayError = error || (token && verificationTokenQuery.isError
    ? verificationTokenQuery.error?.message || t("verifyEmail.errors.verifyFailed")
    : "");
  const displayMessage = message || (!token && verificationStatusQuery.isError
    ? t("verifyEmail.errors.resendSignin")
    : data?.message || "");

  return (
    <div className="auth-page" dir={isRTL ? "rtl" : "ltr"}>
      <header className="auth-brand-row">
        <NavLink to="/" className="auth-brand" aria-label={t("verifyEmail.homeAria")}>
          <img src={mongezMark} alt="" className="auth-brand-mark" />
          <span className="auth-brand-text">Mongez</span>
        </NavLink>
      </header>

      <main className="auth-main">
        <section className="auth-card verify-card">
          <div className="auth-copy verify-copy">
            <div className="mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[26px] bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.12))] text-sky-500">
              <i className={`fa-solid ${verified ? "fa-circle-check" : "fa-envelope-open-text"} text-[28px]`} />
            </div>
            <h1>{verified ? t("verifyEmail.titleDone") : t("verifyEmail.titlePending")}</h1>
            <p>
              {loading
                ? t("verifyEmail.checking")
                : verified
                  ? isAuthenticated
                    ? t("verifyEmail.verifiedDashboard")
                    : t("verifyEmail.verifiedLogin")
                  : t("verifyEmail.pendingDescription")}
            </p>
          </div>

          {!verified ? <TokenPreview token={token} fallback={t("verifyEmail.tokenPreviewFallback")} /> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { ...t("verifyEmail.steps.0", { returnObjects: true }), active: !verified },
              { ...t("verifyEmail.steps.1", { returnObjects: true }), active: Boolean(token) || !verified },
              { ...t("verifyEmail.steps.2", { returnObjects: true }), active: verified },
            ].map((step, index) => (
              <div
                key={step.label}
                className={`rounded-2xl border px-3 py-3 ${
                  step.active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">{t("resetPassword.stepLabel", { step: index + 1 })}</div>
                <div className="mt-1 text-sm font-semibold">{step.label}</div>
                <div className="mt-1 text-xs">{step.detail}</div>
              </div>
            ))}
          </div>

          {displayMessage && <p className="text-sm text-emerald-600">{displayMessage}</p>}
          {displayError && <p className="text-sm text-rose-600">{displayError}</p>}

          {showResend ? (
            <div className="grid gap-2">
              <button
                ref={resendButtonRef}
                type="button"
                className="auth-primary-button verify-button"
                onClick={handleResend}
                disabled={sending || resendCooldown > 0}
              >
                {sending ? t("verifyEmail.sending") : resendCooldown > 0 ? t("verifyEmail.resendCountdown", { seconds: resendCooldown }) : t("verifyEmail.sendVerification")}
              </button>
              <p className="text-xs text-slate-500">
                {t("verifyEmail.resendHint")}
              </p>
            </div>
          ) : null}

          {!token && !loading && !verified && !isAuthenticated ? (
            <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
              {t("verifyEmail.signInFirst")}
            </div>
          ) : null}

          <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-500 ${isRTL ? "text-right" : "text-left"}`}>
            <strong className="block text-slate-700">{t("verifyEmail.needHelp")}</strong>
            {t("verifyEmail.helpDescription")}
          </div>

          <div className="verify-links">
            <p>
              <NavLink to={verified ? (isAuthenticated ? "/dashboard" : "/login") : "/login"}>
                {verified ? (isAuthenticated ? t("verifyEmail.continueDashboard") : t("verifyEmail.continueLogin")) : t("verifyEmail.backToLogin")}
              </NavLink>
            </p>
            <p>
              <NavLink to="/register">{t("verifyEmail.differentAccount")}</NavLink>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
