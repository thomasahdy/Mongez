import AuthErrorMessage from "./AuthErrorMessage";

const AuthInput = ({
  label,
  icon: Icon,
  error,
  success = false,
  className = "",
  inputClassName = "",
  id,
  ...props
}) => {
  const inputClasses = [
    "w-full pr-3.5 py-[11px] text-sm border-[1.5px] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
    Icon ? "pl-[38px]" : "pl-3.5",
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
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-[14px]" aria-hidden="true" />
        )}
        <input
          id={id}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      </div>

      <AuthErrorMessage compact className="mt-1.5" id={error ? `${id}-error` : undefined} role="alert">
        {error}
      </AuthErrorMessage>
    </div>
  );
};

export default AuthInput;
