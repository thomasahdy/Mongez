import AuthErrorMessage from "./AuthErrorMessage";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

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
  const { isRTL } = useLocaleDirection();

  const inputClasses = [
    "w-full py-[11px] text-sm border-[1.5px] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
    Icon
      ? isRTL
        ? "pr-[38px] pl-3.5"
        : "pl-[38px] pr-3.5"
      : "px-3.5",
    props.type === "email" ? "text-left" : "text-start",
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
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text-primary text-start">
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className={`absolute top-1/2 -translate-y-1/2 text-[14px] text-text-tertiary ${
              isRTL ? "right-3" : "left-3"
            }`}
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          className={inputClasses}
          dir={props.dir ?? (props.type === "email" ? "ltr" : undefined)}
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
