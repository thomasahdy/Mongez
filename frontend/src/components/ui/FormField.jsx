
const FormField = ({ label, id, as = "input", children, className = "", ...rest }) => {
  const shared =
    "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-[14px] text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 placeholder:text-slate-400 transition-all duration-150 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 focus:bg-white dark:focus:bg-slate-700";

  const field =
    as === "textarea" ? (
      <textarea id={id} className={`${shared} resize-y`} rows={3} {...rest} />
    ) : as === "select" ? (
      <select id={id} className={`${shared} cursor-pointer`} {...rest}>
        {children}
      </select>
    ) : (
      <input id={id} className={shared} {...rest} />
    );

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {field}
    </div>
  );
}

export default FormField
