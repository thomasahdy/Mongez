const variantClasses = {
  primary:
    "bg-primary hover:bg-primary-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,168,232,0.3)] text-white border-transparent disabled:hover:bg-primary disabled:hover:translate-y-0 disabled:hover:shadow-none",
  outline:
    "bg-transparent hover:bg-[#fafbfc] text-text-secondary border-border hover:border-text-tertiary",
  ghost:
    "bg-transparent text-text-tertiary border-transparent hover:text-text-secondary",
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
    "w-full flex items-center justify-center gap-2 p-3 border-[1.5px] rounded text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed",
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} disabled={disabled || loading} className={classes} {...props}>
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default AuthButton;
