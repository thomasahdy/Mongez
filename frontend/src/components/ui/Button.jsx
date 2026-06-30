
const Button = ({ children, variant = "outline", size = "md", onClick, className = "", ...rest }) => {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all duration-200 cursor-pointer border hover:-translate-y-[1px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2";
  const variants = {
    primary: "bg-sky-500 border-sky-500 text-white hover:bg-sky-600",
    outline: "border-slate-200 dark:border-slate-600 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200",
    ghost:   "border-transparent bg-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
  };
  const sizes = {
    sm:  "text-[11px] px-2 py-1",
    md:  "text-[12px] px-3 py-1.5",
    lg:  "text-[13px] px-4 py-2",
  };
  return (
    <button
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button
