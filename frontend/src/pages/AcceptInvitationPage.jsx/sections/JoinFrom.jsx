import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";
import FormField from "../../../components/AcceptInvitation/FormField";
import PasswordField from "../../../components/AcceptInvitation/PasswordField";

export default function JoinForm({ onAccept, onDecline, loading }) {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("acceptInvitation.passwordShort"));
      return;
    }

    try {
      await onAccept({ firstName, lastName, password });
    } catch (err) {
      setError(err.message ?? t("acceptInvitation.submitFailed"));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={t("acceptInvitation.formAria")}>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <FormField
          id="firstName"
          label={t("acceptInvitation.firstName")}
          placeholder={t("acceptInvitation.firstNamePlaceholder")}
          value={firstName}
          onChange={setFirstName}
          required
          autoComplete="given-name"
        />
        <FormField
          id="lastName"
          label={t("acceptInvitation.lastName")}
          placeholder={t("acceptInvitation.lastNamePlaceholder")}
          value={lastName}
          onChange={setLastName}
          required
          autoComplete="family-name"
        />
      </div>

      <div className="mb-5">
        <PasswordField
          id="password"
          label={t("acceptInvitation.createPassword")}
          placeholder={t("acceptInvitation.passwordPlaceholder")}
          value={password}
          onChange={setPassword}
          required
        />
      </div>

      {error && (
        <div
          role="alert"
          className={`mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 ${
            isRTL ? "flex-row-reverse text-right" : ""
          }`}
        >
          <i className="fa-solid fa-circle-exclamation shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !firstName || !lastName || !password}
        className={`w-full rounded-lg bg-sky-500 px-4 py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          isRTL ? "flex flex-row-reverse items-center justify-center gap-2" : "flex items-center justify-center gap-2"
        }`}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-circle-notch animate-spin text-[13px]" aria-hidden="true" />
            {t("acceptInvitation.joining")}
          </>
        ) : (
          <>
            <i className="fa-solid fa-check text-[13px]" aria-hidden="true" />
            {t("acceptInvitation.acceptJoin")}
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onDecline}
        disabled={loading}
        className="mt-3 w-full rounded-lg py-2 text-[13px] text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-500 dark:hover:text-slate-300"
      >
        {t("acceptInvitation.decline")}
      </button>
    </form>
  );
}
