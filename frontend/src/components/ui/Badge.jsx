
/** Pill badge with variants */
const Badge = ({ children, variant = "neutral", className = "" }) => {
    const variants = {
    neutral: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
    primary: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    accent:  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
    success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    danger:  "bg-red-500 text-white",
    "danger-soft": "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
    gold:    "bg-gradient-to-r from-amber-400 to-amber-600 text-white",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${variants[variant] ?? variants.neutral} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
