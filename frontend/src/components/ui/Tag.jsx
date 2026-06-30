
const Tag = ({ children, variant = "int" }) => {
  const variants = {
    risk: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
    ext:  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    int:  "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
    review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    legal: "bg-slate-100 text-slate-500",
    hr:   "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${variants[variant] ?? variants.int}`}>
      {children}
    </span>
  );
}

export default Tag
