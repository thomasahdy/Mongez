import { useState } from "react";
import { FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import AuthErrorMessage from "./AuthErrorMessage";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

const PasswordInput = ({
  label,
  error,
  success = false,
  className = "",
  inputClassName = "",
  id,
  ...props
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [showPassword, setShowPassword] = useState(false);

  const inputClasses = [
    `w-full py-[11px] text-sm border-[1.5px] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
      isRTL ? "pr-[38px] pl-10 text-start" : "pl-[38px] pr-10 text-start"
    }`,
    error
      ? "border-danger focus:ring-danger/20"
      : success
        ? "border-success focus:ring-success/20"
        : "border-border focus:border-primary",
    inputClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {(label || t("authUi.password")) && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text-primary text-start">
          {label || t("authUi.password")}
        </label>
      )}

      <div className="relative">
        <FaLock
          className={`absolute top-1/2 -translate-y-1/2 text-[14px] text-text-tertiary ${
            isRTL ? "right-3" : "left-3"
          }`}
          aria-hidden="true"
        />
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? t("authUi.hidePassword") : t("authUi.showPassword")}
          className={`absolute top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-tertiary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
            isRTL ? "left-3" : "right-3"
          }`}
        >
          {showPassword ? <FaEyeSlash className="text-[14px]" /> : <FaEye className="text-[14px]" />}
        </button>
      </div>

      <AuthErrorMessage compact className="mt-1.5" id={error ? `${id}-error` : undefined} role="alert">
        {error}
      </AuthErrorMessage>
    </div>
  );
};

export default PasswordInput;
