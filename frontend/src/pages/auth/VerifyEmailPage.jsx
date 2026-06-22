import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import mongezMark from "../../assets/MongezMLogo.svg";
import {
  useSendVerificationEmailMutation,
  useVerificationStatusQuery,
  useVerifyEmailTokenQuery,
} from "../../hooks/useAuthQueries";

function TokenPreview({ token }) {
  const preview = token ? `${token.slice(0, 3)} ${token.slice(3, 6)} ${token.slice(6, 9)}`.trim() : "Inbox link";

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
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const verificationTokenQuery = useVerifyEmailTokenQuery(token);
  const verificationStatusQuery = useVerificationStatusQuery(!token);
  const sendVerificationMutation = useSendVerificationEmailMutation();
  const loading = token ? verificationTokenQuery.isLoading : verificationStatusQuery.isLoading;
  const data = token ? verificationTokenQuery.data : verificationStatusQuery.data;
  const verified = Boolean(data?.verified);
  const isOAuthUser = Boolean(data?.isOAuthUser);
  const isAuthenticated = Boolean(data?.isAuthenticated);
  const sending = sendVerificationMutation.isPending;

  useEffect(() => {
    if (token && verificationTokenQuery.isError) {
      setError(verificationTokenQuery.error?.message || "Unable to verify this email link.");
      return;
    }

    if (!token && verificationStatusQuery.isError) {
      setMessage("Sign in to resend a verification email, or open the verification link from your inbox.");
      return;
    }

    if (data?.message) {
      setMessage(data.message);
    }
  }, [
    data?.message,
    token,
    verificationStatusQuery.isError,
    verificationTokenQuery.error?.message,
    verificationTokenQuery.isError,
  ]);

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
      setMessage(result.message || "Verification email sent.");
    } catch (sendError) {
      setError(sendError.message || "Unable to send a new verification email.");
    }
  };

  const showResend = !loading && !verified && !token && !isOAuthUser && isAuthenticated;

  return (
    <div className="auth-page">
      <header className="auth-brand-row">
        <NavLink to="/" className="auth-brand" aria-label="Mongez home">
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
            <h1>{verified ? "Email verified" : "Verify your email"}</h1>
            <p>
              {loading
                ? "Checking the live verification state..."
                : verified
                  ? `Your account is ready. Redirecting to ${isAuthenticated ? "the dashboard" : "login"}...`
                  : "Use the secure verification link from your inbox. This screen mirrors an OTP-style check-in without faking a code flow the backend does not support."}
            </p>
          </div>

          {!verified ? <TokenPreview token={token} /> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Inbox", detail: "Receive email", active: !verified },
              { label: "Open link", detail: "Secure token", active: Boolean(token) || !verified },
              { label: "Verified", detail: "Continue", active: verified },
            ].map((step, index) => (
              <div
                key={step.label}
                className={`rounded-2xl border px-3 py-3 ${
                  step.active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.16em]">Step {index + 1}</div>
                <div className="mt-1 text-sm font-semibold">{step.label}</div>
                <div className="mt-1 text-xs">{step.detail}</div>
              </div>
            ))}
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}

          {showResend ? (
            <button
              type="button"
              className="auth-primary-button verify-button"
              onClick={handleResend}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send verification email"}
            </button>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[13px] leading-6 text-slate-500">
            <strong className="block text-slate-700">Need help?</strong>
            If you do not see the email, check spam, promotions, or any corporate filters before requesting another verification message.
          </div>

          <div className="verify-links">
            <p>
              <NavLink to={verified ? (isAuthenticated ? "/dashboard" : "/login") : "/login"}>
                {verified ? (isAuthenticated ? "Continue to dashboard" : "Continue to login") : "Back to login"}
              </NavLink>
            </p>
            <p>
              <NavLink to="/register">Need a different account?</NavLink>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
