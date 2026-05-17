import { useState } from "react";
import { FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import AuthErrorMessage from "./AuthErrorMessage";

const PasswordInput = ({
  label = "Password",
  error,
  success = false,
  className = "",
  inputClassName = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputClasses = [
    "w-full pl-[38px] pr-10 py-[11px] text-[13px] border-[1.5px] rounded bg-white focus:outline-none transition-all",
    error
      ? "border-danger focus:ring-2 focus:ring-danger/10"
      : success
        ? "border-success focus:ring-2 focus:ring-success/10"
        : "border-border focus:border-primary focus:ring-2 focus:ring-primary/10",
    inputClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {label && (
        <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm" />
        <input type={showPassword ? "text" : "password"} className={inputClasses} {...props} />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary rounded p-1"
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>

      <AuthErrorMessage compact className="mt-1.5">
        {error}
      </AuthErrorMessage>
    </div>
  );
};

export default PasswordInput;
