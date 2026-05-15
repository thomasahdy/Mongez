import AuthErrorMessage from "./AuthErrorMessage";

const AuthInput = ({
  label,
  icon: Icon,
  error,
  success = false,
  className = "",
  inputClassName = "",
  ...props
}) => {
  const inputClasses = [
    "w-full pr-3.5 py-[11px] text-[13px] border-[1.5px] rounded bg-white focus:outline-none transition-all",
    Icon ? "pl-[38px]" : "pl-3.5",
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
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm" />
        )}
        <input className={inputClasses} {...props} />
      </div>

      <AuthErrorMessage compact className="mt-1.5">
        {error}
      </AuthErrorMessage>
    </div>
  );
};

export default AuthInput;
