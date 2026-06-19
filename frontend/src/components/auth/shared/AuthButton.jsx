const variantClasses = {
  primary:
    "bg-primary hover:bg-primary-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,168,232,0.3)] text-white border-transparent disabled:hover:bg-primary disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:opacity-60 disabled:opacity-60",
  outline:
    "bg-transparent hover:bg-[#fafbfc] text-text-secondary border-border hover:border-text-tertiary disabled:hover:bg-transparent disabled:hover:border-border disabled:opacity-60 disabled:opacity-60",
  ghost:
    "bg-transparent text-text-tertiary border-transparent hover:text-text-secondary disabled:hover:text-text-tertiary disabled:opacity-60 disabled:opacity-60",
};

const AuthButton = ({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  loadingLabel = "Loading...",
  className = "",
  disabled,
  ...props
}) => {
  const classes = [
    "w-full flex items-center justify-center gap-2 px-3 py-3 border-[1.5px] rounded-lg text-[14px] font-semibold transition-all duration-200 disabled:cursor-not-allowed",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} disabled={disabled || loading} className={classes} {...props}>
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default AuthButton;
