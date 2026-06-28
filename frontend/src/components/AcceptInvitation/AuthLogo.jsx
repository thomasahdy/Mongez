import React from "react";
import { useTranslation } from "react-i18next";

const AuthLogo = ({ href = "/" }) => {
  const { t } = useTranslation();

  return (
    <a
      href={href}
      className="mb-10 flex items-center justify-center gap-2.5 text-slate-900 no-underline dark:text-slate-100"
      aria-label={t("authUi.logoHome")}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#00a8e8" />
        <path
          d="M8 22V10l5 8 5-8v12"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="24" cy="10" r="2" fill="#6366f1" />
      </svg>
      <span className="text-[22px] font-extrabold tracking-tight">Mongez</span>
    </a>
  );
};

export default AuthLogo;
