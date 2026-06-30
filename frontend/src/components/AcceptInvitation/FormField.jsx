import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const FormField = ({ id, label, type = "text", placeholder, value, onChange, required, autoComplete }) => {
  const { isRTL } = useLocaleDirection();

  return (
    <div className={`flex flex-col gap-1.5 ${isRTL ? "text-right" : "text-left"}`}>
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete={autoComplete}
        dir={type === "email" ? "ltr" : undefined}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-sky-900/30 ${
          type === "email" ? "text-left" : "text-start"
        }`}
      />
    </div>
  );
};

export default FormField;
