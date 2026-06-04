import { useState } from "react";
import { FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import AuthErrorMessage from "./AuthErrorMessage";

const PasswordInput = ({
  label = "Password",
  error,
  success = false,
  className = "",
  inputClassName = "",
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputClasses = [
    "w-full pl-[38px] pr-10 py-[11px] text-sm border-[1.5px] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
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
      {label && (
        <label htmlFor={id} className="block text-[13px] font-semibold text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-[14px]" aria-hidden="true" />
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
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary rounded-lg p-1 transition-colors"
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